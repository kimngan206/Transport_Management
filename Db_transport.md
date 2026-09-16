// ============================================================================ 
// DATABASE DIAGRAM (DBML) - ĐIỀU VẬN & ĐỘI XE ECOTECH 2A
// Chuẩn hóa 100% theo Script SQL OperationManagementDB
// Dùng trực tiếp trên https://dbdiagram.io
// ============================================================================

// ==========================================
// 1. NHÓM TÀI KHOẢN, PHÒNG BAN & TÀI XẾ
// ==========================================

Table Farm {
  id int [pk]
  code varchar(20) [not null, unique]
  name nvarchar(100) [not null]
  manager_id int [null]
  Note: 'Nông trường / Đội sản xuất'
}

Table Factory {
  id int [pk]
  code varchar(20) [not null, unique]
  name nvarchar(100) [not null]
  manager_id int [null]
  Note: 'Nhà máy chế biến mủ cao su'
}

Table Account {
  id int [pk]
  user_name varchar(20) [not null, unique]
  password varchar(100) [not null]
  first_name nvarchar(10) [not null]
  last_name nvarchar(10) [not null]
  account_type varchar(10) [not null] // Requester, Dispatcher, Driver, Admin
  email nvarchar(100) [null]
  phone varchar(20) [null]
  updated_at datetime [null]
  updated_by int [null]
  status smallint [not null, default: 1]
  created_at datetime2 [not null]
  created_by int [not null]
  Note: 'Tài khoản người dùng hệ thống'
}

Table Driver {
  id int [pk]
  account_id int [not null, unique]
  employee_code varchar(20) [null]
  full_name nvarchar(100) [not null]
  phone_number varchar(20) [null]
  email nvarchar(100) [null]
  address nvarchar(200) [null]
  date_of_birth datetime2 [null]
  note nvarchar(200) [null]
  status smallint [not null, default: 1]
  license_number varchar(30) [not null]
  license_class varchar(10) [null] // B2, C, D, E, FC...
  license_expiry_date date [not null]
  license_image_url varchar(500) [null]
  employment_status varchar(20) [not null, default: 'Active'] // Active, OnLeave, Suspended
  is_currently_on_trip bit [not null, default: 0]
  Note: 'Hồ sơ GPLX & Thông tin tài xế'
}

// ==========================================
// 2. NHÓM ĐIỂM TRẠM, TUYẾN ĐƯỜNG & BẢN ĐỒ
// ==========================================

Table HubLocation {
  id int [pk]
  code varchar(20) [not null, unique]
  name nvarchar(100) [not null]
  short_name nvarchar(50) [null]
  hub_type varchar(30) [not null] // STATION, FACTORY, GARAGE, FARM, OFFICE
  address nvarchar(255) [null]
  latitude decimal(9,6) [null]
  longitude decimal(9,6) [null]
  description nvarchar(200) [null]
  Note: 'Điểm trạm cố định: Trạm cân, Nông trường, Nhà máy, Gara'
}

Table StandardRoute {
  id int [pk]
  route_code varchar(20) [not null, unique]
  name nvarchar(200) [not null]
  start_hub_id int [null]
  end_hub_id int [null]
  standard_distance_km decimal(10,2) [not null, default: 0.00]
  stroke_color varchar(20) [null, default: '#28a745']
  waypoints_json nvarchar(max) [null] [{id, km(0-1)}, {id, km(1-2)}]
  description nvarchar(255) [null]
  Note: 'Tuyến đường quy chuẩn thu gom & công tác'
}

// ==========================================
// 3. NHÓM PHƯƠNG TIỆN, ĐỊNH MỨC & BẢO DƯỠNG
// ==========================================
// 
Table VehicleCategory {
  id int [pk]
  code varchar(20) [not null, unique]
  name nvarchar(100) [not null]
  group_type nvarchar(50) [null] // Vận tải mủ, Cơ giới nông trường, Công tác
  fuel_quota_type varchar(30) [not null] // L_PER_KM, L_PER_TON_KM, L_PER_HOUR
  default_quota_empty decimal(10,3) [null]
  default_quota_loaded decimal(10,3) [null]
  description nvarchar(255) [null]
  status smallint [not null, default: 1]
  sort int [null]
  Note: 'Danh mục loại phương tiện & định mức chuẩn'
}

