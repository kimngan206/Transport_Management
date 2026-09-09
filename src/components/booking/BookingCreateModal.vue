<script setup lang="ts">
import { ref, computed } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { useBookingStore } from '@/stores/booking';
import { useDialogStore } from '@/stores/dialog';
import { mockStorage } from '@/services/mockStorage';
import type { VehicleType } from '@/types';
import { X, AlertCircle, CheckCircle2, Clock, MapPin, Compass } from 'lucide-vue-next';

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'created'): void;
}>();

const authStore = useAuthStore();
const bookingStore = useBookingStore();
const dialog = useDialogStore();

// Form state
const vehicleType = ref<VehicleType>('LatexTruck');
const locations = ref<string[]>(['Trạm cân 1']);
const currentLocationInput = ref<string>('');

// Thuộc tính riêng cho PassengerCar
const pickupTime = ref<string>('');
const dropoffTime = ref<string>('');
const contactPerson = ref<string>('');
const contactPhone = ref<string>('');

function addLocation() {
  const val = currentLocationInput.value.trim();
  if (val && !locations.value.includes(val)) {
    locations.value.push(val);
  }
  currentLocationInput.value = '';
}

function removeLocation(index: number) {
  locations.value.splice(index, 1);
}

function addQuickLocation(loc: string) {
  if (!locations.value.includes(loc)) {
    locations.value.push(loc);
  }
}
const purpose = ref<string>('Vận chuyển mủ cao su ca thu hoạch ngày lẻ');
const estimatedWeightKg = ref<number>(2500);
const passengersCount = ref<number>(3);

