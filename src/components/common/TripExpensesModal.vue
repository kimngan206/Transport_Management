<script setup lang="ts">
import { ref, computed } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { useDriverStore } from '@/stores/driver';
import { useDialogStore } from '@/stores/dialog';
import type { TransportTrip, TripExpense } from '@/types';
import {
  X,
  Receipt,
  CheckCircle2,
  AlertTriangle,
  ZoomIn,
  Download,
  ShieldCheck,
  Check,
  Ban,
  FileSearch,
} from 'lucide-vue-next';

const props = defineProps<{
  trip: TransportTrip;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const authStore = useAuthStore();
const driverStore = useDriverStore();
const dialog = useDialogStore();

const previewImage = ref<string | null>(null);
const canAudit = computed(() => authStore.activeRole !== 'Driver');

function getExpenseTypeName(type: TripExpense['expenseType']): string {
  switch (type) {
    case 'Fuel':
      return 'Xăng dầu (Fuel)';
    case 'Toll':
      return 'Vé cầu đường (Toll)';
    case 'Parking':
      return 'Bãi đỗ xe (Parking)';
    case 'Repair':
      return 'Sửa chữa nhanh';
    case 'Other':
      return 'Chi phí khác';
    default:
      return type;
  }
}

function getExpenseBadgeClass(type: TripExpense['expenseType']): string {
  switch (type) {
    case 'Fuel':
      return 'badge-orange';
    case 'Toll':
      return 'badge-blue';
    case 'Parking':
      return 'badge-purple';
    case 'Repair':
      return 'badge-red';
    default:
      return 'badge-gray';
  }
}

const totalAmount = computed(() => {
  return (props.trip.expenses || []).reduce((sum, e) => sum + (e.amount || 0), 0);
});

const verifiedCount = computed(() => {
  return (props.trip.expenses || []).filter((e) => !!e.receiptImage).length;
});

const approvedAmount = computed(() => {
  return (props.trip.expenses || [])
    .filter((e) => e.auditStatus === 'APPROVED' || (!e.auditStatus && !!e.receiptImage))
    .reduce((sum, e) => sum + (e.amount || 0), 0);
});

function handleApprove(exp: TripExpense) {
  driverStore.auditExpense(props.trip.id, exp.id, 'APPROVED', 'Hóa đơn và biển số xe trùng khớp hợp lệ');
  dialog.showSuccess(`Đã duyệt khoản chi ${exp.amount.toLocaleString()} đ! Khoản này hợp lệ và đủ điều kiện thanh toán.`, 'Đã Duyệt Hợp Lệ');
}

function handleReject(exp: TripExpense) {
  driverStore.auditExpense(props.trip.id, exp.id, 'REJECTED', 'Thiếu chứng từ hoặc hóa đơn không khớp chuyến xe');
  dialog.showWarning(`Đã từ chối khoản chi ${exp.amount.toLocaleString()} đ do không đủ căn cứ xác minh hóa đơn!`, 'Từ Chối Khoản Chi');
}

function handleRequestMore(exp: TripExpense) {
  driverStore.auditExpense(props.trip.id, exp.id, 'PENDING', 'Yêu cầu tài xế chụp lại ảnh rõ nét / bổ sung chứng từ');
  dialog.showWarning(`Đã chuyển khoản chi ${exp.amount.toLocaleString()} đ sang trạng thái Yêu cầu giải trình/bổ sung ảnh!`, 'Yêu Cầu Bổ Sung');
}
</script>

<template>
  <div class="modal-backdrop" @click.self="emit('close')">
    <div class="modal-content modal-lg">
      <div class="modal-header">
        <div class="modal-header-title">
          <Receipt :size="22" class="text-primary" />
          <div>
            <h3 class="modal-title">Hồ Sơ Kê Khai Chi Phí & Bằng Chứng Xác Minh</h3>
            <span class="modal-subtitle">
              Chuyến xe: <strong>{{ trip.tripCode }}</strong> | Phương tiện: <strong>{{ trip.vehiclePlate }}</strong> | Tài xế: <strong>{{ trip.driverName }}</strong>
            </span>
          </div>
        </div>
        <button class="btn-close" @click="emit('close')">
          <X :size="18" />
        </button>
      </div>

      <div class="modal-body">
        <!-- Banner Hướng Dẫn Thẩm Định Bằng Chứng -->
        <div class="audit-banner mb-3">
          <div class="banner-icon">
            <FileSearch :size="20" class="text-primary" />
          </div>
          <div class="banner-content">
            <span class="banner-title">Tiêu chuẩn xác minh tính trung thực của hóa đơn:</span>
            <p class="banner-desc mb-0">
              Đối chiếu biển số xe in trên chứng từ phải khớp với <strong>{{ trip.vehiclePlate }}</strong>, ngày giờ in trên hóa đơn phải nằm trong khoảng thời gian chuyến <strong>{{ trip.scheduledStartTime.slice(0, 10) }}</strong>. Khoản chi thiếu ảnh hoặc không khớp sẽ bị từ chối thanh toán.
            </p>
          </div>
        </div>

        <!-- Thống kê chứng từ -->
        <div class="audit-summary-card mb-3">
          <div class="summary-col">
            <span class="col-label">Tổng Chi Phí Kê Khai</span>
            <span class="col-val text-primary font-bold">{{ totalAmount.toLocaleString() }} đ</span>
          </div>
          <div class="summary-col">
            <span class="col-label">Chứng Từ Đã Có Bằng Chứng</span>
            <span class="col-val" :class="verifiedCount === trip.expenses.length ? 'text-success' : 'text-amber'">
              {{ verifiedCount }} / {{ trip.expenses.length }} khoản chi
            </span>
          </div>
          <div class="summary-col">
            <span class="col-label">Số Tiền Đã Được Phê Duyệt</span>
            <span class="col-val text-success font-bold">{{ approvedAmount.toLocaleString() }} đ</span>
          </div>
          <div class="summary-col">
            <span class="col-label">Đánh Giá Tổng Quan</span>
            <span
              v-if="trip.expenses.length > 0 && verifiedCount === trip.expenses.length"
              class="audit-status-tag tag-verified"
            >
              <CheckCircle2 :size="14" />
              <span>Đầy đủ 100% hóa đơn</span>
            </span>
            <span v-else-if="trip.expenses.length > 0" class="audit-status-tag tag-warning">
              <AlertTriangle :size="14" />
              <span>Thiếu bằng chứng ({{ trip.expenses.length - verifiedCount }})</span>
            </span>
            <span v-else class="audit-status-tag tag-gray">
              <span>Không phát sinh</span>
            </span>
          </div>
        </div>

        <!-- Danh sách chi phí chi tiết -->
        <div v-if="!trip.expenses || trip.expenses.length === 0" class="empty-expense-box">
          <Receipt :size="36" class="text-muted" />
          <span>Chuyến xe này tài xế không kê khai chi phí phát sinh nào.</span>
        </div>

        <div v-else class="expenses-list">
          <div
            v-for="(exp, idx) in trip.expenses"
            :key="exp.id || idx"
            class="expense-detail-card"
            :class="{
              'is-approved': exp.auditStatus === 'APPROVED' || (!exp.auditStatus && !!exp.receiptImage),
              'is-rejected': exp.auditStatus === 'REJECTED',
              'is-pending': exp.auditStatus === 'PENDING' || (!exp.auditStatus && !exp.receiptImage),
            }"
          >
            <div class="expense-card-main">
              <div class="expense-top-row">
                <span class="badge" :class="getExpenseBadgeClass(exp.expenseType)">
                  {{ getExpenseTypeName(exp.expenseType) }}
                </span>
                <span class="expense-amount-val">{{ exp.amount.toLocaleString() }} đ</span>
              </div>

              <div class="expense-note-row">
                <span class="text-muted">Nội dung / Diễn giải:</span>
                <span class="expense-note-text font-bold">
                  {{ exp.receiptNote || 'Tài xế không để lại ghi chú' }}
                </span>
              </div>

              <div class="expense-meta-row">
                <span class="text-xs text-muted">
                  Thời gian ghi nhận: {{ exp.recordedAt || trip.createdAt }}
                </span>
              </div>

              <!-- Trạng thái thẩm định của khoản chi -->
              <div class="expense-audit-status-bar mt-2">
                <div v-if="exp.auditStatus === 'APPROVED' || (!exp.auditStatus && !!exp.receiptImage)" class="audit-tag approved">
                  <ShieldCheck :size="14" />
                  <span>Đã duyệt hợp lệ (Chứng từ thật, khớp chuyến xe)</span>
                </div>
                <div v-else-if="exp.auditStatus === 'REJECTED'" class="audit-tag rejected">
                  <Ban :size="14" />
                  <span>Từ chối thanh toán: {{ exp.auditNote || 'Hóa đơn không hợp lệ' }}</span>
                </div>
                <div v-else class="audit-tag pending">
                  <AlertTriangle :size="14" />
                  <span>Chờ thẩm định / Thiếu chứng từ rõ nét</span>
                </div>
              </div>

              <!-- Nút tác vụ thẩm định cho Điều phối / Quản lý / Kế toán -->
              <div v-if="canAudit" class="audit-actions-row mt-2">
                <span class="text-xxs text-muted font-bold mr-2">Thẩm định chứng từ:</span>
                <button
                  type="button"
                  class="btn-audit-sm btn-approve"
                  @click="handleApprove(exp)"
                  title="Xác nhận hóa đơn hợp lệ và duyệt thanh toán"
                >
                  <Check :size="12" />
                  <span>Duyệt Hợp Lệ</span>
                </button>
                <button
                  type="button"
                  class="btn-audit-sm btn-reject"
                  @click="handleReject(exp)"
                  title="Từ chối thanh toán khoản chi này"
                >
                  <Ban :size="12" />
                  <span>Từ Chối</span>
                </button>
                <button
                  type="button"
                  class="btn-audit-sm btn-request"
                  @click="handleRequestMore(exp)"
                  title="Yêu cầu tài xế chụp lại ảnh rõ hơn hoặc giải trình"
                >
                  <AlertTriangle :size="12" />
                  <span>Yêu Cầu Bổ Sung</span>
                </button>
              </div>
            </div>

            <!-- Khu vực bằng chứng hóa đơn -->
            <div class="expense-proof-col">
              <div v-if="exp.receiptImage" class="proof-box has-image">
                <div class="proof-thumbnail-wrap" @click="previewImage = exp.receiptImage">
                  <img :src="exp.receiptImage" alt="Bằng chứng hóa đơn" class="proof-thumb-img" />
                  <div class="thumb-zoom-overlay">
                    <ZoomIn :size="16" />
                    <span>Xem lớn</span>
                  </div>
                </div>
                <div class="proof-status-label text-success">
                  <CheckCircle2 :size="12" />
                  <span>Đã có ảnh hóa đơn</span>
                </div>
              </div>

              <div v-else class="proof-box no-image">
                <AlertTriangle :size="20" class="text-amber" />
                <span class="text-xs text-amber font-bold">Chưa có ảnh bằng chứng</span>
                <span class="text-xxs text-muted text-center">Tài xế kê khai tự do chưa kèm hóa đơn</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn btn-secondary" @click="emit('close')">Đóng</button>
      </div>
    </div>

    <!-- Lightbox phóng to ảnh hóa đơn -->
    <div v-if="previewImage" class="lightbox-overlay" @click.self="previewImage = null">
      <div class="lightbox-content">
        <button class="lightbox-close" @click="previewImage = null">
          <X :size="20" />
        </button>
        <img :src="previewImage" alt="Hóa đơn bằng chứng chi phí" class="lightbox-img" />
        <div class="lightbox-footer">
          <a :href="previewImage" download="hoa-don-bang-chung.svg" class="btn btn-outline btn-sm">
            <Download :size="14" />
            <span>Tải ảnh gốc</span>
          </a>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-lg { max-width: 800px; }
