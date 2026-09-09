<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useBookingStore } from '@/stores/booking';
import { useDispatchStore } from '@/stores/dispatch';
import { useFleetStore } from '@/stores/fleet';
import { useDialogStore } from '@/stores/dialog';
import type { TransportRequest } from '@/types';
import StatusBadge from '@/components/common/StatusBadge.vue';
import BatchTripModal from '@/components/dispatch/BatchTripModal.vue';
import FleetDispatchMap from '@/components/dispatch/FleetDispatchMap.vue';
import TripExpensesModal from '@/components/common/TripExpensesModal.vue';
import EditTripModal from '@/components/dispatch/EditTripModal.vue';
import {
  Layers,
  Truck,
  UserCheck,
  AlertCircle,
  Plus,
  CheckCircle2,
  MapPin,
  LayoutGrid,
  Receipt,
  Check,
  X,
  Clock,
  Edit2,
} from 'lucide-vue-next';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const bookingStore = useBookingStore();
const dispatchStore = useDispatchStore();
const fleetStore = useFleetStore();
const dialog = useDialogStore();
const viewExpensesTrip = ref<any>(null);
const editingTrip = ref<TransportTrip | null>(null);
const fleetMapRef = ref<InstanceType<typeof FleetDispatchMap> | null>(null);

// Chế độ xem: 'map' (Bản đồ & Lộ trình GPS) hoặc 'board' (Bảng thẻ Kanban 3 cột)
const viewMode = ref<'map' | 'board'>((route.query.view as string) === 'board' ? 'board' : 'map');

watch(
  () => route.query.view,
  (newVal) => {
    viewMode.value = newVal === 'board' ? 'board' : 'map';
    if (viewMode.value === 'map') {
      setTimeout(() => {
        fleetMapRef.value?.invalidateSize();
      }, 120);
    }
  }
);

function switchView(mode: 'map' | 'board') {
  viewMode.value = mode;
  router.replace({ query: { ...route.query, view: mode } });
  if (mode === 'map') {
    setTimeout(() => {
      fleetMapRef.value?.invalidateSize();
    }, 120);
  }
}

const showBatchModal = ref(false);
const preselectedRequests = ref<TransportRequest[]>([]);

// Bộ lọc yêu cầu: 'ALL' | 'PENDING' | 'APPROVED'
const filterReqStatus = ref<'ALL' | 'PENDING' | 'APPROVED'>('ALL');

// 1. Yêu cầu chờ duyệt điều xe (PENDING)
const pendingApprovalRequests = computed(() => bookingStore.pendingRequests);

// 2. Yêu cầu đã duyệt chờ gán xe (APPROVED)
const approvedRequests = computed(() => bookingStore.approvedRequests);

// 3. Tất cả yêu cầu cần điều phối / xử lý (PENDING + APPROVED)
const allActionableRequests = computed(() =>
  bookingStore.requests.filter((r) => r.status === 'PENDING' || r.status === 'APPROVED')
);

// Danh sách yêu cầu hiển thị theo bộ lọc
const displayedRequests = computed(() => {
  if (filterReqStatus.value === 'PENDING') return pendingApprovalRequests.value;
  if (filterReqStatus.value === 'APPROVED') return approvedRequests.value;
  return allActionableRequests.value;
});

// Modal từ chối yêu cầu
const showRejectModal = ref(false);
const rejectingRequest = ref<TransportRequest | null>(null);
const rejectReason = ref('');
const rejectError = ref('');

// Phê duyệt yêu cầu trực tiếp tại màn hình Dispatcher
function handleApprove(req: TransportRequest) {
  const res = bookingStore.approveRequest(
    req.id,
    authStore.currentUser.id,
    authStore.currentUser.fullName,
    'Điều phối viên phê duyệt điều xe'
  );
  if (res.success) {
    dialog.showSuccess(`Đã phê duyệt yêu cầu đặt xe ${req.requestCode} thành công! Có thể gán xe ngay.`, 'Phê Duyệt Thành Công');
  } else {
    dialog.showWarning(res.message || 'Không thể phê duyệt yêu cầu!', 'Lỗi');
  }
}

function openReject(req: TransportRequest) {
  rejectingRequest.value = req;
  rejectReason.value = '';
  rejectError.value = '';
  showRejectModal.value = true;
}

