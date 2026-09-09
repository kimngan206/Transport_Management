<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useFleetStore } from '@/stores/fleet';
import type { Vehicle } from '@/types';
import StatusBadge from '@/components/common/StatusBadge.vue';
import {
  X,
  Truck,
  Wrench,
  AlertTriangle,
  CheckCircle2,
  Gauge,
  History,
  Fuel,
  Info,
  Edit2,
  UserCog,
} from 'lucide-vue-next';

const props = defineProps<{
  vehicle: Vehicle;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'openMaintenance', vehicleId: number): void;
  (e: 'edit', vehicle: Vehicle): void;
}>();

const router = useRouter();
const fleetStore = useFleetStore();

// Khoảng cách đã chạy kể từ lần bảo dưỡng trước
const distanceSinceLastMaint = computed(() => {
  return props.vehicle.currentOdoKm - props.vehicle.lastMaintenanceOdo;
});

// Ngưỡng bảo dưỡng định kỳ (đọc động từ Danh mục loại bảo dưỡng)
const maintenanceThreshold = computed(() => {
  if (fleetStore && typeof fleetStore.getVehicleMaintenanceThreshold === 'function') {
    return fleetStore.getVehicleMaintenanceThreshold(props.vehicle);
  }
  return 5000;
});

// Số km vượt ngưỡng (nếu có)
const overdueKm = computed(() => {
  return distanceSinceLastMaint.value - maintenanceThreshold.value;
});

// Phần trăm tiến trình chu kỳ định mức
const progressPercent = computed(() => {
  if (props.vehicle.vehicleType === 'MillingMachine') return 0;
  return Math.min(100, Math.max(0, Math.round((distanceSinceLastMaint.value / maintenanceThreshold.value) * 100)));
});

// Lịch sử bảo dưỡng của riêng xe này
const vehicleMaintenanceHistory = computed(() => {
  return fleetStore.maintenances.filter((m) => m.vehicleId === props.vehicle.id);
});

// Lịch sử phân công tài xế
const driverAssignmentHistory = computed(() => {
  return fleetStore.getDriverAssignmentsByVehicleId(props.vehicle.id);
});

// Dịch loại xe sang tiếng Việt
function getVehicleTypeLabel(type: string): string {
  switch (type) {
    case 'LatexTruck': return 'Xe tải chở mủ';
    case 'PassengerCar': return 'Bán tải công tác';
    case 'MillingMachine': return 'Máy đào mương / san ủi';
    default: return type;
  }
}

// Dịch loại bảo dưỡng sang tiếng Việt
function getMaintTypeLabel(type?: string): string {
  switch (type) {
    case 'Periodic5000Km': return 'Bảo dưỡng định kỳ';
    case 'AccidentRepair': return 'Sửa chữa va chạm';
    case 'TireChange': return 'Thay lốp xe';
    case 'HydraulicRepair': return 'Bảo dưỡng hệ thống thủy lực';
    default: return 'Sửa chữa khác';
  }
}

function handleGoToMaintenance() {
  emit('close');
  router.push('/maintenance');
}

function handleGoToMaintenanceTypes() {
  emit('close');
  router.push('/maintenance/types');
}
</script>

