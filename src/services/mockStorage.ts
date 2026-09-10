import {
  initialUsers,
  initialDepartments,
  initialVehicles,
  initialVehicleCategories,
  initialDrivers,
  initialStandardRoutes,
  initialRequests,
  initialTrips,
  initialIncidents,
  initialMaintenanceRecords,
  initialMaintenanceTypes,
  initialEcotechHubs,
  initialVehicleAssignments,
  initialHandovers,
} from '@/mocks';
import type {
  User,
  Department,
  Vehicle,
  VehicleCategory,
  Driver,
  StandardRoute,
  TransportRequest,
  TransportTrip,
  IncidentReport,
  MaintenanceRecord,
  MaintenanceType,
  VehicleAssignmentHistory,
  VehicleTripSetting,
  TripSettingsConfig,
} from '@/types';
import type { HubLocation } from '@/types/map';

export const STORAGE_KEYS = {
  USERS: 'qldv_users',
  DEPARTMENTS: 'qldv_departments',
  VEHICLES: 'qldv_vehicles',
  VEHICLE_CATEGORIES: 'qldv_vehicle_categories',
  DRIVERS: 'qldv_drivers',
  ROUTES: 'qldv_routes',
  REQUESTS: 'qldv_requests',
  TRIPS: 'qldv_trips',
  INCIDENTS: 'qldv_incidents',
  MAINTENANCES: 'qldv_maintenances',
  MAINTENANCE_TYPES: 'qldv_maintenance_types',
  CURRENT_USER_ID: 'qldv_current_user_id',
  ACTIVE_ROLE: 'qldv_active_role',
  HUBS: 'qldv_hubs',
  HANDOVERS: 'qldv_handovers',
  DRIVER_INCIDENTS: 'qldv_driver_incidents',
  ECOTECH_ROUTES: 'qldv_ecotech_routes',
  DRIVER_ASSIGNMENTS: 'qldv_driver_assignments',
  VEHICLE_MAP_STATES: 'qldv_vehicle_map_states',
  DRIVER_NOTIFICATIONS: 'qldv_driver_notifications',
  TRIP_SETTINGS: 'qldv_trip_settings',
  DATA_VERSION: 'qldv_data_version',
} as const;

const CURRENT_DATA_VERSION = 'v3.9_module_separation';