.modal-header-title {
  display: flex;
  align-items: center;
  gap: 12px;
}
.modal-title {
  font-size: 1.125rem;
  font-weight: 800;
  margin: 0;
}
.modal-subtitle {
  font-size: 0.75rem;
  color: var(--text-secondary);
}
.btn-close {
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--text-muted);
}

.audit-summary-card {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 12px 16px;
}
.summary-col {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.col-label {
  font-size: 0.6875rem;
  color: var(--text-muted);
  text-transform: uppercase;
  font-weight: 700;
}
.col-val {
  font-size: 1.125rem;
}

.audit-status-tag {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 0.75rem;
  font-weight: 700;
  padding: 4px 8px;
  border-radius: 6px;
  width: fit-content;
}
.tag-verified {
  background: #dcfce7;
  color: #15803d;
}
.tag-warning {
  background: #fef3c7;
  color: #b45309;
}
.tag-gray {
  background: #f1f5f9;
  color: #64748b;
}

.empty-expense-box {
  padding: 40px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  color: var(--text-muted);
  font-size: 0.875rem;
}

.expenses-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.expense-detail-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 12px 16px;
  background: #ffffff;
  gap: 16px;
}
.expense-card-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.expense-top-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.expense-amount-val {
  font-size: 1.125rem;
  font-weight: 800;
  color: #0f172a;
}
.expense-note-row {
  font-size: 0.8125rem;
  display: flex;
  gap: 6px;
}
.expense-note-text {
  color: #334155;
}

