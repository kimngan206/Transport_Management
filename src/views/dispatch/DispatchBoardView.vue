<script setup lang="ts">
// Điều Phối & Ghép Chuyến Xe (Single Trip Dispatch Inline)
import { ref, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useBookingStore } from '@/stores/booking';
import { useDispatchStore } from '@/stores/dispatch';
import { useFleetStore } from '@/stores/fleet';
import { useDialogStore } from '@/stores/dialog';
import type { TransportRequest, TransportTrip } from '@/types';
import StatusBadge from '@/components/common/StatusBadge.vue';
import SingleTripDispatchForm from '@/components/dispatch/SingleTripDispatchForm.vue';
import FleetDispatchMap from '@/components/dispatch/FleetDispatchMap.vue';
import TripExpensesModal from '@/components/common/TripExpensesModal.vue';
import EditTripModal from '@/components/dispatch/EditTripModal.vue';
import {
  Truck,
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

const dispatchingRequest = ref<TransportRequest | null>(null);

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
  dispatchingRequest.value = req;
  if (viewMode.value === 'map') {
    viewMode.value = 'board';
  }
}

function onInlineTripDispatched() {
  dispatchingRequest.value = null;
}

// Kiểm tra chuyến xe có đang bị ảnh hưởng bởi sự cố phương tiện dọc đường không
function getTripIncident(trip: TransportTrip) {
  // Chỉ kiểm tra các chuyến xe ĐANG HOẠT ĐỘNG (chưa hoàn thành)
  if (trip.status === 'COMPLETED' || trip.status === 'CANCELLED') {
    return null;
  }
  // Nếu chuyến đã được điều xe cứu viện thay thế thì coi như đã được xử lý
  if (trip.replacementInfo?.isRescueTrip) {
    return null;
  }
  const inc = fleetStore.incidents.find(
    (i) => (i.vehicleId === trip.vehicleId || i.vehiclePlate === trip.vehiclePlate) && i.status !== 'Resolved'
  );
  if (inc) return inc;
  const veh = fleetStore.vehicles.find((v) => v.id === trip.vehicleId);
  if (veh && (veh.status === 'Broken' || veh.status === 'UnderMaintenance')) {
    return {
      issueDescription: 'Phương tiện đang hỏng hóc / bảo dưỡng',
      severity: 'StopOperation',
      locationGps: undefined,
    } as any;
  }
  return null;
}

const tripsWithIncidents = computed(() => {
  return trips.value.filter((t) => {
    if (t.status === 'COMPLETED' || t.status === 'CANCELLED') return false;
    return !!getTripIncident(t);
  });
});

// Bộ lọc trạng thái cho bảng danh sách chuyến xe
const tripStatusFilter = ref<'ALL' | 'ACTIVE' | 'COMPLETED'>('ALL');

const activeTripsCount = computed(
  () => trips.value.filter((t) => t.status !== 'COMPLETED' && t.status !== 'CANCELLED').length
);

const completedTripsCount = computed(
  () => trips.value.filter((t) => t.status === 'COMPLETED').length
);

