import type { TransportTrip } from '@/types';
import { mockStorage } from '@/services/mockStorage';

/**
 * Lấy thời gian đệm và giãn cách được cấu hình cho một phương tiện cụ thể
 */
export function getVehicleBufferMinutes(
  vehicleId: number,
  vehicleType?: string
): {
  turnaroundMinutes: number;
  interVehicleMinutes: number;
  cleaningDurationMinutes: number;
  isCustom: boolean;
  sourceText: string;
} {
  try {
    const settings = mockStorage.getTripSettings();
    const specific = settings.specificVehicleSettings?.find((s) => s.vehicleId === vehicleId);

    if (specific && specific.useCustom) {
      return {
        turnaroundMinutes: specific.turnaroundBufferMinutes || 30,
        interVehicleMinutes: specific.interVehicleIntervalMinutes || 15,
        cleaningDurationMinutes: specific.cleaningDurationMinutes || 10,
        isCustom: true,
        sourceText: `Cấu hình riêng cho xe [${specific.licensePlate}] (${specific.turnaroundBufferMinutes}p đệm, ${specific.interVehicleIntervalMinutes}p giãn cách)`,
      };
    }

    const vType = (vehicleType || specific?.vehicleType || 'LatexTruck') as keyof typeof settings.vehicleTypeSettings;
    const typeConfig = settings.vehicleTypeSettings?.[vType];

    if (typeConfig) {
      return {
        turnaroundMinutes: typeConfig.turnaroundBufferMinutes || 30,
        interVehicleMinutes: typeConfig.interVehicleIntervalMinutes || 15,
        cleaningDurationMinutes: typeConfig.cleaningDurationMinutes || 10,
        isCustom: false,
        sourceText: `Theo quy chuẩn loại xe ${vType} (${typeConfig.turnaroundBufferMinutes}p đệm)`,
      };
    }

    return {
      turnaroundMinutes: settings.defaultTurnaroundMinutes || 30,
      interVehicleMinutes: settings.defaultInterVehicleIntervalMinutes || 15,
      cleaningDurationMinutes: 10,
      isCustom: false,
      sourceText: `Mặc định toàn hệ thống (${settings.defaultTurnaroundMinutes}p đệm)`,
    };
  } catch {
    return {
      turnaroundMinutes: 30,
      interVehicleMinutes: 15,
      cleaningDurationMinutes: 10,
      isCustom: false,
      sourceText: 'Mặc định (30p đệm)',
    };
  }
}

/**
 * Lấy thứ tự chuyến và tổng số chuyến trong ngày của một chuyến xe cụ thể (theo phương tiện)
 */
export function getTripDaySequence(
  trip: TransportTrip,
  allTrips: TransportTrip[]
): {
  tripOrder: number;
  totalInDay: number;
  label: string;
  fullLabel: string;
} {
  if (!trip || !trip.scheduledStartTime) {
    return { tripOrder: 1, totalInDay: 1, label: 'Chuyến 1/1', fullLabel: 'Chuyến 1/1 trong ngày' };
  }

  const tripDate = trip.scheduledStartTime.slice(0, 10);
  const sameDayVehicleTrips = allTrips
    .filter(
      (t) =>
        t.status !== 'CANCELLED' &&
        t.vehicleId === trip.vehicleId &&
        t.scheduledStartTime &&
        t.scheduledStartTime.slice(0, 10) === tripDate
    )
    .sort((a, b) => new Date(a.scheduledStartTime).getTime() - new Date(b.scheduledStartTime).getTime());

  const index = sameDayVehicleTrips.findIndex((t) => t.id === trip.id);
  const tripOrder = index >= 0 ? index + 1 : 1;
  const totalInDay = sameDayVehicleTrips.length || 1;

  return {
    tripOrder,
    totalInDay,
    label: `Chuyến ${tripOrder}/${totalInDay}`,
    fullLabel: `Chuyến ${tripOrder}/${totalInDay} trong ngày`,
  };
}

/**
 * Lấy tất cả các chuyến xe của 1 phương tiện trong ngày chỉ định
 */
