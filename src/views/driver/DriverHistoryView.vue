<script setup lang="ts">
import { ref, computed } from 'vue';
import { useDriverStore } from '@/stores/driver';
import { useAuthStore } from '@/stores/auth';
import { useFleetStore } from '@/stores/fleet';
import type { TransportTrip } from '@/types';
import StatusBadge from '@/components/common/StatusBadge.vue';
import TablePagination from '@/components/common/TablePagination.vue';
import TripExpensesModal from '@/components/common/TripExpensesModal.vue';
import { getTripDaySequence } from '@/utils/tripHelpers';
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
  ChevronDown,
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

function onVehicleSelectChange(e: Event) {
  const target = e.target as HTMLSelectElement;
  driverStore.setSelectedVehiclePlate(target.value);
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

const currentPage = ref(1);
const pageSize = ref(8);
const paginatedTrips = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  return filteredTrips.value.slice(start, start + pageSize.value);
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
          <!-- Bộ chọn xe dạng Select gọn gàng cho Dispatcher/Admin -->
          <div v-if="authStore.activeRole === 'Dispatcher' || authStore.activeRole === 'Admin'" class="veh-filter-wrapper">
            <label class="veh-filter-label" for="driver-history-veh-select">
              <span>Lọc theo xe:</span>
            </label>
            <div class="veh-select-box">
              <select
                id="driver-history-veh-select"
                class="veh-select font-mono"
                :value="driverStore.selectedVehiclePlate || myVehicle?.licensePlate || 'ALL'"
                @change="onVehicleSelectChange($event)"
              >
                <option value="ALL">-- Tất cả xe ({{ fleetStore.vehicles.length }} phương tiện) --</option>
                <option
                  v-for="v in fleetStore.vehicles"
                  :key="v.id"
                  :value="v.licensePlate"
                >
                  {{ v.licensePlate }} — {{ v.model }} ({{ getVehicleShortType(v) }})
                </option>
              </select>
              <ChevronDown :size="14" class="select-chevron" />
            </div>
            <span v-if="myVehicle" class="veh-selected-tag">
              <span>{{ getVehicleShortType(myVehicle) }}</span>
            </span>
            <span v-else-if="driverStore.selectedVehiclePlate === 'ALL'" class="veh-selected-tag tag-all">
              <span>Tất cả</span>
            </span>
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

            <tr v-for="t in paginatedTrips" :key="t.id">
              <td style="white-space: nowrap">
                <span class="code-badge font-mono">{{ t.tripCode }}</span>
                <span class="badge-trip-seq-mini ml-1" :title="getTripDaySequence(t, driverStore.myTrips).fullLabel">
                  {{ getTripDaySequence(t, driverStore.myTrips).label }}
                </span>
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
      <TablePagination
        v-model:currentPage="currentPage"
        v-model:pageSize="pageSize"
        :totalItems="filteredTrips.length"
        :pageSizeOptions="[5, 8, 15, 30]"
      />
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
   VEHICLE FILTER SELECT TOOLBAR
   ======================================================= */
.veh-filter-wrapper {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: #f8fafc;
  padding: 4px 8px;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
}

.veh-filter-label {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 0.78125rem;
  font-weight: 700;
  color: #475569;
  white-space: nowrap;
  margin-bottom: 0;
  cursor: pointer;
}

.veh-filter-label .filter-icon {
  color: #16a34a;
}

.veh-select-box {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.veh-select {
  appearance: none;
  -webkit-appearance: none;
  background: #ffffff;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  padding: 4px 28px 4px 10px;
  font-size: 0.8125rem;
  font-weight: 700;
  color: #1e293b;
  cursor: pointer;
  min-width: 220px;
  max-width: 320px;
  height: 32px;
  line-height: 1.4;
  outline: none;
  transition: all 0.15s ease;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}

.veh-select:hover {
  border-color: #94a3b8;
  background: #fafafa;
}

.veh-select:focus {
  border-color: #16a34a;
  box-shadow: 0 0 0 3px rgba(22, 163, 74, 0.15);
}

.select-chevron {
  position: absolute;
  right: 8px;
  pointer-events: none;
  color: #64748b;
}

.veh-selected-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: 5px;
  background: #dcfce7;
  color: #15803d;
  font-size: 0.75rem;
  font-weight: 700;
  white-space: nowrap;
}

.veh-selected-tag.tag-all {
  background: #e2e8f0;
  color: #334155;
}

.badge-trip-seq-mini {
  display: inline-flex;
  align-items: center;
  padding: 1px 6px;
  border-radius: 4px;
  background: #f0fdf4;
  color: #166534;
  border: 1px solid #bbf7d0;
  font-size: 0.6875rem;
  font-weight: 700;
  white-space: nowrap;
}

@media (max-width: 1024px) {
  .grid-4 { grid-template-columns: repeat(2, 1fr); }
  .veh-filter-wrapper { width: 100%; }
}
@media (max-width: 640px) {
  .grid-4 { grid-template-columns: 1fr; }
}
</style>
