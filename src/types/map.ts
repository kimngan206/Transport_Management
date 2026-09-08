// Định nghĩa kiểu dữ liệu cho Bản đồ Điều vận & Lộ trình GPS ECOTECH 2A

export type HubType = 'weigh_station' | 'farm' | 'factory' | 'office';

export interface HubLocation {
  id: string;
  name: string;
  shortName: string;
  code: string;
  type: HubType;
  lat: number;
  lng: number;
  description: string;
  address: string;
}

export interface RoutePath {
  id: number;
  code: string;
  name: string;
  from: HubLocation;
  to: HubLocation;
  distanceKm: number;
  waypoints: [number, number][];
}

export interface VehicleMapState {
  id: number;
  licensePlate: string;
  vehicleType: string;
  model: string;
  driverName: string;
  driverPhone: string;
  tripCode?: string;
  status: 'RUNNING' | 'AVAILABLE' | 'MAINTENANCE';
  fromHub?: HubLocation;
  toHub?: HubLocation;
  currentLat: number;
  currentLng: number;
  routeCode?: string;
  cargoDescription: string;
  estimatedArrival: string;
  bearing?: number;
}
