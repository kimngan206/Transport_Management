<script setup lang="ts">
import { ref, computed } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { useDriverStore } from '@/stores/driver';
import type { TransportTrip } from '@/types';
import StatusBadge from '@/components/common/StatusBadge.vue';
import StartTripModal from '@/components/driver/StartTripModal.vue';
import CompleteTripModal from '@/components/driver/CompleteTripModal.vue';
import { Car, Play, CheckCircle, Calendar, MapPin, Gauge } from 'lucide-vue-next';

const authStore = useAuthStore();
const driverStore = useDriverStore();

const activeStartTrip = ref<TransportTrip | null>(null);
const activeCompleteTrip = ref<TransportTrip | null>(null);

const myTrips = computed(() => driverStore.myTrips);

const pendingOrRunningTrips = computed(() =>
  myTrips.value.filter((t) => t.status === 'ASSIGNED' || t.status === 'INPROGRESS')
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
          — Quản lý lịch trình, ghi nhận ODO và sản lượng mủ vận chuyển
        </p>
      </div>
    </div>

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
        :class="{ 'border-running': trip.status === 'INPROGRESS' }"
      >
        <div class="trip-card-header">
          <div class="trip-code-box">
            <span class="trip-code">{{ trip.tripCode }}</span>
            <StatusBadge :status="trip.status" />
          </div>
          <span class="veh-plate-badge">{{ trip.vehiclePlate }} ({{ trip.vehicleType }})</span>
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

          <div class="batch-badge-row">
            <span class="batch-pill">Ghép {{ trip.requestIds.length }} yêu cầu cùng tuyến</span>
            <span class="text-xs text-muted">Ghi chú: {{ trip.notes || 'Không có' }}</span>
          </div>
        </div>

        <div class="trip-card-footer">
          <!-- Nút Bắt đầu chuyến -->
          <button
            v-if="trip.status === 'ASSIGNED'"
            class="btn btn-primary full-w"
            @click="activeStartTrip = trip"
          >
            <Play :size="16" />
            <span>Bắt Đầu Chuyến Đi (Nhập ODO)</span>
          </button>

          <!-- Nút Hoàn thành chuyến -->
          <button
            v-else-if="trip.status === 'INPROGRESS'"
            class="btn btn-success full-w"
            @click="activeCompleteTrip = trip"
          >
            <CheckCircle :size="16" />
            <span>Hoàn Thành Chuyến (Nhập End ODO & Mủ)</span>
          </button>
        </div>
      </div>
    </div>

    <!-- 2. Lịch sử chuyến đã hoàn thành của tài xế -->
    <div class="card mt-4">
      <div class="card-header">
        <h3 class="card-title">Lịch Sử Chuyến Đi Đã Hoàn Thành</h3>
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
                {{ t.expenses.reduce((acc, e) => acc + e.amount, 0).toLocaleString() }} đ
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

    <!-- Modal Hoàn thành chuyến -->
    <CompleteTripModal
      v-if="activeCompleteTrip"
      :trip="activeCompleteTrip"
      @close="activeCompleteTrip = null"
      @completed="activeCompleteTrip = null"
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
  transition: transform 0.15s;
}
.trip-card:hover {
  transform: translateY(-2px);
}
.border-running {
  border-color: #0284c7;
  box-shadow: 0 0 0 2px rgba(2, 132, 199, 0.2);
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
.text-center { text-align: center; }
@media (max-width: 768px) {
  .trip-cards-grid { grid-template-columns: 1fr; }
}
</style>
