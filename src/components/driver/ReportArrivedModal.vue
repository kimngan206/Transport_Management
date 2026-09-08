<script setup lang="ts">
import { ref } from 'vue';
import { useDriverStore } from '@/stores/driver';
import { useDialogStore } from '@/stores/dialog';
import type { TransportTrip } from '@/types';
import { X, MapPin, CheckCircle2, Clock } from 'lucide-vue-next';

const props = defineProps<{
  trip: TransportTrip;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'arrived'): void;
}>();

const driverStore = useDriverStore();
const dialog = useDialogStore();

const nowStr = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
const arrivalNote = ref('Đã đến điểm hẹn, sẵn sàng giao nhận mủ');

const quickNotes = [
  'Đã đến điểm hẹn, sẵn sàng giao nhận mủ',
  'Đang xếp hàng chờ cân mủ tại trạm',
  'Đang bốc dỡ mủ cao su vào bể chứa',
  'Đã bàn giao hàng an toàn cho đại diện trạm',
];

function setQuickNote(note: string) {
  arrivalNote.value = note;
}

function handleReport() {
  const res = driverStore.reportArrived(props.trip.id, arrivalNote.value.trim());
  if (res.success) {
    emit('arrived');
    emit('close');
    dialog.showSuccess(
      `Đã cập nhật trạng thái: Xe ${props.trip.vehiclePlate} đã đến điểm hẹn an toàn!`,
      'Báo Cáo Đến Nơi Thành Công'
    );
  } else {
    dialog.showWarning(res.message, 'Không Thể Cập Nhật');
  }
}
</script>

<template>
  <div class="modal-backdrop" @click.self="emit('close')">
    <div class="modal-content">
      <div class="modal-header">
        <h3 class="modal-title">
          <MapPin :size="20" class="text-warning" />
          <span>Báo Cáo Đã Đến Nơi — {{ trip.tripCode }}</span>
        </h3>
        <button class="btn-close" @click="emit('close')">
          <X :size="18" />
        </button>
      </div>

      <div class="modal-body">
        <div class="trip-summary-box">
          <div class="summary-line">
            <span class="label">Phương tiện:</span>
            <strong>{{ trip.vehiclePlate }} ({{ trip.vehicleType }})</strong>
          </div>
          <div class="summary-line">
            <span class="label">Lộ trình:</span>
            <strong>{{ trip.routeName }}</strong>
          </div>
          <div class="summary-line">
            <span class="label">Thời điểm ghi nhận:</span>
            <span class="badge-time">
              <Clock :size="13" />
              <strong>{{ nowStr }} hôm nay</strong>
            </span>
          </div>
        </div>

        <div class="form-group mt-3">
          <label class="form-label">
            <span>Ghi chú hiện trạng tại điểm đến:</span>
          </label>
          <input
            v-model="arrivalNote"
            type="text"
            class="form-input"
            placeholder="VD: Đang xếp hàng chờ cân mủ tại trạm..."
          />

          <!-- Gợi ý ghi chú nhanh -->
          <div class="quick-notes-wrap mt-2">
            <span class="quick-title">Gợi ý nhanh:</span>
            <div class="quick-chips">
              <button
                v-for="note in quickNotes"
                :key="note"
                type="button"
                class="chip-btn"
                :class="{ active: arrivalNote === note }"
                @click="setQuickNote(note)"
              >
                {{ note }}
              </button>
            </div>
          </div>
        </div>

        <div class="alert alert-info mt-3">
          <CheckCircle2 :size="18" class="text-info" />
          <span>
            Thông tin "Đã đến nơi" sẽ được gửi ngay đến <strong>Điều phối viên</strong> và hiển thị trực tiếp trên Bản đồ giám sát lộ trình.
          </span>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn btn-outline" @click="emit('close')">Hủy bỏ</button>
        <button class="btn btn-warning" @click="handleReport">
          <MapPin :size="16" />
          <span>Xác Nhận Đã Đến Nơi</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 16px;
}
.modal-content {
  background: white;
  border-radius: var(--radius-lg);
  width: 100%;
  max-width: 520px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  overflow: hidden;
  animation: modal-enter 0.2s ease-out;
}
@keyframes modal-enter {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}
.modal-header {
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.modal-title {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 8px;
}
.btn-close {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-muted);
  padding: 4px;
  border-radius: var(--radius-sm);
}
.btn-close:hover {
  background: var(--bg-hover);
  color: var(--text);
}
.modal-body {
  padding: 20px;
}
.trip-summary-box {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: var(--radius-md);
  padding: 12px 14px;
  font-size: 0.8125rem;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.summary-line {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.summary-line .label {
  color: var(--text-secondary);
}
.badge-time {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: #fef3c7;
  color: #b45309;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.75rem;
}
.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.form-label {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text);
}
.form-input {
  width: 100%;
  padding: 9px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  outline: none;
}
.form-input:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 2px rgba(21, 128, 61, 0.15);
}
.quick-notes-wrap {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.quick-title {
  font-size: 0.6875rem;
  color: var(--text-muted);
  font-weight: 600;
}
.quick-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.chip-btn {
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 0.6875rem;
  color: #475569;
  cursor: pointer;
  text-align: left;
  transition: all 0.15s;
}
.chip-btn:hover {
  background: #e2e8f0;
  color: #0f172a;
}
.chip-btn.active {
  background: #dbeafe;
  border-color: #93c5fd;
  color: #1e40af;
  font-weight: 600;
}
.alert {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: var(--radius-md);
  font-size: 0.75rem;
  line-height: 1.4;
}
.alert-info {
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  color: #1e40af;
}
.modal-footer {
  padding: 14px 20px;
  border-top: 1px solid var(--border);
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  background: #f8fafc;
}
.text-warning { color: #d97706; }
.btn-warning {
  background: #d97706;
  color: white;
  border: none;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: var(--radius-md);
  font-size: 0.8125rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-warning:hover {
  background: #b45309;
}
.btn-outline {
  background: white;
  border: 1px solid var(--border);
  color: var(--text-secondary);
  padding: 8px 14px;
  border-radius: var(--radius-md);
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
}
.btn-outline:hover {
  background: #f1f5f9;
}
</style>
