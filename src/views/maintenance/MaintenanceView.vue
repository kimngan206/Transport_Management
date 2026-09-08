<script setup lang="ts">
import { ref } from 'vue';
import { useFleetStore } from '@/stores/fleet';
import { useAuthStore } from '@/stores/auth';
import { useDialogStore } from '@/stores/dialog';
import StatusBadge from '@/components/common/StatusBadge.vue';
import { Wrench, AlertTriangle, ShieldAlert, Plus } from 'lucide-vue-next';

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

// Form Maintenance
const recVehId = ref<number | ''>('');
const recType = ref<'Periodic5000Km' | 'AccidentRepair' | 'TireChange' | 'HydraulicRepair' | 'Other'>('Periodic5000Km');
const recOdo = ref(126000);
const recCost = ref(2500000);
const recGarage = ref('Gara Cao Su Trung Tâm');
const recParts = ref('Thay dầu nhớt động cơ, lọc dầu, cân chỉnh áp suất lốp');

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
  incDesc.value = '';
  dialog.showSuccess(`Báo cáo sự cố xe ${v?.licensePlate || ''} đã được tiếp nhận và cập nhật trạng thái vận hành thành công!`, 'Báo Cáo Sự Cố Thành Công');
}

function handleCreateRecord() {
  if (!recVehId.value) {
    dialog.showWarning('Vui lòng chọn xe đã thực hiện bảo dưỡng!', 'Thiếu Thông Tin Xe', 'Kiểm tra lại');
    return;
  }
  const v = fleetStore.vehicles.find((item) => item.id === Number(recVehId.value));
  fleetStore.recordMaintenance({
    vehicleId: Number(recVehId.value),
    vehiclePlate: v?.licensePlate || '',
    maintenanceType: recType.value,
    maintenanceOdo: Number(recOdo.value),
    cost: Number(recCost.value),
    garageName: recGarage.value,
    replacedParts: recParts.value,
    maintenanceDate: new Date().toISOString().slice(0, 10),
  });
  showRecordModal.value = false;
  dialog.showSuccess(`Đã lưu hồ sơ bảo dưỡng cho xe ${v?.licensePlate || ''} thành công. ODO và chu kỳ bảo dưỡng kế tiếp đã được cập nhật!`, 'Ghi Nhận Bảo Dưỡng Thành Công');
}
</script>

<template>
  <div class="maintenance-page">
    <div class="page-header">
      <div>
        <h1 class="page-title">Quản Lý Bảo Dưỡng & Sự Cố Xe</h1>
        <p class="page-subtitle">
          Theo dõi chu kỳ bảo dưỡng 5.000 km, tiếp nhận báo hỏng sự cố và ghi nhận chi phí sửa chữa thực tế
        </p>
      </div>

      <div class="header-actions">
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
        <span>Xe cần bảo dưỡng (5.000 km)</span>
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
        <span>Lịch sử sửa chữa ({{ fleetStore.maintenances.length }})</span>
      </button>
    </div>

    <!-- 1. Danh sách xe cần bảo dưỡng 5.000 km (Rule 27) -->
    <div v-if="activeTab === 'due'" class="card">
      <div class="card-header">
        <h3 class="card-title">Cảnh Báo Bảo Dưỡng Định Kỳ (Chu kỳ: 5.000 km ODO)</h3>
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
                  :class="(v.currentOdoKm - v.lastMaintenanceOdo) >= 5000 ? 'text-danger' : 'text-success'"
                >
                  {{ (v.currentOdoKm - v.lastMaintenanceOdo).toLocaleString() }} km
                  <span v-if="(v.currentOdoKm - v.lastMaintenanceOdo) >= 5000" class="ml-1 text-xs">
                    (Vượt mức 5.000 km)
                  </span>
                </span>
              </td>
              <td>
                <StatusBadge :status="v.maintenanceStatus" type="maintenance" />
              </td>
              <td>
                <button
                  class="btn btn-secondary btn-sm"
                  @click="recVehId = v.id; recOdo = v.currentOdoKm; showRecordModal = true"
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
        <h3 class="card-title">Báo Cáo Sự Cố & Hư Hỏng Phương Tiện (IncidentReport)</h3>
      </div>

      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th>Xe Bị Sự Cố</th>
              <th>Người Báo</th>
              <th>Ngày Ghi Nhận</th>
              <th>Mức Độ Nghiêm Trọng</th>
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
              <td>{{ rec.maintenanceType }}</td>
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
          <div class="grid-2">
            <div class="form-group">
              <label class="form-label">Chọn xe bảo dưỡng <span class="required">*</span></label>
              <select v-model="recVehId" class="form-select">
                <option value="">-- Chọn xe --</option>
                <option v-for="v in fleetStore.vehicles" :key="v.id" :value="v.id">
                  {{ v.licensePlate }} (ODO: {{ v.currentOdoKm }} km)
                </option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Loại hình</label>
              <select v-model="recType" class="form-select">
                <option value="Periodic5000Km">Bảo dưỡng định kỳ 5.000 km</option>
                <option value="AccidentRepair">Sửa chữa sự cố</option>
                <option value="TireChange">Thay lốp xe</option>
                <option value="HydraulicRepair">Bảo dưỡng bơm thủy lực</option>
                <option value="Other">Khác</option>
              </select>
            </div>
          </div>

          <div class="grid-2">
            <div class="form-group">
              <label class="form-label">ODO tại thời điểm bảo dưỡng (km)</label>
              <input v-model.number="recOdo" type="number" class="form-input" />
            </div>

            <div class="form-group">
              <label class="form-label">Chi phí (VNĐ)</label>
              <input v-model.number="recCost" type="number" step="50000" class="form-input font-bold" />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Gara / Đơn vị thực hiện</label>
            <input v-model="recGarage" type="text" class="form-input" />
          </div>

          <div class="form-group">
            <label class="form-label">Linh kiện thay thế / Nội dung bảo dưỡng</label>
            <textarea v-model="recParts" rows="2" class="form-textarea"></textarea>
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
</style>
