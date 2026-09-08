<script setup lang="ts">
import { ref, computed } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { useDriverStore } from '@/stores/driver';
import type { TransportTrip } from '@/types';
import StatusBadge from '@/components/common/StatusBadge.vue';
import StartTripModal from '@/components/driver/StartTripModal.vue';
import CompleteTripModal from '@/components/driver/CompleteTripModal.vue';
import ReportArrivedModal from '@/components/driver/ReportArrivedModal.vue';
import TripExpenseAddModal from '@/components/driver/TripExpenseAddModal.vue';
import TripExpensesModal from '@/components/common/TripExpensesModal.vue';
import {
  Car,
  Play,
  CheckCircle,
  CheckCircle2,
  Calendar,
  MapPin,
  Gauge,
  Clock,
  Navigation,
  Receipt,
  PlusCircle,
} from 'lucide-vue-next';

const authStore = useAuthStore();
const driverStore = useDriverStore();

const activeStartTrip = ref<TransportTrip | null>(null);
const activeCompleteTrip = ref<TransportTrip | null>(null);
const activeArriveTrip = ref<TransportTrip | null>(null);
const activeExpenseTrip = ref<TransportTrip | null>(null);
const viewExpensesTrip = ref<TransportTrip | null>(null);
const actionToast = ref<string | null>(null);

let toastTimer: any = null;
function showToast(msg: string) {
  actionToast.value = msg;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    actionToast.value = null;
  }, 4000);
}

function handleAcceptTrip(trip: TransportTrip) {
  const res = driverStore.acceptTrip(trip.id);
  if (res.success) {
    showToast(res.message);
  } else {
    alert(res.message);
  }
}

const myTrips = computed(() => driverStore.myTrips);

const pendingOrRunningTrips = computed(() =>
  myTrips.value.filter(
    (t) =>
      t.status === 'ASSIGNED' ||
      t.status === 'ACCEPTED' ||
      t.status === 'INPROGRESS' ||
      t.status === 'ARRIVED'
  )
);

const finishedTrips = computed(() =>
  myTrips.value.filter((t) => t.status === 'COMPLETED')
);
</script>

