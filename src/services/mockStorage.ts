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
  DATA_VERSION: 'qldv_data_version',
} as const;

const CURRENT_DATA_VERSION = 'v3.8_storage_persistence';

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
    // Auto-migrate: nếu dữ liệu hiện tại chưa có xe thuê ngoài nào, tự động nạp thêm các xe thuê ngoài mẫu
    const hasExternal = res.some((v) => v.isExternal);
    let modified = false;
    if (!hasExternal) {
      const externalMocks = initialVehicles.filter((v) => v.isExternal);
      if (externalMocks.length > 0) {
        res = [...res, ...externalMocks];
        modified = true;
      }
    }
    // Đảm bảo xe thuê ngoài không giữ ID tài xế nội bộ
    res.forEach((v) => {
      if (v.isExternal && v.assignedDriverId) {
        v.assignedDriverId = undefined;
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
    // Tự động chuẩn hóa nếu dữ liệu lưu cũ còn từ 'Nông Trường Đội' hoặc 'NT Đội'
    let modified = false;
    hubs = hubs.map((h: any) => {
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
    const res = getFromStorage<T[]>(STORAGE_KEYS.HANDOVERS, defaultHandovers);
    if (!Array.isArray(res)) {
      saveToStorage(STORAGE_KEYS.HANDOVERS, defaultHandovers);
      return [...defaultHandovers];
    }
    return res;
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
    return res;
  },
  saveVehicleMapStates<T = any>(data: T[]) {
    saveToStorage(STORAGE_KEYS.VEHICLE_MAP_STATES, data);
  },

  // TUYẾN ĐƯỜNG BẢN ĐỒ ECOTECH (ROUTE PATHS GIS)
  getEcotechRoutes<T = any>(defaultRoutes: T[] = []): T[] {
    const res = getFromStorage<T[]>(STORAGE_KEYS.ECOTECH_ROUTES, defaultRoutes);
    if (!Array.isArray(res) || res.length === 0) {
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
