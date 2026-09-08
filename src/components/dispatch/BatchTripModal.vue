<script setup lang="ts">
import { ref, computed } from 'vue';
import { useBookingStore } from '@/stores/booking';
import { useFleetStore } from '@/stores/fleet';
import { useDispatchStore } from '@/stores/dispatch';
import { useAuthStore } from '@/stores/auth';
import { useDialogStore } from '@/stores/dialog';
import type { TransportRequest } from '@/types';
import { X, Layers, CheckCircle2, AlertCircle, Truck, UserCheck } from 'lucide-vue-next';

const props = defineProps<{
  initialSelectedRequests?: TransportRequest[];
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'dispatched'): void;
}>();

const bookingStore = useBookingStore();
const fleetStore = useFleetStore();
const dispatchStore = useDispatchStore();
const authStore = useAuthStore();
const dialog = useDialogStore();

// Các yêu cầu được chọn
const selectedRequestIds = ref<number[]>(
  props.initialSelectedRequests ? props.initialSelectedRequests.map((r) => r.id) : []
);

const vehicleId = ref<number | ''>('');
const driverId = ref<number | ''>('');
const notes = ref<string>('Điều động xe chở mủ kết hợp nhiều trạm');
const errorMsg = ref<string>('');

// Danh sách yêu cầu khả dụng để gán (bao gồm cả PENDING và APPROVED theo cơ chế duyệt trực tiếp ở Dispatcher)
const availableRequests = computed(() =>
  bookingStore.requests.filter((r) => r.status === 'APPROVED' || r.status === 'PENDING')
);

const currentSelectedRequests = computed(() => {
  return bookingStore.requests.filter((r) => selectedRequestIds.value.includes(r.id));
});

const selectedVehicle = computed(() => {
  return fleetStore.vehicles.find((v) => v.id === Number(vehicleId.value));
});

function getVehicleStatusLabel(status: string): string {
  switch (status) {
    case 'Available': return 'Sẵn sàng';
    case 'OnTrip': return 'Đang chạy chuyến';
    case 'UnderMaintenance': return 'Đang bảo dưỡng';
    case 'Broken': return 'Sự cố / Hỏng hóc';
    default: return status;
  }
}

function getVehicleTypeLabel(type: string): string {
  switch (type) {
    case 'Truck': return 'Xe tải';
    case 'Pickup': return 'Bán tải';
    case 'Excavator': return 'Máy đào';
    default: return type;
  }
}

const selectedDriver = computed(() => {
  return fleetStore.drivers.find((d) => d.id === Number(driverId.value));
});

// Tính toán tổng tải trọng / khách
const totalWeightKg = computed(() => {
  return currentSelectedRequests.value.reduce((acc, r) => acc + (r.estimatedWeightKg || 0), 0);
});

const totalPassengers = computed(() => {
  return currentSelectedRequests.value.reduce((acc, r) => acc + (r.passengersCount || 0), 0);
});

// Tuyến đường đề xuất (lấy từ request đầu tiên nếu có)
const proposedRoute = computed(() => {
  if (currentSelectedRequests.value.length === 0) return fleetStore.routes[0];
  const first = currentSelectedRequests.value[0];
  if (first.standardRouteId) {
    return fleetStore.routes.find((r) => r.id === first.standardRouteId) || fleetStore.routes[0];
  }
  return fleetStore.routes[0];
});

// Giờ xuất phát dự kiến
const scheduledStartTime = computed(() => {
  if (currentSelectedRequests.value.length === 0) return '';
  const times = currentSelectedRequests.value.map((r) => r.startTime);
  return times.sort()[0];
});

const scheduledEndTime = computed(() => {
  if (currentSelectedRequests.value.length === 0) return '';
  const times = currentSelectedRequests.value.map((r) => r.endTime);
  return times.sort().reverse()[0];
});

// 4 Điều kiện Ghép Chuyến (US-06)
const condition1_SameType = computed(() => {
  if (currentSelectedRequests.value.length <= 1) return true;
  const first = currentSelectedRequests.value[0].vehicleType;
  return currentSelectedRequests.value.every((r) => r.vehicleType === first);
});

