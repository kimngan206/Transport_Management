<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { useRoute } from 'vue-router';
import { useFleetStore } from '@/stores/fleet';
import { useDialogStore } from '@/stores/dialog';
import { mockStorage } from '@/services/mockStorage';
import type { Vehicle, Driver, VehicleCategory } from '@/types';
import StatusBadge from '@/components/common/StatusBadge.vue';
import VehicleDetailModal from '@/components/fleet/VehicleDetailModal.vue';
import DriverDetailModal from '@/components/fleet/DriverDetailModal.vue';
import {
  Truck,
  UserCheck,
  Plus,
  ExternalLink,
  Edit2,
  Trash2,
  Building2,
} from 'lucide-vue-next';

const route = useRoute();
const fleetStore = useFleetStore();
const dialog = useDialogStore();
const activeTab = ref<'vehicles' | 'types' | 'drivers' | 'handover'>('vehicles');
const activeVehicleFilter = ref<'internal' | 'external'>('internal');

const internalCount = computed(() => fleetStore.vehicles.filter(v => !v.isExternal).length);
const externalCount = computed(() => fleetStore.vehicles.filter(v => v.isExternal).length);

const filteredVehicles = computed(() => {
  if (activeVehicleFilter.value === 'external') {
    return fleetStore.vehicles.filter(v => v.isExternal);
  }
  return fleetStore.vehicles.filter(v => !v.isExternal);
});

// Modal chi tiết phương tiện & chu kỳ bảo dưỡng (Section 4 - baoduong.md)
const selectedVehicleForDetail = ref<Vehicle | null>(null);

function openVehicleDetail(v: Vehicle) {
  selectedVehicleForDetail.value = v;
}

// Modal chi tiết tài xế
const selectedDriverForDetail = ref<Driver | null>(null);

function openDriverDetail(d: Driver) {
  selectedDriverForDetail.value = d;
}

watch(
  () => route.query.tab,
  (val) => {
    if (val === 'types') activeTab.value = 'types';
    else if (val === 'drivers') activeTab.value = 'drivers';
    else if (val === 'handover') activeTab.value = 'handover';
    else if (val === 'vehicles') activeTab.value = 'vehicles';
  },
  { immediate: true }
);

// Danh sách bàn giao mượn trả xe (US-28)
const defaultHandovers = [
  {
    id: 1,
    vehiclePlate: '51C-889.26',
    driverName: 'Phạm Văn Tài',
    borrowTime: '2026-09-07 07:30',
    returnTime: '2026-09-07 11:30',
    handoverOdo: 125620,
    fuelLevel: '85%',
    conditionNotes: 'Xe sạch, áp suất lốp đủ, phanh hoạt động tốt, đầy đủ giấy tờ',
    status: 'Đang mượn',
  },
  {
    id: 2,
    vehiclePlate: '51A-992.34',
    driverName: 'Lê Văn Tài',
    borrowTime: '2026-09-06 13:00',
    returnTime: '2026-09-06 17:30',
    handoverOdo: 89400,
    fuelLevel: '90%',
    conditionNotes: 'Đã trả xe nguyên trạng về bãi đỗ văn phòng công ty',
    status: 'Đã trả',
  },
];
const handoverList = ref(mockStorage.getHandovers(defaultHandovers));

// Helper đếm số xe theo loại xe
function countVehiclesForCat(category: any): number {
  return fleetStore.vehicles.filter((v) => {
    if (category.vehicleTypeCode === 'MillingMachine') return v.vehicleType === 'MillingMachine';
    if (category.vehicleTypeCode === 'PassengerCar') return v.vehicleType === 'PassengerCar';
    if (category.code === 'TANKER_LATEX') return v.vehicleType === 'LatexTruck' && v.model.toLowerCase().includes('bồn');
    if (category.code === 'TRUCK_HEAVY_15T') return v.vehicleType === 'LatexTruck' && (v.capacityTons || 0) >= 15;
    if (category.code === 'TRUCK_MEDIUM_8T') return v.vehicleType === 'LatexTruck' && (v.capacityTons || 0) >= 8 && (v.capacityTons || 0) < 15;
    if (category.code === 'TRUCK_LIGHT_5T') return v.vehicleType === 'LatexTruck' && (v.capacityTons || 0) <= 5;
    return v.vehicleType === 'LatexTruck';
  }).length;
}

// Helper an toàn lấy ngưỡng chu kỳ bảo dưỡng
function getThreshold(v: any): number {
  if (fleetStore && typeof fleetStore.getVehicleMaintenanceThreshold === 'function') {
    return fleetStore.getVehicleMaintenanceThreshold(v);
  }
  return 5000;
}

// Chuyển đổi trạng thái xe sang tiếng Việt
function getVehicleStatusLabel(status: string): string {
  switch (status) {
    case 'Available':
      return 'Sẵn sàng';
    case 'OnTrip':
      return 'Đang chạy chuyến';
    case 'UnderMaintenance':
      return 'Đang bảo dưỡng';
    case 'Broken':
      return 'Sự cố / Hỏng hóc';
    default:
      return status;
  }
}

// Chuyển đổi loại xe sang tiếng Việt
function getVehicleTypeLabel(type: string): string {
  switch (type) {
    case 'LatexTruck':
      return 'Xe tải';
    case 'PassengerCar':
      return 'Bán tải';
    case 'MillingMachine':
      return 'Máy đào';
    default:
      return type;
  }
}

// Chuyển đổi tình trạng tài xế sang tiếng Việt
function getDriverEmploymentStatusLabel(status: string): string {
  switch (status) {
    case 'Active':
      return 'Đang hoạt động';
    case 'OnLeave':
      return 'Nghỉ phép';
    case 'Suspended':
      return 'Tạm đình chỉ';
    default:
      return status;
  }
}

// ==================== Modal 1: Thêm / Sửa xe ====================
const showAddVehModal = ref(false);
const editingVehicle = ref<Vehicle | null>(null);
const newVehPlate = ref('');
const newVehType = ref<'LatexTruck' | 'PassengerCar' | 'MillingMachine'>('LatexTruck');
const newVehModel = ref('');
const newVehCapacity = ref(5.0);
const newVehSeats = ref<number | undefined>(undefined);
const newVehEmptyQuota = ref(0.25);
const newVehLoadedQuota = ref(0.02);
const newVehOdo = ref(10000);
const newVehDriverId = ref<number | ''>('');
const newVehTeamName = ref('');
const newVehIsExternal = ref(false);

function openAddVehicleModal() {
  editingVehicle.value = null;
  newVehPlate.value = '';
  newVehType.value = 'LatexTruck';
  newVehModel.value = '';
  newVehCapacity.value = 5.0;
  newVehSeats.value = undefined;
  newVehEmptyQuota.value = 0.25;
  newVehLoadedQuota.value = 0.02;
  newVehOdo.value = 10000;
  newVehDriverId.value = '';
  newVehTeamName.value = '';
  newVehIsExternal.value = false;
  showAddVehModal.value = true;
}

function openEditVehicleModal(vehicle: Vehicle) {
  editingVehicle.value = vehicle;
  newVehPlate.value = vehicle.licensePlate;
  newVehType.value = vehicle.vehicleType;
  newVehModel.value = vehicle.model;
  newVehCapacity.value = vehicle.capacityTons;
  newVehSeats.value = vehicle.passengerCapacity;
  newVehEmptyQuota.value = vehicle.fuelQuotaEmpty;
  newVehLoadedQuota.value = vehicle.fuelQuotaLoaded;
  newVehOdo.value = vehicle.currentOdoKm;
  newVehDriverId.value = vehicle.assignedDriverId || '';
  newVehTeamName.value = vehicle.teamName || '';
  newVehIsExternal.value = !!vehicle.isExternal;
  if (selectedVehicleForDetail.value) {
    selectedVehicleForDetail.value = null;
  }
  showAddVehModal.value = true;
}

