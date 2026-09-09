<script setup lang="ts">
import { ref, computed } from 'vue';
import { useDriverStore } from '@/stores/driver';
import { useAuthStore } from '@/stores/auth';
import { useFleetStore } from '@/stores/fleet';
import type { TransportTrip } from '@/types';
import StatusBadge from '@/components/common/StatusBadge.vue';
import TripExpensesModal from '@/components/common/TripExpensesModal.vue';
import {
  Calendar,
  Truck,
  Car,
  Gauge,
  Droplet,
  Fuel,
  Receipt,
  Search,
  Filter,
  CheckCircle2,
} from 'lucide-vue-next';

const driverStore = useDriverStore();
const authStore = useAuthStore();
const fleetStore = useFleetStore();
const myVehicle = computed(() => driverStore.myVehicle);

function getVehicleShortType(v: any): string {
  if (!v) return '';
  if (v.vehicleType === 'LatexTruck') {
    return v.capacityTons ? `Tải ${v.capacityTons}T` : 'Xe tải';
  }
  if (v.vehicleType === 'PassengerCar') return 'Bán tải';
  if (v.vehicleType === 'MillingMachine') return 'Máy đào';
  return v.model?.split(' ')[0] || 'Xe';
}

const searchQuery = ref('');
const viewExpensesTrip = ref<TransportTrip | null>(null);

// Lấy danh sách chuyến hoàn thành của tài xế
const completedTrips = computed(() => {
  return driverStore.myTrips.filter((t) => t.status === 'COMPLETED');
});

// Lọc theo từ khóa tìm kiếm
const filteredTrips = computed(() => {
  return completedTrips.value.filter((t) => {
    if (searchQuery.value) {
      const q = searchQuery.value.toLowerCase();
      const matchCode = t.tripCode.toLowerCase().includes(q);
      const matchPlate = t.vehiclePlate.toLowerCase().includes(q);
      const matchRoute = t.routeName.toLowerCase().includes(q);
      if (!matchCode && !matchPlate && !matchRoute) return false;
    }
    return true;
  });
});

// Thống kê tổng quan
const totalDistanceKm = computed(() => {
  return completedTrips.value.reduce((acc, t) => acc + (t.actualDistanceKm || t.standardDistanceKm || 0), 0);
});

const totalLatexKg = computed(() => {
  return completedTrips.value.reduce((acc, t) => acc + (t.totalLatexWeightKg || 0), 0);
});

const totalFuelLiters = computed(() => {
  return completedTrips.value.reduce((acc, t) => acc + (t.actualFuelFilledLiters || 0), 0);
});

const totalExpenses = computed(() => {
  return completedTrips.value.reduce(
    (acc, t) => acc + (t.expenses || []).reduce((sum, e) => sum + (e.amount || 0), 0),
    0
  );
});
</script>

