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
} from 'lucide-vue-next';

const driverStore = useDriverStore();
const authStore = useAuthStore();

const activeExpenseTrip = ref<TransportTrip | null>(null);
const activeEditExpenseId = ref<number | null>(null);
const previewZoomImage = ref<string | null>(null);
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
              <th>Mã Chuyến / Xe</th>
              <th>Loại Chi Phí</th>
              <th>Số Tiền (VNĐ)</th>
              <th>Nội Dung / Diễn Giải</th>
              <th>Bằng Chứng Xác Minh (Hóa Đơn)</th>
              <th>Thời Gian Ghi</th>
              <th>Trạng Thái Thẩm Định</th>
              <th class="text-end">Thao Tác</th>
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
              <td>
                <div class="trip-cell">
                  <span class="code-badge">{{ exp.tripCode }}</span>
                  <span class="text-xs font-semibold text-muted">Xe: {{ exp.vehiclePlate }}</span>
                </div>
              </td>
              <td>
                <span class="badge" :class="getExpenseTypeBadge(exp.expenseType)">
                  {{ getExpenseTypeName(exp.expenseType) }}
                </span>
              </td>
              <td>
                <strong class="text-primary font-bold">{{ exp.amount.toLocaleString() }} đ</strong>
              </td>
              <td>
                <span class="note-text">{{ exp.receiptNote || '—' }}</span>
              </td>
              <td>
                <!-- Khung xem ảnh bằng chứng hóa đơn -->
                <div v-if="exp.receiptImage" class="proof-thumb-box" @click="previewZoomImage = exp.receiptImage">
                  <img :src="exp.receiptImage" alt="Hóa đơn" class="proof-img" />
                  <div class="zoom-hover">
                    <ZoomIn :size="13" />
                    <span>Xem ảnh lớn</span>
                  </div>
                  <span class="verified-tag">✓ Đã có ảnh</span>
                </div>
                <div v-else class="unverified-box">
                  <AlertTriangle :size="14" class="text-amber" />
                  <span class="text-xxs text-amber font-bold">Chưa có ảnh</span>
                </div>
              </td>
              <td>
                <span class="text-xs text-muted">{{ exp.recordedAt }}</span>
              </td>
              <td>
                <div v-if="exp.auditStatus === 'APPROVED' || (!exp.auditStatus && !!exp.receiptImage)" class="status-pill pill-approved">
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
              <td class="text-end">
                <button
                  class="btn btn-outline btn-xs btn-icon-only"
                  @click="openEditExpenseModal(exp)"
                  title="Điều chỉnh khoản chi này"
                >
                  <Edit :size="14" />
                </button>
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

    <!-- Lightbox phóng to ảnh hóa đơn -->
    <div v-if="previewZoomImage" class="lightbox-overlay" @click.self="previewZoomImage = null">
      <div class="lightbox-content">
        <button class="lightbox-close" @click="previewZoomImage = null">
          <X :size="20" />
        </button>
        <img :src="previewZoomImage" alt="Hóa đơn bằng chứng chi phí" class="lightbox-img" />
        <div class="lightbox-footer">
          <a :href="previewZoomImage" download="hoa-don-xac-minh.svg" class="btn btn-outline btn-sm">
            <Download :size="14" />
            <span>Tải ảnh gốc</span>
          </a>
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
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 700;
  font-size: 0.75rem;
  width: fit-content;
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

@media (max-width: 1024px) {
  .grid-4 { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 640px) {
  .grid-4 { grid-template-columns: 1fr; }
  .page-header { flex-direction: column; align-items: flex-start; gap: 12px; }
}
</style>
