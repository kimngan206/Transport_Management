<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useFleetStore } from '@/stores/fleet';
import { useAuthStore } from '@/stores/auth';
import { useDialogStore } from '@/stores/dialog';
import StatusBadge from '@/components/common/StatusBadge.vue';
import { Wrench, AlertTriangle, ShieldAlert, Plus, Settings, MapPin, ExternalLink, Truck } from 'lucide-vue-next';

const fleetStore = useFleetStore();
const authStore = useAuthStore();
const dialog = useDialogStore();

const activeTab = ref<'due' | 'incidents' | 'records'>('due');

// Modals
const showIncidentModal = ref(false);
const showRecordModal = ref(false);

// Form Incident
const incVehId = ref<number | ''>('');
const incDesc = ref('');
const incSeverity = ref<'Warning' | 'StopOperation'>('Warning');

// Form Maintenance — chọn danh mục bảo dưỡng trước, rồi chọn xe cụ thể
const recVehId = ref<number | ''>('');
const recMaintenanceTypeId = ref<number | ''>('');
const recOdo = ref<number>(0);
const recCost = ref<number>(0);
const recGarage = ref('');
const recParts = ref('');

// Danh mục bảo dưỡng đang hoạt động
const activeMaintenanceTypes = computed(() =>
  fleetStore.maintenanceTypes.filter((m) => m.isActive)
);

// Danh mục bảo dưỡng đang chọn (để auto-fill chi phí, checklist)
const selectedMaintenanceType = computed(() =>
  fleetStore.maintenanceTypes.find((m) => m.id === Number(recMaintenanceTypeId.value)) ?? null
);

// Xe đang chọn (để auto-fill ODO và đối chiếu)
const selectedVehicle = computed(() =>
  fleetStore.vehicles.find((v) => v.id === Number(recVehId.value)) ?? null
);

// Danh sách xe được cấu hình riêng cho danh mục này
const configuredVehiclesForType = computed(() => {
  if (!selectedMaintenanceType.value) return fleetStore.vehicles;
  const assigned = selectedMaintenanceType.value.assignedVehicleIds || [];
  if (assigned.length === 0) return fleetStore.vehicles;
  return fleetStore.vehicles.filter((v) => assigned.includes(v.id));
});

// Danh sách các xe khác trong đội xe
const otherVehiclesForType = computed(() => {
  if (!selectedMaintenanceType.value) return [];
  const assigned = selectedMaintenanceType.value.assignedVehicleIds || [];
  if (assigned.length === 0) return [];
  return fleetStore.vehicles.filter((v) => !assigned.includes(v.id));
});

// Auto-fill chi phí và nội dung khi chọn danh mục
watch(selectedMaintenanceType, (mt) => {
  if (mt) {
    recCost.value = mt.estimatedCost;
    recParts.value = mt.checklistItems.join(', ');
    // Nếu xe đang chọn không thuộc danh sách áp dụng, gợi ý chọn xe đầu tiên trong danh sách áp dụng (nếu có)
    const assigned = mt.assignedVehicleIds || [];
    if (assigned.length > 0 && recVehId.value && !assigned.includes(Number(recVehId.value))) {
      // Giữ nguyên hoặc để người dùng chủ động chọn
    }
  }
});

// Auto-fill ODO khi chọn xe
watch(selectedVehicle, (v) => {
  if (v) recOdo.value = v.currentOdoKm;
});

