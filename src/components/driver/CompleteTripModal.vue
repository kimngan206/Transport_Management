<script setup lang="ts">
import { ref, computed } from 'vue';
import { useDriverStore } from '@/stores/driver';
import { useFleetStore } from '@/stores/fleet';
import { useDialogStore } from '@/stores/dialog';
import type { TransportTrip, TripExpense } from '@/types';
import {
  X,
  CheckCircle,
  CheckCircle2,
  AlertCircle,
  Calculator,
  Plus,
  Trash2,
  Camera,
  ZoomIn,
  AlertTriangle,
} from 'lucide-vue-next';
import {
  getPetrolimexReceiptSample,
  getTollReceiptSample,
  getWeighStationReceiptSample,
  getRepairReceiptSample,
} from '@/utils/receiptSamples';

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
const previewProofModalImage = ref<string | null>(null);

// Chi phí chuyến đi
interface TempExpense {
  id?: number;
  expenseType: TripExpense['expenseType'];
  amount: number;
  receiptNote: string;
  receiptImage?: string;
  sampleName?: string;
  auditStatus?: TripExpense['auditStatus'];
}

const expenses = ref<TempExpense[]>(
  props.trip.expenses && props.trip.expenses.length > 0
    ? props.trip.expenses.map((e) => ({
        id: e.id,
        expenseType: e.expenseType,
        amount: e.amount,
        receiptNote: e.receiptNote || '',
        receiptImage: e.receiptImage,
        sampleName: e.receiptImage ? 'Ảnh chụp hóa đơn chứng từ' : undefined,
        auditStatus: e.auditStatus,
      }))
    : [
        {
          expenseType: 'Toll',
          amount: 35000,
          receiptNote: 'Vé trạm thu phí BOT ĐT741',
          receiptImage: getTollReceiptSample(props.trip.vehiclePlate, '35.000 đ'),
          sampleName: 'Vé BOT ĐT741',
        },
      ]
);

function addExpense() {
  expenses.value.push({ expenseType: 'Fuel', amount: 0, receiptNote: '' });
}
function removeExpense(idx: number) {
  expenses.value.splice(idx, 1);
}

function onFileInputChange(event: Event, exp: TempExpense) {
  const target = event.target as HTMLInputElement;
  if (!target.files || target.files.length === 0) return;
  const file = target.files[0];
  const reader = new FileReader();
  reader.onload = (e) => {
    if (e.target?.result) {
      exp.receiptImage = e.target.result as string;
      exp.sampleName = file.name;
    }
  };
  reader.readAsDataURL(file);
}

function applySampleReceipt(exp: TempExpense, type: 'Fuel' | 'Toll' | 'Weigh' | 'Repair') {
  const plate = props.trip.vehiclePlate || '51C-889.26';

  if (type === 'Fuel') {
    exp.expenseType = 'Fuel';
    if (!exp.amount) exp.amount = 850000;
    if (!exp.receiptNote) exp.receiptNote = 'Hóa đơn đổ dầu DO Petrolimex';
    exp.receiptImage = getPetrolimexReceiptSample(plate, formatNumberWithDots(exp.amount) + ' đ', '45.2 Lít');
    exp.sampleName = 'Mẫu HĐ Petrolimex';
  } else if (type === 'Toll') {
    exp.expenseType = 'Toll';
    if (!exp.amount) exp.amount = 35000;
    if (!exp.receiptNote) exp.receiptNote = 'Vé trạm thu phí BOT ĐT741';
    exp.receiptImage = getTollReceiptSample(plate, formatNumberWithDots(exp.amount) + ' đ');
    exp.sampleName = 'Mẫu Vé BOT ĐT741';
  } else if (type === 'Weigh') {
    exp.expenseType = 'Other';
    if (!exp.amount) exp.amount = 50000;
    if (!exp.receiptNote) exp.receiptNote = 'Phí trạm cân tiếp nhận mủ cao su TC1';
    exp.receiptImage = getWeighStationReceiptSample(plate, '4.800 kg mủ', formatNumberWithDots(exp.amount) + ' đ');
    exp.sampleName = 'Mẫu Phiếu Cân Mủ';
  } else if (type === 'Repair') {
    exp.expenseType = 'Repair';
    if (!exp.amount) exp.amount = 150000;
    if (!exp.receiptNote) exp.receiptNote = 'Vá lốp xe tải lưu động khẩn cấp';
    exp.receiptImage = getRepairReceiptSample(plate, formatNumberWithDots(exp.amount) + ' đ');
    exp.sampleName = 'Mẫu Biên Lai Vá Vỏ';
  }
}