function confirmReject() {
  if (!rejectingRequest.value) return;
  if (!rejectReason.value.trim()) {
    rejectError.value = 'Bắt buộc nhập lý do từ chối yêu cầu!';
    return;
  }
  const reqCode = rejectingRequest.value.requestCode;
  const res = bookingStore.rejectRequest(
    rejectingRequest.value.id,
    authStore.currentUser.id,
    authStore.currentUser.fullName,
    rejectReason.value
  );
  if (res.success) {
    showRejectModal.value = false;
    rejectingRequest.value = null;
    dialog.showSuccess(`Đã từ chối yêu cầu đặt xe ${reqCode}!`, 'Từ Chối Thành Công');
  } else {
    rejectError.value = res.message;
  }
}

// Duyệt & gán xe ngay (1 bước)
function openBatchWithDirectApprove(req: TransportRequest) {
  if (req.status === 'PENDING') {
    bookingStore.approveRequest(
      req.id,
      authStore.currentUser.id,
      authStore.currentUser.fullName,
      'Điều phối viên duyệt và gán chuyến trực tiếp'
    );
  }
  openBatchWithRequest(req);
}

// Danh sách xe khả dụng
const vehicles = computed(() => fleetStore.vehicles);

// Danh sách tài xế
const drivers = computed(() => fleetStore.drivers);

// Danh sách chuyến xe
const trips = computed(() => dispatchStore.trips);

function openBatchWithRequest(req: TransportRequest) {
  preselectedRequests.value = [req];
  showBatchModal.value = true;
}

function openBatchGeneral() {
  preselectedRequests.value = [];
  showBatchModal.value = true;
}

// Chuyển đổi trạng thái xe sang tiếng Việt
function getVehicleStatusLabel(status: string): string {
  switch (status) {
    case 'Available':
      return 'Sẵn sàng';
    case 'OnTrip':
      return 'Đang chạy chuyến';
    case 'UnderMaintenance':
      return 'Đang bảo dưỡng';
    case 'Broken':
      return 'Sự cố / Hỏng hóc';
    default:
      return status;
  }
}

// Chuyển đổi loại xe sang tiếng Việt
function getVehicleTypeLabel(type: string): string {
  switch (type) {
    case 'LatexTruck':
      return 'Xe tải';
    case 'PassengerCar':
      return 'Bán tải';
    case 'MillingMachine':
      return 'Máy đào';
    default:
      return type;
  }
}
</script>

