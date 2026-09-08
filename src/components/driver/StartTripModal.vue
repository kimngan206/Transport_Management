<script setup lang="ts">
import { ref } from 'vue';
import { useDriverStore } from '@/stores/driver';
import { useFleetStore } from '@/stores/fleet';
import { useDialogStore } from '@/stores/dialog';
import type { TransportTrip } from '@/types';
import { X, Play, AlertCircle, Gauge } from 'lucide-vue-next';

const props = defineProps<{
  trip: TransportTrip;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'started'): void;
}>();

const driverStore = useDriverStore();
const fleetStore = useFleetStore();
const dialog = useDialogStore();

const vehicle = fleetStore.vehicles.find((v) => v.id === props.trip.vehicleId);
const currentOdo = vehicle ? vehicle.currentOdoKm : 0;
const startOdo = ref<number>(currentOdo);
const errorMsg = ref<string>('');

function formatNumberWithDots(val: number | string | undefined | null): string {
  if (val === null || val === undefined || val === '') return '';
  const numStr = val.toString().replace(/\D/g, '');
  if (!numStr) return '';
  return numStr.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function onOdoInput(event: Event) {
  const target = event.target as HTMLInputElement;
  const raw = target.value.replace(/\D/g, '');
  startOdo.value = raw ? parseInt(raw, 10) : 0;
  target.value = raw ? formatNumberWithDots(raw) : '';
}

function handleStart() {
  errorMsg.value = '';
  if (!startOdo.value || startOdo.value <= 0) {
    dialog.showWarning('Vui lòng kiểm tra và nhập chỉ số ODO xuất bến hợp lệ!', 'Chỉ Số ODO Không Hợp Lệ', 'Kiểm tra lại');
    return;
  }
  const res = driverStore.startTrip(props.trip.id, Number(startOdo.value));
  if (!res.success) {
    errorMsg.value = res.message;
    dialog.showWarning(res.message || 'Không thể bắt đầu chuyến đi!', 'Bắt Đầu Chuyến Thất Bại', 'Thực hiện lại');
  } else {
    emit('started');
    emit('close');
    dialog.showSuccess(`Chuyến xe ${props.trip.tripCode} đã bắt đầu xuất bến thành công! Chúc bác tài lái xe an toàn.`, 'Xuất Bến Thành Công');
  }
}
</script>

<template>
  <div class="modal-backdrop" @click.self="emit('close')">
    <div class="modal-content">
      <div class="modal-header">
        <h3 class="modal-title">
          <Play :size="20" class="text-primary" />
          <span>Bắt Đầu Chuyến Xe {{ trip.tripCode }}</span>
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

        <div class="trip-summary-box">
          <div>Phương tiện: <strong>{{ trip.vehiclePlate }}</strong> ({{ trip.vehicleType }})</div>
          <div>Lộ trình: <strong>{{ trip.routeName }}</strong> (Cự ly chuẩn: {{ trip.standardDistanceKm }} km)</div>
          <div>Tài xế phụ trách: <strong>{{ trip.driverName }}</strong></div>
        </div>

        <div class="form-group mt-3">
          <label class="form-label">
            <Gauge :size="16" />
            <span>Chỉ số ODO xuất bến (km) <span class="required">*</span></span>
          </label>
          <input
            :value="formatNumberWithDots(startOdo)"
            @input="onOdoInput($event)"
            type="text"
            inputmode="numeric"
            class="form-input text-lg font-bold"
          />
          <span class="form-hint">
            ODO gần nhất của xe: <strong>{{ currentOdo.toLocaleString() }} km</strong>.
            Theo quy định: ODO xuất phát phải ≥ ODO gần nhất của xe để tránh sai lệch ODO.
          </span>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn btn-secondary" @click="emit('close')">Hủy</button>
        <button class="btn btn-primary" @click="handleStart">
          Xác Nhận Xuất Bến
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
.trip-summary-box {
  background: #f8fafc;
  border: 1px solid var(--border);
  padding: 14px;
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.text-lg { font-size: 1.25rem; }
.font-bold { font-weight: 700; }
.mt-3 { margin-top: 12px; }
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
</style>
