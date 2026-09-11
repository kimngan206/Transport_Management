<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useFleetStore } from '@/stores/fleet';
import { useDispatchStore } from '@/stores/dispatch';
import { useDialogStore } from '@/stores/dialog';
import { getVehicleDailyTrips, getDriverDailyTrips } from '@/utils/tripHelpers';
import { mockStorage } from '@/services/mockStorage';
import type {
  Vehicle,
  Driver,
  VehicleCategory,
  HandoverRecord,
  HandoverStatus,
  HandoverWorkflowType,
  HandoverChecklist,
  HandoverReasonType,
} from '@/types';
import { initialHandovers } from '@/mocks';
import StatusBadge from '@/components/common/StatusBadge.vue';
import TablePagination from '@/components/common/TablePagination.vue';
import FormulaBuilder from '@/components/common/FormulaBuilder.vue';
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
  Info,
  CheckCircle2,
  Search,
  Filter,
  X,
  RotateCcw,
  AlertTriangle,
  ArrowRightLeft,
  FileText,
  Check,
  ShieldCheck,
  CheckSquare,
  Square,
  Clock,
  ClipboardCheck,
} from 'lucide-vue-next';

const route = useRoute();
const authStore = useAuthStore();
const fleetStore = useFleetStore();
const dispatchStore = useDispatchStore();
const dialog = useDialogStore();
const activeTab = ref<'vehicles' | 'types' | 'drivers' | 'handover'>('vehicles');
const activeVehicleFilter = ref<'internal' | 'external'>('internal');
const filterUnitType = ref<'ALL' | 'Team' | 'Factory'>('ALL');

const todayDateStr = computed(() => new Date().toISOString().slice(0, 10));

function getVehicleTodayTrips(vehicleId: number) {
  const todayTrips = getVehicleDailyTrips(vehicleId, todayDateStr.value, dispatchStore.trips);
  if (todayTrips.length > 0) return todayTrips;
  // Fallback nếu mock data chạy trên ngày khác
  const allVehicleTrips = dispatchStore.trips.filter((t) => t.vehicleId === vehicleId && t.status !== 'CANCELLED');
  if (allVehicleTrips.length === 0) return [];
  const latestDate = allVehicleTrips[0].scheduledStartTime.slice(0, 10);
  return getVehicleDailyTrips(vehicleId, latestDate, dispatchStore.trips);
}

function getDriverTodayTrips(driverId: number) {
  const todayTrips = getDriverDailyTrips(driverId, todayDateStr.value, dispatchStore.trips);
  if (todayTrips.length > 0) return todayTrips;
  const allDriverTrips = dispatchStore.trips.filter((t) => t.driverId === driverId && t.status !== 'CANCELLED');
  if (allDriverTrips.length === 0) return [];
  const latestDate = allDriverTrips[0].scheduledStartTime.slice(0, 10);
  return getDriverDailyTrips(driverId, latestDate, dispatchStore.trips);
}

const internalCount = computed(() => fleetStore.vehicles.filter(v => !v.isExternal).length);
const externalCount = computed(() => fleetStore.vehicles.filter(v => v.isExternal).length);

const filteredVehicles = computed(() => {
  let list = activeVehicleFilter.value === 'external'
    ? fleetStore.vehicles.filter(v => v.isExternal)
    : fleetStore.vehicles.filter(v => !v.isExternal);

  if (filterUnitType.value !== 'ALL') {
    list = list.filter(v => {
      const unit = v.operatingUnitType || (v.teamName ? 'Team' : 'Factory');
      return unit === filterUnitType.value;
    });
  }
  return list;
});

// Phân trang danh sách phương tiện
const vehCurrentPage = ref(1);
const vehPageSize = ref(8);
const paginatedVehicles = computed(() => {
  const start = (vehCurrentPage.value - 1) * vehPageSize.value;
  return filteredVehicles.value.slice(start, start + vehPageSize.value);
});
watch([activeVehicleFilter, filterUnitType], () => {
  vehCurrentPage.value = 1;
});

// Phân trang danh sách tài xế
const driverCurrentPage = ref(1);
const driverPageSize = ref(8);
const paginatedDrivers = computed(() => {
  const start = (driverCurrentPage.value - 1) * driverPageSize.value;
  return fleetStore.drivers.slice(start, start + driverPageSize.value);
});

// Phân trang danh sách bàn giao
const handoverCurrentPage = ref(1);
const handoverPageSize = ref(8);

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

function openDriverDetailByName(fullName?: string) {
  if (!fullName) return;

  const driver = fleetStore.drivers.find((d) => d.fullName === fullName);
  if (driver) {
    openDriverDetail(driver);
  }
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

// Danh sách bàn giao mượn trả & điều chuyển xe
const defaultHandovers: HandoverRecord[] = initialHandovers;
const handoverList = ref<HandoverRecord[]>(mockStorage.getHandovers(defaultHandovers));
const handoverStatusFilter = ref<'ALL' | HandoverStatus>('ALL');
const searchHandoverKeyword = ref('');
const handoverSectionTab = ref<'BORROW_RETURN' | 'TRANSFER' | 'DRIVER_HANDOVER'>('BORROW_RETURN');
const isDriverRole = computed(() => authStore.activeRole === 'Driver');
const isDispatcherRole = computed(() => authStore.activeRole === 'Dispatcher' || authStore.activeRole === 'Admin');
const currentDriverId = computed(() => authStore.currentUser.driverId ?? null);

const visibleHandovers = computed(() => {
  if (!isDriverRole.value) {
    return handoverList.value;
  }

  return handoverList.value.filter((h) => {
    if (!currentDriverId.value) {
      return h.driverName === authStore.currentUser.fullName || h.toDriverName === authStore.currentUser.fullName;
    }

    return (
      h.toDriverId === currentDriverId.value ||
      h.fromDriverId === currentDriverId.value ||
      h.driverName === authStore.currentUser.fullName ||
      h.toDriverName === authStore.currentUser.fullName
    );
  });
});

const tabHandovers = computed(() => {
  return visibleHandovers.value.filter((h) => {
    const wf = h.workflowType ?? 'BORROW_RETURN';
    if (handoverSectionTab.value === 'BORROW_RETURN') {
      return wf === 'BORROW_RETURN' || (wf === 'HANDOVER' && !h.handoverChecklist && !h.toDriverId);
    }
    if (handoverSectionTab.value === 'TRANSFER') {
      return wf === 'TRANSFER';
    }
    if (handoverSectionTab.value === 'DRIVER_HANDOVER') {
      return wf === 'DRIVER_HANDOVER' || (wf === 'HANDOVER' && (!!h.handoverChecklist || !!h.toDriverId));
    }
    return false;
  });
});

const filteredHandovers = computed(() => {
  let result = tabHandovers.value;

  if (handoverStatusFilter.value !== 'ALL') {
    result = result.filter((h) => h.status === handoverStatusFilter.value);
  }

  if (searchHandoverKeyword.value.trim()) {
    const q = searchHandoverKeyword.value.trim().toLowerCase();
    result = result.filter((h) => {
      return (
        h.vehiclePlate?.toLowerCase().includes(q) ||
        h.driverName?.toLowerCase().includes(q) ||
        h.fromDriverName?.toLowerCase().includes(q) ||
        h.toDriverName?.toLowerCase().includes(q) ||
        h.fromTeam?.toLowerCase().includes(q) ||
        h.toTeam?.toLowerCase().includes(q) ||
        h.fromManagerName?.toLowerCase().includes(q) ||
        h.toManagerName?.toLowerCase().includes(q) ||
        h.decisionNumber?.toLowerCase().includes(q) ||
        h.transferReason?.toLowerCase().includes(q) ||
        h.conditionNotes?.toLowerCase().includes(q) ||
        h.note?.toLowerCase().includes(q)
      );
    });
  }

  return result;
});

const paginatedHandovers = computed(() => {
  const start = (handoverCurrentPage.value - 1) * handoverPageSize.value;
  return filteredHandovers.value.slice(start, start + handoverPageSize.value);
});

watch([handoverSectionTab, handoverStatusFilter, searchHandoverKeyword], () => {
  handoverCurrentPage.value = 1;
});

const handoverSummary = computed(() => {
  const list = tabHandovers.value;
  if (handoverSectionTab.value === 'BORROW_RETURN') {
    return {
      total: list.length,
      stat1Label: 'Đang mượn',
      stat1Val: list.filter((h) => h.status === 'BORROWING').length,
      stat2Label: 'Đã hoàn trả',
      stat2Val: list.filter((h) => h.status === 'RETURNED').length,
      stat3Label: 'Quá hạn trả',
      stat3Val: list.filter((h) => h.status === 'OVERDUE').length,
      stat4Label: 'Tổng lượt mượn',
      stat4Val: list.length,
    };
  }
  if (handoverSectionTab.value === 'TRANSFER') {
    const uniqueUnits = new Set(list.map((h) => h.toTeam).filter(Boolean));
    return {
      total: list.length,
      stat1Label: 'Đã điều chuyển',
      stat1Val: list.filter((h) => h.status === 'RETURNED' || h.status === 'BORROWING').length,
      stat2Label: 'Đơn vị tiếp nhận',
      stat2Val: uniqueUnits.size,
      stat3Label: 'Có số quyết định',
      stat3Val: list.filter((h) => !!h.decisionNumber).length,
      stat4Label: 'Tổng lệnh điều chuyển',
      stat4Val: list.length,
    };
  }
  return {
    total: list.length,
    stat1Label: 'Đã bàn giao',
    stat1Val: list.filter((h) => h.status === 'RETURNED').length,
    stat2Label: 'Chờ nhận xe',
    stat2Val: list.filter((h) => h.status === 'BORROWING').length,
    stat3Label: 'Nghỉ việc / Hoán đổi',
    stat3Val: list.filter((h) => h.handoverReasonType === 'RESIGNATION' || h.handoverReasonType === 'DRIVER_SWAP').length,
    stat4Label: 'Tổng biên bản bàn giao',
    stat4Val: list.length,
  };
});

function resetHandoverFilters() {
  handoverStatusFilter.value = 'ALL';
  searchHandoverKeyword.value = '';
  handoverCurrentPage.value = 1;
}

function syncVehicleStatusFromHandover(record: HandoverRecord) {
  const vehicle = fleetStore.vehicles.find((v) => v.licensePlate === record.vehiclePlate);
  if (!vehicle) return;

  const workflowType = record.workflowType ?? 'BORROW_RETURN';

  if (workflowType === 'TRANSFER') {
    if (record.toTeam) {
      vehicle.teamName = record.toTeam;
      vehicle.operatingUnitType = record.toTeam.includes('Nhà máy') ? 'Factory' : 'Team';
      fleetStore.updateVehicle(vehicle);
    }
    return;
  }

  if (workflowType === 'DRIVER_HANDOVER') {
    if (record.toDriverId) {
      vehicle.assignedDriverId = record.toDriverId;
    }
    if (record.toDriverName || record.driverName) {
      vehicle.assignedDriverName = record.toDriverName || record.driverName;
    }
    fleetStore.updateVehicle(vehicle);
  }
}

function syncVehicleStatusesFromHandovers() {
  handoverList.value.forEach((record) => {
    syncVehicleStatusFromHandover(record);
  });
}

function handleDriverReceiveHandover(record: HandoverRecord) {
  const receiveMessage = `Đã xác nhận nhận xe lúc ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`;

  handoverList.value = handoverList.value.map((h) => {
    if (h.id !== record.id) return h;
    const nextNote = h.note ? `${h.note}\n${receiveMessage}` : receiveMessage;
    return {
      ...h,
      status: 'RETURNED',
      note: nextNote,
    };
  });

  mockStorage.saveHandovers(handoverList.value);
  syncVehicleStatusFromHandover({ ...record, status: 'RETURNED' });
  dialog.showSuccess(`Bạn đã xác nhận nhận xe [${record.vehiclePlate}] thành công.`, 'Xác nhận nhận xe');
}

syncVehicleStatusesFromHandovers();

function getHandoverStatusLabel(status: HandoverStatus, workflowType?: HandoverWorkflowType): string {
  switch (status) {
    case 'BORROWING':
      if (workflowType === 'BORROW_RETURN') return 'Đang mượn';
      if (workflowType === 'TRANSFER') return 'Chờ tiếp nhận';
      return 'Chờ nhận xe';
    case 'RETURNED':
      if (workflowType === 'BORROW_RETURN') return 'Đã hoàn trả';
      if (workflowType === 'TRANSFER') return 'Đã điều chuyển';
      return 'Đã bàn giao';
    case 'OVERDUE':
      return 'Quá hạn hoàn trả';
    case 'CANCELLED':
      return 'Đã hủy';
    default:
      return status;
  }
}

function getHandoverWorkflowLabel(type: HandoverWorkflowType | undefined): string {
  switch (type) {
    case 'BORROW_RETURN':
      return 'Mượn / Trả xe';
    case 'TRANSFER':
      return 'Điều chuyển xe';
    case 'DRIVER_HANDOVER':
      return 'Bàn giao hiện trạng';
    default:
      return 'Bàn giao / Mượn';
  }
}

function getHandoverStatusClass(status: HandoverStatus): string {
  switch (status) {
    case 'BORROWING':
      return 'badge-dispatched';
    case 'RETURNED':
      return 'badge-completed';
    case 'OVERDUE':
      return 'badge-warning';
    case 'CANCELLED':
      return 'badge-muted';
    default:
      return 'badge-secondary';
  }
}

function getReasonTypeLabel(reason?: string): string {
  switch (reason) {
    case 'RESIGNATION':
      return 'Nghỉ việc / Chuyển công tác';
    case 'DRIVER_SWAP':
      return 'Hoán đổi tài xế quản lý';
    case 'NEW_ASSIGNMENT':
      return 'Phân công tài xế mới';
    case 'SHIFT_CHANGE':
      return 'Đổi ca dài hạn';
    default:
      return 'Thay đổi tài xế';
  }
}

function countChecklistItems(checklist?: HandoverChecklist): { passed: number; total: number } {
  if (!checklist) return { passed: 6, total: 6 };
  const keys = Object.keys(checklist) as (keyof HandoverChecklist)[];
  const passed = keys.filter((k) => !!checklist[k]).length;
  return { passed, total: keys.length };
}

function getDriverNameById(driverId?: number): string {
  if (!driverId) return '';
  return fleetStore.drivers.find((d) => d.id === driverId)?.fullName || '';
}

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
    case 'DueForMaintenance':
      return 'Chờ bảo dưỡng';
    default:
      return status;
  }
}

// Xác định trạng thái vận hành hiệu lực thực tế (tự động đồng bộ với tình trạng bảo dưỡng)
function getEffectiveVehicleStatus(v: Vehicle): { code: string; label: string; badgeClass: string } {
  if (v.status === 'UnderMaintenance') {
    return { code: 'UnderMaintenance', label: 'Đang bảo dưỡng', badgeClass: 'status-undermaintenance' };
  }
  if (v.status === 'Broken') {
    return { code: 'Broken', label: 'Sự cố / Hỏng hóc', badgeClass: 'status-broken' };
  }
  if (v.status === 'OnTrip') {
    return { code: 'OnTrip', label: 'Đang chạy chuyến', badgeClass: 'status-ontrip' };
  }

  // Nếu xe chưa chạy chuyến nhưng đã đến hạn / vượt ngưỡng bảo dưỡng quy định
  const threshold = getThreshold(v);
  const distanceSinceLast = v.currentOdoKm - v.lastMaintenanceOdo;
  const isDue = (v.vehicleType !== 'MillingMachine' && distanceSinceLast >= threshold)
    || v.maintenanceStatus === 'Due'
    || v.maintenanceStatus === 'Overdue';

  if (isDue) {
    return { code: 'DueForMaintenance', label: 'Chờ bảo dưỡng', badgeClass: 'status-duemaintenance' };
  }

  return { code: 'Available', label: 'Sẵn sàng', badgeClass: 'status-available' };
}

