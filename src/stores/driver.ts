import { defineStore, acceptHMRUpdate } from 'pinia';
import { ref, computed } from 'vue';
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

  // Biển số xe được chọn xem (cho Dispatcher/Admin kiểm tra, hoặc mặc định theo xe của tài xế)
  const selectedVehiclePlate = ref<string>('');

  // Xác định phương tiện gắn liền với tài xế hiện tại
  const myVehicle = computed(() => {
    const currentDriverId = authStore.currentUser.driverId;
    if (currentDriverId) {
      return (
        fleetStore.vehicles.find(
          (v) =>
            v.assignedDriverId === currentDriverId ||
            v.assignedDriverPhone === authStore.currentUser.phone
        ) || null
      );
    }

    // Nếu là Dispatcher / Admin đang chọn xem tất cả xe:
    if (selectedVehiclePlate.value === 'ALL') {
      return null;
    }

    // Nếu là Dispatcher / Admin đang xem Không gian tài xế:
    if (selectedVehiclePlate.value) {
      const found = fleetStore.vehicles.find((v) => v.licensePlate === selectedVehiclePlate.value);
      if (found) return found;
    }

    // Mặc định liên kết với xe có chuyến đang hoạt động
    const activeTrip = dispatchStore.trips.find(
      (t) =>
        t.status === 'INPROGRESS' ||
        t.status === 'ARRIVED' ||
        t.status === 'ACCEPTED' ||
        t.status === 'ASSIGNED'
    );
    if (activeTrip) {
      const v = fleetStore.vehicles.find(
        (veh) => veh.id === activeTrip.vehicleId || veh.licensePlate === activeTrip.vehiclePlate
      );
      if (v) return v;
    }

    return fleetStore.vehicles[0] || null;
  });

  function setSelectedVehiclePlate(plate: string) {
    selectedVehiclePlate.value = plate;
  }

  // US-07: Tài xế của xe nào thì chỉ xem được lịch sử các chuyến của xe đó
  const myTrips = computed<TransportTrip[]>(() => {
    const currentDriverId = authStore.currentUser.driverId;
    const veh = myVehicle.value;

    // 1. Nếu là tài xế có tài khoản riêng:
    if (currentDriverId) {
      return dispatchStore.trips.filter((t) => {
        // Khớp theo xe phụ trách của tài xế
        if (veh) {
          return t.vehiclePlate === veh.licensePlate || t.vehicleId === veh.id;
        }
        return t.driverId === currentDriverId;
      });
    }

    // 2. Nếu là Dispatcher / Admin đang xem Không gian tài xế:
    if (selectedVehiclePlate.value === 'ALL') {
      return dispatchStore.trips;
    }

    // Nghiêm ngặt chỉ xem các chuyến của xe đang được chọn (myVehicle)
    if (veh) {
      return dispatchStore.trips.filter(
        (t) => t.vehiclePlate === veh.licensePlate || t.vehicleId === veh.id
      );
    }

    return dispatchStore.trips;
  });

  const currentActiveTrip = computed<TransportTrip | undefined>(() => {
    return myTrips.value.find(
      (t) =>
        t.status === 'ASSIGNED' ||
        t.status === 'ACCEPTED' ||
        t.status === 'INPROGRESS' ||
        t.status === 'ARRIVED'
    );
  });

  // Hành động 1: Tài xế xác nhận nhận chuyến xe để thông báo cho Điều phối viên
  function acceptTrip(tripId: number): { success: boolean; message: string } {
    const trip = dispatchStore.trips.find((t) => t.id === tripId);
    if (!trip) return { success: false, message: 'Không tìm thấy chuyến xe' };

    if (trip.status !== 'ASSIGNED') {
      return { success: false, message: 'Chuyến xe đã được xác nhận hoặc đang chạy!' };
    }

    const nowStr = new Date().toISOString().slice(0, 16).replace('T', ' ');
    trip.status = 'ACCEPTED';
    trip.acceptedAt = nowStr;

    // Ghi nhận timeline vào các yêu cầu ghép để người đặt xe & Dispatcher theo dõi
    for (const reqId of trip.requestIds) {
      bookingStore.updateRequestStatus(
        reqId,
        'DISPATCHED',
        trip.driverName,
        `Tài xế ${trip.driverName} đã xác nhận nhận lệnh vận chuyển lúc ${nowStr.slice(11)}.`
      );
    }

    dispatchStore.saveState();

    return {
      success: true,
      message: `Đã xác nhận nhận chuyến ${trip.tripCode}! Thông tin đã được gửi tới Điều phối viên.`,
    };
  }

  // Hành động 2: Bắt đầu chuyến xe (Nhập ODO xuất bến)
  function startTrip(
    tripId: number,
    startOdo: number
  ): { success: boolean; message: string } {
    const trip = dispatchStore.trips.find((t) => t.id === tripId);
    if (!trip) return { success: false, message: 'Không tìm thấy chuyến xe' };

    if (trip.status !== 'ASSIGNED' && trip.status !== 'ACCEPTED') {
      return { success: false, message: 'Chuyến xe không ở trạng thái chờ khởi hành (ASSIGNED hoặc ACCEPTED)' };
    }

    const vehicle = fleetStore.vehicles.find((v) => v.id === trip.vehicleId);
    if (!vehicle) return { success: false, message: 'Không tìm thấy phương tiện' };

    // Validation: StartOdo >= Vehicle.CurrentOdoKm (chống gian lận/nhập sai)
    if (vehicle.vehicleType !== 'MillingMachine' && startOdo < vehicle.currentOdoKm) {
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

    dispatchStore.saveState();

    return {
      success: true,
      message: `Đã bắt đầu chuyến xe ${trip.tripCode}! Chúc tài xế thượng lộ bình an.`,
    };
  }

  // Hành động 3: Tài xế báo cáo đã đến địa điểm chỉ định
  function reportArrived(
    tripId: number,
    note?: string
  ): { success: boolean; message: string } {
    const trip = dispatchStore.trips.find((t) => t.id === tripId);
    if (!trip) return { success: false, message: 'Không tìm thấy chuyến xe' };

    if (trip.status !== 'INPROGRESS') {
      return { success: false, message: 'Chuyến xe chưa khởi hành hoặc đã hoàn thành!' };
    }

    const nowStr = new Date().toISOString().slice(0, 16).replace('T', ' ');
    trip.status = 'ARRIVED';
    trip.arrivedAt = nowStr;
    trip.arrivalNote = note || '';

    // Cập nhật timeline các yêu cầu ghép
    for (const reqId of trip.requestIds) {
      bookingStore.updateRequestStatus(
        reqId,
        'INPROGRESS',
        trip.driverName,
        `Tài xế báo cáo xe đã đến điểm chỉ định lúc ${nowStr.slice(11)}${note ? ` (${note})` : ''}.`
      );
    }

    dispatchStore.saveState();

    return {
      success: true,
      message: `Đã cập nhật trạng thái: Xe đã đến điểm chỉ định! Thông tin đã đồng bộ lên bản đồ Điều phối.`,
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

    if (trip.status !== 'INPROGRESS' && trip.status !== 'ARRIVED') {
      return { success: false, message: 'Chuyến xe chưa bắt đầu hoặc đã hoàn thành!' };
    }

    const vehicle = fleetStore.vehicles.find((v) => v.id === trip.vehicleId);
    if (!vehicle) return { success: false, message: 'Không tìm thấy phương tiện' };

    const startOdo = trip.startOdo || vehicle.currentOdoKm;

    // Rule 18: EndOdo > StartOdo
    if (vehicle.vehicleType !== 'MillingMachine' && payload.endOdo <= startOdo) {
      return {
        success: false,
        message: `Chỉ số ODO về bến (${payload.endOdo.toLocaleString()} km) phải lớn hơn ODO xuất phát (${startOdo.toLocaleString()} km)!`,
      };
    }

    const nowStr = new Date().toISOString().slice(0, 16).replace('T', ' ');
    const distanceKm = vehicle.vehicleType === 'MillingMachine' ? 0 : payload.endOdo - startOdo;

    // Tính tổng khối lượng mủ (US-23)
    const latex1 = Number(payload.weightLatex1Kg) || 0;
    const latex2 = Number(payload.weightLatex2Kg) || 0;
    const latex3 = Number(payload.weightLatex3Kg) || 0;
    const latexTap = Number(payload.weightLatexTapKg) || 0;
    const totalWeightKg = latex1 + latex2 + latex3 + latexTap;

    // Rule 22: Công thức tính nhiên liệu tiêu chuẩn cho xe tải
    let calculatedFuel = 0;
    const distanceForFuel = trip.standardDistanceKm || distanceKm;

    if (vehicle.vehicleType === 'LatexTruck') {
      const emptyFuel = distanceForFuel * (vehicle.fuelQuotaEmpty || 0.25);
      const loadedFuel = (totalWeightKg / 1000) * distanceForFuel * (vehicle.fuelQuotaLoaded || 0.02);
      calculatedFuel = Number((emptyFuel + loadedFuel).toFixed(2));
    } else if (vehicle.vehicleType === 'PassengerCar') {
      calculatedFuel = Number((distanceForFuel * (vehicle.fuelQuotaEmpty || 0.1)).toFixed(2));
    } else if (vehicle.vehicleType === 'MillingMachine') {
      const hours = (payload.endHourMeter || 0) - (payload.startHourMeter || 0);
      calculatedFuel = Number((Math.max(0, hours) * (vehicle.fuelQuotaEmpty || 12.0)).toFixed(2));
    }

    const actualFuel = Number(payload.actualFuelFilledLiters) || 0;
    const fuelVariance = Number((actualFuel - calculatedFuel).toFixed(2));

    // Cập nhật Trip
    trip.endOdo = payload.endOdo;
    trip.actualEndTime = nowStr;
    trip.actualDistanceKm = distanceKm;
    trip.weightLatex1Kg = latex1;
    trip.weightLatex2Kg = latex2;
    trip.weightLatex3Kg = latex3;
    trip.weightLatexTapKg = latexTap;
    trip.totalLatexWeightKg = totalWeightKg;
    trip.calculatedFuelLiters = calculatedFuel;
    trip.actualFuelFilledLiters = actualFuel;
    trip.fuelVarianceLiters = fuelVariance;
    trip.startHourMeter = payload.startHourMeter;
    trip.endHourMeter = payload.endHourMeter;
    trip.totalOperatingHours =
      payload.endHourMeter && payload.startHourMeter
        ? payload.endHourMeter - payload.startHourMeter
        : undefined;
    trip.status = 'COMPLETED';

    // Lưu các chi phí phát sinh nếu có
    if (payload.expenses && payload.expenses.length > 0) {
      trip.expenses = payload.expenses.map((exp, idx) => ({
        id: (exp as any).id || Date.now() + idx,
        tripId: trip.id,
        expenseType: exp.expenseType,
        amount: Number(exp.amount) || 0,
        receiptNote: exp.receiptNote,
        receiptImage: exp.receiptImage,
        recordedAt: (exp as any).recordedAt || new Date().toISOString().slice(0, 16).replace('T', ' '),
        auditStatus: (exp as any).auditStatus || (exp.receiptImage ? 'APPROVED' : 'PENDING'),
      }));
    }

    // Cập nhật ODO xe và kiểm tra cảnh báo bảo dưỡng
    if (vehicle.vehicleType !== 'MillingMachine') {
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

    dispatchStore.saveState();

    return {
      success: true,
      message: `Đã hoàn thành chuyến ${trip.tripCode}! Dầu tiêu chuẩn: ${calculatedFuel}L, Thực tế: ${actualFuel}L (Chênh lệch: ${fuelVariance > 0 ? '+' : ''}${fuelVariance}L).`,
    };
  }

  function addExpenseToTrip(
    tripId: number,
    expense: {
      expenseType: TripExpense['expenseType'];
      amount: number;
      receiptNote?: string;
      receiptImage?: string;
      receiptImages?: string[];
    }
  ) {
    const trip = dispatchStore.trips.find((t) => t.id === tripId);
    if (!trip) return { success: false, message: 'Không tìm thấy chuyến xe' };
    if (!trip.expenses) trip.expenses = [];
    const images = expense.receiptImages && expense.receiptImages.length > 0 
      ? expense.receiptImages 
      : (expense.receiptImage ? [expense.receiptImage] : []);
    const newExp: TripExpense = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      tripId: trip.id,
      expenseType: expense.expenseType,
      amount: Number(expense.amount) || 0,
      receiptNote: expense.receiptNote,
      receiptImage: expense.receiptImage || (images.length > 0 ? images[0] : undefined),
      receiptImages: images.length > 0 ? images : undefined,
      recordedAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
      auditStatus: (expense.receiptImage || images.length > 0) ? 'APPROVED' : 'PENDING',
    };
    trip.expenses.push(newExp);
    dispatchStore.saveState();
    return { success: true, message: 'Đã kê khai chi phí & lưu bằng chứng thành công!', expense: newExp };
  }

  function removeExpenseFromTrip(tripId: number, expenseId: number) {
    const trip = dispatchStore.trips.find((t) => t.id === tripId);
    if (!trip || !trip.expenses) return { success: false, message: 'Không tìm thấy chi phí' };
    const idx = trip.expenses.findIndex((e) => e.id === expenseId);
    if (idx !== -1) {
      trip.expenses.splice(idx, 1);
      dispatchStore.saveState();
      return { success: true, message: 'Đã xóa khoản chi' };
    }
    return { success: false, message: 'Không tìm thấy khoản chi' };
  }

  function auditExpense(tripId: number, expenseId: number, status: 'APPROVED' | 'REJECTED' | 'PENDING', note?: string) {
    const trip = dispatchStore.trips.find((t) => t.id === tripId);
    if (!trip || !trip.expenses) return { success: false, message: 'Không tìm thấy chuyến xe' };
    const exp = trip.expenses.find((e) => e.id === expenseId);
    if (!exp) return { success: false, message: 'Không tìm thấy khoản chi' };
    exp.auditStatus = status;
    if (note !== undefined) exp.auditNote = note;
    dispatchStore.saveState();
    return { success: true, message: 'Đã cập nhật trạng thái thẩm định bằng chứng chi phí' };
  }

  return {
    myTrips,
    myVehicle,
    selectedVehiclePlate,
    setSelectedVehiclePlate,
    currentActiveTrip,
    acceptTrip,
    startTrip,
    reportArrived,
    completeTrip,
    addExpenseToTrip,
    removeExpenseFromTrip,
    auditExpense,
  };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useDriverStore, import.meta.hot));
}