const condition2_TimeDiff = computed(() => {
  if (currentSelectedRequests.value.length <= 1) return true;
  const times = currentSelectedRequests.value.map((r) => new Date(r.startTime).getTime());
  const diffMins = (Math.max(...times) - Math.min(...times)) / (60 * 1000);
  return diffMins <= 30;
});

const condition3_SameRoute = computed(() => {
  if (currentSelectedRequests.value.length <= 1) return true;
  const first = currentSelectedRequests.value[0];
  return currentSelectedRequests.value.every(
    (r) =>
      (first.standardRouteId && r.standardRouteId === first.standardRouteId) ||
      (r.fromLocation === first.fromLocation && r.toLocation === first.toLocation)
  );
});

const condition4_Capacity = computed(() => {
  if (!selectedVehicle.value) return true;
  if (selectedVehicle.value.vehicleType === 'Truck') {
    return totalWeightKg.value <= selectedVehicle.value.capacityTons * 1000;
  } else if (selectedVehicle.value.vehicleType === 'Pickup') {
    return totalPassengers.value <= (selectedVehicle.value.passengerCapacity || 5);
  }
  return true;
});

const allConditionsMet = computed(() => {
  return (
    currentSelectedRequests.value.length > 0 &&
    condition1_SameType.value &&
    condition2_TimeDiff.value &&
    condition3_SameRoute.value &&
    condition4_Capacity.value &&
    !!vehicleId.value &&
    !!driverId.value
  );
});

function toggleSelect(id: number) {
  const idx = selectedRequestIds.value.indexOf(id);
  if (idx > -1) {
    selectedRequestIds.value.splice(idx, 1);
  } else {
    selectedRequestIds.value.push(id);
  }
}

function handleDispatch() {
  errorMsg.value = '';
  if (!vehicleId.value || !driverId.value) {
    errorMsg.value = 'Vui lòng chọn đầy đủ Phương tiện và Tài xế!';
    dialog.showWarning('Vui lòng chọn đầy đủ Phương tiện vận tải và Tài xế trước khi điều phối!', 'Thiếu Thông Tin Điều Phối', 'Kiểm tra lại');
    return;
  }

  if (selectedRequestIds.value.length > 1 && (!condition1_SameType.value || !condition2_TimeDiff.value || !condition3_SameRoute.value || !condition4_Capacity.value)) {
    dialog.showWarning('Các yêu cầu được chọn chưa thỏa mãn đủ 4 quy tắc ghép chuyến (Cùng loại xe, thời gian lệch ≤ 30 phút, cùng lộ trình, không vượt tải trọng)!', 'Quy Tắc Ghép Chuyến Không Hợp Lệ', 'Kiểm tra lại');
    return;
  }

  // Tự động phê duyệt các yêu cầu PENDING khi được Dispatcher chọn điều phối trực tiếp
  for (const reqId of selectedRequestIds.value) {
    const req = bookingStore.requests.find((r) => r.id === reqId);
    if (req && req.status === 'PENDING') {
      bookingStore.approveRequest(
        req.id,
        authStore.currentUser.id,
        authStore.currentUser.fullName,
        'Điều phối viên duyệt & gán xe trực tiếp'
      );
    }
  }

  const res = dispatchStore.dispatchTrip({
    vehicleId: Number(vehicleId.value),
    driverId: Number(driverId.value),
    requestIds: selectedRequestIds.value,
    routeId: proposedRoute.value.id,
    scheduledStartTime: scheduledStartTime.value,
    scheduledEndTime: scheduledEndTime.value,
    notes: notes.value,
    dispatcherName: authStore.currentUser.fullName,
  });

  if (!res.success) {
    errorMsg.value = res.message;
    dialog.showWarning(res.message || 'Không thể điều phối chuyến xe!', 'Điều Phối Thất Bại', 'Thực hiện lại');
  } else {
    emit('dispatched');
    emit('close');
    dialog.showSuccess(`Đã điều phối và lập kế hoạch chuyến xe thành công cho phương tiện ${selectedVehicle.value?.licensePlate || ''}!`, 'Điều Phối Chuyến Thành Công');
  }
}
</script>

