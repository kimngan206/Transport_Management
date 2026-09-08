<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useBookingStore } from '@/stores/booking';
import type { TransportRequest } from '@/types';
import StatusBadge from '@/components/common/StatusBadge.vue';
import BookingCreateModal from '@/components/booking/BookingCreateModal.vue';
import BookingDetailModal from '@/components/booking/BookingDetailModal.vue';
import {
  PlusCircle,
  Search,
  ArrowRight,
  Filter,
  Calendar,
  Layers,
  ChevronRight,
  Truck,
  Car,
  Clock,
  Building2,
  Check,
  AlertCircle,
  X,
} from 'lucide-vue-next';

const route = useRoute();
const authStore = useAuthStore();
const bookingStore = useBookingStore();

const searchKeyword = ref('');
const filterScope = ref<'all' | 'mine'>('all');
const filterStatus = ref<string>('ALL');
const filterCargoType = ref<string>('ALL');

watch(
  () => route.query.scope,
  (val) => {
    if (val === 'mine') filterScope.value = 'mine';
    else if (val === 'all') filterScope.value = 'all';
  },
  { immediate: true }
);

const showCreateModal = ref(false);
const selectedRequest = ref<TransportRequest | null>(null);

// KPI Stats Ngành Cao Su
const totalLatexKg = computed(() => {
  return bookingStore.requests.reduce((sum, r) => sum + (r.estimatedWeightKg || 0), 0);
});
const pendingCount = computed(
  () => bookingStore.requests.filter((r) => r.status === 'PENDING').length
);
const approvedCount = computed(
  () => bookingStore.requests.filter((r) => r.status === 'APPROVED' || r.status === 'DISPATCHED').length
);
const completedCount = computed(
  () => bookingStore.requests.filter((r) => r.status === 'COMPLETED').length
);

const filteredRequests = computed(() => {
  return bookingStore.requests.filter((r) => {
    if (filterScope.value === 'mine' && r.requesterId !== authStore.currentUser.id) {
      return false;
    }
    if (filterStatus.value !== 'ALL' && r.status !== filterStatus.value) {
      return false;
    }
    if (filterCargoType.value !== 'ALL') {
      if (filterCargoType.value === 'LATEX_LIQUID' && (!r.estimatedWeightKg || r.vehicleType !== 'Truck')) return false;
      if (filterCargoType.value === 'EXCAVATOR' && r.vehicleType !== 'Excavator') return false;
      if (filterCargoType.value === 'PASSENGER' && (!r.passengersCount || r.vehicleType !== 'Pickup')) return false;
    }
    if (searchKeyword.value) {
      const q = searchKeyword.value.toLowerCase().trim();
      const matchCode = r.requestCode.toLowerCase().includes(q);
      const matchPurpose = r.purpose.toLowerCase().includes(q);
      const matchName = r.requesterName.toLowerCase().includes(q);
      const matchRoute = `${r.fromLocation} ${r.toLocation}`.toLowerCase().includes(q);
      if (!matchCode && !matchPurpose && !matchName && !matchRoute) return false;
    }
    return true;
  });
});

function openDetail(req: TransportRequest) {
  selectedRequest.value = req;
}

function setFilterStatus(status: string) {
  filterStatus.value = status;
}

