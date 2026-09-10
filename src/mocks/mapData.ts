// Dữ liệu mô phỏng tọa độ trạm, nông trường, nhà máy và tuyến đường quy chuẩn ECOTECH 2A
import type { HubLocation, RoutePath, VehicleMapState } from '@/types/map';
import { mockStorage } from '@/services/mockStorage';

import { initialEcotechHubs } from '@/mocks';
export { initialEcotechHubs };

// Danh sách điểm trạm nạp từ storage hoặc mặc định
export const ECOTECH_HUBS: HubLocation[] = mockStorage.getHubs(initialEcotechHubs);

// Helper tra cứu và đồng bộ danh sách trạm tươi mới nhất từ storage
export function getFreshHubs(): HubLocation[] {
  const loaded = mockStorage.getHubs<HubLocation>(initialEcotechHubs);
  ECOTECH_HUBS.length = 0;
  if (!loaded || loaded.length === 0) {
    ECOTECH_HUBS.push(...initialEcotechHubs);
    mockStorage.saveHubs(ECOTECH_HUBS);
  } else {
    ECOTECH_HUBS.push(...loaded);
  }
  return ECOTECH_HUBS;
}

// Helper tra cứu trạm theo mã code an toàn
export function findHubByCode(code: string): HubLocation {
  const found = ECOTECH_HUBS.find((h) => h.code === code);
  if (found) return found;
  return initialEcotechHubs.find((h) => h.code === code) || initialEcotechHubs[0];
}

// Thao tác CRUD điểm trạm
export function addEcotechHub(hub: HubLocation) {
  const exists = ECOTECH_HUBS.some((h) => h.id === hub.id || h.code === hub.code);
  if (!exists) {
    ECOTECH_HUBS.push(hub);
    mockStorage.saveHubs(ECOTECH_HUBS);
  }
}

export function updateEcotechHub(hub: HubLocation) {
  const idx = ECOTECH_HUBS.findIndex((h) => h.id === hub.id);
  if (idx !== -1) {
    ECOTECH_HUBS[idx] = { ...hub };
    mockStorage.saveHubs(ECOTECH_HUBS);
  }
}

export function deleteEcotechHub(hubId: string) {
  const idx = ECOTECH_HUBS.findIndex((h) => h.id === hubId);
  if (idx !== -1) {
    ECOTECH_HUBS.splice(idx, 1);
    mockStorage.saveHubs(ECOTECH_HUBS);
  }
}

import { getRoadRouteBetweenHubs } from '@/services/routingService';

// Danh mục các tuyến đường quy chuẩn mặc định theo đường bộ thực tế (Road Network Navigation)
const tc1_d1 = getRoadRouteBetweenHubs('TC1', 'D1');
const tc1_d2 = getRoadRouteBetweenHubs('TC1', 'D2');
const nm_d3 = getRoadRouteBetweenHubs('NM', 'D3');
const vp_nm = getRoadRouteBetweenHubs('VP', 'NM');
const tc1_nm = getRoadRouteBetweenHubs('TC1', 'NM');

const defaultEcotechRoutes: RoutePath[] = [
  {
    id: 1,
    code: 'TC1-D1-TC1',
    name: 'Trạm cân 1 ➔ Đội 1',
    from: findHubByCode('TC1'),
    to: findHubByCode('D1'),
    distanceKm: tc1_d1.distanceKm || 10.7,
    waypoints: tc1_d1.waypoints,
  },
  {
    id: 2,
    code: 'TC1-D2-TC1',
    name: 'Trạm cân 1 ➔ Đội 2',
    from: findHubByCode('TC1'),
    to: findHubByCode('D2'),
    distanceKm: tc1_d2.distanceKm || 15.4,
    waypoints: tc1_d2.waypoints,
  },
  {
    id: 3,
    code: 'NM-D3-NM',
    name: 'Nhà máy chế biến ➔ Đội 3',
    from: findHubByCode('NM'),
    to: findHubByCode('D3'),
    distanceKm: nm_d3.distanceKm || 21.5,
    waypoints: nm_d3.waypoints,
  },
  {
    id: 4,
    code: 'VP-NM-VP',
    name: 'Văn phòng Công ty ➔ Nhà máy chế biến',
    from: findHubByCode('VP'),
    to: findHubByCode('NM'),
    distanceKm: vp_nm.distanceKm || 3.5,
    waypoints: vp_nm.waypoints,
  },
  {
    id: 5,
    code: 'TC1-NM',
    name: 'Trạm cân 1 ➔ Nhà máy chế biến',
    from: findHubByCode('TC1'),
    to: findHubByCode('NM'),
    distanceKm: tc1_nm.distanceKm || 5.7,
    waypoints: tc1_nm.waypoints,
  },
];

