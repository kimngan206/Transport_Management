import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { mockStorage } from '@/services/mockStorage';
import { useBookingStore } from './booking';
import { useFleetStore } from './fleet';
import type { TransportTrip, TransportRequest, TripReplacementInfo } from '@/types';
import { areRequestsRouteCompatible } from '@/utils/routeMatcher';

export const useDispatchStore = defineStore('dispatch', () => {
  const trips = ref<TransportTrip[]>(mockStorage.getTrips());
  const bookingStore = useBookingStore();
  const fleetStore = useFleetStore();

  function saveState() {
    mockStorage.saveTrips(trips.value);
  }

  // Getters
  const activeTrips = computed(() =>
    trips.value.filter(
      (t) =>
        t.status === 'ASSIGNED' ||
        t.status === 'ACCEPTED' ||
        t.status === 'INPROGRESS' ||
        t.status === 'ARRIVED'
    )
  );

  const completedTrips = computed(() =>
    trips.value.filter((t) => t.status === 'COMPLETED')
  );

  function getDriverTrips(driverId: number): TransportTrip[] {
    return trips.value.filter((t) => t.driverId === driverId);
  }

  // Rule 15: Kiểm tra xe và tài xế bị trùng lịch với Buffer 30 phút
  function checkResourceConflict(
    vehicleId: number,
    driverId: number,
    startTimeStr: string,
    endTimeStr: string,
    excludeTripId?: number
  ): { hasConflict: boolean; reason?: string } {
    const BUFFER_MS = 30 * 60 * 1000; // 30 phút buffer
    const newStart = new Date(startTimeStr).getTime();
    const newEnd = new Date(endTimeStr).getTime();

    const relatedTrips = trips.value.filter(
      (t) =>
        t.id !== excludeTripId &&
        (t.status === 'ASSIGNED' ||
          t.status === 'ACCEPTED' ||
          t.status === 'INPROGRESS' ||
          t.status === 'ARRIVED') &&
        (t.vehicleId === vehicleId || t.driverId === driverId)
    );

    for (const trip of relatedTrips) {
      const tripStart = new Date(trip.scheduledStartTime).getTime();
      const tripEnd = new Date(trip.scheduledEndTime).getTime();

      // Kiểm tra giao cắt với buffer
      const isConflict =
        newStart < tripEnd + BUFFER_MS && newEnd > tripStart - BUFFER_MS;

      if (isConflict) {
        if (trip.vehicleId === vehicleId) {
          return {
            hasConflict: true,
            reason: `Phương tiện đang vướng chuyến [${trip.tripCode}: ${trip.scheduledStartTime.slice(11)} ➔ ${trip.scheduledEndTime.slice(11)}] (yêu cầu đệm 30 phút)`,
          };
        }
        if (trip.driverId === driverId) {
          return {
            hasConflict: true,
            reason: `Tài xế đang có lịch chạy chuyến [${trip.tripCode}: ${trip.scheduledStartTime.slice(11)} ➔ ${trip.scheduledEndTime.slice(11)}] (yêu cầu đệm 30 phút)`,
          };
        }
      }
    }

    return { hasConflict: false };
  }

  // Rule 14: Kiểm tra 4 điều kiện ghép chuyến (US-06)
  function validateBatchingConditions(
    requestList: TransportRequest[],
    vehicleId: number
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (requestList.length === 0) {
      errors.push('Chưa chọn yêu cầu nào để ghép chuyến');
      return { isValid: false, errors };
    }

    const targetVehicle = fleetStore.vehicles.find((v) => v.id === vehicleId);
    if (!targetVehicle) {
      errors.push('Phương tiện được chọn không tồn tại');
      return { isValid: false, errors };
    }

    // Điều kiện 1: Cùng loại xe
    const firstType = requestList[0].vehicleType;
    const isSameType = requestList.every((r) => r.vehicleType === firstType);
    if (!isSameType) {
      errors.push('Điều kiện 1 không đạt: Tất cả yêu cầu ghép phải cùng loại xe (Không ghép Truck với Pickup)!');
    }
    if (targetVehicle.vehicleType !== firstType) {
      errors.push(`Xe được gán [${targetVehicle.vehicleType}] không khớp với loại xe của các yêu cầu [${firstType}]!`);
    }

    // Điều kiện 2: Thời gian xuất phát lệch nhau <= 30 phút
    if (requestList.length > 1) {
      const times = requestList.map((r) => new Date(r.startTime).getTime());
      const minTime = Math.min(...times);
      const maxTime = Math.max(...times);
      const diffMins = (maxTime - minTime) / (60 * 1000);
      if (diffMins > 30) {
        errors.push(`Điều kiện 2 không đạt: Thời gian khởi hành giữa các yêu cầu lệch nhau ${diffMins} phút (vượt mức tối đa 30 phút)!`);
      }
    }

    // Điều kiện 3: Chung cung đường / tương thích lộ trình quy chuẩn
    const firstReq = requestList[0];
    const isSameRoute = requestList.every((r) =>
      areRequestsRouteCompatible(firstReq, r, fleetStore.routes)
    );
    if (!isSameRoute) {
      errors.push('Điều kiện 3 không đạt: Các yêu cầu phải đi cùng một cung đường / lộ trình tương thích!');
    }

    // Điều kiện 4: Không vượt sức chứa / tải trọng
    if (targetVehicle.vehicleType === 'LatexTruck') {
      const totalWeightKg = requestList.reduce((acc, r) => acc + (r.estimatedWeightKg || 0), 0);
      const maxCapacityKg = targetVehicle.capacityTons * 1000;
      if (totalWeightKg > maxCapacityKg) {
        errors.push(
          `Điều kiện 4 không đạt: Tổng tải trọng ghép (${totalWeightKg.toLocaleString()} kg) vượt quá sức chứa xe (${maxCapacityKg.toLocaleString()} kg)!`
        );
      }
    } else if (targetVehicle.vehicleType === 'PassengerCar') {
      const totalPassengers = requestList.reduce((acc, r) => acc + (r.passengersCount || 1), 0);
      const maxPassengers = targetVehicle.passengerCapacity || 5;
      if (totalPassengers > maxPassengers) {
        errors.push(
          `Điều kiện 4 không đạt: Tổng số hành khách (${totalPassengers} người) vượt quá số ghế xe (${maxPassengers} người)!`
        );
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  // Điều phối / Ghép chuyến
  function dispatchTrip(payload: {
    vehicleId: number;
    driverId: number;
    requestIds: number[];
    routeId: number;
    scheduledStartTime: string;
    scheduledEndTime: string;
    notes?: string;
    dispatcherName: string;
  }): { success: boolean; message: string; data?: TransportTrip } {
    const selectedRequests = bookingStore.requests.filter((r) =>
      payload.requestIds.includes(r.id)
    );

    // Kiểm tra điều kiện ghép
    const batchCheck = validateBatchingConditions(selectedRequests, payload.vehicleId);
    if (!batchCheck.isValid) {
      return {
        success: false,
        message: batchCheck.errors.join(' | '),
      };
    }

    // Kiểm tra tài xế
    const driver = fleetStore.drivers.find((d) => d.id === payload.driverId);
    if (!driver) {
      return { success: false, message: 'Không tìm thấy tài xế' };
    }
    if (driver.employmentStatus !== 'Active') {
      return { success: false, message: 'Tài xế đang nghỉ phép hoặc tạm dừng hoạt động' };
    }
    if (new Date(driver.licenseExpiryDate).getTime() < new Date().getTime()) {
      return { success: false, message: 'Bằng lái của tài xế đã hết hạn sử dụng!' };
    }

    // Kiểm tra xe
    const vehicle = fleetStore.vehicles.find((v) => v.id === payload.vehicleId);
    if (!vehicle) {
      return { success: false, message: 'Không tìm thấy phương tiện' };
    }
    if (vehicle.status === 'Broken' || vehicle.status === 'UnderMaintenance') {
      return { success: false, message: 'Phương tiện đang hỏng hoặc bảo dưỡng, không thể điều phối!' };
    }

    // Kiểm tra trùng lịch buffer 30 phút
    const conflictCheck = checkResourceConflict(
      payload.vehicleId,
      payload.driverId,
      payload.scheduledStartTime,
      payload.scheduledEndTime
    );
    if (conflictCheck.hasConflict) {
      return {
        success: false,
        message: `Xung đột lịch điều phối: ${conflictCheck.reason}`,
      };
    }

    const route = fleetStore.routes.find((r) => r.id === payload.routeId) || fleetStore.routes[0];
    const now = new Date();
    const dateStr = now.toISOString().slice(2, 10).replace(/-/g, '');
    const codeNum = String(trips.value.length + 1).padStart(3, '0');
    const tripCode = `TR-${dateStr}-${codeNum}`;

    const newTrip: TransportTrip = {
      id: Date.now(),
      tripCode,
      vehicleId: vehicle.id,
      vehiclePlate: vehicle.licensePlate,
      vehicleType: vehicle.vehicleType,
      driverId: driver.id,
      driverName: driver.fullName,
      driverPhone: driver.phone,
      requestIds: payload.requestIds,
      routeId: route.id,
      routeName: route.name,
      standardDistanceKm: route.standardDistanceKm,
      scheduledStartTime: payload.scheduledStartTime,
      scheduledEndTime: payload.scheduledEndTime,
      status: 'ASSIGNED',
      notes: payload.notes,
      expenses: [],
      createdAt: now.toISOString().slice(0, 16).replace('T', ' '),
    };

    trips.value.unshift(newTrip);
    saveState();

    // Cập nhật trạng thái các request sang DISPATCHED và gán lộ trình quy chuẩn
    for (const reqId of payload.requestIds) {
      bookingStore.updateRequestStatus(
        reqId,
        'DISPATCHED',
        payload.dispatcherName,
        `Đã phân công xe [${vehicle.licensePlate}] và tài xế [${driver.fullName}] theo tuyến quy chuẩn [${route.name}] (${route.standardDistanceKm} km) trong chuyến [${tripCode}]`,
        newTrip.id,
        route.id
      );
    }

    return {
      success: true,
      message: `Đã tạo thành công chuyến xe ${tripCode} với ${payload.requestIds.length} yêu cầu được ghép!`,
      data: newTrip,
    };
  }

  // Cập nhật thông tin chuyến xe & Điều xe thay thế
  function updateTrip(payload: {
    tripId: number;
    vehicleId: number;
    driverId: number;
    routeId: number;
    scheduledStartTime: string;
    scheduledEndTime: string;
    notes?: string;
    replacementInfo?: TripReplacementInfo;
  }): { success: boolean; message: string; data?: TransportTrip } {
    const trip = trips.value.find(t => t.id === payload.tripId);
    if (!trip) {
      return { success: false, message: 'Không tìm thấy chuyến xe' };
    }

    // Kiểm tra tài xế
    const driver = fleetStore.drivers.find((d) => d.id === payload.driverId);
    if (!driver) {
      return { success: false, message: 'Không tìm thấy tài xế' };
    }
    if (driver.employmentStatus !== 'Active') {
      return { success: false, message: 'Tài xế đang nghỉ phép hoặc tạm dừng hoạt động' };
    }
    if (new Date(driver.licenseExpiryDate).getTime() < new Date().getTime()) {
      return { success: false, message: 'Bằng lái của tài xế đã hết hạn sử dụng!' };
    }

    // Kiểm tra xe
    const vehicle = fleetStore.vehicles.find((v) => v.id === payload.vehicleId);
    if (!vehicle) {
      return { success: false, message: 'Không tìm thấy phương tiện' };
    }
    if (vehicle.status === 'Broken' || vehicle.status === 'UnderMaintenance') {
      return { success: false, message: 'Phương tiện đang hỏng hoặc bảo dưỡng, không thể điều phối!' };
    }

    // Kiểm tra trùng lịch buffer 30 phút (loại trừ chuyến hiện tại)
    const conflictCheck = checkResourceConflict(
      payload.vehicleId,
      payload.driverId,
      payload.scheduledStartTime,
      payload.scheduledEndTime,
      payload.tripId
    );
    if (conflictCheck.hasConflict) {
      return {
        success: false,
        message: `Xung đột lịch điều phối: ${conflictCheck.reason}`,
      };
    }

    const oldVehicleId = trip.vehicleId;
    const oldVehiclePlate = trip.vehiclePlate;
    const oldDriverId = trip.driverId;
    const oldDriverName = trip.driverName;
    const oldDriverPhone = trip.driverPhone;
    const isSwapped = oldVehicleId !== vehicle.id || oldDriverId !== driver.id;

    // Cập nhật trạng thái phương tiện
    if (oldVehicleId !== vehicle.id) {
      const oldVehicle = fleetStore.vehicles.find((v) => v.id === oldVehicleId);
      if (oldVehicle && oldVehicle.status === 'OnTrip') {
        oldVehicle.status = 'Available';
      }
      if (vehicle.status === 'Available') {
        vehicle.status = 'OnTrip';
      }
    }

    const route = fleetStore.routes.find((r) => r.id === payload.routeId) || fleetStore.routes[0];
    const nowStr = new Date().toISOString().slice(0, 16).replace('T', ' ');

    // Nếu có thông tin cứu viện / đổi xe
    if (payload.replacementInfo) {
      trip.replacementInfo = payload.replacementInfo;
    } else if (isSwapped && (oldVehiclePlate || oldDriverName)) {
      trip.replacementInfo = {
        isRescueTrip: true,
        originalVehiclePlate: oldVehiclePlate,
        originalDriverId: oldDriverId,
        originalDriverName: oldDriverName,
        originalDriverPhone: oldDriverPhone,
        incidentReason: 'Điều phối viên điều xe thay thế',
        swappedAt: nowStr,
        swappedBy: 'Điều phối viên',
        handoverStatus: 'PENDING_HANDOVER',
      };
    }

    // Cập nhật thông tin chuyến xe
    trip.vehicleId = vehicle.id;
    trip.vehiclePlate = vehicle.licensePlate;
    trip.vehicleType = vehicle.vehicleType;
    trip.driverId = driver.id;
    trip.driverName = driver.fullName;
    trip.driverPhone = driver.phone;
    trip.routeId = route.id;
    trip.routeName = route.name;
    trip.standardDistanceKm = route.standardDistanceKm;
    trip.scheduledStartTime = payload.scheduledStartTime;
    trip.scheduledEndTime = payload.scheduledEndTime;
    trip.notes = payload.notes;

    // Khi có đổi xe / đổi tài xế: Cập nhật timeline đơn hàng & Gửi thông báo đến tài xế 2 bên
    if (isSwapped) {
      // 1. Cập nhật timeline các đơn mủ
      for (const reqId of trip.requestIds) {
        bookingStore.updateRequestStatus(
          reqId,
          'DISPATCHED',
          payload.replacementInfo?.swappedBy || 'Điều phối viên',
          `Điều xe thay thế: Chuyển giao sang xe ${vehicle.licensePlate} (Tài xế: ${driver.fullName} - ${driver.phone}) do xe ${oldVehiclePlate} gặp sự cố.`
        );
      }

      // 2. Gửi thông báo khẩn cấp đến Tài Xế Mới (xe cứu viện)
      mockStorage.addDriverNotification({
        targetDriverId: driver.id,
        targetPlate: vehicle.licensePlate,
        tripCode: trip.tripCode,
        type: 'RESCUE_DISPATCH',
        title: `🚨 LỆNH ĐIỀU ĐỘNG CỨU VIỆN KHẨN CẤP (${trip.tripCode})`,
        content: `Bạn được điều xe ${vehicle.licensePlate} tiếp quản chuyến ${trip.tripCode} thay cho xe ${oldVehiclePlate} (${oldDriverName} - ${oldDriverPhone}). Di chuyển đến hiện trường để tiếp nhận bàn giao lô mủ cao su.`,
        locationGps: trip.replacementInfo?.incidentGps || '10.9595, 106.8115',
        createdAt: nowStr,
      });

      // 3. Gửi thông báo đến Tài Xế Cũ (xe gặp nạn)
      if (oldDriverId && oldDriverId !== driver.id) {
        mockStorage.addDriverNotification({
          targetDriverId: oldDriverId,
          targetPlate: oldVehiclePlate,
          tripCode: trip.tripCode,
          type: 'TRIP_HANDOVER',
          title: `ℹ️ CHUYẾN XE ${trip.tripCode} ĐÃ ĐƯỢC BÀN GIAO`,
          content: `Điều phối viên đã điều động xe ${vehicle.licensePlate} (Tài xế ${driver.fullName} - ${driver.phone}) đến hiện trường tiếp quản chuyến xe. Vui lòng bảo quản lô mủ và bàn giao khi xe đến.`,
          createdAt: nowStr,
        });
      }

      // 4. Cập nhật nhật ký sự cố tài xế nếu có
      try {
        const driverIncidents = mockStorage.getDriverIncidents();
        const targetInc = driverIncidents.find(
          (di: any) => di.vehiclePlate === oldVehiclePlate && di.status !== 'RESOLVED'
        );
        if (targetInc) {
          targetInc.status = 'IN_REPAIR';
          targetInc.repairNote = `Đã điều xe thay thế ${vehicle.licensePlate} (Tài xế ${driver.fullName} - ${driver.phone}) tiếp quản chuyến. Đội cứu hộ đang đến hiện trường.`;
          mockStorage.saveDriverIncidents(driverIncidents);
        }
      } catch (err) {}
    }

    saveState();
    fleetStore.saveState();

    const swapMessage = isSwapped
      ? `Đã điều xe ${vehicle.licensePlate} (Tài xế: ${driver.fullName}) thay thế cho chuyến ${trip.tripCode} và cập nhật thông báo tới các tài xế thành công!`
      : `Đã cập nhật thông tin chuyến xe ${trip.tripCode} thành công!`;

    return {
      success: true,
      message: swapMessage,
      data: trip,
    };
  }

  return {
    trips,
    activeTrips,
    completedTrips,
    getDriverTrips,
    checkResourceConflict,
    validateBatchingConditions,
    dispatchTrip,
    updateTrip,
    saveState,
  };
});