function handleSaveVehicle() {
  if (!newVehPlate.value.trim() || !newVehModel.value.trim()) {
    dialog.showWarning('Vui lòng nhập đầy đủ biển số xe và tên dòng xe để tiếp tục!', 'Thiếu Thông Tin Phương Tiện', 'Kiểm tra lại');
    return;
  }
  const plate = newVehPlate.value.trim();
  const isEdit = !!editingVehicle.value;
  const selectedDriverId = newVehDriverId.value === '' ? null : Number(newVehDriverId.value);
  const selectedDriver = fleetStore.drivers.find((d) => d.id === selectedDriverId);

  if (isEdit && editingVehicle.value) {
    const vehicleId = editingVehicle.value.id;
    fleetStore.updateVehicle({
      ...editingVehicle.value,
      licensePlate: plate,
      vehicleType: newVehType.value,
      model: newVehModel.value.trim(),
      capacityTons: Number(newVehCapacity.value),
      passengerCapacity: newVehSeats.value ? Number(newVehSeats.value) : undefined,
      fuelQuotaEmpty: Number(newVehEmptyQuota.value),
      fuelQuotaLoaded: Number(newVehLoadedQuota.value),
      currentOdoKm: Number(newVehOdo.value),
      teamName: newVehType.value === 'LatexTruck' ? newVehTeamName.value.trim() : undefined,
      isExternal: newVehType.value === 'PassengerCar' ? newVehIsExternal.value : undefined,
    });
    // Trigger assignment history if changed
    if (editingVehicle.value.assignedDriverId !== selectedDriverId) {
      fleetStore.assignDriverToVehicle(vehicleId, selectedDriverId, "Phân công từ form cập nhật xe");
    }
    dialog.showSuccess(`Phương tiện [${plate}] đã được cập nhật thành công!`, 'Cập Nhật Thành Công');
  } else {
    const newVehicleId = Date.now();
    fleetStore.addVehicle({
      id: newVehicleId,
      licensePlate: plate,
      vehicleType: newVehType.value,
      model: newVehModel.value.trim(),
      capacityTons: Number(newVehCapacity.value),
      passengerCapacity: newVehSeats.value ? Number(newVehSeats.value) : undefined,
      fuelQuotaEmpty: Number(newVehEmptyQuota.value),
      fuelQuotaLoaded: Number(newVehLoadedQuota.value),
      currentOdoKm: Number(newVehOdo.value),
      teamName: newVehType.value === 'LatexTruck' ? newVehTeamName.value.trim() : undefined,
      isExternal: newVehType.value === 'PassengerCar' ? newVehIsExternal.value : undefined,
      status: 'Available',
      maintenanceStatus: 'Normal',
      lastMaintenanceOdo: Number(newVehOdo.value),
      lastMaintenanceDate: new Date().toISOString().slice(0, 10),
    });
    if (selectedDriverId !== null) {
      fleetStore.assignDriverToVehicle(newVehicleId, selectedDriverId, "Phân công từ form tạo xe mới");
    }
    dialog.showSuccess(`Phương tiện [${plate}] đã được thêm vào đội xe thành công!`, 'Thêm Xe Mới Thành Công');
  }

  showAddVehModal.value = false;
  editingVehicle.value = null;
  newVehPlate.value = '';
  newVehModel.value = '';
  newVehDriverId.value = '';
}

function handleDeleteVehicle(vehicle: Vehicle) {
  if (vehicle.status === 'OnTrip') {
    dialog.showWarning(`Phương tiện [${vehicle.licensePlate}] đang thực hiện chuyến vận chuyển. Không thể xóa lúc này!`, 'Không Thể Xóa', 'Đã hiểu');
    return;
  }

  dialog.showConfirm({
    title: 'Xác Nhận Xóa Phương Tiện',
    message: `Bạn có chắc chắn muốn xóa phương tiện [${vehicle.licensePlate}] (${vehicle.model}) khỏi đội xe?`,
    confirmText: 'Xác Nhận Xóa',
    onConfirm: () => {
      fleetStore.deleteVehicle(vehicle.id);
      dialog.showSuccess(`Đã xóa phương tiện [${vehicle.licensePlate}] khỏi đội xe thành công!`, 'Xóa Thành Công');
    },
  });
}

// ==================== Modal: Phân công tài xế ====================
const showAssignDriverModal = ref(false);
const assignVehicle = ref<Vehicle | null>(null);
const assignDriverId = ref<number | ''>('');
const assignNotes = ref('');

function openAssignDriverModal(vehicle: Vehicle) {
  assignVehicle.value = vehicle;
  assignDriverId.value = vehicle.assignedDriverId || '';
  assignNotes.value = '';
  showAssignDriverModal.value = true;
}

function handleSaveAssignment() {
  if (!assignVehicle.value) return;
  const driverId = assignDriverId.value === '' ? null : Number(assignDriverId.value);
  fleetStore.assignDriverToVehicle(assignVehicle.value.id, driverId, assignNotes.value.trim());
  dialog.showSuccess(`Phân công tài xế cho xe [${assignVehicle.value.licensePlate}] thành công!`, 'Phân Công Thành Công');
  showAssignDriverModal.value = false;
  assignVehicle.value = null;
}

// ==================== Modal 2: Thêm / Sửa loại xe ====================
const showAddCatModal = ref(false);
const editingCategory = ref<VehicleCategory | null>(null);
const newCatCode = ref('');
const newCatName = ref('');
const newCatGroup = ref<'Vận tải mủ' | 'Cơ giới nông trường' | 'Công tác & Kỹ thuật'>('Vận tải mủ');
const newCatVehType = ref<'LatexTruck' | 'PassengerCar' | 'MillingMachine'>('LatexTruck');
const newCatDesc = ref('');
const newCatIsActive = ref(true);

function openAddCategoryModal() {
  editingCategory.value = null;
  newCatCode.value = '';
  newCatName.value = '';
  newCatGroup.value = 'Vận tải mủ';
  newCatVehType.value = 'LatexTruck';
  newCatDesc.value = '';
  newCatIsActive.value = true;
  showAddCatModal.value = true;
}

function openEditCategoryModal(cat: VehicleCategory) {
  editingCategory.value = cat;
  newCatCode.value = cat.code;
  newCatName.value = cat.name;
  newCatGroup.value = cat.group;
  newCatVehType.value = cat.vehicleTypeCode;
  newCatDesc.value = cat.description || '';
  newCatIsActive.value = cat.isActive;
  showAddCatModal.value = true;
}