// ==========================================
// 1. COOKIE STORAGE HELPERS (Chỉ lưu session/role ngắn, < 100 bytes)
// ==========================================
export function setCookie(name: string, value: string, days = 365): void {
  try {
    if (typeof document === 'undefined') return;
    const date = new Date();
    date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
    const expires = `; expires=${date.toUTCString()}`;
    document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}${expires}; path=/; SameSite=Lax`;
  } catch (err) {
    console.warn(`Lỗi lưu cookie ${name}:`, err);
  }
}

export function getCookie(name: string): string | null {
  try {
    if (typeof document === 'undefined') return null;
    const nameEQ = `${encodeURIComponent(name)}=`;
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
      let c = ca[i];
      while (c.charAt(0) === ' ') c = c.substring(1, c.length);
      if (c.indexOf(nameEQ) === 0) {
        return decodeURIComponent(c.substring(nameEQ.length, c.length));
      }
    }
    return null;
  } catch (err) {
    return null;
  }
}

export function deleteCookie(name: string): void {
  try {
    if (typeof document === 'undefined') return;
    document.cookie = `${encodeURIComponent(name)}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`;
  } catch (err) { }
}

/**
 * Tự động dọn sạch các cookie mảng lớn để bảo vệ Header HTTP không bao giờ bị lỗi 431 (Request Header Fields Too Large)
 */
export function cleanupBloatedCookies(): void {
  const heavyCookieKeys = [
    STORAGE_KEYS.USERS,
    STORAGE_KEYS.DEPARTMENTS,
    STORAGE_KEYS.VEHICLES,
    STORAGE_KEYS.VEHICLE_CATEGORIES,
    STORAGE_KEYS.DRIVERS,
    STORAGE_KEYS.ROUTES,
    STORAGE_KEYS.REQUESTS,
    STORAGE_KEYS.TRIPS,
    STORAGE_KEYS.INCIDENTS,
    STORAGE_KEYS.MAINTENANCES,
    STORAGE_KEYS.MAINTENANCE_TYPES,
    STORAGE_KEYS.HUBS,
    STORAGE_KEYS.HANDOVERS,
    STORAGE_KEYS.DRIVER_INCIDENTS,
    STORAGE_KEYS.ECOTECH_ROUTES,
    STORAGE_KEYS.DRIVER_ASSIGNMENTS,
  ];
  heavyCookieKeys.forEach((key) => deleteCookie(key));
}

// Chạy dọn dẹp cookie lớn ngay lập tức
cleanupBloatedCookies();

// ==========================================
// 2. MULTI-TIER STORAGE ENGINE
// - LocalStorage: Lưu trữ bền vững dài hạn (toàn bộ payload lớn)
// - SessionStorage: Lưu trữ theo phiên làm việc song song (tự động đồng bộ)
// - Cookie: Chỉ lưu Session ID, User ID, Role (< 100 bytes) để bảo vệ HTTP Header
// ==========================================

function getFromStorage<T>(key: string, defaultValue: T): T {
  let valStr: string | null = null;

  // 1. Đọc từ LocalStorage (Bền vững, dung lượng lớn tới 5MB, không bị gửi lên HTTP Header)
  try {
    if (typeof localStorage !== 'undefined') {
      valStr = localStorage.getItem(key);
    }
  } catch (e) { }

  // 2. Nếu trống, đọc từ SessionStorage
  if (!valStr) {
    try {
      if (typeof sessionStorage !== 'undefined') {
        valStr = sessionStorage.getItem(key);
      }
    } catch (e) { }
  }

  // 3. Nếu vẫn trống và là key ngắn, thử đọc từ Cookie
  if (!valStr) {
    const cookieVal = getCookie(key);
    if (cookieVal) {
      valStr = cookieVal;
    }
  }

  // Chưa từng có dữ liệu trong bất kỳ tầng storage nào -> nạp giá trị mặc định ban đầu
  if (valStr === null || valStr === undefined) {
    saveToStorage(key, defaultValue);
    return defaultValue;
  }

  try {
    const parsed = JSON.parse(valStr);

    // Đồng bộ ngược lại cho LocalStorage và SessionStorage nếu thiếu (Self-healing)
    try {
      if (typeof localStorage !== 'undefined' && !localStorage.getItem(key)) {
        localStorage.setItem(key, valStr);
      }
      if (typeof sessionStorage !== 'undefined' && !sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, valStr);
      }
    } catch (e) { }

    return parsed;
  } catch {
    return defaultValue;
  }
}

function saveToStorage<T>(key: string, value: T, saveToCookie = false): void {
  let jsonStr = '';
  try {
    jsonStr = JSON.stringify(value);
  } catch (err) {
    console.error(`Lỗi stringify dữ liệu cho key ${key}:`, err);
    return;
  }

  // 1. Lưu vào LocalStorage
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, jsonStr);
    }
  } catch (err) {
    console.warn(`Lỗi lưu localStorage key ${key}:`, err);
  }

  // 2. Lưu vào SessionStorage
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(key, jsonStr);
    }
  } catch (err) {
    console.warn(`Lỗi lưu sessionStorage key ${key}:`, err);
  }

  // 3. Chỉ lưu Cookie đối với các thông tin định danh phiên ngắn (UserId, Role, Version < 100 bytes)
  // Tuyệt đối không lưu mảng dữ liệu lớn vào Cookie để tránh lỗi HTTP 431 Request Header Fields Too Large
  if (saveToCookie && jsonStr.length < 100) {
    try {
      setCookie(key, jsonStr, 365);
    } catch (err) {
      console.warn(`Lỗi lưu cookie key ${key}:`, err);
    }
  }
}

function removeFromAllTiers(key: string): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
  } catch (e) { }
  try {
    if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(key);
  } catch (e) { }
  deleteCookie(key);
}

// ==========================================
// 3. DATA INTEGRITY & MIGRATION
// ==========================================
function initIfMissing<T>(key: string, defaultData: T) {
  const existing =
    (typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null) ||
    (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(key) : null);
  if (!existing) {
    saveToStorage(key, defaultData);
  }
}

function checkAndMigrateStorage() {
  try {
    // Dọn dẹp cookie nặng nếu có
    cleanupBloatedCookies();

    // Bảo tồn dữ liệu người dùng đã thao tác: CHỈ khởi tạo dữ liệu mẫu cho các bảng chưa từng tồn tại
    initIfMissing(STORAGE_KEYS.USERS, initialUsers);
    initIfMissing(STORAGE_KEYS.DEPARTMENTS, initialDepartments);
    initIfMissing(STORAGE_KEYS.DRIVERS, initialDrivers);
    initIfMissing(STORAGE_KEYS.VEHICLE_CATEGORIES, initialVehicleCategories);
    initIfMissing(STORAGE_KEYS.VEHICLES, initialVehicles);
    initIfMissing(STORAGE_KEYS.ROUTES, initialStandardRoutes);
    initIfMissing(STORAGE_KEYS.REQUESTS, initialRequests);
    initIfMissing(STORAGE_KEYS.TRIPS, initialTrips);
    initIfMissing(STORAGE_KEYS.INCIDENTS, initialIncidents);
    initIfMissing(STORAGE_KEYS.MAINTENANCES, initialMaintenanceRecords);
    initIfMissing(STORAGE_KEYS.MAINTENANCE_TYPES, initialMaintenanceTypes);
    initIfMissing(STORAGE_KEYS.HUBS, initialEcotechHubs);
    initIfMissing(STORAGE_KEYS.DRIVER_ASSIGNMENTS, initialVehicleAssignments);
    initIfMissing(STORAGE_KEYS.HANDOVERS, initialHandovers);

    // Cập nhật phiên bản mà không xóa đè dữ liệu của người dùng
    if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEYS.DATA_VERSION, CURRENT_DATA_VERSION);
    if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(STORAGE_KEYS.DATA_VERSION, CURRENT_DATA_VERSION);
    setCookie(STORAGE_KEYS.DATA_VERSION, CURRENT_DATA_VERSION, 365);
  } catch (e) {
    console.warn('Lỗi kiểm tra migration storage:', e);
  }
}

// Kích hoạt migration an toàn
checkAndMigrateStorage();

// ==========================================
// 4. MOCK STORAGE EXPORT SERVICE
// ==========================================
export const mockStorage = {
  getCookie,
  setCookie,
  deleteCookie,
  cleanupBloatedCookies,
  saveToStorage,
  getFromStorage,

  resetAll() {
    Object.values(STORAGE_KEYS).forEach((k) => {
      removeFromAllTiers(k);
    });
    // Khôi phục ngay lập tức bộ dữ liệu mẫu chuẩn hóa 100%
    saveToStorage(STORAGE_KEYS.USERS, initialUsers);
    saveToStorage(STORAGE_KEYS.DEPARTMENTS, initialDepartments);
    saveToStorage(STORAGE_KEYS.DRIVERS, initialDrivers);
    saveToStorage(STORAGE_KEYS.VEHICLE_CATEGORIES, initialVehicleCategories);
    saveToStorage(STORAGE_KEYS.VEHICLES, initialVehicles);
    saveToStorage(STORAGE_KEYS.ROUTES, initialStandardRoutes);
    saveToStorage(STORAGE_KEYS.REQUESTS, initialRequests);
    saveToStorage(STORAGE_KEYS.TRIPS, initialTrips);
    saveToStorage(STORAGE_KEYS.INCIDENTS, initialIncidents);
    saveToStorage(STORAGE_KEYS.MAINTENANCES, initialMaintenanceRecords);
    saveToStorage(STORAGE_KEYS.MAINTENANCE_TYPES, initialMaintenanceTypes);
    saveToStorage(STORAGE_KEYS.HUBS, initialEcotechHubs);
    saveToStorage(STORAGE_KEYS.DRIVER_ASSIGNMENTS, initialVehicleAssignments);
    saveToStorage(STORAGE_KEYS.HANDOVERS, initialHandovers);
    saveToStorage(STORAGE_KEYS.CURRENT_USER_ID, 3, true);
    saveToStorage(STORAGE_KEYS.ACTIVE_ROLE, 'Dispatcher', true);

    if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEYS.DATA_VERSION, CURRENT_DATA_VERSION);
    if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(STORAGE_KEYS.DATA_VERSION, CURRENT_DATA_VERSION);
    setCookie(STORAGE_KEYS.DATA_VERSION, CURRENT_DATA_VERSION, 365);
  },

  getUsers(): User[] {
    const res = getFromStorage(STORAGE_KEYS.USERS, initialUsers);
    if (!Array.isArray(res) || res.length === 0) {
      saveToStorage(STORAGE_KEYS.USERS, initialUsers);
      return [...initialUsers];
    }
    return res;
  },
  saveUsers(data: User[]) {
    saveToStorage(STORAGE_KEYS.USERS, data);
  },

  getDepartments(): Department[] {
    const res = getFromStorage(STORAGE_KEYS.DEPARTMENTS, initialDepartments);
    if (!Array.isArray(res) || res.length === 0) {
      saveToStorage(STORAGE_KEYS.DEPARTMENTS, initialDepartments);
      return [...initialDepartments];
    }
    return res;
  },

  getVehicles(): Vehicle[] {
    let res = getFromStorage<Vehicle[]>(STORAGE_KEYS.VEHICLES, initialVehicles);
    if (!Array.isArray(res) || res.length === 0) {
      saveToStorage(STORAGE_KEYS.VEHICLES, initialVehicles);
      return [...initialVehicles];
    }
    let modified = false;

    // Auto-migrate: nếu dữ liệu hiện tại chưa có xe thuê ngoài nào, tự động nạp thêm các xe thuê ngoài mẫu
    const hasExternal = res.some((v) => v.isExternal);
    if (!hasExternal) {
      const externalMocks = initialVehicles.filter((v) => v.isExternal);
      if (externalMocks.length > 0) {
        res = [...res, ...externalMocks];
        modified = true;
      }
    }

    // Auto-sync & bổ sung dữ liệu bị thiếu: Số chỗ ngồi (passengerCapacity) và tài xế mặc định cho từng xe
    res.forEach((v) => {
      const initV = initialVehicles.find((iv) => iv.id === v.id || iv.licensePlate === v.licensePlate);
      if (initV) {
        // 1. Bổ sung số chỗ ngồi nếu đang bị thiếu
        if (v.passengerCapacity === undefined || v.passengerCapacity === null) {
          v.passengerCapacity = initV.passengerCapacity;
          modified = true;
        }
        // 2. Bổ sung hoặc khôi phục tài xế trực thuộc chuẩn hóa cho xe công ty nếu chưa phân công hoặc bị gán nhầm
        if (!v.isExternal) {
          if (!v.assignedDriverName || (v.id === 4 && v.assignedDriverName === 'Nguyễn Văn Lái')) {
            v.assignedDriverId = initV.assignedDriverId;
            v.assignedDriverName = initV.assignedDriverName;
            v.assignedDriverPhone = initV.assignedDriverPhone;
            modified = true;
          }
        } else {
          // Xe thuê ngoài: cập nhật tên tài xế đối tác nếu chưa có
          if (!v.assignedDriverName && initV.assignedDriverName) {
            v.assignedDriverName = initV.assignedDriverName;
            v.assignedDriverPhone = initV.assignedDriverPhone;
            modified = true;
          }
        }
      }

      // Tự động đồng bộ đơn vị sử dụng (operatingUnitType: Team | Factory)
      if (!v.operatingUnitType) {
        v.operatingUnitType = initV?.operatingUnitType || (v.teamName ? 'Team' : 'Factory');
        modified = true;
      }
      if (v.teamName === 'Toàn nông trường') {
        v.teamName = 'Toàn đội';
        modified = true;
      }

      // Đảm bảo xe thuê ngoài không giữ ID tài xế nội bộ
      if (v.isExternal && v.assignedDriverId) {
        v.assignedDriverId = undefined;
        modified = true;
      }

      // Khắc phục số ODO lần trước bị sai dẫn đến âm số km đã chạy ở xe 1
      if (v.id === 1 && v.lastMaintenanceOdo > v.currentOdoKm) {
        v.lastMaintenanceOdo = 25000;
        modified = true;
      }

      // Tự động đồng bộ trạng thái bảo dưỡng nếu xe đang UnderMaintenance
      if (v.status === 'UnderMaintenance' && v.maintenanceStatus === 'Normal') {
        v.maintenanceStatus = 'UnderMaintenance';
        modified = true;
      }
    });

    if (modified) {
      saveToStorage(STORAGE_KEYS.VEHICLES, res);
    }
    return res;
  },
  saveVehicles(data: Vehicle[]) {
    saveToStorage(STORAGE_KEYS.VEHICLES, data);
  },

  getVehicleCategories(): VehicleCategory[] {
    const res = getFromStorage(STORAGE_KEYS.VEHICLE_CATEGORIES, initialVehicleCategories);
    if (!Array.isArray(res) || res.length === 0) {
      saveToStorage(STORAGE_KEYS.VEHICLE_CATEGORIES, initialVehicleCategories);
      return [...initialVehicleCategories];
    }
    return res;
  },
  saveVehicleCategories(data: VehicleCategory[]) {
    saveToStorage(STORAGE_KEYS.VEHICLE_CATEGORIES, data);
  },

  getDrivers(): Driver[] {
    const res = getFromStorage<Driver[]>(STORAGE_KEYS.DRIVERS, initialDrivers);
    if (!Array.isArray(res) || res.length === 0) {
      saveToStorage(STORAGE_KEYS.DRIVERS, initialDrivers);
      return [...initialDrivers];
    }

    // Auto-migrate: Loại bỏ tài xế thuê ngoài khỏi danh sách tài xế nội bộ của công ty
    let internalDrivers = res.filter((d) => !d.employeeCode || (!d.employeeCode.startsWith('TX-EXT') && d.id <= 104));
    let modified = internalDrivers.length !== res.length;

    internalDrivers.forEach((d) => {
      if (d.id <= 4 && !d.licenseImageUrl) {
        const match = initialDrivers.find(idr => idr.id === d.id);
        if (match && match.licenseImageUrl) {
          d.licenseImageUrl = match.licenseImageUrl;
          modified = true;
        }
      }
    });

    const existingIds = new Set(internalDrivers.map((d) => d.id));
    initialDrivers.forEach((initD) => {
      if (!existingIds.has(initD.id)) {
        internalDrivers.push(initD);
        modified = true;
      }
    });

    if (modified) {
      saveToStorage(STORAGE_KEYS.DRIVERS, internalDrivers);
    }

    return internalDrivers;
  },
  saveDrivers(data: Driver[]) {
    saveToStorage(STORAGE_KEYS.DRIVERS, data);
  },

  getRoutes(): StandardRoute[] {
    const res = getFromStorage(STORAGE_KEYS.ROUTES, initialStandardRoutes);
    if (!Array.isArray(res) || res.length === 0) {
      saveToStorage(STORAGE_KEYS.ROUTES, initialStandardRoutes);
      return [...initialStandardRoutes];
    }
    return res;
  },
  saveRoutes(data: StandardRoute[]) {
    saveToStorage(STORAGE_KEYS.ROUTES, data);
  },

  getRequests(): TransportRequest[] {
    const res = getFromStorage(STORAGE_KEYS.REQUESTS, initialRequests);
    if (!Array.isArray(res) || res.length === 0) {
      saveToStorage(STORAGE_KEYS.REQUESTS, initialRequests);
      return [...initialRequests];
    }
    let modified = false;
    res.forEach((r: any) => {
      if (!r.teamName) {
        if (r.fromLocation && r.fromLocation.includes('Đội 1')) r.teamName = 'Đội 1';
        else if (r.fromLocation && r.fromLocation.includes('Đội 2')) r.teamName = 'Đội 2';
        else if (r.fromLocation && r.fromLocation.includes('Đội 3')) r.teamName = 'Đội 3';
        else if (r.toLocation && r.toLocation.includes('Đội 1')) r.teamName = 'Đội 1';
        else if (r.toLocation && r.toLocation.includes('Đội 2')) r.teamName = 'Đội 2';
        else if (r.toLocation && r.toLocation.includes('Đội 3')) r.teamName = 'Đội 3';
        else if (r.departmentName && r.departmentName.includes('Nhà máy')) r.teamName = 'Nhà máy';
        else if (r.fromLocation && r.fromLocation.includes('Nhà Máy')) r.teamName = 'Nhà máy';
        else r.teamName = 'Đội 1';
        modified = true;
      }
    });
    if (modified) {
      saveToStorage(STORAGE_KEYS.REQUESTS, res);
    }
    return res;
  },
  saveRequests(data: TransportRequest[]) {
    saveToStorage(STORAGE_KEYS.REQUESTS, data);
  },

  getTrips(): TransportTrip[] {
    const res = getFromStorage<TransportTrip[]>(STORAGE_KEYS.TRIPS, initialTrips);
    if (!Array.isArray(res) || res.length === 0) {
      saveToStorage(STORAGE_KEYS.TRIPS, initialTrips);
      return [...initialTrips];
    }
    // Auto-migration: nạp receiptImages cho các khoản chi nếu dữ liệu cũ chưa có
    let modified = false;

    // Đảm bảo chuyến mẫu nhiều lần trong ngày (trip 1004) có mặt trong bộ nhớ
    const hasTrip1004 = res.some((t) => t.id === 1004);
    if (!hasTrip1004) {
      const trip1004 = initialTrips.find((t) => t.id === 1004);
      if (trip1004) {
        res.push({ ...trip1004 });
        modified = true;
      }
    }

    res.forEach((t) => {
      if (t.expenses && t.expenses.length > 0) {
        t.expenses.forEach((e) => {
          if (!e.receiptImages || e.receiptImages.length === 0) {
            const matchTrip = initialTrips.find((it) => it.id === t.id);
            const matchExp = matchTrip?.expenses?.find((ie) => ie.id === e.id);
            if (matchExp?.receiptImages && matchExp.receiptImages.length > 0) {
              e.receiptImages = [...matchExp.receiptImages];
              modified = true;
            } else if (e.receiptImage) {
              e.receiptImages = [e.receiptImage];
              modified = true;
            }
          }
        });
      }
    });
    if (modified) {
      saveToStorage(STORAGE_KEYS.TRIPS, res);
    }
    return res;
  },
  saveTrips(data: TransportTrip[]) {
    saveToStorage(STORAGE_KEYS.TRIPS, data);
  },

  getIncidents(): IncidentReport[] {
    const res = getFromStorage(STORAGE_KEYS.INCIDENTS, initialIncidents);
    if (!Array.isArray(res) || res.length === 0) {
      saveToStorage(STORAGE_KEYS.INCIDENTS, initialIncidents);
      return [...initialIncidents];
    }
    let modified = false;
    res.forEach((inc) => {
      if (!inc.location) {
        const match = initialIncidents.find((ii) => ii.id === inc.id);
        if (match) {
          inc.location = match.location;
          inc.latitude = match.latitude;
          inc.longitude = match.longitude;
          inc.gpsAccuracy = match.gpsAccuracy;
          modified = true;
        }
      }
    });
    if (modified) {
      saveToStorage(STORAGE_KEYS.INCIDENTS, res);
    }
    return res;
  },
  saveIncidents(data: IncidentReport[]) {
    saveToStorage(STORAGE_KEYS.INCIDENTS, data);
  },

  getMaintenanceRecords(): MaintenanceRecord[] {
    const res = getFromStorage(STORAGE_KEYS.MAINTENANCES, initialMaintenanceRecords);
    if (!Array.isArray(res) || res.length === 0) {
      saveToStorage(STORAGE_KEYS.MAINTENANCES, initialMaintenanceRecords);
      return [...initialMaintenanceRecords];
    }
    return res;
  },
  saveMaintenanceRecords(data: MaintenanceRecord[]) {
    saveToStorage(STORAGE_KEYS.MAINTENANCES, data);
  },

  getMaintenanceTypes(): MaintenanceType[] {
    const res = getFromStorage(STORAGE_KEYS.MAINTENANCE_TYPES, initialMaintenanceTypes);
    if (!Array.isArray(res) || res.length === 0) {
      saveToStorage(STORAGE_KEYS.MAINTENANCE_TYPES, initialMaintenanceTypes);
      return [...initialMaintenanceTypes];
    }
    // Auto-migrate: đảm bảo mỗi loại bảo dưỡng có assignedVehicleIds
    let modified = false;
    res.forEach((m) => {
      if (!Array.isArray(m.assignedVehicleIds)) {
        const match = initialMaintenanceTypes.find((im) => im.id === m.id);
        m.assignedVehicleIds = match?.assignedVehicleIds ? [...match.assignedVehicleIds] : [];
        modified = true;
      }
    });
    if (modified) {
      saveToStorage(STORAGE_KEYS.MAINTENANCE_TYPES, res);
    }
    return res;
  },
  saveMaintenanceTypes(data: MaintenanceType[]) {
    saveToStorage(STORAGE_KEYS.MAINTENANCE_TYPES, data);
  },

  // CURRENT USER ID (Lưu cả Cookie vì chỉ là 1 con số nhỏ)
  getCurrentUserId(): number {
    return getFromStorage(STORAGE_KEYS.CURRENT_USER_ID, 3);
  },
  saveCurrentUserId(id: number) {
    saveToStorage(STORAGE_KEYS.CURRENT_USER_ID, id, true);
  },

  // ACTIVE ROLE (Lưu cả Cookie vì chỉ là 1 chuỗi ngắn)
  getActiveRole<T extends string>(defaultRole: T): T {
    return getFromStorage(STORAGE_KEYS.ACTIVE_ROLE, defaultRole);
  },
  saveActiveRole(role: string) {
    saveToStorage(STORAGE_KEYS.ACTIVE_ROLE, role, true);
  },

  // HUBS
  getHubs<T = HubLocation>(defaultHubs?: T[]): T[] {
    const fallback = (defaultHubs && defaultHubs.length > 0 ? defaultHubs : (initialEcotechHubs as unknown as T[]));
    let hubs = getFromStorage<T[]>(STORAGE_KEYS.HUBS, fallback);
    if (!Array.isArray(hubs) || hubs.length === 0) {
      saveToStorage(STORAGE_KEYS.HUBS, fallback);
      return [...fallback];
    }
    // Tự động chuẩn hóa tên và tọa độ trạm chính xác theo mạng lưới giao thông đường bộ Google Maps
    let modified = false;
    const roadCoords: Record<string, { lat: number; lng: number }> = {
      TC1: { lat: 11.51138, lng: 106.60247 },
      D1: { lat: 11.56658, lng: 106.63256 },
      D2: { lat: 11.58909, lng: 106.56799 },
      D3: { lat: 11.62039, lng: 106.67075 },
      NM: { lat: 11.48501, lng: 106.62013 },
      VP: { lat: 11.47200, lng: 106.61504 },
    };

    hubs = hubs.map((h: any) => {
      const code = h.code || h.id;
      if (code && roadCoords[code]) {
        const rc = roadCoords[code];
        if (Math.abs(h.lat - rc.lat) > 0.00005 || Math.abs(h.lng - rc.lng) > 0.00005) {
          h.lat = rc.lat;
          h.lng = rc.lng;
          modified = true;
        }
      }
      if (h && typeof h.name === 'string' && (h.name.includes('Nông Trường Đội') || h.name.includes('Nông trường Đội'))) {
        h.name = h.name.replace(/Nông\s*Trường\s*Đội/gi, 'Đội');
        modified = true;
      }
      if (h && typeof h.shortName === 'string' && (h.shortName.includes('NT Đội') || h.shortName.includes('Nông Trường Đội'))) {
        h.shortName = h.shortName.replace(/NT\s*Đội/gi, 'Đội').replace(/Nông\s*Trường\s*Đội/gi, 'Đội');
        modified = true;
      }
      return h;
    });
    if (modified) {
      saveToStorage(STORAGE_KEYS.HUBS, hubs);
    }
    return hubs;
  },
  saveHubs<T>(data: T[]) {
    saveToStorage(STORAGE_KEYS.HUBS, data);
  },

  // BÀN GIAO MƯỢN TRẢ XE (HANDOVERS)
  getHandovers<T = any>(defaultHandovers: T[] = []): T[] {
    const fallback = (defaultHandovers && defaultHandovers.length > 0) ? defaultHandovers : (initialHandovers as any[]);
    const res = getFromStorage<T[]>(STORAGE_KEYS.HANDOVERS, fallback as T[]);
    if (!Array.isArray(res) || res.length === 0) {
      saveToStorage(STORAGE_KEYS.HANDOVERS, fallback);
      return [...fallback] as T[];
    }
    // Tự động chuẩn hóa dữ liệu cũ (backward compatibility & self-healing)
    let modified = false;
    const normalized = res.map((h: any) => {
      let status = h.status;
      if (status === 'Đang mượn') { status = 'BORROWING'; modified = true; }
      else if (status === 'Đã trả') { status = 'RETURNED'; modified = true; }
      else if (status === 'Quá hạn') { status = 'OVERDUE'; modified = true; }
      else if (status === 'Đã hủy') { status = 'CANCELLED'; modified = true; }
      else if (!status) { status = 'BORROWING'; modified = true; }

      const borrowStartAt = h.borrowStartAt || h.borrowTime || '2026-09-07 07:30';
      const expectedReturnAt = h.expectedReturnAt || h.returnTime || '2026-09-07 11:30';
      const actualReturnAt = h.actualReturnAt || (status === 'RETURNED' ? (h.returnTime || expectedReturnAt) : undefined);
      const fromTeam = h.fromTeam || (h.id === 1 ? 'Đội 1' : 'Đội công ty');
      const toTeam = h.toTeam || (h.id === 1 ? 'Đội 2' : 'Đội kỹ thuật');

      if (!h.fromTeam || !h.toTeam || !h.borrowStartAt) modified = true;

      return {
        ...h,
        status,
        fromTeam,
        toTeam,
        borrowStartAt,
        expectedReturnAt,
        actualReturnAt,
        driverName: h.driverName || h.driver || 'Phạm Văn Tài',
        handoverOdo: Number(h.handoverOdo) || 0,
        fuelLevel: h.fuelLevel || '85%',
        conditionNotes: h.conditionNotes || h.notes || '',
      };
    });

    if (modified) {
      saveToStorage(STORAGE_KEYS.HANDOVERS, normalized);
    }
    return normalized as T[];
  },
  saveHandovers<T = any>(data: T[]) {
    saveToStorage(STORAGE_KEYS.HANDOVERS, data);
  },

  // SỰ CỐ TÀI XẾ BÁO CÁO (DRIVER INCIDENTS)
  getDriverIncidents<T = any>(defaultIncidents: T[] = []): T[] {
    const res = getFromStorage<T[]>(STORAGE_KEYS.DRIVER_INCIDENTS, defaultIncidents);
    if (!Array.isArray(res) || res.length === 0) {
      saveToStorage(STORAGE_KEYS.DRIVER_INCIDENTS, defaultIncidents);
      return [...defaultIncidents];
    }
    let modified = false;
    res.forEach((inc: any) => {
      if (inc && !inc.latitude) {
        const match = (defaultIncidents as any[]).find((di: any) => di.id === inc.id);
        if (match) {
          inc.latitude = match.latitude;
          inc.longitude = match.longitude;
          inc.gpsAccuracy = match.gpsAccuracy;
          modified = true;
        }
      }
    });
    if (modified) {
      saveToStorage(STORAGE_KEYS.DRIVER_INCIDENTS, res);
    }
    return res;
  },
  saveDriverIncidents<T = any>(data: T[]) {
    saveToStorage(STORAGE_KEYS.DRIVER_INCIDENTS, data);
  },

  // VỊ TRÍ XE TRÊN BẢN ĐỒ ĐIỀU VẬN (VEHICLE MAP STATES)
  getVehicleMapStates<T = any>(defaultStates: T[] = []): T[] {
    const res = getFromStorage<T[]>(STORAGE_KEYS.VEHICLE_MAP_STATES, defaultStates);
    if (!Array.isArray(res) || res.length === 0) {
      if (defaultStates.length > 0) {
        saveToStorage(STORAGE_KEYS.VEHICLE_MAP_STATES, defaultStates);
      }
      return [...defaultStates];
    }
    // Cập nhật tọa độ trên đường bộ thực tế cho các xe mẫu nếu đang mang tọa độ lệch cũ
    if (Array.isArray(res)) {
      let modified = false;
      const roadCoords: Record<string, { lat: number; lng: number }> = {
        TC1: { lat: 11.51138, lng: 106.60247 },
        D1: { lat: 11.56658, lng: 106.63256 },
        D2: { lat: 11.58909, lng: 106.56799 },
        D3: { lat: 11.62039, lng: 106.67075 },
        NM: { lat: 11.48501, lng: 106.62013 },
        VP: { lat: 11.47200, lng: 106.61504 },
      };

      res.forEach((v: any) => {
        // Đồng bộ tọa độ fromHub và toHub
        if (v.fromHub && roadCoords[v.fromHub.code || v.fromHub.id]) {
          const rc = roadCoords[v.fromHub.code || v.fromHub.id];
          if (v.fromHub.lat !== rc.lat || v.fromHub.lng !== rc.lng) {
            v.fromHub.lat = rc.lat;
            v.fromHub.lng = rc.lng;
            modified = true;
          }
        }
        if (v.toHub && roadCoords[v.toHub.code || v.toHub.id]) {
          const rc = roadCoords[v.toHub.code || v.toHub.id];
          if (v.toHub.lat !== rc.lat || v.toHub.lng !== rc.lng) {
            v.toHub.lat = rc.lat;
            v.toHub.lng = rc.lng;
            modified = true;
          }
        }
        // Xe 1 (51C-889.26): Đang chạy tuyến TC1 -> D1
        if (v.id === 1 && (v.currentLat === 11.545 || v.currentLat === 11.5450)) {
          v.currentLat = 11.54883;
          v.currentLng = 106.61637;
          modified = true;
        }
        // Xe 2 (51C-772.18): Sẵn sàng tại TC1
        if (v.id === 2 && (v.currentLat !== 11.51138 || v.currentLng !== 106.60247)) {
          v.currentLat = 11.51138;
          v.currentLng = 106.60247;
          modified = true;
        }
        // Xe 3 (51A-992.34): Đang chạy tuyến VP -> NM trên QL13
        if (v.id === 3 && (v.currentLat === 11.4785 || v.currentLng === 106.6178 || v.currentLat !== 11.47720)) {
          v.currentLat = 11.47720;
          v.currentLng = 106.61490;
          modified = true;
        }
        // Xe 4 (MX-01): Bảo dưỡng tại D2
        if (v.id === 4 && (v.currentLat !== 11.58909 || v.currentLng !== 106.56799)) {
          v.currentLat = 11.58909;
          v.currentLng = 106.56799;
          modified = true;
        }
      });
      if (modified) {
        saveToStorage(STORAGE_KEYS.VEHICLE_MAP_STATES, res);
      }
    }
    return res;
  },
  saveVehicleMapStates<T = any>(data: T[]) {
    saveToStorage(STORAGE_KEYS.VEHICLE_MAP_STATES, data);
  },

  // TUYẾN ĐƯỜNG BẢN ĐỒ ECOTECH (ROUTE PATHS GIS)
  getEcotechRoutes<T = any>(defaultRoutes: T[] = []): T[] {
    const res = getFromStorage<T[]>(STORAGE_KEYS.ECOTECH_ROUTES, defaultRoutes);
    // Tự động nâng cấp nếu dữ liệu lưu trước đó chỉ là đường chim bay hoặc chưa ghim sát mặt đường
    const isOldCrowFlies = Array.isArray(res) && res.some((r: any) => !r.waypoints || r.waypoints.length <= 8);
    const isMisaligned = Array.isArray(res) && res.some((r: any) => {
      if (r.code === 'TC1-D1-TC1' && r.waypoints && r.waypoints[0]) {
        return Math.abs(r.waypoints[0][0] - 11.51138) > 0.0001;
      }
      return false;
    });
    if (!Array.isArray(res) || res.length === 0 || isOldCrowFlies || isMisaligned) {
      if (defaultRoutes.length > 0) {
        saveToStorage(STORAGE_KEYS.ECOTECH_ROUTES, defaultRoutes);
      }
      return [...defaultRoutes];
    }
    return res;
  },
  saveEcotechRoutes<T = any>(data: T[]) {
    saveToStorage(STORAGE_KEYS.ECOTECH_ROUTES, data);
  },

  // LỊCH SỬ PHÂN CÔNG TÀI XẾ (DRIVER ASSIGNMENTS)
  getDriverAssignments(defaultAssignments: VehicleAssignmentHistory[] = []): VehicleAssignmentHistory[] {
    const fallback = (defaultAssignments && defaultAssignments.length > 0 ? defaultAssignments : (initialVehicleAssignments as VehicleAssignmentHistory[]));
    const res = getFromStorage<VehicleAssignmentHistory[]>(STORAGE_KEYS.DRIVER_ASSIGNMENTS, fallback);
    if (!Array.isArray(res)) {
      saveToStorage(STORAGE_KEYS.DRIVER_ASSIGNMENTS, fallback);
      return [...fallback];
    }
    return res;
  },
  saveDriverAssignments(data: VehicleAssignmentHistory[]) {
    saveToStorage(STORAGE_KEYS.DRIVER_ASSIGNMENTS, data);
  },

  // THÔNG BÁO TÀI XẾ & ĐIỀU ĐỘNG KHẨN CẤP
  getDriverNotifications<T = any>(): T[] {
    return getFromStorage<T[]>(STORAGE_KEYS.DRIVER_NOTIFICATIONS, []);
  },
  saveDriverNotifications<T = any>(data: T[]) {
    saveToStorage(STORAGE_KEYS.DRIVER_NOTIFICATIONS, data);
  },
  addDriverNotification(notif: any) {
    const list = this.getDriverNotifications();
    list.unshift({
      ...notif,
      id: Date.now() + Math.floor(Math.random() * 1000),
      isRead: false,
    });
    this.saveDriverNotifications(list);
  },
  markDriverNotificationAsRead(id: number) {
    const list = this.getDriverNotifications();
    const item = list.find((n: any) => n.id === id);
    if (item) {
      item.isRead = true;
      this.saveDriverNotifications(list);
    }
  },
  removeDriverNotification(id: number) {
    const list = this.getDriverNotifications();
    const filtered = list.filter((n: any) => n.id !== id);
    this.saveDriverNotifications(filtered);
  },

  // ==========================================
  // CÀI ĐẶT CHUYẾN & GIÃN CÁCH ĐIỀU ĐỘNG XE
  // ==========================================
  getTripSettings(): TripSettingsConfig {
    const raw = localStorage.getItem(STORAGE_KEYS.TRIP_SETTINGS);
    const vehicles = this.getVehicles();

    const createInitial = (): TripSettingsConfig => ({
      defaultTurnaroundMinutes: 30,
      defaultInterVehicleIntervalMinutes: 15,
      allowEmergencyOverride: true,
      vehicleTypeSettings: {
        LatexTruck: {
          turnaroundBufferMinutes: 45,
          interVehicleIntervalMinutes: 20,
          cleaningDurationMinutes: 15,
          description: 'Xe bồn téc chở mủ: Cần thời gian xả cặn mủ, súc rửa bồn và kiểm tra van nắp',
        },
        PassengerCar: {
          turnaroundBufferMinutes: 20,
          interVehicleIntervalMinutes: 10,
          cleaningDurationMinutes: 5,
          description: 'Xe đưa đón công nhân/chuyên gia: Nghỉ ngắn, kiểm tra vệ sinh khoang xe',
        },
        MillingMachine: {
          turnaroundBufferMinutes: 40,
          interVehicleIntervalMinutes: 30,
          cleaningDurationMinutes: 20,
          description: 'Cơ giới nông trường: Kiểm tra dầu nhớt, hệ thống thủy lực trước ca mới',
        },
      },
      specificVehicleSettings: vehicles.map((v) => ({
        vehicleId: v.id,
        licensePlate: v.licensePlate,
        vehicleType: v.vehicleType,
        teamName: v.teamName,
        operatingUnitType: v.operatingUnitType,
        useCustom: v.licensePlate === '51C-889.26', // Mẫu: xe bồn chính có cấu hình đặc thù
        turnaroundBufferMinutes: v.licensePlate === '51C-889.26' ? 45 : (v.vehicleType === 'LatexTruck' ? 45 : (v.vehicleType === 'PassengerCar' ? 20 : 40)),
        interVehicleIntervalMinutes: v.licensePlate === '51C-889.26' ? 20 : (v.vehicleType === 'LatexTruck' ? 20 : (v.vehicleType === 'PassengerCar' ? 10 : 30)),
        cleaningDurationMinutes: v.vehicleType === 'LatexTruck' ? 15 : 5,
        notes: v.licensePlate === '51C-889.26'
          ? 'Xe téc bồn 10T chở mủ ly tâm trọng điểm — Ưu tiên đệm 45p vệ sinh kỹ nắp van'
          : v.operatingUnitType === 'Factory'
          ? 'Xe nhà máy điều động hỗ trợ các đội'
          : `Xe phục vụ ${v.teamName || 'Đội sản xuất'}`,
      })),
      updatedAt: new Date().toISOString(),
    });

    if (!raw) {
      const initial = createInitial();
      this.saveTripSettings(initial);
      return initial;
    }

    try {
      const parsed: TripSettingsConfig = JSON.parse(raw);
      // Đồng bộ nếu có xe mới chưa có trong config
      let hasChanges = false;
      const existingVehicleIds = new Set((parsed.specificVehicleSettings || []).map((s) => s.vehicleId));
      for (const v of vehicles) {
        if (!existingVehicleIds.has(v.id)) {
          parsed.specificVehicleSettings.push({
            vehicleId: v.id,
            licensePlate: v.licensePlate,
            vehicleType: v.vehicleType,
            teamName: v.teamName,
            operatingUnitType: v.operatingUnitType,
            useCustom: false,
            turnaroundBufferMinutes: v.vehicleType === 'LatexTruck' ? 45 : (v.vehicleType === 'PassengerCar' ? 20 : 40),
            interVehicleIntervalMinutes: v.vehicleType === 'LatexTruck' ? 20 : (v.vehicleType === 'PassengerCar' ? 10 : 30),
            cleaningDurationMinutes: v.vehicleType === 'LatexTruck' ? 15 : 5,
            notes: `Xe phục vụ ${v.operatingUnitType === 'Factory' ? 'Nhà máy' : (v.teamName || 'Đội')}`,
          });
          hasChanges = true;
        }
      }
      if (hasChanges) {
        this.saveTripSettings(parsed);
      }
      return parsed;
    } catch {
      const fallback = createInitial();
      this.saveTripSettings(fallback);
      return fallback;
    }
  },

  saveTripSettings(settings: TripSettingsConfig) {
    settings.updatedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEYS.TRIP_SETTINGS, JSON.stringify(settings));
  },

  resetTripSettings(): TripSettingsConfig {
    localStorage.removeItem(STORAGE_KEYS.TRIP_SETTINGS);
    return this.getTripSettings();
  },

  getStorageHealth() {
    let localOk = false;
    let sessionOk = false;
    let cookieOk = false;

    try {
      localStorage.setItem('__test__', '1');
      localOk = localStorage.getItem('__test__') === '1';
      localStorage.removeItem('__test__');
    } catch (e) { }

    try {
      sessionStorage.setItem('__test__', '1');
      sessionOk = sessionStorage.getItem('__test__') === '1';
      sessionStorage.removeItem('__test__');
    } catch (e) { }

    try {
      setCookie('__test__', '1', 1);
      cookieOk = getCookie('__test__') === '1';
      deleteCookie('__test__');
    } catch (e) { }

    return {
      localStorage: localOk,
      sessionStorage: sessionOk,
      cookie: cookieOk,
      version: CURRENT_DATA_VERSION,
    };
  },
};
