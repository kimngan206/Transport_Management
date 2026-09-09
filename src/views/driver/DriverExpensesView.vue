<script setup lang="ts">
import { ref, computed } from 'vue';
import { useDriverStore } from '@/stores/driver';
import { useAuthStore } from '@/stores/auth';
import type { TransportTrip, TripExpense } from '@/types';
import TripExpenseAddModal from '@/components/driver/TripExpenseAddModal.vue';
import {
  Receipt,
  PlusCircle,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Ban,
  ZoomIn,
  Download,
  X,
  Filter,
  Edit,
  Eye,
  Images,
  ChevronLeft,
  ChevronRight,
  FileText,
} from 'lucide-vue-next';

const driverStore = useDriverStore();
const authStore = useAuthStore();

const activeExpenseTrip = ref<TransportTrip | null>(null);
const activeEditExpenseId = ref<number | null>(null);
const previewZoomImage = ref<string | null>(null);
const selectedExpenseForProof = ref<ExpenseFlatItem | null>(null);
const currentProofIndex = ref<number>(0);
const filterType = ref<string>('ALL');
const filterStatus = ref<string>('ALL');

// Toàn bộ chuyến của tài xế
const myTrips = computed(() => driverStore.myTrips);

// Lấy danh sách tất cả các khoản chi từ tất cả các chuyến của tài xế
interface ExpenseFlatItem extends TripExpense {
  tripCode: string;
  vehiclePlate: string;
  routeName: string;
  tripStatus: string;
}

const allExpenses = computed<ExpenseFlatItem[]>(() => {
  const list: ExpenseFlatItem[] = [];
  for (const t of myTrips.value) {
    if (t.expenses && t.expenses.length > 0) {
      for (const e of t.expenses) {
        list.push({
          ...e,
          tripCode: t.tripCode,
          vehiclePlate: t.vehiclePlate,
          routeName: t.routeName,
          tripStatus: t.status,
        });
      }
    }
  }
  return list.sort((a, b) => (b.id || 0) - (a.id || 0));
});

// Lọc dữ liệu
const filteredExpenses = computed(() => {
  return allExpenses.value.filter((e) => {
    if (filterType.value !== 'ALL' && e.expenseType !== filterType.value) return false;
    if (filterStatus.value !== 'ALL') {
      const status = e.auditStatus || (e.receiptImage ? 'APPROVED' : 'PENDING');
      if (status !== filterStatus.value) return false;
    }
    return true;
  });
});

// Thống kê tổng quan
const totalExpenseAmount = computed(() => {
  return allExpenses.value.reduce((sum, e) => sum + (e.amount || 0), 0);
});

const verifiedCount = computed(() => {
  return allExpenses.value.filter((e) => !!e.receiptImage).length;
});

const approvedCount = computed(() => {
  return allExpenses.value.filter(
    (e) => e.auditStatus === 'APPROVED' || (!e.auditStatus && !!e.receiptImage)
  ).length;
});

const pendingCount = computed(() => {
  return allExpenses.value.filter(
    (e) => e.auditStatus === 'PENDING' || (!e.auditStatus && !e.receiptImage)
  ).length;
});

const rejectedCount = computed(() => {
  return allExpenses.value.filter((e) => e.auditStatus === 'REJECTED').length;
});

// Mở modal kê khai cho chuyến xe đang hoạt động gần nhất
function openAddExpenseModal() {
  const activeTrip = myTrips.value.find(
    (t) => t.status === 'INPROGRESS' || t.status === 'ARRIVED' || t.status === 'ACCEPTED'
  ) || myTrips.value[0];

  if (activeTrip) {
    activeExpenseTrip.value = activeTrip;
    activeEditExpenseId.value = null;
  }
}

function openEditExpenseModal(exp: ExpenseFlatItem) {
  const trip = myTrips.value.find((t) => t.tripCode === exp.tripCode);
  if (trip) {
    activeExpenseTrip.value = trip;
    activeEditExpenseId.value = exp.id;
  }
}

