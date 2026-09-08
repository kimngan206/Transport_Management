import { defineStore } from 'pinia';
import { computed } from 'vue';
import { useDispatchStore } from './dispatch';
import { useFleetStore } from './fleet';
import { useBookingStore } from './booking';
import { useAuthStore } from './auth';
import type { TransportTrip, TripExpense } from '@/types';

export const useDriverStore = defineStore('driver', () => {
  const dispatchStore = useDispatchStore();
  const fleetStore = useFleetStore();
  const bookingStore = useBookingStore();
  const authStore = useAuthStore();

  // US-07: Driver chỉ xem các chuyến của chính mình
  const myTrips = computed<TransportTrip[]>(() => {
    const currentDriverId = authStore.currentUser.driverId;
    if (!currentDriverId) {
      // Nếu user là Admin hoặc Dispatcher đang kiểm tra, hiển thị tất cả
      if (authStore.activeRole === 'Admin' || authStore.activeRole === 'Dispatcher') {
        return dispatchStore.trips;
      }
      return [];
    }
    return dispatchStore.trips.filter((t) => t.driverId === currentDriverId);
  });

  const currentActiveTrip = computed<TransportTrip | undefined>(() => {
    return myTrips.value.find((t) => t.status === 'INPROGRESS' || t.status === 'ASSIGNED');
  });

  // US-08: Bắt đầu chuyến xe
  function startTrip(
    tripId: number,
    startOdo: number
  ): { success: boolean; message: string } {
    const trip = dispatchStore.trips.find((t) => t.id === tripId);
    if (!trip) return { success: false, message: 'Không tìm thấy chuyến xe' };

    if (trip.status !== 'ASSIGNED') {
      return { success: false, message: 'Chuyến xe không ở trạng thái chờ khởi hành (ASSIGNED)' };
    }

    const vehicle = fleetStore.vehicles.find((v) => v.id === trip.vehicleId);
    if (!vehicle) return { success: false, message: 'Không tìm thấy phương tiện' };

    // Validation: StartOdo >= Vehicle.CurrentOdoKm (chống gian lận/nhập sai)
    if (vehicle.vehicleType !== 'Excavator' && startOdo < vehicle.currentOdoKm) {
      return {
        success: false,
        message: `Chỉ số ODO xuất phát (${startOdo.toLocaleString()} km) không được nhỏ hơn ODO hiện tại của xe (${vehicle.currentOdoKm.toLocaleString()} km)!`,
      };
    }

    const nowStr = new Date().toISOString().slice(0, 16).replace('T', ' ');

    trip.startOdo = startOdo;
    trip.actualStartTime = nowStr;
    trip.status = 'INPROGRESS';

    // Đổi trạng thái xe sang OnTrip
    fleetStore.setVehicleStatus(vehicle.id, 'OnTrip');
    fleetStore.setDriverStatus(trip.driverId, true);

    // Cập nhật các request con sang INPROGRESS
    for (const reqId of trip.requestIds) {
      bookingStore.updateRequestStatus(
        reqId,
        'INPROGRESS',
        trip.driverName,
        `Tài xế đã xuất bến. Chỉ số ODO: ${startOdo.toLocaleString()} km.`
      );
    }

    return {
      success: true,
      message: `Đã bắt đầu chuyến xe ${trip.tripCode}! Chúc tài xế thượng lộ bình an.`,
    };
  }

  // US-09: Hoàn thành chuyến xe & Tính toán nhiên liệu, ODO
  function completeTrip(
    tripId: number,
    payload: {
      endOdo: number;
      actualFuelFilledLiters: number;
      weightLatex1Kg?: number;
      weightLatex2Kg?: number;
      weightLatex3Kg?: number;
      weightLatexTapKg?: number;
      startHourMeter?: number;
      endHourMeter?: number;
      expenses?: Omit<TripExpense, 'id' | 'tripId' | 'recordedAt'>[];
      notes?: string;
    }
  ): { success: boolean; message: string } {
    const trip = dispatchStore.trips.find((t) => t.id === tripId);
    if (!trip) return { success: false, message: 'Không tìm thấy chuyến xe' };

    if (trip.status !== 'INPROGRESS') {
      return { success: false, message: 'Chuyến xe chưa bắt đầu hoặc đã hoàn thành!' };
    }

    const vehicle = fleetStore.vehicles.find((v) => v.id === trip.vehicleId);
    if (!vehicle) return { success: false, message: 'Không tìm thấy phương tiện' };

    const startOdo = trip.startOdo || vehicle.currentOdoKm;

    // Rule 18: EndOdo > StartOdo
    if (vehicle.vehicleType !== 'Excavator' && payload.endOdo <= startOdo) {
      return {
        success: false,
        message: `Chỉ số ODO về bến (${payload.endOdo.toLocaleString()} km) phải lớn hơn ODO xuất phát (${startOdo.toLocaleString()} km)!`,
      };
    }

    const nowStr = new Date().toISOString().slice(0, 16).replace('T', ' ');
    const distanceKm = vehicle.vehicleType === 'Excavator' ? 0 : payload.endOdo - startOdo;

    // Tính tổng khối lượng mủ (US-23)
    const latex1 = Number(payload.weightLatex1Kg) || 0;
    const latex2 = Number(payload.weightLatex2Kg) || 0;
    const latex3 = Number(payload.weightLatex3Kg) || 0;
    const latexTap = Number(payload.weightLatexTapKg) || 0;
    const totalWeightKg = latex1 + latex2 + latex3 + latexTap;

    // Rule 22: Công thức tính nhiên liệu tiêu chuẩn cho xe tải
    // Dầu chuẩn = (StandardDistanceKm * NLP) + [(WeightKg / 1000) * StandardDistanceKm * NLC]
    let calculatedFuel = 0;
    const distanceForFuel = trip.standardDistanceKm || distanceKm;

    if (vehicle.vehicleType === 'Truck') {
      const emptyFuel = distanceForFuel * (vehicle.fuelQuotaEmpty || 0.25);
      const loadedFuel = (totalWeightKg / 1000) * distanceForFuel * (vehicle.fuelQuotaLoaded || 0.02);
      calculatedFuel = Number((emptyFuel + loadedFuel).toFixed(2));
    } else if (vehicle.vehicleType === 'Pickup') {
      calculatedFuel = Number((distanceForFuel * (vehicle.fuelQuotaEmpty || 0.1)).toFixed(2));
    } else if (vehicle.vehicleType === 'Excavator') {
      // Rule 24: Xe xúc theo giờ máy
      const hours = (payload.endHourMeter || 0) - (payload.startHourMeter || 0);
      calculatedFuel = Number((hours * (vehicle.hourMeterQuota || 14.5)).toFixed(2));
      trip.startHourMeter = payload.startHourMeter;
      trip.endHourMeter = payload.endHourMeter;
      trip.totalOperatingHours = hours;
      if (vehicle.currentOperatingHours !== undefined) {
        vehicle.currentOperatingHours = payload.endHourMeter || vehicle.currentOperatingHours;
      }
    }

    const actualFuel = Number(payload.actualFuelFilledLiters) || 0;
    const fuelVariance = Number((actualFuel - calculatedFuel).toFixed(2));

    // Cập nhật thông tin Trip
    trip.endOdo = payload.endOdo;
    trip.actualDistanceKm = distanceKm;
    trip.actualEndTime = nowStr;
    trip.weightLatex1Kg = latex1;
    trip.weightLatex2Kg = latex2;
    trip.weightLatex3Kg = latex3;
    trip.weightLatexTapKg = latexTap;
    trip.totalLatexWeightKg = totalWeightKg;
    trip.calculatedFuelLiters = calculatedFuel;
    trip.actualFuelFilledLiters = actualFuel;
    trip.fuelVarianceLiters = fuelVariance;
    trip.status = 'COMPLETED';
    if (payload.notes) trip.notes = payload.notes;

    // Chi phí chuyến đi (Rule 20)
    if (payload.expenses && payload.expenses.length > 0) {
      const newExpenses: TripExpense[] = payload.expenses.map((e, idx) => ({
        ...e,
        id: Date.now() + idx,
        tripId: trip.id,
        recordedAt: nowStr,
      }));
      trip.expenses.push(...newExpenses);
    }

    // Cập nhật ODO xe & kiểm tra bảo dưỡng 5.000 km (Rule 19 & 27)
    if (vehicle.vehicleType !== 'Excavator') {
      fleetStore.updateVehicleOdo(vehicle.id, payload.endOdo);
    }

    // Trả trạng thái xe & tài xế về Available
    fleetStore.setVehicleStatus(vehicle.id, 'Available');
    fleetStore.setDriverStatus(trip.driverId, false);

    // Cập nhật các request con sang COMPLETED
    for (const reqId of trip.requestIds) {
      bookingStore.updateRequestStatus(
        reqId,
        'COMPLETED',
        trip.driverName,
        `Chuyến xe đã hoàn thành. Quãng đường: ${distanceKm} km. Tổng mủ: ${totalWeightKg.toLocaleString()} kg.`
      );
    }

    return {
      success: true,
      message: `Đã hoàn thành chuyến ${trip.tripCode}! Dầu tiêu chuẩn: ${calculatedFuel}L, Thực tế: ${actualFuel}L (Chênh lệch: ${fuelVariance > 0 ? '+' : ''}${fuelVariance}L).`,
    };
  }

  return {
    myTrips,
    currentActiveTrip,
    startTrip,
    completeTrip,
  };
});