function openRecordModal(v?: { id: number; currentOdoKm: number }) {
  if (v) {
    recVehId.value = v.id;
    recOdo.value = v.currentOdoKm;
    // Tìm gói bảo dưỡng định kỳ đầu tiên được gán cho xe này
    const matchType = fleetStore.maintenanceTypes.find(
      (m) => m.isActive && (m.assignedVehicleIds?.includes(v.id) || !m.assignedVehicleIds || m.assignedVehicleIds.length === 0)
    );
    recMaintenanceTypeId.value = matchType ? matchType.id : (activeMaintenanceTypes.value[0]?.id ?? '');
    if (matchType) {
      recCost.value = matchType.estimatedCost;
      recParts.value = matchType.checklistItems.join(', ');
    }
  } else {
    // Mặc định chọn danh mục đầu tiên trước
    const firstType = activeMaintenanceTypes.value[0];
    recMaintenanceTypeId.value = firstType ? firstType.id : '';
    recCost.value = firstType ? firstType.estimatedCost : 0;
    recParts.value = firstType ? firstType.checklistItems.join(', ') : '';
    // Nếu danh mục có xe gán sẵn, chọn xe đầu tiên
    if (firstType && firstType.assignedVehicleIds && firstType.assignedVehicleIds.length > 0) {
      recVehId.value = firstType.assignedVehicleIds[0];
      const autoV = fleetStore.vehicles.find((item) => item.id === firstType.assignedVehicleIds[0]);
      if (autoV) recOdo.value = autoV.currentOdoKm;
    } else {
      recVehId.value = '';
      recOdo.value = 0;
    }
  }
  recGarage.value = '';
  showRecordModal.value = true;
}

function handleCreateIncident() {
  if (!incVehId.value || !incDesc.value) {
    dialog.showWarning('Vui lòng chọn xe và nhập mô tả chi tiết sự cố!', 'Thiếu Thông Tin Bắt Buộc', 'Kiểm tra lại');
    return;
  }
  const v = fleetStore.vehicles.find((item) => item.id === Number(incVehId.value));
  fleetStore.reportIncident({
    vehicleId: Number(incVehId.value),
    vehiclePlate: v?.licensePlate || '',
    reportedByDriverId: authStore.currentUser.driverId || 101,
    driverName: authStore.currentUser.fullName,
    reportDate: new Date().toISOString().slice(0, 10),
    issueDescription: incDesc.value,
    severity: incSeverity.value,
  });
  showIncidentModal.value = false;
  incVehId.value = '';
  incDesc.value = '';
  dialog.showSuccess(`Báo cáo sự cố xe ${v?.licensePlate || ''} đã được tiếp nhận và cập nhật trạng thái vận hành thành công!`, 'Báo Cáo Sự Cố Thành Công');
}

function handleCreateRecord() {
  if (!recVehId.value) {
    dialog.showWarning('Vui lòng chọn xe cần ghi nhận bảo dưỡng!', 'Thiếu Thông Tin Xe', 'Kiểm tra lại');
    return;
  }
  if (!recMaintenanceTypeId.value) {
    dialog.showWarning('Vui lòng chọn danh mục bảo dưỡng!', 'Thiếu Danh Mục Bảo Dưỡng', 'Kiểm tra lại');
    return;
  }
  const v = fleetStore.vehicles.find((item) => item.id === Number(recVehId.value));
  const mt = selectedMaintenanceType.value;
  fleetStore.recordMaintenance({
    vehicleId: Number(recVehId.value),
    vehiclePlate: v?.licensePlate || '',
    maintenanceTypeId: Number(recMaintenanceTypeId.value),
    maintenanceTypeName: mt?.name ?? '',
    maintenanceType: mt?.code ?? '',
    maintenanceOdo: Number(recOdo.value),
    cost: Number(recCost.value),
    garageName: recGarage.value,
    replacedParts: recParts.value,
    maintenanceDate: new Date().toISOString().slice(0, 10),
  });
  showRecordModal.value = false;
  dialog.showSuccess(`Đã lưu hồ sơ bảo dưỡng "${mt?.name}" cho xe ${v?.licensePlate || ''} thành công!`, 'Ghi Nhận Bảo Dưỡng Thành Công');
}