function getExpenseImages(exp: TripExpense): string[] {
  if (exp.receiptImages && exp.receiptImages.length > 0) {
    return exp.receiptImages;
  }
  if (exp.receiptImage) {
    return [exp.receiptImage];
  }
  return [];
}

function openProofGallery(exp: ExpenseFlatItem, initialIndex = 0) {
  selectedExpenseForProof.value = exp;
  const imgs = getExpenseImages(exp);
  currentProofIndex.value = imgs.length > 0 ? Math.max(0, Math.min(initialIndex, imgs.length - 1)) : 0;
}

function prevProofImage() {
  if (!selectedExpenseForProof.value) return;
  const imgs = getExpenseImages(selectedExpenseForProof.value);
  if (imgs.length <= 1) return;
  currentProofIndex.value = (currentProofIndex.value - 1 + imgs.length) % imgs.length;
}

function nextProofImage() {
  if (!selectedExpenseForProof.value) return;
  const imgs = getExpenseImages(selectedExpenseForProof.value);
  if (imgs.length <= 1) return;
  currentProofIndex.value = (currentProofIndex.value + 1) % imgs.length;
}

function editExpenseFromGallery() {
  if (!selectedExpenseForProof.value) return;
  const exp = selectedExpenseForProof.value;
  selectedExpenseForProof.value = null;
  openEditExpenseModal(exp);
}

function getExpenseTypeName(type: TripExpense['expenseType']): string {
  switch (type) {
    case 'Fuel':
      return 'Xăng dầu (Fuel)';
    case 'Toll':
      return 'Vé cầu đường (BOT)';
    case 'Parking':
      return 'Bãi đỗ xe';
    case 'Repair':
      return 'Sửa chữa / Vá vỏ';
    case 'Other':
      return 'Khác';
    default:
      return type;
  }
}

