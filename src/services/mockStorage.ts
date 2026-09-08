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
  DATA_VERSION: 'qldv_data_version',
} as const;

const CURRENT_DATA_VERSION = 'v3.2_reports_charts_data';

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
  } catch (err) {}
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
  } catch (e) {}

  // 2. Nếu trống, đọc từ SessionStorage
  if (!valStr) {
    try {
      if (typeof sessionStorage !== 'undefined') {
        valStr = sessionStorage.getItem(key);
      }
    } catch (e) {}
  }

  // 3. Nếu vẫn trống và là key ngắn, thử đọc từ Cookie
  if (!valStr) {
    const cookieVal = getCookie(key);
    if (cookieVal) {
      valStr = cookieVal;
    }
  }

  if (!valStr) return defaultValue;

  try {
    const parsed = JSON.parse(valStr);

    // Self-healing: nếu defaultValue là mảng có dữ liệu mẫu nhưng parsed lại rỗng hoặc null, tự khôi phục dữ liệu mẫu
    if (Array.isArray(defaultValue) && defaultValue.length > 0 && Array.isArray(parsed) && parsed.length === 0) {
      saveToStorage(key, defaultValue);
      return defaultValue;
    }

    // Đồng bộ ngược lại cho LocalStorage và SessionStorage nếu thiếu (Self-healing)
    try {
      if (typeof localStorage !== 'undefined' && !localStorage.getItem(key)) {
        localStorage.setItem(key, valStr);
      }
      if (typeof sessionStorage !== 'undefined' && !sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, valStr);
      }
    } catch (e) {}

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
  } catch (e) {}
  try {
    if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(key);
  } catch (e) {}
  deleteCookie(key);
}

// ==========================================
// 3. DATA INTEGRITY & MIGRATION
// ==========================================
function checkAndMigrateStorage() {
  try {
    const savedVer =
      (typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.DATA_VERSION) : null) ||
      (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(STORAGE_KEYS.DATA_VERSION) : null) ||
      getCookie(STORAGE_KEYS.DATA_VERSION);

    if (savedVer !== CURRENT_DATA_VERSION) {
      // Dọn dẹp cookie nặng
      cleanupBloatedCookies();

      // Nạp bộ dữ liệu chuẩn hóa đồng bộ 100% vào LocalStorage và SessionStorage
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

      // Cập nhật phiên bản
      if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEYS.DATA_VERSION, CURRENT_DATA_VERSION);
      if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(STORAGE_KEYS.DATA_VERSION, CURRENT_DATA_VERSION);
      setCookie(STORAGE_KEYS.DATA_VERSION, CURRENT_DATA_VERSION, 365);
    }
  } catch (e) {
    console.warn('Lỗi kiểm tra migration storage:', e);
  }
}

// Kích hoạt migration
checkAndMigrateStorage();

// ==========================================
// 4. MOCK STORAGE EXPORT SERVICE
// ==========================================
export const mockStorage = {
  getCookie,
  setCookie,
  deleteCookie,
  cleanupBloatedCookies,

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
    const res = getFromStorage(STORAGE_KEYS.VEHICLES, initialVehicles);
    if (!Array.isArray(res) || res.length === 0) {
      saveToStorage(STORAGE_KEYS.VEHICLES, initialVehicles);
      return [...initialVehicles];
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
    const res = getFromStorage(STORAGE_KEYS.DRIVERS, initialDrivers);
    if (!Array.isArray(res) || res.length === 0) {
      saveToStorage(STORAGE_KEYS.DRIVERS, initialDrivers);
      return [...initialDrivers];
    }
    return res;
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
    return res;
  },
  saveRequests(data: TransportRequest[]) {
    saveToStorage(STORAGE_KEYS.REQUESTS, data);
  },

  getTrips(): TransportTrip[] {
    const res = getFromStorage(STORAGE_KEYS.TRIPS, initialTrips);
    if (!Array.isArray(res) || res.length === 0) {
      saveToStorage(STORAGE_KEYS.TRIPS, initialTrips);
      return [...initialTrips];
    }
    // Đảm bảo chuyến 1002 có trạng thái ASSIGNED ban đầu để trải nghiệm trọn vẹn luồng nhận chuyến
    const t1002 = res.find((t) => t.id === 1002);
    if (t1002 && !t1002.acceptedAt && t1002.status === 'INPROGRESS') {
      t1002.status = 'ASSIGNED';
      saveToStorage(STORAGE_KEYS.TRIPS, res);
    }
    const t1001 = res.find((t) => t.id === 1001);
    if (t1001 && t1001.expenses && (!t1001.expenses[0] || !t1001.expenses[0].receiptImage)) {
      const init1001 = initialTrips.find((t) => t.id === 1001);
      if (init1001) t1001.expenses = JSON.parse(JSON.stringify(init1001.expenses));
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
    const hubs = getFromStorage<T[]>(STORAGE_KEYS.HUBS, fallback);
    if (!Array.isArray(hubs) || hubs.length === 0) {
      saveToStorage(STORAGE_KEYS.HUBS, fallback);
      return [...fallback];
    }
    return hubs;
  },
  saveHubs<T>(data: T[]) {
    saveToStorage(STORAGE_KEYS.HUBS, data);
  },

  getStorageHealth() {
    let localOk = false;
    let sessionOk = false;
    let cookieOk = false;

    try {
      localStorage.setItem('__test__', '1');
      localOk = localStorage.getItem('__test__') === '1';
      localStorage.removeItem('__test__');
    } catch (e) {}

    try {
      sessionStorage.setItem('__test__', '1');
      sessionOk = sessionStorage.getItem('__test__') === '1';
      sessionStorage.removeItem('__test__');
    } catch (e) {}

    try {
      setCookie('__test__', '1', 1);
      cookieOk = getCookie('__test__') === '1';
      deleteCookie('__test__');
    } catch (e) {}

    return {
      localStorage: localOk,
      sessionStorage: sessionOk,
      cookie: cookieOk,
      version: CURRENT_DATA_VERSION,
    };
  },
};
