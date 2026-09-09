// Types cho Hệ thống Quản lý Điều vận và Đội xe (QL_Điều Vận)

export type UserRole = 'Requester' | 'Dispatcher' | 'Driver' | 'Admin';

export interface User {
  id: number;
  username: string;
  fullName: string;
  jobTitle?: string;
  email: string;
  phone: string;
  departmentId: number;
  departmentName: string;
  roles: UserRole[];
  driverId?: number; // Nếu user là Driver
  avatarUrl?: string;
}

export interface Department {
  id: number;
  code: string;
  name: string;
  managerId: number;
}

export type VehicleType = 'LatexTruck' | 'PassengerCar' | 'MillingMachine';
export type VehicleOperationalStatus = 'Available' | 'OnTrip' | 'UnderMaintenance' | 'Broken';
export type MaintenanceStatus = 'Normal' | 'Due' | 'Overdue';

export interface VehicleCategory {
  id: number;
  code: string;
  name: string;
  group: 'Vận tải mủ' | 'Cơ giới nông trường' | 'Công tác & Kỹ thuật';
  vehicleTypeCode: VehicleType;
  standardCapacityTons?: number;
  standardSeats?: number;
  fuelQuotaType: 'L_PER_KM' | 'L_PER_TON_KM' | 'L_PER_HOUR' | 'KWH_PER_KM';
  defaultQuotaEmpty: number;
  defaultQuotaLoaded?: number;
  fuelFormulaText?: string;
  description: string;
  isActive: boolean;
}

export interface Vehicle {
  id: number;
  licensePlate: string;
  vehicleType: VehicleType;
  model: string;
  capacityTons: number; // Sức chứa tải trọng (tấn)
  passengerCapacity?: number; // Số người (đối với xe pickup/chở người)
  fuelQuotaEmpty: number; // NLP: Lít/km không tải (ví dụ 0.25 L/km)
  fuelQuotaLoaded: number; // NLC: Lít/tấn.km có tải (ví dụ 0.02 L/tấn.km)
  hourMeterQuota?: number; // Lít/giờ đối với xe xúc
  fuelFormulaText?: string; // Công thức hao phí nhiên liệu / điện theo mong muốn của người quản lý
  currentOdoKm: number;
  currentOperatingHours?: number; // Giờ máy hiện tại (xe xúc)
  status: VehicleOperationalStatus;
  maintenanceStatus: MaintenanceStatus;
  lastMaintenanceOdo: number;
  lastMaintenanceDate: string;
  assignedDriverId?: number;
  assignedDriverName?: string;
  assignedDriverPhone?: string;

  // Các thuộc tính mở rộng
  teamName?: string; // Phân loại theo đội (dành cho LatexTruck)
  isExternal?: boolean; // Xe ngoài không cần quản lý bảo trì (dành cho PassengerCar)
}

export interface Driver {
  id: number;
  accountId: number;
  employeeCode?: string;
  fullName: string;
  phone: string;
  licenseNumber: string;
  licenseClass: string; // Hạng B2, C, D, E, FC...
  licenseExpiryDate: string;
  licenseImageUrl?: string;
  employmentStatus: 'Active' | 'OnLeave' | 'Suspended';
  isCurrentlyOnTrip: boolean;
}

export interface StandardRoute {
  id: number;
  routeCode: string;
  name: string;
  startPoint: string;
  endPoint: string;
  standardDistanceKm: number;
  description: string;
}

export type RequestStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'DISPATCHED'
  | 'INPROGRESS'
  | 'COMPLETED'
  | 'CANCELLED';

export interface TransportRequest {
  id: number;
  requestCode: string;
  requesterId: number;
  requesterName: string;
  requesterPhone: string;
  departmentId: number;
  departmentName: string;
  vehicleType: VehicleType;
  startTime: string; // YYYY-MM-DD HH:mm
  endTime: string; // YYYY-MM-DD HH:mm
  fromLocation: string;
  toLocation: string;
  standardRouteId?: number;
  purpose: string;
  passengersCount?: number;
  estimatedWeightKg?: number; // Khối lượng mủ / hàng dự kiến (kg)

  // Thuộc tính riêng cho xe chở người / xe ngoài
  pickupTime?: string;
  dropoffTime?: string;
  contactPerson?: string;
  contactPhone?: string;
  teamName?: string;
  isExternal?: boolean;
  status: RequestStatus;
  rejectionReason?: string;
  approvedById?: number;
  approvedByName?: string;
  approvedAt?: string;
  assignedTripId?: number;
  createdAt: string;
  timeline: {
    status: RequestStatus;
    timestamp: string;
    note: string;
    actor: string;
  }[];
}