<template>
  <div class="modal-backdrop" @click.self="emit('close')">
    <div class="modal-content modal-lg">
      <!-- Modal Header -->
      <div class="modal-header">
        <div class="header-left">
          <div class="vehicle-title-wrap">
            <Truck :size="22" class="veh-icon" />
            <h3 class="modal-title">Hồ Sơ Phương Tiện — {{ vehicle.licensePlate }}</h3>
          </div>
          <div class="header-badges">
            <StatusBadge :status="vehicle.status" />
            <StatusBadge :status="vehicle.maintenanceStatus" type="maintenance" />
          </div>
        </div>
        <button class="btn-close" @click="emit('close')">
          <X :size="18" />
        </button>
      </div>

      <!-- Modal Body -->
      <div class="modal-body">
        <!-- 1. Banner Cảnh Báo Chu Kỳ Bảo Dưỡng (Section 4 - baoduong.md) -->
        <div
          v-if="vehicle.maintenanceStatus === 'Due' || distanceSinceLastMaint >= maintenanceThreshold"
          class="alert alert-danger-custom mb-4"
        >
          <div class="alert-icon-box">
            <AlertTriangle :size="24" class="text-danger" />
          </div>
          <div class="alert-content">
            <h4 class="alert-title">
              CẢNH BÁO: XE ĐẾN HẠN BẢO DƯỠNG ĐỊNH KỲ
            </h4>
            <p class="alert-desc">
              Xe <strong>{{ vehicle.licensePlate }}</strong> đã di chuyển
              <strong>{{ distanceSinceLastMaint.toLocaleString() }} km</strong> kể từ lần bảo dưỡng gần nhất (ngày {{ vehicle.lastMaintenanceDate }}).
              <span v-if="overdueKm > 0" class="text-danger font-bold">
                Đã vượt ngưỡng quy chuẩn <strong>{{ overdueKm.toLocaleString() }} km</strong>!
              </span>
            </p>
            <span class="alert-tip">
              * Hệ thống tự động ghi nhận cảnh báo khi tài xế nhập ODO về bến vượt ngưỡng quy định ({{ maintenanceThreshold.toLocaleString() }} km).
            </span>
          </div>
        </div>

        <div v-else-if="vehicle.vehicleType !== 'MillingMachine'" class="alert alert-success-custom mb-4">
          <CheckCircle2 :size="20" class="text-success" />
          <div class="alert-content">
            <strong>Tình trạng chu kỳ bảo dưỡng: Bình thường</strong>
            <span>Đã chạy {{ distanceSinceLastMaint.toLocaleString() }} / {{ maintenanceThreshold.toLocaleString() }} km (Còn {{ (maintenanceThreshold - distanceSinceLastMaint).toLocaleString() }} km nữa đến chu kỳ kế tiếp).</span>
          </div>
        </div>

        <!-- 2. Thẻ Tiến Trình Chu Kỳ Định Mức (Visual Meter) -->
        <div v-if="vehicle.vehicleType !== 'MillingMachine'" class="maint-meter-card mb-4">
          <div class="meter-header">
            <div class="meter-title">
              <Gauge :size="16" />
              <span>Chu Kỳ Bảo Dưỡng Định Kỳ ({{ maintenanceThreshold.toLocaleString() }} km)</span>
            </div>
            <div class="meter-stats">
              <strong :class="distanceSinceLastMaint >= maintenanceThreshold ? 'text-danger' : 'text-primary'">
                {{ distanceSinceLastMaint.toLocaleString() }}
              </strong>
              <span class="text-muted"> / {{ maintenanceThreshold.toLocaleString() }} km</span>
            </div>
          </div>

          <div class="progress-bar-wrap">
            <div
              class="progress-bar-fill"
              :class="{
                'fill-normal': progressPercent < 80,
                'fill-warning': progressPercent >= 80 && progressPercent < 100,
                'fill-danger': progressPercent >= 100,
              }"
              :style="{ width: `${progressPercent}%` }"
            ></div>
          </div>

          <div class="meter-footer">
            <span>0 km (Mốc bắt đầu)</span>
            <span v-if="overdueKm > 0" class="overdue-tag">
              Vượt {{ overdueKm.toLocaleString() }} km
            </span>
            <span>{{ maintenanceThreshold.toLocaleString() }} km (Ngưỡng tiêu chuẩn)</span>
          </div>
        </div>

        <!-- 3. Thông Số Kỹ Thuật & Chỉ Số ODO -->
        <div class="grid-2 mb-4">
          <!-- Cột trái: Thông số ODO & Bảo dưỡng -->
          <div class="spec-group card-inner">
            <h5 class="group-heading">
              <Gauge :size="15" />
              <span>Chỉ Số Vận Hành & ODO</span>
            </h5>
            <div class="spec-table">
              <div class="spec-row">
                <span class="spec-label">ODO hiện tại</span>
                <span class="spec-val font-bold">
                  {{ vehicle.currentOdoKm ? `${vehicle.currentOdoKm.toLocaleString()} km` : '—' }}
                </span>
              </div>
              <div v-if="vehicle.currentOperatingHours" class="spec-row">
                <span class="spec-label">Giờ máy tích lũy</span>
                <span class="spec-val font-bold text-info">
                  {{ vehicle.currentOperatingHours.toLocaleString() }} giờ
                </span>
              </div>
              <div class="spec-row">
                <span class="spec-label">ODO bảo dưỡng gần nhất</span>
                <span class="spec-val">
                  {{ vehicle.lastMaintenanceOdo.toLocaleString() }} km
                </span>
              </div>
              <div class="spec-row">
                <span class="spec-label">Ngày bảo dưỡng gần nhất</span>
                <span class="spec-val">
                  {{ vehicle.lastMaintenanceDate || 'Chưa ghi nhận' }}
                </span>
              </div>
              <div class="spec-row highlight-row">
                <span class="spec-label">Đã chạy từ lần bảo dưỡng</span>
                <span
                  class="spec-val font-bold"
                  :class="distanceSinceLastMaint >= maintenanceThreshold ? 'text-danger' : 'text-success'"
                >
                  {{ distanceSinceLastMaint.toLocaleString() }} km
                </span>
              </div>
              <div class="spec-row">
                <span class="spec-label">Ngưỡng cảnh báo quy chuẩn</span>
                <div class="spec-val flex items-center gap-2">
                  <span class="font-bold text-primary">{{ maintenanceThreshold.toLocaleString() }} km</span>
                  <button
                    class="btn-setting-link"
                    @click="handleGoToMaintenanceTypes"
                    title="Cài đặt định mức chu kỳ trong Danh mục Loại bảo dưỡng"
                  >
                    ⚙ Cài đặt
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Cột phải: Thông số Kỹ thuật & Định mức dầu -->
          <div class="spec-group card-inner">
            <h5 class="group-heading">
              <Fuel :size="15" />
              <span>Đặc Tính Kỹ Thuật & Định Mức</span>
            </h5>
            <div class="spec-table">
              <div class="spec-row">
                <span class="spec-label">Chủng loại xe</span>
                <span class="spec-val">{{ getVehicleTypeLabel(vehicle.vehicleType) }}</span>
              </div>
              <div class="spec-row">
                <span class="spec-label">Mẫu mã (Model)</span>
                <span class="spec-val font-bold">{{ vehicle.model }}</span>
              </div>
              <div class="spec-row">
                <span class="spec-label">Tài xế trực thuộc</span>
                <div class="spec-val font-bold text-primary">
                  <span>{{ vehicle.assignedDriverName || 'Chưa phân công tài xế' }}</span>
                  <span v-if="vehicle.assignedDriverPhone" class="text-xs text-muted block font-normal">
                    SĐT: {{ vehicle.assignedDriverPhone }}
                  </span>
                </div>
              </div>
              <div class="spec-row">
                <span class="spec-label">Sức chứa / Tải trọng</span>
                <span class="spec-val">
                  {{ vehicle.capacityTons }} Tấn
                  <span v-if="vehicle.passengerCapacity">({{ vehicle.passengerCapacity }} chỗ ngồi)</span>
                </span>
              </div>
              <div v-if="vehicle.vehicleType !== 'MillingMachine'" class="spec-row">
                <span class="spec-label">Định mức không tải (NLP)</span>
                <span class="spec-val"><strong>{{ vehicle.fuelQuotaEmpty }}</strong> L/km</span>
              </div>
              <div v-if="vehicle.vehicleType === 'LatexTruck'" class="spec-row">
                <span class="spec-label">Định mức có tải (NLC)</span>
                <span class="spec-val"><strong>{{ vehicle.fuelQuotaLoaded }}</strong> L/tấn.km</span>
              </div>
              <div v-if="vehicle.vehicleType === 'MillingMachine'" class="spec-row">
                <span class="spec-label">Định mức giờ máy</span>
                <span class="spec-val"><strong>{{ vehicle.hourMeterQuota }}</strong> L/giờ</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 4. Bảng Lịch Sử Bảo Dưỡng Của Xe (Section 4 - baoduong.md) -->
        <div class="history-section card-inner">
          <div class="flex-between mb-3">
            <h5 class="group-heading mb-0">
              <History :size="15" />
              <span>Lịch Sử Các Đợt Bảo Dưỡng & Sửa Chữa ({{ vehicleMaintenanceHistory.length }})</span>
            </h5>
            <button class="btn btn-outline-primary btn-sm" @click="handleGoToMaintenance">
              <Wrench :size="13" />
              <span>Lập phiếu bảo dưỡng</span>
            </button>
          </div>

          <div v-if="vehicleMaintenanceHistory.length === 0" class="empty-history text-muted">
            <Info :size="16" />
            <span>Chưa có dữ liệu lịch sử bảo dưỡng cho xe {{ vehicle.licensePlate }}.</span>
          </div>

          <div v-else class="table-container">
            <table class="table table-sm">
              <thead>
                <tr>
                  <th>Ngày</th>
                  <th>Hạng Mục / Loại Bảo Dưỡng</th>
                  <th>ODO Khi BD</th>
                  <th>Chi Phí (VNĐ)</th>
                  <th>Gara / Đơn Vị</th>
                  <th>Nội Dung Thay Thế</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="rec in vehicleMaintenanceHistory" :key="rec.id">
                  <td><span class="text-xs">{{ rec.maintenanceDate }}</span></td>
                  <td><strong>{{ getMaintTypeLabel(rec.maintenanceType) }}</strong></td>
                  <td>{{ rec.maintenanceOdo.toLocaleString() }} km</td>
                  <td class="font-bold text-success">{{ rec.cost.toLocaleString() }} đ</td>
                  <td>{{ rec.garageName }}</td>
                  <td class="text-muted text-xs">{{ rec.replacedParts || '—' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- 5. Lịch Sử Phân Công Tài Xế -->
        <div class="history-section card-inner mt-4">
          <div class="flex-between mb-3">
            <h5 class="group-heading mb-0">
              <UserCog :size="15" />
              <span>Lịch Sử Phân Công Tài Xế ({{ driverAssignmentHistory.length }})</span>
            </h5>
          </div>

          <div v-if="driverAssignmentHistory.length === 0" class="empty-history text-muted">
            <Info :size="16" />
            <span>Chưa có dữ liệu lịch sử phân công tài xế cho xe này.</span>
          </div>

          <div v-else class="table-container">
            <table class="table table-sm">
              <thead>
                <tr>
                  <th>Trạng Thái</th>
                  <th>Ngày Nhận</th>
                  <th>Ngày Trả</th>
                  <th>Tài Xế Phụ Trách</th>
                  <th>Ghi Chú</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="assign in driverAssignmentHistory" :key="assign.id">
                  <td>
                    <span v-if="!assign.assignedTo" class="badge badge-dispatched text-xs">Đang phụ trách</span>
                    <span v-else class="badge badge-completed text-xs">Đã kết thúc</span>
                  </td>
                  <td><span class="text-xs">{{ assign.assignedFrom }}</span></td>
                  <td>
                    <span v-if="assign.assignedTo" class="text-xs text-muted">{{ assign.assignedTo }}</span>
                    <span v-else class="text-xs text-muted">—</span>
                  </td>
                  <td><strong>{{ assign.driverName || '—' }}</strong></td>
                  <td class="text-muted text-xs">{{ assign.notes || '—' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Modal Footer -->
      <div class="modal-footer flex-between">
        <div>
          <button class="btn btn-secondary" @click="emit('close')">
            Đóng
          </button>
        </div>
        <div class="flex-actions">
          <button class="btn btn-outline" @click="emit('edit', vehicle)">
            <Edit2 :size="14" />
            <span>Sửa Thông Số</span>
          </button>
          <button class="btn btn-primary" @click="handleGoToMaintenance">
            <Wrench :size="15" />
            <span>Chuyển Sang Module Bảo Dưỡng</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.65);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 16px;
}

.modal-content {
  background: #ffffff;
  border-radius: 12px;
  width: 100%;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
}

.modal-lg {
  max-width: 820px;
}

.modal-header {
  padding: 16px 20px;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #f8fafc;
  border-radius: 12px 12px 0 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
}

.vehicle-title-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
}

.veh-icon {
  color: #15803d;
}

.modal-title {
  font-size: 1.125rem;
  font-weight: 800;
  color: #0f172a;
  margin: 0;
}

.header-badges {
  display: flex;
  align-items: center;
  gap: 6px;
}

.btn-close {
  background: transparent;
  border: none;
  cursor: pointer;
  color: #64748b;
  padding: 4px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.btn-close:hover {
  background: #e2e8f0;
  color: #0f172a;
}

.modal-body {
  padding: 20px;
  overflow-y: auto;
}

/* Alert Boxes */
.alert-danger-custom {
  display: flex;
  gap: 14px;
  padding: 14px 16px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-left: 5px solid #dc2626;
  border-radius: 8px;
}

.alert-title {
  font-size: 0.875rem;
  font-weight: 800;
  color: #991b1b;
  margin: 0 0 4px 0;
}

.alert-desc {
  font-size: 0.8125rem;
  color: #7f1d1d;
  margin: 0 0 4px 0;
  line-height: 1.4;
}

.alert-tip {
  font-size: 0.6875rem;
  color: #b91c1c;
  font-style: italic;
}

.alert-success-custom {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-left: 5px solid #16a34a;
  border-radius: 8px;
  font-size: 0.8125rem;
  color: #166534;
}

/* Meter Card */
.maint-meter-card {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 14px 16px;
}

.meter-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-size: 0.8125rem;
}

.meter-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 700;
  color: #334155;
}

