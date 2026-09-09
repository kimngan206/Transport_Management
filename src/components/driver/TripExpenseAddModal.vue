<script setup lang="ts">
import { ref, computed } from 'vue';
import { useDriverStore } from '@/stores/driver';
import { useDialogStore } from '@/stores/dialog';
import type { TransportTrip, TripExpense } from '@/types';
import {
  X,
  Camera,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  ZoomIn,
  Receipt,
  Download,
} from 'lucide-vue-next';
import {
  getPetrolimexReceiptSample,
  getTollReceiptSample,
  getWeighStationReceiptSample,
  getRepairReceiptSample,
} from '@/utils/receiptSamples';

const props = defineProps<{
  trip: TransportTrip;
  editExpenseId?: number | null;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'saved'): void;
}>();

const driverStore = useDriverStore();
const dialog = useDialogStore();

const currentTripId = ref(props.trip.id);
const currentTrip = computed(() => driverStore.myTrips.find(t => t.id === currentTripId.value) || props.trip);

const isEditing = computed(() => !!props.editExpenseId);

// Form nhập khoản chi mới
const expenseType = ref<TripExpense['expenseType']>('Toll');
const amount = ref<number>(0);
const receiptNote = ref<string>('');
const receiptImage = ref<string | undefined>(undefined);
const receiptImages = ref<string[]>([]);
const sampleName = ref<string | undefined>(undefined);
const previewZoomImage = ref<string | null>(null);

import { onMounted } from 'vue';
onMounted(() => {
  if (props.editExpenseId) {
    const exp = props.trip.expenses?.find(e => e.id === props.editExpenseId);
    if (exp) {
      expenseType.value = exp.expenseType;
      amount.value = exp.amount;
      receiptNote.value = exp.receiptNote || '';
      receiptImage.value = exp.receiptImage;
      receiptImages.value = exp.receiptImages && exp.receiptImages.length > 0
        ? [...exp.receiptImages]
        : (exp.receiptImage ? [exp.receiptImage] : []);
      sampleName.value = receiptImages.value.length > 0
        ? `${receiptImages.value.length} ảnh bằng chứng đã lưu`
        : (exp.receiptImage ? 'Ảnh chứng từ đã lưu' : undefined);
    }
  }
});

// Danh sách chi phí hiện có của chuyến
const tripExpenses = computed(() => currentTrip.value.expenses || []);

function formatNumberWithDots(val: number | string | undefined | null): string {
  if (val === null || val === undefined || val === '') return '';
  const numStr = val.toString().replace(/\D/g, '');
  if (!numStr) return '';
  return numStr.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function onAmountInput(event: Event) {
  const target = event.target as HTMLInputElement;
  const rawValue = target.value.replace(/\D/g, '');
  const num = rawValue ? parseInt(rawValue, 10) : 0;
  amount.value = num;
  target.value = rawValue ? formatNumberWithDots(rawValue) : '';
}

function onFileInputChange(event: Event) {
  const target = event.target as HTMLInputElement;
  if (!target.files || target.files.length === 0) return;
  const files = Array.from(target.files);
  files.forEach((file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        const url = e.target.result as string;
        receiptImages.value.push(url);
        if (!receiptImage.value) {
          receiptImage.value = url;
        }
        sampleName.value = `${receiptImages.value.length} ảnh bằng chứng đã chọn`;
      }
    };
    reader.readAsDataURL(file);
  });
}

function removeImageAt(idx: number) {
  receiptImages.value.splice(idx, 1);
  receiptImage.value = receiptImages.value.length > 0 ? receiptImages.value[0] : undefined;
  sampleName.value = receiptImages.value.length > 0 ? `${receiptImages.value.length} ảnh bằng chứng` : undefined;
}