function getInitials(name: string): string {
  const parts = name.trim().split(' ');
  if (parts.length >= 2) {
    return (parts[parts.length - 2][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}
</script>

<template>
  <div class="booking-page-container">
    <!-- Header Page: Tiêu đề & Nút Tạo Yêu Cầu Chuyên Ngành Cao Su -->
    <div class="booking-page-header">
      <div class="header-titles">
        <div class="breadcrumb-strip">
          <span>Hệ Thống Điều Độ</span>
          <ChevronRight :size="12" class="breadcrumb-sep" />
          <span>Vận Chuyển Mủ Cao Su</span>
          <ChevronRight :size="12" class="breadcrumb-sep" />
          <span class="breadcrumb-current">Danh Sách Yêu Cầu Đặt Xe</span>
        </div>
        <h1 class="page-heading">Điều Độ Vận Chuyển Mủ & Xe Nông Trường</h1>
        <p class="page-caption">
          Quản lý lệnh vận chuyển mủ nước xe bồn, mủ chén/mủ đông, máy xúc san ủi lô cao su và xe công tác kỹ thuật
        </p>
      </div>

      <button class="btn btn-primary btn-create" @click="showCreateModal = true">
        <PlusCircle :size="16" />
        <span>Tạo Yêu Cầu Xe Mủ / Cơ Giới</span>
      </button>
    </div>

    <!-- Dải 4 Thẻ KPI Tóm Tắt Sản Lượng Mủ & Chuyến Xe -->
    <div class="kpi-strip-grid">
      <!-- 1. Tổng sản lượng mủ đặt xe -->
      <div
        class="kpi-mini-card"
        :class="{ active: filterStatus === 'ALL' }"
        @click="setFilterStatus('ALL')"
      >
        <div class="kpi-icon-wrap icon-emerald">
          <Droplets :size="18" />
        </div>
        <div class="kpi-meta">
          <span class="kpi-label">Sản Lượng Đặt Chuyển</span>
          <div class="kpi-val-row">
            <span class="kpi-value text-emerald">{{ totalLatexKg.toLocaleString() }}</span>
            <span class="kpi-unit">kg mủ</span>
          </div>
        </div>
      </div>

      <!-- 2. Chờ phê duyệt -->
      <div
        class="kpi-mini-card"
        :class="{ active: filterStatus === 'PENDING' }"
        @click="setFilterStatus('PENDING')"
      >
        <div class="kpi-icon-wrap icon-amber">
          <Clock :size="18" />
        </div>
        <div class="kpi-meta">
          <span class="kpi-label">Chờ Lãnh Đạo Duyệt</span>
          <div class="kpi-val-row">
            <span class="kpi-value text-amber">{{ pendingCount }}</span>
            <span class="kpi-unit">yêu cầu</span>
          </div>
        </div>
      </div>

      <!-- 3. Đã duyệt / Chờ điều phối xe bồn -->
      <div
        class="kpi-mini-card"
        :class="{ active: filterStatus === 'APPROVED' }"
        @click="setFilterStatus('APPROVED')"
      >
        <div class="kpi-icon-wrap icon-blue">
          <Truck :size="18" />
        </div>
        <div class="kpi-meta">
          <span class="kpi-label">Chờ Ghép Chuyến Bồn</span>
          <div class="kpi-val-row">
            <span class="kpi-value text-blue">{{ approvedCount }}</span>
            <span class="kpi-unit">chuyến mủ</span>
          </div>
        </div>
      </div>

      <!-- 4. Đã hoàn thành nhập nhà máy -->
      <div
        class="kpi-mini-card"
        :class="{ active: filterStatus === 'COMPLETED' }"
        @click="setFilterStatus('COMPLETED')"
      >
        <div class="kpi-icon-wrap icon-slate">
          <Check :size="18" />
        </div>
        <div class="kpi-meta">
          <span class="kpi-label">Đã Nhập Kho Chế Biến</span>
          <div class="kpi-val-row">
            <span class="kpi-value text-slate">{{ completedCount }}</span>
            <span class="kpi-unit">chuyến</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Thanh Tìm Kiếm & Lọc Hiện Đại Chuẩn Ngành -->
    <div class="filter-toolbar card">
      <div class="search-box-wrap">
        <Search :size="15" class="search-ico" />
        <input
          v-model="searchKeyword"
          type="text"
          class="search-text-input"
          placeholder="Tìm mã YC mủ, nông trường đi, trạm cân, nhà máy chế biến..."
        />
        <button
          v-if="searchKeyword"
          class="btn-clear-search"
          @click="searchKeyword = ''"
          title="Xóa tìm kiếm"
        >
          <X :size="13" />
        </button>
      </div>

      <div class="filter-controls-right">
        <!-- Phân loại hàng hóa mủ cao su -->
        <div class="filter-select-box">
          <select v-model="filterCargoType" class="custom-select-input">
            <option value="ALL">📦 Tất cả loại mủ / dịch vụ</option>
            <option value="LATEX_LIQUID">💧 Mủ nước (Xe bồn xi-téc)</option>
            <option value="EXCAVATOR">🚜 Máy xúc lô vườn cao su</option>
            <option value="PASSENGER">🚗 Xe bán tải tuần tra vườn</option>
          </select>
        </div>

        <!-- Segmented Scope Control -->
        <div class="segmented-scope">
          <button
            class="seg-btn"
            :class="{ active: filterScope === 'all' }"
            @click="filterScope = 'all'"
          >
            Toàn đội ({{ bookingStore.requests.length }})
          </button>
          <button
            class="seg-btn"
            :class="{ active: filterScope === 'mine' }"
            @click="filterScope = 'mine'"
          >
            Của tôi ({{ bookingStore.getMyRequests(authStore.currentUser.id).length }})
          </button>
        </div>

        <!-- Filter Status Select -->
        <div class="filter-select-box">
          <Filter :size="13" class="filter-select-ico" />
          <select v-model="filterStatus" class="custom-select-input">
            <option value="ALL">Tất cả trạng thái</option>
            <option value="PENDING">Chờ phê duyệt</option>
            <option value="APPROVED">Đã phê duyệt</option>
            <option value="DISPATCHED">Đã điều phối</option>
            <option value="INPROGRESS">Đang vận chuyển</option>
            <option value="COMPLETED">Đã nhập kho chế biến</option>
            <option value="REJECTED">Từ chối</option>
            <option value="CANCELLED">Đã hủy</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Bảng Dữ Liệu Tinh Chỉnh Cao Cấp -->
    <div class="card data-table-card">
      <div class="table-container">
        <table class="table modern-table">
          <thead>
            <tr>
              <th class="col-code">Mã Yêu Cầu</th>
              <th class="col-requester">Người Yêu Cầu</th>
              <th class="col-dept">Phòng Ban</th>
              <th class="col-type">Loại Phương Tiện</th>
              <th class="col-time">Thời Gian Chuyến</th>
              <th class="col-route">Lộ Trình Tuyến</th>
              <th class="col-payload">Khối Lượng / Khách</th>
              <th class="col-status">Trạng Thái</th>
              <th class="col-action text-right">Thao Tác</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="filteredRequests.length === 0">
              <td colspan="9" class="empty-cell">
                <div class="empty-state-box">
                  <AlertCircle :size="32" class="empty-ico" />
                  <p class="empty-title">Không tìm thấy yêu cầu đặt xe nào</p>
                  <p class="empty-subtitle">
                    Thử điều chỉnh từ khóa tìm kiếm hoặc đổi điều kiện lọc trạng thái
                  </p>
                </div>
              </td>
            </tr>

            <tr
              v-for="r in filteredRequests"
              :key="r.id"
              class="data-row"
              @click="openDetail(r)"
            >
              <!-- 1. Mã yêu cầu (No wrap, Monospaced) -->
              <td class="col-code">
                <span class="code-pill">{{ r.requestCode }}</span>
              </td>

              <!-- 2. Người yêu cầu kèm Avatar Initials -->
              <td class="col-requester">
                <div class="requester-cell">
                  <div class="requester-avatar">
                    {{ getInitials(r.requesterName) }}
                  </div>
                  <div class="requester-meta">
                    <span class="requester-name">{{ r.requesterName }}</span>
                    <span class="requester-created">Tạo ngày {{ r.createdAt.slice(0, 10) }}</span>
                  </div>
                </div>
              </td>

              <!-- 3. Phòng ban -->
              <td class="col-dept">
                <span class="dept-tag">
                  <Building2 :size="12" class="dept-ico" />
                  <span>{{ r.departmentName }}</span>
                </span>
              </td>

              <!-- 4. Loại xe nông trường -->
              <td class="col-type">
                <span class="type-badge" :class="r.vehicleType.toLowerCase()">
                  <Truck v-if="r.vehicleType === 'Truck'" :size="12" />
                  <Car v-else-if="r.vehicleType === 'Pickup'" :size="12" />
                  <Layers v-else :size="12" />
                  <span>
                    {{
                      r.vehicleType === 'Truck'
                        ? (r.estimatedWeightKg && r.estimatedWeightKg >= 1000 ? 'Xe Bồn Xi-Téc' : 'Xe Tải Mủ')
                        : r.vehicleType === 'Pickup'
                        ? 'Bán Tải Tuần Tra'
                        : 'Máy Xúc Lô Vườn'
                    }}
                  </span>
                </span>
              </td>

              <!-- 5. Thời gian -->
              <td class="col-time">
                <div class="time-block">
                  <div class="time-date-row">
                    <Calendar :size="11" class="time-ico" />
                    <span>{{ r.startTime.slice(0, 10) }}</span>
                  </div>
                  <div class="time-hours-row">
                    <strong>{{ r.startTime.slice(11, 16) }}</strong>
                    <span class="time-sep">→</span>
                    <span>{{ r.endTime.slice(11, 16) }}</span>
                  </div>
                </div>
              </td>

              <!-- 6. Lộ trình trực quan -->
              <td class="col-route">
                <div class="route-display">
                  <div class="route-point from">
                    <span class="point-dot dot-green"></span>
                    <span class="location-name">{{ r.fromLocation }}</span>
                  </div>
                  <div class="route-arrow-line">
                    <ArrowRight :size="11" class="route-arrow" />
                  </div>
                  <div class="route-point to">
                    <span class="point-dot dot-blue"></span>
                    <span class="location-name">{{ r.toLocation }}</span>
                  </div>
                </div>
              </td>

              <!-- 7. Khối lượng mủ / Khách -->
              <td class="col-payload">
                <div v-if="r.estimatedWeightKg" class="payload-chip payload-latex">
                  <Droplets :size="11" class="latex-drop-ico" />
                  <span class="payload-val">{{ r.estimatedWeightKg.toLocaleString() }}</span>
                  <span class="payload-unit">kg mủ</span>
                </div>
                <div v-else-if="r.passengersCount" class="payload-chip payload-passengers">
                  <span class="payload-val">{{ r.passengersCount }}</span>
                  <span class="payload-unit">cán bộ</span>
                </div>
                <span v-else class="text-muted">—</span>
              </td>

              <!-- 8. Trạng thái -->
              <td class="col-status">
                <StatusBadge :status="r.status" />
              </td>

              <!-- 9. Thao tác -->
              <td class="col-action text-right" @click.stop>
                <button class="btn-action-view" @click="openDetail(r)" title="Xem chi tiết yêu cầu">
                  <span>Chi tiết</span>
                  <ChevronRight :size="13" class="action-arr" />
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modals -->
    <BookingCreateModal
      v-if="showCreateModal"
      @close="showCreateModal = false"
    />

    <BookingDetailModal
      v-if="selectedRequest"
      :request="selectedRequest"
      @close="selectedRequest = null"
    />
  </div>
</template>

<style scoped>
.booking-page-container {
  display: flex;
  flex-direction: column;
  gap: 18px;
  max-width: 1600px;
  margin: 0 auto;
}

/* Header Page */
.booking-page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 16px;
}

.breadcrumb-strip {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.6875rem;
  font-weight: 500;
  color: #64748b;
  margin-bottom: 4px;
}

.breadcrumb-sep {
  color: #cbd5e1;
}

.breadcrumb-current {
  color: #0f172a;
  font-weight: 600;
}

.page-heading {
  font-size: 1.45rem;
  font-weight: 800;
  color: #0f172a;
  letter-spacing: -0.025em;
}

.page-caption {
  font-size: 0.8125rem;
  color: #64748b;
  margin-top: 3px;
}

.btn-create {
  padding: 10px 20px;
  font-size: 0.8125rem;
  box-shadow: 0 4px 14px rgba(5, 150, 105, 0.3);
}

/* KPI Strip Grid */
.kpi-strip-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
}

.kpi-mini-card {
  background: white;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  padding: 14px 16px;
  display: flex;
  align-items: center;
  gap: 14px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.kpi-mini-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.06);
  border-color: #cbd5e1;
}

