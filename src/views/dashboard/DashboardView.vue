<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useBookingStore } from '@/stores/booking';
import { useDispatchStore } from '@/stores/dispatch';
import { useFleetStore } from '@/stores/fleet';
import MetricCard from '@/components/common/MetricCard.vue';
import StatusBadge from '@/components/common/StatusBadge.vue';
import BookingCreateModal from '@/components/booking/BookingCreateModal.vue';
import {
  FileText,
  Clock,
  Truck,
  Wrench,
  Droplet,
  Fuel,
  TrendingUp,
  PlusCircle,
  Layers,
  ArrowRight,
} from 'lucide-vue-next';

const router = useRouter();
const authStore = useAuthStore();
const bookingStore = useBookingStore();
const dispatchStore = useDispatchStore();
const fleetStore = useFleetStore();

const showCreateModal = ref(false);

// KPIs tổng hợp
const totalRequestsCount = computed(() => bookingStore.requests.length);
const pendingCount = computed(() => bookingStore.pendingRequests.length);
const activeTripsCount = computed(() => dispatchStore.activeTrips.length);
const dueMaintCount = computed(() => fleetStore.dueMaintenanceVehicles.length);

// Vận hành sản lượng & dầu
const totalLatexTons = computed(() => {
  const sumKg = dispatchStore.trips.reduce((acc, t) => acc + (t.totalLatexWeightKg || 0), 0);
  return (sumKg / 1000).toFixed(1);
});

const totalDistanceKm = computed(() => {
  return dispatchStore.trips.reduce((acc, t) => acc + (t.actualDistanceKm || t.standardDistanceKm || 0), 0);
});

const totalFuelStandard = computed(() => {
  return dispatchStore.trips.reduce((acc, t) => acc + (t.calculatedFuelLiters || 0), 0).toFixed(1);
});

const totalFuelActual = computed(() => {
  return dispatchStore.trips.reduce((acc, t) => acc + (t.actualFuelFilledLiters || 0), 0).toFixed(1);
});

const fuelVarianceTotal = computed(() => {
  return (Number(totalFuelActual.value) - Number(totalFuelStandard.value)).toFixed(1);
});

// Danh sách chuyến xe hôm nay
const recentTrips = computed(() => dispatchStore.trips.slice(0, 5));
</script>