<template>
  <div class="modal-backdrop" @click.self="emit('close')">
    <div class="modal-content modal-lg">
      <div class="modal-header">
        <h3 class="modal-title">
          <Layers :size="20" class="text-primary" />
          <span>Điều Phối & Ghép Chuyến Xe</span>
        </h3>
        <button class="btn-close" @click="emit('close')">
          <X :size="18" />
        </button>
      </div>

      <div class="modal-body">
        <div v-if="errorMsg" class="alert alert-danger">
          <AlertCircle :size="18" />
          <span>{{ errorMsg }}</span>
        </div>

        <!-- Bước 1: Chọn các yêu cầu ghép -->
        <div class="section-box">
          <h4 class="section-header">
            <span>1. Chọn các yêu cầu đã duyệt cần ghép vào chuyến (Đã chọn: {{ selectedRequestIds.length }})</span>
          </h4>

          <div v-if="availableRequests.length === 0" class="empty-hint">
            Hiện không có yêu cầu nào ở trạng thái ĐÃ DUYỆT (APPROVED) để ghép chuyến.
          </div>

          <div v-else class="req-selector-list">
            <div
              v-for="r in availableRequests"
              :key="r.id"
              class="req-item"
              :class="{ selected: selectedRequestIds.includes(r.id) }"
              @click="toggleSelect(r.id)"
            >
              <input
                type="checkbox"
                :checked="selectedRequestIds.includes(r.id)"
                @click.stop
                @change="toggleSelect(r.id)"
              />
              <div class="req-info">
                <div class="req-title-row">
                  <span class="req-code"><strong>{{ r.requestCode }}</strong></span>
                  <span v-if="r.status === 'PENDING'" class="badge-pending-tag">Chờ duyệt</span>
                  <span v-else class="badge-approved-tag">Đã duyệt</span>
                  <span class="req-type-tag">{{ getVehicleTypeLabel(r.vehicleType) }}</span>
                  <span class="req-time">{{ r.startTime.slice(11) }} - {{ r.endTime.slice(11) }}</span>
                </div>
                <div class="req-route-row">
                  <span>{{ r.fromLocation }} ➔ {{ r.toLocation }}</span>
                  <span v-if="r.estimatedWeightKg" class="font-bold text-success">
                    {{ r.estimatedWeightKg.toLocaleString() }} kg mủ
                  </span>
                  <span v-if="r.passengersCount" class="font-bold text-info">
                    {{ r.passengersCount }} người
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 4 Điều kiện ghép chuyến -->
        <div v-if="currentSelectedRequests.length > 0" class="rule-box">
          <h5 class="rule-box-title">Kiểm tra 4 điều kiện ghép chuyến:</h5>
          <div class="conditions-grid">
            <div class="cond-item" :class="condition1_SameType ? 'pass' : 'fail'">
              <CheckCircle2 v-if="condition1_SameType" :size="16" />
              <AlertCircle v-else :size="16" />
              <span>ĐK 1: Cùng loại xe</span>
            </div>

            <div class="cond-item" :class="condition2_TimeDiff ? 'pass' : 'fail'">
              <CheckCircle2 v-if="condition2_TimeDiff" :size="16" />
              <AlertCircle v-else :size="16" />
              <span>ĐK 2: Lệch giờ khởi hành ≤ 30 phút</span>
            </div>

            <div class="cond-item" :class="condition3_SameRoute ? 'pass' : 'fail'">
              <CheckCircle2 v-if="condition3_SameRoute" :size="16" />
              <AlertCircle v-else :size="16" />
              <span>ĐK 3: Chung cung đường lộ trình</span>
            </div>

            <div class="cond-item" :class="condition4_Capacity ? 'pass' : 'fail'">
              <CheckCircle2 v-if="condition4_Capacity" :size="16" />
              <AlertCircle v-else :size="16" />
              <span>ĐK 4: Không vượt sức chứa / tải trọng</span>
            </div>
          </div>
        </div>

        <!-- Bước 2: Chọn phương tiện & tài xế -->
        <div class="grid-2 mt-4">
          <div class="form-group">
            <label class="form-label">
              <Truck :size="15" />
              <span>Phương tiện thực hiện <span class="required">*</span></span>
            </label>
            <select v-model="vehicleId" class="form-select">
              <option value="">-- Chọn xe phù hợp --</option>
              <option
                v-for="v in fleetStore.vehicles"
                :key="v.id"
                :value="v.id"
                :disabled="v.status !== 'Available'"
              >
                {{ v.licensePlate }} ({{ getVehicleTypeLabel(v.vehicleType) }} - Tải {{ v.capacityTons }}T) [{{ getVehicleStatusLabel(v.status) }}]
              </option>
            </select>
            <span v-if="selectedVehicle" class="form-hint">
              Sức chứa: {{ (selectedVehicle.capacityTons * 1000).toLocaleString() }} kg | Hiện tại ghép: {{ totalWeightKg.toLocaleString() }} kg
            </span>
          </div>

          <div class="form-group">
            <label class="form-label">
              <UserCheck :size="15" />
              <span>Tài xế phân công <span class="required">*</span></span>
            </label>
            <select v-model="driverId" class="form-select">
              <option value="">-- Chọn tài xế --</option>
              <option
                v-for="d in fleetStore.drivers"
                :key="d.id"
                :value="d.id"
                :disabled="d.employmentStatus !== 'Active' || d.isCurrentlyOnTrip"
              >
                {{ d.fullName }} ({{ d.licenseClass }} - Hạn: {{ d.licenseExpiryDate }})
              </option>
            </select>
            <span v-if="selectedDriver" class="form-hint">
              SĐT: {{ selectedDriver.phone }} | Tình trạng: {{ selectedDriver.employmentStatus === 'Active' ? 'Đang làm việc' : selectedDriver.employmentStatus }}
            </span>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Ghi chú điều động</label>
          <input v-model="notes" type="text" class="form-input" />
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn btn-secondary" @click="emit('close')">Hủy bỏ</button>
        <button
          class="btn btn-primary"
          :disabled="!allConditionsMet"
          @click="handleDispatch"
        >
          Tạo Chuyến Xe Phân Công (Ghép {{ currentSelectedRequests.length }} YC)
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-lg {
  max-width: 780px;
}
.btn-close {
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--text-muted);
}
.section-box {
  background: #f8fafc;
  border: 1px solid var(--border);
  padding: 14px;
  border-radius: var(--radius-md);
  margin-bottom: 16px;
}
.section-header {
  font-size: 0.875rem;
  font-weight: 700;
  margin-bottom: 10px;
  color: var(--text-primary);
}
.req-selector-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 200px;
  overflow-y: auto;
}
.req-item {
  display: flex;
  align-items: center;
  gap: 12px;
  background: white;
  border: 1px solid var(--border);
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.15s;
}
.req-item:hover {
  border-color: var(--primary);
}
.req-item.selected {
  background: #f0fdf4;
  border-color: #22c55e;
}
.req-info {
  flex: 1;
}
.req-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 0.8125rem;
}
.req-type-tag {
  background: #e2e8f0;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.6875rem;
  font-weight: 600;
}
.badge-pending-tag {
  background: #fef3c7;
  color: #b45309;
  font-size: 0.625rem;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 4px;
}
.badge-approved-tag {
  background: #dcfce7;
  color: #15803d;
  font-size: 0.625rem;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 4px;
}
.req-route-row {
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  color: var(--text-secondary);
  margin-top: 2px;
}
.rule-box {
  background: white;
  border: 1px solid #cbd5e1;
  padding: 12px 14px;
  border-radius: var(--radius-md);
}
.rule-box-title {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--text-secondary);
  text-transform: uppercase;
  margin-bottom: 8px;
}
.conditions-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}
.cond-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
}
.cond-item.pass {
  background: #dcfce7;
  color: #15803d;
}
.cond-item.fail {
  background: #fee2e2;
  color: #b91c1c;
}
.empty-hint {
  font-size: 0.8125rem;
  color: var(--text-muted);
  font-style: italic;
  padding: 10px;
}
.alert {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  border-radius: var(--radius-sm);
  margin-bottom: 14px;
}
.alert-danger {
  background: #fee2e2;
  border: 1px solid #fecaca;
  color: #b91c1c;
}
.font-bold { font-weight: 700; }
.text-success { color: #16a34a; }
.text-info { color: #0284c7; }
.mt-4 { margin-top: 16px; }
</style>