export function getVehicleDailyTrips(
  vehicleId: number,
  dateStr: string,
  allTrips: TransportTrip[]
): TransportTrip[] {
  if (!dateStr) return [];
  const targetDate = dateStr.slice(0, 10);
  return allTrips
    .filter(
      (t) =>
        t.status !== 'CANCELLED' &&
        t.vehicleId === vehicleId &&
        t.scheduledStartTime &&
        t.scheduledStartTime.slice(0, 10) === targetDate
    )
    .sort((a, b) => new Date(a.scheduledStartTime).getTime() - new Date(b.scheduledStartTime).getTime());
}

/**
 * Lấy tất cả các chuyến xe của 1 tài xế trong ngày chỉ định
 */
export function getDriverDailyTrips(
  driverId: number,
  dateStr: string,
  allTrips: TransportTrip[]
): TransportTrip[] {
  if (!dateStr) return [];
  const targetDate = dateStr.slice(0, 10);
  return allTrips
    .filter(
      (t) =>
        t.status !== 'CANCELLED' &&
        t.driverId === driverId &&
        t.scheduledStartTime &&
        t.scheduledStartTime.slice(0, 10) === targetDate
    )
    .sort((a, b) => new Date(a.scheduledStartTime).getTime() - new Date(b.scheduledStartTime).getTime());
}

/**
 * Kiểm tra xem phương tiện có bị trùng khung giờ chạy với thời gian đệm đã cấu hình hay không
 */
export function checkVehicleSlotConflict(
  vehicleId: number,
  startTimeStr: string,
  endTimeStr: string,
  allTrips: TransportTrip[],
  excludeTripId?: number,
  vehicleType?: string
): { hasConflict: boolean; conflictingTrip?: TransportTrip; reason?: string; bufferMinutes: number } {
  if (!startTimeStr || !endTimeStr) return { hasConflict: false, bufferMinutes: 30 };

  const { turnaroundMinutes } = getVehicleBufferMinutes(vehicleId, vehicleType);
  const BUFFER_MS = turnaroundMinutes * 60 * 1000;
  const newStart = new Date(startTimeStr).getTime();
  const newEnd = new Date(endTimeStr).getTime();

  const activeTrips = allTrips.filter(
    (t) =>
      t.id !== excludeTripId &&
      t.vehicleId === vehicleId &&
      t.status !== 'CANCELLED' &&
      t.status !== 'COMPLETED'
  );

  for (const trip of activeTrips) {
    const tripStart = new Date(trip.scheduledStartTime).getTime();
    const tripEnd = new Date(trip.scheduledEndTime).getTime();

    const isConflict = newStart < tripEnd + BUFFER_MS && newEnd > tripStart - BUFFER_MS;
    if (isConflict) {
      return {
        hasConflict: true,
        conflictingTrip: trip,
        reason: `Trùng lịch với chuyến [${trip.tripCode}: ${trip.scheduledStartTime.slice(11, 16)} ➔ ${trip.scheduledEndTime.slice(11, 16)}] (yêu cầu đệm ${turnaroundMinutes} phút)`,
        bufferMinutes: turnaroundMinutes,
      };
    }
  }

  return { hasConflict: false, bufferMinutes: turnaroundMinutes };
}

/**
 * Kiểm tra xem tài xế có bị trùng khung giờ chạy với đệm an toàn hay không
 */
export function checkDriverSlotConflict(
  driverId: number,
  startTimeStr: string,
  endTimeStr: string,
  allTrips: TransportTrip[],
  excludeTripId?: number
): { hasConflict: boolean; conflictingTrip?: TransportTrip; reason?: string } {
  if (!startTimeStr || !endTimeStr) return { hasConflict: false };

  const BUFFER_MS = 30 * 60 * 1000;
  const newStart = new Date(startTimeStr).getTime();
  const newEnd = new Date(endTimeStr).getTime();

  const activeTrips = allTrips.filter(
    (t) =>
      t.id !== excludeTripId &&
      t.driverId === driverId &&
      t.status !== 'CANCELLED' &&
      t.status !== 'COMPLETED'
  );

  for (const trip of activeTrips) {
    const tripStart = new Date(trip.scheduledStartTime).getTime();
    const tripEnd = new Date(trip.scheduledEndTime).getTime();

    const isConflict = newStart < tripEnd + BUFFER_MS && newEnd > tripStart - BUFFER_MS;
    if (isConflict) {
      return {
        hasConflict: true,
        conflictingTrip: trip,
        reason: `Tài xế đang vướng chuyến [${trip.tripCode}: ${trip.scheduledStartTime.slice(11, 16)} ➔ ${trip.scheduledEndTime.slice(11, 16)}] (kèm đệm 30 phút)`,
      };
    }
  }

  return { hasConflict: false };
}