<template>
  <div class="driver-page">
    <div class="page-header">
      <div>
        <h1 class="page-title">Không Gian Tài Xế — Chuyến Của Tôi</h1>
        <p class="page-subtitle">
          Tài xế: <strong>{{ authStore.currentUser.fullName }}</strong> ({{ authStore.currentUser.phone }})
          — Nhận chuyến, báo cáo đến nơi, ghi nhận ODO và sản lượng mủ vận chuyển
        </p>
      </div>
    </div>

    <!-- Thông báo realtime dạng Toast Banner khi thao tác -->
    <transition name="fade">
      <div v-if="actionToast" class="action-toast-banner">
        <CheckCircle2 :size="18" class="text-success" />
        <span>{{ actionToast }}</span>
      </div>
    </transition>

    <!-- 1. Danh sách Chuyến đang chờ chạy hoặc Đang chạy -->
    <div class="section-title-wrap mb-3">
      <h3 class="section-heading text-primary">Chuyến Xe Đang Thực Hiện / Phân Công Hôm Nay</h3>
      <span class="badge badge-green">{{ pendingOrRunningTrips.length }} chuyến</span>
    </div>

    <div v-if="pendingOrRunningTrips.length === 0" class="card empty-card mb-4">
      <Car :size="36" class="text-muted" />
      <span class="font-bold">Hiện không có chuyến xe nào được phân công cho bạn.</span>
      <span class="text-sm text-muted">Vui lòng chờ Điều phối viên xếp lịch hoặc chuyển vai trò để kiểm thử các luồng khác.</span>
    </div>

    <div v-else class="trip-cards-grid mb-4">
      <div
        v-for="trip in pendingOrRunningTrips"
        :key="trip.id"
        class="card trip-card"
        :class="{
          'border-assigned': trip.status === 'ASSIGNED',
          'border-accepted': trip.status === 'ACCEPTED',
          'border-running': trip.status === 'INPROGRESS',
          'border-arrived': trip.status === 'ARRIVED',
        }"
      >
        <div class="trip-card-header">
          <div class="trip-code-box">
            <span class="trip-code">{{ trip.tripCode }}</span>
            <StatusBadge :status="trip.status" />
          </div>
          <span class="veh-plate-badge">{{ trip.vehiclePlate }} ({{ trip.vehicleType }})</span>
        </div>

        <!-- Thanh tiến trình vòng đời chuyến xe 4 bước -->
        <div class="lifecycle-stepper">
          <div
            class="step-item"
            :class="{
              active: trip.status === 'ASSIGNED',
              done: trip.status !== 'ASSIGNED',
            }"
          >
            <span class="step-num">1</span>
            <span class="step-label">Điều phối</span>
          </div>
          <div class="step-line" :class="{ filled: trip.status !== 'ASSIGNED' }"></div>
          <div
            class="step-item"
            :class="{
              active: trip.status === 'ACCEPTED',
              done: trip.status === 'INPROGRESS' || trip.status === 'ARRIVED',
            }"
          >
            <span class="step-num">2</span>
            <span class="step-label">Đã nhận</span>
          </div>
          <div
            class="step-line"
            :class="{ filled: trip.status === 'INPROGRESS' || trip.status === 'ARRIVED' }"
          ></div>
          <div
            class="step-item"
            :class="{
              active: trip.status === 'INPROGRESS',
              done: trip.status === 'ARRIVED',
            }"
          >
            <span class="step-num">3</span>
            <span class="step-label">Xuất bến</span>
          </div>
          <div class="step-line" :class="{ filled: trip.status === 'ARRIVED' }"></div>
          <div
            class="step-item"
            :class="{
              active: trip.status === 'ARRIVED',
            }"
          >
            <span class="step-num">4</span>
            <span class="step-label">Đến nơi</span>
          </div>
        </div>

        <div class="trip-card-body">
          <div class="trip-info-line">
            <MapPin :size="15" class="icon-muted" />
            <span class="font-bold">{{ trip.routeName }}</span>
          </div>

          <div class="trip-info-line">
            <Calendar :size="15" class="icon-muted" />
            <span>Giờ dự kiến: {{ trip.scheduledStartTime }} ➔ {{ trip.scheduledEndTime.slice(11) }}</span>
          </div>

          <div class="trip-info-line">
            <Gauge :size="15" class="icon-muted" />
            <span>
              Cự ly chuẩn: <strong>{{ trip.standardDistanceKm }} km</strong>
              <span v-if="trip.startOdo" class="ml-2">| ODO xuất bến: <strong>{{ trip.startOdo.toLocaleString() }} km</strong></span>
            </span>
          </div>

          <!-- Dòng thông báo nhật ký trạng thái chuyến -->
          <div v-if="trip.acceptedAt" class="trip-timeline-tag text-cyan">
            <Clock :size="13" />
            <span>Tài xế đã nhận lệnh lúc: <strong>{{ trip.acceptedAt.slice(11) }}</strong></span>
          </div>
          <div v-if="trip.arrivedAt" class="trip-timeline-tag text-amber">
            <Navigation :size="13" />
            <span>
              Đã đến điểm chỉ định lúc: <strong>{{ trip.arrivedAt.slice(11) }}</strong>
              <span v-if="trip.arrivalNote"> — "{{ trip.arrivalNote }}"</span>
            </span>
          </div>

          <!-- Khu vực kê khai chi phí phát sinh & Bằng chứng xác minh trong chuyến -->
          <div v-if="trip.status !== 'ASSIGNED'" class="trip-expense-summary-strip">
            <div class="expense-strip-left">
              <Receipt :size="15" class="text-primary" />
              <div class="expense-strip-text">
                <span class="strip-label">Chi phí phát sinh:</span>
                <strong class="strip-amount text-primary">
                  {{ (trip.expenses || []).reduce((acc, e) => acc + (e.amount || 0), 0).toLocaleString() }} đ
                </strong>
                <span
                  v-if="trip.expenses && trip.expenses.length > 0"
                  class="proof-stat-pill"
                  :class="trip.expenses.every((e) => !!e.receiptImage) ? 'pill-verified' : 'pill-warn'"
                >
                  {{ trip.expenses.filter((e) => !!e.receiptImage).length }}/{{ trip.expenses.length }} Hóa đơn có ảnh
                </span>
                <span v-else class="text-xxs text-muted ml-1">(Chưa ghi nhận)</span>
              </div>
            </div>

            <button
              type="button"
              class="btn-expense-action"
              @click="activeExpenseTrip = trip"
              title="Kê khai chi phí và đính kèm bằng chứng ảnh chụp hóa đơn / biên lai"
            >
              <PlusCircle :size="13" />
              <span>Kê Khai & Chụp Hóa Đơn</span>
            </button>
          </div>

          <div class="batch-badge-row">
            <span class="batch-pill">Ghép {{ trip.requestIds.length }} yêu cầu cùng tuyến</span>
            <span class="text-xs text-muted">Ghi chú: {{ trip.notes || 'Không có' }}</span>
          </div>
        </div>

        <div class="trip-card-footer">
          <!-- BƯỚC 1: Nút Xác nhận nhận chuyến (ASSIGNED -> ACCEPTED) -->
          <div v-if="trip.status === 'ASSIGNED'" class="action-prompt-block">
            <div class="prompt-hint">
              <Clock :size="14" class="text-amber" />
              <span>Chuyến xe vừa được phân công. Vui lòng xác nhận để báo cho bộ phận Điều phối:</span>
            </div>
            <button
              class="btn btn-primary full-w btn-accept-trip"
              @click="handleAcceptTrip(trip)"
            >
              <CheckCircle2 :size="16" />
              <span>✓ Xác Nhận Nhận Chuyến Xe Này</span>
            </button>
          </div>

          <!-- BƯỚC 2: Đã nhận chuyến, chờ xuất bến (ACCEPTED -> INPROGRESS) -->
          <div v-else-if="trip.status === 'ACCEPTED'" class="action-prompt-block">
            <div class="prompt-hint text-cyan">
              <CheckCircle2 :size="14" />
              <span>Đã báo nhận chuyến lúc {{ trip.acceptedAt?.slice(11) }}. Nhập ODO khi xe lăn bánh:</span>
            </div>
            <button
              class="btn btn-primary full-w"
              @click="activeStartTrip = trip"
            >
              <Play :size="16" />
              <span>Bắt Đầu Xuất Bến (Nhập ODO)</span>
            </button>
          </div>

          <!-- BƯỚC 3: Xe đang chạy trên đường (INPROGRESS -> ARRIVED / COMPLETED) -->
          <div v-else-if="trip.status === 'INPROGRESS'" class="inprogress-actions-row">
            <button
              class="btn btn-warning full-w btn-arrive"
              @click="activeArriveTrip = trip"
              title="Báo cáo cho đơn vị điều phối biết xe đã tới nơi"
            >
              <MapPin :size="16" />
              <span>Báo Cáo Đã Đến Nơi</span>
            </button>
            <button
              class="btn btn-outline full-w"
              @click="activeCompleteTrip = trip"
              title="Về bến hoặc kết thúc chuyến"
            >
              <CheckCircle :size="16" />
              <span>Về Bến Hoàn Thành</span>
            </button>
          </div>

          <!-- BƯỚC 4: Xe đã đến điểm chỉ định (ARRIVED -> COMPLETED khi về bến) -->
          <div v-else-if="trip.status === 'ARRIVED'" class="action-prompt-block">
            <div class="prompt-hint text-amber">
              <MapPin :size="14" />
              <span>Xe đã tại điểm chỉ định ({{ trip.arrivedAt?.slice(11) }}). Khi quay về bến, nhập ODO & mủ:</span>
            </div>
            <button
              class="btn btn-success full-w"
              @click="activeCompleteTrip = trip"
            >
              <CheckCircle :size="16" />
              <span>Hoàn Thành Chuyến Về Bến (Nhập End ODO & Mủ)</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 2. Lịch sử chuyến đã hoàn thành của tài xế -->
    <div class="card mt-4">
      <div class="card-header flex-between">
        <h3 class="card-title">Lịch Sử Chuyến Đi Đã Hoàn Thành</h3>
        <router-link to="/driver/history" class="btn btn-outline btn-xs">
          <span>Xem chi tiết & đối soát sản lượng mủ ➔</span>
        </router-link>
      </div>

      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th>Mã Chuyến</th>
              <th>Phương Tiện</th>
              <th>Lộ Trình</th>
              <th>Cự Ly Chạy</th>
              <th>Sản Lượng Mủ (kg)</th>
              <th>Dầu Chuẩn / Thực Tế</th>
              <th>Chi Phí (VNĐ)</th>
              <th>Trạng Thái</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="finishedTrips.length === 0">
              <td colspan="8" class="text-center py-5 text-muted">
                Chưa có chuyến xe nào hoàn thành.
              </td>
            </tr>

            <tr v-for="t in finishedTrips" :key="t.id">
              <td><strong>{{ t.tripCode }}</strong></td>
              <td>{{ t.vehiclePlate }}</td>
              <td>{{ t.routeName }}</td>
              <td>
                <strong>{{ t.actualDistanceKm }} km</strong>
                <span class="text-xs text-muted"> ({{ t.startOdo }} ➔ {{ t.endOdo }})</span>
              </td>
              <td>
                <strong v-if="t.totalLatexWeightKg" class="text-success">
                  {{ t.totalLatexWeightKg.toLocaleString() }} kg
                </strong>
                <span v-else class="text-muted">—</span>
              </td>
              <td>
                <span class="text-primary font-bold">{{ t.calculatedFuelLiters }}L</span>
                <span> / {{ t.actualFuelFilledLiters }}L </span>
                <span
                  class="text-xs font-bold"
                  :class="Number(t.fuelVarianceLiters || 0) < 0 ? 'text-danger' : Number(t.fuelVarianceLiters || 0) > 0 ? 'text-success' : 'text-muted'"
                >
                  ({{ Number(t.fuelVarianceLiters || 0) > 0 ? '+' : '' }}{{ t.fuelVarianceLiters }}L)
                </span>
              </td>
              <td>
                <div class="expense-proof-cell">
                  <strong>{{ (t.expenses || []).reduce((acc, e) => acc + (e.amount || 0), 0).toLocaleString() }} đ</strong>
                  <button
                    v-if="t.expenses && t.expenses.length > 0"
                    class="btn-proof-badge"
                    :class="t.expenses.every((e) => !!e.receiptImage) ? 'badge-verified' : 'badge-warning'"
                    @click="viewExpensesTrip = t"
                    title="Xem chi tiết hóa đơn & bằng chứng xác minh"
                  >
                    <Receipt :size="12" />
                    <span>{{ t.expenses.filter((e) => !!e.receiptImage).length }}/{{ t.expenses.length }} Hóa đơn</span>
                  </button>
                </div>
              </td>
              <td>
                <StatusBadge :status="t.status" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal Bắt đầu chuyến -->
    <StartTripModal
      v-if="activeStartTrip"
      :trip="activeStartTrip"
      @close="activeStartTrip = null"
      @started="activeStartTrip = null"
    />

    <!-- Modal Báo cáo đã đến nơi -->
    <ReportArrivedModal
      v-if="activeArriveTrip"
      :trip="activeArriveTrip"
      @close="activeArriveTrip = null"
      @reported="activeArriveTrip = null"
    />

    <!-- Modal Hoàn thành chuyến -->
    <CompleteTripModal
      v-if="activeCompleteTrip"
      :trip="activeCompleteTrip"
      @close="activeCompleteTrip = null"
      @completed="activeCompleteTrip = null"
    />

    <!-- Modal Kê khai Chi phí & Bằng chứng Hóa đơn (Chuyên dụng cho tài xế) -->
    <TripExpenseAddModal
      v-if="activeExpenseTrip"
      :trip="activeExpenseTrip"
      @close="activeExpenseTrip = null"
      @saved="activeExpenseTrip = null"
    />

    <!-- Modal Xem Chi tiết & Bằng chứng Chi phí -->
    <TripExpensesModal
      v-if="viewExpensesTrip"
      :trip="viewExpensesTrip"
      @close="viewExpensesTrip = null"
    />
  </div>