function handleSaveCategory() {
  if (!newCatCode.value.trim() || !newCatName.value.trim()) {
    dialog.showWarning('Vui lòng nhập đầy đủ mã loại xe và tên loại xe!', 'Thiếu Thông Tin Bắt Buộc', 'Kiểm tra lại');
    return;
  }
  const catName = newCatName.value.trim();
  const catCode = newCatCode.value.trim().toUpperCase();

  if (editingCategory.value) {
    fleetStore.updateVehicleCategory({
      ...editingCategory.value,
      code: catCode,
      name: catName,
      group: newCatGroup.value,
      vehicleTypeCode: newCatVehType.value,
      description: newCatDesc.value.trim(),
      isActive: newCatIsActive.value,
    });
    dialog.showSuccess(`Loại xe [${catName}] đã được cập nhật thành công!`, 'Cập Nhật Thành Công');
  } else {
    fleetStore.addVehicleCategory({
      code: catCode,
      name: catName,
      group: newCatGroup.value,
      vehicleTypeCode: newCatVehType.value,
      defaultQuotaEmpty: newCatVehType.value === 'MillingMachine' ? 14.5 : newCatVehType.value === 'LatexTruck' ? 0.25 : 0.1,
      fuelQuotaType: newCatVehType.value === 'MillingMachine' ? 'L_PER_HOUR' : newCatVehType.value === 'LatexTruck' ? 'L_PER_TON_KM' : 'L_PER_KM',
      description: newCatDesc.value.trim(),
      isActive: newCatIsActive.value,
    });
    dialog.showSuccess(`Loại xe [${catName}] đã được tạo mới thành công!`, 'Thêm Loại Xe Mới Thành Công');
  }

  showAddCatModal.value = false;
  editingCategory.value = null;
}

function handleDeleteCategory(cat: VehicleCategory) {
  const usingCount = countVehiclesForCat(cat);
  if (usingCount > 0) {
    dialog.showWarning(`Loại xe [${cat.name}] đang có ${usingCount} phương tiện trực thuộc. Không thể xóa!`, 'Không Thể Xóa', 'Đã hiểu');
    return;
  }

  dialog.showConfirm({
    title: 'Xác Nhận Xóa Loại Xe',
    message: `Bạn có chắc chắn muốn xóa loại xe [${cat.name}] (${cat.code}) khỏi hệ thống?`,
    confirmText: 'Xác Nhận Xóa',
    onConfirm: () => {
      fleetStore.deleteVehicleCategory(cat.id);
      dialog.showSuccess(`Đã xóa loại xe [${cat.name}] thành công!`, 'Xóa Thành Công');
    },
  });
}

// ==================== Modal 3: Thêm / Sửa tài xế ====================
const showAddDriverModal = ref(false);
const editingDriver = ref<Driver | null>(null);
const newDriverEmployeeCode = ref('');
const newDriverName = ref('');
const newDriverPhone = ref('');
const newDriverLicenseNum = ref('');
const newDriverLicenseClass = ref('Hạng C');
const newDriverLicenseExpiry = ref('2029-12-31');
const newDriverStatus = ref<'Active' | 'OnLeave' | 'Suspended'>('Active');

function openAddDriverModal() {
  editingDriver.value = null;
  newDriverEmployeeCode.value = '';
  newDriverName.value = '';
  newDriverPhone.value = '';
  newDriverLicenseNum.value = '';
  newDriverLicenseClass.value = 'Hạng C';
  newDriverLicenseExpiry.value = '2029-12-31';
  newDriverStatus.value = 'Active';
  newDriverLicenseImageUrl.value = '';
  showAddDriverModal.value = true;
}

function openEditDriverModal(driver: Driver) {
  editingDriver.value = driver;
  newDriverEmployeeCode.value = driver.employeeCode || `NV-${String(driver.id).padStart(4, '0')}`;
  newDriverName.value = driver.fullName;
  newDriverPhone.value = driver.phone;
  newDriverLicenseNum.value = driver.licenseNumber;
  newDriverLicenseClass.value = driver.licenseClass;
  newDriverLicenseExpiry.value = driver.licenseExpiryDate;
  newDriverStatus.value = driver.employmentStatus;
  newDriverLicenseImageUrl.value = driver.licenseImageUrl || '';
  selectedDriverForDetail.value = null;
  showAddDriverModal.value = true;
}

function handleSaveDriver() {
  if (!newDriverName.value.trim() || !newDriverPhone.value.trim() || !newDriverLicenseNum.value.trim()) {
    dialog.showWarning('Vui lòng điền đầy đủ Họ tên, Số điện thoại và Số GPLX của tài xế!', 'Thiếu Thông Tin Tài Xế', 'Kiểm tra lại');
    return;
  }
  const driverName = newDriverName.value.trim();
  const isEdit = !!editingDriver.value;
  const employeeCode = newDriverEmployeeCode.value.trim().toUpperCase() ||
    (editingDriver.value?.employeeCode || `NV-${Date.now().toString().slice(-4)}`);

  if (isEdit && editingDriver.value) {
    fleetStore.updateDriver({
      ...editingDriver.value,
      employeeCode,
      fullName: driverName,
      phone: newDriverPhone.value.trim(),
      licenseNumber: newDriverLicenseNum.value.trim(),
      licenseClass: newDriverLicenseClass.value,
      licenseExpiryDate: newDriverLicenseExpiry.value,
      licenseImageUrl: newDriverLicenseImageUrl.value,
      employmentStatus: newDriverStatus.value,
    });

    // Đồng bộ nếu tài xế đang được gán xe
    fleetStore.vehicles.forEach((v) => {
      if (v.assignedDriverId === editingDriver.value?.id) {
        v.assignedDriverName = driverName;
        v.assignedDriverPhone = newDriverPhone.value.trim();
      }
    });
    fleetStore.saveState();

    dialog.showSuccess(`Đã cập nhật hồ sơ tài xế [${driverName}] thành công!`, 'Cập Nhật Thành Công');
  } else {
    fleetStore.addDriver({
      accountId: 0,
      employeeCode,
      fullName: driverName,
      phone: newDriverPhone.value.trim(),
      licenseNumber: newDriverLicenseNum.value.trim(),
      licenseClass: newDriverLicenseClass.value,
      licenseExpiryDate: newDriverLicenseExpiry.value,
      licenseImageUrl: newDriverLicenseImageUrl.value,
      employmentStatus: newDriverStatus.value,
      isCurrentlyOnTrip: false,
    });
    dialog.showSuccess(`Hồ sơ tài xế [${driverName}] đã được lưu vào hệ thống thành công!`, 'Thêm Tài Xế Mới Thành Công');
  }

  showAddDriverModal.value = false;
  editingDriver.value = null;
  newDriverEmployeeCode.value = '';
  newDriverName.value = '';
  newDriverPhone.value = '';
  newDriverLicenseNum.value = '';
  newDriverLicenseImageUrl.value = '';
}

const newDriverLicenseImageUrl = ref<string>('');

function handleLicenseUpload(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      newDriverLicenseImageUrl.value = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  }
}

function handleDeleteDriver(driver: Driver) {
  if (driver.isCurrentlyOnTrip) {
    dialog.showWarning(`Tài xế [${driver.fullName}] đang thực hiện chuyến vận chuyển. Không thể xóa lúc này!`, 'Không Thể Xóa', 'Đã hiểu');
    return;
  }

  const assignedVeh = fleetStore.vehicles.find((v) => v.assignedDriverId === driver.id);
  const warningText = assignedVeh
    ? `Tài xế [${driver.fullName}] hiện đang là tài xế trực thuộc của xe [${assignedVeh.licensePlate}]. Nếu xóa, xe này sẽ chuyển về trạng thái chưa có tài xế trực thuộc. Bạn có chắc chắn muốn xóa?`
    : `Bạn có chắc chắn muốn xóa tài xế [${driver.fullName}] khỏi hệ thống?`;

  dialog.showConfirm({
    title: 'Xác Nhận Xóa Tài Xế',
    message: warningText,
    confirmText: 'Xác Nhận Xóa',
    onConfirm: () => {
      if (assignedVeh) {
        assignedVeh.assignedDriverId = undefined;
        assignedVeh.assignedDriverName = undefined;
        assignedVeh.assignedDriverPhone = undefined;
        fleetStore.saveState();
      }
      fleetStore.deleteDriver(driver.id);
      dialog.showSuccess(`Đã xóa tài xế [${driver.fullName}] khỏi hệ thống!`, 'Xóa Thành Công');
    },
  });
}