.kpi-mini-card.active {
  border-color: #059669;
  background: #f0fdf4;
  box-shadow: 0 4px 12px rgba(5, 150, 105, 0.12);
}

.kpi-icon-wrap {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.icon-slate { background: #f1f5f9; color: #475569; }
.icon-amber { background: #fef3c7; color: #d97706; }
.icon-blue { background: #eff6ff; color: #2563eb; }
.icon-emerald { background: #ecfdf5; color: #059669; }

.kpi-meta {
  display: flex;
  flex-direction: column;
}

.kpi-label {
  font-size: 0.6875rem;
  font-weight: 700;
  color: #52705d;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.kpi-val-row {
  display: flex;
  align-items: baseline;
  gap: 5px;
}

.kpi-value {
  font-size: 1.35rem;
  font-weight: 800;
  color: #0c1a11;
  line-height: 1.2;
}

.kpi-unit {
  font-size: 0.6875rem;
  font-weight: 600;
  color: #64748b;
}

.latex-drop-ico {
  color: #15803d;
  flex-shrink: 0;
}

.text-amber { color: #b45309; }
.text-blue { color: #0284c7; }
.text-emerald { color: #15803d; }
.text-slate { color: #334155; }

/* Filter Toolbar */
.filter-toolbar {
  padding: 12px 18px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
  background-color: white;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
}

.search-box-wrap {
  position: relative;
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 300px;
}

.search-ico {
  position: absolute;
  left: 14px;
  color: #94a3b8;
  pointer-events: none;
}

.search-text-input {
  width: 100%;
  padding: 9px 36px 9px 38px;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  background-color: #f8fafc;
  font-size: 0.8125rem;
  color: #0f172a;
  outline: none;
  transition: all 0.2s;
  font-family: inherit;
}

.search-text-input:focus {
  background-color: white;
  border-color: #059669;
  box-shadow: 0 0 0 3px rgba(5, 150, 105, 0.15);
}

.btn-clear-search {
  position: absolute;
  right: 10px;
  background: transparent;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  display: flex;
  align-items: center;
  padding: 2px;
}
.btn-clear-search:hover { color: #475569; }

.filter-controls-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.segmented-scope {
  display: flex;
  background: #f1f5f9;
  padding: 3px;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}

.seg-btn {
  border: none;
  background: transparent;
  padding: 6px 14px;
  font-size: 0.75rem;
  font-weight: 600;
  border-radius: 6px;
  cursor: pointer;
  color: #64748b;
  transition: all 0.15s ease;
  font-family: inherit;
}

.seg-btn.active {
  background: white;
  color: #0f172a;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.filter-select-box {
  position: relative;
  display: flex;
  align-items: center;
}

.filter-select-ico {
  position: absolute;
  left: 12px;
  color: #94a3b8;
  pointer-events: none;
}

.custom-select-input {
  padding: 8px 14px 8px 32px;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  background-color: #f8fafc;
  font-size: 0.75rem;
  font-weight: 600;
  color: #334155;
  outline: none;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.2s;
}

.custom-select-input:focus {
  border-color: #059669;
  background-color: white;
  box-shadow: 0 0 0 3px rgba(5, 150, 105, 0.15);
}

/* Data Table Card */
.data-table-card {
  border-radius: 14px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 4px 20px -2px rgba(15, 23, 42, 0.05);
  background: white;
  overflow: hidden;
}

.modern-table {
  width: 100%;
  border-collapse: collapse;
}

.modern-table thead tr {
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
}

.modern-table th {
  padding: 13px 18px;
  color: #64748b;
  font-weight: 700;
  font-size: 0.6875rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  white-space: nowrap;
}

.data-row {
  cursor: pointer;
  border-bottom: 1px solid #f1f5f9;
  transition: background-color 0.15s ease, transform 0.1s ease;
}

.data-row:hover {
  background-color: #f8fafc;
}

.data-row:last-child {
  border-bottom: none;
}

.modern-table td {
  padding: 14px 18px;
  vertical-align: middle;
}

/* Specific Columns */
.col-code {
  white-space: nowrap;
}

.code-pill {
  display: inline-block;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.75rem;
  font-weight: 700;
  color: #1e293b;
  background: #f1f5f9;
  border: 1px solid #cbd5e1;
  padding: 3px 8px;
  border-radius: 6px;
  letter-spacing: -0.01em;
  white-space: nowrap;
}

/* Requester Cell */
.col-requester {
  min-width: 160px;
}

.requester-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}

.requester-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%);
  color: #4338ca;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.6875rem;
  font-weight: 800;
  flex-shrink: 0;
  border: 1px solid rgba(67, 56, 202, 0.2);
}

.requester-meta {
  display: flex;
  flex-direction: column;
}

.requester-name {
  font-size: 0.8125rem;
  font-weight: 700;
  color: #0f172a;
}

.requester-created {
  font-size: 0.6875rem;
  color: #94a3b8;
}

/* Department Cell */
.col-dept {
  white-space: nowrap;
}

.dept-tag {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  padding: 4px 9px;
  border-radius: 6px;
  font-size: 0.75rem;
  color: #334155;
  font-weight: 600;
}

.dept-ico {
  color: #94a3b8;
}

/* Vehicle Type Cell */
.col-type {
  white-space: nowrap;
}

.type-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 0.6875rem;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 6px;
  border: 1px solid transparent;
}
.type-badge.truck {
  background: #f1f5f9;
  color: #334155;
  border-color: #cbd5e1;
}
.type-badge.pickup {
  background: #eff6ff;
  color: #1d4ed8;
  border-color: #bfdbfe;
}
.type-badge.excavator {
  background: #fffbeb;
  color: #b45309;
  border-color: #fde68a;
}

/* Time Cell */
.col-time {
  white-space: nowrap;
}

.time-block {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.time-date-row {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.6875rem;
  color: #64748b;
  font-weight: 500;
}

.time-ico {
  color: #94a3b8;
}

.time-hours-row {
  font-size: 0.75rem;
  color: #0f172a;
}

.time-sep {
  margin: 0 4px;
  color: #94a3b8;
}

/* Route Display */
.col-route {
  min-width: 220px;
}

.route-display {
  display: flex;
  align-items: center;
  gap: 8px;
}

.route-point {
  display: flex;
  align-items: center;
  gap: 5px;
}

.point-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}
.dot-green { background: #10b981; }
.dot-blue { background: #3b82f6; }

.location-name {
  font-size: 0.75rem;
  font-weight: 600;
  color: #1e293b;
  white-space: nowrap;
}

.route-arrow-line {
  display: flex;
  align-items: center;
}

.route-arrow {
  color: #94a3b8;
}

/* Payload Cell */
.col-payload {
  white-space: nowrap;
}

.payload-chip {
  display: inline-flex;
  align-items: baseline;
  gap: 4px;
  padding: 3px 9px;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 700;
}

.payload-latex {
  background: #ecfdf5;
  color: #047857;
  border: 1px solid #a7f3d0;
}

.payload-passengers {
  background: #eef2ff;
  color: #4338ca;
  border: 1px solid #c7d2fe;
}

.payload-unit {
  font-size: 0.6875rem;
  font-weight: 500;
  opacity: 0.85;
}

/* Status Cell */
.col-status {
  white-space: nowrap;
}

/* Action Cell */
.col-action {
  white-space: nowrap;
}

.text-right {
  text-align: right;
}

.btn-action-view {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: white;
  border: 1px solid #cbd5e1;
  color: #334155;
  padding: 6px 12px;
  border-radius: 7px;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  font-family: inherit;
}

.btn-action-view:hover {
  background: #059669;
  color: white;
  border-color: #059669;
  box-shadow: 0 2px 6px rgba(5, 150, 105, 0.25);
  transform: translateX(2px);
}

.action-arr {
  transition: transform 0.2s ease;
}

.btn-action-view:hover .action-arr {
  transform: translateX(2px);
}

/* Empty State */
.empty-cell {
  padding: 48px 24px;
  text-align: center;
}

.empty-state-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.empty-ico {
  color: #cbd5e1;
}

.empty-title {
  font-size: 0.9375rem;
  font-weight: 700;
  color: #334155;
}

.empty-subtitle {
  font-size: 0.75rem;
  color: #94a3b8;
}

.text-muted {
  color: #94a3b8;
}

@media (max-width: 1024px) {
  .kpi-strip-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
@media (max-width: 640px) {
  .kpi-strip-grid {
    grid-template-columns: 1fr;
  }
  .filter-toolbar {
    flex-direction: column;
    align-items: stretch;
  }
  .filter-controls-right {
    flex-direction: column;
  }
}
</style>