</template>

<style scoped>
.page-header {
  margin-bottom: 20px;
}
.page-title {
  font-size: 1.375rem;
  font-weight: 800;
}
.page-subtitle {
  font-size: 0.8125rem;
  color: var(--text-secondary);
}

/* Toast banner */
.action-toast-banner {
  background: #ecfdf5;
  border: 1px solid #10b981;
  color: #065f46;
  padding: 10px 16px;
  border-radius: 8px;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 0.875rem;
  font-weight: 600;
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.15);
}
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}

.section-title-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
}
.section-heading {
  font-size: 1rem;
  font-weight: 800;
}
.trip-cards-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}
.trip-card {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  border: 1px solid var(--border-strong);
  border-radius: 10px;
  transition: transform 0.15s, box-shadow 0.15s;
  background: var(--bg-surface);
}
.trip-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.06);
}
.border-assigned {
  border-color: #f59e0b;
}
.border-accepted {
  border-color: #06b6d4;
  box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.2);
}
.border-running {
  border-color: #0284c7;
  box-shadow: 0 0 0 2px rgba(2, 132, 199, 0.2);
}
.border-arrived {
  border-color: #d97706;
  box-shadow: 0 0 0 2px rgba(217, 119, 6, 0.25);
}
.trip-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--border);
  padding-bottom: 10px;
}
.trip-code-box {
  display: flex;
  align-items: center;
  gap: 8px;
}
.trip-code {
  font-weight: 800;
  font-size: 1rem;
}
.veh-plate-badge {
  background: #0f172a;
  color: white;
  padding: 3px 8px;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 700;
}