function getExpenseTypeBadge(type: TripExpense['expenseType']): string {
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
</script>

<template>
  <div class="driver-expenses-page">
    <!-- Header -->
    <div class="page-header">
      <div>
        <div class="header-tag-row">
          <span class="badge-role">Phân Hệ Vận Hành Tài Xế</span>
          <span class="badge-driver">Tài xế: {{ authStore.currentUser.fullName }}</span>
        </div>
        <h1 class="page-title">Kê Khai Chi Phí & Bằng Chứng Xác Minh Hóa Đơn</h1>
        <p class="page-subtitle">
          Quản lý toàn bộ chi phí phát sinh, vé trạm BOT, hóa đơn xăng dầu và chứng từ xác minh gửi bộ phận Kế toán thẩm định
        </p>
      </div>

      <div class="header-actions">
        <button class="btn btn-primary" @click="openAddExpenseModal">
          <PlusCircle :size="16" />
          <span>+ Kê Khai Chi Phí Mới</span>
        </button>
      </div>
    </div>



    <!-- Bảng Danh sách Chi Phí & Bằng Chứng -->
    <div class="card">
      <div class="card-header-flex">
        <div>
          <h3 class="card-title">Danh Sách Khoản Chi Phát Sinh & Bằng Chứng Hóa Đơn</h3>
          <span class="card-subtitle">Đối chiếu biển số xe, ngày giờ và ảnh hóa đơn thực tế</span>
        </div>

        <div class="filter-controls">
          <div class="filter-item">
            <Filter :size="13" class="text-muted" />
            <select v-model="filterType" class="form-select-sm">
              <option value="ALL">Tất cả loại chi phí</option>
              <option value="Toll">Vé cầu đường (BOT)</option>
              <option value="Fuel">Xăng dầu (Fuel)</option>
              <option value="Parking">Bãi đỗ xe</option>
              <option value="Repair">Sửa chữa / Vá vỏ</option>
              <option value="Other">Chi phí khác</option>
            </select>
          </div>

          <div class="filter-item">
            <select v-model="filterStatus" class="form-select-sm">
              <option value="ALL">Tất cả trạng thái thẩm định</option>
              <option value="APPROVED">Đã duyệt hợp lệ</option>
              <option value="PENDING">Chờ thẩm định / Thiếu ảnh</option>
              <option value="REJECTED">Bị từ chối</option>
            </select>
          </div>
        </div>
      </div>

      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th class="text-nowrap" style="min-width: 140px;">Mã Chuyến</th>
              <th class="text-nowrap" style="min-width: 120px;">Biển Số Xe</th>
              <th class="text-nowrap">Loại Chi Phí</th>
              <th class="text-nowrap">Số Tiền (VNĐ)</th>
              <th style="min-width: 180px;">Nội Dung / Diễn Giải</th>
              <th class="text-nowrap" style="min-width: 145px;">Thời Gian Ghi</th>
              <th class="text-nowrap">Trạng Thái Thẩm Định</th>
              <th class="text-end text-nowrap" style="min-width: 175px;">Thao Tác</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="filteredExpenses.length === 0">
              <td colspan="8" class="text-center py-5 text-muted">
                <div class="empty-state">
                  <Receipt :size="36" class="text-muted mb-2" />
                  <span class="font-bold">Chưa có khoản chi phí nào phù hợp</span>
                  <span class="text-xs">Bấm "+ Kê Khai Chi Phí Mới" để thêm khoản chi và tải ảnh hóa đơn lên</span>
                </div>
              </td>
            </tr>

            <tr v-for="exp in filteredExpenses" :key="exp.id">
              <td class="text-nowrap">
                <span class="code-badge font-mono">{{ exp.tripCode }}</span>
              </td>
              <td class="text-nowrap">
                <span class="vehicle-plate-tag font-mono">{{ exp.vehiclePlate }}</span>
              </td>
              <td class="text-nowrap">
                <span class="badge" :class="getExpenseTypeBadge(exp.expenseType)">
                  {{ getExpenseTypeName(exp.expenseType) }}
                </span>
              </td>
              <td class="text-nowrap">
                <strong class="text-primary font-bold">{{ exp.amount.toLocaleString() }} đ</strong>
              </td>
              <td>
                <span class="note-text">{{ exp.receiptNote || '—' }}</span>
              </td>
              <td class="text-nowrap">
                <span class="text-xs text-muted font-medium">{{ exp.recordedAt }}</span>
              </td>
              <td class="text-nowrap">
                <div v-if="exp.auditStatus === 'APPROVED' || (!exp.auditStatus && getExpenseImages(exp).length > 0)" class="status-pill pill-approved">
                  <CheckCircle2 :size="12" />
                  <span>Đã Duyệt Hợp Lệ</span>
                </div>
                <div v-else-if="exp.auditStatus === 'REJECTED'" class="status-pill pill-rejected">
                  <Ban :size="12" />
                  <span>Từ Chối: {{ exp.auditNote || 'Không hợp lệ' }}</span>
                </div>
                <div v-else class="status-pill pill-pending">
                  <Clock :size="12" />
                  <span>Chờ Thẩm Định</span>
                </div>
              </td>
              <td class="text-end text-nowrap">
                <div class="action-buttons-group">
                  <button
                    class="btn btn-outline btn-xs btn-action-proof"
                    :class="{ 'has-proof-images': getExpenseImages(exp).length > 0 }"
                    @click="openProofGallery(exp, 0)"
                    :title="getExpenseImages(exp).length > 0 ? `Xem ${getExpenseImages(exp).length} ảnh bằng chứng hóa đơn` : 'Xem bằng chứng'"
                  >
                    <Eye :size="13" />
                    <span>Xem bằng chứng</span>
                    <span v-if="getExpenseImages(exp).length > 1" class="proof-qty-badge">
                      {{ getExpenseImages(exp).length }}
                    </span>
                  </button>

                  <button
                    class="btn btn-outline btn-xs btn-icon-only"
                    @click="openEditExpenseModal(exp)"
                    title="Điều chỉnh khoản chi này"
                  >
                    <Edit :size="14" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal Kê khai Chi phí mới -->
    <TripExpenseAddModal
      v-if="activeExpenseTrip"
      :trip="activeExpenseTrip"
      :editExpenseId="activeEditExpenseId"
      @close="activeExpenseTrip = null; activeEditExpenseId = null"
      @saved="activeExpenseTrip = null; activeEditExpenseId = null"
    />

    <!-- Modal Xem Chi Tiết Bằng Chứng & Nhiều Ảnh Hóa Đơn (Gallery Modal) -->
    <div v-if="selectedExpenseForProof" class="modal-backdrop" @click.self="selectedExpenseForProof = null">
      <div class="modal-content modal-lg gallery-modal-wrap">
        <div class="modal-header">
          <div class="flex items-center gap-2">
            <Images :size="20" class="text-primary" />
            <div>
              <h3 class="modal-title font-bold text-base">
                Hồ Sơ Bằng Chứng & Hóa Đơn Xác Minh
              </h3>
              <div class="text-xs text-muted flex items-center gap-2 mt-0.5">
                <span class="code-badge font-mono">{{ selectedExpenseForProof.tripCode }}</span>
                <span>• Xe: <strong>{{ selectedExpenseForProof.vehiclePlate }}</strong></span>
                <span>• Khoản chi: <strong class="text-primary">{{ selectedExpenseForProof.amount.toLocaleString() }} đ</strong></span>
              </div>
            </div>
          </div>
          <button class="btn-close" @click="selectedExpenseForProof = null">
            <X :size="18" />
          </button>
        </div>

        <div class="modal-body p-4">
          <!-- Thông tin tóm tắt khoản chi -->
          <div class="proof-meta-banner mb-3">
            <div class="meta-item">
              <span class="meta-label">Loại chi phí:</span>
              <span class="badge" :class="getExpenseTypeBadge(selectedExpenseForProof.expenseType)">
                {{ getExpenseTypeName(selectedExpenseForProof.expenseType) }}
              </span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Nội dung:</span>
              <strong class="text-slate-800">{{ selectedExpenseForProof.receiptNote || '—' }}</strong>
            </div>
            <div class="meta-item">
              <span class="meta-label">Thời gian ghi:</span>
              <span class="text-slate-600">{{ selectedExpenseForProof.recordedAt }}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Trạng thái:</span>
              <span v-if="selectedExpenseForProof.auditStatus === 'APPROVED' || (!selectedExpenseForProof.auditStatus && getExpenseImages(selectedExpenseForProof).length > 0)" class="text-success font-bold">
                ✓ Đã duyệt hợp lệ
              </span>
              <span v-else class="text-amber-600 font-bold">
                ⏳ Chờ thẩm định
              </span>
            </div>
          </div>

          <!-- Khu vực xem nhiều ảnh (Gallery / Multi-image Carousel) -->
          <div v-if="getExpenseImages(selectedExpenseForProof).length > 0" class="gallery-container">
            <!-- Viewport ảnh lớn -->
            <div class="gallery-main-viewport">
              <button
                v-if="getExpenseImages(selectedExpenseForProof).length > 1"
                class="gallery-nav-btn btn-prev"
                @click="prevProofImage"
                title="Ảnh trước"
              >
                <ChevronLeft :size="24" />
              </button>

              <div class="gallery-main-img-wrap">
                <img
                  :src="getExpenseImages(selectedExpenseForProof)[currentProofIndex]"
                  alt="Ảnh bằng chứng xác minh"
                  class="gallery-main-img"
                />
                <div class="img-counter-pill">
                  Ảnh {{ currentProofIndex + 1 }} / {{ getExpenseImages(selectedExpenseForProof).length }}
                </div>
              </div>

              <button
                v-if="getExpenseImages(selectedExpenseForProof).length > 1"
                class="gallery-nav-btn btn-next"
                @click="nextProofImage"
                title="Ảnh tiếp theo"
              >
                <ChevronRight :size="24" />
              </button>
            </div>

            <!-- Dải thumbnail các ảnh -->
            <div v-if="getExpenseImages(selectedExpenseForProof).length > 1" class="gallery-thumbs-strip">
              <div
                v-for="(img, idx) in getExpenseImages(selectedExpenseForProof)"
                :key="idx"
                class="thumb-item"
                :class="{ active: idx === currentProofIndex }"
                @click="currentProofIndex = idx"
              >
                <img :src="img" :alt="`Ảnh thumbnail ${idx + 1}`" />
                <span class="thumb-index">#{{ idx + 1 }}</span>
              </div>
            </div>
          </div>

          <!-- Trường hợp chưa có ảnh -->
          <div v-else class="gallery-empty-state">
            <AlertTriangle :size="42" class="text-amber-500 mb-2" />
            <h4 class="font-bold text-slate-800 text-sm">Khoản chi này chưa có ảnh chứng từ hoặc hóa đơn xác minh</h4>
            <p class="text-xs text-muted mb-3">Tài xế hoặc bộ phận điều vận có thể bổ sung ảnh vé cầu đường, biên lai hoặc hóa đơn đổ dầu để Kế toán thẩm định.</p>
            <button class="btn btn-primary btn-sm" @click="editExpenseFromGallery">
              <PlusCircle :size="15" />
              <span>+ Tải Lên Bằng Chứng Ngay</span>
            </button>
          </div>
        </div>

        <div class="modal-footer flex items-center justify-between">
          <div>
            <a
              v-if="getExpenseImages(selectedExpenseForProof).length > 0"
              :href="getExpenseImages(selectedExpenseForProof)[currentProofIndex]"
              :download="`bang-chung-${selectedExpenseForProof.tripCode}-${currentProofIndex + 1}.svg`"
              class="btn btn-outline btn-sm"
              target="_blank"
            >
              <Download :size="14" />
              <span>Tải ảnh hiện tại ({{ currentProofIndex + 1 }}/{{ getExpenseImages(selectedExpenseForProof).length }})</span>
            </a>
          </div>

          <div class="flex items-center gap-2">
            <button class="btn btn-outline btn-sm" @click="editExpenseFromGallery">
              <Edit :size="14" />
              <span>Chỉnh sửa / Thêm ảnh</span>
            </button>
            <button class="btn btn-secondary btn-sm" @click="selectedExpenseForProof = null">
              Đóng
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.driver-expenses-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.header-tag-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}
.badge-role {
  background: #e0f2fe;
  color: #0369a1;
  font-size: 0.6875rem;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 4px;
}
.badge-driver {
  background: #f1f5f9;
  color: #475569;
  font-size: 0.6875rem;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 4px;
}
.page-title {
  font-size: 1.375rem;
  font-weight: 800;
  color: #0f172a;
}
.page-subtitle {
  font-size: 0.8125rem;
  color: #64748b;
  margin: 0;
}

