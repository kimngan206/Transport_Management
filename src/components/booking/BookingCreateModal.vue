<script setup lang="ts">
import { ref, computed } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { useBookingStore } from '@/stores/booking';
import { useFleetStore } from '@/stores/fleet';
import { useDialogStore } from '@/stores/dialog';
import type { VehicleType } from '@/types';
import { X, AlertCircle, CheckCircle2, Clock } from 'lucide-vue-next';

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'created'): void;
}>();

const authStore = useAuthStore();
const bookingStore = useBookingStore();
const fleetStore = useFleetStore();
const dialog = useDialogStore();

// Form state
const vehicleType = ref<VehicleType>('Truck');
const standardRouteId = ref<number | ''>(1);
const fromLocation = ref<string>('Trạm cân 1');
const toLocation = ref<string>('Đội 1');
const purpose = ref<string>('Vận chuyển mủ cao su ca thu hoạch ngày lẻ');
const estimatedWeightKg = ref<number>(2500);
const passengersCount = ref<number>(3);

// Helper default times (tự động tìm khung giờ trống hợp lệ: sau hiện tại ít nhất 30 phút và không trùng các chuyến đã duyệt)
function getNextValidTimeSlot(): { start: string; end: string } {
  const pad = (n: number) => String(n).padStart(2, '0');
  const format = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

  const now = new Date();
  // Kiểm tra xem hôm nay có chuyến nào đang duyệt không
  const myApproved = bookingStore.requests.filter(
    (r) => r.requesterId === authStore.currentUser.id && (r.status === 'APPROVED' || r.status === 'INPROGRESS')
  );

  let targetStart = new Date(now.getTime() + 45 * 60 * 1000); // Tối thiểu 45p sau hiện tại

  // Nếu bị vướng chuyến cũ thì đẩy ra sau chuyến kết thúc muộn nhất + 45 phút
  for (const req of myApproved) {
    const reqEnd = new Date(req.endTime).getTime();
    if (targetStart.getTime() < reqEnd + 45 * 60 * 1000) {
      targetStart = new Date(reqEnd + 45 * 60 * 1000);
    }
  }

  const targetEnd = new Date(targetStart.getTime() + 2 * 60 * 60 * 1000);
  return { start: format(targetStart), end: format(targetEnd) };
}

const initialSlot = getNextValidTimeSlot();
const startTime = ref<string>(initialSlot.start);
const endTime = ref<string>(initialSlot.end);
const errorMsg = ref<string>('');

function setQuickSlot(type: 'today_next' | 'tomorrow_morning' | 'tomorrow_afternoon') {
  const pad = (n: number) => String(n).padStart(2, '0');
  const format = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

  if (type === 'today_next') {
    const slot = getNextValidTimeSlot();
    startTime.value = slot.start;
    endTime.value = slot.end;
  } else if (type === 'tomorrow_morning') {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const st = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 8, 0);
    const et = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 10, 30);
    startTime.value = format(st);
    endTime.value = format(et);
  } else if (type === 'tomorrow_afternoon') {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const st = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 13, 30);
    const et = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 16, 0);
    startTime.value = format(st);
    endTime.value = format(et);
  }
}

// Khi đổi tuyến chuẩn thì tự động điền From & To
function handleRouteChange() {
  if (standardRouteId.value) {
    const r = fleetStore.routes.find((item) => item.id === Number(standardRouteId.value));
    if (r) {
      fromLocation.value = r.startPoint;
      toLocation.value = r.endPoint;
    }
  }
}

// Live Validation: Rule 30 phút
const rule30Status = computed(() => {
  if (!startTime.value) return { valid: false, text: 'Chưa chọn giờ' };
  const st = new Date(startTime.value).getTime();
  const diffMins = (st - Date.now()) / (60 * 1000);
  if (diffMins < 30) {
    return {
      valid: false,
      text: `Vi phạm quy định: Giờ bắt đầu chỉ còn ${Math.round(diffMins)} phút (Tối thiểu phải trước 30 phút)!`,
    };
  }
  return {
    valid: true,
    text: `Đạt chuẩn quy tắc 30 phút (Đặt trước ${Math.round(diffMins)} phút)`,
  };
});

// Live Validation: Rule chống trùng lịch 45 phút
const conflictStatus = computed(() => {
  if (!startTime.value || !endTime.value) return { hasConflict: false };
  return bookingStore.hasScheduleConflict(
    authStore.currentUser.id,
    startTime.value.replace('T', ' '),
    endTime.value.replace('T', ' ')
  );
});

