// ==========================================
// 1. NHÓM TÀI KHOẢN, PHÒNG BAN & TÀI XẾ
// ==========================================

Table department {
  id int [pk, increment]
  code varchar(20) [not null, unique]
  name nvarchar(100) [not null]
  manager_id int
}

Table account {
  id int [pk, increment]
  user_name nvarchar(50) [not null, unique]
  password varchar(100) [not null]
  first_name nvarchar(50)
  last_name nvarchar(50)
  email nvarchar(100)
  phone varchar(20)
  department_id int
  status smallint
  created_at datetime
  created_by int
  updated_at datetime
  updated_by int
}

Table role {
  id int [pk, increment]
  role_name nvarchar(50) [not null]
  description nvarchar(200)
}

Table account_role {
  account_id int [pk]
  role_id int [pk]
  assigned_at datetime
}

Table driver {
  id int [pk, increment]
  account_id int [not null, unique]
  employee_code varchar(20)
  license_number varchar(30) [not null]
  license_class varchar(10) // B2, C, D, E, FC...
  license_expiry_date date [not null]
  employment_status varchar(20) // Active, OnLeave, Suspended
  is_currently_on_trip bool [default: false]
}

// ==========================================
// 2. NHÓM TUYẾN ĐƯỜNG, ĐỊA ĐIỂM & TRẠM
// ==========================================

Table hub_location {
  id guid [pk]
  code varchar(20) [unique]
  name nvarchar(100) [not null]
  hub_type varchar(30) // 'STATION' | 'FACTORY' | 'GARAGE' | 'FARM'
  latitude decimal(9,6)
  longitude decimal(9,6)
  description nvarchar(200)
}

Table standard_route {
  id guid [pk]
  route_code varchar(20) [not null, unique]
  name nvarchar(200) [not null]
  start_hub_id guid
  end_hub_id guid
  standard_distance_km decimal(10,2)
  description nvarchar(255)
}

// ==========================================
// 3. NHÓM PHƯƠNG TIỆN & BẢO DƯỠNG
// ==========================================

Table vehicle_category {
  id int [pk, increment]
  code varchar(20) [not null]
  name nvarchar(100) [not null]
  group_type nvarchar(50) // Vận tải mủ, Cơ giới nông trường, Công tác
  vehicle_type_code varchar(30) // LatexTruck, PassengerCar, MillingMachine
  fuel_quota_type varchar(30) // L_PER_KM, L_PER_TON_KM, L_PER_HOUR
}

Table vehicle {
  id guid [pk]
  license_plate varchar(20) [not null, unique]
  category_id int
  vehicle_type varchar(30) // LatexTruck, PassengerCar, MillingMachine
  capacity_tons decimal(10,2)
  passenger_capacity int
  inspection_expiry_date date // Ngày hết hạn kiểm định
  
  // Quản lý ODO & Giờ máy
  current_odo_km decimal(10,2) [default: 0]
  current_operating_hours decimal(10,2) [default: 0]
  last_maintenance_odo decimal(10,2) [default: 0]
  last_maintenance_date date
  
  // Tách biệt Trạng thái vận hành & Trạng thái bảo dưỡng (BR-011)
  status varchar(30) // Available, OnTrip, UnderMaintenance, Broken
  maintenance_status varchar(30) // Normal, Due, Overdue
  
  // Định mức nhiên liệu
  empty_fuel_norm decimal(10,3)
  loaded_fuel_norm decimal(10,3)
  hourly_fuel_norm decimal(10,3)
  
  assigned_driver_id int
}

Table maintenance_type {
  id int [pk, increment]
  code varchar(20)
  name nvarchar(100)
  group_name nvarchar(50) // Bảo dưỡng định kỳ, Sửa chữa phục hồi
  cycle_km decimal(10,2)
  cycle_hours decimal(10,2)
  estimated_cost decimal(15,2)
  is_active bool [default: true]
}