// Chuyển đổi loại xe sang tiếng Việt
function getVehicleTypeLabel(type: string, vehicle?: Vehicle): string {
  const t = (type || '').toLowerCase();

  if (vehicle && vehicle.model && vehicle.model.toLowerCase().includes('bồn')) {
    return 'Xe bồn';
  }

  switch (t) {
    case 'latextruck':
      return 'Xe tải';
    case 'passengercar':
      return 'Bán tải';
    case 'millingmachine':
      return 'Máy đào';
    default: {
      const cat = fleetStore.vehicleCategories.find(
        (c) => c.code.toLowerCase() === t || c.vehicleTypeCode.toLowerCase() === t
      );
      return cat ? cat.name : type;
    }
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
const standardSeatOptions = [2, 3, 4, 5, 7, 9, 16, 29, 34, 35, 45];
const newVehEmptyQuota = ref(0.25);
const newVehLoadedQuota = ref(0.02);
const newVehFormulaText = ref('');
const newVehOdo = ref(10000);
const newVehDriverId = ref<number | ''>('');
const newVehDriverName = ref('');
const newVehDriverPhone = ref('');
const newVehOperatingUnitType = ref<'Team' | 'Factory'>('Team');
const newVehTeamName = ref('Đội 1');
const newVehNotes = ref('');
const newVehIsExternal = ref(false);
const showVehFormulaModal = ref(false);
const vehFormulaDraft = ref('');

function openAddVehicleModal() {
  editingVehicle.value = null;
  newVehPlate.value = '';
  newVehType.value = 'LatexTruck';
  newVehModel.value = '';
  newVehCapacity.value = 5.0;
  newVehSeats.value = undefined;
  newVehEmptyQuota.value = 0.25;
  newVehLoadedQuota.value = 0.02;
  newVehFormulaText.value = '';
  newVehOdo.value = 10000;
  newVehDriverId.value = '';
  newVehDriverName.value = '';
  newVehDriverPhone.value = '';
  newVehOperatingUnitType.value = 'Team';
  newVehTeamName.value = 'Đội 1';
  newVehNotes.value = '';
  newVehIsExternal.value = activeVehicleFilter.value === 'external';
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
  newVehFormulaText.value = vehicle.fuelFormulaText || '';
  newVehOdo.value = vehicle.currentOdoKm;
  newVehDriverId.value = vehicle.assignedDriverId || '';
  newVehDriverName.value = vehicle.assignedDriverName || '';
  newVehDriverPhone.value = vehicle.assignedDriverPhone || '';
  newVehOperatingUnitType.value = vehicle.operatingUnitType || (vehicle.teamName ? 'Team' : 'Factory');
  newVehTeamName.value = vehicle.teamName || 'Đội 1';
  newVehNotes.value = vehicle.notes || '';
  newVehIsExternal.value = !!vehicle.isExternal;
  if (selectedVehicleForDetail.value) {
    selectedVehicleForDetail.value = null;
  }
  showAddVehModal.value = true;
}

function openVehicleFormulaEditor() {
  vehFormulaDraft.value = newVehFormulaText.value;
  showVehFormulaModal.value = true;
}

function saveVehicleFormula() {
  newVehFormulaText.value = vehFormulaDraft.value.trim();
  showVehFormulaModal.value = false;
}

function handleSaveVehicle() {
  if (!newVehPlate.value.trim() || !newVehModel.value.trim()) {
    dialog.showWarning('Vui lòng nhập đầy đủ biển số xe và tên dòng xe để tiếp tục!', 'Thiếu Thông Tin Phương Tiện', 'Kiểm tra lại');
    return;
  }
  const plate = newVehPlate.value.trim();
  const isEdit = !!editingVehicle.value;
  const isExt = !!newVehIsExternal.value;

  let driverIdToSave: number | undefined = undefined;
  let driverNameToSave: string | undefined = undefined;
  let driverPhoneToSave: string | undefined = undefined;

  if (isExt) {
    // Xe thuê ngoài: nhập trực tiếp tên & SĐT tài xế thuê ngoài, không quản lý trong ds tài xế nội bộ
    driverNameToSave = newVehDriverName.value.trim() || undefined;
    driverPhoneToSave = newVehDriverPhone.value.trim() || undefined;
  } else {
    // Xe công ty: chọn từ danh sách tài xế nội bộ của công ty
    const selectedDriverId = newVehDriverId.value === '' ? null : Number(newVehDriverId.value);
    const selectedDriver = fleetStore.drivers.find((d) => d.id === selectedDriverId);
    if (selectedDriver) {
      driverIdToSave = selectedDriver.id;
      driverNameToSave = selectedDriver.fullName;
      driverPhoneToSave = selectedDriver.phone;
    }
  }

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
      fuelFormulaText: newVehFormulaText.value.trim() || undefined,
      currentOdoKm: Number(newVehOdo.value),
      operatingUnitType: newVehOperatingUnitType.value,
      teamName: newVehOperatingUnitType.value === 'Team' ? (newVehTeamName.value.trim() || 'Đội 1') : undefined,
      notes: newVehNotes.value.trim() || undefined,
      isExternal: isExt,
      assignedDriverId: driverIdToSave,
      assignedDriverName: driverNameToSave,
      assignedDriverPhone: driverPhoneToSave,
    });
    // Chỉ ghi nhận lịch sử phân công cho tài xế cơ hữu nội bộ của công ty
    if (!isExt && editingVehicle.value.assignedDriverId !== driverIdToSave) {
      fleetStore.assignDriverToVehicle(vehicleId, driverIdToSave ?? null, "Phân công từ form cập nhật xe");
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
      fuelFormulaText: newVehFormulaText.value.trim() || undefined,
      currentOdoKm: Number(newVehOdo.value),
      operatingUnitType: newVehOperatingUnitType.value,
      teamName: newVehOperatingUnitType.value === 'Team' ? (newVehTeamName.value.trim() || 'Đội 1') : undefined,
      notes: newVehNotes.value.trim() || undefined,
      isExternal: isExt,
      assignedDriverId: driverIdToSave,
      assignedDriverName: driverNameToSave,
      assignedDriverPhone: driverPhoneToSave,
      status: 'Available',
      maintenanceStatus: 'Normal',
      lastMaintenanceOdo: Number(newVehOdo.value),
      lastMaintenanceDate: new Date().toISOString().slice(0, 10),
    });
    if (!isExt && driverIdToSave) {
      fleetStore.assignDriverToVehicle(newVehicleId, driverIdToSave, "Phân công từ form tạo xe mới");
    }
    dialog.showSuccess(`Phương tiện [${plate}] đã được thêm vào đội xe thành công!`, 'Thêm Xe Mới Thành Công');
  }

  showAddVehModal.value = false;
  editingVehicle.value = null;
  newVehPlate.value = '';
  newVehModel.value = '';
  newVehDriverId.value = '';
  newVehDriverName.value = '';
  newVehDriverPhone.value = '';
  newVehNotes.value = '';
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
const assignExternalDriverName = ref('');
const assignExternalDriverPhone = ref('');
const assignNotes = ref('');

function openAssignDriverModal(vehicle: Vehicle) {
  assignVehicle.value = vehicle;
  assignDriverId.value = vehicle.assignedDriverId || '';
  assignExternalDriverName.value = vehicle.assignedDriverName || '';
  assignExternalDriverPhone.value = vehicle.assignedDriverPhone || '';
  assignNotes.value = '';
  showAssignDriverModal.value = true;
}

function handleSaveAssignment() {
  if (!assignVehicle.value) return;

  if (assignVehicle.value.isExternal) {
    // Xe thuê ngoài: cập nhật trực tiếp tên và SĐT tài xế đối tác
    assignVehicle.value.assignedDriverId = undefined;
    assignVehicle.value.assignedDriverName = assignExternalDriverName.value.trim() || undefined;
    assignVehicle.value.assignedDriverPhone = assignExternalDriverPhone.value.trim() || undefined;
    fleetStore.updateVehicle({ ...assignVehicle.value });
    dialog.showSuccess(
      `Đã lưu thông tin tài xế xe thuê [${assignVehicle.value.licensePlate}]: ${assignVehicle.value.assignedDriverName || 'Chưa gán'}!`,
      'Cập Nhật Tài Xế Xe Thuê'
    );
    showAssignDriverModal.value = false;
    assignVehicle.value = null;
    return;
  }

  // Xe công ty: phân công tài xế nội bộ
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
const newCatFuelFormulaText = ref('');
const newCatIsActive = ref(true);
const showCatFormulaModal = ref(false);
const catFormulaDraft = ref('');

function openAddCategoryModal() {
  editingCategory.value = null;
  newCatCode.value = '';
  newCatName.value = '';
  newCatGroup.value = 'Vận tải mủ';
  newCatVehType.value = 'LatexTruck';
  newCatDesc.value = '';
  newCatFuelFormulaText.value = '';
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
  newCatFuelFormulaText.value = cat.fuelFormulaText || '';
  newCatIsActive.value = cat.isActive;
  showAddCatModal.value = true;
}

function openCategoryFormulaEditor() {
  catFormulaDraft.value = newCatFuelFormulaText.value;
  showCatFormulaModal.value = true;
}

function saveCategoryFormula() {
  newCatFuelFormulaText.value = catFormulaDraft.value.trim();
  showCatFormulaModal.value = false;
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
      fuelFormulaText: newCatFuelFormulaText.value.trim() || undefined,
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

// ==================== Modal: Lập phiếu bàn giao / điều chuyển / mượn trả ====================
const showAddHandoverModal = ref(false);
const editingHandover = ref<HandoverRecord | null>(null);
const newHandoverWorkflowType = ref<HandoverWorkflowType>('BORROW_RETURN');
const newHandoverPlate = ref(fleetStore.vehicles[0]?.licensePlate || '');
const newHandoverFromDriver = ref(fleetStore.drivers[0]?.fullName || '');
const newHandoverDriver = ref(fleetStore.drivers[1]?.fullName || fleetStore.drivers[0]?.fullName || '');
const newHandoverVehicleTeam = ref('');
const newHandoverFromTeam = ref('Trạm Cán 2');
const newHandoverToTeam = ref('Trạm Cán 1');
const newHandoverFromManager = ref('');
const newHandoverToManager = ref('');
const newHandoverDecisionNumber = ref('45/QĐ-TCT-2026');
const newHandoverEffectiveDate = ref(new Date().toISOString().slice(0, 10));
const newHandoverTransferReason = ref('');
const newHandoverReplacingVehicle = ref('');
const newHandoverReasonType = ref<HandoverReasonType>('DRIVER_SWAP');
const newHandoverBorrowTime = ref(new Date().toISOString().slice(0, 16));
const newHandoverReturnTime = ref(new Date(Date.now() + 5 * 24 * 3600 * 1000).toISOString().slice(0, 16));
const newHandoverActualReturnTime = ref('');
const newHandoverOdo = ref(120000);
const newHandoverReturnOdo = ref<number | undefined>(undefined);
const newHandoverFuel = ref('90%');
const newHandoverNotes = ref('Xe sạch sẽ, đầy đủ giấy tờ, phanh và lốp hoạt động tốt');
const newHandoverChecklist = ref<HandoverChecklist>({
  bodyAndPaint: true,
  brakesAndLights: true,
  tiresAndSpare: true,
  cleanliness: true,
  toolsAndJack: true,
  documents: true,
});
const selectedHandoverDocs = ref<string[]>([
  'Cà vẹt xe bản chính',
  'Sổ chứng nhận kiểm định an toàn kỹ thuật',
  'Bảo hiểm dân sự bắt buộc',
  'Thẻ nhiên liệu FleetCard',
]);

const standardUnitPresets = [
  'Trạm Cán 1',
  'Trạm Cán 2',
  'Trạm Cán 3',
  'Đội 1',
  'Đội 2',
  'Đội 3',
  'Đội 4',
  'Nhà máy chế biến',
  'Ban Quản lý Nông trường 1',
  'Ban Quản lý Nông trường 2',
  'Phòng Điều độ & Vận tải',
];

const selectedHandoverVehicle = computed(() =>
  fleetStore.vehicles.find((v) => v.licensePlate === newHandoverPlate.value)
);

const showReturnHandoverModal = ref(false);
const returningHandover = ref<HandoverRecord | null>(null);
const showHandoverDetailModal = ref(false);
const viewingHandover = ref<HandoverRecord | null>(null);
const handoverActionMode = ref<'READY' | 'RETURN'>('RETURN');
const returnHandoverActualTime = ref(new Date().toISOString().slice(0, 16));
const returnHandoverOdo = ref<number | undefined>(undefined);
const returnHandoverFuel = ref('90%');
const returnHandoverNotes = ref('');
const returnHandoverImageUrl = ref<string>('');

function resetHandoverForm() {
  const firstVehicle = fleetStore.vehicles[0];
  const firstDriver = fleetStore.drivers[0];
  const secondDriver = fleetStore.drivers[1] || firstDriver;

  newHandoverWorkflowType.value = handoverSectionTab.value;
  newHandoverPlate.value = firstVehicle?.licensePlate || '';
  newHandoverFromDriver.value = firstVehicle?.assignedDriverName || firstDriver?.fullName || '';
  newHandoverDriver.value = secondDriver?.fullName || '';
  newHandoverVehicleTeam.value = firstVehicle?.teamName || 'Trạm Cán 2';
  newHandoverFromTeam.value = firstVehicle?.teamName || 'Trạm Cán 2';
  newHandoverToTeam.value = 'Trạm Cán 1';
  newHandoverFromManager.value = '';
  newHandoverToManager.value = '';
  newHandoverDecisionNumber.value = `45/QĐ-TCT-${new Date().getFullYear()}`;
  newHandoverEffectiveDate.value = new Date().toISOString().slice(0, 10);
  newHandoverTransferReason.value = '';
  newHandoverReplacingVehicle.value = '';
  newHandoverReasonType.value = 'DRIVER_SWAP';
  newHandoverBorrowTime.value = new Date().toISOString().slice(0, 16);
  newHandoverReturnTime.value = new Date(Date.now() + 5 * 24 * 3600 * 1000).toISOString().slice(0, 16);
  newHandoverActualReturnTime.value = '';
  newHandoverOdo.value = firstVehicle?.currentOdoKm || 120000;
  newHandoverReturnOdo.value = undefined;
  newHandoverFuel.value = '90%';
  newHandoverNotes.value = 'Xe sạch sẽ, đầy đủ giấy tờ, phanh và lốp hoạt động tốt';
  newHandoverChecklist.value = {
    bodyAndPaint: true,
    brakesAndLights: true,
    tiresAndSpare: true,
    cleanliness: true,
    toolsAndJack: true,
    documents: true,
  };
  selectedHandoverDocs.value = [
    'Cà vẹt xe bản chính',
    'Sổ chứng nhận kiểm định an toàn kỹ thuật',
    'Bảo hiểm dân sự bắt buộc',
    'Thẻ nhiên liệu FleetCard',
  ];
}

function onHandoverVehicleChange() {
  const v = fleetStore.vehicles.find((veh) => veh.licensePlate === newHandoverPlate.value);
  if (!v) return;

  if (v.assignedDriverName) {
    newHandoverFromDriver.value = v.assignedDriverName;
  }
  if (v.teamName) {
    newHandoverVehicleTeam.value = v.teamName;
    newHandoverFromTeam.value = v.teamName;
  }
  if (v.currentOdoKm) {
    newHandoverOdo.value = v.currentOdoKm;
  }
}

function openAddHandoverModal() {
  editingHandover.value = null;
  resetHandoverForm();
  newHandoverWorkflowType.value = handoverSectionTab.value;
  showAddHandoverModal.value = true;
}

function openEditHandoverModal(record: HandoverRecord) {
  editingHandover.value = record;
  newHandoverWorkflowType.value = record.workflowType ?? 'BORROW_RETURN';
  newHandoverPlate.value = record.vehiclePlate;
  newHandoverFromDriver.value = record.fromDriverName || getDriverNameById(record.fromDriverId) || '';
  newHandoverDriver.value = record.toDriverName || record.driverName || '';
  newHandoverVehicleTeam.value = record.fromTeam || 'Chưa có đội';
  newHandoverFromTeam.value = record.fromTeam || '';
  newHandoverToTeam.value = record.toTeam || '';
  newHandoverFromManager.value = record.fromManagerName || '';
  newHandoverToManager.value = record.toManagerName || '';
  newHandoverDecisionNumber.value = record.decisionNumber || '';
  newHandoverEffectiveDate.value = record.effectiveDate || (record.borrowStartAt ? record.borrowStartAt.slice(0, 10) : new Date().toISOString().slice(0, 10));
  newHandoverTransferReason.value = record.transferReason || '';
  newHandoverReplacingVehicle.value = record.replacingVehiclePlate || '';
  newHandoverReasonType.value = record.handoverReasonType || 'DRIVER_SWAP';
  newHandoverBorrowTime.value = record.borrowStartAt ? record.borrowStartAt.replace(' ', 'T') : new Date().toISOString().slice(0, 16);
  newHandoverReturnTime.value = record.expectedReturnAt ? record.expectedReturnAt.replace(' ', 'T') : '';
  newHandoverActualReturnTime.value = record.actualReturnAt ? record.actualReturnAt.replace(' ', 'T') : '';
  newHandoverOdo.value = record.handoverOdo;
  newHandoverReturnOdo.value = record.returnOdo ?? undefined;
  newHandoverFuel.value = record.fuelLevel || '90%';
  newHandoverNotes.value = record.conditionNotes || '';
  if (record.handoverChecklist) {
    newHandoverChecklist.value = { ...record.handoverChecklist };
  }
  if (record.handoverDocuments) {
    selectedHandoverDocs.value = [...record.handoverDocuments];
  }
  showAddHandoverModal.value = true;
}

function openReturnHandoverModal(record: HandoverRecord, mode: 'READY' | 'RETURN' = 'RETURN') {
  handoverActionMode.value = mode;
  returningHandover.value = record;
  returnHandoverActualTime.value = new Date().toISOString().slice(0, 16);
  returnHandoverOdo.value = record.returnOdo ?? record.handoverOdo;
  returnHandoverFuel.value = record.returnFuelLevel || record.fuelLevel || '90%';
  returnHandoverNotes.value = record.note || '';
  returnHandoverImageUrl.value = record.handoverImageUrl || '';
  showReturnHandoverModal.value = true;
}

function openHandoverDetailModal(record: HandoverRecord) {
  viewingHandover.value = record;
  showHandoverDetailModal.value = true;
}

function normalizeDateTime(value: string): string {
  return value ? value.replace('T', ' ') : '';
}

function saveHandoverRecord(payload: HandoverRecord, successMsg: string) {
  if (editingHandover.value) {
    handoverList.value = handoverList.value.map((h) => (h.id === editingHandover.value?.id ? payload : h));
  } else {
    handoverList.value.unshift(payload);
  }
  mockStorage.saveHandovers(handoverList.value);
  syncVehicleStatusFromHandover(payload);
  showAddHandoverModal.value = false;
  editingHandover.value = null;
  dialog.showSuccess(successMsg, 'Lưu Biên Bản Thành Công');
}

function handleAddHandover() {
  if (!newHandoverPlate.value) {
    dialog.showWarning('Vui lòng chọn phương tiện để lập biên bản!', 'Thiếu Thông Tin Phương Tiện', 'Kiểm tra lại');
    return;
  }

  const vehicle = fleetStore.vehicles.find((v) => v.licensePlate === newHandoverPlate.value);
  const plate = newHandoverPlate.value;

  if (newHandoverWorkflowType.value === 'BORROW_RETURN') {
    if (!newHandoverFromTeam.value.trim() || !newHandoverToTeam.value.trim()) {
      dialog.showWarning('Vui lòng nhập đơn vị cho mượn và đơn vị mượn xe!', 'Thiếu Đơn Vị Mượn / Trả', 'Kiểm tra lại');
      return;
    }

    const payload: HandoverRecord = {
      id: editingHandover.value?.id ?? Date.now(),
      vehicleId: vehicle?.id ?? 0,
      vehiclePlate: plate,
      workflowType: 'BORROW_RETURN',
      fromTeam: newHandoverFromTeam.value.trim(),
      toTeam: newHandoverToTeam.value.trim(),
      fromManagerName: newHandoverFromManager.value.trim() || undefined,
      toManagerName: newHandoverToManager.value.trim() || undefined,
      replacingVehiclePlate: newHandoverReplacingVehicle.value.trim() || undefined,
      driverName: vehicle?.assignedDriverName || 'Theo điều phối',
      borrowStartAt: normalizeDateTime(newHandoverBorrowTime.value),
      expectedReturnAt: newHandoverReturnTime.value ? normalizeDateTime(newHandoverReturnTime.value) : undefined,
      actualReturnAt: newHandoverActualReturnTime.value ? normalizeDateTime(newHandoverActualReturnTime.value) : undefined,
      handoverOdo: Number(newHandoverOdo.value) || 0,
      returnOdo: newHandoverReturnOdo.value ?? undefined,
      fuelLevel: newHandoverFuel.value,
      conditionNotes: newHandoverNotes.value.trim() || 'Mượn xe tạm thời giữa các đơn vị',
      status: newHandoverActualReturnTime.value ? 'RETURNED' : 'BORROWING',
      createdAt: new Date().toISOString().slice(0, 16),
    };

    saveHandoverRecord(payload, `Phiếu mượn xe [${plate}] từ [${payload.fromTeam}] cho [${payload.toTeam}] đã được lưu thành công!`);
    return;
  }

  if (newHandoverWorkflowType.value === 'TRANSFER') {
    if (!newHandoverToTeam.value.trim()) {
      dialog.showWarning('Vui lòng chọn hoặc nhập đơn vị mới tiếp nhận quản lý xe!', 'Thiếu Đơn Vị Tiếp Nhận', 'Kiểm tra lại');
      return;
    }

    const targetUnit = newHandoverToTeam.value.trim();
    if (vehicle) {
      vehicle.teamName = targetUnit;
      vehicle.operatingUnitType = targetUnit.includes('Nhà máy') ? 'Factory' : 'Team';
      fleetStore.updateVehicle(vehicle);
    }

    const payload: HandoverRecord = {
      id: editingHandover.value?.id ?? Date.now(),
      vehicleId: vehicle?.id ?? 0,
      vehiclePlate: plate,
      workflowType: 'TRANSFER',
      fromTeam: newHandoverFromTeam.value.trim() || 'Đơn vị cũ',
      toTeam: targetUnit,
      fromManagerName: newHandoverFromManager.value.trim() || undefined,
      toManagerName: newHandoverToManager.value.trim() || undefined,
      decisionNumber: newHandoverDecisionNumber.value.trim() || undefined,
      effectiveDate: newHandoverEffectiveDate.value || new Date().toISOString().slice(0, 10),
      transferReason: newHandoverTransferReason.value.trim() || 'Điều chuyển quyền quản lý phương tiện sang đơn vị mới',
      driverName: vehicle?.assignedDriverName || 'Đơn vị mới phân công',
      borrowStartAt: normalizeDateTime(newHandoverBorrowTime.value),
      handoverOdo: Number(newHandoverOdo.value) || 0,
      fuelLevel: newHandoverFuel.value,
      handoverDocuments: [...selectedHandoverDocs.value],
      conditionNotes: newHandoverNotes.value.trim() || 'Đã chuyển giao toàn bộ quyền quản lý phương tiện',
      status: 'RETURNED',
      createdAt: new Date().toISOString().slice(0, 16),
    };

    saveHandoverRecord(payload, `Đã điều chuyển quyền quản lý xe [${plate}] về [${targetUnit}] thành công! Danh sách phương tiện đã được cập nhật.`);
    return;
  }

  if (newHandoverWorkflowType.value === 'DRIVER_HANDOVER') {
    if (!newHandoverDriver.value) {
      dialog.showWarning('Vui lòng chọn tài xế tiếp nhận xe mới!', 'Thiếu Tài Xế Tiếp Nhận', 'Kiểm tra lại');
      return;
    }

    const newDriver = fleetStore.drivers.find((d) => d.fullName === newHandoverDriver.value);
    const fromDriver = fleetStore.drivers.find((d) => d.fullName === newHandoverFromDriver.value);

    if (vehicle && newDriver) {
      fleetStore.assignDriverToVehicle(
        vehicle.id,
        newDriver.id,
        `Bàn giao từ ${newHandoverFromDriver.value} sang ${newDriver.fullName} (${getReasonTypeLabel(newHandoverReasonType.value)})`
      );
    }

    const payload: HandoverRecord = {
      id: editingHandover.value?.id ?? Date.now(),
      vehicleId: vehicle?.id ?? 0,
      vehiclePlate: plate,
      workflowType: 'DRIVER_HANDOVER',
      fromTeam: vehicle?.teamName || 'Đội xe',
      toTeam: vehicle?.teamName || 'Đội xe',
      handoverReasonType: newHandoverReasonType.value,
      fromDriverId: fromDriver?.id,
      fromDriverName: newHandoverFromDriver.value,
      toDriverId: newDriver?.id,
      toDriverName: newHandoverDriver.value,
      driverName: newHandoverDriver.value,
      borrowStartAt: normalizeDateTime(newHandoverBorrowTime.value),
      handoverOdo: Number(newHandoverOdo.value) || 0,
      fuelLevel: newHandoverFuel.value,
      handoverChecklist: { ...newHandoverChecklist.value },
      conditionNotes: newHandoverNotes.value.trim() || 'Biên bản bàn giao hiện trạng kỹ thuật xe thay tài xế',
      handoverImageUrl: returnHandoverImageUrl.value || undefined,
      status: 'RETURNED',
      note: `Bàn giao từ ${newHandoverFromDriver.value} sang ${newHandoverDriver.value}`,
      createdAt: new Date().toISOString().slice(0, 16),
    };

    saveHandoverRecord(
      payload,
      `Biên bản bàn giao hiện trạng xe [${plate}] cho tài xế [${newHandoverDriver.value}] đã lập thành công! Tài xế phụ trách xe đã được cập nhật.`
    );
    return;
  }
}

function submitReturnHandover() {
  if (!returningHandover.value) return;

  const returnOdoValue = Number(returnHandoverOdo.value);
  if (!returnOdoValue || returnOdoValue < returningHandover.value.handoverOdo) {
    dialog.showWarning(
      'Vui lòng nhập ODO lúc trả hợp lệ và lớn hơn hoặc bằng ODO bàn giao ban đầu.',
      'Thiếu / Sai ODO Trả Xe',
      'Kiểm tra lại'
    );
    return;
  }

  const now = new Date().toISOString().slice(0, 16).replace('T', ' ');
  const actualReturnAt = normalizeDateTime(returnHandoverActualTime.value) || now;

  handoverList.value = handoverList.value.map((h) => {
    if (h.id !== returningHandover.value?.id) return h;

    const updated: HandoverRecord = {
      ...h,
      actualReturnAt,
      returnOdo: returnOdoValue,
      returnFuelLevel: returnHandoverFuel.value,
      conditionNotes: returnHandoverNotes.value.trim() || h.conditionNotes,
      handoverImageUrl: returnHandoverImageUrl.value || h.handoverImageUrl,
      note: returnHandoverNotes.value.trim() || h.note || `Đã hoàn trả xe lúc ${now}`,
      status: 'RETURNED',
    };

    syncVehicleStatusFromHandover(updated);
    return updated;
  });

  mockStorage.saveHandovers(handoverList.value);
  dialog.showSuccess(
    `Đã xác nhận hoàn trả xe [${returningHandover.value.vehiclePlate}] về cho [${returningHandover.value.fromTeam}] thành công!`,
    'Hoàn Trả Xe Thành Công'
  );

  showReturnHandoverModal.value = false;
  returningHandover.value = null;
  returnHandoverActualTime.value = new Date().toISOString().slice(0, 16);
  returnHandoverOdo.value = undefined;
  returnHandoverFuel.value = '90%';
  returnHandoverNotes.value = '';
  returnHandoverImageUrl.value = '';
}

function handleReturnHandover(record: HandoverRecord) {
  openReturnHandoverModal(record, 'RETURN');
}

function handleDriverReadyToHandover(record: HandoverRecord) {
  openReturnHandoverModal(record, 'READY');
}

function handleReturnHandoverImageUpload(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];

  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    returnHandoverImageUrl.value = String(reader.result || '');
  };
  reader.readAsDataURL(file);
}