function applySample(type: 'Toll' | 'Fuel' | 'Weigh' | 'Repair') {
  const plate = currentTrip.value.vehiclePlate || '51C-889.26';
  if (type === 'Toll') {
    expenseType.value = 'Toll';
    amount.value = 35000;
    receiptNote.value = 'Vé trạm thu phí BOT ĐT741';
    receiptImage.value = getTollReceiptSample(plate, '35.000 đ');
    receiptImages.value = [getTollReceiptSample(plate, '35.000 đ')];
    sampleName.value = 'Mẫu Vé BOT ĐT741';
  } else if (type === 'Fuel') {
    expenseType.value = 'Fuel';
    amount.value = 850000;
    receiptNote.value = 'Hóa đơn đổ dầu DO Petrolimex';
    receiptImage.value = getPetrolimexReceiptSample(plate, '850.000 đ', '45.2 Lít');
    receiptImages.value = [getPetrolimexReceiptSample(plate, '850.000 đ', '45.2 Lít')];
    sampleName.value = 'Mẫu HĐ Petrolimex';
  } else if (type === 'Weigh') {
    expenseType.value = 'Other';
    amount.value = 50000;
    receiptNote.value = 'Phiếu cân mủ cao su tiếp nhận';
    receiptImage.value = getWeighStationReceiptSample(plate, '5.200 kg mủ', '50.000 đ');
    receiptImages.value = [getWeighStationReceiptSample(plate, '5.200 kg mủ', '50.000 đ')];
    sampleName.value = 'Mẫu Phiếu Cân Mủ';
  } else if (type === 'Repair') {
    expenseType.value = 'Repair';
    amount.value = 150000;
    receiptNote.value = 'Vá lốp xe khẩn cấp lưu động';
    receiptImage.value = getRepairReceiptSample(plate, '150.000 đ');
    receiptImages.value = [getRepairReceiptSample(plate, '150.000 đ')];
    sampleName.value = 'Mẫu Biên Lai Vá Vỏ';
  }
}

function handleAddExpense() {
  if (amount.value <= 0) {
    dialog.showWarning('Vui lòng nhập số tiền phát sinh hợp lệ lớn hơn 0 đ!', 'Thiếu Số Tiền', 'Nhập lại');
    return;
  }

  if (isEditing.value && props.editExpenseId) {
    driverStore.removeExpenseFromTrip(props.trip.id, props.editExpenseId);
  }

  const res = driverStore.addExpenseToTrip(currentTrip.value.id, {
    expenseType: expenseType.value,
    amount: amount.value,
    receiptNote: receiptNote.value,
    receiptImage: receiptImage.value,
    receiptImages: receiptImages.value.length > 0 ? receiptImages.value : (receiptImage.value ? [receiptImage.value] : undefined),
  });

  if (res.success) {
    dialog.showSuccess(isEditing.value ? 'Đã cập nhật khoản chi phí thành công!' : 'Đã thêm khoản chi phí phát sinh kèm ảnh bằng chứng thành công!', 'Thành Công');
    // Reset form
    amount.value = 0;
    receiptNote.value = '';
    receiptImage.value = undefined;
    receiptImages.value = [];
    sampleName.value = undefined;
    emit('saved');
  } else {
    dialog.showWarning(res.message, 'Lỗi');
  }
}

function handleDeleteExpense(expenseId: number) {
  const res = driverStore.removeExpenseFromTrip(currentTrip.value.id, expenseId);
  if (res.success) {
    dialog.showSuccess('Đã xóa khoản chi phí thành công!', 'Đã Xóa');
    emit('saved');
  }
}

const totalTripExpenses = computed(() => {
  return tripExpenses.value.reduce((sum, e) => sum + (e.amount || 0), 0);
});

const verifiedCount = computed(() => {
  return tripExpenses.value.filter((e) => !!e.receiptImage).length;
});
</script>