Table maintenance_record {
  id guid [pk]
  vehicle_id guid [not null]
  maintenance_type_id int
  incident_report_id guid
  maintenance_odo decimal(10,2)
  cost decimal(15,2)
  garage_name nvarchar(150)
  replaced_parts nvarchar(500)
  maintenance_date datetime
  notes nvarchar(500)
}

// ==========================================
// 4. YÊU CẦU VẬN CHUYỂN, CHUYẾN ĐI & ĐIỀU VẬN
// ==========================================

Table transport_request {
  id guid [pk]
  request_code varchar(30) [not null, unique]
  requester_id int [not null]
  department_id int [not null]
  vehicle_type varchar(30)
  start_time datetime [not null]
  end_time datetime [not null]
  from_location nvarchar(200)
  to_location nvarchar(200)
  standard_route_id guid
  purpose nvarchar(255)
  estimated_weight_kg decimal(10,2)
  passengers_count int
  status varchar(30) // PENDING, APPROVED, REJECTED, DISPATCHED, INPROGRESS, COMPLETED, CANCELLED
  created_at datetime
}

Table haulage_trip {
  id guid [pk]
  trip_code varchar(30) [not null, unique]
  vehicle_id guid [not null]
  driver_id int [not null]
  standard_route_id guid [not null]
  
  // Khung thời gian chạy chuyến (phục vụ kiểm tra trùng lịch đệm 30 phút)
  scheduled_start_time datetime [not null]
  scheduled_end_time datetime [not null]
  actual_start_time datetime
  actual_end_time datetime
  
  // Đồng hồ ODO chuyến đi
  start_odo decimal(10,2)
  end_odo decimal(10,2)
  total_distance_km decimal(10,2)
  
  // Sản lượng mủ chi tiết
  weight_latex_1_kg decimal(10,2)
  weight_latex_2_kg decimal(10,2)
  weight_latex_3_kg decimal(10,2)
  weight_latex_tap_kg decimal(10,2)
  total_weight_tons decimal(10,2)
  
  // Nhiên liệu
  calculated_fuel_liters decimal(10,2)
  actual_fuel_supplied_liters decimal(10,2)
  
  status varchar(30) // ASSIGNED, ACCEPTED, INPROGRESS, ARRIVED, COMPLETED, CANCELLED
  created_at datetime
}

// Bảng trung gian gom/ghép nhiều Yêu cầu vào 1 Chuyến đi (US-06)
Table trip_request_mapping {
  trip_id guid [pk]
  request_id guid [pk]
}

Table trip_expense {
  id guid [pk]
  trip_id guid [not null]
  expense_type varchar(30) // Fuel, Toll, Parking, Repair, Other
  amount decimal(15,2) [not null]
  receipt_note nvarchar(255)
  receipt_image_url nvarchar(500)
  audit_status varchar(20) // PENDING, APPROVED, REJECTED
  recorded_at datetime
}

// ==========================================
// 5. SỰ CỐ, CỨU VIỆN & NHẬT TRÌNH MÁY MÓC
// ==========================================

Table incident_report {
  id guid [pk]
  vehicle_id guid [not null]
  reported_by_driver_id int [not null]
  report_date datetime [not null]
  issue_description nvarchar(500)
  severity varchar(20) // Warning, StopOperation
  status varchar(20) // Pending, InRepair, Resolved
  latitude decimal(9,6)
  longitude decimal(9,6)
}

Table vehicle_handover_record {
  id guid [pk]
  vehicle_id guid [not null]
  workflow_type varchar(30) // BORROW_RETURN, TRANSFER, DRIVER_HANDOVER, HANDOVER
  from_unit_type varchar(20) // Station, Team, Factory
  to_unit_type varchar(20)
  from_team nvarchar(100)
  to_team nvarchar(100)
  from_hub_id guid
  to_hub_id guid
  replacing_vehicle_id guid
  from_driver_id int
  to_driver_id int
  borrow_start_at datetime
  expected_return_at datetime
  actual_return_at datetime
  handover_odo decimal(10,2)
  return_odo decimal(10,2)
  status varchar(20) // BORROWING, RETURNED, OVERDUE, CANCELLED
  created_at datetime
}

