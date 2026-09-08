<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useBookingStore } from '@/stores/booking';
import { useDispatchStore } from '@/stores/dispatch';
import { useFleetStore } from '@/stores/fleet';
import type { TransportRequest } from '@/types';
import StatusBadge from '@/components/common/StatusBadge.vue';
import BatchTripModal from '@/components/dispatch/BatchTripModal.vue';
import FleetDispatchMap from '@/components/dispatch/FleetDispatchMap.vue';
import TripExpensesModal from '@/components/common/TripExpensesModal.vue';
import { Layers, Truck, UserCheck, AlertCircle, Plus, CheckCircle2, MapPin, LayoutGrid, Receipt } from 'lucide-vue-next';

const route = useRoute();
const router = useRouter();
const bookingStore = useBookingStore();
const dispatchStore = useDispatchStore();
const fleetStore = useFleetStore();
const viewExpensesTrip = ref<any>(null);

// Chế độ xem: 'map' (Bản đồ & Lộ trình GPS) hoặc 'board' (Bảng thẻ Kanban 3 cột)
const viewMode = ref<'map' | 'board'>((route.query.view as string) === 'board' ? 'board' : 'map');

watch(
  () => route.query.view,
  (newVal) => {
    viewMode.value = newVal === 'board' ? 'board' : 'map';
  }
);

function switchView(mode: 'map' | 'board') {
  viewMode.value = mode;
  router.replace({ query: { ...route.query, view: mode } });
}

const showBatchModal = ref(false);
const preselectedRequests = ref<TransportRequest[]>([]);

// Danh sách yêu cầu chờ điều phối (APPROVED)
const pendingDispatchRequests = computed(() => bookingStore.approvedRequests);

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
    case 'Truck':
      return 'Xe tải';
    case 'Pickup':
      return 'Bán tải';
    case 'Excavator':
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
    <FleetDispatchMap v-if="viewMode === 'map'" />

    <!-- 2. CHẾ ĐỘ XEM BẢNG THẺ 3 CỘT (KANBAN) -->
    <div v-else class="dispatch-board-grid">
      <!-- Cột 1: Yêu cầu chờ điều phối -->
      <div class="board-column card">
        <div class="column-header">
          <div class="flex-between">
            <span class="column-title">YÊU CẦU CHỜ GÁN</span>
            <span class="badge badge-amber">{{ pendingDispatchRequests.length }}</span>
          </div>
          <span class="column-desc">Đã được phê duyệt, chờ xếp xe</span>
        </div>

        <div class="column-body">
          <div v-if="pendingDispatchRequests.length === 0" class="empty-state">
            <CheckCircle2 :size="24" class="text-success" />
            <span>Tất cả yêu cầu đã được điều phối!</span>
          </div>

          <div
            v-for="req in pendingDispatchRequests"
            :key="req.id"
            class="request-card"
          >
            <div class="req-card-top">
              <strong>{{ req.requestCode }}</strong>
              <span class="type-pill">{{ getVehicleTypeLabel(req.vehicleType) }}</span>
            </div>

            <div class="req-card-route">
              {{ req.fromLocation }} ➔ {{ req.toLocation }}
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

            <div class="req-card-action">
              <button class="btn btn-secondary btn-sm full-w" @click="openBatchWithRequest(req)">
                <Plus :size="14" />
                <span>Gán chuyến / Ghép</span>
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

            <div class="veh-metrics">
              <span v-if="v.vehicleType !== 'Excavator'">
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
            </tr>
          </thead>
          <tbody>
            <tr v-if="trips.length === 0">
              <td colspan="9" class="text-center py-5 text-muted">
                Chưa có chuyến xe nào được điều phối.
              </td>
            </tr>

            <tr v-for="t in trips" :key="t.id">
              <td><strong>{{ t.tripCode }}</strong></td>
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

    <!-- Modal Xem Chi tiết & Thẩm định Bằng chứng Chi phí -->
    <TripExpensesModal
      v-if="viewExpensesTrip"
      :trip="viewExpensesTrip"
      @close="viewExpensesTrip = null"
    />
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

@media (max-width: 1024px) {
  .dispatch-board-grid { grid-template-columns: 1fr; }
}
</style>