Table Vehicle {
  id int [pk]
  code varchar(20) [not null]
  license_plate varchar(20) [not null, unique]
  type int [null]
  category_id int [not null]
  farm_id int [null]
  factory_id int [null]
  driver_id int [null]
  escort_id int [null]
  type_car nvarchar(30) [not null] // LatexTruck, PassengerCar, MillingMachine
  vehicle_tonnage decimal(10,2) [null]
  vehicle_weight decimal(10,2) [null]
  image_url varchar(500) [null]
  image_list varchar(500) [null]
  remark nvarchar(500) [null]
  model nvarchar(100) [null]
  passenger_capacity int [null, default: 0]
  inspection_expiry_date date [null]
  is_external bit [not null, default: 0]
  current_odo_km decimal(10,2) [not null, default: 0.00]
  current_operating_hours decimal(10,2) [not null, default: 0.00]
  last_maintenance_odo decimal(10,2) [not null, default: 0.00]
  last_maintenance_date date [null]
  status smallint [not null, default: 1]
  maintenance_status varchar(30) [not null, default: 'Normal'] // Normal, MaintenanceNeeded, UnderMaintenance
  empty_fuel_norm decimal(10,3) [null]
  loaded_fuel_norm decimal(10,3) [null]
  hourly_fuel_norm decimal(10,3) [null]
  fuel_formula_text nvarchar(255) [null]
  sort int [null]
  Note: 'Hồ sơ phương tiện đội xe'
}

Table MaintenanceType {
  id int [pk]
  code varchar(20) [not null, unique]
  name nvarchar(100) [not null]
  group_name nvarchar(50) [null] // Bảo dưỡng định kỳ, Sửa chữa phục hồi, Hệ thống chuyên dụng
  cycle_km decimal(10,2) [null]
  cycle_hours decimal(10,2) [null]
  estimated_cost decimal(15,2) [null]
  estimated_duration_hours decimal(5,1) [null]
  checklist_items nvarchar(1000) [null]
  is_active bit [not null, default: 1]
  Note: 'Danh mục loại hình bảo dưỡng & chu kỳ'
}

Table IncidentReport {
  id int [pk]
  vehicle_id int [not null]
  reported_by_driver_id int [not null]
  report_date datetime2 [not null]
  issue_description nvarchar(500) [not null]
  severity varchar(20) [not null, default: 'Warning'] // Warning, StopOperation
  status varchar(20) [not null, default: 'Pending'] // Pending, InRepair, Resolved
  resolution_note nvarchar(500) [null]
  location nvarchar(255) [null]
  latitude decimal(9,6) [null]
  longitude decimal(9,6) [null]
  Note: 'Báo cáo sự cố trên đường / hiện trường'
}

Table MaintenanceRecord {
  id int [pk]
  vehicle_id int [not null]
  maintenance_type_id int [null]
  incident_report_id int [null]
  maintenance_odo decimal(10,2) [not null, default: 0.00]
  cost decimal(15,2) [not null, default: 0.00]
  garage_name nvarchar(150) [null]
  replaced_parts nvarchar(500) [null]
  maintenance_date datetime2 [not null]
  notes nvarchar(500) [null]
  Note: 'Lịch sử phiếu sửa chữa & bảo dưỡng'
}

// ==========================================
// 4. YÊU CẦU VẬN CHUYỂN, ĐIỀU PHỐI & CHI PHÍ
// ==========================================

Table TransportRequest {
  id int [pk]
  request_code varchar(30) [not null, unique]
  requester_id int [not null]
  farm_id int [not null]
  vehicle_type varchar(30) [not null]
  requested_vehicle_id int [null]
  team_name nvarchar(50) [null]
  start_time datetime2 [not null]
  end_time datetime2 [not null]
  from_location nvarchar(200) [not null]
  to_location nvarchar(200) [not null]
  standard_route_id int [null]
  purpose nvarchar(255) [null]
  estimated_weight_kg decimal(10,2) [null]
  passengers_count int [null]
  operating_hours decimal(10,2) [null]
  status varchar(30) [not null, default: 'PENDING'] // PENDING, APPROVED, REJECTED, DISPATCHED, INPROGRESS, COMPLETED, CANCELLED
  approved_by_id int [null]
  approved_at datetime2 [null]
  rejection_reason nvarchar(255) [null]
  created_at datetime2 [not null]
  created_by int [not null]
  updated_at datetime2 [null]
  updated_by int [null]
  Note: 'Yêu cầu đặt xe vận chuyển mủ / công tác / máy đào'
}