<template>
  <div class="dispatch-page">
    <div class="page-header">
      <div>
        <h1 class="page-title">Bảng Điều Phối & Ghép Chuyến</h1>
        <p class="page-subtitle">
          Điều phối viên gán xe, gán tài xế, ghép nhiều yêu cầu cùng tuyến và kiểm soát cự ly quy chuẩn
        </p>
      </div>

      <button class="btn btn-primary" @click="openBatchGeneral">
        <Layers :size="16" />
        <span>Ghép Chuyến Mới (Batch Trip)</span>
      </button>
    </div>

    <!-- Bộ chuyển đổi chế độ xem -->
    <div class="view-mode-tabs mb-4">
      <button
        class="tab-btn"
        :class="{ active: viewMode === 'map' }"
        @click="switchView('map')"
      >
        <MapPin :size="16" />
        <span>Bản Đồ Lộ Trình & Sơ Đồ Điều Xe (GPS Realtime)</span>
      </button>
      <button
        class="tab-btn"
        :class="{ active: viewMode === 'board' }"
        @click="switchView('board')"
      >
        <LayoutGrid :size="16" />
        <span>Bảng Thẻ Điều Phối (Kanban 3 Cột)</span>
      </button>
    </div>

    <!-- 1. CHẾ ĐỘ XEM BẢN ĐỒ & SƠ ĐỒ ĐIỀU XE -->
    <div v-if="viewMode === 'map'">
      <!-- Thanh thông báo yêu cầu chờ duyệt khi đang xem Bản đồ -->
      <div v-if="pendingApprovalRequests.length > 0" class="dispatch-alert-banner mb-3">
        <div class="alert-banner-left">
          <Clock :size="16" class="text-amber" />
          <span>
            Hiện có <strong>{{ pendingApprovalRequests.length }} yêu cầu đặt xe mới</strong> đang chờ bạn phê duyệt và xếp xe vận chuyển.
          </span>
        </div>
        <button class="btn btn-warning btn-xs" @click="switchView('board'); filterReqStatus = 'PENDING'">
          <span>Xem & Duyệt Xe Ngay ➔</span>
        </button>
      </div>

      <FleetDispatchMap ref="fleetMapRef" />
    </div>

    <!-- 2. CHẾ ĐỘ XEM BẢNG THẺ 3 CỘT (KANBAN) -->
    <div v-else class="dispatch-board-grid">
      <!-- Cột 1: Yêu cầu đặt xe & Duyệt điều phối -->
      <div class="board-column card">
        <div class="column-header">
          <div class="flex-between">
            <span class="column-title">YÊU CẦU ĐẶT XE & DUYỆT</span>
            <span class="badge" :class="pendingApprovalRequests.length > 0 ? 'badge-amber' : 'badge-blue'">
              {{ allActionableRequests.length }}
            </span>
          </div>
          <span class="column-desc">Duyệt yêu cầu và gán xe trực tiếp</span>

          <!-- Bộ lọc tab nhanh -->
          <div class="req-filter-tabs mt-2">
            <button
              class="btn-filter-pill"
              :class="{ active: filterReqStatus === 'ALL' }"
              @click="filterReqStatus = 'ALL'"
            >
              Tất cả ({{ allActionableRequests.length }})
            </button>
            <button
              class="btn-filter-pill pill-amber"
              :class="{ active: filterReqStatus === 'PENDING' }"
              @click="filterReqStatus = 'PENDING'"
            >
              Chờ duyệt ({{ pendingApprovalRequests.length }})
            </button>
            <button
              class="btn-filter-pill pill-green"
              :class="{ active: filterReqStatus === 'APPROVED' }"
              @click="filterReqStatus = 'APPROVED'"
            >
              Đã duyệt ({{ approvedRequests.length }})
            </button>
          </div>
        </div>

        <div class="column-body">
          <div v-if="displayedRequests.length === 0" class="empty-state">
            <CheckCircle2 :size="24" class="text-success" />
            <span>Không có yêu cầu nào trong danh mục này!</span>
          </div>

          <div
            v-for="req in displayedRequests"
            :key="req.id"
            class="request-card"
            :class="{ 'card-pending-border': req.status === 'PENDING' }"
          >
            <div class="req-card-top">
              <div class="req-id-box">
                <strong>{{ req.requestCode }}</strong>
                <!-- Badge phân biệt trạng thái duyệt -->
                <span v-if="req.status === 'PENDING'" class="status-badge-pending">
                  <Clock :size="11" />
                  <span>Chờ duyệt</span>
                </span>
                <span v-else class="status-badge-approved">
                  <Check :size="11" />
                  <span>Đã duyệt</span>
                </span>
              </div>
              <span class="type-pill">{{ getVehicleTypeLabel(req.vehicleType) }}</span>
            </div>

            <div class="req-card-route">
              {{ req.fromLocation }} ➔ {{ req.toLocation }}
            </div>

            <div class="req-card-requester text-xs text-muted">
              <span>Người đặt: <strong>{{ req.requesterName }}</strong> ({{ req.departmentName }})</span>
            </div>

            <div class="req-card-meta">
              <span>{{ req.startTime.slice(11) }} - {{ req.endTime.slice(11) }}</span>
              <span v-if="req.estimatedWeightKg" class="font-bold text-success">
                {{ req.estimatedWeightKg.toLocaleString() }} kg mủ
              </span>
              <span v-if="req.passengersCount" class="font-bold text-info">
                {{ req.passengersCount }} người
              </span>
            </div>

            <div v-if="req.purpose" class="req-card-note text-xs">
              <span class="text-muted">Mục đích:</span> {{ req.purpose }}
            </div>

            <!-- Nút thao tác: nếu PENDING thì có Duyệt, Từ chối, Ghép ngay; nếu APPROVED thì Gán chuyến -->
            <div v-if="req.status === 'PENDING'" class="req-pending-actions mt-2">
              <button
                class="btn btn-success btn-xs"
                @click="handleApprove(req)"
                title="Phê duyệt yêu cầu đặt xe này"
              >
                <Check :size="12" />
                <span>Duyệt</span>
              </button>
              <button
                class="btn btn-outline btn-xs btn-reject-outline"
                @click="openReject(req)"
                title="Từ chối yêu cầu đặt xe"
              >
                <X :size="12" />
                <span>Từ chối</span>
              </button>
              <button
                class="btn btn-primary btn-xs"
                @click="openBatchWithDirectApprove(req)"
                title="Duyệt và mở bảng xếp xe điều phối ngay"
              >
                <Plus :size="12" />
                <span>Duyệt & Ghép Xe</span>
              </button>
            </div>

            <div v-else class="req-card-action mt-2">
              <button class="btn btn-primary btn-sm full-w" @click="openBatchWithRequest(req)">
                <Plus :size="14" />
                <span>Gán Chuyến / Ghép Xe</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Cột 2: Trạng thái Đội xe -->
      <div class="board-column card">
        <div class="column-header">
          <div class="flex-between">
            <span class="column-title">ĐỘI PHƯƠNG TIỆN</span>
            <span class="badge badge-blue">{{ vehicles.length }} xe</span>
          </div>
          <span class="column-desc">Tình trạng sẵn sàng & chu kỳ bảo dưỡng</span>
        </div>

        <div class="column-body">
          <div
            v-for="v in vehicles"
            :key="v.id"
            class="vehicle-card"
            :class="`status-${v.status.toLowerCase()}`"
          >
            <div class="veh-card-top">
              <div class="veh-id-group">
                <Truck :size="16" />
                <strong>{{ v.licensePlate }}</strong>
              </div>
              <span class="veh-status-badge" :class="`status-${v.status.toLowerCase()}`">
                {{ getVehicleStatusLabel(v.status) }}
              </span>
            </div>

            <div class="veh-desc">
              {{ v.model }} (Tải trọng: {{ v.capacityTons }} Tấn)
            </div>

            <div v-if="v.assignedDriverName" class="veh-driver-tag text-xs">
              <span class="text-muted">Tài xế trực thuộc:</span> <strong>{{ v.assignedDriverName }}</strong>
            </div>

            <div class="veh-metrics">
              <span v-if="v.vehicleType !== 'MillingMachine'">
                ODO: <strong>{{ v.currentOdoKm.toLocaleString() }} km</strong>
              </span>
              <span v-else>
                Giờ máy: <strong>{{ v.currentOperatingHours }} giờ</strong>
              </span>

              <!-- Cảnh báo bảo dưỡng 5.000 km -->
              <span v-if="v.maintenanceStatus === 'Due'" class="maint-alert">
                <AlertCircle :size="13" />
                <span>Cần bảo dưỡng</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Cột 3: Trạng thái Tài xế -->
      <div class="board-column card">
        <div class="column-header">
          <div class="flex-between">
            <span class="column-title">ĐỘI NGŨ TÀI XẾ</span>
            <span class="badge badge-green">{{ drivers.length }} người</span>
          </div>
          <span class="column-desc">Hạng bằng & tính khả dụng</span>
        </div>

        <div class="column-body">
          <div
            v-for="d in drivers"
            :key="d.id"
            class="driver-card"
            :class="{ busy: d.isCurrentlyOnTrip }"
          >
            <div class="driver-card-top">
              <div class="driver-name-group">
                <UserCheck :size="16" />
                <strong>{{ d.fullName }}</strong>
              </div>
              <span
                class="driver-tag"
                :class="d.isCurrentlyOnTrip ? 'tag-busy' : 'tag-free'"
              >
                {{ d.isCurrentlyOnTrip ? 'Đang chạy chuyến' : 'Sẵn sàng' }}
              </span>
            </div>

            <div class="driver-info-row">
              <span>{{ d.licenseClass }} (Hết hạn: {{ d.licenseExpiryDate }})</span>
              <span>SĐT: {{ d.phone }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Danh sách chuyến xe đã điều phối -->
    <div class="card mt-4">
      <div class="card-header">
        <h3 class="card-title">Danh Sách Các Chuyến Xe Đã Phân Công & Ghép Chuyến</h3>
      </div>

      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th>Mã Chuyến</th>
              <th>Phương Tiện</th>
              <th>Tài Xế Phụ Trách</th>
              <th>Lộ Trình / Tuyến Quy Chuẩn</th>
              <th>Thời Gian Dự Kiến</th>
              <th>Số YC Ghép</th>
              <th>Sản Lượng Mủ (kg)</th>
              <th>Chi Phí & Bằng Chứng</th>
              <th>Trạng Thái</th>
              <th class="text-center">Thao Tác</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="trips.length === 0">
              <td colspan="10" class="text-center py-5 text-muted">
                Chưa có chuyến xe nào được điều phối.
              </td>
            </tr>

            <tr v-for="t in trips" :key="t.id">
              <td>
                <strong>{{ t.tripCode }}</strong>
              </td>
              <td>
                <div class="flex-col">
                  <strong>{{ t.vehiclePlate }}</strong>
                  <span class="text-xs text-muted">{{ getVehicleTypeLabel(t.vehicleType) }}</span>
                </div>
              </td>
              <td>
                <div class="flex-col">
                  <span>{{ t.driverName }}</span>
                  <span class="text-xs text-muted">{{ t.driverPhone }}</span>
                </div>
              </td>
              <td>
                <div class="flex-col">
                  <span>{{ t.routeName }}</span>
                  <span class="text-xs text-muted">{{ t.standardDistanceKm }} km</span>
                </div>
              </td>
              <td>
                <div class="flex-col">
                  <span>{{ t.scheduledStartTime }}</span>
                  <span class="text-xs text-muted">đến {{ t.scheduledEndTime.slice(11) }}</span>
                </div>
              </td>
              <td>
                <span class="badge badge-dispatched">{{ t.requestIds.length }} yêu cầu</span>
              </td>
              <td>
                <strong v-if="t.totalLatexWeightKg" class="text-success">
                  {{ t.totalLatexWeightKg.toLocaleString() }} kg
                </strong>
                <span v-else class="text-muted">—</span>
              </td>
              <td>
                <div v-if="t.expenses && t.expenses.length > 0" class="flex-col">
                  <strong>{{ t.expenses.reduce((acc, e) => acc + (e.amount || 0), 0).toLocaleString() }} đ</strong>
                  <button
                    class="btn-proof-tag mt-1"
                    :class="t.expenses.every((e) => !!e.receiptImage) ? 'proof-full' : 'proof-partial'"
                    @click="viewExpensesTrip = t"
                    title="Xem chi tiết các khoản chi và ảnh chụp hóa đơn bằng chứng"
                  >
                    <Receipt :size="12" />
                    <span>{{ t.expenses.filter((e) => !!e.receiptImage).length }}/{{ t.expenses.length }} Hóa đơn</span>
                  </button>
                </div>
                <span v-else class="text-xs text-muted">0 đ</span>
              </td>
              <td>
                <StatusBadge :status="t.status" />
              </td>
              <td>
                <div class="flex justify-center">
                  <button class="btn btn-icon btn-sm text-primary" @click="editingTrip = t" title="Sửa thông tin điều động">
                    <Edit2 :size="15" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal Ghép chuyến -->
    <BatchTripModal
      v-if="showBatchModal"
      :initial-selected-requests="preselectedRequests"
      @close="showBatchModal = false"
      @dispatched="showBatchModal = false"
    />

    <!-- Modal Sửa Chuyến Xe -->
    <EditTripModal
      v-if="editingTrip"
      :trip="editingTrip"
      @close="editingTrip = null"
      @updated="editingTrip = null"
    />

    <!-- Modal Xem Chi tiết & Thẩm định Bằng chứng Chi phí -->
    <TripExpensesModal
      v-if="viewExpensesTrip"
      :trip="viewExpensesTrip"
      @close="viewExpensesTrip = null"
    />

    <!-- Modal Từ Chối Yêu Cầu Đặt Xe (Dispatcher) -->
    <div v-if="showRejectModal" class="modal-backdrop" @click.self="showRejectModal = false">
      <div class="modal-content modal-md">
        <div class="modal-header">
          <div class="modal-header-title">
            <X :size="20" class="text-danger" />
            <h3 class="modal-title">Từ Chối Yêu Cầu Đặt Xe</h3>
          </div>
          <button class="btn-close" @click="showRejectModal = false">
            <X :size="18" />
          </button>
        </div>
        <div class="modal-body">
          <p class="text-sm mb-3">
            Bạn đang từ chối yêu cầu đặt xe <strong>{{ rejectingRequest?.requestCode }}</strong> của người đặt
            <strong>{{ rejectingRequest?.requesterName }}</strong> ({{ rejectingRequest?.departmentName }}).
          </p>
          <div class="form-group mb-3">
            <label class="form-label required">Lý do từ chối:</label>
            <textarea
              v-model="rejectReason"
              class="form-control"
              rows="3"
              placeholder="Nhập lý do từ chối (ví dụ: Không có xe phù hợp, sai quy chuẩn tuyến đường, trùng lịch sản xuất...)"
            ></textarea>
            <span v-if="rejectError" class="text-danger text-xs mt-1 block">{{ rejectError }}</span>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline btn-sm" @click="showRejectModal = false">Đóng</button>
          <button class="btn btn-danger btn-sm" @click="confirmReject">
            <X :size="14" />
            <span>Xác Nhận Từ Chối</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 12px;
}
.page-title {
  font-size: 1.375rem;
  font-weight: 800;
}
.page-subtitle {
  font-size: 0.8125rem;
  color: var(--text-secondary);
}
.dispatch-board-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}
.board-column {
  display: flex;
  flex-direction: column;
  background: white;
  min-height: 380px;
}
.column-header {
  padding: 14px 16px;
  background: #f8fafc;
  border-bottom: 1px solid var(--border);
}
.column-title {
  font-size: 0.8125rem;
  font-weight: 800;
  color: var(--text-primary);
  letter-spacing: 0.05em;
}
.column-desc {
  font-size: 0.6875rem;
  color: var(--text-muted);
}
.column-body {
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex: 1;
  overflow-y: auto;
  max-height: 480px;
}
.request-card {
  background: #ffffff;
  border: 1px solid var(--border-card);
  border-radius: var(--radius-md);
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  transition: transform 0.15s, box-shadow 0.15s;
}
.request-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-card);
  border-color: var(--primary);
}
.req-card-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.8125rem;
}
.type-pill {
  background: #f1f5f0;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.6875rem;
  font-weight: 600;
  border: 1px solid var(--border-card);
}
.req-card-route {
  font-size: 0.8125rem;
  font-weight: 700;
  color: var(--text-main);
}
.req-card-meta {
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  color: var(--text-muted);
}
.req-card-action {
  margin-top: 4px;
}
.full-w { width: 100%; }

