<script setup lang="ts">
import { ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useFleetStore } from '@/stores/fleet';
import { useDialogStore } from '@/stores/dialog';
import StatusBadge from '@/components/common/StatusBadge.vue';
import {
  Truck,
  UserCheck,
  Plus,
  KeyRound,
  Layers,
  ExternalLink,
} from 'lucide-vue-next';

const route = useRoute();
const fleetStore = useFleetStore();
const dialog = useDialogStore();
const activeTab = ref<'vehicles' | 'types' | 'drivers' | 'handover'>('vehicles');

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
const handoverList = ref([
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
]);

// Helper đếm số xe theo loại xe
function countVehiclesForCat(category: any): number {
  return fleetStore.vehicles.filter((v) => {
    if (category.vehicleTypeCode === 'Excavator') return v.vehicleType === 'Excavator';
    if (category.vehicleTypeCode === 'Pickup') return v.vehicleType === 'Pickup';
    if (category.code === 'TANKER_LATEX') return v.vehicleType === 'Truck' && v.model.toLowerCase().includes('bồn');
    if (category.code === 'TRUCK_HEAVY_15T') return v.vehicleType === 'Truck' && (v.capacityTons || 0) >= 15;
    if (category.code === 'TRUCK_MEDIUM_8T') return v.vehicleType === 'Truck' && (v.capacityTons || 0) >= 8 && (v.capacityTons || 0) < 15;
    if (category.code === 'TRUCK_LIGHT_5T') return v.vehicleType === 'Truck' && (v.capacityTons || 0) <= 5;
    return v.vehicleType === 'Truck';
  }).length;
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
    case 'Truck':
      return 'Xe tải';
    case 'Pickup':
      return 'Bán tải';
    case 'Excavator':
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

// ==================== Modal 1: Thêm xe ====================
const showAddVehModal = ref(false);
const newVehPlate = ref('');
const newVehType = ref<'Truck' | 'Pickup' | 'Excavator'>('Truck');
const newVehModel = ref('');
const newVehCapacity = ref(5.0);
const newVehEmptyQuota = ref(0.25);
const newVehLoadedQuota = ref(0.02);
const newVehOdo = ref(10000);

function handleAddVehicle() {
  if (!newVehPlate.value.trim() || !newVehModel.value.trim()) {
    dialog.showWarning('Vui lòng nhập đầy đủ biển số xe và tên dòng xe để tiếp tục!', 'Thiếu Thông Tin Phương Tiện', 'Kiểm tra lại');
    return;
  }
  const plate = newVehPlate.value.trim();
  fleetStore.addVehicle({
    licensePlate: plate,
    vehicleType: newVehType.value,
    model: newVehModel.value.trim(),
    capacityTons: Number(newVehCapacity.value),
    fuelQuotaEmpty: Number(newVehEmptyQuota.value),
    fuelQuotaLoaded: Number(newVehLoadedQuota.value),
    currentOdoKm: Number(newVehOdo.value),
    status: 'Available',
    maintenanceStatus: 'Normal',
    lastMaintenanceOdo: Number(newVehOdo.value),
    lastMaintenanceDate: new Date().toISOString().slice(0, 10),
  });
  showAddVehModal.value = false;
  newVehPlate.value = '';
  newVehModel.value = '';
  dialog.showSuccess(`Phương tiện [${plate}] đã được thêm vào đội xe thành công!`, 'Thêm Xe Mới Thành Công');
}

// ==================== Modal 2: Thêm loại xe ====================
const showAddCatModal = ref(false);
const newCatCode = ref('');
const newCatName = ref('');
const newCatGroup = ref<'Vận tải mủ' | 'Cơ giới nông trường' | 'Công tác & Kỹ thuật'>('Vận tải mủ');
const newCatVehType = ref<'Truck' | 'Pickup' | 'Excavator'>('Truck');
const newCatCapacity = ref(5.0);
const newCatEmptyQuota = ref(0.25);
const newCatLoadedQuota = ref(0.02);
const newCatDesc = ref('');

function handleAddCategory() {
  if (!newCatCode.value.trim() || !newCatName.value.trim()) {
    dialog.showWarning('Vui lòng nhập đầy đủ mã loại xe và tên loại xe!', 'Thiếu Thông Tin Loại Xe', 'Kiểm tra lại');
    return;
  }
  const catName = newCatName.value.trim();
  fleetStore.addVehicleCategory({
    code: newCatCode.value.trim().toUpperCase(),
    name: catName,
    group: newCatGroup.value,
    vehicleTypeCode: newCatVehType.value,
    standardCapacityTons: Number(newCatCapacity.value) || undefined,
    fuelQuotaType:
      newCatVehType.value === 'Excavator'
        ? 'L_PER_HOUR'
        : newCatVehType.value === 'Truck'
          ? 'L_PER_TON_KM'
          : 'L_PER_KM',
    defaultQuotaEmpty: Number(newCatEmptyQuota.value) || 0,
    defaultQuotaLoaded: Number(newCatLoadedQuota.value) || undefined,
    description: newCatDesc.value.trim(),
    isActive: true,
  });
  showAddCatModal.value = false;
  newCatCode.value = '';
  newCatName.value = '';
  newCatDesc.value = '';
  dialog.showSuccess(`Loại xe [${catName}] đã được tạo mới thành công!`, 'Thêm Loại Xe Mới Thành Công');
}

// ==================== Modal 3: Thêm tài xế ====================
const showAddDriverModal = ref(false);
const newDriverName = ref('');
const newDriverPhone = ref('');
const newDriverLicenseNum = ref('');
const newDriverLicenseClass = ref('Hạng C');
const newDriverLicenseExpiry = ref('2029-12-31');
const newDriverStatus = ref<'Active' | 'OnLeave' | 'Suspended'>('Active');

function handleAddDriver() {
  if (!newDriverName.value.trim() || !newDriverPhone.value.trim() || !newDriverLicenseNum.value.trim()) {
    dialog.showWarning('Vui lòng điền đầy đủ Họ tên, Số điện thoại và Số GPLX của tài xế!', 'Thiếu Thông Tin Tài Xế', 'Kiểm tra lại');
    return;
  }
  const driverName = newDriverName.value.trim();
  fleetStore.addDriver({
    accountId: 0,
    fullName: driverName,
    phone: newDriverPhone.value.trim(),
    licenseNumber: newDriverLicenseNum.value.trim(),
    licenseClass: newDriverLicenseClass.value,
    licenseExpiryDate: newDriverLicenseExpiry.value,
    employmentStatus: newDriverStatus.value,
    isCurrentlyOnTrip: false,
  });
  showAddDriverModal.value = false;
  newDriverName.value = '';
  newDriverPhone.value = '';
  newDriverLicenseNum.value = '';
  dialog.showSuccess(`Hồ sơ tài xế [${driverName}] đã được lưu vào hệ thống thành công!`, 'Thêm Tài Xế Mới Thành Công');
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

      <div class="header-right">
        <div class="tab-toggle">
          <button
            class="toggle-btn"
            :class="{ active: activeTab === 'vehicles' }"
            @click="activeTab = 'vehicles'"
          >
            <Truck :size="15" />
            <span>Phương tiện ({{ fleetStore.vehicles.length }})</span>
          </button>
          <button
            class="toggle-btn"
            :class="{ active: activeTab === 'types' }"
            @click="activeTab = 'types'"
          >
            <Layers :size="15" />
            <span>Loại xe ({{ fleetStore.vehicleCategories.length }})</span>
          </button>
          <button
            class="toggle-btn"
            :class="{ active: activeTab === 'drivers' }"
            @click="activeTab = 'drivers'"
          >
            <UserCheck :size="15" />
            <span>Tài xế ({{ fleetStore.drivers.length }})</span>
          </button>
          <button
            class="toggle-btn"
            :class="{ active: activeTab === 'handover' }"
            @click="activeTab = 'handover'"
          >
            <KeyRound :size="15" />
            <span>Bàn giao / Mượn trả ({{ handoverList.length }})</span>
          </button>
        </div>
      </div>
    </div>

    <!-- 1. Bảng Phương tiện -->
    <div v-if="activeTab === 'vehicles'" class="card">
      <div class="card-header flex-between">
        <div>
          <h3 class="card-title">Danh Sách Phương Tiện Đội Xe</h3>
          <p class="text-xs text-muted">Toàn bộ xe tải, xe bán tải công tác và máy đào thuộc quản lý</p>
        </div>
        <button class="btn btn-primary" @click="showAddVehModal = true">
          <Plus :size="16" />
          <span>Thêm Xe Mới</span>
        </button>
      </div>

      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th>Biển Số Xe</th>
              <th>Loại Xe</th>
              <th>Model / Dòng Xe</th>
              <th>Tải Trọng / Sức Chứa</th>
              <th>Định Mức Nhiên Liệu</th>
              <th>Chỉ Số Vận Hành</th>
              <th>Trạng Thái Xe</th>
              <th>Chu Kỳ Bảo Dưỡng</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="v in fleetStore.vehicles" :key="v.id">
              <td><strong>{{ v.licensePlate }}</strong></td>
              <td><span class="type-pill">{{ getVehicleTypeLabel(v.vehicleType) }}</span></td>
              <td>{{ v.model }}</td>
              <td>
                <span v-if="v.capacityTons">{{ v.capacityTons }} Tấn</span>
                <span v-if="v.passengerCapacity" class="text-muted text-xs"> ({{ v.passengerCapacity }} chỗ)</span>
              </td>
              <td>
                <div v-if="v.vehicleType !== 'Excavator'" class="flex-col text-xs">
                  <span>NLP (không tải): <strong>{{ v.fuelQuotaEmpty }} L/km</strong></span>
                  <span>NLC (có tải): <strong>{{ v.fuelQuotaLoaded }} L/tấn.km</strong></span>
                </div>
                <div v-else class="text-xs">
                  <span>Định mức giờ máy: <strong>{{ v.hourMeterQuota }} L/giờ</strong></span>
                </div>
              </td>
              <td>
                <div v-if="v.vehicleType !== 'Excavator'" class="flex-col">
                  <strong>{{ v.currentOdoKm.toLocaleString() }} km</strong>
                  <span class="text-xs text-muted">Lần bảo dưỡng gần nhất: {{ v.lastMaintenanceOdo.toLocaleString() }} km</span>
                </div>
                <div v-else class="flex-col">
                  <strong>{{ v.currentOperatingHours }} giờ</strong>
                  <span class="text-xs text-muted">Giờ máy tích lũy</span>
                </div>
              </td>
              <td>
                <span class="veh-status-badge" :class="`status-${v.status.toLowerCase()}`">
                  {{ getVehicleStatusLabel(v.status) }}
                </span>
              </td>
              <td>
                <StatusBadge :status="v.maintenanceStatus" type="maintenance" />
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
          <p class="text-xs text-muted">Quy chuẩn tải trọng và định mức tiêu hao nhiên liệu cơ sở theo từng chủng loại</p>
        </div>
        <div class="flex-actions">
          <router-link to="/fleet/types" class="btn btn-outline btn-sm">
            <ExternalLink :size="14" />
            <span>Mở Trang Chi Tiết</span>
          </router-link>
          <button class="btn btn-primary" @click="showAddCatModal = true">
            <Plus :size="16" />
            <span>Thêm Loại Xe Mới</span>
          </button>
        </div>
      </div>

      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th>Mã Loại Xe</th>
              <th>Tên Loại Xe</th>
              <th>Nhóm Phương Tiện</th>
              <th>Tải Trọng / Chỗ</th>
              <th>Định Mức Tiêu Chuẩn</th>
              <th>Số Lượng Xe Đang Dùng</th>
              <th>Trạng Thái</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="cat in fleetStore.vehicleCategories" :key="cat.id">
              <td><strong><code>{{ cat.code }}</code></strong></td>
              <td><strong>{{ cat.name }}</strong></td>
              <td><span class="type-pill">{{ cat.group }}</span></td>
              <td>
                <span v-if="cat.standardCapacityTons">{{ cat.standardCapacityTons }} Tấn</span>
                <span v-else-if="cat.standardSeats">{{ cat.standardSeats }} Chỗ</span>
                <span v-else class="text-muted">—</span>
              </td>
              <td>
                <div v-if="cat.vehicleTypeCode === 'Excavator'" class="text-xs">
                  <span>NLP: <strong>{{ cat.defaultQuotaEmpty }} L/giờ</strong></span>
                </div>
                <div v-else class="flex-col text-xs">
                  <span>NLP: <strong>{{ cat.defaultQuotaEmpty }} L/km</strong></span>
                  <span v-if="cat.defaultQuotaLoaded">NLC: <strong>{{ cat.defaultQuotaLoaded }} L/tấn.km</strong></span>
                </div>
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
        <button class="btn btn-primary" @click="showAddDriverModal = true">
          <Plus :size="16" />
          <span>Thêm Tài Xế Mới</span>
        </button>
      </div>

      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th>Họ Và Tên</th>
              <th>Số Điện Thoại</th>
              <th>Số Giấy Phép Lái Xe</th>
              <th>Hạng Bằng Lái</th>
              <th>Ngày Hết Hạn</th>
              <th>Tình Trạng Hoạt Động</th>
              <th>Trạng Thái Chuyến</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="d in fleetStore.drivers" :key="d.id">
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
          <h3 class="modal-title">Thêm Phương Tiện Mới</h3>
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

          <div class="grid-3">
            <div class="form-group">
              <label class="form-label">Tải trọng (Tấn)</label>
              <input v-model.number="newVehCapacity" type="number" step="0.5" class="form-input" />
            </div>
            <div class="form-group">
              <label class="form-label">NLP (L/km)</label>
              <input v-model.number="newVehEmptyQuota" type="number" step="0.01" class="form-input" />
            </div>
            <div class="form-group">
              <label class="form-label">NLC (L/tấn.km)</label>
              <input v-model.number="newVehLoadedQuota" type="number" step="0.005" class="form-input" />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Chỉ số ODO hiện tại (km)</label>
            <input v-model.number="newVehOdo" type="number" class="form-input" />
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn btn-secondary" @click="showAddVehModal = false">Hủy</button>
          <button class="btn btn-primary" @click="handleAddVehicle">Lưu Phương Tiện</button>
        </div>
      </div>
    </div>

    <!-- Modal 2: Thêm loại xe -->
    <div v-if="showAddCatModal" class="modal-backdrop" @click.self="showAddCatModal = false">
      <div class="modal-content">
        <div class="modal-header">
          <h3 class="modal-title">Thêm Loại Xe / Thiết Bị Mới</h3>
        </div>
        <div class="modal-body">
          <div class="grid-2">
            <div class="form-group">
              <label class="form-label">Mã loại xe <span class="required">*</span></label>
              <input v-model="newCatCode" type="text" class="form-input" placeholder="Ví dụ: TRUCK_10T" />
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

          <div class="grid-3">
            <div class="form-group">
              <label class="form-label">Dòng phương tiện</label>
              <select v-model="newCatVehType" class="form-select">
                <option value="Truck">Xe tải / Xe bồn</option>
                <option value="Pickup">Xe bán tải</option>
                <option value="Excavator">Máy đào / Cơ giới</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Tải trọng (Tấn)</label>
              <input v-model.number="newCatCapacity" type="number" step="0.5" class="form-input" />
            </div>
            <div class="form-group">
              <label class="form-label">NLP (L/km hoặc L/h)</label>
              <input v-model.number="newCatEmptyQuota" type="number" step="0.01" class="form-input" />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Mô tả / Ghi chú</label>
            <textarea v-model="newCatDesc" class="form-input" rows="2" placeholder="Ghi chú về mục đích sử dụng..."></textarea>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn btn-secondary" @click="showAddCatModal = false">Hủy</button>
          <button class="btn btn-primary" @click="handleAddCategory">Lưu Loại Xe</button>
        </div>
      </div>
    </div>

    <!-- Modal 3: Thêm tài xế -->
    <div v-if="showAddDriverModal" class="modal-backdrop" @click.self="showAddDriverModal = false">
      <div class="modal-content">
        <div class="modal-header">
          <h3 class="modal-title">Thêm Tài Xế Mới</h3>
        </div>
        <div class="modal-body">
          <div class="grid-2">
            <div class="form-group">
              <label class="form-label">Họ và tên tài xế <span class="required">*</span></label>
              <input v-model="newDriverName" type="text" class="form-input" placeholder="Ví dụ: Nguyễn Văn Hải" />
            </div>
            <div class="form-group">
              <label class="form-label">Số điện thoại <span class="required">*</span></label>
              <input v-model="newDriverPhone" type="text" class="form-input" placeholder="Ví dụ: 0912 345 678" />
            </div>
          </div>

          <div class="grid-2">
            <div class="form-group">
              <label class="form-label">Số giấy phép lái xe (GPLX) <span class="required">*</span></label>
              <input v-model="newDriverLicenseNum" type="text" class="form-input" placeholder="Ví dụ: C-790123456" />
            </div>
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
          </div>

          <div class="grid-2">
            <div class="form-group">
              <label class="form-label">Ngày hết hạn bằng lái</label>
              <input v-model="newDriverLicenseExpiry" type="date" class="form-input" />
            </div>
            <div class="form-group">
              <label class="form-label">Tình trạng hoạt động</label>
              <select v-model="newDriverStatus" class="form-select">
                <option value="Active">Đang làm việc</option>
                <option value="OnLeave">Nghỉ phép</option>
                <option value="Suspended">Tạm đình chỉ</option>
              </select>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn btn-secondary" @click="showAddDriverModal = false">Hủy</button>
          <button class="btn btn-primary" @click="handleAddDriver">Lưu Hồ Sơ Tài Xế</button>
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
</style>