<template>
  <div class="driver-history-page">
    <!-- Header -->
    <div class="page-header">
      <div>
        <div class="header-tag-row">
          <span class="badge-role">Phân Hệ Vận Hành Tài Xế</span>
          <span class="badge-driver">Tài xế: {{ authStore.currentUser.fullName }}</span>
          <span v-if="myVehicle" class="badge-driver" style="background: #e0f2fe; color: #0369a1; border-color: #bae6fd;">
            Xe: {{ myVehicle.licensePlate }}
          </span>
        </div>
        <h1 class="page-title">Lịch Sử Chuyến Xe & Sản Lượng Mủ Vận Chuyển</h1>
        <p class="page-subtitle">
          Nhật ký đối soát hành trình, quãng đường ODO, khối lượng mủ cao su và đối chiếu tiêu hao nhiên liệu của phương tiện {{ myVehicle?.licensePlate || '' }}
        </p>
      </div>
    </div>

    <!-- 4 Khối thống kê thành tích vận hành -->
    <div class="grid-4 mb-4">
      <div class="stat-card">
        <div class="stat-icon icon-blue">
          <Truck :size="20" />
        </div>
        <div class="stat-content">
          <span class="stat-label">Tổng Chuyến Hoàn Thành</span>
          <strong class="stat-value text-primary">{{ completedTrips.length }} Chuyến</strong>
          <span class="stat-sub">Tổng cự ly: {{ totalDistanceKm.toLocaleString() }} km</span>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon icon-green">
          <Droplet :size="20" />
        </div>
        <div class="stat-content">
          <span class="stat-label">Tổng Sản Lượng Mủ</span>
          <strong class="stat-value text-success">{{ (totalLatexKg / 1000).toFixed(2) }} Tấn</strong>
          <span class="stat-sub">{{ totalLatexKg.toLocaleString() }} kg mủ vận chuyển</span>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon icon-amber">
          <Fuel :size="20" />
        </div>
        <div class="stat-content">
          <span class="stat-label">Nhiên Liệu Cấp Đổ</span>
          <strong class="stat-value text-amber">{{ totalFuelLiters.toFixed(1) }} Lít</strong>
          <span class="stat-sub">Cấp theo định mức NLP+NLC</span>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon icon-purple">
          <Receipt :size="20" />
        </div>
        <div class="stat-content">
          <span class="stat-label">Tổng Chi Phí Phát Sinh</span>
          <strong class="stat-value text-purple">{{ totalExpenses.toLocaleString() }} đ</strong>
          <span class="stat-sub">Đã kê khai kèm hóa đơn</span>
        </div>
      </div>
    </div>

    <!-- Bảng danh sách chuyến xe đã hoàn thành -->
    <div class="card">
      <div class="card-header-flex">
        <div>
          <h3 class="card-title">Danh Sách Lịch Sử Chuyến Đi Đã Hoàn Tất ({{ filteredTrips.length }})</h3>
          <span class="card-subtitle">Đối chiếu chỉ số ODO, lượng mủ nghiệm thu và dầu thực tế</span>
        </div>

        <div class="flex items-center gap-3 flex-wrap">
          <!-- Bộ chọn xe cho Dispatcher/Admin nếu muốn kiểm tra xe khác -->
          <div v-if="authStore.activeRole === 'Dispatcher' || authStore.activeRole === 'Admin'" class="veh-filter-wrapper">
            <div class="veh-filter-label">
              <Filter :size="13" class="filter-icon" />
              <span>Lọc theo xe:</span>
            </div>
            <div class="veh-filter-chips">
              <button
                v-for="v in fleetStore.vehicles"
                :key="v.id"
                type="button"
                class="veh-chip-btn"
                :class="{ 'active': myVehicle?.licensePlate === v.licensePlate }"
                @click="driverStore.setSelectedVehiclePlate(v.licensePlate)"
                :title="`${v.licensePlate} — ${v.model}`"
              >
                <span class="chip-icon-box">
                  <Truck v-if="v.vehicleType === 'LatexTruck'" :size="13" />
                  <Car v-else-if="v.vehicleType === 'PassengerCar'" :size="13" />
                  <Gauge v-else :size="13" />
                </span>
                <span class="chip-plate font-mono">{{ v.licensePlate }}</span>
                <span class="chip-tag">{{ getVehicleShortType(v) }}</span>
                <span v-if="myVehicle?.licensePlate === v.licensePlate" class="chip-check">
                  <CheckCircle2 :size="12" />
                </span>
              </button>
            </div>
          </div>
          <div class="search-box">
            <Search :size="14" class="text-muted" />
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Tìm mã chuyến, biển số, tuyến..."
              class="form-input-sm"
            />
          </div>
        </div>
      </div>

      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th style="width: 155px; white-space: nowrap">Mã Chuyến</th>
              <th style="width: 115px; white-space: nowrap">Phương Tiện</th>
              <th style="min-width: 200px">Lộ Trình / Tuyến</th>
              <th style="width: 150px; white-space: nowrap">Cự Ly (ODO)</th>
              <th style="width: 140px; white-space: nowrap">Sản Lượng Mủ (kg)</th>
              <th style="width: 170px; white-space: nowrap">Dầu Chuẩn / Thực Tế</th>
              <th style="width: 140px; white-space: nowrap">Chi Phí (VNĐ)</th>
              <th style="width: 120px; white-space: nowrap">Trạng Thái</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="filteredTrips.length === 0">
              <td colspan="8" class="text-center py-5 text-muted">
                <div class="empty-state">
                  <Calendar :size="36" class="text-muted mb-2" />
                  <span class="font-bold">Không tìm thấy chuyến xe nào</span>
                </div>
              </td>
            </tr>

            <tr v-for="t in filteredTrips" :key="t.id">
              <td style="white-space: nowrap">
                <span class="code-badge font-mono">{{ t.tripCode }}</span>
              </td>
              <td style="white-space: nowrap">
                <div class="vehicle-cell">
                  <strong class="font-mono text-slate-800">{{ t.vehiclePlate }}</strong>
                  <span class="text-xs text-muted">{{ t.vehicleType }}</span>
                </div>
              </td>
              <td>
                <div class="route-cell">
                  <span class="font-semibold">{{ t.routeName }}</span>
                  <span class="text-xs text-muted">Giờ xuất: {{ t.scheduledStartTime }}</span>
                </div>
              </td>
              <td>
                <strong>{{ t.actualDistanceKm || t.standardDistanceKm }} km</strong>
                <span v-if="t.startOdo && t.endOdo" class="text-xs text-muted block">
                  ({{ t.startOdo.toLocaleString() }} ➔ {{ t.endOdo.toLocaleString() }})
                </span>
              </td>
              <td>
                <strong v-if="t.totalLatexWeightKg" class="text-success font-bold">
                  {{ t.totalLatexWeightKg.toLocaleString() }} kg
                </strong>
                <span v-else class="text-muted">—</span>
              </td>
              <td>
                <span class="text-primary font-bold">{{ t.calculatedFuelLiters || 0 }}L</span>
                <span> / {{ t.actualFuelFilledLiters || 0 }}L</span>
                <span
                  class="variance-badge ml-1"
                  :class="Number(t.fuelVarianceLiters || 0) < 0 ? 'var-danger' : Number(t.fuelVarianceLiters || 0) > 0 ? 'var-success' : 'var-neutral'"
                >
                  {{ Number(t.fuelVarianceLiters || 0) > 0 ? '+' : '' }}{{ t.fuelVarianceLiters || 0 }}L
                </span>
              </td>
              <td>
                <div class="expense-cell">
                  <strong>{{ (t.expenses || []).reduce((acc, e) => acc + (e.amount || 0), 0).toLocaleString() }} đ</strong>
                  <button
                    v-if="t.expenses && t.expenses.length > 0"
                    type="button"
                    class="btn-proof-tag"
                    :class="t.expenses.every((e) => !!e.receiptImage) ? 'proof-full' : 'proof-partial'"
                    @click="viewExpensesTrip = t"
                    title="Xem chi tiết các khoản chi và hóa đơn xác minh"
                  >
                    <Receipt :size="11" />
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

    <!-- Modal Xem Chi tiết & Bằng chứng Chi phí -->
    <TripExpensesModal
      v-if="viewExpensesTrip"
      :trip="viewExpensesTrip"
      @close="viewExpensesTrip = null"
    />
  </div>