const displayedTrips = computed(() => {
  if (tripStatusFilter.value === 'ACTIVE') {
    return trips.value.filter((t) => t.status !== 'COMPLETED' && t.status !== 'CANCELLED');
  }
  if (tripStatusFilter.value === 'COMPLETED') {
    return trips.value.filter((t) => t.status === 'COMPLETED');
  }
  return trips.value;
});

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
  const t = (type || '').toLowerCase();
  switch (t) {
    case 'latextruck':
    case 'truck':
      return 'Xe tải';
    case 'passengercar':
    case 'pickup':
      return 'Bán tải';
    case 'millingmachine':
    case 'excavator':
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
          Điều phối viên duyệt yêu cầu, gán phương tiện, tài xế và kiểm soát lộ trình vận chuyển mủ cao su
        </p>
      </div>
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
        <span>Bảng Yêu Cầu Chờ Ghép Xe</span>
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

    <!-- 2. BẢNG DANH SÁCH YÊU CẦU ĐẶT XE & CHỜ ĐIỀU PHỐI / KHỐI GHÉP XE TRỰC TIẾP -->
    <div v-else>
      <!-- Khối Thiết Lập Điều Phối & Ghép Xe Trực Tiếp (Không dùng modal popup) -->
      <SingleTripDispatchForm
        v-if="dispatchingRequest"
        :request="dispatchingRequest"
        @close="dispatchingRequest = null"
        @dispatched="onInlineTripDispatched"
      />

      <!-- Bảng danh sách yêu cầu đặt xe khi không ở chế độ ghép xe -->
      <div v-else class="card requests-table-card">
      <div class="card-header requests-table-header">
        <div class="requests-header-left">
          <div class="requests-title-row">
            <h3 class="card-title">Danh Sách Yêu Cầu Đặt Xe Chờ Điều Phối</h3>
            <span class="badge" :class="pendingApprovalRequests.length > 0 ? 'badge-amber' : 'badge-blue'">
              {{ allActionableRequests.length }} yêu cầu
            </span>
          </div>
          <span class="text-xs text-muted">
            Điều phối viên duyệt yêu cầu và gán xe / điều động chuyến vận chuyển mủ cho từng đơn
          </span>
        </div>

        <div class="requests-header-right">
          <!-- Bộ lọc tab nhanh -->
          <div class="req-filter-tabs">
            <button
              class="btn-filter-pill"
              :class="{ active: filterReqStatus === 'ALL' }"
              @click="filterReqStatus = 'ALL'"
            >
              <span>Tất cả</span>
              <span class="count-badge">{{ allActionableRequests.length }}</span>
            </button>
            <button
              class="btn-filter-pill pill-amber"
              :class="{ active: filterReqStatus === 'PENDING' }"
              @click="filterReqStatus = 'PENDING'"
            >
              <span>Chờ duyệt</span>
              <span class="count-badge count-pending">{{ pendingApprovalRequests.length }}</span>
            </button>
            <button
              class="btn-filter-pill pill-green"
              :class="{ active: filterReqStatus === 'APPROVED' }"
              @click="filterReqStatus = 'APPROVED'"
            >
              <span>Đã duyệt</span>
              <span class="count-badge count-approved">{{ approvedRequests.length }}</span>
            </button>
          </div>
        </div>
      </div>

      <div class="table-container">
        <table class="table requests-data-table">
          <thead>
            <tr>
              <th style="width: 175px;">Mã Yêu Cầu</th>
              <th style="min-width: 250px;">Lộ Trình / Tuyến Vận Chuyển</th>
              <th style="width: 155px;">Thời Gian Cần Xe</th>
              <th style="width: 110px;">Loại Xe</th>
              <th style="width: 140px;">Khối Lượng / Người</th>
              <th style="width: 190px;">Người Đặt & Đơn Vị</th>
              <th style="min-width: 160px;">Mục Đích</th>
              <th style="width: 120px;" class="text-center">Thao Tác</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="displayedRequests.length === 0">
              <td colspan="8" class="text-center py-6 text-muted">
                <div class="empty-state">
                  <CheckCircle2 :size="28" class="text-success mb-1" />
                  <span class="font-medium text-slate-600">Không có yêu cầu nào trong danh mục này!</span>
                  <span class="text-xs text-muted">Tất cả yêu cầu đã được xếp xe hoặc chưa có đơn đặt mới.</span>
                </div>
              </td>
            </tr>

            <tr
              v-for="req in displayedRequests"
              :key="req.id"
              :class="{ 'row-pending-req': req.status === 'PENDING' }"
            >
              <!-- Mã YC & Trạng thái duyệt -->
              <td class="whitespace-nowrap">
                <div class="req-code-box">
                  <span class="req-code-text font-mono font-bold">{{ req.requestCode }}</span>
                  <span v-if="req.status === 'PENDING'" class="status-badge-pending mt-1">
                    <Clock :size="10" />
                    <span>Chờ duyệt</span>
                  </span>
                  <span v-else class="status-badge-approved mt-1">
                    <Check :size="10" />
                    <span>Đã duyệt</span>
                  </span>
                </div>
              </td>

              <!-- Lộ trình -->
              <td>
                <div class="req-route-cell">
                  <strong class="text-slate-800">{{ req.fromLocation }}</strong>
                  <span class="route-arrow-icon">➔</span>
                  <strong class="text-slate-800">{{ req.toLocation }}</strong>
                </div>
              </td>

              <!-- Thời gian cần xe -->
              <td>
                <div class="cell-stacked">
                  <span class="font-semibold text-slate-800 text-xs">{{ req.startTime.slice(0, 10) }}</span>
                  <span class="text-xs text-muted">{{ req.startTime.slice(11) }} - {{ req.endTime.slice(11) }}</span>
                </div>
              </td>

              <!-- Loại xe yêu cầu -->
              <td>
                <span class="type-pill">{{ getVehicleTypeLabel(req.vehicleType) }}</span>
              </td>

              <!-- Khối lượng mủ / Số người -->
              <td>
                <strong v-if="req.estimatedWeightKg" class="text-success text-xs font-bold block">
                  {{ req.estimatedWeightKg.toLocaleString() }} kg mủ
                </strong>
                <strong v-if="req.passengersCount" class="text-info text-xs font-bold block">
                  {{ req.passengersCount }} người
                </strong>
                <span v-if="!req.estimatedWeightKg && !req.passengersCount" class="text-muted">—</span>
              </td>

              <!-- Người đặt & đơn vị -->
              <td>
                <div class="cell-stacked">
                  <strong class="text-slate-800 text-xs">{{ req.requesterName }}</strong>
                  <span class="text-xs text-muted">{{ req.departmentName }}</span>
                </div>
              </td>

              <!-- Mục đích -->
              <td>
                <span class="text-xs text-slate-600 line-clamp-2" :title="req.purpose">
                  {{ req.purpose || '—' }}
                </span>
              </td>

              <!-- Thao tác -->
              <td class="text-center whitespace-nowrap">
                <button
                  class="btn-row-batch"
                  @click="openBatchWithDirectApprove(req)"
                  title="Ghép chuyến cho yêu cầu này"
                >
                  <Plus :size="13" />
                  <span>Ghép Xe</span>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    </div>

    <!-- Danh sách chuyến xe đã điều phối -->
    <div class="card mt-4 trips-table-card">
      <div class="card-header trips-table-header">
        <div class="trips-header-left">
          <h3 class="card-title">Danh Sách Các Chuyến Xe Đã Phân Công & Ghép Chuyến</h3>
          <span class="text-xs text-muted">Theo dõi lịch trình, lộ trình chuẩn hóa, chi phí chứng từ và trạng thái vận hành</span>
        </div>
        <div class="trips-filter-tabs">
          <button
            class="filter-tab-pill"
            :class="{ active: tripStatusFilter === 'ALL' }"
            @click="tripStatusFilter = 'ALL'"
          >
            <span>Tất cả</span>
            <span class="count-badge">{{ trips.length }}</span>
          </button>
          <button
            class="filter-tab-pill pill-active"
            :class="{ active: tripStatusFilter === 'ACTIVE' }"
            @click="tripStatusFilter = 'ACTIVE'"
          >
            <span>Đang chạy / Chờ chạy</span>
            <span class="count-badge count-active">{{ activeTripsCount }}</span>
          </button>
          <button
            class="filter-tab-pill pill-completed"
            :class="{ active: tripStatusFilter === 'COMPLETED' }"
            @click="tripStatusFilter = 'COMPLETED'"
          >
            <span>Đã hoàn thành</span>
            <span class="count-badge count-completed">{{ completedTripsCount }}</span>
          </button>
        </div>
      </div>

      <!-- Banner cảnh báo sự cố dọc đường cần điều xe thay thế -->
      <div v-if="tripsWithIncidents.length > 0" class="incident-dispatch-banner">
        <div class="banner-left">
          <span class="banner-pulse">🚨</span>
          <div>
            <div class="banner-title">
              Cảnh báo sự cố dọc đường: Có {{ tripsWithIncidents.length }} chuyến xe đang chạy gặp sự cố!
            </div>
            <div class="banner-sub">
              Phương tiện nổ lốp / hỏng máy làm gián đoạn lịch trình. Điều phối viên vui lòng bấm <strong>"Đổi xe khác"</strong> để cử phương tiện thay thế kịp thời, không làm trễ cam kết giao nhận mủ.
            </div>
          </div>
        </div>
        <div class="banner-btns">
          <button
            v-for="t in tripsWithIncidents"
            :key="t.id"
            class="btn btn-xs btn-danger flex items-center gap-1.5 font-bold shadow-sm"
            @click="editingTrip = t"
          >
            <Truck :size="14" />
            <span>Đổi xe cho chuyến {{ t.tripCode }} ({{ t.vehiclePlate }})</span>
          </button>
        </div>
      </div>

      <div class="table-container">
        <table class="table trips-compact-table">
          <thead>
            <tr>
              <th style="width: 170px;">Mã Chuyến & Phương Tiện</th>
              <th style="width: 160px;">Tài Xế Phụ Trách</th>
              <th style="min-width: 180px;">Lộ Trình / Tuyến Quy Chuẩn</th>
              <th style="width: 150px;">Thời Gian</th>
              <th style="width: 140px;">Sản Lượng Mủ</th>
              <th style="width: 150px;">Chi Phí & Hóa Đơn</th>
              <th style="width: 130px;">Trạng Thái</th>
              <th style="width: 110px;" class="text-center">Thao Tác</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="displayedTrips.length === 0">
              <td colspan="8" class="text-center py-5 text-muted">
                Không tìm thấy chuyến xe nào phù hợp với bộ lọc.
              </td>
            </tr>

            <tr
              v-for="t in displayedTrips"
              :key="t.id"
              :class="{ 'trip-incident-row': !!getTripIncident(t) }"
            >
              <td class="col-trip-veh">
                <div class="trip-code-box">
                  <span class="trip-code-badge">{{ t.tripCode }}</span>
                  <span v-if="t.replacementInfo?.isRescueTrip" class="badge-rescue" title="Chuyến xe cứu viện thay thế">Cứu viện</span>
                </div>
                <div class="veh-info-sub">
                  <strong class="veh-plate-text">{{ t.vehiclePlate }}</strong>
                  <span class="veh-type-text">{{ getVehicleTypeLabel(t.vehicleType) }}</span>
                </div>
                <div
                  v-if="getTripIncident(t)"
                  class="trip-incident-pill mt-1"
                  :title="getTripIncident(t)?.issueDescription"
                >
                  <AlertCircle :size="11" />
                  <span>{{ getTripIncident(t)?.issueDescription || 'Sự cố dọc đường' }}</span>
                </div>
              </td>
              <td class="col-driver">
                <div class="driver-name-text">{{ t.driverName }}</div>
                <div class="driver-phone-sub text-muted font-mono">{{ t.driverPhone }}</div>
              </td>
              <td class="col-route">
                <div class="route-name-text" :title="t.routeName">{{ t.routeName }}</div>
                <span class="route-distance-sub text-muted">{{ t.standardDistanceKm }} km</span>
              </td>
              <td class="col-time">
                <div class="time-primary">{{ t.scheduledStartTime }}</div>
                <div class="time-sub text-muted">đến {{ t.scheduledEndTime.slice(11) }}</div>
              </td>
              <td class="col-load">
                <span class="badge badge-dispatched">{{ t.requestIds.length }} yêu cầu</span>
                <div class="latex-weight-text mt-1">
                  <strong v-if="t.totalLatexWeightKg" class="text-success">
                    {{ t.totalLatexWeightKg.toLocaleString() }} kg
                  </strong>
                  <span v-else class="text-muted">—</span>
                </div>
              </td>
              <td class="col-expense">
                <div v-if="t.expenses && t.expenses.length > 0" class="flex-col">
                  <span class="font-bold text-slate-700">{{ t.expenses.reduce((acc, e) => acc + (e.amount || 0), 0).toLocaleString() }} đ</span>
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
              <td class="col-status">
                <StatusBadge :status="t.status" />
              </td>
              <td class="col-action text-center">
                <div class="flex items-center justify-center gap-1">
                  <button
                    v-if="getTripIncident(t)"
                    class="btn btn-xs btn-danger flex items-center gap-1 font-bold whitespace-nowrap shadow-sm"
                    @click="editingTrip = t"
                    title="Phương tiện gặp sự cố! Bấm để điều xe khác thay thế ngay"
                  >
                    <Truck :size="13" />
                    <span>Đổi xe khác</span>
                  </button>
                  <button
                    v-else
                    class="btn btn-icon btn-sm text-primary hover-btn-edit"
                    @click="editingTrip = t"
                    title="Sửa thông tin điều động"
                  >
                    <Edit2 :size="15" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>



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
/* Requests Table Card & Elements */
.requests-table-card {
  margin-bottom: 24px;
}
.requests-table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
  padding: 18px 24px;
}
.requests-header-left {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.requests-title-row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.requests-title-row .card-title {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 700;
  color: #0f172a;
  white-space: nowrap;
}
.requests-header-right {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}
.requests-data-table th {
  padding: 14px 20px;
  font-size: 0.775rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: #64748b;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
  white-space: nowrap;
}
.requests-data-table td {
  padding: 18px 20px;
  font-size: 0.8125rem;
  vertical-align: middle;
  border-bottom: 1px solid #f1f5f9;
  line-height: 1.6;
}
.requests-data-table tr:hover {
  background-color: #f8fafc;
}
.row-pending-req {
  background-color: #fffdfa;
}
.cell-stacked {
  display: flex;
  flex-direction: column;
  gap: 5px;
  line-height: 1.45;
}
.req-code-box {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 7px;
  white-space: nowrap;
}
.req-code-text {
  font-size: 0.8125rem;
  font-weight: 700;
  color: #0f172a;
  white-space: nowrap !important;
  display: block;
}
.req-route-cell {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  line-height: 1.5;
  flex-wrap: wrap;
  padding: 2px 0;
}
.route-arrow-icon {
  color: #94a3b8;
  font-size: 0.75rem;
  flex-shrink: 0;
}
.btn-row-batch {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 13px;
  font-size: 0.75rem;
  font-weight: 700;
  border-radius: 6px;
  background: #f0fdf4;
  color: #15803d;
  border: 1px solid #86efac;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}
.btn-row-batch:hover {
  background: #16a34a;
  color: #ffffff;
  border-color: #16a34a;
  box-shadow: 0 2px 6px rgba(22, 163, 74, 0.25);
}

.req-actions-bar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  white-space: nowrap;
}

.btn-act {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 5px 9px;
  font-size: 0.75rem;
  font-weight: 600;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
  line-height: 1.2;
  border: 1px solid transparent;
  white-space: nowrap;
}

.btn-act-approve {
  background: #ecfdf5;
  color: #15803d;
  border-color: #86efac;
}
.btn-act-approve:hover {
  background: #16a34a;
  color: #ffffff;
  border-color: #16a34a;
  box-shadow: 0 2px 4px rgba(22, 163, 74, 0.2);
}

.btn-act-batch {
  background: #eff6ff;
  color: #1d4ed8;
  border-color: #bfdbfe;
  font-weight: 700;
}
.btn-act-batch:hover {
  background: #2563eb;
  color: #ffffff;
  border-color: #2563eb;
  box-shadow: 0 2px 4px rgba(37, 99, 235, 0.25);
}

.btn-act-reject {
  background: #fff1f2;
  color: #e11d48;
  border-color: #fecdd3;
  padding: 5px 7px;
}
.btn-act-reject:hover {
  background: #e11d48;
  color: #ffffff;
  border-color: #e11d48;
}
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.type-pill {
  background: #f1f5f9;
  color: #334155;
  padding: 3px 8px;
  border-radius: 6px;
  font-size: 0.6875rem;
  font-weight: 700;
  border: 1px solid #e2e8f0;
  white-space: nowrap;
}
.animate-pulse-subtle {
  animation: pulseSubtle 1.8s infinite ease-in-out;
}
@keyframes pulseSubtle {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.02); }
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
  margin-bottom: 22px;
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
/* Request Filter Tabs */
.req-filter-tabs {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: #f1f5f9;
  padding: 3px;
  border-radius: 8px;
  border: 1px solid var(--border-card);
}
.btn-filter-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  font-size: 0.75rem;
  font-weight: 600;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}
