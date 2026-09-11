<script setup lang="ts">
import { computed } from 'vue';
import { useFleetStore } from '@/stores/fleet';
import type { Driver } from '@/types';
import {
  X,
  User,
  Phone,
  CreditCard,
  Calendar,
  Truck,
  Clock,
  AlertTriangle,
  Edit2,
  ShieldCheck,
  ArrowLeft,
} from 'lucide-vue-next';

const props = withDefaults(
  defineProps<{
    driver: Driver;
    isSubpage?: boolean;
  }>(),
  {
    isSubpage: false,
  }
);

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'edit', driver: Driver): void;
}>();

const fleetStore = useFleetStore();

// Tìm phương tiện trực thuộc tài xế phụ trách
const assignedVehicle = computed(() => {
  return fleetStore.vehicles.find(
    (v) => v.assignedDriverId === props.driver.id || v.assignedDriverName === props.driver.fullName
  );
});

// Tính toán thời hạn bằng lái
const daysUntilExpiry = computed(() => {
  if (!props.driver.licenseExpiryDate) return 999;
  const expiry = new Date(props.driver.licenseExpiryDate).getTime();
  const now = new Date().getTime();
  return Math.round((expiry - now) / (1000 * 60 * 60 * 24));
});

function getEmploymentStatusLabel(status: string): string {
  switch (status) {
    case 'Active': return 'Đang hoạt động';
    case 'OnLeave': return 'Đang nghỉ phép';
    case 'Suspended': return 'Tạm ngưng công tác';
    default: return status;
  }
}

function handleEdit() {
  emit('edit', props.driver);
}
</script>