// Lấy ngưỡng bảo dưỡng an toàn (chống lỗi HMR khi reload store)
function getThreshold(v: any): number {
  if (fleetStore && typeof fleetStore.getVehicleMaintenanceThreshold === 'function') {
    return fleetStore.getVehicleMaintenanceThreshold(v);
  }
  return 5000;
}
</script>

<template>
  <div class="maintenance-page">
    <div class="page-header">
      <div>
        <h1 class="page-title">Quản Lý Bảo Dưỡng & Sự Cố Xe</h1>
        <p class="page-subtitle">
          Theo dõi chu kỳ bảo dưỡng định mức, tiếp nhận báo hỏng sự cố và ghi nhận chi phí sửa chữa thực tế
        </p>
      </div>

      <div class="header-actions">
        <router-link to="/maintenance/types" class="btn btn-outline">
          <Settings :size="16" />
          <span>Cài Đặt Bảo Dưỡng</span>
        </router-link>
        <button class="btn btn-outline-danger" @click="showIncidentModal = true">
          <AlertTriangle :size="16" />
          <span>Báo Sự Cố Xe</span>
        </button>
        <button class="btn btn-primary" @click="showRecordModal = true">
          <Plus :size="16" />
          <span>Ghi Phiếu Bảo Dưỡng</span>
        </button>
      </div>
    </div>

    <!-- Thanh chuyển tab -->
    <div class="tab-bar mb-4">
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'due' }"
        @click="activeTab = 'due'"
      >
        <AlertTriangle :size="15" />
        <span>Xe cần bảo dưỡng</span>
        <span v-if="fleetStore.dueMaintenanceVehicles.length > 0" class="badge-red">
          {{ fleetStore.dueMaintenanceVehicles.length }}
        </span>
      </button>

      <button
        class="tab-btn"
        :class="{ active: activeTab === 'incidents' }"
        @click="activeTab = 'incidents'"
      >
        <ShieldAlert :size="15" />
        <span>Sự cố & Báo hỏng ({{ fleetStore.incidents.length }})</span>
      </button>

      <button
        class="tab-btn"
        :class="{ active: activeTab === 'records' }"
        @click="activeTab = 'records'"
      >
        <Wrench :size="15" />
        <span>Lịch sử bảo dưỡng ({{ fleetStore.maintenances.length }})</span>
      </button>
    </div>

    <!-- 1. Danh sách xe cần bảo dưỡng định kỳ -->
    <div v-if="activeTab === 'due'" class="card">
      <div class="card-header flex justify-between items-center">
        <div>
          <h3 class="card-title">Cảnh Báo Bảo Dưỡng Định Kỳ</h3>
          <p class="text-xs text-muted">Hệ thống kích hoạt khi xe đạt hoặc vượt định mức chu kỳ đã cài đặt</p>
        </div>
        <router-link to="/maintenance/types" class="btn-setting-link-top">
          ⚙ Cài đặt bảo dưỡng ↗
        </router-link>
      </div>

      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th>Biển Số Xe</th>
              <th>Dòng Xe</th>
              <th>ODO Hiện Tại</th>
              <th>ODO Lần BD Trước</th>
              <th>Quãng Đường Đã Chạy Kể Từ Lần BD Trước</th>
              <th>Trạng Thái Cảnh Báo</th>
              <th>Thao Tác</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="v in fleetStore.vehicles" :key="v.id">
              <td><strong>{{ v.licensePlate }}</strong></td>
              <td>{{ v.model }} ({{ v.vehicleType }})</td>
              <td><strong>{{ v.currentOdoKm.toLocaleString() }} km</strong></td>
              <td>{{ v.lastMaintenanceOdo.toLocaleString() }} km</td>
              <td>
                <span
                  class="font-bold"
                  :class="(v.currentOdoKm - v.lastMaintenanceOdo) >= getThreshold(v) ? 'text-danger' : 'text-success'"
                >
                  {{ (v.currentOdoKm - v.lastMaintenanceOdo).toLocaleString() }} km
                  <span v-if="(v.currentOdoKm - v.lastMaintenanceOdo) >= getThreshold(v)" class="ml-1 text-xs">
                    (Vượt ngưỡng quy định {{ getThreshold(v).toLocaleString() }} km)
                  </span>
                </span>
              </td>
              <td>
                <StatusBadge :status="v.maintenanceStatus" type="maintenance" />
              </td>
              <td>
                <button
                  class="btn btn-secondary btn-sm"
                  @click="openRecordModal(v)"
                >
                  <Wrench :size="14" />
                  <span>Bảo dưỡng ngay</span>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 2. Danh sách Sự cố báo hỏng -->
    <div v-else-if="activeTab === 'incidents'" class="card">
      <div class="card-header">
        <h3 class="card-title">Báo Cáo Sự Cố & Hư Hỏng Phương Tiện</h3>
      </div>

      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th>Xe Bị Sự Cố</th>
              <th>Người Báo</th>
              <th>Ngày Ghi Nhận</th>
              <th>Mức Độ Nghiêm Trọng</th>
              <th>Vị Trí Hiện Trường & GPS</th>
              <th>Mô Tả Hiện Tượng Hư Hỏng</th>
              <th>Trạng Thái Xử Lý</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="inc in fleetStore.incidents" :key="inc.id">
              <td><strong>{{ inc.vehiclePlate }}</strong></td>
              <td>{{ inc.driverName }}</td>
              <td>{{ inc.reportDate }}</td>
              <td>
                <span
                  class="badge"
                  :class="inc.severity === 'StopOperation' ? 'badge-rejected' : 'badge-pending'"
                >
                  {{ inc.severity === 'StopOperation' ? 'Dừng hoạt động (Stop)' : 'Cảnh báo (Warning)' }}
                </span>
              </td>
              <td>
                <div class="incident-loc-cell">
                  <span class="loc-text font-semibold text-xs text-dark">{{ inc.location || 'Dọc đường vận chuyển' }}</span>
                  <div v-if="inc.latitude && inc.longitude" class="gps-loc-row">
                    <span class="gps-loc-badge">
                      <MapPin :size="11" class="text-danger" />
                      {{ inc.latitude.toFixed(4) }}, {{ inc.longitude.toFixed(4) }}
                    </span>
                    <a
                      :href="`https://www.google.com/maps?q=${inc.latitude},${inc.longitude}`"
                      target="_blank"
                      class="link-maps-mini"
                      title="Mở Google Maps vệ tinh xem hiện trường sự cố"
                    >
                      <ExternalLink :size="11" />
                      <span>Maps</span>
                    </a>
                    <router-link
                      to="/dispatch?view=map"
                      class="link-dispatch-mini"
                      title="Xem vị trí xe gặp sự cố trên Bản đồ điều xe"
                    >
                      <Truck :size="11" />
                      <span>Bản đồ xe</span>
                    </router-link>
                  </div>
                </div>
              </td>
              <td>{{ inc.issueDescription }}</td>
              <td>
                <span class="badge badge-dispatched">{{ inc.status }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 3. Lịch sử sửa chữa -->
    <div v-else class="card">
      <div class="card-header">
        <h3 class="card-title">Lịch Sử Sửa Chữa & Chi Phí Bảo Dưỡng (MaintenanceRecord)</h3>
      </div>

      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th>Phương Tiện</th>
              <th>Loại Hình BD</th>
              <th>ODO Ghi Nhận</th>
              <th>Gara Thực Hiện</th>
              <th>Linh Kiện Thay Thế</th>
              <th>Chi Phí (VNĐ)</th>
              <th>Ngày Hoàn Tất</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="rec in fleetStore.maintenances" :key="rec.id">
              <td><strong>{{ rec.vehiclePlate }}</strong></td>
              <td>
                <span v-if="rec.maintenanceTypeName" class="font-medium">{{ rec.maintenanceTypeName }}</span>
                <span v-else class="text-muted text-xs italic">{{ rec.maintenanceType || '—' }}</span>
              </td>
              <td>{{ rec.maintenanceOdo.toLocaleString() }} km</td>
              <td>{{ rec.garageName }}</td>
              <td>{{ rec.replacedParts }}</td>
              <td><strong class="text-primary">{{ rec.cost.toLocaleString() }} đ</strong></td>
              <td>{{ rec.maintenanceDate }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal Báo sự cố -->
    <div v-if="showIncidentModal" class="modal-backdrop" @click.self="showIncidentModal = false">
      <div class="modal-content">
        <div class="modal-header">
          <h3 class="modal-title text-danger">Báo Sự Cố Phương Tiện</h3>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">Chọn xe gặp sự cố <span class="required">*</span></label>
            <select v-model="incVehId" class="form-select">
              <option value="">-- Chọn xe --</option>
              <option v-for="v in fleetStore.vehicles" :key="v.id" :value="v.id">
                {{ v.licensePlate }} - {{ v.model }}
              </option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">Mức độ nghiêm trọng</label>
            <select v-model="incSeverity" class="form-select">
              <option value="Warning">Warning (Vẫn chạy được, cần theo dõi)</option>
              <option value="StopOperation">StopOperation (Bắt buộc dừng xe, khóa trạng thái xe)</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">Mô tả sự cố <span class="required">*</span></label>
            <textarea
              v-model="incDesc"
              rows="3"
              class="form-textarea"
              placeholder="Ví dụ: Rò rỉ nhớt bơm thủy lực, nứt lốp bánh sau..."
            ></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="showIncidentModal = false">Hủy</button>
          <button class="btn btn-danger" @click="handleCreateIncident">Gửi Báo Sự Cố</button>
        </div>
      </div>
    </div>

    <!-- Modal Ghi phiếu bảo dưỡng -->
    <div v-if="showRecordModal" class="modal-backdrop" @click.self="showRecordModal = false">
      <div class="modal-content">
        <div class="modal-header">
          <h3 class="modal-title text-primary">Ghi Nhận Bảo Dưỡng / Sửa Chữa</h3>
        </div>
        <div class="modal-body">
          <!-- Bước 1: Chọn danh mục bảo dưỡng trước -->
          <div class="form-group">
            <label class="form-label">1. Chọn danh mục bảo dưỡng / quy trình kỹ thuật <span class="required">*</span></label>
            <select v-model="recMaintenanceTypeId" class="form-select">
              <option value="">-- Chọn danh mục bảo dưỡng --</option>
              <optgroup
                v-for="group in ['Bảo dưỡng định kỳ', 'Sửa chữa phục hồi', 'Hệ thống chuyên dụng']"
                :key="group"
                :label="group"
              >
                <option
                  v-for="mt in activeMaintenanceTypes.filter(m => m.group === group)"
                  :key="mt.id"
                  :value="mt.id"
                >
                  {{ mt.name }} — Dự toán: {{ mt.estimatedCost.toLocaleString('vi-VN') }}đ ({{ mt.assignedVehicleIds?.length || 0 }} xe áp dụng)
                </option>
              </optgroup>
            </select>
          </div>

          <!-- Preview danh mục đã chọn -->
          <div v-if="selectedMaintenanceType" class="maintenance-type-preview">
            <div class="preview-header">
              <span class="preview-code">{{ selectedMaintenanceType.code }}</span>
              <span class="preview-name">{{ selectedMaintenanceType.name }}</span>
              <span class="preview-cost font-bold text-primary">Dự toán: {{ selectedMaintenanceType.estimatedCost.toLocaleString('vi-VN') }}đ</span>
            </div>
            <div v-if="selectedMaintenanceType.checklistItems.length" class="preview-checklist">
              <p class="preview-checklist-title">Hạng mục kiểm chuẩn & thay thế ({{ selectedMaintenanceType.checklistItems.length }} mục):</p>
              <ul>
                <li v-for="(item, i) in selectedMaintenanceType.checklistItems" :key="i">✓ {{ item }}</li>
              </ul>
            </div>
          </div>

          <!-- Bước 2: Chọn chiếc xe cụ thể cần bảo dưỡng -->
          <div class="form-group">
            <label class="form-label">2. Chọn chiếc xe thực hiện bảo dưỡng <span class="required">*</span></label>
            <select v-model="recVehId" class="form-select">
              <option value="">-- Chọn xe thực hiện --</option>
              <optgroup
                v-if="selectedMaintenanceType && (selectedMaintenanceType.assignedVehicleIds?.length || 0) > 0"
                label="⭐ Xe đã cài đặt áp dụng danh mục này"
              >
                <option
                  v-for="v in configuredVehiclesForType"
                  :key="v.id"
                  :value="v.id"
                >
                  {{ v.licensePlate }} — {{ v.model }} (ODO: {{ v.currentOdoKm.toLocaleString('vi-VN') }} km)
                </option>
              </optgroup>
              <optgroup
                v-if="selectedMaintenanceType && (selectedMaintenanceType.assignedVehicleIds?.length || 0) > 0"
                label="Các xe khác trong đội xe"
              >
                <option
                  v-for="v in otherVehiclesForType"
                  :key="v.id"
                  :value="v.id"
                >
                  {{ v.licensePlate }} — {{ v.model }} (ODO: {{ v.currentOdoKm.toLocaleString('vi-VN') }} km)
                </option>
              </optgroup>
              <template v-else>
                <option v-for="v in fleetStore.vehicles" :key="v.id" :value="v.id">
                  {{ v.licensePlate }} — {{ v.model }} (ODO: {{ v.currentOdoKm.toLocaleString('vi-VN') }} km)
                </option>
              </template>
            </select>
          </div>

          <!-- Card thông tin xe đã chọn -->
          <div v-if="selectedVehicle" class="vehicle-selected-summary">
            <div class="veh-summary-row">
              <div class="veh-summary-item">
                <span class="label">Biển số:</span>
                <strong class="plate font-mono">{{ selectedVehicle.licensePlate }}</strong>
              </div>
              <div class="veh-summary-item">
                <span class="label">Tài xế phụ trách:</span>
                <span>{{ selectedVehicle.assignedDriverName || 'Chưa gán tài xế' }}</span>
              </div>
              <div class="veh-summary-item">
                <span class="label">ODO lần bảo dưỡng trước:</span>
                <span>{{ selectedVehicle.lastMaintenanceOdo.toLocaleString('vi-VN') }} km</span>
              </div>
              <div class="veh-summary-item">
                <span class="label">Đã chạy thêm:</span>
                <strong :class="(selectedVehicle.currentOdoKm - selectedVehicle.lastMaintenanceOdo) >= getThreshold(selectedVehicle) ? 'text-danger' : 'text-success'">
                  +{{ (selectedVehicle.currentOdoKm - selectedVehicle.lastMaintenanceOdo).toLocaleString('vi-VN') }} km
                </strong>
              </div>
            </div>
          </div>

          <div class="grid-2">
            <div class="form-group">
              <label class="form-label">ODO tại thời điểm bảo dưỡng (km)</label>
              <input v-model.number="recOdo" type="number" class="form-input" />
            </div>
            <div class="form-group">
              <label class="form-label">Chi phí thực tế (VNĐ)</label>
              <input v-model.number="recCost" type="number" step="50000" class="form-input font-bold" />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Gara / Đơn vị thực hiện</label>
            <input v-model="recGarage" type="text" class="form-input" placeholder="Ví dụ: Gara Cao Su Trung Tâm" />
          </div>

          <div class="form-group">
            <label class="form-label">Ghi chú bổ sung / Vật tư phát sinh</label>
            <textarea v-model="recParts" rows="2" class="form-textarea" placeholder="Ghi chú thêm nếu có..."></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="showRecordModal = false">Hủy</button>
          <button class="btn btn-primary" @click="handleCreateRecord">Hoàn Tất & Reset Chu Kỳ ODO</button>
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
.header-actions {
  display: flex;
  gap: 10px;
}
.tab-bar {
  display: flex;
  gap: 8px;
  border-bottom: 1px solid var(--border);
  padding-bottom: 8px;
}
.tab-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: white;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  color: var(--text-secondary);
  transition: all 0.15s;
}
.tab-btn.active {
  background: var(--primary);
  color: white;
  border-color: var(--primary);
}
.badge-red {
  background: #dc2626;
  color: white;
  font-size: 0.6875rem;
  padding: 2px 6px;
  border-radius: 10px;
}
.font-bold { font-weight: 700; }
.text-danger { color: #dc2626; }
.text-success { color: #16a34a; }
.text-primary { color: #15803d; }
.text-xs { font-size: 0.75rem; }
.ml-1 { margin-left: 4px; }
.mb-4 { margin-bottom: 20px; }

.btn-outline {
  background: white;
  border: 1px solid var(--border);
  color: var(--text-secondary);
  text-decoration: none;
}
.btn-outline:hover {
  background: #f8fafc;
  color: var(--text);
}
.btn-setting-link-top {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  color: #166534;
  font-size: 0.8125rem;
  font-weight: 700;
  padding: 6px 12px;
  border-radius: 6px;
  text-decoration: none;
  transition: all 0.2s;
}
.btn-setting-link-top:hover {
  background: #dcfce7;
  color: #14532d;
}

/* Preview danh mục bảo dưỡng trong modal ghi phiếu */
.maintenance-type-preview {
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 8px;
  padding: 12px 16px;
  margin-bottom: 16px;
}
.preview-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}
.preview-code {
  background: #15803d;
  color: white;
  font-size: 0.6875rem;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 4px;
  font-family: monospace;
  letter-spacing: 0.04em;
}
.preview-name {
  font-size: 0.875rem;
  font-weight: 700;
  color: #14532d;
}
.preview-cost {
  margin-left: auto;
  font-size: 0.8125rem;
}
.preview-checklist-title {
  font-size: 0.75rem;
  font-weight: 600;
  color: #166534;
  margin-bottom: 6px;
}
.preview-checklist ul {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.preview-checklist li {
  font-size: 0.8125rem;
  color: #15803d;
}

/* Card tóm tắt phương tiện đang chọn */
.vehicle-selected-summary {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 10px 14px;
  margin-bottom: 16px;
}
.veh-summary-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 10px;
}
.veh-summary-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 0.75rem;
}
.veh-summary-item .label {
  color: #64748b;
  font-size: 0.6875rem;
}
.veh-summary-item .plate {
  color: #0f172a;
  font-weight: 800;
  letter-spacing: 0.02em;
}
.font-mono {
  font-family: monospace;
}

/* GPS & Vị trí sự cố trong bảng bảo dưỡng */
.incident-loc-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.gps-loc-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.gps-loc-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: #f8fafc;
  border: 1px solid #cbd5e1;
  padding: 1px 6px;
  border-radius: 4px;
  font-family: monospace;
  font-size: 0.6875rem;
  font-weight: 600;
  color: #334155;
}
.link-maps-mini,
.link-dispatch-mini {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 0.6875rem;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 4px;
  text-decoration: none;
  transition: all 0.2s;
}
.link-maps-mini {
  background: #e0f2fe;
  color: #0369a1;
}
.link-maps-mini:hover {
  background: #bae6fd;
}
.link-dispatch-mini {
  background: #f0fdf4;
  color: #15803d;
  border: 1px solid #bbf7d0;
}
.link-dispatch-mini:hover {
  background: #dcfce7;
}
</style>