.btn-filter-pill:hover {
  color: var(--text-primary);
}
.btn-filter-pill.active {
  background: #ffffff;
  color: var(--text-primary);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}
.btn-filter-pill.pill-amber.active {
  color: #b45309;
}
.btn-filter-pill.pill-green.active {
  color: #15803d;
}
.btn-filter-pill .count-badge {
  font-size: 0.6875rem;
  padding: 1px 6px;
  border-radius: 999px;
  background: #e2e8f0;
  color: var(--text-secondary);
  font-weight: 700;
}
.btn-filter-pill.active .count-badge {
  background: #f1f5f9;
}
.btn-filter-pill.pill-amber.active .count-badge {
  background: #fef3c7;
  color: #b45309;
}
.btn-filter-pill.pill-green.active .count-badge {
  background: #dcfce7;
  color: #15803d;
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

/* Cảnh báo sự cố điều vận */
.incident-dispatch-banner {
  background: #fef2f2;
  border: 1.5px solid #f87171;
  border-radius: var(--radius-md);
  padding: 12px 16px;
  margin: 12px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  box-shadow: 0 2px 6px rgba(220, 38, 38, 0.08);
}
.banner-left {
  display: flex;
  align-items: center;
  gap: 12px;
}
.banner-pulse {
  font-size: 1.5rem;
  animation: pulse 1.5s infinite;
}
.banner-title {
  font-size: 0.875rem;
  font-weight: 700;
  color: #991b1b;
}
.banner-sub {
  font-size: 0.775rem;
  color: #7f1d1d;
  margin-top: 2px;
}
.banner-btns {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}
.trip-incident-row {
  background-color: #fffbfb !important;
  box-shadow: inset 3px 0 0 #ef4444 !important;
}
.trip-incident-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: #fee2e2;
  color: #b91c1c;
  border: 1px solid #fca5a5;
  font-size: 0.6875rem;
  font-weight: 600;
  padding: 2px 7px;
  border-radius: 9999px;
  max-width: 170px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Trips Table Compact & Compound Styles */
.trips-table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  padding: 14px 18px;
}
.trips-header-left {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.trips-filter-tabs {
  display: flex;
  gap: 6px;
  background: #f1f5f9;
  padding: 3px;
  border-radius: 8px;
  border: 1px solid var(--border-card);
}
.filter-tab-pill {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border-radius: 6px;
  border: none;
  background: transparent;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s ease;
}
.filter-tab-pill:hover {
  color: var(--text-primary);
}
.filter-tab-pill.active {
  background: #ffffff;
  color: var(--text-primary);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}
.filter-tab-pill.pill-active.active {
  color: #0369a1;
}
.filter-tab-pill.pill-completed.active {
  color: #15803d;
}
.count-badge {
  font-size: 0.6875rem;
  padding: 1px 6px;
  border-radius: 999px;
  background: #e2e8f0;
  color: var(--text-secondary);
  font-weight: 700;
}
.filter-tab-pill.active .count-badge {
  background: #f1f5f9;
}
.count-active {
  background: #e0f2fe;
  color: #0369a1;
}
.count-completed {
  background: #dcfce7;
  color: #15803d;
}

.trips-compact-table th {
  padding: 10px 14px;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: #64748b;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
  white-space: nowrap;
}
.trips-compact-table td {
  padding: 11px 14px;
  font-size: 0.8125rem;
  vertical-align: middle;
  border-bottom: 1px solid #f1f5f9;
}
.trips-compact-table tr:hover:not(.trip-incident-row) {
  background-color: #f8fafc;
}

.trip-code-box {
  display: flex;
  align-items: center;
  gap: 4px;
}
.trip-code-badge {
  font-size: 0.75rem;
  font-weight: 700;
  color: #1e293b;
  background: #f1f5f9;
  padding: 2px 7px;
  border-radius: 5px;
  border: 1px solid #e2e8f0;
  font-family: var(--font-mono, monospace);
  display: inline-block;
  white-space: nowrap;
}
.badge-rescue {
  font-size: 0.625rem;
  font-weight: 700;
  color: #d97706;
  background: #fef3c7;
  border: 1px solid #fde68a;
  padding: 1px 5px;
  border-radius: 4px;
  white-space: nowrap;
}
.veh-info-sub {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 3px;
  white-space: nowrap;
}
.veh-plate-text {
  font-size: 0.8125rem;
  color: #0f172a;
}
.veh-type-text {
  font-size: 0.6875rem;
  color: var(--text-muted);
}
.driver-name-text {
  font-weight: 600;
  color: #1e293b;
  white-space: nowrap;
}
.driver-phone-sub {
  font-size: 0.6875rem;
  margin-top: 1px;
}
.route-name-text {
  font-weight: 600;
  color: #334155;
  max-width: 240px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.route-distance-sub {
  font-size: 0.6875rem;
  display: inline-block;
  margin-top: 1px;
}
.time-primary {
  font-weight: 600;
  color: #1e293b;
  font-size: 0.75rem;
  white-space: nowrap;
}
.time-sub {
  font-size: 0.6875rem;
  white-space: nowrap;
}
.latex-weight-text {
  font-size: 0.75rem;
}
.hover-btn-edit:hover {
  background: #f1f5f9;
  border-radius: 6px;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.15); opacity: 0.85; }
}

@media (max-width: 1024px) {
  .dispatch-board-grid { grid-template-columns: 1fr; }
  .incident-dispatch-banner { flex-direction: column; align-items: flex-start; }
}
</style>
