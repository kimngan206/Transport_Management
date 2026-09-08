<script setup lang="ts">
import { ref, computed } from 'vue';
import { useDriverStore } from '@/stores/driver';
import { useFleetStore } from '@/stores/fleet';
import { useDialogStore } from '@/stores/dialog';
import type { TransportTrip, TripExpense } from '@/types';
import { X, CheckCircle, AlertCircle, Calculator, Plus, Trash2 } from 'lucide-vue-next';

const props = defineProps<{
  trip: TransportTrip;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'completed'): void;
}>();

const driverStore = useDriverStore();
const fleetStore = useFleetStore();
const dialog = useDialogStore();

const vehicle = fleetStore.vehicles.find((v) => v.id === props.trip.vehicleId);
const startOdo = props.trip.startOdo || (vehicle ? vehicle.currentOdoKm : 0);

// Default end ODO dựa trên cự ly chuẩn của tuyến
const defaultDistance = props.trip.standardDistanceKm || 26;
const endOdo = ref<number>(startOdo + defaultDistance);

// Mủ cao su (US-23)
const latexLiquidKg = ref<number>(2500);
const latexScrapKg = ref<number>(200);

// Giờ máy (xe xúc)
const startHour = ref<number>(vehicle?.currentOperatingHours || 4820);
const endHour = ref<number>((vehicle?.currentOperatingHours || 4820) + 4);

// Nhiên liệu thực tế
const actualFuel = ref<number>(10.5);
const notes = ref<string>('Hoàn thành chuyến đi an toàn');
const errorMsg = ref<string>('');

// Chi phí chuyến đi
interface TempExpense {
  expenseType: TripExpense['expenseType'];
  amount: number;
  receiptNote: string;
}
const expenses = ref<TempExpense[]>([
  { expenseType: 'Toll', amount: 35000, receiptNote: 'Vé trạm thu phí' },
]);

function addExpense() {
  expenses.value.push({ expenseType: 'Fuel', amount: 0, receiptNote: '' });
}
function removeExpense(idx: number) {
  expenses.value.splice(idx, 1);
}