/* Lifecycle Stepper */
.lifecycle-stepper {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(0, 0, 0, 0.02);
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px dashed var(--border);
  margin-top: -2px;
}
.step-item {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--text-muted);
}
.step-item .step-num {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #e2e8f0;
  color: #64748b;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.625rem;
  font-weight: 800;
}
.step-item.active {
  color: #0284c7;
  font-weight: 700;
}
.step-item.active .step-num {
  background: #0284c7;
  color: white;
  box-shadow: 0 0 0 2px rgba(2, 132, 199, 0.25);
}
.step-item.done {
  color: #10b981;
}
.step-item.done .step-num {
  background: #10b981;
  color: white;
}
.step-line {
  flex: 1;
  height: 2px;
  background: #e2e8f0;
  margin: 0 6px;
}
.step-line.filled {
  background: #10b981;
}

.trip-card-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 0.8125rem;
}
.trip-info-line {
  display: flex;
  align-items: center;
  gap: 8px;
}
.icon-muted {
  color: var(--text-muted);
}

.trip-timeline-tag {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  padding: 4px 8px;
  border-radius: 6px;
}
.text-cyan {
  background: #ecfeff;
  color: #0891b2;
  border: 1px solid #cffafe;
}
.text-amber {
  background: #fffbeb;
  color: #b45309;
  border: 1px solid #fef3c7;
}