export const ECOTECH_ROUTES: RoutePath[] = mockStorage.getEcotechRoutes(defaultEcotechRoutes);

// Tính khoảng cách cự ly giữa 2 điểm GPS (km) áp dụng hệ số đường đất/dốc nông trường cao su (1.25)
export function calculateHaversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Bán kính trái đất (km)
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const roadFactor = 1.25; // Hệ số uốn lượn đường nội bộ nông trường
  return Math.max(1, Number((R * c * roadFactor).toFixed(1)));
}

// Thêm tuyến đường mới vào danh mục bản đồ
export function addEcotechRoute(newRoute: RoutePath) {
  const exists = ECOTECH_ROUTES.some((r) => r.code === newRoute.code);
  if (!exists) {
    ECOTECH_ROUTES.push(newRoute);
    mockStorage.saveEcotechRoutes(ECOTECH_ROUTES);
  }
}

// Danh sách trạng thái xe trên bản đồ
export const initialVehicleMapStates: VehicleMapState[] = [
  {
    id: 1,
    licensePlate: '51C-889.26',
    vehicleType: 'LatexTruck',
    model: 'Hino 5 tấn mui bạt chở mủ',
    driverName: 'Nguyễn Văn Lái',
    driverPhone: '0912.345.678',
    tripCode: 'TRIP-260907-001',
    status: 'RUNNING',
    fromHub: findHubByCode('TC1'),
    toHub: findHubByCode('D1'),
    currentLat: 11.54883,
    currentLng: 106.61637,
    routeCode: 'TC1-D1-TC1',
    cargoDescription: '4.800 kg mủ nước thu hoạch ca sáng',
    estimatedArrival: '14:25',
    bearing: 35,
  },
  {
    id: 2,
    licensePlate: '51C-772.18',
    vehicleType: 'LatexTruck',
    model: 'Isuzu 7.5 tấn bồn inox chở mủ nước',
    driverName: 'Trần Văn Vận',
    driverPhone: '0983.112.233',
    status: 'AVAILABLE',
    fromHub: findHubByCode('TC1'),
    toHub: findHubByCode('TC1'),
    currentLat: 11.51138,
    currentLng: 106.60247,
    cargoDescription: 'Xe trống, đã sẵn sàng nhận lệnh điều động',
    estimatedArrival: '--',
    bearing: 0,
  },
  {
    id: 3,
    licensePlate: '51A-992.34',
    vehicleType: 'PassengerCar',
    model: 'Ford Ranger 4x4 bán tải công tác',
    driverName: 'Lê Văn Tài',
    driverPhone: '0909.555.789',
    tripCode: 'TRIP-260907-002',
    status: 'RUNNING',
    fromHub: findHubByCode('VP'),
    toHub: findHubByCode('NM'),
    currentLat: 11.47720,
    currentLng: 106.61490,
    routeCode: 'VP-NM-VP',
    cargoDescription: '3 cán bộ kỹ thuật kiểm tra ca ép mủ',
    estimatedArrival: '14:10',
    bearing: 15,
  },
  {
    id: 4,
    licensePlate: 'MX-01',
    vehicleType: 'MillingMachine',
    model: 'Komatsu PC200-8 máy đào mương vườn cây',
    driverName: 'Đỗ Văn Máy',
    driverPhone: '0977.888.999',
    status: 'MAINTENANCE',
    fromHub: findHubByCode('D2'),
    toHub: findHubByCode('D2'),
    currentLat: 11.58909,
    currentLng: 106.56799,
    cargoDescription: 'Đang bảo dưỡng định kỳ hệ thống thủy lực tại bãi Đội 2',
    estimatedArrival: '--',
    bearing: 0,
  },
];