function handleSubmit() {
  errorMsg.value = '';

  if (!fromLocation.value || !toLocation.value || !startTime.value || !endTime.value) {
    dialog.showWarning('Vui lòng điền đầy đủ các thông tin bắt buộc: điểm đi, điểm đến và thời gian!', 'Thiếu Thông Tin Bắt Buộc', 'Kiểm tra lại');
    return;
  }

  if (!rule30Status.value.valid) {
    dialog.showWarning(rule30Status.value.text, 'Vi Phạm Quy Định 30 Phút', 'Kiểm tra lại');
    return;
  }

  if (conflictStatus.value.hasConflict) {
    dialog.showWarning(conflictStatus.value.message || 'Khung giờ bạn chọn đã bị trùng lịch với chuyến công tác khác!', 'Trùng Lịch Đặt Xe', 'Kiểm tra lại');
    return;
  }

  const res = bookingStore.createRequest({
    requesterId: authStore.currentUser.id,
    requesterName: authStore.currentUser.fullName,
    requesterPhone: authStore.currentUser.phone,
    departmentId: authStore.currentUser.departmentId,
    departmentName: authStore.currentUser.departmentName,
    vehicleType: vehicleType.value,
    startTime: startTime.value.replace('T', ' '),
    endTime: endTime.value.replace('T', ' '),
    fromLocation: fromLocation.value,
    toLocation: toLocation.value,
    standardRouteId: standardRouteId.value ? Number(standardRouteId.value) : undefined,
    purpose: purpose.value,
    estimatedWeightKg: vehicleType.value === 'Truck' ? Number(estimatedWeightKg.value) : undefined,
    passengersCount: vehicleType.value === 'Pickup' ? Number(passengersCount.value) : undefined,
  });

  if (!res.success) {
    errorMsg.value = res.message;
    dialog.showWarning(res.message || 'Không thể tạo yêu cầu đặt xe!', 'Đặt Xe Không Thành Công', 'Thực hiện lại');
  } else {
    emit('created');
    emit('close');
    dialog.showSuccess('Yêu cầu đặt xe của bạn đã được gửi trực tiếp đến Bộ phận Điều phối để duyệt và xếp xe vận chuyển.', 'Đặt Xe Thành Công');
  }
}
</script>