.batch-badge-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 4px;
}
.batch-pill {
  background: #e0e7ff;
  color: #4338ca;
  font-size: 0.6875rem;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 4px;
}
.trip-card-footer {
  margin-top: auto;
  padding-top: 10px;
}

/* Action prompts & buttons */
.action-prompt-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.prompt-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  color: #92400e;
  background: #fffbeb;
  padding: 6px 10px;
  border-radius: 6px;
}
.btn-accept-trip {
  background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);
  border: none;
  font-weight: 700;
  box-shadow: 0 2px 8px rgba(2, 132, 199, 0.3);
}
.btn-accept-trip:hover {
  background: #0284c7;
  transform: translateY(-1px);
}

.inprogress-actions-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.btn-arrive {
  background: #f59e0b;
  border-color: #d97706;
  color: #ffffff;
  font-weight: 700;
}
.btn-arrive:hover {
  background: #d97706;
  color: #ffffff;
}

.full-w { width: 100%; }
.empty-card {
  padding: 40px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  text-align: center;
}
.font-bold { font-weight: 700; }
.text-primary { color: #15803d; }
.text-success { color: #16a34a; }
.text-danger { color: #dc2626; }
.text-xs { font-size: 0.75rem; }
.text-sm { font-size: 0.8125rem; }
.text-muted { color: var(--text-muted); }
.ml-2 { margin-left: 8px; }
.mb-3 { margin-bottom: 12px; }
.mb-4 { margin-bottom: 20px; }
.mt-4 { margin-top: 16px; }
.py-5 { padding-top: 40px; padding-bottom: 40px; }
.expense-proof-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.btn-proof-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.6875rem;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 4px;
  cursor: pointer;
  border: 1px solid transparent;
  width: fit-content;
  transition: all 0.15s;
}
.btn-proof-badge.badge-verified {
  background: #dcfce7;
  color: #15803d;
  border-color: #86efac;
}
.btn-proof-badge.badge-verified:hover {
  background: #bbf7d0;
}
.btn-proof-badge.badge-warning {
  background: #fef3c7;
  color: #b45309;
  border-color: #fde68a;
}
.btn-proof-badge.badge-warning:hover {
  background: #fde68a;
}

.text-center { text-align: center; }

/* Trip Expense Summary Strip in active card */
.trip-expense-summary-strip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 8px 12px;
  margin-top: 10px;
  gap: 8px;
}
.expense-strip-left {
  display: flex;
  align-items: center;
  gap: 8px;
}
.expense-strip-text {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  font-size: 0.8125rem;
}
.strip-label {
  color: #64748b;
  font-weight: 500;
}
.strip-amount {
  font-weight: 700;
}
.proof-stat-pill {
  font-size: 0.6875rem;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 12px;
}
.proof-stat-pill.pill-verified {
  background: #dcfce7;
  color: #166534;
  border: 1px solid #86efac;
}
.proof-stat-pill.pill-warn {
  background: #fef3c7;
  color: #92400e;
  border: 1px solid #fde68a;
}
.btn-expense-action {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: #ffffff;
  color: #0369a1;
  border: 1px solid #0284c7;
  font-size: 0.75rem;
  font-weight: 700;
  padding: 5px 10px;
  border-radius: 6px;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s ease;
}
.btn-expense-action:hover {
  background: #e0f2fe;
  color: #0284c7;
}

@media (max-width: 768px) {
  .trip-cards-grid { grid-template-columns: 1fr; }
  .inprogress-actions-row { grid-template-columns: 1fr; }
  .trip-expense-summary-strip { flex-direction: column; align-items: flex-start; }
}
</style>