.progress-bar-wrap {
  width: 100%;
  height: 10px;
  background: #e2e8f0;
  border-radius: 9999px;
  overflow: hidden;
  margin-bottom: 6px;
}

.progress-bar-fill {
  height: 100%;
  border-radius: 9999px;
  transition: width 0.4s ease;
}

.fill-normal { background: #16a34a; }
.fill-warning { background: #f59e0b; }
.fill-danger { background: #dc2626; }

.meter-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.6875rem;
  color: #64748b;
}

.overdue-tag {
  background: #fee2e2;
  color: #dc2626;
  font-weight: 800;
  padding: 1px 6px;
  border-radius: 4px;
}

/* Card Inner Sections */
.card-inner {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 14px 16px;
}

.group-heading {
  font-size: 0.8125rem;
  font-weight: 800;
  color: #1e293b;
  margin: 0 0 12px 0;
  display: flex;
  align-items: center;
  gap: 6px;
}

.spec-table {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.spec-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.8125rem;
  padding-bottom: 6px;
  border-bottom: 1px dashed #f1f5f9;
}

.spec-row:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.highlight-row {
  background: #f8fafc;
  padding: 6px 8px;
  border-radius: 4px;
}

.spec-label {
  color: #64748b;
}

.spec-val {
  color: #0f172a;
}

.btn-setting-link {
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  color: #166534;
  font-size: 0.6875rem;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-setting-link:hover {
  background: #dcfce7;
  color: #14532d;
}

.empty-history {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px;
  background: #f8fafc;
  border-radius: 6px;
  font-size: 0.8125rem;
}

.modal-footer {
  padding: 14px 20px;
  border-top: 1px solid #e2e8f0;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  background: #f8fafc;
  border-radius: 0 0 12px 12px;
}
</style>