<template>
  <div class="modal-backdrop" @click.self="emit('close')">
    <div class="modal-content modal-lg">
      <div class="modal-header">
        <h3 class="modal-title">
          <Clock :size="20" class="text-primary" />
          <span>Tạo Yêu Cầu Đặt Xe Mới</span>
        </h3>
        <button class="btn-close" @click="emit('close')">
          <X :size="18" />
        </button>
      </div>

      <div class="modal-body">
        <!-- Thông báo lỗi nếu có -->
        <div v-if="errorMsg" class="alert alert-danger">
          <AlertCircle :size="18" />
          <span>{{ errorMsg }}</span>
        </div>

        <div class="info-banner">
          Người yêu cầu: <strong>{{ authStore.currentUser.fullName }}</strong> ({{ authStore.currentUser.departmentName }})
        </div>

        <div class="grid-2">
          <div class="form-group">
            <label class="form-label">Loại phương tiện <span class="required">*</span></label>
            <select v-model="vehicleType" class="form-select">
              <option value="Truck">Xe tải chở mủ cao su</option>
              <option value="Pickup">Xe bán tải đưa đón / công tác</option>
              <option value="Excavator">Xe máy xúc nông trường</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">Tuyến đường quy chuẩn</label>
            <select v-model="standardRouteId" @change="handleRouteChange" class="form-select">
              <option value="">-- Tuyến tự do ngoài danh mục --</option>
              <option v-for="r in fleetStore.routes" :key="r.id" :value="r.id">
                {{ r.routeCode }} - {{ r.name }} ({{ r.standardDistanceKm }} km)
              </option>
            </select>
          </div>
        </div>

        <div class="grid-2">
          <div class="form-group">
            <label class="form-label">Điểm xuất phát <span class="required">*</span></label>
            <input v-model="fromLocation" type="text" class="form-input" placeholder="Ví dụ: Trạm cân 1" />
          </div>

          <div class="form-group">
            <label class="form-label">Điểm đến <span class="required">*</span></label>
            <input v-model="toLocation" type="text" class="form-input" placeholder="Ví dụ: Đội 1" />
          </div>
        </div>

        <!-- Khung giờ & Rule kiểm tra -->
        <div class="quick-slots-container">
          <span class="quick-slots-label">Chọn nhanh khung giờ hợp lệ:</span>
          <div class="quick-slots-btns">
            <button type="button" class="btn-quick-slot" @click="setQuickSlot('today_next')">
              ⚡ Gợi ý hôm nay (Tránh trùng lịch)
            </button>
            <button type="button" class="btn-quick-slot" @click="setQuickSlot('tomorrow_morning')">
              🌅 Ca sáng mai (08:00 - 10:30)
            </button>
            <button type="button" class="btn-quick-slot" @click="setQuickSlot('tomorrow_afternoon')">
              ☀️ Ca chiều mai (13:30 - 16:00)
            </button>
          </div>
        </div>

        <div class="grid-2">
          <div class="form-group">
            <label class="form-label">Thời gian bắt đầu <span class="required">*</span></label>
            <input v-model="startTime" type="datetime-local" class="form-input" />
            <!-- Chỉ báo Rule 30 phút -->
            <div class="rule-feedback" :class="rule30Status.valid ? 'text-success' : 'text-danger'">
              <CheckCircle2 v-if="rule30Status.valid" :size="13" />
              <AlertCircle v-else :size="13" />
              <span>{{ rule30Status.text }}</span>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Thời gian dự kiến kết thúc <span class="required">*</span></label>
            <input v-model="endTime" type="datetime-local" class="form-input" />
          </div>
        </div>

        <!-- Cảnh báo chống trùng lịch 45 phút -->
        <div v-if="conflictStatus.hasConflict" class="alert alert-warning">
          <AlertCircle :size="16" />
          <span>{{ conflictStatus.message }}</span>
        </div>

        <!-- Tùy biến theo loại xe -->
        <div v-if="vehicleType === 'Truck'" class="form-group">
          <label class="form-label">Khối lượng mủ dự kiến (kg) <span class="required">*</span></label>
          <input v-model.number="estimatedWeightKg" type="number" step="100" min="100" class="form-input" />
          <span class="form-hint">Khối lượng này sẽ dùng để kiểm tra sức chứa khi điều phối ghép chuyến và tính định mức dầu.</span>
        </div>

        <div v-else-if="vehicleType === 'Pickup'" class="form-group">
          <label class="form-label">Số người tham gia công tác <span class="required">*</span></label>
          <input v-model.number="passengersCount" type="number" min="1" max="5" class="form-input" />
        </div>

        <div class="form-group">
          <label class="form-label">Mục đích chuyến đi <span class="required">*</span></label>
          <textarea v-model="purpose" rows="2" class="form-textarea" placeholder="Mô tả cụ thể mục đích sử dụng xe..."></textarea>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn btn-secondary" @click="emit('close')">Hủy bỏ</button>
        <button
          class="btn btn-primary"
          :disabled="!rule30Status.valid || conflictStatus.hasConflict"
          @click="handleSubmit"
        >
          Gửi Yêu Cầu Đặt Xe
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.btn-close {
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--text-muted);
}
.btn-close:hover {
  color: var(--text-primary);
}
.info-banner {
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  color: #166534;
  padding: 10px 14px;
  border-radius: var(--radius-sm);
  font-size: 0.8125rem;
  margin-bottom: 16px;
}
.alert {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border-radius: var(--radius-sm);
  font-size: 0.8125rem;
  font-weight: 500;
  margin-bottom: 16px;
}
.alert-danger {
  background: #fee2e2;
  border: 1px solid #fecaca;
  color: #b91c1c;
}
.alert-warning {
  background: #fef3c7;
  border: 1px solid #fde68a;
  color: #b45309;
}
.rule-feedback {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 0.75rem;
  font-weight: 600;
  margin-top: 4px;
}
.text-success { color: #16a34a; }
.text-danger { color: #dc2626; }

.quick-slots-container {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 12px;
  background: #f8fafc;
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  border: 1px dashed #cbd5e1;
}
.quick-slots-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-secondary);
}
.quick-slots-btns {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.btn-quick-slot {
  background: #ffffff;
  border: 1px solid #15803d;
  color: #15803d;
  padding: 4px 10px;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}
.btn-quick-slot:hover {
  background: #15803d;
  color: #ffffff;
  box-shadow: 0 2px 4px rgba(21, 128, 61, 0.2);
}
.modal-lg {
  max-width: 860px !important;
  width: 95vw;
}
</style>