/* Proof box */
.expense-proof-col {
  width: 130px;
  flex-shrink: 0;
}
.proof-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  padding: 6px;
}
.proof-box.has-image {
  background: #f8fafc;
  border: 1px solid #cbd5e1;
}
.proof-box.no-image {
  background: #fffbeb;
  border: 1px dashed #fde68a;
  gap: 4px;
  padding: 10px 6px;
}

.proof-thumbnail-wrap {
  position: relative;
  width: 100%;
  height: 65px;
  border-radius: 4px;
  overflow: hidden;
  cursor: pointer;
  background: #ffffff;
  border: 1px solid #e2e8f0;
}
.proof-thumb-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.thumb-zoom-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(15, 23, 42, 0.6);
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  font-size: 0.6875rem;
  font-weight: 600;
  opacity: 0;
  transition: opacity 0.2s ease;
}
.proof-thumbnail-wrap:hover .thumb-zoom-overlay {
  opacity: 1;
}
.proof-status-label {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.625rem;
  font-weight: 700;
  margin-top: 4px;
}

/* Audit Banner */
.audit-banner {
  display: flex;
  gap: 12px;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 8px;
  padding: 10px 14px;
}
.banner-title {
  font-size: 0.8125rem;
  font-weight: 700;
  color: #166534;
}
.banner-desc {
  font-size: 0.75rem;
  color: #374151;
  margin-top: 2px;
}