/* Vehicle card */
.vehicle-card {
  background: white;
  border: 1px solid var(--border-card);
  border-radius: var(--radius-md);
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.veh-card-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.veh-id-group {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.875rem;
}
.veh-status-badge {
  font-size: 0.6875rem;
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 700;
}
.veh-status-badge.status-available { background: #dcfce7; color: #15803d; }
.veh-status-badge.status-ontrip { background: #e0f2fe; color: #0369a1; }
.veh-status-badge.status-undermaintenance { background: #fee2e2; color: #b91c1c; }
.veh-desc {
  font-size: 0.75rem;
  color: var(--text-sub);
}
.veh-metrics {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.75rem;
  margin-top: 4px;
}
.maint-alert {
  display: flex;
  align-items: center;
  gap: 4px;
  color: #dc2626;
  font-weight: 700;
  font-size: 0.6875rem;
}

/* Driver card */
.driver-card {
  background: white;
  border: 1px solid var(--border-card);
  border-radius: var(--radius-md);
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.driver-card-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.driver-name-group {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.875rem;
}
.driver-tag {
  font-size: 0.6875rem;
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 700;
}
.tag-free { background: #dcfce7; color: #15803d; }
.tag-busy { background: #fef3c7; color: #b45309; }
.driver-info-row {
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  color: var(--text-secondary);
  margin-top: 4px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 30px 10px;
  color: var(--text-muted);
  font-size: 0.8125rem;
}
.flex-between { display: flex; justify-content: space-between; align-items: center; }
.badge-amber { background: #fef3c7; color: #b45309; }
.badge-blue { background: #dbeafe; color: #1d4ed8; }
.badge-green { background: #dcfce7; color: #15803d; }
.font-bold { font-weight: 700; }
.text-success { color: #16a34a; }
.text-info { color: #0284c7; }
.text-xs { font-size: 0.75rem; }
.text-muted { color: var(--text-muted); }
.flex-col { display: flex; flex-direction: column; }
.mt-4 { margin-top: 16px; }
.py-5 { padding-top: 40px; padding-bottom: 40px; }
.text-center { text-align: center; }
.view-mode-tabs {
  display: inline-flex;
  background: #f1f5f9;
  padding: 4px;
  border-radius: var(--radius-md);
  gap: 4px;
  border: 1px solid var(--border-card);
}
.tab-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: var(--radius-sm);
  border: none;
  background: transparent;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s ease;
}
.tab-btn:hover {
  color: var(--text-primary);
}
.tab-btn.active {
  background: #ffffff;
  color: #15803d;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}
.btn-proof-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.6875rem;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid transparent;
  cursor: pointer;
  width: fit-content;
  transition: all 0.15s;
}
.btn-proof-tag.proof-full {
  background: #dcfce7;
  color: #15803d;
  border-color: #86efac;
}
.btn-proof-tag.proof-full:hover {
  background: #bbf7d0;
}
.btn-proof-tag.proof-partial {
  background: #fef3c7;
  color: #b45309;
  border-color: #fde68a;
}
.btn-proof-tag.proof-partial:hover {
  background: #fde68a;
}

/* Dispatch Alert Banner */
.dispatch-alert-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: var(--radius-md);
  padding: 10px 16px;
  gap: 12px;
}
.alert-banner-left {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 0.8125rem;
  color: #92400e;
}
.text-amber {
  color: #d97706;
}

/* Request Filter Tabs */
.req-filter-tabs {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.btn-filter-pill {
  padding: 3px 8px;
  font-size: 0.6875rem;
  font-weight: 600;
  border-radius: 20px;
  border: 1px solid var(--border-card);
  background: #ffffff;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s ease;
}
.btn-filter-pill:hover {
  border-color: var(--primary);
  color: var(--primary);
}
.btn-filter-pill.active {
  background: var(--primary);
  border-color: var(--primary);
  color: #ffffff;
}
.btn-filter-pill.pill-amber.active {
  background: #d97706;
  border-color: #d97706;
  color: #ffffff;
}
.btn-filter-pill.pill-green.active {
  background: #16a34a;
  border-color: #16a34a;
  color: #ffffff;
}

/* Pending Card Border & Badges */
.request-card.card-pending-border {
  border-left: 3px solid #d97706;
  background: #fffdfa;
}
.req-id-box {
  display: flex;
  align-items: center;
  gap: 6px;
}
.status-badge-pending {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  background: #fef3c7;
  color: #b45309;
  font-size: 0.625rem;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 4px;
}
.status-badge-approved {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  background: #dcfce7;
  color: #15803d;
  font-size: 0.625rem;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 4px;
}
.req-pending-actions {
  display: flex;
  gap: 6px;
  align-items: center;
  flex-wrap: wrap;
}
.btn-xs {
  padding: 4px 8px;
  font-size: 0.6875rem;
  font-weight: 600;
  border-radius: var(--radius-sm);
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.15s;
}
.btn-reject-outline {
  border-color: #fca5a5;
  color: #dc2626;
  background: #fff;
}
.btn-reject-outline:hover {
  background: #fee2e2;
  border-color: #ef4444;
}

/* Modal styles */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}
.modal-content {
  background: #ffffff;
  border-radius: var(--radius-lg);
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  width: 100%;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
}
.modal-md {
  max-width: 480px;
}
.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
}
.modal-header-title {
  display: flex;
  align-items: center;
  gap: 8px;
}
.modal-title {
  font-size: 1rem;
  font-weight: 700;
  margin: 0;
}
.btn-close {
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  border-radius: var(--radius-sm);
}
.btn-close:hover {
  background: #f1f5f9;
  color: var(--text-primary);
}
.modal-body {
  padding: 20px;
  overflow-y: auto;
}
.modal-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  padding: 12px 20px;
  border-top: 1px solid var(--border);
  background: #f8fafc;
}
.block {
  display: block;
}
.text-danger {
  color: #dc2626;
}

@media (max-width: 1024px) {
  .dispatch-board-grid { grid-template-columns: 1fr; }
}
</style>