function handleDeleteHandover(record: HandoverRecord) {
  dialog.showConfirm({
    title: 'Xác Nhận Xóa Biên Bản',
    message: `Bạn có chắc chắn muốn xóa biên bản cho xe [${record.vehiclePlate}] khỏi hệ thống?`,
    confirmText: 'Xác Nhận Xóa',
    onConfirm: () => {
      handoverList.value = handoverList.value.filter((h) => h.id !== record.id);
      mockStorage.saveHandovers(handoverList.value);
      dialog.showSuccess(`Đã xóa biên bản xe [${record.vehiclePlate}] thành công!`, 'Xóa Thành Công');
    },
  });
}

function truncateText(text: string | null | undefined, maxWords: number = 5): string {
  if (!text) return '—';
  const words = text.split(' ');
  if (words.length > maxWords) {
    return words.slice(0, maxWords).join(' ') + '...';
  }
  return text;
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

      <!-- Sub-tabs Phân Loại Xe Công Ty / Thuê Ngoài & Lọc Đối Tượng Sử Dụng -->
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

        <!-- Bộ lọc đối tượng sử dụng: Đội hay Nhà máy -->
        <div class="fleet-unit-filter-box">
          <label class="unit-filter-label" for="fleet-unit-filter-select">Đối tượng sử dụng:</label>
          <select id="fleet-unit-filter-select" v-model="filterUnitType" class="unit-filter-select">
            <option value="ALL">Tất cả đối tượng (Đội & Nhà máy)</option>
            <option value="Team">Chỉ xe Đội</option>
            <option value="Factory">Chỉ xe Nhà máy chế biến</option>
          </select>
        </div>
      </div>

      <div class="table-container">
        <table class="table table-fleet">
          <thead>
            <tr>
              <th style="min-width: 105px;">Biển Số Xe</th>
              <th style="min-width: 80px;">Loại Xe</th>
              <th style="min-width: 135px;">Đơn Vị Sử Dụng</th>
              <th style="min-width: 170px;">Model / Dòng Xe</th>
              <th style="min-width: 155px;">Tài Xế Trực Thuộc</th>
              <th style="min-width: 120px;">Số Điện Thoại</th>
              <th style="min-width: 90px;">Tải Trọng</th>
              <th style="min-width: 80px;">Số Chỗ</th>
              <th style="min-width: 140px;">Định Mức Nhiên Liệu</th>
              <th style="min-width: 155px;">Chỉ Số Vận Hành (ODO)</th>
              <th style="min-width: 110px;">Trạng Thái Xe</th>
              <th style="min-width: 145px;">Số Lần Vận Chuyển</th>
              <th style="min-width: 130px;">Chu Kỳ Bảo Dưỡng</th>
              <th style="min-width: 140px;">Ghi Chú</th>
              <th class="text-center sticky-action-col" style="min-width: 100px; width: 100px;">Hành Động</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="filteredVehicles.length === 0">
              <td colspan="15" class="text-center py-5">
                <div class="empty-state-subtab">
                  <Truck :size="36" class="text-muted opacity-40 mb-2" />
                  <p class="text-sm text-muted font-medium">Chưa có phương tiện nào phù hợp với bộ lọc.</p>
                </div>
              </td>
            </tr>
            <tr v-for="v in paginatedVehicles" :key="v.id" class="veh-row">
              <td>
                <button class="btn-plate-link" @click="openVehicleDetail(v)" title="Xem hồ sơ & chi tiết chu kỳ bảo dưỡng xe">
                  <strong>{{ v.licensePlate }}</strong>
                </button>
              </td>
              <td>
                <span class="type-pill">{{ getVehicleTypeLabel(v.vehicleType, v) }}</span>
              </td>
              <!-- Cột Đơn Vị / Đối Tượng Sử Dụng -->
              <td>
                <span v-if="v.operatingUnitType === 'Factory'" class="badge-unit-factory">Nhà máy</span>
                <span v-else class="badge-unit-team">{{ v.teamName || 'Đội' }}</span>
              </td>
              <td>{{ v.model }}</td>
              <td>
                <strong v-if="v.assignedDriverName">{{ v.assignedDriverName }}</strong>
                <span v-else class="text-muted text-xs italic">{{ v.isExternal ? '— Chưa nhập tên tài xế —' : '— Chưa phân công —' }}</span>
              </td>
              <td>
                <span v-if="v.assignedDriverPhone || fleetStore.drivers.find(d => d.id === v.assignedDriverId)?.phone" class="text-xs font-mono">
                  {{ v.assignedDriverPhone || fleetStore.drivers.find(d => d.id === v.assignedDriverId)?.phone }}
                </span>
                <span v-else class="text-muted text-xs italic">—</span>
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
              <!-- Trạng thái xe -->
              <td>
                <span class="veh-status-badge" :class="getEffectiveVehicleStatus(v).badgeClass">
                  {{ getEffectiveVehicleStatus(v).label }}
                </span>
              </td>
              <!-- Số lần vận chuyển trong ngày -->
              <td>
                <span class="badge" :class="getVehicleTodayTrips(v.id).length > 0 ? 'badge-trip-stat-active' : 'badge-trip-stat-zero'">
                  {{ getVehicleTodayTrips(v.id).length }} chuyến hôm nay
                </span>
              </td>
              <td>
                <StatusBadge
                  v-if="!v.isExternal"
                  :status="v.status === 'UnderMaintenance' ? 'UnderMaintenance' : ((v.currentOdoKm - v.lastMaintenanceOdo) >= getThreshold(v) && v.vehicleType !== 'MillingMachine') ? 'Due' : v.maintenanceStatus"
                  type="maintenance"
                />
                <span v-else class="text-muted text-xs italic">Miễn bảo trì</span>
              </td>
              <td>
                <div class="flex-col gap-1 text-xs">
                  <div
                    v-if="(v.currentOdoKm - v.lastMaintenanceOdo) >= getThreshold(v) && v.vehicleType !== 'MillingMachine'"
                    class="note-overdue-box"
                    title="Chi tiết quãng đường vận hành so với định mức bảo dưỡng"
                  >
                    <span class="note-overdue-highlight">
                      {{ (v.currentOdoKm - v.lastMaintenanceOdo - getThreshold(v)) > 0
                        ? `Vượt ${(v.currentOdoKm - v.lastMaintenanceOdo - getThreshold(v)).toLocaleString()} km định mức`
                        : `Đạt mốc định mức bảo dưỡng`
                      }}
                    </span>
                    <span class="note-overdue-sub">
                      ({{ (v.currentOdoKm - v.lastMaintenanceOdo).toLocaleString() }} / {{ getThreshold(v).toLocaleString() }} km)
                    </span>
                  </div>
                  <span v-else-if="v.status === 'UnderMaintenance'" class="badge-maintenance-note">
                    Đang bảo dưỡng tại xưởng
                  </span>
                  <span v-if="v.notes" class="text-slate-700 font-medium">
                    {{ v.notes }}
                  </span>
                  <span
                    v-if="!((v.currentOdoKm - v.lastMaintenanceOdo) >= getThreshold(v)) && !v.notes && v.status !== 'UnderMaintenance'"
                    class="text-muted italic"
                  >
                    —
                  </span>
                </div>
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
      <TablePagination
        v-model:currentPage="vehCurrentPage"
        v-model:pageSize="vehPageSize"
        :totalItems="filteredVehicles.length"
        :pageSizeOptions="[5, 8, 15, 30]"
      />
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
              <th>Số Lần Vận Chuyển</th>
              <th>Tình Trạng Hoạt Động</th>
              <th>Trạng Thái Chuyến</th>
              <th class="text-center sticky-action-col" style="min-width: 90px; width: 90px;">Hành Động</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="d in paginatedDrivers" :key="d.id">
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
              <!-- Số lần vận chuyển trong ngày -->
              <td>
                <span class="badge" :class="getDriverTodayTrips(d.id).length > 0 ? 'badge-trip-stat-active' : 'badge-trip-stat-zero'">
                  {{ getDriverTodayTrips(d.id).length }} chuyến hôm nay
                </span>
              </td>
              <td>
                <span class="driver-status-badge" :class="`status-${d.employmentStatus.toLowerCase()}`">
                  {{ getDriverEmploymentStatusLabel(d.employmentStatus) }}
                </span>
              </td>
              <!-- Trạng thái chuyến -->
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
      <TablePagination
        v-model:currentPage="driverCurrentPage"
        v-model:pageSize="driverPageSize"
        :totalItems="fleetStore.drivers.length"
        :pageSizeOptions="[5, 8, 15, 30]"
      />
    </div>

    <!-- 4. Phân hệ Bàn giao, Điều chuyển & Mượn trả xe -->
    <div v-else class="card">
      <div class="card-header flex-between">
        <div>
          <h3 class="card-title">Quản Lý Bàn Giao, Điều Chuyển & Mượn Trả Xe</h3>
          <p v-if="handoverSectionTab === 'BORROW_RETURN'" class="text-xs text-muted">
            Theo dõi quy trình mượn / trả xe giữa các đơn vị (Trạm cán, Đội, Nhà máy) - ghi nhận ODO, xăng dầu và đối soát khi hoàn trả
          </p>
          <p v-else-if="handoverSectionTab === 'TRANSFER'" class="text-xs text-muted">
            Điều chuyển quyền quản lý phương tiện sang đơn vị khác theo quyết định của công ty, tự động cập nhật danh sách xe
          </p>
          <p v-else class="text-xs text-muted">
            Biên bản bàn giao hiện trạng kỹ thuật và pháp lý xe khi thay tài xế phụ trách (nghỉ việc, hoán đổi, phân công mới)
          </p>
        </div>
        <button v-if="isDispatcherRole" class="btn btn-primary" @click="openAddHandoverModal">
          <Plus :size="16" />
          <span>
            {{
              handoverSectionTab === 'BORROW_RETURN'
                ? 'Lập Phiếu Mượn Xe'
                : handoverSectionTab === 'TRANSFER'
                  ? 'Lập Lệnh Điều Chuyển'
                  : 'Lập Biên Bản Bàn Giao'
            }}
          </span>
        </button>
      </div>

      <!-- Thanh chuyển đổi phân hệ: 3 Sub-tabs rõ ràng & Bộ lọc -->
      <div class="handover-toolbar">
        <!-- Segmented Tab Toggle with 3 Tabs -->
        <div class="segmented-control">
          <button
            type="button"
            class="segmented-tab flex items-center gap-2"
            :class="{ active: handoverSectionTab === 'BORROW_RETURN' }"
            @click="handoverSectionTab = 'BORROW_RETURN'"
          >
            <ArrowRightLeft :size="14" />
            <span>Mượn / Trả Xe (giữa các đơn vị)</span>
          </button>
          <button
            type="button"
            class="segmented-tab flex items-center gap-2"
            :class="{ active: handoverSectionTab === 'TRANSFER' }"
            @click="handoverSectionTab = 'TRANSFER'"
          >
            <Building2 :size="14" />
            <span>Điều Chuyển Xe (chuyển đơn vị quản lý)</span>
          </button>
          <button
            type="button"
            class="segmented-tab flex items-center gap-2"
            :class="{ active: handoverSectionTab === 'DRIVER_HANDOVER' }"
            @click="handoverSectionTab = 'DRIVER_HANDOVER'"
          >
            <UserCheck :size="14" />
            <span>Bàn Giao Hiện Trạng (thay tài xế)</span>
          </button>
        </div>

        <!-- Cụm Tìm kiếm & Bộ lọc kế bên nhau -->
        <div class="handover-toolbar-right">
          <div class="handover-search-wrap">
            <Search :size="15" class="handover-search-ico" />
            <input
              v-model="searchHandoverKeyword"
              type="text"
              class="handover-search-input"
              placeholder="Tìm biển số, đơn vị, tài xế..."
            />
            <button
              v-if="searchHandoverKeyword"
              class="btn-clear-search"
              @click="searchHandoverKeyword = ''"
              title="Xóa tìm kiếm"
            >
              <X :size="13" />
            </button>
          </div>

          <div class="handover-filter-item">
            <span class="filter-label">Trạng thái:</span>
            <select v-model="handoverStatusFilter" class="filter-select-input">
              <option value="ALL">Tất cả ({{ tabHandovers.length }})</option>
              <option value="BORROWING">{{ handoverSummary.stat1Label }} ({{ handoverSummary.stat1Val }})</option>
              <option value="RETURNED">{{ handoverSummary.stat2Label }} ({{ handoverSummary.stat2Val }})</option>
              <option value="OVERDUE">Quá hạn ({{ tabHandovers.filter(h => h.status === 'OVERDUE').length }})</option>
              <option value="CANCELLED">Đã hủy ({{ tabHandovers.filter(h => h.status === 'CANCELLED').length }})</option>
            </select>
          </div>
        </div>
      </div>

      <!-- KPI Summary Cards động theo từng phân hệ -->
      <div style="display: grid; grid-template-columns: repeat(4, minmax(150px, 1fr)); gap: 12px; margin-bottom: 16px;">
        <div style="padding: 12px 14px; border-radius: 12px; border: 1px solid #dfe7ef; background: linear-gradient(135deg, #fef3c7, #fff7ed);">
          <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: #8a5b00; font-weight: 700;">
            {{ handoverSummary.stat1Label }}
          </div>
          <div style="margin-top: 8px; font-size: 22px; font-weight: 800; color: #7c3f00;">
            {{ handoverSummary.stat1Val }}
          </div>
        </div>
        <div style="padding: 12px 14px; border-radius: 12px; border: 1px solid #dfe7ef; background: linear-gradient(135deg, #dcfce7, #f0fdf4);">
          <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: #166534; font-weight: 700;">
            {{ handoverSummary.stat2Label }}
          </div>
          <div style="margin-top: 8px; font-size: 22px; font-weight: 800; color: #166534;">
            {{ handoverSummary.stat2Val }}
          </div>
        </div>
        <div style="padding: 12px 14px; border-radius: 12px; border: 1px solid #dfe7ef; background: linear-gradient(135deg, #fce7f3, #fff1f2);">
          <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: #9d174d; font-weight: 700;">
            {{ handoverSummary.stat3Label }}
          </div>
          <div style="margin-top: 8px; font-size: 22px; font-weight: 800; color: #9d174d;">
            {{ handoverSummary.stat3Val }}
          </div>
        </div>
        <div style="padding: 12px 14px; border-radius: 12px; border: 1px solid #dfe7ef; background: linear-gradient(135deg, #dbeafe, #eff6ff);">
          <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: #1d4ed8; font-weight: 700;">
            {{ handoverSummary.stat4Label }}
          </div>
          <div style="margin-top: 8px; font-size: 22px; font-weight: 800; color: #1e3a8a;">
            {{ handoverSummary.stat4Val }}
          </div>
        </div>
      </div>

      <!-- Bảng dữ liệu: Tùy biến theo từng Sub-tab -->
      <div class="table-container">
        <!-- 1. BẢNG MƯỢN / TRẢ XE -->
        <table v-if="handoverSectionTab === 'BORROW_RETURN'" class="table">
          <thead>
            <tr>
              <th>Phương Tiện</th>
              <th>Đơn Vị Mượn</th>
              <th>Đơn Vị Cho Mượn</th>
              <th>Đại Diện Nhận</th>
              <th>Đại Diện Giao</th>
              <th>Xe Cần Thay Thế</th>
              <th>Thời Gian Mượn (Từ)</th>
              <th>Hạn Trả (Hẹn)</th>
              <th>Ngày Trả (Thực Tế)</th>
              <th>ODO Bàn Giao</th>
              <th>Nhiên Liệu</th>
              <th>Lý Do Mượn Xe</th>
              <th>Trạng Thái</th>
              <th class="text-center">Hành Động</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="filteredHandovers.length === 0">
              <td colspan="14" class="text-center py-5">
                <div class="empty-state-subtab">
                  <ArrowRightLeft :size="36" class="text-muted opacity-40 mb-2" />
                  <p class="text-sm text-muted font-medium">Không tìm thấy biên bản mượn/trả xe nào phù hợp với bộ lọc hiện tại.</p>
                  <button v-if="handoverStatusFilter !== 'ALL' || searchHandoverKeyword" class="btn btn-outline btn-sm mt-2" @click="resetHandoverFilters">
                    <RotateCcw :size="13" />
                    <span>Xem tất cả biên bản</span>
                  </button>
                </div>
              </td>
            </tr>
            <tr v-for="h in paginatedHandovers" :key="h.id">
              <td>
                <button class="btn-plate-link" @click="openHandoverDetailModal(h)" title="Xem chi tiết phiếu mượn xe">
                  <strong>{{ h.vehiclePlate }}</strong>
                </button>
              </td>
              <td>
                <span class="badge-unit-team">{{ h.toTeam || '—' }}</span>
              </td>
              <td>
                <span class="badge-unit-factory">{{ h.fromTeam || '—' }}</span>
              </td>
              <td>
                <div class="text-xs font-medium text-slate-800">
                  {{ h.toManagerName || 'Quản lý nhận' }}
                </div>
              </td>
              <td>
                <div class="text-xs text-muted">
                  {{ h.fromManagerName || 'Quản lý giao' }}
                </div>
              </td>
              <td>
                <span v-if="h.replacingVehiclePlate" class="badge badge-warning" title="Xe bị hỏng cần mượn chi viện">
                  ⚠️ {{ h.replacingVehiclePlate }}
                </span>
                <span v-else class="text-muted text-xs italic">—</span>
              </td>
              <td>
                <span class="text-xs font-mono text-slate-700">{{ h.borrowStartAt }}</span>
              </td>
              <td>
                <span class="text-xs font-mono text-slate-700">{{ h.expectedReturnAt || '—' }}</span>
              </td>
              <td>
                <span v-if="h.actualReturnAt" class="text-xs font-mono text-emerald-700 font-semibold">
                  {{ h.actualReturnAt }}
                </span>
                <span v-else class="text-muted text-xs italic">—</span>
              </td>
              <td>
                <strong>{{ h.handoverOdo.toLocaleString() }} km</strong>
                <div v-if="h.returnOdo" class="text-xs text-muted">
                  Trả: {{ h.returnOdo.toLocaleString() }} km
                </div>
              </td>
              <td>
                <span class="badge badge-completed">{{ h.fuelLevel }}</span>
                <span v-if="h.returnFuelLevel" class="text-xs text-muted block mt-1">
                  Trả: {{ h.returnFuelLevel }}
                </span>
              </td>
              <td class="text-sm text-secondary" style="max-width: 220px;" :title="h.conditionNotes || h.transferReason || ''">
                {{ truncateText(h.conditionNotes || h.transferReason) }}
              </td>
              <td>
                <span class="badge" :class="getHandoverStatusClass(h.status)">
                  {{ getHandoverStatusLabel(h.status, 'BORROW_RETURN') }}
                </span>
              </td>
              <td class="text-center">
                <div class="actions-group">
                  <button
                    v-if="h.status === 'BORROWING'"
                    class="btn-action btn-primary"
                    @click="handleReturnHandover(h)"
                    title="Xác nhận trả xe về đơn vị gốc"
                  >
                    <RotateCcw :size="14" />
                  </button>
                  <button class="btn-action btn-secondary" @click="openHandoverDetailModal(h)" title="Xem chi tiết phiếu">
                    <Info :size="14" />
                  </button>
                  <button v-if="isDispatcherRole" class="btn-action btn-edit" @click="openEditHandoverModal(h)" title="Chỉnh sửa phiếu">
                    <Edit2 :size="14" />
                  </button>
                  <button v-if="isDispatcherRole" class="btn-action btn-delete" @click="handleDeleteHandover(h)" title="Xóa phiếu">
                    <Trash2 :size="14" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        <!-- 2. BẢNG ĐIỀU CHUYỂN XE -->
        <table v-else-if="handoverSectionTab === 'TRANSFER'" class="table">
          <thead>
            <tr>
              <th>Phương Tiện</th>
              <th>Đơn Vị Chuyển Giao (Cũ)</th>
              <th>Đơn Vị Tiếp Nhận (Mới)</th>
              <th>Số Quyết Định & Hiệu Lực</th>
              <th>Đại Diện Bên Giao</th>
              <th>Đại Diện Bên Nhận</th>
              <th>Lý Do Điều Chuyển</th>
              <th>ODO Bàn Giao</th>
              <th>Hồ Sơ Kèm Theo</th>
              <th>Trạng Thái</th>
              <th class="text-center">Hành Động</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="filteredHandovers.length === 0">
              <td colspan="11" class="text-center py-5">
                <div class="empty-state-subtab">
                  <Building2 :size="36" class="text-muted opacity-40 mb-2" />
                  <p class="text-sm text-muted font-medium">Không tìm thấy lệnh điều chuyển xe nào phù hợp với bộ lọc hiện tại.</p>
                  <button v-if="handoverStatusFilter !== 'ALL' || searchHandoverKeyword" class="btn btn-outline btn-sm mt-2" @click="resetHandoverFilters">
                    <RotateCcw :size="13" />
                    <span>Xem tất cả lệnh điều chuyển</span>
                  </button>
                </div>
              </td>
            </tr>
            <tr v-for="h in paginatedHandovers" :key="h.id">
              <td>
                <button class="btn-plate-link" @click="openHandoverDetailModal(h)" title="Xem chi tiết lệnh điều chuyển">
                  <strong>{{ h.vehiclePlate }}</strong>
                </button>
              </td>
              <td>
                <span class="badge-unit-team">{{ h.fromTeam || '—' }}</span>
              </td>
              <td>
                <span class="badge-unit-factory font-bold text-emerald-800 bg-emerald-100 border border-emerald-300">
                  ➔ {{ h.toTeam || '—' }}
                </span>
              </td>
              <td>
                <div>
                  <span class="font-semibold text-primary block">{{ h.decisionNumber || 'QĐ-TCT' }}</span>
                  <span class="text-xs text-muted">Hiệu lực: {{ h.effectiveDate || h.borrowStartAt?.slice(0, 10) || '—' }}</span>
                </div>
              </td>
              <td>
                <div class="text-xs text-slate-800 font-medium">
                  {{ h.fromManagerName || 'Đơn vị giao' }}
                </div>
              </td>
              <td>
                <div class="text-xs text-emerald-700 font-medium">
                  {{ h.toManagerName || 'Đơn vị nhận' }}
                </div>
              </td>
              <td class="text-sm text-secondary" style="max-width: 240px;" :title="h.transferReason || h.conditionNotes || ''">
                {{ truncateText(h.transferReason || h.conditionNotes) }}
              </td>
              <td>
                <strong>{{ h.handoverOdo.toLocaleString() }} km</strong>
              </td>
              <td>
                <span class="badge badge-secondary" title="Hồ sơ xe đi kèm">
                  <FileText :size="12" class="mr-1 inline" />
                  {{ (h.handoverDocuments && h.handoverDocuments.length) || 4 }} loại giấy tờ
                </span>
              </td>
              <td>
                <span class="badge badge-completed">
                  {{ getHandoverStatusLabel(h.status, 'TRANSFER') }}
                </span>
              </td>
              <td class="text-center">
                <div class="actions-group">
                  <button class="btn-action btn-secondary" @click="openHandoverDetailModal(h)" title="Xem chi tiết quyết định điều chuyển">
                    <Info :size="14" />
                  </button>
                  <button v-if="isDispatcherRole" class="btn-action btn-edit" @click="openEditHandoverModal(h)" title="Chỉnh sửa lệnh điều chuyển">
                    <Edit2 :size="14" />
                  </button>
                  <button v-if="isDispatcherRole" class="btn-action btn-delete" @click="handleDeleteHandover(h)" title="Xóa lệnh điều chuyển">
                    <Trash2 :size="14" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        <!-- 3. BẢNG BÀN GIAO HIỆN TRẠNG XE (THAY TÀI XẾ) -->
        <table v-else class="table">
          <thead>
            <tr>
              <th>Phương Tiện</th>
              <th>Tài Xế Bàn Giao (Cũ)</th>
              <th>Tài Xế Tiếp Nhận (Mới)</th>
              <th>Lý Do Bàn Giao</th>
              <th>Thời Điểm Bàn Giao</th>
              <th>ODO Bàn Giao</th>
              <th>Nhiên Liệu</th>
              <th>Checklist Hiện Trạng</th>
              <th>Ghi Chú & Cam Kết</th>
              <th>Trạng Thái</th>
              <th class="text-center">Hành Động</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="filteredHandovers.length === 0">
              <td colspan="11" class="text-center py-5">
                <div class="empty-state-subtab">
                  <UserCheck :size="36" class="text-muted opacity-40 mb-2" />
                  <p class="text-sm text-muted font-medium">Không tìm thấy biên bản bàn giao hiện trạng nào phù hợp với bộ lọc hiện tại.</p>
                  <button v-if="handoverStatusFilter !== 'ALL' || searchHandoverKeyword" class="btn btn-outline btn-sm mt-2" @click="resetHandoverFilters">
                    <RotateCcw :size="13" />
                    <span>Xem tất cả biên bản</span>
                  </button>
                </div>
              </td>
            </tr>
            <tr v-for="h in paginatedHandovers" :key="h.id">
              <td>
                <button class="btn-plate-link" @click="openHandoverDetailModal(h)" title="Xem chi tiết biên bản bàn giao hiện trạng">
                  <strong>{{ h.vehiclePlate }}</strong>
                </button>
              </td>
              <td>
                <strong>{{ h.fromDriverName || getDriverNameById(h.fromDriverId) || '—' }}</strong>
              </td>
              <td>
                <strong class="text-emerald-700">➔ {{ h.toDriverName || h.driverName || '—' }}</strong>
              </td>
              <td>
                <span class="badge badge-secondary">
                  {{ getReasonTypeLabel(h.handoverReasonType) }}
                </span>
              </td>
              <td>
                <span class="text-xs font-mono">{{ h.borrowStartAt }}</span>
              </td>
              <td>
                <strong>{{ h.handoverOdo.toLocaleString() }} km</strong>
              </td>
              <td>
                <span class="badge badge-completed">{{ h.fuelLevel }}</span>
              </td>
              <td>
                <span class="badge badge-completed" title="Số hạng mục kỹ thuật đạt chuẩn">
                  <ShieldCheck :size="13" class="mr-1 inline" />
                  {{ countChecklistItems(h.handoverChecklist).passed }}/{{ countChecklistItems(h.handoverChecklist).total }} mục đạt
                </span>
              </td>
              <td class="text-sm text-secondary" style="max-width: 220px;" :title="h.conditionNotes || ''">
                {{ truncateText(h.conditionNotes) }}
              </td>
              <td>
                <span class="badge" :class="getHandoverStatusClass(h.status)">
                  {{ getHandoverStatusLabel(h.status, 'DRIVER_HANDOVER') }}
                </span>
              </td>
              <td class="text-center">
                <div v-if="isDriverRole" class="actions-group">
                  <button
                    v-if="h.status === 'BORROWING' && (!h.note || !h.note.includes('Đã xác nhận nhận xe'))"
                    class="btn-action btn-primary"
                    @click="handleDriverReceiveHandover(h)"
                    title="Xác nhận nhận xe & hiện trạng"
                  >
                    <CheckCircle2 :size="14" />
                  </button>
                  <button class="btn-action btn-secondary" @click="openHandoverDetailModal(h)" title="Xem chi tiết biên bản">
                    <Info :size="14" />
                  </button>
                </div>
                <div v-else class="actions-group">
                  <button class="btn-action btn-secondary" @click="openHandoverDetailModal(h)" title="Xem chi tiết biên bản">
                    <Info :size="14" />
                  </button>
                  <button class="btn-action btn-edit" @click="openEditHandoverModal(h)" title="Chỉnh sửa biên bản">
                    <Edit2 :size="14" />
                  </button>
                  <button class="btn-action btn-delete" @click="handleDeleteHandover(h)" title="Xóa biên bản">
                    <Trash2 :size="14" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <TablePagination
        v-model:currentPage="handoverCurrentPage"
        v-model:pageSize="handoverPageSize"
        :totalItems="filteredHandovers.length"
        :pageSizeOptions="[5, 8, 15, 30]"
      />
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

          <div class="form-group mb-3">
            <label class="form-label font-semibold">Phân loại quyền sở hữu phương tiện <span class="required">*</span></label>
            <div class="ownership-selection-group">
              <label class="ownership-check-card" :class="{ 'selected': !newVehIsExternal }">
                <input
                  type="checkbox"
                  :checked="!newVehIsExternal"
                  @change="newVehIsExternal = false"
                  class="ownership-checkbox"
                />
                <div class="ownership-info">
                  <div class="ownership-title">
                    <Building2 :size="16" class="text-primary" />
                    <span>Xe công ty</span>
                  </div>
                  <span class="ownership-desc">Phương tiện nội bộ của công ty</span>
                </div>
              </label>

              <label class="ownership-check-card" :class="{ 'selected': newVehIsExternal }">
                <input
                  type="checkbox"
                  :checked="newVehIsExternal"
                  @change="newVehIsExternal = true"
                  class="ownership-checkbox"
                />
                <div class="ownership-info">
                  <div class="ownership-title">
                    <ExternalLink :size="16" class="text-amber-600" />
                    <span>Xe thuê ngoài</span>
                  </div>
                  <span class="ownership-desc">Phương tiện đối tác / hợp đồng thuê</span>
                </div>
              </label>
            </div>
            <div class="ownership-badge-note">
              <span v-if="!newVehIsExternal" class="text-xs text-success">
                ✓ Được phân vào tab <strong>Xe Công Ty</strong>
              </span>
              <span v-else class="text-xs text-amber-600">
                ⭐ Được phân vào tab <strong>Xe Thuê Ngoài</strong> (Không bắt buộc bảo dưỡng nội bộ)
              </span>
            </div>
          </div>

          <div class="form-group mb-3">
            <label class="form-label font-semibold">Đối tượng / Đơn vị sử dụng <span class="required">*</span></label>
            <div class="unit-type-selection-grid">
              <label class="unit-check-card" :class="{ 'selected': newVehOperatingUnitType === 'Team' }">
                <input
                  type="radio"
                  name="operatingUnitType"
                  value="Team"
                  v-model="newVehOperatingUnitType"
                  class="unit-radio"
                />
                <div class="unit-info">
                  <div class="unit-title font-bold text-emerald-800">Đội</div>
                  <span class="unit-desc">Phương tiện phục vụ các Đội</span>
                </div>
              </label>

              <label class="unit-check-card" :class="{ 'selected': newVehOperatingUnitType === 'Factory' }">
                <input
                  type="radio"
                  name="operatingUnitType"
                  value="Factory"
                  v-model="newVehOperatingUnitType"
                  class="unit-radio"
                />
                <div class="unit-info">
                  <div class="unit-title font-bold text-sky-800">Nhà Máy</div>
                  <span class="unit-desc">Phương tiện phục vụ Nhà máy</span>
                </div>
              </label>
            </div>

            <!-- Nếu chọn Đội: Cho phép chọn Đội chi tiết -->
            <div v-if="newVehOperatingUnitType === 'Team'" class="team-select-subform mt-2">
              <label class="form-label text-xs">Đội chi tiết phụ trách phương tiện:</label>
              <select v-model="newVehTeamName" class="form-select font-semibold">
                <option value="Đội 1">Đội 1</option>
                <option value="Đội 2">Đội 2</option>
                <option value="Đội 3">Đội 3</option>
                <option value="Đội 4">Đội 4</option>
                <option value="Đội 5">Đội 5</option>
                <option value="Toàn đội">Toàn đội (Dùng chung)</option>
              </select>
            </div>
          </div>

          <!-- Row 4: Tải trọng & Chỉ số ODO (2 cột đối xứng tuyệt đối) -->
          <div class="grid-2">
            <div class="form-group">
              <label class="form-label">Tải trọng (Tấn)</label>
              <input v-model.number="newVehCapacity" type="number" step="0.5" min="0" class="form-input" placeholder="Ví dụ: 5.0" />
            </div>
            <div class="form-group">
              <label class="form-label">Chỉ số ODO hiện tại (km)</label>
              <input v-model.number="newVehOdo" type="number" min="0" class="form-input" placeholder="Ví dụ: 25000" />
            </div>
          </div>

          <!-- Row 5: Khối chọn Số chỗ ngồi quy chuẩn đăng kiểm (Trải ngang thanh thoát, không lệch cột) -->
          <div class="form-group seat-selection-card">
            <div class="seat-card-header">
              <span class="seat-card-label">Số chỗ ngồi (Quy chuẩn đăng kiểm)</span>
              <div v-if="newVehSeats" class="seat-selected-badge">
                <span>Đã chọn: <strong>{{ newVehSeats }} chỗ ngồi</strong></span>
                <button type="button" class="btn-clear-seat-badge" @click="newVehSeats = undefined" title="Bỏ chọn số chỗ">
                  <X :size="12" />
                </button>
              </div>
              <div v-else class="seat-none-badge">
                Chưa chọn số chỗ
              </div>
            </div>

            <div class="seat-row-pills" :class="{ 'has-twelve': newVehSeats === 1 || newVehType === 'MillingMachine' }">
              <button
                v-if="newVehSeats === 1 || newVehType === 'MillingMachine'"
                type="button"
                class="btn-seat-pill"
                :class="{ active: newVehSeats === 1 }"
                @click="newVehSeats = (newVehSeats === 1 ? undefined : 1)"
              >
                1 chỗ
              </button>
              <button
                v-for="seat in standardSeatOptions"
                :key="seat"
                type="button"
                class="btn-seat-pill"
                :class="{ active: newVehSeats === seat }"
                @click="newVehSeats = (newVehSeats === seat ? undefined : seat)"
              >
                {{ seat }} chỗ
              </button>
            </div>
          </div>

          <div class="grid-2">
            <div class="form-group">
              <label class="form-label">NLP (L/km)</label>
              <input v-model.number="newVehEmptyQuota" type="number" step="0.01" min="0" class="form-input" />
            </div>
            <div class="form-group">
              <label class="form-label">NLC / Định mức có tải</label>
              <input v-model.number="newVehLoadedQuota" type="number" step="0.005" min="0" class="form-input" />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Công thức hao phí / tiêu hao theo mong muốn</label>
            <div class="formula-action-row">
              <button type="button" class="btn btn-secondary btn-small" @click="openVehicleFormulaEditor">
                Sửa công thức
              </button>
            </div>
            <div v-if="newVehFormulaText" class="formula-preview-box">
              {{ newVehFormulaText }}
            </div>
            <div v-else class="formula-preview-box empty">
              Chưa có công thức
            </div>
          </div>

          <!-- Phân công tài xế phụ trách -->
          <!-- Nếu là Xe công ty: Chọn tài xế nội bộ -->
          <div v-if="!newVehIsExternal" class="form-group">
            <label class="form-label">Tài xế nội bộ phụ trách</label>
            <select v-model="newVehDriverId" class="form-select">
              <option :value="''">-- Chưa gán tài xế / Chọn sau --</option>
              <option v-for="d in fleetStore.drivers" :key="d.id" :value="d.id">
                {{ d.fullName }} ({{ d.licenseClass }} - SĐT: {{ d.phone }})
              </option>
            </select>
          </div>

          <!-- Nếu là Xe thuê ngoài: Nhập trực tiếp tên tài xế đối tác/thuê ngoài -->
          <div v-else class="form-group">
            <label class="form-label">Họ tên tài xế thuê ngoài / đối tác</label>
            <input
              v-model="newVehDriverName"
              type="text"
              class="form-input"
              placeholder="Nhập họ tên tài xế xe thuê (VD: Bùi Quốc Hợp, Nguyễn Văn A...)"
            />
          </div>

          <!-- Nhập SĐT tài xế thuê ngoài nếu là xe thuê ngoài -->
          <div v-if="newVehIsExternal" class="form-group mt-2">
            <label class="form-label">Số điện thoại tài xế xe thuê ngoài (tùy chọn)</label>
            <input
              v-model="newVehDriverPhone"
              type="text"
              class="form-input"
              placeholder="VD: 0978 456 789"
            />
            <span class="text-xs text-muted mt-1 block">
              💡 Xe thuê ngoài chỉ cần nhập tên tài xế đối tác, không cần chọn tài xế nội bộ và không quản lý trong danh sách tài xế công ty.
            </span>
          </div>

          <!-- Ghi chú phương tiện -->
          <div class="form-group mt-3">
            <label class="form-label">Ghi chú phương tiện / Cảnh báo bảo dưỡng</label>
            <textarea
              v-model="newVehNotes"
              class="form-input"
              rows="2"
              placeholder="Nhập ghi chú tình trạng xe, lịch hẹn bảo dưỡng, lưu ý vận hành..."
            ></textarea>
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
            <label class="form-label">Công thức hao phí tiêu chuẩn của loại xe</label>
            <div class="formula-action-row">
              <button type="button" class="btn btn-secondary btn-small" @click="openCategoryFormulaEditor">
                Sửa công thức
              </button>
            </div>
            <div v-if="newCatFuelFormulaText" class="formula-preview-box">
              {{ newCatFuelFormulaText }}
            </div>
            <div v-else class="formula-preview-box empty">
              Chưa có công thức
            </div>
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

    <div v-if="showVehFormulaModal" class="modal-backdrop" @click.self="showVehFormulaModal = false">
      <div class="modal-content formula-modal-content">
        <div class="modal-header">
          <h3 class="modal-title">Sửa Công Thức Hao Phí / Tiêu Hao</h3>
        </div>
        <div class="modal-body">
          <FormulaBuilder
            v-model="vehFormulaDraft"
            label="Công thức hao phí / tiêu hao theo mong muốn"
            placeholder="Ví dụ: (StandardDistanceKm × NLP) + ((TotalWeightKg / 1000) × StandardDistanceKm × NLC)"
          />
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="showVehFormulaModal = false">Hủy</button>
          <button class="btn btn-primary" @click="saveVehicleFormula">Lưu Công Thức</button>
        </div>
      </div>
    </div>

    <div v-if="showCatFormulaModal" class="modal-backdrop" @click.self="showCatFormulaModal = false">
      <div class="modal-content formula-modal-content">
        <div class="modal-header">
          <h3 class="modal-title">Sửa Công Thức Hao Phí Tiêu Chuẩn Của Loại Xe</h3>
        </div>
        <div class="modal-body">
          <FormulaBuilder
            v-model="catFormulaDraft"
            label="Công thức hao phí tiêu chuẩn của loại xe"
            placeholder="Ví dụ: StandardDistanceKm × ElectricNormPerKm"
          />
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="showCatFormulaModal = false">Hủy</button>
          <button class="btn btn-primary" @click="saveCategoryFormula">Lưu Công Thức</button>
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

    <!-- Modal 4: Lập phiếu Mượn Trả / Điều Chuyển / Bàn Giao Hiện Trạng -->
    <div v-if="showAddHandoverModal" class="modal-backdrop" @click.self="showAddHandoverModal = false">
      <div class="modal-content" style="max-width: 780px;">
        <div class="modal-header">
          <h3 class="modal-title">
            <template v-if="editingHandover">
              {{
                newHandoverWorkflowType === 'BORROW_RETURN'
                  ? 'Chỉnh Sửa Phiếu Mượn / Trả Xe'
                  : newHandoverWorkflowType === 'TRANSFER'
                    ? 'Chỉnh Sửa Quyết Định Điều Chuyển Quyền Quản Lý'
                    : 'Chỉnh Sửa Biên Bản Bàn Giao Hiện Trạng Xe'
              }}
            </template>
            <template v-else>
              {{
                newHandoverWorkflowType === 'BORROW_RETURN'
                  ? 'Lập Phiếu Mượn Xe Giữa Các Đơn Vị'
                  : newHandoverWorkflowType === 'TRANSFER'
                    ? 'Lập Lệnh Điều Chuyển Xe Sang Đơn Vị Mới'
                    : 'Lập Biên Bản Bàn Giao Hiện Trạng Xe Cho Tài Xế'
              }}
            </template>
          </h3>
        </div>
        <div class="modal-body">
          <!-- 3-Pill Radio Selector for Workflow Types -->
          <div class="form-group mb-4">
            <label class="form-label" style="font-size: 0.875rem; font-weight: 700; color: #1e293b;">
              Quy trình nghiệp vụ thực hiện <span class="required">*</span>
            </label>
            <div class="workflow-radio-group">
              <label class="radio-pill-item" :class="{ active: newHandoverWorkflowType === 'BORROW_RETURN' }">
                <input v-model="newHandoverWorkflowType" type="radio" value="BORROW_RETURN" />
                <div>
                  <div style="font-weight: 700;">1. Mượn / Trả xe tạm</div>
                  <div style="font-size: 0.75rem; color: #64748b;">Hỗ trợ đơn vị bị sự cố/thiếu xe</div>
                </div>
              </label>
              <label class="radio-pill-item" :class="{ active: newHandoverWorkflowType === 'TRANSFER' }">
                <input v-model="newHandoverWorkflowType" type="radio" value="TRANSFER" />
                <div>
                  <div style="font-weight: 700;">2. Điều chuyển xe</div>
                  <div style="font-size: 0.75rem; color: #64748b;">Chuyển hẳn quyền quản lý</div>
                </div>
              </label>
              <label class="radio-pill-item" :class="{ active: newHandoverWorkflowType === 'DRIVER_HANDOVER' }">
                <input v-model="newHandoverWorkflowType" type="radio" value="DRIVER_HANDOVER" />
                <div>
                  <div style="font-weight: 700;">3. Bàn giao tài xế</div>
                  <div style="font-size: 0.75rem; color: #64748b;">Thay thế, nghỉ việc, hoán đổi</div>
                </div>
              </label>
            </div>
          </div>

          <!-- Common Vehicle Selection Row -->
          <div class="grid-3 mb-3">
            <div class="form-group">
              <label class="form-label">Phương tiện thực hiện <span class="required">*</span></label>
              <select v-model="newHandoverPlate" class="form-select" @change="onHandoverVehicleChange">
                <option v-for="v in fleetStore.vehicles" :key="v.id" :value="v.licensePlate">
                  {{ v.licensePlate }} ({{ v.teamName || 'Chưa phân đội' }})
                </option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Dòng xe / Tên xe</label>
              <input
                :value="selectedHandoverVehicle?.model || '—'"
                type="text"
                class="form-input"
                readonly
                style="background-color: #f8fafc; font-weight: 600; color: #1e293b;"
              />
            </div>

            <div class="form-group">
              <label class="form-label">Đơn vị quản lý hiện tại</label>
              <input
                :value="selectedHandoverVehicle?.teamName || 'Công ty'"
                type="text"
                class="form-input"
                readonly
                style="background-color: #f8fafc; font-weight: 600; color: #1e293b;"
              />
            </div>
          </div>

          <!-- ==================== NHÁNH 1: MƯỢN / TRẢ XE ==================== -->
          <div v-if="newHandoverWorkflowType === 'BORROW_RETURN'" class="handover-branch-box">
            <div class="p-3 mb-3 rounded border" style="background-color: #f0fdf4; border-color: #bbf7d0; font-size: 0.8125rem; color: #166534;">
              <strong>Quy trình mượn / trả xe:</strong> Áp dụng khi đơn vị (Trạm cán / Đội / Nhà máy) bị hỏng xe hoặc tăng tải đột xuất, cần mượn tạm xe từ đơn vị bạn trong vài ngày rồi hoàn trả. <em>Quyền quản lý gốc trên hệ thống không bị thay đổi.</em>
            </div>

            <div class="grid-2">
              <div class="form-group">
                <label class="form-label">Đơn vị cho mượn xe <span class="required">*</span></label>
                <input
                  v-model="newHandoverFromTeam"
                  type="text"
                  list="unitPresetsList"
                  class="form-input"
                  placeholder="Ví dụ: Trạm Cán 2"
                />
              </div>
              <div class="form-group">
                <label class="form-label">Đơn vị mượn xe <span class="required">*</span></label>
                <input
                  v-model="newHandoverToTeam"
                  type="text"
                  list="unitPresetsList"
                  class="form-input"
                  placeholder="Ví dụ: Trạm Cán 1"
                />
              </div>
            </div>

            <div class="grid-2">
              <div class="form-group">
                <label class="form-label">Người đại diện bên cho mượn</label>
                <input v-model="newHandoverFromManager" type="text" class="form-input" placeholder="Ví dụ: Quản lý Trạm Cán 2 (Lê Văn B)" />
              </div>
              <div class="form-group">
                <label class="form-label">Người đại diện bên mượn xe</label>
                <input v-model="newHandoverToManager" type="text" class="form-input" placeholder="Ví dụ: Quản lý Trạm Cán 1 (Nguyễn Văn A)" />
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Xe bị sự cố cần mượn xe này thay thế (Biển số / Tình trạng hỏng)</label>
              <input
                v-model="newHandoverReplacingVehicle"
                type="text"
                class="form-input"
                placeholder="Ví dụ: 93A-012.34 (Hỏng hộp số, đang chờ phụ tùng sửa chữa 5 ngày)"
              />
            </div>

            <div class="grid-2">
              <div class="form-group">
                <label class="form-label">Thời điểm bắt đầu mượn <span class="required">*</span></label>
                <input v-model="newHandoverBorrowTime" type="datetime-local" class="form-input" />
              </div>
              <div class="form-group">
                <label class="form-label">Thời điểm dự kiến hoàn trả <span class="required">*</span></label>
                <input v-model="newHandoverReturnTime" type="datetime-local" class="form-input" />
              </div>
            </div>

            <div class="grid-2">
              <div class="form-group">
                <label class="form-label">Chỉ số ODO lúc bàn giao mượn (km) <span class="required">*</span></label>
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
                  <option value="10%">10%</option>
                </select>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Ghi chú hiện trạng & cam kết mượn xe</label>
              <textarea
                v-model="newHandoverNotes"
                class="form-input"
                rows="2"
                placeholder="Ví dụ: Thân vỏ nguyên vẹn, lốp tốt, mượn phục vụ thu gom mủ 5 ngày, cam kết rửa sạch và trả đủ mức dầu..."
              ></textarea>
            </div>
          </div>

          <!-- ==================== NHÁNH 2: ĐIỀU CHUYỂN XE ==================== -->
          <div v-else-if="newHandoverWorkflowType === 'TRANSFER'" class="handover-branch-box">
            <div class="p-3 mb-3 rounded border" style="background-color: #eff6ff; border-color: #bfdbfe; font-size: 0.8125rem; color: #1e40af;">
              <strong>Quy trình điều chuyển xe:</strong> Chuyển giao hẳn quyền quản lý phương tiện sang đơn vị mới theo quyết định của công ty/tổng công ty. <em>Hệ thống sẽ tự động cập nhật đơn vị phụ trách mới trong danh sách phương tiện.</em>
            </div>

            <div class="grid-2">
              <div class="form-group">
                <label class="form-label">Đơn vị quản lý cũ (Bên giao) <span class="required">*</span></label>
                <input
                  v-model="newHandoverFromTeam"
                  type="text"
                  list="unitPresetsList"
                  class="form-input"
                  placeholder="Ví dụ: Trạm Cán 1"
                />
              </div>
              <div class="form-group">
                <label class="form-label">Đơn vị tiếp nhận mới (Bên nhận) <span class="required">*</span></label>
                <input
                  v-model="newHandoverToTeam"
                  type="text"
                  list="unitPresetsList"
                  class="form-input"
                  placeholder="Ví dụ: Trạm Cán 2"
                />
              </div>
            </div>

            <div class="grid-2">
              <div class="form-group">
                <label class="form-label">Số quyết định điều chuyển <span class="required">*</span></label>
                <input
                  v-model="newHandoverDecisionNumber"
                  type="text"
                  class="form-input"
                  placeholder="Ví dụ: 45/QĐ-TCT-2026"
                />
              </div>
              <div class="form-group">
                <label class="form-label">Ngày hiệu lực quyết định <span class="required">*</span></label>
                <input v-model="newHandoverEffectiveDate" type="date" class="form-input" />
              </div>
            </div>

            <div class="grid-2">
              <div class="form-group">
                <label class="form-label">Đại diện bên giao (Họ tên / Chức vụ)</label>
                <input v-model="newHandoverFromManager" type="text" class="form-input" placeholder="Ví dụ: Nguyễn Văn A (Phụ trách Trạm Cán 1)" />
              </div>
              <div class="form-group">
                <label class="form-label">Đại diện bên nhận (Họ tên / Chức vụ)</label>
                <input v-model="newHandoverToManager" type="text" class="form-input" placeholder="Ví dụ: Lê Văn B (Phụ trách Trạm Cán 2)" />
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Căn cứ & Lý do điều chuyển quyền quản lý <span class="required">*</span></label>
              <textarea
                v-model="newHandoverTransferReason"
                class="form-input"
                rows="2"
                placeholder="Ví dụ: Thực hiện QĐ-45 về việc sắp xếp lại cơ cấu phân bổ phương tiện vận tải phục vụ cao điểm thu gom mủ tại Trạm Cán 2"
              ></textarea>
            </div>

            <div class="grid-2">
              <div class="form-group">
                <label class="form-label">Chỉ số ODO tại thời điểm điều chuyển (km)</label>
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
                  <option value="10%">10%</option>
                </select>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Hồ sơ, giấy tờ bàn giao kèm theo</label>
              <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-top: 4px;">
                <label
                  v-for="doc in ['Cà vẹt xe bản chính', 'Sổ chứng nhận kiểm định an toàn kỹ thuật', 'Bảo hiểm TNDS bắt buộc', 'Thẻ nhiên liệu FleetCard', 'Sổ theo dõi lịch sử bảo dưỡng', 'Chìa khóa gốc & phụ']"
                  :key="doc"
                  class="flex items-center gap-2 p-2 rounded border"
                  :style="{ backgroundColor: selectedHandoverDocs.includes(doc) ? '#f0fdf4' : '#ffffff', borderColor: selectedHandoverDocs.includes(doc) ? '#86efac' : '#e2e8f0', cursor: 'pointer', fontSize: '0.8125rem' }"
                >
                  <input
                    type="checkbox"
                    :value="doc"
                    v-model="selectedHandoverDocs"
                    style="accent-color: #15803d; width: 15px; height: 15px;"
                  />
                  <span>{{ doc }}</span>
                </label>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Ghi chú hiện trạng pháp lý & kỹ thuật</label>
              <textarea
                v-model="newHandoverNotes"
                class="form-input"
                rows="2"
                placeholder="Ví dụ: Bàn giao toàn bộ quyền sử dụng xe cùng đầy đủ hồ sơ pháp lý, xe trong trạng thái vận hành tốt..."
              ></textarea>
            </div>
          </div>

          <!-- ==================== NHÁNH 3: BÀN GIAO HIỆN TRẠNG TÀI XẾ ==================== -->
          <div v-else class="handover-branch-box">
            <div class="p-3 mb-3 rounded border" style="background-color: #faf5ff; border-color: #e9d5ff; font-size: 0.8125rem; color: #6b21a8;">
              <strong>Quy trình bàn giao tài xế:</strong> Lập biên bản kiểm tra hiện trạng kỹ thuật xe khi thay đổi tài xế phụ trách (nghỉ việc, hoán đổi xe, hoặc phân công tài xế mới). <em>Hệ thống sẽ tự động gán tài xế nhận xe làm người phụ trách chính của phương tiện.</em>
            </div>

            <div class="grid-2">
              <div class="form-group">
                <label class="form-label">Lý do bàn giao hiện trạng <span class="required">*</span></label>
                <select v-model="newHandoverReasonType" class="form-select">
                  <option value="DRIVER_SWAP">Hoán đổi tài xế quản lý xe</option>
                  <option value="RESIGNATION">Tài xế nghỉ việc / Chuyển công tác</option>
                  <option value="NEW_ASSIGNMENT">Phân công tài xế mới phụ trách</option>
                  <option value="SHIFT_CHANGE">Đổi ca dài hạn</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Thời điểm bàn giao xe <span class="required">*</span></label>
                <input v-model="newHandoverBorrowTime" type="datetime-local" class="form-input" />
              </div>
            </div>

            <div class="grid-2">
              <div class="form-group">
                <label class="form-label">Tài xế bàn giao (Cũ / Trả xe) <span class="required">*</span></label>
                <div class="driver-select-row">
                  <select v-model="newHandoverFromDriver" class="form-select">
                    <option v-for="d in fleetStore.drivers" :key="d.id" :value="d.fullName">
                      {{ d.fullName }} ({{ d.licenseClass }})
                    </option>
                  </select>
                  <button
                    type="button"
                    class="btn btn-secondary btn-sm"
                    :disabled="!newHandoverFromDriver"
                    @click="openDriverDetailByName(newHandoverFromDriver)"
                  >
                    Xem hồ sơ
                  </button>
                </div>
              </div>

              <div class="form-group">
                <label class="form-label">Tài xế tiếp nhận (Mới) <span class="required">*</span></label>
                <div class="driver-select-row">
                  <select v-model="newHandoverDriver" class="form-select">
                    <option v-for="d in fleetStore.drivers" :key="d.id" :value="d.fullName">
                      {{ d.fullName }} ({{ d.licenseClass }})
                    </option>
                  </select>
                  <button
                    type="button"
                    class="btn btn-secondary btn-sm"
                    :disabled="!newHandoverDriver"
                    @click="openDriverDetailByName(newHandoverDriver)"
                  >
                    Xem hồ sơ
                  </button>
                </div>
              </div>
            </div>

            <div class="grid-2">
              <div class="form-group">
                <label class="form-label">Chỉ số ODO lúc bàn giao (km) <span class="required">*</span></label>
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
                  <option value="10%">10%</option>
                </select>
              </div>
            </div>

            <!-- Bảng Checklist kiểm tra hiện trạng xe -->
            <div class="form-group">
              <label class="form-label" style="font-weight: 700;">
                Bảng checklist kiểm tra hiện trạng kỹ thuật xe (6 tiêu chí)
              </label>
              <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-top: 6px;">
                <label
                  class="flex items-center gap-2 p-2 rounded border"
                  :style="{ backgroundColor: newHandoverChecklist.bodyAndPaint ? '#f0fdf4' : '#fff1f2', borderColor: newHandoverChecklist.bodyAndPaint ? '#86efac' : '#fca5a5', cursor: 'pointer' }"
                >
                  <input type="checkbox" v-model="newHandoverChecklist.bodyAndPaint" style="accent-color: #15803d; width: 16px; height: 16px;" />
                  <span style="font-size: 0.8125rem;">
                    <strong>Thân vỏ & sơn:</strong> Không móp méo, trầy xước nặng
                  </span>
                </label>
                <label
                  class="flex items-center gap-2 p-2 rounded border"
                  :style="{ backgroundColor: newHandoverChecklist.brakesAndLights ? '#f0fdf4' : '#fff1f2', borderColor: newHandoverChecklist.brakesAndLights ? '#86efac' : '#fca5a5', cursor: 'pointer' }"
                >
                  <input type="checkbox" v-model="newHandoverChecklist.brakesAndLights" style="accent-color: #15803d; width: 16px; height: 16px;" />
                  <span style="font-size: 0.8125rem;">
                    <strong>Phanh & đèn còi:</strong> Hệ thống an toàn hoạt động chuẩn
                  </span>
                </label>
                <label
                  class="flex items-center gap-2 p-2 rounded border"
                  :style="{ backgroundColor: newHandoverChecklist.tiresAndSpare ? '#f0fdf4' : '#fff1f2', borderColor: newHandoverChecklist.tiresAndSpare ? '#86efac' : '#fca5a5', cursor: 'pointer' }"
                >
                  <input type="checkbox" v-model="newHandoverChecklist.tiresAndSpare" style="accent-color: #15803d; width: 16px; height: 16px;" />
                  <span style="font-size: 0.8125rem;">
                    <strong>Lốp xe & lốp dự phòng:</strong> Độ mòn đạt chuẩn, áp suất tốt
                  </span>
                </label>
                <label
                  class="flex items-center gap-2 p-2 rounded border"
                  :style="{ backgroundColor: newHandoverChecklist.cleanliness ? '#f0fdf4' : '#fff1f2', borderColor: newHandoverChecklist.cleanliness ? '#86efac' : '#fca5a5', cursor: 'pointer' }"
                >
                  <input type="checkbox" v-model="newHandoverChecklist.cleanliness" style="accent-color: #15803d; width: 16px; height: 16px;" />
                  <span style="font-size: 0.8125rem;">
                    <strong>Vệ sinh cabin & bồn:</strong> Sạch sẽ, gọn gàng
                  </span>
                </label>
                <label
                  class="flex items-center gap-2 p-2 rounded border"
                  :style="{ backgroundColor: newHandoverChecklist.toolsAndJack ? '#f0fdf4' : '#fff1f2', borderColor: newHandoverChecklist.toolsAndJack ? '#86efac' : '#fca5a5', cursor: 'pointer' }"
                >
                  <input type="checkbox" v-model="newHandoverChecklist.toolsAndJack" style="accent-color: #15803d; width: 16px; height: 16px;" />
                  <span style="font-size: 0.8125rem;">
                    <strong>Bộ đồ nghề & con đội:</strong> Đầy đủ kích lốp, tam giác phản quang
                  </span>
                </label>
                <label
                  class="flex items-center gap-2 p-2 rounded border"
                  :style="{ backgroundColor: newHandoverChecklist.documents ? '#f0fdf4' : '#fff1f2', borderColor: newHandoverChecklist.documents ? '#86efac' : '#fca5a5', cursor: 'pointer' }"
                >
                  <input type="checkbox" v-model="newHandoverChecklist.documents" style="accent-color: #15803d; width: 16px; height: 16px;" />
                  <span style="font-size: 0.8125rem;">
                    <strong>Giấy tờ & Thẻ nhiên liệu:</strong> Đăng kiểm, bảo hiểm, cà vẹt
                  </span>
                </label>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Ghi chú chi tiết vết trầy xước / tình trạng phụ tùng</label>
              <textarea
                v-model="newHandoverNotes"
                class="form-input"
                rows="2"
                placeholder="Ví dụ: Xe sạch, có vết xước nhẹ cửa phụ bên phải từ trước, lốp phụ nguyên vẹn, 2 chìa khóa..."
              ></textarea>
            </div>
          </div>

          <!-- Datalist presets -->
          <datalist id="unitPresetsList">
            <option v-for="unit in standardUnitPresets" :key="unit" :value="unit" />
          </datalist>
        </div>

        <div class="modal-footer">
          <button class="btn btn-secondary" @click="showAddHandoverModal = false">Hủy</button>
          <button class="btn btn-primary" @click="handleAddHandover">
            <template v-if="editingHandover">Lưu Thay Đổi</template>
            <template v-else>
              {{
                newHandoverWorkflowType === 'BORROW_RETURN'
                  ? 'Lập Phiếu Mượn Xe'
                  : newHandoverWorkflowType === 'TRANSFER'
                    ? 'Lập Lệnh Điều Chuyển'
                    : 'Lập Biên Bản Bàn Giao'
              }}
            </template>
          </button>
        </div>
      </div>
    </div>

    <!-- Modal: Xem chi tiết phiếu bàn giao / điều chuyển / mượn trả -->
    <div v-if="showHandoverDetailModal && viewingHandover" class="modal-backdrop" @click.self="showHandoverDetailModal = false">
      <div class="modal-content" style="max-width: 720px;">
        <div class="modal-header flex-between">
          <div>
            <span
              class="badge mr-2"
              :class="{
                'badge-success': viewingHandover.workflowType === 'BORROW_RETURN',
                'badge-info': viewingHandover.workflowType === 'TRANSFER',
                'badge-warning': viewingHandover.workflowType === 'DRIVER_HANDOVER' || viewingHandover.workflowType === 'HANDOVER',
              }"
            >
              {{ getHandoverWorkflowLabel(viewingHandover.workflowType) }}
            </span>
            <span class="badge" :class="getHandoverStatusClass(viewingHandover.status)">
              {{ getHandoverStatusLabel(viewingHandover.status, viewingHandover.workflowType) }}
            </span>
          </div>
          <h3 class="modal-title" style="margin-top: 4px;">
            Chi Tiết {{ getHandoverWorkflowLabel(viewingHandover.workflowType) }} [{{ viewingHandover.vehiclePlate }}]
          </h3>
        </div>

        <div class="modal-body">
          <!-- Common vehicle overview -->
          <div class="p-3 mb-3 bg-light rounded border flex-between">
            <div>
              <div style="font-size: 0.75rem; color: #64748b; font-weight: 600;">BIỂN SỐ PHƯƠNG TIỆN</div>
              <div style="font-size: 1.125rem; font-weight: 800; color: #15803d;">{{ viewingHandover.vehiclePlate }}</div>
            </div>
            <div>
              <div style="font-size: 0.75rem; color: #64748b; font-weight: 600;">ODO BÀN GIAO</div>
              <div style="font-size: 0.9375rem; font-weight: 700; color: #1e293b;">{{ viewingHandover.handoverOdo.toLocaleString() }} km</div>
            </div>
            <div>
              <div style="font-size: 0.75rem; color: #64748b; font-weight: 600;">MỨC NHIÊN LIỆU</div>
              <div style="font-size: 0.9375rem; font-weight: 700; color: #1e293b;">{{ viewingHandover.fuelLevel || '—' }}</div>
            </div>
            <div>
              <div style="font-size: 0.75rem; color: #64748b; font-weight: 600;">THỜI ĐIỂM TẠO</div>
              <div style="font-size: 0.8125rem; color: #475569;">{{ viewingHandover.borrowStartAt || viewingHandover.createdAt || '—' }}</div>
            </div>
          </div>

          <!-- BRANCH 1: BORROW_RETURN -->
          <div v-if="viewingHandover.workflowType === 'BORROW_RETURN'">
            <div class="grid-2 mb-3">
              <div class="p-3 rounded border" style="background-color: #f8fafc;">
                <div style="font-size: 0.75rem; font-weight: 700; color: #64748b; margin-bottom: 4px;">ĐƠN VỊ CHO MƯỢN</div>
                <div style="font-size: 0.9375rem; font-weight: 700; color: #1e293b;">{{ viewingHandover.fromTeam || '—' }}</div>
                <div v-if="viewingHandover.fromManagerName" style="font-size: 0.8125rem; color: #64748b; margin-top: 2px;">
                  Đại diện: <strong>{{ viewingHandover.fromManagerName }}</strong>
                </div>
              </div>
              <div class="p-3 rounded border" style="background-color: #f0fdf4; border-color: #bbf7d0;">
                <div style="font-size: 0.75rem; font-weight: 700; color: #166534; margin-bottom: 4px;">ĐƠN VỊ MƯỢN XE</div>
                <div style="font-size: 0.9375rem; font-weight: 700; color: #15803d;">{{ viewingHandover.toTeam || '—' }}</div>
                <div v-if="viewingHandover.toManagerName" style="font-size: 0.8125rem; color: #166534; margin-top: 2px;">
                  Đại diện: <strong>{{ viewingHandover.toManagerName }}</strong>
                </div>
              </div>
            </div>

            <div v-if="viewingHandover.replacingVehiclePlate" class="p-3 mb-3 rounded border" style="background-color: #fefce8; border-color: #fef08a;">
              <div style="font-size: 0.75rem; font-weight: 700; color: #854d0e;">XE BỊ HỎNG CẦN CHI VIỆN THAY THẾ:</div>
              <div style="font-size: 0.875rem; font-weight: 600; color: #713f12; margin-top: 2px;">{{ viewingHandover.replacingVehiclePlate }}</div>
            </div>

            <div class="grid-2 mb-3">
              <div class="form-group">
                <label class="form-label">Thời điểm dự kiến trả</label>
                <div class="p-3 bg-light rounded">{{ viewingHandover.expectedReturnAt || 'Không xác định' }}</div>
              </div>
              <div class="form-group">
                <label class="form-label">Thời điểm hoàn trả thực tế</label>
                <div class="p-3 bg-light rounded" :style="{ color: viewingHandover.actualReturnAt ? '#15803d' : '#64748b', fontWeight: viewingHandover.actualReturnAt ? 700 : 400 }">
                  {{ viewingHandover.actualReturnAt || 'Đang mượn xe' }}
                </div>
              </div>
            </div>

            <div v-if="viewingHandover.returnOdo" class="grid-2 mb-3">
              <div class="form-group">
                <label class="form-label">ODO khi hoàn trả</label>
                <div class="p-3 bg-light rounded font-bold">{{ viewingHandover.returnOdo.toLocaleString() }} km (Chạy thêm: {{ (viewingHandover.returnOdo - viewingHandover.handoverOdo).toLocaleString() }} km)</div>
              </div>
              <div class="form-group">
                <label class="form-label">Mức xăng dầu khi hoàn trả</label>
                <div class="p-3 bg-light rounded font-bold">{{ viewingHandover.returnFuelLevel || '—' }}</div>
              </div>
            </div>
          </div>

          <!-- BRANCH 2: TRANSFER -->
          <div v-else-if="viewingHandover.workflowType === 'TRANSFER'">
            <div class="p-3 mb-3 rounded border" style="background-color: #eff6ff; border-color: #bfdbfe;">
              <div class="grid-2">
                <div>
                  <div style="font-size: 0.75rem; font-weight: 700; color: #1e40af;">SỐ QUYẾT ĐỊNH ĐIỀU CHUYỂN</div>
                  <div style="font-size: 1rem; font-weight: 800; color: #1e3a8a;">{{ viewingHandover.decisionNumber || '—' }}</div>
                </div>
                <div>
                  <div style="font-size: 0.75rem; font-weight: 700; color: #1e40af;">NGÀY HIỆU LỰC</div>
                  <div style="font-size: 0.9375rem; font-weight: 700; color: #1e3a8a;">{{ viewingHandover.effectiveDate || viewingHandover.borrowStartAt?.slice(0, 10) || '—' }}</div>
                </div>
              </div>
            </div>

            <div class="grid-2 mb-3">
              <div class="p-3 rounded border" style="background-color: #f8fafc;">
                <div style="font-size: 0.75rem; font-weight: 700; color: #64748b; margin-bottom: 4px;">ĐƠN VỊ BÀN GIAO (CŨ)</div>
                <div style="font-size: 0.9375rem; font-weight: 700; color: #1e293b;">{{ viewingHandover.fromTeam || '—' }}</div>
                <div v-if="viewingHandover.fromManagerName" style="font-size: 0.8125rem; color: #64748b; margin-top: 2px;">
                  Đại diện: <strong>{{ viewingHandover.fromManagerName }}</strong>
                </div>
              </div>
              <div class="p-3 rounded border" style="background-color: #f0fdf4; border-color: #bbf7d0;">
                <div style="font-size: 0.75rem; font-weight: 700; color: #166534; margin-bottom: 4px;">ĐƠN VỊ TIẾP NHẬN (MỚI)</div>
                <div style="font-size: 0.9375rem; font-weight: 700; color: #15803d;">{{ viewingHandover.toTeam || '—' }}</div>
                <div v-if="viewingHandover.toManagerName" style="font-size: 0.8125rem; color: #166534; margin-top: 2px;">
                  Đại diện: <strong>{{ viewingHandover.toManagerName }}</strong>
                </div>
              </div>
            </div>

            <div v-if="viewingHandover.transferReason" class="form-group mb-3">
              <label class="form-label">Lý do điều chuyển quyền quản lý</label>
              <div class="p-3 bg-light rounded">{{ viewingHandover.transferReason }}</div>
            </div>

            <div v-if="viewingHandover.handoverDocuments?.length" class="form-group mb-3">
              <label class="form-label">Hồ sơ giấy tờ bàn giao kèm theo ({{ viewingHandover.handoverDocuments.length }})</label>
              <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px;">
                <span
                  v-for="doc in viewingHandover.handoverDocuments"
                  :key="doc"
                  class="badge badge-secondary"
                  style="font-size: 0.8125rem; padding: 4px 10px;"
                >
                  ✓ {{ doc }}
                </span>
              </div>
            </div>
          </div>

          <!-- BRANCH 3: DRIVER_HANDOVER -->
          <div v-else>
            <div class="p-3 mb-3 rounded border" style="background-color: #faf5ff; border-color: #e9d5ff;">
              <div class="flex-between">
                <div>
                  <div style="font-size: 0.75rem; font-weight: 700; color: #6b21a8;">LÝ DO BÀN GIAO TÀI XẾ</div>
                  <div style="font-size: 0.9375rem; font-weight: 700; color: #581c87;">
                    {{ getReasonTypeLabel(viewingHandover.handoverReasonType) }}
                  </div>
                </div>
                <div style="text-align: right;">
                  <div style="font-size: 0.75rem; font-weight: 700; color: #6b21a8;">KẾT QUẢ CHECKLIST</div>
                  <div style="font-size: 0.9375rem; font-weight: 800; color: #15803d;">
                    {{ countChecklistItems(viewingHandover.handoverChecklist).passed }} / {{ countChecklistItems(viewingHandover.handoverChecklist).total }} tiêu chí ĐẠT
                  </div>
                </div>
              </div>
            </div>

            <div class="grid-2 mb-3">
              <div class="p-3 rounded border" style="background-color: #f8fafc;">
                <div style="font-size: 0.75rem; font-weight: 700; color: #64748b; margin-bottom: 4px;">TÀI XẾ BÀN GIAO (CŨ)</div>
                <div style="font-size: 0.9375rem; font-weight: 700; color: #1e293b;">
                  {{ viewingHandover.fromDriverName || getDriverNameById(viewingHandover.fromDriverId) || '—' }}
                </div>
              </div>
              <div class="p-3 rounded border" style="background-color: #f0fdf4; border-color: #bbf7d0;">
                <div style="font-size: 0.75rem; font-weight: 700; color: #166534; margin-bottom: 4px;">TÀI XẾ TIẾP NHẬN (MỚI)</div>
                <div style="font-size: 0.9375rem; font-weight: 700; color: #15803d;">
                  {{ viewingHandover.toDriverName || viewingHandover.driverName || '—' }}
                </div>
              </div>
            </div>

            <!-- Bảng checklist 6 tiêu chuẩn trực quan -->
            <div v-if="viewingHandover.handoverChecklist" class="form-group mb-3">
              <label class="form-label" style="font-weight: 700;">Checklist hiện trạng kỹ thuật bàn giao</label>
              <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-top: 4px;">
                <div
                  class="p-2 rounded border flex items-center justify-between"
                  :style="{ backgroundColor: viewingHandover.handoverChecklist.bodyAndPaint ? '#f0fdf4' : '#fff1f2', borderColor: viewingHandover.handoverChecklist.bodyAndPaint ? '#bbf7d0' : '#fecdd3', fontSize: '0.8125rem' }"
                >
                  <span>Thân vỏ, nước sơn</span>
                  <span :style="{ fontWeight: 700, color: viewingHandover.handoverChecklist.bodyAndPaint ? '#15803d' : '#e11d48' }">
                    {{ viewingHandover.handoverChecklist.bodyAndPaint ? '✓ Đạt chuẩn' : '✗ Có lỗi' }}
                  </span>
                </div>
                <div
                  class="p-2 rounded border flex items-center justify-between"
                  :style="{ backgroundColor: viewingHandover.handoverChecklist.brakesAndLights ? '#f0fdf4' : '#fff1f2', borderColor: viewingHandover.handoverChecklist.brakesAndLights ? '#bbf7d0' : '#fecdd3', fontSize: '0.8125rem' }"
                >
                  <span>Hệ thống phanh, đèn còi</span>
                  <span :style="{ fontWeight: 700, color: viewingHandover.handoverChecklist.brakesAndLights ? '#15803d' : '#e11d48' }">
                    {{ viewingHandover.handoverChecklist.brakesAndLights ? '✓ Đạt chuẩn' : '✗ Có lỗi' }}
                  </span>
                </div>
                <div
                  class="p-2 rounded border flex items-center justify-between"
                  :style="{ backgroundColor: viewingHandover.handoverChecklist.tiresAndSpare ? '#f0fdf4' : '#fff1f2', borderColor: viewingHandover.handoverChecklist.tiresAndSpare ? '#bbf7d0' : '#fecdd3', fontSize: '0.8125rem' }"
                >
                  <span>Lốp xe & lốp dự phòng</span>
                  <span :style="{ fontWeight: 700, color: viewingHandover.handoverChecklist.tiresAndSpare ? '#15803d' : '#e11d48' }">
                    {{ viewingHandover.handoverChecklist.tiresAndSpare ? '✓ Đạt chuẩn' : '✗ Có lỗi' }}
                  </span>
                </div>
                <div
                  class="p-2 rounded border flex items-center justify-between"
                  :style="{ backgroundColor: viewingHandover.handoverChecklist.cleanliness ? '#f0fdf4' : '#fff1f2', borderColor: viewingHandover.handoverChecklist.cleanliness ? '#bbf7d0' : '#fecdd3', fontSize: '0.8125rem' }"
                >
                  <span>Vệ sinh cabin & bồn</span>
                  <span :style="{ fontWeight: 700, color: viewingHandover.handoverChecklist.cleanliness ? '#15803d' : '#e11d48' }">
                    {{ viewingHandover.handoverChecklist.cleanliness ? '✓ Đạt chuẩn' : '✗ Có lỗi' }}
                  </span>
                </div>
                <div
                  class="p-2 rounded border flex items-center justify-between"
                  :style="{ backgroundColor: viewingHandover.handoverChecklist.toolsAndJack ? '#f0fdf4' : '#fff1f2', borderColor: viewingHandover.handoverChecklist.toolsAndJack ? '#bbf7d0' : '#fecdd3', fontSize: '0.8125rem' }"
                >
                  <span>Bộ đồ nghề, con đội</span>
                  <span :style="{ fontWeight: 700, color: viewingHandover.handoverChecklist.toolsAndJack ? '#15803d' : '#e11d48' }">
                    {{ viewingHandover.handoverChecklist.toolsAndJack ? '✓ Đạt chuẩn' : '✗ Có lỗi' }}
                  </span>
                </div>
                <div
                  class="p-2 rounded border flex items-center justify-between"
                  :style="{ backgroundColor: viewingHandover.handoverChecklist.documents ? '#f0fdf4' : '#fff1f2', borderColor: viewingHandover.handoverChecklist.documents ? '#bbf7d0' : '#fecdd3', fontSize: '0.8125rem' }"
                >
                  <span>Đầy đủ hồ sơ giấy tờ xe</span>
                  <span :style="{ fontWeight: 700, color: viewingHandover.handoverChecklist.documents ? '#15803d' : '#e11d48' }">
                    {{ viewingHandover.handoverChecklist.documents ? '✓ Đạt chuẩn' : '✗ Có lỗi' }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- Common condition notes & image -->
          <div class="form-group mb-3">
            <label class="form-label">Hiện trạng phương tiện & Ghi chú thỏa thuận</label>
            <div class="p-3 bg-light rounded" style="font-size: 0.875rem;">
              {{ viewingHandover.conditionNotes || viewingHandover.note || 'Không có ghi chú thêm.' }}
            </div>
          </div>

          <div v-if="viewingHandover.handoverImageUrl" class="form-group mb-3">
            <label class="form-label">Hình ảnh hiện trạng xe lúc bàn giao</label>
            <div class="p-2 bg-light rounded border text-center">
              <img :src="viewingHandover.handoverImageUrl" alt="Hình ảnh hiện trạng xe" style="max-height: 220px; max-width: 100%; object-fit: contain;" />
            </div>
          </div>
        </div>

        <div class="modal-footer flex-between">
          <div>
            <button
              v-if="viewingHandover.workflowType === 'BORROW_RETURN' && viewingHandover.status === 'BORROWING'"
              class="btn btn-primary btn-sm"
              @click="showHandoverDetailModal = false; openReturnHandoverModal(viewingHandover, 'RETURN')"
            >
              Hoàn Trả Xe Này
            </button>
          </div>
          <button class="btn btn-secondary" @click="showHandoverDetailModal = false">Đóng</button>
        </div>
      </div>
    </div>

    <!-- Modal: Biên bản hoàn trả xe về đơn vị gốc -->
    <div v-if="showReturnHandoverModal && returningHandover" class="modal-backdrop" @click.self="showReturnHandoverModal = false">
      <div class="modal-content" style="max-width: 620px;">
        <div class="modal-header">
          <h3 class="modal-title">
            {{
              returningHandover.workflowType === 'BORROW_RETURN'
                ? 'Biên Bản Hoàn Trả Xe Về Đơn Vị Gốc'
                : 'Biên Bản Thu Hồi / Hoàn Tất Bàn Giao Xe'
            }}
          </h3>
        </div>

        <div class="modal-body">
          <div class="p-3 mb-3 bg-light rounded border flex-between">
            <div>
              <div style="font-size: 0.75rem; color: #64748b; font-weight: 600;">PHƯƠNG TIỆN HOÀN TRẢ</div>
              <div style="font-size: 1.125rem; font-weight: 800; color: #15803d;">{{ returningHandover.vehiclePlate }}</div>
            </div>
            <div>
              <div style="font-size: 0.75rem; color: #64748b; font-weight: 600;">ĐƠN VỊ ĐANG MƯỢN</div>
              <div style="font-size: 0.9375rem; font-weight: 700; color: #1e293b;">{{ returningHandover.toTeam || '—' }}</div>
            </div>
            <div>
              <div style="font-size: 0.75rem; color: #64748b; font-weight: 600;">ĐƠN VỊ NHẬN LẠI (GỐC)</div>
              <div style="font-size: 0.9375rem; font-weight: 700; color: #15803d;">{{ returningHandover.fromTeam || '—' }}</div>
            </div>
          </div>

          <div class="grid-2">
            <div class="form-group">
              <label class="form-label">Thời điểm hoàn trả thực tế <span class="required">*</span></label>
              <input v-model="returnHandoverActualTime" type="datetime-local" class="form-input" />
            </div>

            <div class="form-group">
              <label class="form-label">
                ODO lúc trả (km) <span class="required">*</span>
                <span style="font-size: 0.75rem; color: #64748b; font-weight: normal;">(Gốc: {{ returningHandover.handoverOdo.toLocaleString() }} km)</span>
              </label>
              <input v-model.number="returnHandoverOdo" type="number" class="form-input" :min="returningHandover.handoverOdo" />
            </div>
          </div>

          <div class="grid-2">
            <div class="form-group">
              <label class="form-label">Mức nhiên liệu thực tế khi trả xe <span class="required">*</span></label>
              <select v-model="returnHandoverFuel" class="form-select">
                <option value="100%">100% (Đầy bình)</option>
                <option value="90%">90%</option>
                <option value="80%">80%</option>
                <option value="70%">70%</option>
                <option value="50%">50% (Nửa bình)</option>
                <option value="30%">30%</option>
                <option value="10%">10%</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Đại diện bên nhận bàn giao lại</label>
              <input
                :value="returningHandover.fromManagerName || returningHandover.fromTeam"
                type="text"
                class="form-input"
                readonly
                style="background-color: #f8fafc;"
              />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Ảnh kiểm tra hiện trạng xe khi nhận lại</label>
            <input type="file" accept="image/*" class="form-input" @change="handleReturnHandoverImageUpload" />
            <div v-if="returnHandoverImageUrl" class="mt-2 p-2 bg-light rounded border text-center">
              <img :src="returnHandoverImageUrl" alt="Hình ảnh trạng thái xe" style="max-height: 180px; max-width: 100%; object-fit: contain;" />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Đánh giá hiện trạng khi hoàn trả & ghi chú bàn giao</label>
            <textarea
              v-model="returnHandoverNotes"
              class="form-input"
              rows="3"
              placeholder="Ví dụ: Đơn vị đã vệ sinh xe sạch sẽ, lốp và áp suất đầy đủ, bình dầu còn 90% đúng cam kết, không phát sinh trầy xước..."
            ></textarea>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn btn-secondary" @click="showReturnHandoverModal = false">Hủy</button>
          <button class="btn btn-primary" @click="submitReturnHandover">
            {{ returningHandover.workflowType === 'BORROW_RETURN' ? 'Xác Nhận Hoàn Trả Xe Về Đơn Vị' : 'Lưu Biên Bản Hoàn Tất' }}
          </button>
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
          
          <!-- Phân công xe thuê ngoài vs xe công ty -->
          <div v-if="assignVehicle?.isExternal" class="mt-3">
            <div class="alert alert-info py-2 px-3 mb-3 text-xs flex-center gap-2" style="background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; border-radius: 6px;">
              <Info :size="16" />
              <span>Đây là <strong>Xe Thuê Ngoài</strong>, chỉ cần nhập trực tiếp tên tài xế đối tác (không thuộc danh sách tài xế nội bộ công ty).</span>
            </div>
            <div class="form-group">
              <label class="form-label">Họ tên tài xế xe thuê ngoài <span class="required">*</span></label>
              <input
                v-model="assignExternalDriverName"
                type="text"
                class="form-input"
                placeholder="Nhập họ tên tài xế của đơn vị đối tác..."
              />
            </div>
            <div class="form-group mt-2">
              <label class="form-label">Số điện thoại liên hệ</label>
              <input
                v-model="assignExternalDriverPhone"
                type="text"
                class="form-input"
                placeholder="VD: 0978 456 789"
              />
            </div>
          </div>

          <div v-else class="form-group mt-3" style="margin-top: 1rem;">
            <label class="form-label">Chọn Tài xế nội bộ phụ trách <span class="required">*</span></label>
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
.veh-status-badge.status-duemaintenance { background: #fef3c7; color: #b45309; border: 1px solid #fde68a; }
.veh-status-badge.status-undermaintenance { background: #fee2e2; color: #b91c1c; }
.veh-status-badge.status-broken { background: #fee2e2; color: #b91c1c; }

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
  border: 1px solid #fca5a5;
  font-size: 0.6875rem;
  font-weight: 800;
  padding: 2px 7px;
  border-radius: 4px;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  width: fit-content;
}

.badge-maintenance-note {
  background: #fef3c7;
  color: #b45309;
  border: 1px solid #fcd34d;
  font-size: 0.6875rem;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 4px;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  width: fit-content;
}

.note-overdue-box {
  display: inline-flex;
  flex-direction: column;
  gap: 1px;
}
.note-overdue-highlight {
  font-weight: 700;
  color: #b91c1c;
  font-size: 0.75rem;
}
.note-overdue-sub {
  color: #64748b;
  font-size: 0.6875rem;
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

.btn-small {
  padding: 7px 12px;
  font-size: 0.82rem;
}

.formula-action-row {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 8px;
}

.formula-preview-box {
  min-height: 42px;
  border: 1px solid #e5c39b;
  border-radius: 10px;
  background: #fffaf3;
  color: #7c2d12;
  padding: 10px 12px;
  font-size: 0.9rem;
  line-height: 1.5;
  word-break: break-word;
}

.formula-preview-box.empty {
  color: #a16207;
  font-style: italic;
}

.formula-modal-content {
  max-width: 900px;
  max-height: 90vh;
}

.formula-modal-content .modal-body {
  flex: 1 1 auto;
  min-height: 0;
  max-height: calc(90vh - 132px);
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

/* Action Column - Normal Flow */
.table th.sticky-action-col,
.table td.sticky-action-col {
  position: static;
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
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  padding: 12px 20px;
  background: #f8fafc;
  border-bottom: 1px solid var(--border-card, #d6e4d7);
}

.fleet-unit-filter-box {
  display: flex;
  align-items: center;
  gap: 8px;
}

.unit-filter-label {
  font-size: 0.8125rem;
  font-weight: 600;
  color: #475569;
  white-space: nowrap;
}

.unit-filter-select {
  padding: 6px 12px;
  font-size: 0.8125rem;
  font-weight: 600;
  color: #1e293b;
  background: #ffffff;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  outline: none;
  cursor: pointer;
  transition: all 0.2s ease;
  font-family: inherit;
}

.unit-filter-select:hover,
.unit-filter-select:focus {
  border-color: #059669;
  box-shadow: 0 0 0 2px rgba(5, 150, 105, 0.15);
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

/* Phân loại xe công ty / xe thuê ngoài */
.ownership-selection-group {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-top: 6px;
}

.ownership-check-card {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 14px;
  border: 1.5px solid #e2e8f0;
  border-radius: var(--radius-md, 8px);
  background: #f8fafc;
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
}

.ownership-check-card:hover {
  border-color: #cbd5e1;
  background: #f1f5f9;
}

.ownership-check-card.selected {
  border-color: #059669;
  background: #ecfdf5;
}

.ownership-checkbox {
  width: 18px;
  height: 18px;
  margin-top: 2px;
  accent-color: #059669;
  cursor: pointer;
}

.ownership-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.ownership-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.875rem;
  font-weight: 700;
  color: #1e293b;
}

.ownership-check-card.selected .ownership-title {
  color: #065f46;
}

.ownership-desc {
  font-size: 0.75rem;
  color: #64748b;
}

.ownership-badge-note {
  margin-top: 6px;
}

/* Đơn vị sử dụng (Đội / Nhà máy) trong bảng */
.unit-target-box {
  display: inline-flex;
  flex-direction: column;
  gap: 2px;
  align-items: flex-start;
}

.badge-unit-team {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  font-size: 0.6875rem;
  font-weight: 700;
  border-radius: 4px;
  background: #ecfdf5;
  color: #065f46;
  border: 1px solid #a7f3d0;
  text-transform: uppercase;
  letter-spacing: 0.025em;
}

.badge-unit-factory {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  font-size: 0.6875rem;
  font-weight: 700;
  border-radius: 4px;
  background: #f0f9ff;
  color: #0369a1;
  border: 1px solid #bae6fd;
  text-transform: uppercase;
  letter-spacing: 0.025em;
}

.unit-subtext {
  font-size: 0.75rem;
  line-height: 1.2;
}

/* Chọn đơn vị sử dụng trong modal thêm/sửa xe */
.unit-type-selection-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-top: 6px;
}

.unit-check-card {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 14px;
  border: 1.5px solid #e2e8f0;
  border-radius: var(--radius-md, 8px);
  background: #f8fafc;
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
}

.unit-check-card:hover {
  border-color: #cbd5e1;
  background: #f1f5f9;
}

.unit-check-card.selected {
  border-color: #059669;
  background: #ecfdf5;
}

.unit-radio {
  width: 18px;
  height: 18px;
  margin-top: 2px;
  accent-color: #059669;
  cursor: pointer;
}

.unit-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.unit-title {
  font-size: 0.875rem;
  font-weight: 700;
  color: #1e293b;
}

.unit-desc {
  font-size: 0.75rem;
  color: #64748b;
}

.team-select-subform {
  background: #f0fdf4;
  border: 1px dashed #86efac;
  border-radius: 8px;
  padding: 8px 12px;
}

.text-amber-600 {
  color: #d97706;
}

/* Handover Toolbar Redesign */
.handover-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  padding: 12px 20px;
  background: #f8fafc;
  border-bottom: 1px solid var(--border-subtle, #edf4ed);
}

.segmented-control {
  display: inline-flex;
  background: #e2e8f0;
  padding: 3px;
  border-radius: 8px;
  gap: 2px;
  flex-shrink: 0;
}

.segmented-tab {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  font-size: 0.8125rem;
  font-weight: 600;
  border: none;
  background: transparent;
  color: #475569;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
  font-family: inherit;
}

.segmented-tab.active {
  background: #15803d;
  color: #ffffff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
}

.segmented-tab:hover:not(.active) {
  color: #0f172a;
}

.handover-toolbar-right {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.handover-search-wrap {
  position: relative;
  display: flex;
  align-items: center;
  width: 260px;
}

.handover-search-ico {
  position: absolute;
  left: 12px;
  color: #94a3b8;
  pointer-events: none;
}

.handover-search-input {
  width: 100%;
  padding: 7px 32px 7px 34px;
  border-radius: 6px;
  border: 1px solid #cbd5e1;
  background-color: #ffffff;
  font-size: 0.8125rem;
  color: #0f172a;
  outline: none;
  transition: all 0.15s ease;
  font-family: inherit;
}

.handover-search-input:focus {
  border-color: #15803d;
  box-shadow: 0 0 0 2px rgba(21, 128, 61, 0.15);
}

.handover-filter-item {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.handover-filter-item .filter-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: #475569;
  white-space: nowrap;
}

.filter-select-input {
  padding: 6px 12px;
  border-radius: 6px;
  border: 1px solid #cbd5e1;
  background-color: #ffffff;
  font-size: 0.75rem;
  font-weight: 600;
  color: #0f172a;
  cursor: pointer;
  outline: none;
  transition: all 0.15s ease;
  font-family: inherit;
}

.filter-select-input:focus {
  border-color: #15803d;
  box-shadow: 0 0 0 2px rgba(21, 128, 61, 0.15);
}

.btn-clear-search {
  position: absolute;
  right: 8px;
  background: transparent;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  display: flex;
  align-items: center;
  padding: 2px;
}
.btn-clear-search:hover { color: #475569; }

/* Card chọn số chỗ ngồi quy chuẩn trải ngang đẹp mắt */
.seat-selection-card {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: var(--radius-md, 8px);
  padding: 12px 14px;
  margin-top: 4px;
  margin-bottom: 16px;
}

.seat-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.seat-card-label {
  font-size: 0.8125rem;
  font-weight: 700;
  color: #1e293b;
}

.seat-selected-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #ecfdf5;
  color: #15803d;
  border: 1px solid #a7f3d0;
  padding: 3px 10px;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 700;
}

.seat-none-badge {
  font-size: 0.75rem;
  color: #94a3b8;
  font-style: italic;
}

.btn-clear-seat-badge {
  background: transparent;
  border: none;
  color: #15803d;
  cursor: pointer;
  padding: 1px;
  display: flex;
  align-items: center;
  border-radius: 50%;
  line-height: 1;
}
.btn-clear-seat-badge:hover {
  background: #dcfce7;
  color: #b91c1c;
}

.seat-row-pills {
  display: grid;
  grid-template-columns: repeat(11, 1fr);
  gap: 6px;
  align-items: center;
}

.seat-row-pills.has-twelve {
  grid-template-columns: repeat(12, 1fr);
}

.btn-seat-pill {
  width: 100%;
  min-width: 0;
  padding: 7px 2px;
  border-radius: 6px;
  border: 1px solid #cbd5e1;
  background: #ffffff;
  color: #334155;
  font-size: 0.775rem;
  font-weight: 600;
  text-align: center;
  cursor: pointer;
  transition: all 0.15s cubic-bezier(0.16, 1, 0.3, 1);
  user-select: none;
  font-family: inherit;
  white-space: nowrap;
  box-sizing: border-box;
}

.btn-seat-pill:hover {
  border-color: #059669;
  background: #f0fdf4;
  color: #15803d;
  transform: translateY(-1px);
}

.btn-seat-pill.active {
  background: #15803d;
  color: #ffffff;
  border-color: #15803d;
  box-shadow: 0 2px 5px rgba(21, 128, 61, 0.25);
  font-weight: 700;
  transform: translateY(-1px);
}

@media (max-width: 640px) {
  .seat-row-pills {
    grid-template-columns: repeat(6, 1fr);
  }
  .seat-row-pills.has-twelve {
    grid-template-columns: repeat(6, 1fr);
  }
}

.badge-trip-stat-active {
  display: inline-flex;
  align-items: center;
  background: #ecfdf5;
  color: #065f46;
  border: 1px solid #a7f3d0;
  font-size: 0.75rem;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 6px;
  white-space: nowrap;
}

.badge-trip-stat-zero {
  display: inline-flex;
  align-items: center;
  background: #f1f5f9;
  color: #64748b;
  border: 1px solid #e2e8f0;
  font-size: 0.75rem;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 6px;
  white-space: nowrap;
}

/* Radio Pill Selector for Handover Modal */
.workflow-radio-group {
  display: flex;
  gap: 12px;
  margin-top: 4px;
}

.radio-pill-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-radius: 8px;
  border: 1px solid #cbd5e1;
  background-color: #ffffff;
  flex: 1;
  cursor: pointer;
  font-size: 0.8125rem;
  font-weight: 600;
  color: #334155;
  transition: all 0.15s ease;
}

.radio-pill-item:hover {
  border-color: #15803d;
  background-color: #f8fafc;
}

.radio-pill-item.active {
  border-color: #15803d;
  background-color: #f0fdf4;
  color: #166534;
}

.radio-pill-item input[type="radio"] {
  accent-color: #15803d;
  width: 16px;
  height: 16px;
  margin: 0;
  cursor: pointer;
}

.driver-select-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.driver-select-row .form-select {
  flex: 1;
  min-width: 0;
}
</style>