Table trip_dispatch_setting {
  id int [pk, increment]
  vehicle_id guid [unique] // Null means default setting for type
  vehicle_type varchar(30)
  turnaround_buffer_minutes int
  inter_vehicle_interval_minutes int
  cleaning_duration_minutes int
  is_custom_for_vehicle bool
  updated_at datetime
}

Table vehicle_transfer_log {
  id guid [pk]
  trip_id guid
  vehicle_id guid [not null]
  replacing_vehicle_id guid
  from_hub_id guid
  to_hub_id guid
  transferred_at datetime
  returned_at datetime
  transfer_reason nvarchar(255)
  transfer_status varchar(30)
}

Table equipment_shift_log {
  id guid [pk]
  vehicle_id guid [not null]
  operator_id int [not null]
  hub_id guid
  work_date date [not null]
  start_hour_meter decimal(10,2)
  end_hour_meter decimal(10,2)
  total_hours decimal(10,2)
  excavator_task varchar(50)
  fuel_allocated decimal(10,2)
  vehicle_transfer_log_id guid
}

// ==========================================
// QUAN HỆ GIỮA CÁC BẢNG (RELATIONSHIPS)
// ==========================================

// Tài khoản & Phân quyền & Phòng ban
Ref: account.department_id > department.id
Ref: account.updated_by > account.id
Ref: account.created_by > account.id
Ref: account_role.account_id > account.id
Ref: account_role.role_id > role.id
Ref: driver.account_id - account.id

// Tuyến đường & Trạm
Ref: standard_route.start_hub_id > hub_location.id
Ref: standard_route.end_hub_id > hub_location.id

// Phương tiện & Bảo dưỡng
Ref: vehicle.category_id > vehicle_category.id
Ref: vehicle.assigned_driver_id > driver.id
Ref: maintenance_record.vehicle_id > vehicle.id
Ref: maintenance_record.maintenance_type_id > maintenance_type.id
Ref: maintenance_record.incident_report_id > incident_report.id

// Yêu cầu & Điều phối chuyến đi
Ref: transport_request.requester_id > account.id
Ref: transport_request.department_id > department.id
Ref: transport_request.standard_route_id > standard_route.id

Ref: haulage_trip.vehicle_id > vehicle.id
Ref: haulage_trip.driver_id > driver.id
Ref: haulage_trip.standard_route_id > standard_route.id

Ref: trip_request_mapping.trip_id > haulage_trip.id
Ref: trip_request_mapping.request_id > transport_request.id

Ref: trip_expense.trip_id > haulage_trip.id

// Sự cố & Điều động / Nhật trình
Ref: incident_report.vehicle_id > vehicle.id
Ref: incident_report.reported_by_driver_id > driver.id

Ref: vehicle_transfer_log.trip_id > haulage_trip.id
Ref: vehicle_transfer_log.vehicle_id > vehicle.id
Ref: vehicle_transfer_log.replacing_vehicle_id > vehicle.id
Ref: vehicle_transfer_log.from_hub_id > hub_location.id
Ref: vehicle_transfer_log.to_hub_id > hub_location.id

Ref: equipment_shift_log.vehicle_id > vehicle.id
Ref: equipment_shift_log.operator_id > account.id
Ref: equipment_shift_log.hub_id > hub_location.id
Ref: equipment_shift_log.vehicle_transfer_log_id > vehicle_transfer_log.id

// Bàn giao xe & Thiết lập điều phối
Ref: vehicle_handover_record.vehicle_id > vehicle.id
Ref: vehicle_handover_record.from_hub_id > hub_location.id
Ref: vehicle_handover_record.to_hub_id > hub_location.id
Ref: vehicle_handover_record.replacing_vehicle_id > vehicle.id
Ref: vehicle_handover_record.from_driver_id > driver.id
Ref: vehicle_handover_record.to_driver_id > driver.id
Ref: trip_dispatch_setting.vehicle_id > vehicle.id