<template>
  <div class="modal-backdrop" @click.self="emit('close')">
    <div class="modal-content modal-md">
      <div class="modal-header">
        <div class="header-title-box">
          <Receipt :size="22" class="text-primary" />
          <div class="flex-1 w-full">
            <h3 class="modal-title">Kê Khai Chi Phí & Tải Bằng Chứng Xác Minh</h3>
            <div class="mt-2 mb-1 w-full">
              <label class="text-xs font-bold text-muted mb-1 block" style="display: block; margin-bottom: 4px;">Chọn chuyến xe cần kê khai:</label>
              <select v-model="currentTripId" class="form-select font-semibold text-sm" style="max-width: 450px;">
                <option v-for="t in driverStore.myTrips" :key="t.id" :value="t.id">
                  {{ t.tripCode }} - Xe: {{ t.vehiclePlate }} (Ngày: {{ t.scheduledStartTime.split(' ')[0] }})
                </option>
              </select>
            </div>
          </div>
        </div>
        <button class="btn-close" @click="emit('close')">
          <X :size="18" />
        </button>
      </div>

      <div class="modal-body">
        <!-- Banner Hướng Dẫn Nghiệp Vụ -->
        <div class="guide-banner mb-3">
          <div class="guide-icon">
            <Camera :size="20" class="text-primary" />
          </div>
          <div class="guide-text">
            <strong>Bắt buộc đính kèm bằng chứng xác minh:</strong>
            <p class="mb-0 text-xs text-muted">
              Tài xế cần chụp rõ nét hóa đơn VAT, vé trạm BOT, biên lai hoặc phiếu cân để Điều phối & Kế toán xác minh tính trung thực trước khi thanh toán.
            </p>
          </div>
        </div>

        <!-- FORM KÊ KHAI MỚI / CHỈNH SỬA -->
        <div class="add-expense-card">
          <h4 class="card-subtitle-custom">{{ isEditing ? 'Điều Chỉnh Khoản Chi Đã Chọn' : 'Thêm Khoản Chi Phát Sinh Mới' }}</h4>

          <div class="grid-2">
            <div class="form-group">
              <label class="form-label">Loại chi phí phát sinh <span class="required">*</span></label>
              <select v-model="expenseType" class="form-select font-semibold">
                <option value="Toll">Vé cầu đường (BOT)</option>
                <option value="Fuel">Xăng dầu (Fuel)</option>
                <option value="Parking">Bãi đỗ xe (Parking)</option>
                <option value="Repair">Sửa chữa nhanh / Vá vỏ</option>
                <option value="Other">Chi phí khác</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Số tiền phát sinh (VNĐ) <span class="required">*</span></label>
              <div class="amount-input-wrap">
                <input
                  :value="formatNumberWithDots(amount)"
                  @input="onAmountInput"
                  type="text"
                  inputmode="numeric"
                  class="form-input text-end font-bold text-primary"
                  placeholder="0"
                />
                <span class="currency-label">đ</span>
              </div>
            </div>
          </div>

          <div class="form-group mt-2">
            <label class="form-label">Nội dung ghi chú / Số hóa đơn / Vị trí</label>
            <input
              v-model="receiptNote"
              type="text"
              class="form-input"
              placeholder="VD: Trạm BOT ĐT741 - Hóa đơn số HD10482..."
            />
          </div>

          <!-- KHU VỰC ĐÍNH KÈM BẰNG CHỨNG XÁC MINH -->
          <div class="proof-upload-section mt-3">
            <label class="form-label font-bold flex-between">
              <span>Bằng chứng xác minh (Ảnh hóa đơn / Biên lai) <span class="required">*</span></span>
              <span v-if="receiptImage" class="text-xs text-success font-semibold flex-center gap-1">
                <CheckCircle2 :size="13" />
                Đã có ảnh bằng chứng
              </span>
              <span v-else class="text-xs text-amber font-semibold flex-center gap-1">
                <AlertTriangle :size="13" />
                Chưa có ảnh
              </span>
            </label>

            <!-- Nếu ĐÃ CÓ ẢNH -->
            <div v-if="receiptImage" class="proof-preview-card">
              <div class="thumb-container" @click="previewZoomImage = receiptImage">
                <img :src="receiptImage" alt="Ảnh bằng chứng" class="proof-img-thumb" />
                <div class="zoom-tag">
                  <ZoomIn :size="14" />
                  <span>Xem lớn</span>
                </div>
              </div>

              <div class="proof-details">
                <span class="proof-status-title text-success font-bold flex-center gap-1">
                  <CheckCircle2 :size="14" />
                  Đã đính kèm ảnh xác minh hợp lệ
                </span>
                <span class="text-xs text-muted">{{ sampleName || 'Ảnh chụp tài xế tải lên' }}</span>

                <div class="proof-button-row mt-2">
                  <label class="btn btn-outline btn-xs">
                    <Camera :size="13" />
                    <span>Đổi ảnh khác</span>
                    <input
                      type="file"
                      accept="image/*"
                      class="hidden-file-input"
                      @change="onFileInputChange"
                    />
                  </label>
                  <button type="button" class="btn btn-danger btn-xs" @click="receiptImage = undefined; sampleName = undefined">
                    ✕ Xóa ảnh
                  </button>
                </div>
              </div>
            </div>

            <!-- Nếu CHƯA CÓ ẢNH -->
            <div v-else class="proof-empty-card">
              <div class="empty-upload-box">
                <Camera :size="28" class="text-muted mb-1" />
                <span class="font-semibold text-sm">Chụp ảnh hóa đơn hoặc tải file từ máy</span>
                <span class="text-xs text-muted mb-2">Hỗ trợ ảnh định dạng JPG, PNG, WEBP từ điện thoại</span>
                <label class="btn btn-primary btn-sm btn-camera-action">
                  <Camera :size="16" />
                  <span>Chụp / Tải Lên Bằng Chứng</span>
                  <input
                    type="file"
                    accept="image/*"
                    class="hidden-file-input"
                    @change="onFileInputChange"
                  />
                </label>
              </div>

              <!-- Mẫu chứng từ nhanh cho môi trường test -->
              <div class="sample-chips-box">
                <span class="text-xxs text-muted font-bold">Mẫu nhanh thử nghiệm:</span>
                <div class="chips-row">
                  <button type="button" class="chip-btn" @click="applySample('Toll')">🎫 Vé BOT</button>
                  <button type="button" class="chip-btn" @click="applySample('Fuel')">⛽ HĐ Xăng dầu</button>
                  <button type="button" class="chip-btn" @click="applySample('Weigh')">⚖️ Phiếu cân mủ</button>
                  <button type="button" class="chip-btn" @click="applySample('Repair')">🔧 Vá vỏ</button>
                </div>
              </div>
            </div>
          </div>

          <div class="add-btn-row mt-3">
            <button class="btn btn-primary full-w" @click="handleAddExpense">
              <Plus v-if="!isEditing" :size="16" />
              <Edit v-else :size="16" />
              <span>{{ isEditing ? 'Lưu Cập Nhật Khoản Chi Này' : 'Thêm Khoản Chi Này Vào Chuyến Xe' }}</span>
            </button>
          </div>
        </div>

        <!-- DANH SÁCH CÁC KHOẢN CHI ĐÃ KÊ KHAI CỦA CHUYẾN XE NÀY -->
        <div class="trip-expenses-history mt-4">
          <div class="flex-between mb-2">
            <h4 class="card-subtitle-custom mb-0">
              Các Khoản Chi Đã Ghi Nhận ({{ tripExpenses.length }})
              <span v-if="tripExpenses.length > 0" class="text-xs text-success font-semibold ml-1">
                ({{ verifiedCount }}/{{ tripExpenses.length }} đã có hóa đơn)
              </span>
            </h4>
            <span class="text-xs font-bold text-primary">
              Tổng cộng: {{ formatNumberWithDots(totalTripExpenses) }} đ
            </span>
          </div>

          <div v-if="tripExpenses.length === 0" class="empty-list-notice">
            Chưa có khoản chi phí nào được lưu cho chuyến xe này.
          </div>

          <div v-else class="expenses-table-wrap">
            <table class="table-compact">
              <thead>
                <tr>
                  <th>Loại</th>
                  <th>Số Tiền</th>
                  <th>Diễn Giải</th>
                  <th>Bằng Chứng</th>
                  <th class="text-end">Thao Tác</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="exp in tripExpenses" :key="exp.id">
                  <td>
                    <span class="badge-type">{{ exp.expenseType }}</span>
                  </td>
                  <td>
                    <strong class="text-primary">{{ formatNumberWithDots(exp.amount) }} đ</strong>
                  </td>
                  <td>
                    <span class="text-xs">{{ exp.receiptNote || '—' }}</span>
                  </td>
                  <td>
                    <div v-if="exp.receiptImage" class="verified-cell">
                      <div class="mini-thumb" @click="previewZoomImage = exp.receiptImage">
                        <img :src="exp.receiptImage" alt="Hóa đơn" />
                        <ZoomIn :size="10" class="zoom-icon" />
                      </div>
                      <span class="badge-verified-mini">✓ Đã có ảnh</span>
                    </div>
                    <span v-else class="badge-warning-mini">⚠️ Thiếu ảnh</span>
                  </td>
                  <td class="text-end">
                    <button
                      class="btn-del-mini"
                      @click="handleDeleteExpense(exp.id)"
                      title="Xóa khoản chi này"
                    >
                      <Trash2 :size="14" />
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn btn-secondary" @click="emit('close')">Hoàn Tất Đóng</button>
      </div>
    </div>

    <!-- Lightbox phóng to ảnh chứng từ -->
    <div v-if="previewZoomImage" class="lightbox-overlay" @click.self="previewZoomImage = null">
      <div class="lightbox-content">
        <button class="lightbox-close" @click="previewZoomImage = null">
          <X :size="20" />
        </button>
        <img :src="previewZoomImage" alt="Hóa đơn bằng chứng chi phí" class="lightbox-img" />
        <div class="lightbox-footer">
          <a :href="previewZoomImage" download="hoa-don-bang-chung.svg" class="btn btn-outline btn-sm">
            <Download :size="14" />
            <span>Tải ảnh gốc</span>
          </a>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-md {
  max-width: 800px;
  width: 95%;
}
.header-title-box {
  display: flex;
  align-items: center;
  gap: 12px;
}
.modal-subtitle {
  font-size: 0.78rem;
  color: var(--color-text-muted);
}
.guide-banner {
  display: flex;
  gap: 12px;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 8px;
  padding: 10px 14px;
}
.guide-text strong {
  color: #166534;
  font-size: 0.82rem;
}
.add-expense-card {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 14px;
  margin-bottom: 24px;
}
.card-subtitle-custom {
  font-size: 0.88rem;
  font-weight: 700;
  color: #1e293b;
  margin-bottom: 12px;
}
.amount-input-wrap {
  position: relative;
  display: flex;
  align-items: center;
}
.currency-label {
  position: absolute;
  right: 12px;
  font-weight: bold;
  color: #64748b;
}
.proof-upload-section {
  background: #ffffff;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 12px;
}
.hidden-file-input {
  display: none;
}
.proof-preview-card {
  display: flex;
  gap: 12px;
  background: #f8fafc;
  border: 1.5px solid #22c55e;
  border-radius: 8px;
  padding: 10px;
  align-items: center;
}
.thumb-container {
  position: relative;
  width: 75px;
  height: 75px;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid #cbd5e1;
  cursor: pointer;
  flex-shrink: 0;
}
.proof-img-thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.zoom-tag {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  color: white;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-size: 0.65rem;
  opacity: 0;
  transition: opacity 0.2s ease;
}
.thumb-container:hover .zoom-tag {
  opacity: 1;
}
.proof-details {
  flex: 1;
  display: flex;
  flex-direction: column;
}
.proof-button-row {
  display: flex;
  gap: 8px;
}
.proof-empty-card {
  background: #fffbeb;
  border: 1.5px dashed #f59e0b;
  border-radius: 8px;
  padding: 14px;
  text-align: center;
}
.empty-upload-box {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.btn-camera-action {
  cursor: pointer;
}
.sample-chips-box {
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px dashed #e2e8f0;
}
.chips-row {
  display: flex;
  gap: 6px;
  justify-content: center;
  flex-wrap: wrap;
  margin-top: 4px;
}
.chip-btn {
  background: #f1f5f9;
  border: 1px solid #cbd5e1;
  border-radius: 12px;
  padding: 3px 8px;
  font-size: 0.72rem;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.15s ease;
}
.chip-btn:hover {
  background: #e2e8f0;
  border-color: #94a3b8;
}
.empty-list-notice {
  text-align: center;
  padding: 16px;
  color: #94a3b8;
  font-size: 0.8rem;
  background: #f8fafc;
  border-radius: 6px;
}
.table-compact {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8rem;
}
.table-compact th {
  background: #f1f5f9;
  padding: 8px;
  text-align: left;
  font-weight: 600;
  color: #475569;
  border-bottom: 1px solid #cbd5e1;
}
.table-compact td {
  padding: 8px;
  border-bottom: 1px solid #f1f5f9;
}
.badge-type {
  background: #e0f2fe;
  color: #0369a1;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 600;
  font-size: 0.72rem;
}
.verified-cell {
  display: flex;
  align-items: center;
  gap: 6px;
}
.mini-thumb {
  position: relative;
  width: 28px;
  height: 28px;
  border-radius: 4px;
  overflow: hidden;
  cursor: pointer;
  border: 1px solid #cbd5e1;
}
.mini-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.zoom-icon {
  position: absolute;
  right: 1px;
  bottom: 1px;
  color: #fff;
  background: rgba(0, 0, 0, 0.6);
  border-radius: 2px;
}
.badge-verified-mini {
  color: #16a34a;
  font-size: 0.72rem;
  font-weight: bold;
}
.badge-warning-mini {
  color: #d97706;
  font-size: 0.72rem;
  font-weight: bold;
}
.btn-del-mini {
  background: none;
  border: none;
  color: #dc2626;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
}
.btn-del-mini:hover {
  background: #fee2e2;
}

/* Lightbox overlay */
.lightbox-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 20px;
}
.lightbox-content {
  position: relative;
  max-width: 90vw;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.lightbox-close {
  position: absolute;
  top: -40px;
  right: 0;
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: #fff;
  border-radius: 50%;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.lightbox-img {
  max-width: 100%;
  max-height: 80vh;
  border-radius: 8px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
}
.lightbox-footer {
  margin-top: 12px;
}
</style>