/**
 * Kiểm tra giãn cách giữa các xe khởi hành cùng tuyến hoặc cùng thời điểm
 */
export function checkInterVehicleIntervalConflict(
  vehicleId: number,
  startTimeStr: string,
  allTrips: TransportTrip[],
  routeId?: number,
  excludeTripId?: number
): {
  hasWarning: boolean;
  otherTrip?: TransportTrip;
  gapMinutes?: number;
  recommendedIntervalMinutes: number;
  message?: string;
} {
  if (!startTimeStr) return { hasWarning: false, recommendedIntervalMinutes: 15 };

  const { interVehicleMinutes } = getVehicleBufferMinutes(vehicleId);
  const newStart = new Date(startTimeStr).getTime();
  const targetDate = startTimeStr.slice(0, 10);

  const sameDayTrips = allTrips.filter(
    (t) =>
      t.id !== excludeTripId &&
      t.vehicleId !== vehicleId &&
      t.status !== 'CANCELLED' &&
      t.scheduledStartTime &&
      t.scheduledStartTime.slice(0, 10) === targetDate &&
      (!routeId || t.routeId === routeId)
  );

  for (const t of sameDayTrips) {
    const otherStart = new Date(t.scheduledStartTime).getTime();
    const diffMs = Math.abs(newStart - otherStart);
    const diffMinutes = Math.round(diffMs / 60000);

    if (diffMinutes < interVehicleMinutes) {
      return {
        hasWarning: true,
        otherTrip: t,
        gapMinutes: diffMinutes,
        recommendedIntervalMinutes: interVehicleMinutes,
        message: `Khởi hành cách xe ${t.vehiclePlate} (${t.tripCode}) chỉ ${diffMinutes} phút (Khuyến nghị giãn cách tối thiểu ${interVehicleMinutes} phút để tránh ùn tắc trạm tiếp nhận)`,
      };
    }
  }

  return { hasWarning: false, recommendedIntervalMinutes: interVehicleMinutes };
}

/**
 * Phân tích khoảng thời gian đệm/nghỉ (Turnaround Gap) giữa các chuyến xe trong ngày của 1 xe
 */
export interface VehicleTripGapInfo {
  trip1: TransportTrip;
  trip2: TransportTrip;
  gapMinutes: number;
  requiredBufferMinutes: number;
  isAdequate: boolean; // Đạt đệm tối thiểu hay vi phạm
}

export function analyzeVehicleTurnaroundGaps(
  vehicleId: number,
  dateStr: string,
  allTrips: TransportTrip[]
): VehicleTripGapInfo[] {
  const dayTrips = getVehicleDailyTrips(vehicleId, dateStr, allTrips);
  if (dayTrips.length < 2) return [];

  const { turnaroundMinutes } = getVehicleBufferMinutes(vehicleId);
  const gaps: VehicleTripGapInfo[] = [];

  for (let i = 0; i < dayTrips.length - 1; i++) {
    const t1 = dayTrips[i];
    const t2 = dayTrips[i + 1];

    const end1 = new Date(t1.scheduledEndTime).getTime();
    const start2 = new Date(t2.scheduledStartTime).getTime();
    const gapMs = start2 - end1;
    const gapMinutes = Math.round(gapMs / (60 * 1000));

    gaps.push({
      trip1: t1,
      trip2: t2,
      gapMinutes,
      requiredBufferMinutes: turnaroundMinutes,
      isAdequate: gapMinutes >= turnaroundMinutes,
    });
  }

  return gaps;
}