/* Stat cards */
.grid-4 {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}
.stat-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 14px;
  display: flex;
  align-items: center;
  gap: 12px;
}
.stat-icon {
  width: 44px;
  height: 44px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.icon-blue { background: #e0f2fe; color: #0284c7; }
.icon-green { background: #dcfce7; color: #16a34a; }
.icon-amber { background: #fef3c7; color: #d97706; }
.icon-red { background: #fee2e2; color: #dc2626; }

.stat-content {
  display: flex;
  flex-direction: column;
}
.stat-label {
  font-size: 0.75rem;
  color: #64748b;
  font-weight: 500;
}
.stat-value {
  font-size: 1.125rem;
  font-weight: 800;
}
.stat-sub {
  font-size: 0.6875rem;
  color: #94a3b8;
}

/* Card table */
.card-header-flex {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid #e2e8f0;
  flex-wrap: wrap;
  gap: 10px;
}
.card-title {
  font-size: 1rem;
  font-weight: 700;
  color: #1e293b;
  margin: 0;
}
.card-subtitle {
  font-size: 0.75rem;
  color: #64748b;
}
.filter-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}
.filter-item {
  display: flex;
  align-items: center;
  gap: 6px;
}
.form-select-sm {
  padding: 4px 8px;
  font-size: 0.75rem;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  background: #ffffff;
}

.table-responsive {
  overflow-x: auto;
}
.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8125rem;
}
.data-table th {
  background: #f8fafc;
  padding: 10px 12px;
  text-align: left;
  font-weight: 700;
  color: #475569;
  border-bottom: 1px solid #e2e8f0;
  white-space: nowrap;
}
.data-table td {
  padding: 10px 12px;
  border-bottom: 1px solid #f1f5f9;
  vertical-align: middle;
}
.trip-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.code-badge {
  background: #f1f5f9;
  color: #0f172a;
  border: 1px solid #cbd5e1;
  padding: 3px 8px;
  border-radius: 4px;
  font-weight: 700;
  font-size: 0.75rem;
  width: fit-content;
  display: inline-block;
  white-space: nowrap;
  letter-spacing: 0.02em;
}
.vehicle-plate-tag {
  display: inline-block;
  background: #ffffff;
  color: #0f172a;
  border: 1px solid #cbd5e1;
  padding: 3px 10px;
  border-radius: 4px;
  font-weight: 800;
  font-size: 0.75rem;
  width: fit-content;
  letter-spacing: 0.02em;
  white-space: nowrap;
}
.text-nowrap {
  white-space: nowrap !important;
}
.font-mono {
  font-family: monospace;
}
.note-text {
  color: #334155;
  font-size: 0.8125rem;
}

/* Proof thumb */
.proof-thumb-box {
  position: relative;
  width: 70px;
  height: 48px;
  border-radius: 4px;
  overflow: hidden;
  border: 1px solid #cbd5e1;
  cursor: pointer;
  background: #f8fafc;
}
.proof-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.zoom-hover {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  color: #ffffff;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-size: 0.6rem;
  opacity: 0;
  transition: opacity 0.15s ease;
}
.proof-thumb-box:hover .zoom-hover {
  opacity: 1;
}
.verified-tag {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgba(22, 163, 74, 0.85);
  color: #fff;
  font-size: 0.5625rem;
  text-align: center;
  font-weight: bold;
}
.unverified-box {
  display: flex;
  align-items: center;
  gap: 4px;
  background: #fffbeb;
  border: 1px dashed #fde68a;
  padding: 4px 6px;
  border-radius: 4px;
  width: fit-content;
}

/* Status pills */
.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.6875rem;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 12px;
  white-space: nowrap;
}
.pill-approved {
  background: #dcfce7;
  color: #15803d;
  border: 1px solid #86efac;
}
.pill-rejected {
  background: #fee2e2;
  color: #b91c1c;
  border: 1px solid #fca5a5;
}
.pill-pending {
  background: #fef3c7;
  color: #b45309;
  border: 1px solid #fde68a;
}
.btn-xs {
  padding: 4px 8px;
  font-size: 0.72rem;
}
.btn-icon-only {
  padding: 4px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

/* Badges */
.badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.6875rem;
  font-weight: 700;
}
.badge-orange { background: #ffedd5; color: #c2410c; }
.badge-blue { background: #e0f2fe; color: #0369a1; }
.badge-purple { background: #f3e8ff; color: #7e22ce; }
.badge-red { background: #fee2e2; color: #b91c1c; }
.badge-gray { background: #f1f5f9; color: #475569; }

/* Lightbox Modal */
.lightbox-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}
.lightbox-content {
  position: relative;
  max-width: 600px;
  width: 95%;
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
  border-radius: 50%;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #ffffff;
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

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
}

/* Proof Gallery & Multi-image Actions */
.action-buttons-group {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  justify-content: flex-end;
}

.btn-action-proof {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 9px;
  font-size: 0.72rem;
  font-weight: 600;
  border-color: #cbd5e1;
  color: #334155;
  background: #ffffff;
  transition: all 0.15s ease;
}

.btn-action-proof:hover {
  background: #f0fdf4;
  color: #15803d;
  border-color: #86efac;
}

.btn-action-proof.has-proof-images {
  border-color: #93c5fd;
  color: #1d4ed8;
  background: #eff6ff;
}

.btn-action-proof.has-proof-images:hover {
  background: #dbeafe;
  border-color: #3b82f6;
}

.proof-qty-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #2563eb;
  color: #ffffff;
  font-size: 0.625rem;
  font-weight: 800;
  width: 17px;
  height: 17px;
  border-radius: 9999px;
  margin-left: 2px;
}

.multi-img-pill {
  position: absolute;
  top: 3px;
  right: 3px;
  background: rgba(15, 23, 42, 0.85);
  color: #ffffff;
  font-size: 0.6rem;
  font-weight: 800;
  padding: 1px 5px;
  border-radius: 4px;
  pointer-events: none;
  backdrop-filter: blur(2px);
}

.gallery-modal-wrap {
  max-width: 760px;
}

.proof-meta-banner {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 10px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 10px 14px;
  font-size: 0.775rem;
}

.meta-label {
  color: #64748b;
  display: block;
  font-size: 0.7rem;
}

.gallery-main-viewport {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #0f172a;
  border-radius: 8px;
  min-height: 380px;
  max-height: 480px;
  overflow: hidden;
  padding: 12px;
}

.gallery-main-img-wrap {
  position: relative;
  max-width: 100%;
  max-height: 450px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.gallery-main-img {
  max-width: 100%;
  max-height: 420px;
  object-fit: contain;
  border-radius: 6px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.4);
}

.img-counter-pill {
  position: absolute;
  bottom: 8px;
  right: 8px;
  background: rgba(0, 0, 0, 0.75);
  color: #fff;
  font-size: 0.72rem;
  font-weight: 700;
  padding: 3px 9px;
  border-radius: 12px;
  backdrop-filter: blur(4px);
}

.gallery-nav-btn {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 10;
  transition: all 0.2s ease;
  backdrop-filter: blur(4px);
}

.gallery-nav-btn:hover {
  background: rgba(255, 255, 255, 0.45);
  transform: translateY(-50%) scale(1.08);
}

.btn-prev {
  left: 12px;
}

.btn-next {
  right: 12px;
}

.gallery-thumbs-strip {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 12px;
  overflow-x: auto;
  padding-bottom: 4px;
}

.thumb-item {
  position: relative;
  width: 80px;
  height: 56px;
  border-radius: 6px;
  overflow: hidden;
  border: 2px solid #cbd5e1;
  cursor: pointer;
  flex-shrink: 0;
  opacity: 0.65;
  transition: all 0.2s ease;
  background: #f1f5f9;
}

.thumb-item:hover {
  opacity: 0.9;
  border-color: #94a3b8;
}

.thumb-item.active {
  opacity: 1;
  border-color: #2563eb;
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.2);
  transform: translateY(-2px);
}

.thumb-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.thumb-index {
  position: absolute;
  bottom: 2px;
  right: 2px;
  background: rgba(0, 0, 0, 0.7);
  color: #fff;
  font-size: 0.58rem;
  font-weight: 700;
  padding: 1px 4px;
  border-radius: 3px;
}

.gallery-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  text-align: center;
  background: #fefce8;
  border: 1px dashed #fde047;
  border-radius: 8px;
}

@media (max-width: 1024px) {
  .grid-4 { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 640px) {
  .grid-4 { grid-template-columns: 1fr; }
  .page-header { flex-direction: column; align-items: flex-start; gap: 12px; }
}
</style>