// Danh sách các điểm trạm / đội sản xuất gợi ý cho Requester
const popularHubs = computed(() => {
  const hubs = mockStorage.getHubs();
  if (hubs && hubs.length > 0) {
    return hubs.map((h: any) => h.shortName || h.name);
  }
  return [
    'Trạm cân 1',
    'Đội 1',
    'Đội 2',
    'Đội 3',
    'Đội 4',
    'Đội 5',
    'Nhà máy chế biến ECOTECH 2A',
    'Văn phòng Công ty',
  ];
});

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

  if (locations.value.length === 0 || !startTime.value || !endTime.value) {
    dialog.showWarning('Vui lòng điền đầy đủ các thông tin bắt buộc: ít nhất 1 địa điểm và thời gian!', 'Thiếu Thông Tin Bắt Buộc', 'Kiểm tra lại');
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
    fromLocation: locations.value.join(' ➔ '),
    toLocation: 'Chờ xếp tuyến',
    purpose: purpose.value,
    estimatedWeightKg: vehicleType.value === 'LatexTruck' ? Number(estimatedWeightKg.value) : undefined,
    passengersCount: vehicleType.value === 'PassengerCar' ? Number(passengersCount.value) : undefined,
    pickupTime: vehicleType.value === 'PassengerCar' ? pickupTime.value.replace('T', ' ') : undefined,
    dropoffTime: vehicleType.value === 'PassengerCar' ? dropoffTime.value.replace('T', ' ') : undefined,
    contactPerson: vehicleType.value === 'PassengerCar' ? contactPerson.value : undefined,
    contactPhone: vehicleType.value === 'PassengerCar' ? contactPhone.value : undefined,
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

        <!-- 1. Loại phương tiện yêu cầu -->
        <div class="form-group">
          <label class="form-label">Loại phương tiện yêu cầu <span class="required">*</span></label>
          <select v-model="vehicleType" class="form-select">
            <option value="LatexTruck">Xe tải chở mủ cao su (Bồn inox / Mui bạt)</option>
            <option value="PassengerCar">Xe bán tải đưa đón / công tác nông trường (5 chỗ)</option>
            <option value="MillingMachine">Xe máy xúc nông trường (Đào mương vườn cây)</option>
          </select>
        </div>

        <!-- 2. Chọn địa điểm yêu cầu (Không cần chọn lộ trình, bên điều phối sẽ tự động gợi ý) -->
        <div class="route-select-box">
          <div class="form-group">
            <label class="form-label">
              <MapPin :size="14" class="text-primary" />
              <span>Các địa điểm yêu cầu <span class="required">*</span></span>
            </label>

            <!-- Hiển thị các địa điểm đã chọn -->
            <div v-if="locations.length > 0" class="location-chips">
              <span v-for="(loc, index) in locations" :key="index" class="loc-tag">
                {{ loc }}
                <X :size="14" class="remove-loc" @click="removeLocation(index)" />
              </span>
            </div>

            <div class="input-with-btn">
              <input
                v-model="currentLocationInput"
                list="hub-options"
                type="text"
                class="form-input"
                placeholder="Chọn hoặc nhập thêm địa điểm và nhấn Enter..."
                @keydown.enter.prevent="addLocation"
              />
              <button type="button" class="btn btn-secondary" @click="addLocation" style="padding: 0 16px;">Thêm</button>
            </div>
            
            <datalist id="hub-options">
              <option v-for="hub in popularHubs" :key="'hub-' + hub" :value="hub" />
            </datalist>
          </div>

          <!-- Nút chọn nhanh địa điểm phổ biến -->
          <div class="quick-locations-bar">
            <span class="quick-loc-label">Thêm nhanh:</span>
            <button type="button" class="btn-loc-chip" @click="addQuickLocation('Trạm cân 1')">+ Trạm cân 1</button>
            <button type="button" class="btn-loc-chip" @click="addQuickLocation('Đội 1')">+ Đội 1</button>
            <button type="button" class="btn-loc-chip" @click="addQuickLocation('Đội 2')">+ Đội 2</button>
            <button type="button" class="btn-loc-chip" @click="addQuickLocation('Nhà máy chế biến ECOTECH 2A')">+ Nhà máy</button>
            <button type="button" class="btn-loc-chip" @click="addQuickLocation('Văn phòng Công ty')">+ Văn phòng</button>
          </div>

          <!-- Banner giải thích rõ ràng theo quy chuẩn -->
          <div class="route-hint-banner">
            <Compass :size="15" class="text-primary" />
            <span>Người đặt xe chỉ cần chọn địa điểm. Lộ trình quy chuẩn tối ưu sẽ được Bộ phận Điều phối tự động gợi ý và xếp tuyến khi duyệt.</span>
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
        <div v-if="vehicleType === 'LatexTruck'" class="form-group">
          <label class="form-label">Khối lượng mủ dự kiến (kg) <span class="required">*</span></label>
          <input v-model.number="estimatedWeightKg" type="number" step="100" min="100" class="form-input" />
          <span class="form-hint">Khối lượng này sẽ dùng để kiểm tra sức chứa khi điều phối ghép chuyến và tính định mức dầu.</span>
        </div>

        <div v-else-if="vehicleType === 'PassengerCar'" class="passenger-car-fields">
          <div class="grid-2">
            <div class="form-group">
              <label class="form-label">Giờ đón (Pick-up) <span class="required">*</span></label>
              <input v-model="pickupTime" type="datetime-local" class="form-input" />
            </div>
            <div class="form-group">
              <label class="form-label">Giờ trả (Drop-off) <span class="required">*</span></label>
              <input v-model="dropoffTime" type="datetime-local" class="form-input" />
            </div>
          </div>
          
          <div class="grid-2">
            <div class="form-group">
              <label class="form-label">Người liên hệ <span class="required">*</span></label>
              <input v-model="contactPerson" type="text" class="form-input" placeholder="Tên người điều phối đoàn / liên hệ" />
            </div>
            <div class="form-group">
              <label class="form-label">SĐT liên hệ <span class="required">*</span></label>
              <input v-model="contactPhone" type="text" class="form-input" placeholder="09xxxxxxx" />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Số người tham gia công tác <span class="required">*</span></label>
            <input v-model.number="passengersCount" type="number" min="1" class="form-input" />
          </div>
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

/* Route Select Box Styles */
.route-select-box {
  background: #fafafa;
  border: 1px solid #e5e7eb;
  border-radius: var(--radius-md, 8px);
  padding: 16px;
  margin-bottom: 16px;
}
.route-select-box .grid-2 {
  margin-bottom: 12px;
}
.quick-locations-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}
.quick-loc-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: #64748b;
}
.btn-loc-chip {
  background: #f1f5f9;
  border: 1px solid #cbd5e1;
  color: #334155;
  padding: 4px 10px;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}
.btn-loc-chip:hover {
  background: #e2e8f0;
  color: #0f172a;
}
.route-hint-banner {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  color: #1e3a8a;
  padding: 10px 14px;
  border-radius: var(--radius-sm, 4px);
  font-size: 0.8125rem;
  line-height: 1.4;
}
.location-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 10px;
}
.loc-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #e0f2fe;
  color: #0369a1;
  padding: 4px 10px;
  border-radius: var(--radius-sm, 4px);
  font-size: 0.8125rem;
  font-weight: 500;
  border: 1px solid #bae6fd;
}
.remove-loc {
  cursor: pointer;
  opacity: 0.6;
  transition: opacity 0.15s;
}
.remove-loc:hover {
  opacity: 1;
  color: #dc2626;
}
.input-with-btn {
  display: flex;
  gap: 8px;
}
.input-with-btn .form-input {
  flex: 1;
}
</style>