<template>
  <!-- TRANG RIÊNG (SUBPAGE) MODE -->
  <div v-if="isSubpage" class="card mb-4 p-4 shadow-sm subpage-create-card">
    <div class="subpage-back-row mb-3">
      <button class="btn btn-outline btn-sm flex items-center gap-1" @click="emit('close')">
        <ArrowLeft :size="16" />
        <span>Quay lại danh sách</span>
      </button>
    </div>

    <div class="subpage-header-main mb-4 flex-between">
      <div>
        <div class="breadcrumb text-xs text-muted mb-1">
          <span>Quản lý đội xe</span> / <span>Danh sách tài xế</span> / <span>Hồ sơ chi tiết</span>
        </div>
        <div class="flex items-center gap-3">
          <div class="driver-avatar-circle" style="width: 36px; height: 36px;">
            <User :size="20" class="text-primary" />
          </div>
          <h2 class="subpage-title" style="margin: 0; font-size: 1.25rem; font-weight: 800;">Hồ Sơ Tài Xế — {{ driver.fullName }}</h2>
          <span class="text-xs text-muted">Mã NV: <strong class="text-success">{{ driver.employeeCode || `NV-${String(driver.id).padStart(4, '0')}` }}</strong></span>
          <span
            class="status-pill"
            :class="{
              'status-active': driver.employmentStatus === 'Active',
              'status-leave': driver.employmentStatus === 'OnLeave',
              'status-suspended': driver.employmentStatus === 'Suspended',
            }"
          >
            {{ getEmploymentStatusLabel(driver.employmentStatus) }}
          </span>
          <span class="badge" :class="driver.isCurrentlyOnTrip ? 'badge-dispatched' : 'badge-completed'">
            {{ driver.isCurrentlyOnTrip ? 'Đang chạy chuyến' : 'Đang rảnh sẵn sàng' }}
          </span>
        </div>
      </div>
      <button class="btn btn-primary flex items-center gap-2" @click="handleEdit">
        <Edit2 :size="16" />
        <span>Chỉnh sửa hồ sơ</span>
      </button>
    </div>

    <div class="subpage-body">
      <!-- Cảnh báo nếu GPLX sắp hết hạn -->
      <div v-if="daysUntilExpiry < 0" class="alert alert-danger mb-4">
        <AlertTriangle :size="20" class="text-danger flex-shrink-0" />
        <div>
          <strong>Giấy phép lái xe đã hết hạn!</strong>
          <p class="text-xs mt-1">GPLX đã hết hạn từ ngày {{ driver.licenseExpiryDate }}. Cần cập nhật bằng lái mới trước khi điều phối chuyến.</p>
        </div>
      </div>
      <div v-else-if="daysUntilExpiry <= 30" class="alert alert-warning mb-4">
        <AlertTriangle :size="20" class="text-warning flex-shrink-0" />
        <div>
          <strong>Cảnh báo: GPLX sắp hết hạn (Còn {{ daysUntilExpiry }} ngày)</strong>
          <p class="text-xs mt-1">Hạn GPLX ngày {{ driver.licenseExpiryDate }}. Hãy đôn đốc tài xế gia hạn đổi bằng mới.</p>
        </div>
      </div>

      <!-- Khung thông tin cá nhân & bằng lái -->
      <div class="driver-info-grid">
        <div class="info-card">
          <h4 class="card-subtitle">
            <CreditCard :size="16" />
            <span>Thông Tin Giấy Phép Lái Xe</span>
          </h4>
          <div class="info-list">
            <div class="info-row">
              <span class="label">Số bằng lái (GPLX):</span>
              <span class="value font-mono">{{ driver.licenseNumber }}</span>
            </div>
            <div class="info-row">
              <span class="label">Hạng GPLX:</span>
              <span class="value"><span class="badge-class">{{ driver.licenseClass }}</span></span>
            </div>
            <div class="info-row">
              <span class="label">Ngày hết hạn:</span>
              <span class="value" :class="{ 'text-danger font-bold': daysUntilExpiry <= 30 }">
                {{ driver.licenseExpiryDate }}
              </span>
            </div>
            <div class="info-row">
              <span class="label">Số CCCD / CMND:</span>
              <span class="value font-mono">{{ (driver as any).identityCard || 'Chưa cập nhật' }}</span>
            </div>
          </div>
        </div>

        <div class="info-card">
          <h4 class="card-subtitle">
            <Phone :size="16" />
            <span>Thông Tin Liên Hệ & Nhân Sự</span>
          </h4>
          <div class="info-list">
            <div class="info-row">
              <span class="label">Số điện thoại:</span>
              <span class="value font-bold text-success">{{ driver.phone }}</span>
            </div>
            <div class="info-row">
              <span class="label">Email:</span>
              <span class="value">{{ (driver as any).email || 'Chưa cập nhật' }}</span>
            </div>
            <div class="info-row">
              <span class="label">Ngày vào công ty:</span>
              <span class="value">{{ (driver as any).joinedDate || '—' }}</span>
            </div>
            <div class="info-row">
              <span class="label">Đơn vị quản lý:</span>
              <span class="value font-medium">{{ (driver as any).unitName || 'Đội Xe Công Ty' }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Khung thông tin phương tiện đang phụ trách -->
      <div class="assigned-vehicle-card mt-4">
        <h4 class="card-subtitle">
          <Truck :size="16" />
          <span>Phương Tiện Trực Thuộc Phụ Trách</span>
        </h4>
        <div v-if="assignedVehicle" class="vehicle-assigned-box">
          <div class="veh-info">
            <span class="plate font-bold text-success">{{ assignedVehicle.licensePlate }}</span>
            <span class="model text-xs text-muted">{{ assignedVehicle.model }}</span>
          </div>
          <div class="veh-details">
            <span class="badge" :class="assignedVehicle.isExternal ? 'badge-warning' : 'badge-completed'">
              {{ assignedVehicle.isExternal ? 'Xe thuê ngoài' : 'Xe công ty' }}
            </span>
            <span class="text-xs text-muted">ODO hiện tại: <strong>{{ assignedVehicle.currentOdoKm.toLocaleString() }} km</strong></span>
          </div>
        </div>
        <div v-else class="empty-vehicle-box">
          <p class="text-xs text-muted">Tài xế chưa được gán cố định cho phương tiện nào (Đang thuộc danh sách tài xế điều động linh hoạt).</p>
        </div>
      </div>
    </div>

    <div class="subpage-footer flex-between">
      <button class="btn btn-secondary" @click="emit('close')">Quay lại danh sách</button>
      <button class="btn btn-primary flex items-center gap-2" @click="handleEdit">
        <Edit2 :size="16" />
        <span>Chỉnh sửa hồ sơ tài xế</span>
      </button>
    </div>
  </div>

  <!-- MODAL BACKDROP POPUP MODE (v-else) -->
  <div v-else class="modal-backdrop" @click.self="emit('close')">
    <div class="modal-content modal-lg">
      <!-- Modal Header -->
      <div class="modal-header">
        <div class="header-left">
          <div class="driver-avatar-circle">
            <User :size="22" class="text-primary" />
          </div>
          <div>
            <h3 class="modal-title">Hồ Sơ Tài Xế — {{ driver.fullName }}</h3>
            <span class="text-xs text-muted">Mã nhân viên: <strong class="text-success">{{ driver.employeeCode || `NV-${String(driver.id).padStart(4, '0')}` }}</strong></span>
          </div>
          <div class="header-badges">
            <span
              class="status-pill"
              :class="{
                'status-active': driver.employmentStatus === 'Active',
                'status-leave': driver.employmentStatus === 'OnLeave',
                'status-suspended': driver.employmentStatus === 'Suspended',
              }"
            >
              {{ getEmploymentStatusLabel(driver.employmentStatus) }}
            </span>
            <span class="badge" :class="driver.isCurrentlyOnTrip ? 'badge-dispatched' : 'badge-completed'">
              {{ driver.isCurrentlyOnTrip ? 'Đang chạy chuyến' : 'Đang rảnh sẵn sàng' }}
            </span>
          </div>
        </div>
        <button class="btn-close" @click="emit('close')">
          <X :size="18" />
        </button>
      </div>

      <!-- Modal Body -->
      <div class="modal-body">
        <!-- Cảnh báo nếu GPLX sắp hết hạn -->
        <div v-if="daysUntilExpiry < 0" class="alert alert-danger mb-4">
          <AlertTriangle :size="20" class="text-danger flex-shrink-0" />
          <div>
            <strong>Giấy phép lái xe đã hết hạn!</strong>
            <p class="text-xs mt-1">GPLX đã hết hạn từ ngày {{ driver.licenseExpiryDate }}. Cần cập nhật bằng lái mới trước khi điều phối chuyến.</p>
          </div>
        </div>
        <div v-else-if="daysUntilExpiry <= 30" class="alert alert-warning mb-4">
          <AlertTriangle :size="20" class="text-warning flex-shrink-0" />
          <div>
            <strong>GPLX sắp hết hạn (còn {{ daysUntilExpiry }} ngày)</strong>
            <p class="text-xs mt-1">Giấy phép lái xe sẽ hết hiệu lực vào ngày {{ driver.licenseExpiryDate }}. Đề nghị tài xế tiến hành gia hạn.</p>
          </div>
        </div>

        <div class="info-grid-2">
          <div class="info-card">
            <h4 class="card-subtitle">
              <User :size="15" />
              <span>Thông Tin Nhân Thân & Liên Hệ</span>
            </h4>
            <div class="detail-rows">
              <div class="detail-row">
                <span class="lbl">Mã nhân viên (Mã NV):</span>
                <strong class="val font-mono text-success">{{ driver.employeeCode || `NV-${String(driver.id).padStart(4, '0')}` }}</strong>
              </div>
              <div class="detail-row">
                <span class="lbl">Họ và tên:</span>
                <strong class="val text-main">{{ driver.fullName }}</strong>
              </div>
              <div class="detail-row">
                <span class="lbl">Số điện thoại:</span>
                <span class="val flex-center gap-1">
                  <Phone :size="13" class="text-success" />
                  <a :href="`tel:${driver.phone}`" class="phone-link">{{ driver.phone }}</a>
                </span>
              </div>
              <div class="detail-row">
                <span class="lbl">Đơn vị công tác:</span>
                <span class="val">Đội xe Vận Tải Mủ & Cơ Giới Nông Trường</span>
              </div>
              <div class="detail-row">
                <span class="lbl">Tình trạng làm việc:</span>
                <span class="val">
                  <span
                    class="status-indicator-dot"
                    :class="driver.employmentStatus === 'Active' ? 'dot-active' : 'dot-inactive'"
                  ></span>
                  {{ getEmploymentStatusLabel(driver.employmentStatus) }}
                </span>
              </div>
            </div>
          </div>

          <!-- Khối 2: Giấy phép lái xe -->
          <div class="info-card">
            <h4 class="card-subtitle">
              <CreditCard :size="15" />
              <span>Giấy Phép Lái Xe & Chứng Chỉ</span>
            </h4>
            <div class="detail-rows">
              <div class="detail-row">
                <span class="lbl">Số GPLX:</span>
                <span class="val font-mono font-bold">{{ driver.licenseNumber }}</span>
              </div>
              <div class="detail-row">
                <span class="lbl">Hạng bằng lái:</span>
                <span class="val">
                  <span class="license-tag-lg">{{ driver.licenseClass }}</span>
                </span>
              </div>
              <div class="detail-row">
                <span class="lbl">Ngày hết hạn GPLX:</span>
                <span class="val flex-center gap-1 font-semibold">
                  <Calendar :size="13" class="text-muted" />
                  <span>{{ driver.licenseExpiryDate }}</span>
                </span>
              </div>
              <div class="detail-row">
                <span class="lbl">Hiệu lực hiện tại:</span>
                <span class="val">
                  <span v-if="daysUntilExpiry < 0" class="badge-danger-pill">Đã hết hạn</span>
                  <span v-else-if="daysUntilExpiry <= 30" class="badge-warning-pill">Sắp hết hạn</span>
                  <span v-else class="badge-success-pill flex-center gap-1">
                    <ShieldCheck :size="12" /> Còn hạn ({{ daysUntilExpiry }} ngày)
                  </span>
                </span>
              </div>
              <div class="detail-row" v-if="driver.licenseImageUrl" style="flex-direction: column; align-items: flex-start; gap: 8px;">
                <span class="lbl">Ảnh giấy phép lái xe:</span>
                <span class="val">
                  <a :href="driver.licenseImageUrl" target="_blank" title="Bấm để xem ảnh lớn">
                    <img :src="driver.licenseImageUrl" alt="GPLX" class="rounded border" style="max-height: 150px; max-width: 100%; object-fit: contain;" />
                  </a>
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Khối 3: Phương tiện phụ trách trực thuộc -->
        <div class="info-card mt-4">
          <h4 class="card-subtitle">
            <Truck :size="15" />
            <span>Phương Tiện Trực Thuộc Phụ Trách</span>
          </h4>
          <div v-if="assignedVehicle" class="assigned-vehicle-box">
            <div class="veh-left">
              <div class="veh-plate-badge">{{ assignedVehicle.licensePlate }}</div>
              <div>
                <h5 class="veh-name">{{ assignedVehicle.model }}</h5>
                <span class="text-xs text-muted">
                  Tải trọng: <strong>{{ assignedVehicle.capacityTons }} Tấn</strong>
                  <span v-if="assignedVehicle.passengerCapacity"> ({{ assignedVehicle.passengerCapacity }} chỗ)</span>
                </span>
              </div>
            </div>
            <div class="veh-right">
              <div class="veh-odo">
                <span class="text-xs text-muted">ODO hiện tại:</span>
                <strong>{{ assignedVehicle.currentOdoKm.toLocaleString() }} km</strong>
              </div>
              <span
                class="veh-status-badge"
                :class="`status-${assignedVehicle.status.toLowerCase()}`"
              >
                {{ assignedVehicle.status === 'Available' ? 'Sẵn sàng' : assignedVehicle.status === 'OnTrip' ? 'Đang chạy' : 'Bảo dưỡng' }}
              </span>
            </div>
          </div>
          <div v-else class="empty-assigned-box">
            <span class="text-muted text-xs italic">— Tài xế hiện chưa được gán phương tiện trực thuộc cố định (có thể điều phối linh hoạt theo ca) —</span>
          </div>
        </div>

        <!-- Khối 4: Trạng thái điều phối & nhận chuyến -->
        <div class="info-card mt-4">
          <h4 class="card-subtitle">
            <Clock :size="15" />
            <span>Tình Trạng Sẵn Sàng Điều Vận</span>
          </h4>
          <div class="dispatch-readiness-row">
            <div class="readiness-item">
              <span class="lbl">Trạng thái nhận việc:</span>
              <strong :class="driver.isCurrentlyOnTrip ? 'text-amber' : 'text-success'">
                {{ driver.isCurrentlyOnTrip ? 'Đang thực hiện chuyến vận chuyển' : 'Sẵn sàng nhận lệnh điều phối' }}
              </strong>
            </div>
            <div class="readiness-item">
              <span class="lbl">Quy trình bàn giao xe:</span>
              <span class="text-xs text-muted">Cần ký biên bản bàn giao ODO và nhiên liệu trước khi xuất bến</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Modal Footer -->
      <div class="modal-footer flex-between">
        <button class="btn btn-secondary" @click="emit('close')">Đóng</button>
        <button class="btn btn-primary" @click="handleEdit">
          <Edit2 :size="14" />
          <span>Chỉnh Sửa Hồ Sơ</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.modal-content {
  background: #ffffff;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-modal);
  width: 100%;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.modal-lg {
  max-width: 760px;
}

.modal-header {
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-subtle);
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #f8fafc;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.driver-avatar-circle {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.modal-title {
  font-size: 1.1rem;
  font-weight: 800;
  color: var(--text-main);
  margin: 0;
}