// ==================== Modal 4: Lập phiếu bàn giao mượn trả ====================
const showAddHandoverModal = ref(false);
const newHandoverPlate = ref(fleetStore.vehicles[0]?.licensePlate || '');
const newHandoverDriver = ref(fleetStore.drivers[0]?.fullName || '');
const newHandoverBorrowTime = ref(new Date().toISOString().slice(0, 16));
const newHandoverReturnTime = ref('');
const newHandoverOdo = ref(120000);
const newHandoverFuel = ref('90%');
const newHandoverNotes = ref('Xe sạch, áp suất lốp đủ, phanh hoạt động tốt, đầy đủ giấy tờ');

function handleAddHandover() {
  if (!newHandoverPlate.value || !newHandoverDriver.value) {
    dialog.showWarning('Vui lòng chọn phương tiện và tài xế nhận xe để lập phiếu!', 'Thiếu Thông Tin Bàn Giao', 'Kiểm tra lại');
    return;
  }
  const plate = newHandoverPlate.value;
  const driver = newHandoverDriver.value;
  handoverList.value.unshift({
    id: Date.now(),
    vehiclePlate: plate,
    driverName: driver,
    borrowTime: newHandoverBorrowTime.value.replace('T', ' '),
    returnTime: newHandoverReturnTime.value ? newHandoverReturnTime.value.replace('T', ' ') : '—',
    handoverOdo: Number(newHandoverOdo.value) || 0,
    fuelLevel: newHandoverFuel.value,
    conditionNotes: newHandoverNotes.value.trim() || 'Xe bàn giao nguyên trạng hoạt động tốt',
    status: 'Đang mượn',
  });
  mockStorage.saveHandovers(handoverList.value);
  showAddHandoverModal.value = false;
  dialog.showSuccess(`Phiếu bàn giao xe [${plate}] cho tài xế [${driver}] đã được lập thành công!`, 'Lập Phiếu Bàn Giao Thành Công');
}
</script>