function removeReceiptImage(exp: TempExpense) {
  exp.receiptImage = undefined;
  exp.sampleName = undefined;
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

const verifiedExpensesCount = computed(() => {
  return expenses.value.filter((e) => e.amount > 0 && !!e.receiptImage).length;
});

// Tính toán thời gian thực ngay trong modal (US-23)
const totalLatexKg = computed(() => {
  return Number(latexLiquidKg.value || 0) + Number(latexScrapKg.value || 0);
});

const calculatedDistance = computed(() => {
  if (vehicle?.vehicleType === 'MillingMachine') return 0;
  return Math.max(0, Number(endOdo.value || 0) - startOdo);
});

const calculatedFuelLiters = computed(() => {
  if (!vehicle) return 0;
  const dist = props.trip.standardDistanceKm || calculatedDistance.value;

  if (vehicle.vehicleType === 'LatexTruck') {
    const emptyFuel = dist * (vehicle.fuelQuotaEmpty || 0.25);
    const loadedFuel = (totalLatexKg.value / 1000) * dist * (vehicle.fuelQuotaLoaded || 0.02);
    return Number((emptyFuel + loadedFuel).toFixed(2));
  } else if (vehicle.vehicleType === 'PassengerCar') {
    return Number((dist * (vehicle.fuelQuotaEmpty || 0.1)).toFixed(2));
  } else if (vehicle.vehicleType === 'MillingMachine') {
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

  if (vehicle?.vehicleType !== 'MillingMachine' && Number(endOdo.value) < startOdo) {
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
    startHourMeter: vehicle?.vehicleType === 'MillingMachine' ? Number(startHour.value) : undefined,
    endHourMeter: vehicle?.vehicleType === 'MillingMachine' ? Number(endHour.value) : undefined,
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
        <div v-if="vehicle?.vehicleType !== 'MillingMachine'" class="grid-2 section-box">
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
        <div v-if="vehicle?.vehicleType === 'LatexTruck'" class="section-box mt-3">
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

        <!-- 4. Khai báo chi phí chuyến đi & Bằng chứng xác minh -->
        <div class="section-box mt-3">
          <div class="flex-between">
            <div>
              <h4 class="section-title mb-0">Kê khai chi phí phát sinh & Bằng chứng xác minh</h4>
              <p class="section-subtitle">
                Đính kèm ảnh chụp hóa đơn, vé trạm BOT, phiếu cân mủ để Điều phối & Kế toán xác minh tính trung thực
              </p>
            </div>
            <button class="btn btn-secondary btn-sm" @click="addExpense">
              <Plus :size="14" />
              <span>Thêm khoản chi</span>
            </button>
          </div>

          <div v-if="expenses.length === 0" class="empty-expense-hint">
            <span>Không phát sinh chi phí cho chuyến xe này.</span>
          </div>

          <div
            v-for="(exp, idx) in expenses"
            :key="idx"
            class="expense-item-card"
            :class="{ 'has-proof': !!exp.receiptImage, 'no-proof': !exp.receiptImage }"
          >
            <!-- Hàng 1: Loại chi phí, Số tiền, Ghi chú, Nút xóa -->
            <div class="expense-inputs-row">
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

              <input
                v-model="exp.receiptNote"
                type="text"
                class="form-input expense-note"
                placeholder="Ghi chú số hóa đơn / số vé..."
              />

              <button class="btn-del" @click="removeExpense(idx)" title="Xóa khoản chi này">
                <Trash2 :size="16" />
              </button>
            </div>

            <!-- Hàng 2: Khu vực đính kèm bằng chứng xác minh (Proof / Evidence) -->
            <div class="expense-proof-row">
              <div v-if="exp.receiptImage" class="proof-attached-box">
                <div class="proof-thumbnail-preview" @click="previewProofModalImage = exp.receiptImage">
                  <img :src="exp.receiptImage" alt="Ảnh hóa đơn" class="proof-thumb" />
                  <div class="zoom-hover-overlay">
                    <ZoomIn :size="14" />
                    <span>Xem lớn</span>
                  </div>
                </div>

                <div class="proof-info-meta">
                  <div class="proof-badge-verified">
                    <CheckCircle2 :size="13" />
                    <span>Đã có ảnh bằng chứng xác minh</span>
                  </div>
                  <span class="proof-file-name text-xs text-muted">
                    {{ exp.sampleName || 'Ảnh chụp hóa đơn chứng từ' }}
                  </span>
                </div>

                <div class="proof-actions">
                  <label class="btn-action-text text-primary">
                    <Camera :size="13" />
                    <span>Đổi ảnh</span>
                    <input
                      type="file"
                      accept="image/*"
                      class="hidden-file-input"
                      @change="onFileInputChange($event, exp)"
                    />
                  </label>
                  <button type="button" class="btn-action-text text-danger" @click="removeReceiptImage(exp)">
                    <span>✕ Xóa ảnh</span>
                  </button>
                </div>
              </div>

              <div v-else class="proof-upload-box">
                <div class="proof-warning-tag">
                  <AlertTriangle :size="13" class="text-amber" />
                  <span>Chưa có ảnh bằng chứng xác minh:</span>
                </div>

                <!-- Nút tải ảnh thật từ camera/thiết bị -->
                <label class="btn btn-outline btn-xs btn-upload-proof">
                  <Camera :size="13" />
                  <span>Chụp / Tải ảnh hóa đơn</span>
                  <input
                    type="file"
                    accept="image/*"
                    class="hidden-file-input"
                    @change="onFileInputChange($event, exp)"
                  />
                </label>

                <!-- Bộ nút chọn mẫu chứng từ nhanh phục vụ kiểm thử -->
                <div class="quick-samples-group">
                  <span class="text-xxs text-muted">Mẫu nhanh:</span>
                  <button
                    type="button"
                    class="btn-sample-chip"
                    @click="applySampleReceipt(exp, 'Toll')"
                    title="Đính kèm mẫu vé BOT thu phí đường bộ"
                  >
                    🎫 Vé BOT
                  </button>
                  <button
                    type="button"
                    class="btn-sample-chip"
                    @click="applySampleReceipt(exp, 'Fuel')"
                    title="Đính kèm mẫu hóa đơn xăng dầu Petrolimex"
                  >
                    ⛽ HĐ Xăng dầu
                  </button>
                  <button
                    type="button"
                    class="btn-sample-chip"
                    @click="applySampleReceipt(exp, 'Weigh')"
                    title="Đính kèm mẫu phiếu cân mủ cao su"
                  >
                    ⚖️ Phiếu cân mủ
                  </button>
                  <button
                    type="button"
                    class="btn-sample-chip"
                    @click="applySampleReceipt(exp, 'Repair')"
                    title="Đính kèm mẫu biên lai vá vỏ / sửa chữa"
                  >
                    🔧 Vá vỏ
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Tổng kết chi phí & chứng từ -->
          <div v-if="expenses.length > 0" class="total-expense-summary-box">
            <div class="expense-proof-stats">
              <span class="proof-stat-item">
                Chứng từ xác minh: 
                <strong :class="verifiedExpensesCount === expenses.length ? 'text-success' : 'text-amber'">
                  {{ verifiedExpensesCount }} / {{ expenses.length }} khoản chi
                </strong>
              </span>
              <span v-if="verifiedExpensesCount < expenses.length" class="text-xs text-amber font-medium">
                (Khoản chi thiếu hóa đơn có thể phải giải trình lại)
              </span>
            </div>

            <div class="expense-total-amount">
              <span>Tổng cộng chi phí:</span>
              <strong class="text-primary font-bold">{{ formatNumberWithDots(totalExpenseAmount) }} đ</strong>
            </div>
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

    <!-- Lightbox phóng to ảnh hóa đơn -->
    <div v-if="previewProofModalImage" class="lightbox-overlay" @click.self="previewProofModalImage = null">
      <div class="lightbox-content">
        <button class="lightbox-close" @click="previewProofModalImage = null">
          <X :size="20" />
        </button>
        <img :src="previewProofModalImage" alt="Hóa đơn bằng chứng chi phí" class="lightbox-img" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-lg { max-width: 840px; }
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
}
.section-subtitle {
  font-size: 0.75rem;
  color: var(--text-secondary);
  margin-top: 2px;
  margin-bottom: 0;
}
.bg-gray { background-color: #e2e8f0; color: #475569; }
.font-bold { font-weight: 700; }
.font-medium { font-weight: 500; }
.text-success { color: #16a34a; }
.text-primary { color: #15803d; }
.text-danger { color: #dc2626; }
.text-amber { color: #b45309; }
.mt-2 { margin-top: 8px; }
.mt-3 { margin-top: 12px; }
.mb-0 { margin-bottom: 0; }
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

/* Expense item cards */
.expense-item-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 10px 12px;
  margin-bottom: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: border-color 0.2s;
}
.expense-item-card.has-proof {
  border-color: #86efac;
}
.expense-item-card.no-proof {
  border-color: #fde68a;
}
.expense-inputs-row {
  display: flex;
  gap: 8px;
  align-items: center;
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

/* Proof Row */
.expense-proof-row {
  padding-top: 6px;
  border-top: 1px dashed #f1f5f9;
}
.proof-attached-box {
  display: flex;
  align-items: center;
  gap: 12px;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 6px;
  padding: 6px 10px;
}
.proof-thumbnail-preview {
  position: relative;
  width: 50px;
  height: 50px;
  border-radius: 4px;
  overflow: hidden;
  border: 1px solid #cbd5e1;
  background: #ffffff;
  cursor: pointer;
  flex-shrink: 0;
}
.proof-thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.zoom-hover-overlay {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(15, 23, 42, 0.6);
  color: white;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  font-size: 0.5625rem;
  opacity: 0;
  transition: opacity 0.2s;
}
.proof-thumbnail-preview:hover .zoom-hover-overlay {
  opacity: 1;
}
.proof-info-meta {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.proof-badge-verified {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 0.75rem;
  font-weight: 700;
  color: #15803d;
}
.proof-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.btn-action-text {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  background: transparent;
  border: none;
  padding: 4px 6px;
  border-radius: 4px;
}
.btn-action-text:hover {
  background: rgba(0, 0, 0, 0.05);
}

.proof-upload-box {
  display: flex;
  align-items: center;
  gap: 10px;
  background: #fffbeb;
  border: 1px dashed #fde68a;
  border-radius: 6px;
  padding: 6px 10px;
  flex-wrap: wrap;
}
.proof-warning-tag {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 0.6875rem;
  font-weight: 700;
  color: #92400e;
}
.btn-upload-proof {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  cursor: pointer;
  font-size: 0.75rem;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 4px;
  background: #ffffff;
  border: 1px solid #cbd5e1;
}
.btn-upload-proof:hover {
  border-color: #0284c7;
  color: #0284c7;
}
.hidden-file-input {
  display: none;
}
.quick-samples-group {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-left: auto;
}
.btn-sample-chip {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 2px 8px;
  font-size: 0.6875rem;
  font-weight: 600;
  color: #334155;
  cursor: pointer;
  transition: all 0.15s;
}
.btn-sample-chip:hover {
  border-color: #0284c7;
  color: #0284c7;
  background: #f0f9ff;
}

.total-expense-summary-box {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed var(--border);
  font-size: 0.8125rem;
}
.expense-proof-stats {
  display: flex;
  align-items: center;
  gap: 8px;
}
.expense-total-amount {
  display: flex;
  align-items: center;
  gap: 8px;
}
.empty-expense-hint {
  padding: 16px;
  text-align: center;
  color: var(--text-muted);
  font-size: 0.8125rem;
}

.text-end { text-align: right; }
.text-xs { font-size: 0.75rem; }
.text-xxs { font-size: 0.625rem; }
.alert { display: flex; align-items: center; gap: 10px; padding: 12px; border-radius: var(--radius-sm); margin-bottom: 14px; }
.alert-danger { background: #fee2e2; border: 1px solid #fecaca; color: #b91c1c; }

/* Lightbox Modal */
.lightbox-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.75);
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}
.lightbox-content {
  position: relative;
  background: #ffffff;
  border-radius: 8px;
  padding: 14px;
  max-width: 480px;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.lightbox-close {
  position: absolute;
  top: 8px;
  right: 8px;
  background: #f1f5f9;
  border: none;
  border-radius: 50%;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.lightbox-img {
  max-width: 100%;
  max-height: 75vh;
  object-fit: contain;
  border-radius: 4px;
  border: 1px solid #e2e8f0;
}
</style>