</template>

<style scoped>
.driver-history-page {
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
.icon-purple { background: #f3e8ff; color: #9333ea; }

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

.text-purple { color: #9333ea; }

/* Table */
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
.search-box {
  display: flex;
  align-items: center;
  gap: 6px;
  background: #f8fafc;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  padding: 4px 10px;
}
.form-input-sm {
  border: none;
  background: transparent;
  outline: none;
  font-size: 0.78125rem;
  width: 220px;
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
.code-badge {
  background: #f1f5f9;
  color: #0f172a;
  border: 1px solid #cbd5e1;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 700;
  font-size: 0.75rem;
}
.vehicle-cell, .route-cell {
  display: flex;
  flex-direction: column;
}
.block { display: block; }
.variance-badge {
  font-size: 0.6875rem;
  font-weight: 700;
  padding: 1px 4px;
  border-radius: 3px;
}
.var-danger { background: #fee2e2; color: #dc2626; }
.var-success { background: #dcfce7; color: #16a34a; }
.var-neutral { color: #94a3b8; }

.expense-cell {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.btn-proof-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.65rem;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid transparent;
  cursor: pointer;
  width: fit-content;
}
.btn-proof-tag.proof-full {
  background: #dcfce7;
  color: #15803d;
  border-color: #86efac;
}
.btn-proof-tag.proof-partial {
  background: #fef3c7;
  color: #b45309;
  border-color: #fde68a;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
}

/* =======================================================
   VEHICLE FILTER CHIPS TOOLBAR
   ======================================================= */
.veh-filter-wrapper {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: #f8fafc;
  padding: 4px 8px;
  border-radius: 9px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
}

.veh-filter-label {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 0.75rem;
  font-weight: 700;
  color: #475569;
  white-space: nowrap;
}

.veh-filter-label .filter-icon {
  color: #16a34a;
}

.veh-filter-chips {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.veh-chip-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 7px;
  border: 1px solid #cbd5e1;
  background: #ffffff;
  color: #334155;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.18s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  white-space: nowrap;
}

.veh-chip-btn:hover {
  background: #f1f5f9;
  border-color: #94a3b8;
  color: #0f172a;
  transform: translateY(-1px);
}

.veh-chip-btn.active {
  background: #f0fdf4;
  border-color: #16a34a;
  color: #15803d;
  font-weight: 700;
  box-shadow: 0 2px 6px rgba(22, 163, 74, 0.18);
}

.chip-icon-box {
  display: flex;
  align-items: center;
  color: inherit;
}

.chip-plate {
  font-weight: 800;
  letter-spacing: 0.3px;
}

.chip-tag {
  font-size: 0.6875rem;
  padding: 1px 6px;
  border-radius: 4px;
  background: #f1f5f9;
  color: #64748b;
  font-weight: 600;
}

.veh-chip-btn.active .chip-tag {
  background: #dcfce7;
  color: #166534;
}

.chip-check {
  display: flex;
  align-items: center;
  color: #16a34a;
}

@media (max-width: 1024px) {
  .grid-4 { grid-template-columns: repeat(2, 1fr); }
  .veh-filter-wrapper { width: 100%; }
}
@media (max-width: 640px) {
  .grid-4 { grid-template-columns: 1fr; }
}
</style>