// Phân tách hàng nghìn bằng dấu "." (chuẩn hiển thị tiền tệ & số liệu Việt Nam)
function formatNumberWithDots(val: number | string | undefined | null): string {
  if (val === null || val === undefined || val === '') return '';
  const numStr = val.toString().replace(/\D/g, '');
  if (!numStr) return '';
  return numStr.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function onExpenseAmountInput(event: Event, exp: TempExpense) {
  const target = event.target as HTMLInputElement;
  const rawValue = target.value.replace(/\D/g, '');
  const num = rawValue ? parseInt(rawValue, 10) : 0;
  exp.amount = num;
  target.value = rawValue ? formatNumberWithDots(rawValue) : '';
}

function onNumberInput(event: Event, setter: (val: number) => void) {
  const target = event.target as HTMLInputElement;
  const rawValue = target.value.replace(/\D/g, '');
  const num = rawValue ? parseInt(rawValue, 10) : 0;
  setter(num);
  target.value = rawValue ? formatNumberWithDots(rawValue) : '';
}

const totalExpenseAmount = computed(() => {
  return expenses.value.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
});

// Tính toán thời gian thực ngay trong modal (US-23)
const totalLatexKg = computed(() => {
  return Number(latexLiquidKg.value || 0) + Number(latexScrapKg.value || 0);
});

const calculatedDistance = computed(() => {
  if (vehicle?.vehicleType === 'Excavator') return 0;
  return Math.max(0, Number(endOdo.value || 0) - startOdo);
});

const calculatedFuelLiters = computed(() => {
  if (!vehicle) return 0;
  const dist = props.trip.standardDistanceKm || calculatedDistance.value;

  if (vehicle.vehicleType === 'Truck') {
    const emptyFuel = dist * (vehicle.fuelQuotaEmpty || 0.25);
    const loadedFuel = (totalLatexKg.value / 1000) * dist * (vehicle.fuelQuotaLoaded || 0.02);
    return Number((emptyFuel + loadedFuel).toFixed(2));
  } else if (vehicle.vehicleType === 'Pickup') {
    return Number((dist * (vehicle.fuelQuotaEmpty || 0.1)).toFixed(2));
  } else if (vehicle.vehicleType === 'Excavator') {
    const hours = Math.max(0, Number(endHour.value || 0) - Number(startHour.value || 0));
    return Number((hours * (vehicle.hourMeterQuota || 14.5)).toFixed(2));
  }
  return 0;
});

const fuelVariance = computed(() => {
  return Number((Number(actualFuel.value || 0) - calculatedFuelLiters.value).toFixed(2));
});

function handleComplete() {
  errorMsg.value = '';

  if (vehicle?.vehicleType !== 'Excavator' && Number(endOdo.value) < startOdo) {
    errorMsg.value = 'Chỉ số ODO về bến không thể nhỏ hơn ODO xuất bến!';
    dialog.showWarning('Chỉ số ODO về bến không thể nhỏ hơn ODO lúc xuất bến!', 'Sai Lệch Chỉ Số ODO', 'Kiểm tra lại');
    return;
  }

  const res = driverStore.completeTrip(props.trip.id, {
    endOdo: Number(endOdo.value),
    actualFuelFilledLiters: Number(actualFuel.value),
    weightLatex1Kg: Number(latexLiquidKg.value),
    weightLatex2Kg: 0,
    weightLatex3Kg: 0,
    weightLatexTapKg: Number(latexScrapKg.value),
    startHourMeter: vehicle?.vehicleType === 'Excavator' ? Number(startHour.value) : undefined,
    endHourMeter: vehicle?.vehicleType === 'Excavator' ? Number(endHour.value) : undefined,
    expenses: expenses.value.filter((e) => e.amount > 0),
    notes: notes.value,
  });

  if (!res.success) {
    errorMsg.value = res.message;
    dialog.showWarning(res.message || 'Không thể hoàn thành chuyến xe!', 'Hoàn Thành Chuyến Thất Bại', 'Thực hiện lại');
  } else {
    emit('completed');
    emit('close');
    dialog.showSuccess(`Đã hoàn thành và nghiệm thu chuyến xe ${props.trip.tripCode}! Dữ liệu ODO, sản lượng mủ và chi phí đã được lưu thành công.`, 'Hoàn Thành Chuyến Đi');
  }
}
</script>

<template>
  <div class="modal-backdrop" @click.self="emit('close')">
    <div class="modal-content modal-lg">
      <div class="modal-header">
        <h3 class="modal-title">
          <CheckCircle :size="20" class="text-success" />
          <span>Hoàn Thành Chuyến Xe {{ trip.tripCode }}</span>
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

        <!-- 1. Chỉ số ODO hoặc Giờ máy -->
        <div v-if="vehicle?.vehicleType !== 'Excavator'" class="grid-2 section-box">
          <div class="form-group">
            <label class="form-label">Chỉ số ODO xuất bến</label>
            <input :value="startOdo.toLocaleString() + ' km'" disabled class="form-input bg-gray" />
          </div>

          <div class="form-group">
            <label class="form-label">Chỉ số ODO về bến (km) <span class="required">*</span></label>
            <input
              :value="formatNumberWithDots(endOdo)"
              @input="onNumberInput($event, (val) => (endOdo = val))"
              type="text"
              inputmode="numeric"
              class="form-input font-bold text-end"
            />
            <span class="form-hint text-success font-bold">
              Quãng đường thực tế: {{ calculatedDistance.toLocaleString() }} km (Tuyến quy chuẩn: {{ trip.standardDistanceKm }} km)
            </span>
          </div>
        </div>

        <div v-else class="grid-2 section-box">
          <div class="form-group">
            <label class="form-label">Giờ máy bắt đầu (Hour Meter)</label>
            <input v-model.number="startHour" type="number" class="form-input bg-gray" />
          </div>

          <div class="form-group">
            <label class="form-label">Giờ máy kết thúc (Hour Meter) <span class="required">*</span></label>
            <input v-model.number="endHour" type="number" class="form-input font-bold" />
            <span class="form-hint text-success font-bold">
              Thời gian vận hành: {{ Math.max(0, endHour - startHour) }} giờ
            </span>
          </div>
        </div>

        <!-- 2. Khối lượng mủ cao su thu hoạch -->
        <div v-if="vehicle?.vehicleType === 'Truck'" class="section-box mt-3">
          <h4 class="section-title">Khối lượng mủ thu hoạch</h4>
          <div class="grid-2">
            <div class="form-group">
              <label class="form-label">Khối lượng mủ nước (kg)</label>
              <input
                :value="formatNumberWithDots(latexLiquidKg)"
                @input="onNumberInput($event, (val) => (latexLiquidKg = val))"
                type="text"
                inputmode="numeric"
                class="form-input text-end font-semibold"
                placeholder="0"
              />
            </div>
            <div class="form-group">
              <label class="form-label">Khối lượng mủ tạp (kg)</label>
              <input
                :value="formatNumberWithDots(latexScrapKg)"
                @input="onNumberInput($event, (val) => (latexScrapKg = val))"
                type="text"
                inputmode="numeric"
                class="form-input text-end font-semibold"
                placeholder="0"
              />
            </div>
          </div>
          <div class="total-latex-bar">
            Tổng khối lượng mủ: <strong>{{ totalLatexKg.toLocaleString() }} kg</strong> ({{ (totalLatexKg / 1000).toFixed(2) }} tấn)
          </div>
        </div>

        <!-- 3. Bảng tính nhiên liệu tiêu chuẩn -->
        <div class="calc-fuel-box mt-3">
          <div class="calc-header">
            <Calculator :size="16" class="text-primary" />
            <span class="calc-title">Tính toán Định mức Nhiên liệu Tiêu chuẩn:</span>
          </div>

          <div class="calc-details-grid">
            <div class="calc-item">
              <span class="calc-label">Dầu tiêu chuẩn:</span>
              <span class="calc-val text-primary">{{ calculatedFuelLiters }} Lít</span>
            </div>

            <div class="calc-item">
              <span class="calc-label">Dầu thực tế đổ (Lít):</span>
              <input v-model.number="actualFuel" type="number" step="0.1" class="form-input fuel-input text-end" />
            </div>

            <div class="calc-item">
              <span class="calc-label">Chênh lệch (Variance):</span>
              <span class="calc-val" :class="fuelVariance > 0 ? 'text-danger' : 'text-success'">
                {{ fuelVariance > 0 ? '+' : '' }}{{ fuelVariance }} Lít
              </span>
            </div>
          </div>
          <span class="form-hint mt-2">
            Công thức xe tải: (Cự ly × NLP {{ vehicle?.fuelQuotaEmpty }}L/km) + [(Tấn mủ) × Cự ly × NLC {{ vehicle?.fuelQuotaLoaded }}L/tấn.km]
          </span>
        </div>

        <!-- 4. Khai báo chi phí chuyến đi -->
        <div class="section-box mt-3">
          <div class="flex-between">
            <h4 class="section-title">Khai báo chi phí chuyến đi</h4>
            <button class="btn btn-secondary btn-sm" @click="addExpense">
              <Plus :size="14" />
              <span>Thêm chi phí</span>
            </button>
          </div>

          <div v-for="(exp, idx) in expenses" :key="idx" class="expense-row">
            <select v-model="exp.expenseType" class="form-select expense-type">
              <option value="Toll">Vé cầu đường (Toll)</option>
              <option value="Fuel">Xăng dầu (Fuel)</option>
              <option value="Parking">Bãi đỗ xe (Parking)</option>
              <option value="Repair">Sửa chữa nhanh</option>
              <option value="Other">Khác</option>
            </select>
            <div class="expense-amount-wrap">
              <input
                :value="formatNumberWithDots(exp.amount)"
                @input="onExpenseAmountInput($event, exp)"
                type="text"
                inputmode="numeric"
                class="form-input expense-amount font-bold text-end"
                placeholder="0"
              />
              <span class="currency-suffix">đ</span>
            </div>
            <input v-model="exp.receiptNote" type="text" class="form-input expense-note" placeholder="Ghi chú hóa đơn..." />
            <button class="btn-del" @click="removeExpense(idx)" title="Xóa chi phí">
              <Trash2 :size="16" />
            </button>
          </div>

          <div v-if="expenses.length > 0" class="total-expense-summary">
            <span>Tổng cộng chi phí:</span>
            <strong class="text-primary font-bold">{{ formatNumberWithDots(totalExpenseAmount) }} đ</strong>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn btn-secondary" @click="emit('close')">Đóng</button>
        <button class="btn btn-success" @click="handleComplete">
          Xác Nhận Hoàn Tất Chuyến Đi
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-lg { max-width: 820px; }
.btn-close { background: transparent; border: none; cursor: pointer; color: var(--text-muted); }
.section-box {
  background: #f8fafc;
  border: 1px solid var(--border);
  padding: 14px;
  border-radius: var(--radius-md);
}
.section-title {
  font-size: 0.875rem;
  font-weight: 700;
  margin-bottom: 8px;
}
.bg-gray { background-color: #e2e8f0; color: #475569; }
.font-bold { font-weight: 700; }
.text-success { color: #16a34a; }
.text-primary { color: #15803d; }
.text-danger { color: #dc2626; }
.mt-2 { margin-top: 8px; }
.mt-3 { margin-top: 12px; }
.total-latex-bar {
  background: #dcfce7;
  color: #166534;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 0.8125rem;
  margin-top: 6px;
}
.calc-fuel-box {
  background: #f0fdf4;
  border: 1px solid #86efac;
  padding: 14px;
  border-radius: var(--radius-md);
}
.calc-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
  font-size: 0.875rem;
  margin-bottom: 8px;
}
.calc-details-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  align-items: center;
}
.calc-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.calc-label { font-size: 0.75rem; font-weight: 600; color: var(--text-secondary); }
.calc-val { font-size: 1.125rem; font-weight: 800; }
.fuel-input { padding: 6px 10px; font-weight: 700; }
.flex-between { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.expense-row {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;
}
.expense-type { width: 175px; }
.expense-amount-wrap {
  position: relative;
  display: flex;
  align-items: center;
  width: 155px;
}
.expense-amount {
  width: 100%;
  padding-right: 26px !important;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
}
.currency-suffix {
  position: absolute;
  right: 9px;
  font-size: 0.75rem;
  color: var(--text-muted);
  font-weight: 700;
  pointer-events: none;
}
.expense-note { flex: 1; }
.btn-del { background: transparent; border: none; cursor: pointer; color: var(--danger); padding: 6px; }
.btn-del:hover { background: #fee2e2; border-radius: 4px; }
.total-expense-summary {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed var(--border-card);
  font-size: 0.8125rem;
  color: var(--text-secondary);
}
.text-end { text-align: right; }
.font-semibold { font-weight: 600; }
.alert { display: flex; align-items: center; gap: 10px; padding: 12px; border-radius: var(--radius-sm); margin-bottom: 14px; }
.alert-danger { background: #fee2e2; border: 1px solid #fecaca; color: #b91c1c; }
</style>