.header-badges {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: 8px;
}

.status-pill {
  font-size: 0.6875rem;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 999px;
}
.status-active { background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0; }
.status-leave { background: #fefce8; color: #b45309; border: 1px solid #fef08a; }
.status-suspended { background: #f1f5f9; color: #64748b; border: 1px solid #e2e8f0; }

.btn-close {
  background: transparent;
  border: none;
  font-size: 1.2rem;
  color: #94a3b8;
  cursor: pointer;
  padding: 4px;
}
.btn-close:hover { color: #0f172a; }

.modal-body {
  padding: 20px;
  overflow-y: auto;
}

.info-grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.info-card {
  background: #f8fafc;
  border: 1px solid var(--border-card);
  border-radius: var(--radius-md);
  padding: 16px;
}

.card-subtitle {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.8125rem;
  font-weight: 700;
  color: #15803d;
  margin: 0 0 12px 0;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.detail-rows {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.8125rem;
  border-bottom: 1px dashed #e2e8f0;
  padding-bottom: 6px;
}
.detail-row:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.lbl {
  color: var(--text-secondary);
  font-size: 0.75rem;
}

.val {
  color: var(--text-main);
  text-align: right;
}

.phone-link {
  color: #15803d;
  font-weight: 700;
  text-decoration: none;
}
.phone-link:hover {
  text-decoration: underline;
}

.license-tag-lg {
  display: inline-block;
  padding: 3px 8px;
  background: #f0fdf4;
  color: #166534;
  border: 1px solid #bbf7d0;
  border-radius: 4px;
  font-weight: 700;
  font-size: 0.75rem;
}

.badge-success-pill {
  font-size: 0.6875rem;
  font-weight: 700;
  color: #15803d;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  padding: 2px 6px;
  border-radius: 4px;
}
.badge-warning-pill {
  font-size: 0.6875rem;
  font-weight: 700;
  color: #b45309;
  background: #fefce8;
  border: 1px solid #fef08a;
  padding: 2px 6px;
  border-radius: 4px;
}
.badge-danger-pill {
  font-size: 0.6875rem;
  font-weight: 700;
  color: #dc2626;
  background: #fef2f2;
  border: 1px solid #fecaca;
  padding: 2px 6px;
  border-radius: 4px;
}

.status-indicator-dot {
  display: inline-block;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  margin-right: 4px;
}
.dot-active { background: #16a34a; }
.dot-inactive { background: #94a3b8; }

.assigned-vehicle-box {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: var(--radius-sm);
  padding: 12px 14px;
}

.veh-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.veh-plate-badge {
  font-family: monospace;
  font-size: 0.875rem;
  font-weight: 800;
  background: #f8fafc;
  color: #0f172a;
  border: 1px solid #cbd5e1;
  padding: 4px 10px;
  border-radius: 4px;
}

.veh-name {
  margin: 0;
  font-size: 0.875rem;
  font-weight: 700;
}

.veh-right {
  display: flex;
  align-items: center;
  gap: 16px;
  text-align: right;
}

.veh-odo {
  display: flex;
  flex-direction: column;
}

.veh-status-badge {
  font-size: 0.6875rem;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 999px;
}
.status-available { background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0; }
.status-ontrip { background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; }
.status-undermaintenance { background: #fff7ed; color: #c2410c; border: 1px solid #ffedd5; }

.empty-assigned-box {
  padding: 12px;
  background: #ffffff;
  border: 1px dashed #cbd5e1;
  border-radius: var(--radius-sm);
  text-align: center;
}

.dispatch-readiness-row {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: var(--radius-sm);
  padding: 12px 14px;
}

.readiness-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 0.8125rem;
}

.modal-footer {
  padding: 14px 20px;
  border-top: 1px solid var(--border-subtle);
  background: #f8fafc;
  display: flex;
}

.flex-between {
  justify-content: space-between;
}

.flex-center {
  display: inline-flex;
  align-items: center;
}

.gap-1 {
  gap: 4px;
}

.text-amber {
  color: #d97706;
}

@media (max-width: 640px) {
  .info-grid-2 {
    grid-template-columns: 1fr;
  }
  .assigned-vehicle-box, .dispatch-readiness-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
}
</style>