<template>
  <div class="dashboard-page">
    <!-- Header banner -->
    <div class="page-header">
      <div class="header-titles">
        <h1 class="page-title">Bảng Điều Khiển Tổng Quan</h1>
        <p class="page-subtitle">
          Xin chào, <strong>{{ authStore.currentUser.fullName }}</strong>! Hôm nay là ngày 07/09/2026.
          Hệ thống đang phục vụ vận chuyển nguyên liệu mủ và điều động phương tiện công tác.
        </p>
      </div>

      <div class="header-actions">
        <button
          v-if="authStore.activeRole === 'Requester' || authStore.activeRole === 'Admin'"
          class="btn btn-primary"
          @click="showCreateModal = true"
        >
          <PlusCircle :size="16" />
          <span>Đặt xe mới</span>
        </button>
        <button class="btn btn-secondary" @click="router.push('/dispatch')">
          <Layers :size="16" />
          <span>Bảng điều phối</span>
        </button>
      </div>
    </div>

    <!-- 4 Khối KPI Chính (Mục 31 trang 37) -->
    <div class="grid-4 mb-4">
      <MetricCard
        title="Tổng Yêu Cầu Đặt Xe"
        :value="totalRequestsCount"
        unit="yêu cầu"
        sub-text="Tất cả các phòng ban gửi lên"
        variant="primary"
        :icon="FileText"
      />
      <MetricCard
        title="Chờ Phê Duyệt"
        :value="pendingCount"
        unit="chờ duyệt"
        sub-text="Cần Trưởng phòng xử lý"
        variant="warning"
        :icon="Clock"
      />
      <MetricCard
        title="Chuyến Xe Đang Chạy"
        :value="activeTripsCount"
        unit="xe trên đường"
        sub-text="Đang thực hiện vận chuyển"
        variant="info"
        :icon="Truck"
      />
      <MetricCard
        title="Xe Cần Bảo Dưỡng"
        :value="dueMaintCount"
        unit="xe chạm mốc"
        sub-text="Đạt chu kỳ ≥ 5.000 km ODO"
        variant="danger"
        :icon="Wrench"
      />
    </div>

    <!-- Khối Giám sát Sản lượng & Nhiên liệu (Mục 32 trang 38) -->
    <div class="grid-3 mb-4">
      <div class="card stat-box">
        <div class="stat-icon bg-emerald">
          <Droplet :size="24" class="text-emerald" />
        </div>
        <div class="stat-info">
          <span class="stat-label">SẢN LƯỢNG MỦ CAO SU</span>
          <div class="stat-num">{{ totalLatexTons }} <span class="unit">Tấn</span></div>
          <span class="stat-note">Đã giao nhận qua trạm cân trung tâm</span>
        </div>
      </div>

      <div class="card stat-box">
        <div class="stat-icon bg-sky">
          <TrendingUp :size="24" class="text-sky" />
        </div>
        <div class="stat-info">
          <span class="stat-label">TỔNG CỰ LY LĂN BÁNH</span>
          <div class="stat-num">{{ totalDistanceKm.toLocaleString() }} <span class="unit">Km</span></div>
          <span class="stat-note">Theo tuyến quy chuẩn & ODO ghi nhận</span>
        </div>
      </div>

      <div class="card stat-box">
        <div class="stat-icon bg-amber">
          <Fuel :size="24" class="text-amber" />
        </div>
        <div class="stat-info">
          <span class="stat-label">ĐỐI CHIẾU NHIÊN LIỆU (DẦU)</span>
          <div class="stat-num">
            {{ totalFuelActual }} <span class="unit">/ {{ totalFuelStandard }} L</span>
          </div>
          <span
            class="stat-note font-bold"
            :class="Number(fuelVarianceTotal) > 0 ? 'text-danger' : 'text-success'"
          >
            Chênh lệch: {{ Number(fuelVarianceTotal) > 0 ? '+' : '' }}{{ fuelVarianceTotal }} Lít
          </span>
        </div>
      </div>
    </div>

    <!-- Bảng Chuyến xe & Lịch điều phối gần nhất -->
    <div class="card">
      <div class="card-header">
        <h3 class="card-title">Lịch trình Chuyến Xe & Điều Động Gần Đây</h3>
        <button class="btn btn-secondary btn-sm" @click="router.push('/dispatch')">
          <span>Xem tất cả</span>
          <ArrowRight :size="14" />
        </button>
      </div>

      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th>Mã Chuyến</th>
              <th>Phương tiện</th>
              <th>Tài xế phụ trách</th>
              <th>Cung đường / Tuyến chuẩn</th>
              <th>Số YC Ghép</th>
              <th>Khối lượng mủ</th>
              <th>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="t in recentTrips" :key="t.id">
              <td><strong>{{ t.tripCode }}</strong></td>
              <td>
                <div class="flex-col">
                  <strong>{{ t.vehiclePlate }}</strong>
                  <span class="text-muted text-xs">{{ t.vehicleType }}</span>
                </div>
              </td>
              <td>{{ t.driverName }}</td>
              <td>
                <div class="flex-col">
                  <span>{{ t.routeName }}</span>
                  <span class="text-muted text-xs">Cự ly chuẩn: {{ t.standardDistanceKm }} km</span>
                </div>
              </td>
              <td>
                <span class="badge badge-dispatched">{{ t.requestIds.length }} yêu cầu</span>
              </td>
              <td>
                <strong v-if="t.totalLatexWeightKg">{{ t.totalLatexWeightKg.toLocaleString() }} kg</strong>
                <span v-else class="text-muted">—</span>
              </td>
              <td>
                <StatusBadge :status="t.status" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal tạo đặt xe -->
    <BookingCreateModal
      v-if="showCreateModal"
      @close="showCreateModal = false"
    />
  </div>
</template>

<style scoped>
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
  flex-wrap: wrap;
  gap: 16px;
}
.page-title {
  font-size: 1.5rem;
  font-weight: 800;
  color: var(--text-main);
  letter-spacing: -0.02em;
}
.page-subtitle {
  font-size: 0.875rem;
  color: var(--text-muted);
  margin-top: 4px;
}
.header-actions {
  display: flex;
  gap: 10px;
}
.mb-4 { margin-bottom: 20px; }
.stat-box {
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 16px;
  border-radius: 14px;
  border: 1px solid var(--border-card);
  box-shadow: var(--shadow-card);
  transition: transform 0.2s, box-shadow 0.2s;
}
.stat-box:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-hover);
}
.stat-icon {
  width: 54px;
  height: 54px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.bg-emerald { background: #dcfce7; border: 1px solid #bbf7d0; }
.text-emerald { color: #15803d; }
.bg-sky { background: #e0f2fe; border: 1px solid #bae6fd; }
.text-sky { color: #0284c7; }
.bg-amber { background: #fef3c7; border: 1px solid #fde68a; }
.text-amber { color: #b45309; }
.stat-info {
  display: flex;
  flex-direction: column;
}
.stat-label {
  font-size: 0.6875rem;
  font-weight: 700;
  color: #52705d;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}
.stat-num {
  font-size: 1.625rem;
  font-weight: 800;
  color: var(--text-main);
  line-height: 1.2;
}
.stat-num .unit {
  font-size: 0.875rem;
  color: var(--text-muted);
}
.stat-note {
  font-size: 0.75rem;
  color: var(--text-muted);
  margin-top: 2px;
}
.flex-col {
  display: flex;
  flex-direction: column;
}
.text-xs { font-size: 0.75rem; }
.text-muted { color: var(--text-muted); }
.font-bold { font-weight: 700; }
.text-danger { color: #dc2626; }
.text-success { color: #15803d; }
</style>