// TransportMaterialRoute
Table HaulageTrip {
  id int [pk]
  trip_code varchar(30) [not null, unique]
  vehicle_id int [not null]
  driver_id int [not null]
  standard_route_id int [not null]
  scheduled_start_time datetime2 [not null]
  scheduled_end_time datetime2 [not null]
  accepted_at datetime2 [null]
  actual_start_time datetime2 [null]
  arrived_at datetime2 [null]
  arrival_note nvarchar(255) [null]
  actual_end_time datetime2 [null]
  start_odo decimal(10,2) [null]
  end_odo decimal(10,2) [null]
  total_distance_km decimal(10,2) [not null, default: 0.00]
  // lưu các bảng mủ -> bỏ các field này đi
  weight_latex_1_kg decimal(10,2) [null, default: 0.00]
  weight_latex_2_kg decimal(10,2) [null, default: 0.00]
  weight_latex_3_kg decimal(10,2) [null, default: 0.00]
  weight_latex_tap_kg decimal(10,2) [null, default: 0.00]
  total_weight_tons decimal(10,2) [null, default: 0.00]
  
  //calculated_fuel_liters decimal(10,2) [null]
  actual_fuel_supplied_liters decimal(10,2) [null]
  fuel_variance_liters decimal(10,2) [null]
  status varchar(30) [not null, default: 'ASSIGNED'] // ASSIGNED, ACCEPTED, INPROGRESS, ARRIVED, COMPLETED, CANCELLED
  notes nvarchar(500) [null]
  created_at datetime2 [not null]
  created_by int [not null]
  updated_at datetime2 [null]
  updated_by int [null]
  Note: 'Chuyến đi điều vận chính thức'
}

Table TripRequestMapping {
  trip_id int [pk]
  request_id int [pk]
  Note: 'Ghép nhiều yêu cầu vào 1 chuyến xe (US-06)'
}

Table TripExpense {
  id int [pk]
  trip_id int [not null]
  expense_type varchar(30) [not null] // Fuel, Toll, Parking, Repair, Other
  amount decimal(15,2) [not null]
  receipt_note nvarchar(255) [null]
  receipt_image_url nvarchar(1000) [null]
  audit_status varchar(20) [not null, default: 'PENDING'] // PENDING, APPROVED, REJECTED
  audited_by int [null]
  audit_note nvarchar(255) [null]
  recorded_at datetime2 [not null]
  Note: 'Chi phí phát sinh trên chuyến đi'
}
//delete
Table TripDispatchSetting {
  id int [pk]
  vehicle_id int [unique, null]
  vehicle_type varchar(30) [null]
  turnaround_buffer_minutes int [not null, default: 30]
  inter_vehicle_interval_minutes int [not null, default: 15]
  cleaning_duration_minutes int [not null, default: 20]
  is_custom_for_vehicle bit [not null, default: 0]
  updated_at datetime2 [not null]
  Note: 'Cài đặt thời gian đệm và giãn cách điều phối'
}

// ==========================================
// 5. BÀN GIAO MƯỢN TRẢ, ĐIỀU CHUYỂN & NHẬT TRÌNH
// ==========================================

Table VehicleHandoverRecord {
  id int [pk]
  vehicle_id int [not null]
  workflow_type varchar(30) [not null] // BORROW_RETURN, TRANSFER, DRIVER_HANDOVER
  rescue_trip_id int [null]
  replacing_vehicle_id int [null]
  from_team nvarchar(100) [null]
  to_team nvarchar(100) [null]
  from_factory_id int [null]
  to_factory_id int [null]
  from_manager_name nvarchar(100) [null]
  to_manager_name nvarchar(100) [null]
  decision_number varchar(50) [null]
  effective_date date [null]
  transfer_reason nvarchar(500) [null]
  from_driver_id int [null]
  to_driver_id int [null]
  handover_reason_type varchar(30) [null]
  borrow_start_at datetime2 [not null]
  expected_return_at datetime2 [null]
  actual_return_at datetime2 [null]
  handover_odo decimal(10,2) [not null, default: 0.00]
  return_odo decimal(10,2) [null]
  fuel_level varchar(20) [null]
  return_fuel_level varchar(20) [null]
  condition_notes nvarchar(500) [null]
  handover_image_url varchar(500) [null]
  note nvarchar(500) [null]
  //status varchar(20) [not null, default: 'BORROWING'] // BORROWING, RETURNED, OVERDUE, CANCELLED
  created_at datetime2 [not null]
  created_by int [not null]
  updated_at datetime2 [null]
  updated_by int [null]
  Note: 'Biên bản mượn trả xe, điều chuyển & bàn giao tài xế'
}