/* Audit Tags */
.expense-audit-status-bar {
  display: flex;
  align-items: center;
}
.audit-tag {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 0.6875rem;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 6px;
}
.audit-tag.approved {
  background: #dcfce7;
  color: #15803d;
  border: 1px solid #86efac;
}
.audit-tag.rejected {
  background: #fee2e2;
  color: #b91c1c;
  border: 1px solid #fca5a5;
}
.audit-tag.pending {
  background: #fef3c7;
  color: #b45309;
  border: 1px solid #fde68a;
}

/* Audit Action Buttons */
.audit-actions-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.btn-audit-sm {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.6875rem;
  font-weight: 700;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.15s ease;
}
.btn-audit-sm.btn-approve {
  background: #dcfce7;
  color: #166534;
  border-color: #86efac;
}
.btn-audit-sm.btn-approve:hover {
  background: #bbf7d0;
}
.btn-audit-sm.btn-reject {
  background: #fee2e2;
  color: #991b1b;
  border-color: #fca5a5;
}
.btn-audit-sm.btn-reject:hover {
  background: #fecaca;
}
.btn-audit-sm.btn-request {
  background: #fef3c7;
  color: #92400e;
  border-color: #fde68a;
}
.btn-audit-sm.btn-request:hover {
  background: #fde68a;
}

.expense-detail-card.is-approved {
  border-left: 4px solid #22c55e;
}
.expense-detail-card.is-rejected {
  border-left: 4px solid #ef4444;
  background: #fffafa;
}
.expense-detail-card.is-pending {
  border-left: 4px solid #f59e0b;
}

/* Badges */
.badge-orange { background: #ffedd5; color: #c2410c; }
.badge-blue { background: #e0f2fe; color: #0369a1; }
.badge-purple { background: #f3e8ff; color: #7e22ce; }
.badge-red { background: #fee2e2; color: #b91c1c; }
.badge-gray { background: #f1f5f9; color: #475569; }
.text-amber { color: #d97706; }
.text-xxs { font-size: 0.625rem; }

/* Lightbox Modal */
.lightbox-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
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
  padding: 16px;
  max-width: 500px;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  box-shadow: 0 10px 25px rgba(0,0,0,0.5);
}
.lightbox-close {
  position: absolute;
  top: 8px;
  right: 8px;
  background: #f1f5f9;
  border: none;
  border-radius: 50%;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #334155;
}
.lightbox-img {
  max-width: 100%;
  max-height: 70vh;
  object-fit: contain;
  border-radius: 4px;
  border: 1px solid #e2e8f0;
}
.lightbox-footer {
  width: 100%;
  display: flex;
  justify-content: flex-end;
}
</style>