<template>
  <div class="fleet-page">
    <div class="page-header">
      <div>
        <h1 class="page-title">Quản Lý Đội Xe & Tài Xế</h1>
        <p class="page-subtitle">Theo dõi tình trạng phương tiện, loại xe, định mức tiêu hao, ODO và hồ sơ tài xế</p>
      </div>
    </div>

    <!-- 1. Bảng Phương tiện -->
    <div v-if="activeTab === 'vehicles'" class="card">
      <div class="card-header flex-between">
        <div>
          <h3 class="card-title">Danh Sách Phương Tiện Đội Xe</h3>
          <p class="text-xs text-muted">Toàn bộ xe tải, xe bán tải công tác và máy đào thuộc quản lý</p>
        </div>
        <button class="btn btn-primary" @click="openAddVehicleModal">
          <Plus :size="16" />
          <span>Thêm Xe Mới</span>
        </button>
      </div>

      <!-- Sub-tabs Phân Loại Xe Công Ty / Thuê Ngoài -->
      <div class="fleet-subtabs-bar">
        <div class="fleet-subtabs-nav">
          <button 
            type="button"
            class="fleet-subtab-btn" 
            :class="{ active: activeVehicleFilter === 'internal' }" 
            @click="activeVehicleFilter = 'internal'"
          >
            <Building2 :size="16" />
            <span>Xe Công Ty</span>
            <span class="fleet-subtab-badge">{{ internalCount }}</span>
          </button>
          <button 
            type="button"
            class="fleet-subtab-btn" 
            :class="{ active: activeVehicleFilter === 'external' }" 
            @click="activeVehicleFilter = 'external'"
          >
            <ExternalLink :size="16" />
            <span>Xe Thuê Ngoài</span>
            <span class="fleet-subtab-badge" :class="{ 'badge-empty': externalCount === 0 }">{{ externalCount }}</span>
          </button>
        </div>
      </div>

      <div class="table-container">
        <table class="table table-fleet">
          <thead>
            <tr>
              <th style="min-width: 105px;">Biển Số Xe</th>
              <th style="min-width: 80px;">Loại Xe</th>
              <th style="min-width: 170px;">Model / Dòng Xe</th>
              <th style="min-width: 155px;">Tài Xế Trực Thuộc</th>
              <th style="min-width: 90px;">Tải Trọng</th>
              <th style="min-width: 80px;">Số Chỗ</th>
              <th style="min-width: 140px;">Định Mức Nhiên Liệu</th>
              <th style="min-width: 155px;">Chỉ Số Vận Hành (ODO)</th>
              <th style="min-width: 110px;">Trạng Thái Xe</th>
              <th style="min-width: 115px;">Chu Kỳ Bảo Dưỡng</th>
              <th class="text-center sticky-action-col" style="min-width: 90px; width: 90px;">Hành Động</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="filteredVehicles.length === 0">
              <td colspan="11" class="text-center py-5">
                <div class="empty-state-subtab">
                  <Truck :size="36" class="text-muted opacity-40 mb-2" />
                  <p class="text-sm text-muted font-medium">Chưa có phương tiện nào thuộc danh mục {{ activeVehicleFilter === 'external' ? 'xe thuê ngoài' : 'xe công ty' }}.</p>
                </div>
              </td>
            </tr>
            <tr v-for="v in filteredVehicles" :key="v.id" class="veh-row">
              <td>
                <button class="btn-plate-link" @click="openVehicleDetail(v)" title="Xem hồ sơ & chi tiết chu kỳ bảo dưỡng xe">
                  <strong>{{ v.licensePlate }}</strong>
                </button>
              </td>
              <td>
                <span class="type-pill">{{ getVehicleTypeLabel(v.vehicleType) }}</span>
                <div v-if="v.teamName" class="text-xs text-muted mt-1 font-medium">{{ v.teamName }}</div>
                <div v-if="v.isExternal" class="text-xs text-primary mt-1 font-medium">Xe ngoài (Thuê/Dịch vụ)</div>
              </td>
              <td>{{ v.model }}</td>
              <td>
                <div v-if="v.assignedDriverName" class="driver-direct-cell">
                  <div class="driver-mini-icon">
                    <UserCheck :size="14" class="text-success" />
                  </div>
                  <div class="driver-mini-info">
                    <strong>{{ v.assignedDriverName }}</strong>
                    <span v-if="v.assignedDriverPhone" class="text-xs text-muted">{{ v.assignedDriverPhone }}</span>
                  </div>
                </div>
                <span v-else class="text-muted text-xs italic">— Chưa phân công —</span>
              </td>
              <td>
                <span v-if="v.capacityTons">{{ v.capacityTons }} Tấn</span>
                <span v-else class="text-muted text-xs">—</span>
              </td>
              <td>
                <span v-if="v.passengerCapacity">{{ v.passengerCapacity }} chỗ</span>
                <span v-else class="text-muted text-xs">—</span>
              </td>
              <td>
                <div v-if="v.vehicleType !== 'MillingMachine'" class="flex-col text-xs">
                  <span>Không tải: <strong>{{ v.fuelQuotaEmpty }} L/km</strong></span>
                  <span>Có tải: <strong>{{ v.fuelQuotaLoaded }} L/t.km</strong></span>
                </div>
                <div v-else class="text-xs">
                  <span>Định mức giờ máy: <strong>{{ v.hourMeterQuota }} L/giờ</strong></span>
                </div>
              </td>
              <td>
                <div v-if="v.vehicleType !== 'MillingMachine'" class="flex-col text-xs">
                  <strong>{{ v.currentOdoKm.toLocaleString() }} km</strong>
                  <span class="text-muted">Lần trước: {{ v.lastMaintenanceOdo.toLocaleString() }} km</span>
                  <span
                    class="font-bold"
                    :class="(v.currentOdoKm - v.lastMaintenanceOdo) >= getThreshold(v) ? 'text-danger' : 'text-success'"
                  >
                    Đã chạy: {{ (v.currentOdoKm - v.lastMaintenanceOdo).toLocaleString() }} km
                    <span v-if="(v.currentOdoKm - v.lastMaintenanceOdo) >= getThreshold(v)" class="badge-overdue-pill">! Cần bảo dưỡng</span>
                  </span>
                </div>
                <div v-else-if="v.isExternal" class="flex-col text-xs text-muted italic">
                  Không áp dụng
                </div>
                <div v-else class="flex-col text-xs">
                  <strong>{{ v.currentOperatingHours || 0 }} giờ</strong>
                  <span class="text-muted">Giờ máy tích lũy</span>
                </div>
              </td>
              <td>
                <span class="veh-status-badge" :class="`status-${v.status.toLowerCase()}`">
                  {{ getVehicleStatusLabel(v.status) }}
                </span>
              </td>
              <td>
                <StatusBadge v-if="!v.isExternal" :status="v.maintenanceStatus" type="maintenance" />
                <span v-else class="text-muted text-xs italic">Miễn bảo trì</span>
              </td>
              <td class="text-center sticky-action-col">
                <div class="actions-group">
                  <button
                    class="btn-action btn-edit"
                    @click="openEditVehicleModal(v)"
                    title="Chỉnh sửa thông số phương tiện"
                  >
                    <Edit2 :size="14" />
                  </button>
                  <button
                    class="btn-action btn-delete"
                    @click="handleDeleteVehicle(v)"
                    title="Xóa phương tiện khỏi đội xe"
                  >
                    <Trash2 :size="14" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 2. Bảng Loại xe (Categories) -->
    <div v-else-if="activeTab === 'types'" class="card">
      <div class="card-header flex-between">
        <div>
          <h3 class="card-title">Danh Sách Loại Xe & Thiết Bị</h3>
          <p class="text-xs text-muted">Quy chuẩn chủng loại xe phục vụ khai thác vận tải mủ và cơ giới nông trường</p>
        </div>
        <div class="flex-actions">
          <router-link to="/fleet/types" class="btn btn-outline btn-sm">
            <ExternalLink :size="14" />
            <span>Mở Trang Chi Tiết</span>
          </router-link>
          <button class="btn btn-primary" @click="openAddCategoryModal">
            <Plus :size="16" />
            <span>Thêm Loại Xe Mới</span>
          </button>
        </div>
      </div>

      <div class="table-container">
        <table class="table table-fleet">
          <thead>
            <tr>
              <th style="min-width: 120px;">Mã Loại Xe</th>
              <th style="min-width: 180px;">Tên Loại Xe</th>
              <th style="min-width: 140px;">Nhóm Phương Tiện</th>
              <th style="min-width: 220px;">Mô Tả / Đặc Điểm</th>
              <th style="min-width: 140px;">Số Lượng Xe Đang Dùng</th>
              <th style="min-width: 100px;">Trạng Thái</th>
              <th class="text-center sticky-action-col" style="min-width: 90px; width: 90px;">Hành Động</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="cat in fleetStore.vehicleCategories" :key="cat.id">
              <td><strong><code>{{ cat.code }}</code></strong></td>
              <td><strong>{{ cat.name }}</strong></td>
              <td><span class="type-pill">{{ cat.group }}</span></td>
              <td>
                <span class="text-sm text-secondary">{{ cat.description || '—' }}</span>
              </td>
              <td>
                <span class="badge badge-completed">
                  {{ countVehiclesForCat(cat) }} phương tiện
                </span>
              </td>
              <td>
                <span class="driver-status-badge" :class="cat.isActive ? 'status-active' : 'status-suspended'">
                  {{ cat.isActive ? 'Hoạt động' : 'Tạm dừng' }}
                </span>
              </td>
              <td class="text-center sticky-action-col">
                <div class="actions-group">
                  <button
                    class="btn-action btn-edit"
                    @click="openEditCategoryModal(cat)"
                    title="Chỉnh sửa loại xe"
                  >
                    <Edit2 :size="14" />
                  </button>
                  <button
                    class="btn-action btn-delete"
                    @click="handleDeleteCategory(cat)"
                    title="Xóa loại xe"
                  >
                    <Trash2 :size="14" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 3. Bảng Tài xế -->
    <div v-else-if="activeTab === 'drivers'" class="card">
      <div class="card-header flex-between">
        <div>
          <h3 class="card-title">Danh Sách Tài Xế</h3>
          <p class="text-xs text-muted">Danh sách tài xế cơ hữu, hạng giấy phép lái xe và trạng thái sẵn sàng nhận chuyến</p>
        </div>
        <button class="btn btn-primary" @click="openAddDriverModal">
          <Plus :size="16" />
          <span>Thêm Tài Xế Mới</span>
        </button>
      </div>

      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th>Mã NV</th>
              <th>Họ Và Tên</th>
              <th>Số Điện Thoại</th>
              <th>Số Giấy Phép Lái Xe</th>
              <th>Hạng Bằng Lái</th>
              <th>Ngày Hết Hạn</th>
              <th>Tình Trạng Hoạt Động</th>
              <th>Trạng Thái Chuyến</th>
              <th class="text-center sticky-action-col" style="min-width: 90px; width: 90px;">Hành Động</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="d in fleetStore.drivers" :key="d.id">
              <td>
                <button
                  class="btn-code-link"
                  @click="openDriverDetail(d)"
                  title="Bấm để xem hồ sơ chi tiết tài xế"
                >
                  <span class="employee-code-badge">
                    {{ d.employeeCode || `NV-${String(d.id).padStart(4, '0')}` }}
                  </span>
                </button>
              </td>
              <td><strong>{{ d.fullName }}</strong></td>
              <td>{{ d.phone }}</td>
              <td>{{ d.licenseNumber }}</td>
              <td><span class="license-tag">{{ d.licenseClass }}</span></td>
              <td>
                <span>{{ d.licenseExpiryDate }}</span>
              </td>
              <td>
                <span class="driver-status-badge" :class="`status-${d.employmentStatus.toLowerCase()}`">
                  {{ getDriverEmploymentStatusLabel(d.employmentStatus) }}
                </span>
              </td>
              <td>
                <span class="badge" :class="d.isCurrentlyOnTrip ? 'badge-dispatched' : 'badge-completed'">
                  {{ d.isCurrentlyOnTrip ? 'Đang chạy chuyến' : 'Đang rảnh' }}
                </span>
              </td>
              <td class="text-center sticky-action-col">
                <div class="actions-group">
                  <button
                    class="btn-action btn-edit"
                    @click="openEditDriverModal(d)"
                    title="Chỉnh sửa hồ sơ tài xế"
                  >
                    <Edit2 :size="14" />
                  </button>
                  <button
                    class="btn-action btn-delete"
                    @click="handleDeleteDriver(d)"
                    title="Xóa tài xế"
                  >
                    <Trash2 :size="14" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 4. Bảng Bàn giao xe (US-28) -->
    <div v-else class="card">
      <div class="card-header flex-between">
        <div>
          <h3 class="card-title">Nhật Ký Bàn Giao & Mượn Trả Xe</h3>
          <p class="text-xs text-muted">Biên bản bàn giao hiện trạng, mượn trả chìa khóa và kiểm tra chỉ số ODO, xăng dầu</p>
        </div>
        <button class="btn btn-primary" @click="showAddHandoverModal = true">
          <Plus :size="16" />
          <span>Lập Phiếu Bàn Giao</span>
        </button>
      </div>

      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th>Phương Tiện</th>
              <th>Người Nhận / Tài Xế</th>
              <th>Thời Điểm Mượn</th>
              <th>Thời Điểm Trả</th>
              <th>ODO Bàn Giao</th>
              <th>Mức Nhiên Liệu</th>
              <th>Biên Bản Hiện Trạng Xe</th>
              <th>Tình Trạng</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="h in handoverList" :key="h.id">
              <td><strong>{{ h.vehiclePlate }}</strong></td>
              <td>{{ h.driverName }}</td>
              <td>{{ h.borrowTime }}</td>
              <td>{{ h.returnTime }}</td>
              <td><strong>{{ h.handoverOdo.toLocaleString() }} km</strong></td>
              <td><span class="badge badge-completed">{{ h.fuelLevel }}</span></td>
              <td class="text-sm text-secondary">{{ h.conditionNotes }}</td>
              <td>
                <span class="badge" :class="h.status === 'Đang mượn' ? 'badge-dispatched' : 'badge-completed'">
                  {{ h.status }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal 1: Thêm xe -->
    <div v-if="showAddVehModal" class="modal-backdrop" @click.self="showAddVehModal = false">
      <div class="modal-content">
        <div class="modal-header">
          <h3 class="modal-title">{{ editingVehicle ? 'Chỉnh Sửa Phương Tiện' : 'Thêm Phương Tiện Mới' }}</h3>
        </div>
        <div class="modal-body">
          <div class="grid-2">
            <div class="form-group">
              <label class="form-label">Biển số xe <span class="required">*</span></label>
              <input v-model="newVehPlate" type="text" class="form-input" placeholder="Ví dụ: 51C-999.88" />
            </div>
            <div class="form-group">
              <label class="form-label">Loại xe</label>
              <select v-model="newVehType" class="form-select">
                <option
                  v-for="cat in fleetStore.vehicleCategories.filter((c) => c.isActive)"
                  :key="cat.id"
                  :value="cat.vehicleTypeCode"
                >
                  {{ cat.name }} ({{ cat.group }})
                </option>
              </select>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Tên dòng xe / Model <span class="required">*</span></label>
            <input v-model="newVehModel" type="text" class="form-input" placeholder="Ví dụ: Hino 500 thùng mủ..." />
          </div>

          <div v-if="newVehType === 'PassengerCar'" class="form-group">
            <label class="checkbox-label" style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
              <input type="checkbox" v-model="newVehIsExternal" />
              <span>Là xe ngoài / thuê dịch vụ (Không yêu cầu bảo trì)</span>
            </label>
          </div>

          <div class="grid-2">
            <div class="form-group">
              <label class="form-label">Tải trọng (Tấn)</label>
              <input v-model.number="newVehCapacity" type="number" step="0.5" class="form-input" />
            </div>
            <div class="form-group">
              <label class="form-label">Số chỗ ngồi</label>
              <input v-model.number="newVehSeats" type="number" step="1" class="form-input" />
            </div>
          </div>

          <div class="grid-2">
            <div class="form-group">
              <label class="form-label">NLP (L/km)</label>
              <input v-model.number="newVehEmptyQuota" type="number" step="0.01" class="form-input" />
            </div>
            <div class="form-group">
              <label class="form-label">NLC (L/tấn.km)</label>
              <input v-model.number="newVehLoadedQuota" type="number" step="0.005" class="form-input" />
            </div>
          </div>

          <div class="grid-2">
            <div class="form-group">
              <label class="form-label">Chỉ số ODO hiện tại (km)</label>
              <input v-model.number="newVehOdo" type="number" class="form-input" />
            </div>
            <div class="form-group">
              <label class="form-label">Tài xế trực thuộc / Phụ trách chính</label>
              <select v-model="newVehDriverId" class="form-select">
                <option :value="''">-- Chưa gán tài xế / Chọn sau --</option>
                <option v-for="d in fleetStore.drivers" :key="d.id" :value="d.id">
                  {{ d.fullName }} ({{ d.licenseClass }} - SĐT: {{ d.phone }})
                </option>
              </select>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn btn-secondary" @click="showAddVehModal = false">Hủy</button>
          <button class="btn btn-primary" @click="handleSaveVehicle">
            {{ editingVehicle ? 'Lưu Thay Đổi' : 'Lưu Phương Tiện' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Modal 2: Thêm / Sửa loại xe -->
    <div v-if="showAddCatModal" class="modal-backdrop" @click.self="showAddCatModal = false">
      <div class="modal-content">
        <div class="modal-header">
          <h3 class="modal-title">{{ editingCategory ? 'Chỉnh Sửa Loại Xe / Thiết Bị' : 'Thêm Loại Xe / Thiết Bị Mới' }}</h3>
        </div>
        <div class="modal-body">
          <div class="grid-2">
            <div class="form-group">
              <label class="form-label">Mã loại xe <span class="required">*</span></label>
              <input v-model="newCatCode" type="text" class="form-input" placeholder="Ví dụ: TRUCK_10T" :readonly="!!editingCategory" />
            </div>
            <div class="form-group">
              <label class="form-label">Nhóm chuyên dụng <span class="required">*</span></label>
              <select v-model="newCatGroup" class="form-select">
                <option value="Vận tải mủ">Vận tải mủ</option>
                <option value="Cơ giới nông trường">Cơ giới nông trường</option>
                <option value="Công tác & Kỹ thuật">Công tác & Kỹ thuật</option>
              </select>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Tên loại xe <span class="required">*</span></label>
            <input v-model="newCatName" type="text" class="form-input" placeholder="Ví dụ: Xe bồn chở mủ cao su 10 tấn" />
          </div>

          <div class="form-group">
            <label class="form-label">Mô tả / Ghi chú</label>
            <textarea v-model="newCatDesc" class="form-input" rows="3" placeholder="Ghi chú về mục đích sử dụng, đặc điểm kỹ thuật..."></textarea>
          </div>

          <div class="form-group">
            <label class="checkbox-label" style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
              <input type="checkbox" v-model="newCatIsActive" />
              <span>Kích hoạt loại xe này trong hệ thống</span>
            </label>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn btn-secondary" @click="showAddCatModal = false">Hủy</button>
          <button class="btn btn-primary" @click="handleSaveCategory">
            {{ editingCategory ? 'Lưu Thay Đổi' : 'Lưu Loại Xe' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Modal 3: Thêm / Sửa tài xế -->
    <div v-if="showAddDriverModal" class="modal-backdrop" @click.self="showAddDriverModal = false">
      <div class="modal-content">
        <div class="modal-header">
          <h3 class="modal-title">{{ editingDriver ? 'Chỉnh Sửa Hồ Sơ Tài Xế' : 'Thêm Tài Xế Mới' }}</h3>
        </div>
        <div class="modal-body">
          <div class="grid-2">
            <div class="form-group">
              <label class="form-label">Mã nhân viên (Mã NV)</label>
              <input
                v-model="newDriverEmployeeCode"
                type="text"
                class="form-input font-mono"
                placeholder="Ví dụ: NV-0105"
                style="text-transform: uppercase"
              />
            </div>
            <div class="form-group">
              <label class="form-label">Họ và tên tài xế <span class="required">*</span></label>
              <input v-model="newDriverName" type="text" class="form-input" placeholder="Ví dụ: Nguyễn Văn Hải" />
            </div>
          </div>

          <div class="grid-2">
            <div class="form-group">
              <label class="form-label">Số điện thoại <span class="required">*</span></label>
              <input v-model="newDriverPhone" type="text" class="form-input" placeholder="Ví dụ: 0912 345 678" />
            </div>
            <div class="form-group">
              <label class="form-label">Số giấy phép lái xe (GPLX) <span class="required">*</span></label>
              <input v-model="newDriverLicenseNum" type="text" class="form-input" placeholder="Ví dụ: C-790123456" />
            </div>
          </div>

          <div class="grid-2">
            <div class="form-group">
              <label class="form-label">Hạng bằng lái</label>
              <select v-model="newDriverLicenseClass" class="form-select">
                <option value="Hạng C">Hạng C (Xe tải từ 3.5 tấn trở lên)</option>
                <option value="Hạng B2">Hạng B2 (Xe dưới 9 chỗ, xe tải dưới 3.5 tấn)</option>
                <option value="Hạng D">Hạng D (Xe chở người từ 10-30 chỗ)</option>
                <option value="Hạng E">Hạng E (Xe chở người trên 30 chỗ)</option>
                <option value="Hạng FC">Hạng FC (Xe đầu kéo rơ-moóc)</option>
                <option value="Chứng chỉ vận hành xe máy chuyên dùng">Chứng chỉ vận hành xe máy chuyên dùng</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Ngày hết hạn bằng lái</label>
              <input v-model="newDriverLicenseExpiry" type="date" class="form-input" />
            </div>
          </div>

          <div class="form-group mt-3">
            <label class="form-label">Tình trạng hoạt động</label>
            <select v-model="newDriverStatus" class="form-select">
              <option value="Active">Đang làm việc</option>
              <option value="OnLeave">Nghỉ phép</option>
              <option value="Suspended">Tạm đình chỉ</option>
            </select>
          </div>

          <div class="form-group mt-3">
            <label class="form-label">Ảnh giấy phép lái xe</label>
            <input type="file" @change="handleLicenseUpload" accept="image/*" class="form-input" />
            <div v-if="newDriverLicenseImageUrl" class="mt-2 p-2 bg-light rounded border text-center">
              <img :src="newDriverLicenseImageUrl" alt="License preview" style="max-height: 160px; max-width: 100%; object-fit: contain;" />
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn btn-secondary" @click="showAddDriverModal = false">Hủy</button>
          <button class="btn btn-primary" @click="handleSaveDriver">
            {{ editingDriver ? 'Lưu Thay Đổi' : 'Lưu Hồ Sơ Tài Xế' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Modal 4: Lập phiếu bàn giao xe -->
    <div v-if="showAddHandoverModal" class="modal-backdrop" @click.self="showAddHandoverModal = false">
      <div class="modal-content">
        <div class="modal-header">
          <h3 class="modal-title">Lập Phiếu Bàn Giao & Mượn Trả Xe</h3>
        </div>
        <div class="modal-body">
          <div class="grid-2">
            <div class="form-group">
              <label class="form-label">Phương tiện bàn giao <span class="required">*</span></label>
              <select v-model="newHandoverPlate" class="form-select">
                <option v-for="v in fleetStore.vehicles" :key="v.id" :value="v.licensePlate">
                  {{ v.licensePlate }} - {{ v.model }} ({{ v.vehicleType }})
                </option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Người nhận / Tài xế <span class="required">*</span></label>
              <select v-model="newHandoverDriver" class="form-select">
                <option v-for="d in fleetStore.drivers" :key="d.id" :value="d.fullName">
                  {{ d.fullName }} ({{ d.licenseClass }})
                </option>
              </select>
            </div>
          </div>

          <div class="grid-2">
            <div class="form-group">
              <label class="form-label">Thời điểm bàn giao / mượn</label>
              <input v-model="newHandoverBorrowTime" type="datetime-local" class="form-input" />
            </div>
            <div class="form-group">
              <label class="form-label">Thời điểm trả dự kiến</label>
              <input v-model="newHandoverReturnTime" type="datetime-local" class="form-input" />
            </div>
          </div>

          <div class="grid-2">
            <div class="form-group">
              <label class="form-label">Chỉ số ODO lúc bàn giao (km)</label>
              <input v-model.number="newHandoverOdo" type="number" class="form-input" />
            </div>
            <div class="form-group">
              <label class="form-label">Mức nhiên liệu hiện tại</label>
              <select v-model="newHandoverFuel" class="form-select">
                <option value="100%">100% (Đầy bình)</option>
                <option value="90%">90%</option>
                <option value="80%">80%</option>
                <option value="70%">70%</option>
                <option value="50%">50% (Nửa bình)</option>
                <option value="30%">30%</option>
              </select>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Biên bản hiện trạng xe</label>
            <textarea
              v-model="newHandoverNotes"
              class="form-input"
              rows="2"
              placeholder="Ghi nhận hiện trạng vỏ xe, gương, đèn, giấy tờ xe..."
            ></textarea>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn btn-secondary" @click="showAddHandoverModal = false">Hủy</button>
          <button class="btn btn-primary" @click="handleAddHandover">Lập Biên Bản Bàn Giao</button>
        </div>
      </div>
    </div>

    <!-- Modal 5: Phân công tài xế -->
    <div v-if="showAssignDriverModal" class="modal-backdrop" @click.self="showAssignDriverModal = false">
      <div class="modal-content">
        <div class="modal-header">
          <h3 class="modal-title">Phân Công Tài Xế</h3>
        </div>
        <div class="modal-body">
          <div class="form-group" v-if="assignVehicle">
            <label class="form-label">Phương tiện đang chọn</label>
            <div class="p-3 bg-light rounded font-bold text-lg" style="margin-top: 8px;">
              {{ assignVehicle.licensePlate }} - {{ assignVehicle.model }}
            </div>
          </div>
          
          <div class="form-group mt-3" style="margin-top: 1rem;">
            <label class="form-label">Chọn Tài xế phụ trách <span class="required">*</span></label>
            <select v-model="assignDriverId" class="form-select">
              <option :value="''">-- Bỏ trống (Xe không có tài xế) --</option>
              <option v-for="d in fleetStore.drivers" :key="d.id" :value="d.id">
                {{ d.fullName }} ({{ d.licenseClass }} - SĐT: {{ d.phone }})
              </option>
            </select>
          </div>
          
          <div class="form-group mt-3" style="margin-top: 1rem;">
            <label class="form-label">Ghi chú phân công / Bàn giao</label>
            <textarea 
              v-model="assignNotes" 
              class="form-input" 
              rows="3" 
              placeholder="Nhập lý do đổi tài xế, tình trạng xe lúc bàn giao..."
            ></textarea>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn btn-secondary" @click="showAssignDriverModal = false">Hủy</button>
          <button class="btn btn-primary" @click="handleSaveAssignment">Lưu Phân Công</button>
        </div>
      </div>
    </div>

    <!-- Modal Xem Chi Tiết Xe & Chu Kỳ Bảo Dưỡng (Section 4 - baoduong.md) -->
    <VehicleDetailModal
      v-if="selectedVehicleForDetail"
      :vehicle="selectedVehicleForDetail"
      @close="selectedVehicleForDetail = null"
      @edit="openEditVehicleModal"
    />

    <!-- Modal Xem Chi Tiết Hồ Sơ Tài Xế -->
    <DriverDetailModal
      v-if="selectedDriverForDetail"
      :driver="selectedDriverForDetail"
      @close="selectedDriverForDetail = null"
      @edit="openEditDriverModal"
    />
  </div>
</template>

<style scoped>
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 12px;
}
.page-title {
  font-size: 1.375rem;
  font-weight: 800;
}
.page-subtitle {
  font-size: 0.8125rem;
  color: var(--text-secondary);
}
.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}
.tab-toggle {
  display: flex;
  background: #e2e8f0;
  padding: 3px;
  border-radius: var(--radius-sm);
}
.toggle-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  border: none;
  background: transparent;
  padding: 6px 14px;
  font-size: 0.8125rem;
  font-weight: 600;
  border-radius: 4px;
  cursor: pointer;
  color: var(--text-secondary);
  transition: all 0.2s;
}
.toggle-btn.active {
  background: white;
  color: var(--text-primary);
  box-shadow: var(--shadow-sm);
}
.table th,
.table td {
  white-space: nowrap;
  vertical-align: middle;
}
.type-pill {
  background: #f1f5f9;
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  white-space: nowrap;
  display: inline-block;
}
.license-tag {
  background: #e0e7ff;
  color: #4338ca;
  font-size: 0.75rem;
  font-weight: 700;
  padding: 3px 10px;
  border-radius: 4px;
  white-space: nowrap;
  display: inline-block;
}
.driver-status-badge {
  font-size: 0.75rem;
  font-weight: 700;
  padding: 4px 12px;
  border-radius: 12px;
  white-space: nowrap;
  display: inline-block;
}
.driver-status-badge.status-active { background: #dcfce7; color: #15803d; }
.driver-status-badge.status-onleave { background: #fef3c7; color: #b45309; }
.driver-status-badge.status-suspended { background: #fee2e2; color: #b91c1c; }

.veh-status-badge {
  font-size: 0.75rem;
  padding: 4px 12px;
  border-radius: 12px;
  font-weight: 700;
  white-space: nowrap;
  display: inline-block;
}
.veh-status-badge.status-available { background: #dcfce7; color: #15803d; }
.veh-status-badge.status-ontrip { background: #e0f2fe; color: #0369a1; }
.veh-status-badge.status-undermaintenance { background: #fee2e2; color: #b91c1c; }

.flex-between {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.btn-plate-link {
  background: transparent;
  border: none;
  padding: 0;
  cursor: pointer;
  color: #15803d;
  text-decoration: underline;
  text-underline-offset: 3px;
  font-size: 0.875rem;
  display: inline-block;
  text-align: left;
}
.btn-plate-link:hover {
  color: #166534;
}

/* Driver direct cell */
.driver-direct-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}
.driver-mini-icon {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.driver-mini-info {
  display: flex;
  flex-direction: column;
  line-height: 1.25;
}

.badge-overdue-pill {
  background: #fee2e2;
  color: #dc2626;
  font-size: 0.6875rem;
  font-weight: 800;
  padding: 1px 6px;
  border-radius: 4px;
  margin-left: 4px;
  display: inline-block;
}

.flex-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn-sm {
  padding: 6px 12px;
  font-size: 0.8125rem;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.btn-outline {
  background: white;
  border: 1px solid #cbd5e1;
  color: #334155;
  border-radius: 6px;
  text-decoration: none;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-outline:hover {
  background: #f8fafc;
  border-color: #94a3b8;
  color: #0f172a;
}

.flex-col { display: flex; flex-direction: column; }
.text-xs { font-size: 0.75rem; }
.text-muted { color: var(--text-muted); }
.required { color: #ef4444; }

.actions-group {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.btn-action {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: 1px solid #cbd5e1;
  background: #ffffff;
  color: #475569;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s;
}
.btn-action:hover {
  background: #f8fafc;
  color: #0f172a;
}
.btn-edit:hover { border-color: #0284c7; color: #0284c7; }
.btn-delete:hover { border-color: #dc2626; color: #dc2626; }
.btn-code-link {
  background: transparent;
  border: none;
  padding: 0;
  cursor: pointer;
  text-align: left;
}

.employee-code-badge {
  display: inline-block;
  font-family: monospace;
  font-size: 0.75rem;
  font-weight: 700;
  background: #f0fdf4;
  color: #15803d;
  border: 1px solid #bbf7d0;
  padding: 3px 8px;
  border-radius: 4px;
  transition: all 0.15s;
}
.btn-code-link:hover .employee-code-badge {
  background: #dcfce7;
  border-color: #86efac;
  box-shadow: 0 0 0 2px rgba(21, 128, 61, 0.15);
  transform: translateY(-1px);
}

/* Sticky Action Column */
.table th.sticky-action-col,
.table td.sticky-action-col {
  position: sticky !important;
  right: 0 !important;
  background-color: #ffffff !important;
  z-index: 4;
  box-shadow: -4px 0 10px rgba(15, 23, 42, 0.08);
}
.table th.sticky-action-col {
  background-color: #f8fafc !important;
  z-index: 5;
}
.table tbody tr:hover td.sticky-action-col {
  background-color: #f8fafc !important;
}

/* Compact fleet table styling */
.table-fleet th {
  padding: 10px 12px;
  font-size: 0.6875rem;
}
.table-fleet td {
  padding: 10px 12px;
  font-size: 0.8125rem;
}

/* Sub-tabs Xe Công Ty / Xe Thuê Ngoài */
/* Sub-tabs Xe Công Ty / Xe Thuê Ngoài - Centered & Prominent */
.fleet-subtabs-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px 20px;
  background: #f8fafc;
  border-bottom: 1px solid var(--border-card, #d6e4d7);
}

.fleet-subtabs-nav {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #e2e8f0;
  padding: 4px;
  border-radius: 12px;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.06);
}

.fleet-subtab-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 24px;
  font-size: 0.875rem;
  font-weight: 600;
  border: none;
  background: transparent;
  color: #475569;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  font-family: inherit;
}

.fleet-subtab-btn:hover:not(.active) {
  color: #0f172a;
  background: rgba(255, 255, 255, 0.6);
}

.fleet-subtab-btn.active {
  background: #ffffff;
  color: var(--primary, #15803d);
  font-weight: 700;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.04);
}

.fleet-subtab-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 20px;
  padding: 0 7px;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 700;
  background: #cbd5e1;
  color: #334155;
  transition: all 0.2s ease;
}

.fleet-subtab-btn.active .fleet-subtab-badge {
  background: #dcfce7;
  color: #15803d;
  border: 1px solid #bbf7d0;
}

.fleet-subtab-badge.badge-empty {
  opacity: 0.6;
}

.empty-state-subtab {
  padding: 36px 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
</style>