Table EquipmentShiftLog {
  id int [pk]
  vehicle_id int [not null]
  operator_id int [not null]
  hub_id int [null]
  work_date date [not null]
  start_hour_meter decimal(10,2) [not null, default: 0.00]
  end_hour_meter decimal(10,2) [not null, default: 0.00]
  total_hours decimal(10,2) [null]
  excavator_task nvarchar(50) [null]
  fuel_allocated decimal(10,2) [null]
  handover_record_id int [null]
  Note: 'Nhật trình máy đào & cơ giới nông trường'
}

// ==========================================
// 6. HÌNH ẢNH & SẢN PHẨM NÔNG NGHIỆP
// ==========================================

Table Image {
  id int [pk]
  serial_id int [null]
  ref_id varchar(36) [null]
  name varchar(50) [null]
  description varchar(150) [null]
  relative_url varchar(250) [null]
  small_url varchar(250) [null]
  medium_url varchar(250) [null]
  created_at datetime2 [not null]
  created_by int [not null]
  status int [not null, default: 1]
  timer datetime2 [null]
  Note: 'Lưu trữ metadata hình ảnh'
}

Table Product {
  id int [pk]
  code varchar(20) [not null, unique]
  name nvarchar(100) [not null]
  name_slug nvarchar(100) [null]
  sort int [null]
  ratio_transfer float [null]
  remark nvarchar(150) [null]
  status smallint [not null, default: 1]
  created_at datetime2 [not null]
  created_by int [not null]
  updated_at datetime2 [null]
  updated_by int [null]
  Note: 'Sản phẩm / tỷ lệ chuyển đổi quả -> nhân'
}

// ==========================================
// QUAN HỆ GIỮA CÁC BẢNG (RELATIONSHIPS)
// ==========================================

// Nhóm 1: Tài khoản, Đội, Nông trường, Tài xế
Ref: Farm.manager_id > Account.id
Ref: Factory.manager_id > Account.id
Ref: Driver.account_id - Account.id

// Nhóm 2: Điểm trạm & Tuyến đường
Ref: StandardRoute.start_hub_id > HubLocation.id
Ref: StandardRoute.end_hub_id > HubLocation.id

// Nhóm 3: Phương tiện & Bảo dưỡng
Ref: Vehicle.category_id > VehicleCategory.id
Ref: Vehicle.driver_id > Driver.id
Ref: Vehicle.escort_id > Account.id
Ref: Vehicle.farm_id > Farm.id
Ref: Vehicle.factory_id > Factory.id

Ref: IncidentReport.vehicle_id > Vehicle.id
Ref: IncidentReport.reported_by_driver_id > Driver.id

Ref: MaintenanceRecord.vehicle_id > Vehicle.id
Ref: MaintenanceRecord.maintenance_type_id > MaintenanceType.id
Ref: MaintenanceRecord.incident_report_id > IncidentReport.id

// Nhóm 4: Yêu cầu, Điều phối chuyến & Chi phí
Ref: TransportRequest.requester_id > Account.id
Ref: TransportRequest.farm_id > Farm.id
Ref: TransportRequest.approved_by_id > Account.id
Ref: TransportRequest.standard_route_id > StandardRoute.id
Ref: TransportRequest.requested_vehicle_id > Vehicle.id

Ref: HaulageTrip.vehicle_id > Vehicle.id
Ref: HaulageTrip.driver_id > Driver.id
Ref: HaulageTrip.standard_route_id > StandardRoute.id
Ref: HaulageTrip.created_by > Account.id

Ref: TripRequestMapping.trip_id > HaulageTrip.id
Ref: TripRequestMapping.request_id > TransportRequest.id

Ref: TripExpense.trip_id > HaulageTrip.id
Ref: TripExpense.audited_by > Account.id

Ref: TripDispatchSetting.vehicle_id > Vehicle.id

// Nhóm 5: Mượn trả bàn giao & Nhật trình cơ giới
Ref: VehicleHandoverRecord.vehicle_id > Vehicle.id
Ref: VehicleHandoverRecord.rescue_trip_id > HaulageTrip.id
Ref: VehicleHandoverRecord.replacing_vehicle_id > Vehicle.id
Ref: VehicleHandoverRecord.from_hub_id > HubLocation.id
Ref: VehicleHandoverRecord.to_hub_id > HubLocation.id
Ref: VehicleHandoverRecord.from_driver_id > Driver.id
Ref: VehicleHandoverRecord.to_driver_id > Driver.id

Ref: EquipmentShiftLog.vehicle_id > Vehicle.id
Ref: EquipmentShiftLog.operator_id > Driver.id
Ref: EquipmentShiftLog.hub_id > HubLocation.id
Ref: EquipmentShiftLog.handover_record_id > VehicleHandoverRecord.id