export type TripStatus = 'ASSIGNED' | 'ACCEPTED' | 'INPROGRESS' | 'ARRIVED' | 'COMPLETED' | 'CANCELLED';

export interface TransportTrip {
  id: number;
  tripCode: string;
  vehicleId: number;
  vehiclePlate: string;
  vehicleType: VehicleType;
  driverId: number;
  driverName: string;
  driverPhone: string;
  requestIds: number[]; // US-06: Ghép nhiều request
  routeId: number;
  routeName: string;
  standardDistanceKm: number;
  scheduledStartTime: string;
  scheduledEndTime: string;
  acceptedAt?: string; // Mốc thời gian tài xế bấm nhận chuyến
  actualStartTime?: string; // Mốc thời gian xuất bến
  arrivedAt?: string; // Mốc thời gian tài xế báo đã đến điểm chỉ định
  arrivalNote?: string; // Ghi chú khi đến nơi
  actualEndTime?: string; // Mốc thời gian về bến hoàn thành
  startOdo?: number;
  endOdo?: number;
  actualDistanceKm?: number;

  // Thuộc tính cho xe chở người / xe ngoài
  pickupTime?: string;
  dropoffTime?: string;
  contactPerson?: string;
  contactPhone?: string;
  teamName?: string;
  isExternal?: boolean;

  // Sản lượng mủ (đặc thù xe tải chở mủ cao su)
  weightLatex1Kg?: number; // Mủ nước 1
  weightLatex2Kg?: number; // Mủ nước 2
  weightLatex3Kg?: number; // Mủ nước 3
  weightLatexTapKg?: number; // Mủ tạp
  totalLatexWeightKg?: number;

  // Nhiên liệu theo định mức chuẩn và thực tế
  calculatedFuelLiters?: number;
  actualFuelFilledLiters?: number;
  fuelVarianceLiters?: number;

  // Giờ máy (đặc thù xe xúc)
  startHourMeter?: number;
  endHourMeter?: number;
  totalOperatingHours?: number;

  status: TripStatus;
  notes?: string;
  expenses: TripExpense[];
  createdAt: string;
}

export interface TripExpense {
  id: number;
  tripId: number;
  expenseType: 'Fuel' | 'Toll' | 'Parking' | 'Repair' | 'Other';
  amount: number;
  receiptNote?: string;
  receiptImage?: string;
  receiptImages?: string[]; // Danh sách nhiều ảnh chứng từ / hóa đơn xác minh
  recordedAt: string;
  auditStatus?: 'PENDING' | 'APPROVED' | 'REJECTED';
  auditNote?: string;
}

export interface EquipmentWorkLog {
  id: number;
  vehicleId: number;
  driverId: number;
  workDate: string;
  startHourMeter: number;
  endHourMeter: number;
  totalHours: number;
  taskType: string;
  fuelAllocated: number;
  notes?: string;
}

export interface IncidentReport {
  id: number;
  vehicleId: number;
  vehiclePlate: string;
  reportedByDriverId: number;
  driverName: string;
  reportDate: string;
  issueDescription: string;
  severity: 'Warning' | 'StopOperation';
  status: 'Pending' | 'InRepair' | 'Resolved';
  resolutionNote?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  gpsAccuracy?: number;
}

export interface MaintenanceRecord {
  id: number;
  vehicleId: number;
  vehiclePlate: string;
  incidentReportId?: number;
  maintenanceTypeId?: number;      // ID danh mục bảo dưỡng (MaintenanceType)
  maintenanceTypeName?: string;    // Tên danh mục để hiển thị nhanh
  maintenanceType?: string;        // Backward compat (enum cũ)
  maintenanceOdo: number;
  cost: number;
  garageName: string;
  replacedParts: string;
  maintenanceDate: string;
  notes?: string;
}

export interface VehicleOdoHistory {
  id: number;
  vehicleId: number;
  tripId?: number;
  startOdo: number;
  endOdo: number;
  distanceKm: number;
  recordedAt: string;
  recordedBy: string;
}

export interface VehicleAssignmentHistory {
  id: number;
  vehicleId: number;
  driverId?: number;
  driverName?: string;
  assignedFrom: string;
  assignedTo?: string;
  notes?: string;
}

export interface MaintenanceType {
  id: number;
  code: string;
  name: string;
  group: 'Bảo dưỡng định kỳ' | 'Sửa chữa phục hồi' | 'Hệ thống chuyên dụng';
  cycleKm?: number;
  cycleMonths?: number;
  cycleHours?: number;
  estimatedCost: number;
  estimatedDurationHours: number;
  description: string;
  checklistItems: string[];
  isActive: boolean;
  assignedVehicleIds: number[]; // DS xe cụ thể áp dụng danh mục này ([] = chưa gán)
}
