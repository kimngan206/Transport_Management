<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { useDispatchStore } from '@/stores/dispatch';
import MetricCard from '@/components/common/MetricCard.vue';
import TripExpensesModal from '@/components/common/TripExpensesModal.vue';
import type { TransportTrip } from '@/types';
import {
  Fuel,
  Droplet,
  DollarSign,
  BarChart3,
  PieChart as PieChartIcon,
  Navigation,
  CheckCircle2,
  AlertTriangle,
  Download,
  Receipt,
} from 'lucide-vue-next';
import Chart from 'chart.js/auto';

const dispatchStore = useDispatchStore();

// Bộ lọc
const filterVehicle = ref<string>('ALL');
const filterTimeRange = ref<string>('ALL');
const viewExpensesTrip = ref<TransportTrip | null>(null);

// Các chuyến đã hoàn thành
const completedTrips = computed(() => {
  let list = dispatchStore.completedTrips;
  if (filterVehicle.value !== 'ALL') {
    list = list.filter((t) => t.vehiclePlate === filterVehicle.value);
  }
  return list;
});

// Danh sách biển số xe cho dropdown lọc
const availableVehicles = computed(() => {
  const plates = new Set(dispatchStore.completedTrips.map((t) => t.vehiclePlate));
  return Array.from(plates);
});

// Tổng hợp số liệu KPI
const totalLatexKg = computed(() =>
  completedTrips.value.reduce((acc, t) => acc + (t.totalLatexWeightKg || 0), 0)
);

const latexWater1Total = computed(() =>
  completedTrips.value.reduce((acc, t) => acc + (t.weightLatex1Kg || 0), 0)
);

const latexWater23Total = computed(() =>
  completedTrips.value.reduce(
    (acc, t) => acc + (t.weightLatex2Kg || 0) + (t.weightLatex3Kg || 0),
    0
  )
);

const latexTapTotal = computed(() =>
  completedTrips.value.reduce((acc, t) => acc + (t.weightLatexTapKg || 0), 0)
);

const totalFuelStandard = computed(() =>
  completedTrips.value.reduce((acc, t) => acc + (t.calculatedFuelLiters || 0), 0).toFixed(1)
);

const totalFuelActual = computed(() =>
  completedTrips.value.reduce((acc, t) => acc + (t.actualFuelFilledLiters || 0), 0).toFixed(1)
);

const totalVariance = computed(() =>
  (Number(totalFuelActual.value) - Number(totalFuelStandard.value)).toFixed(1)
);

const totalExpenses = computed(() => {
  return completedTrips.value.reduce((acc, t) => {
    return acc + t.expenses.reduce((sub, e) => sub + e.amount, 0);
  }, 0);
});

// Tỷ lệ đạt định mức dầu
const compliantTripsCount = computed(() => {
  return completedTrips.value.filter((t) => Number(t.fuelVarianceLiters || 0) <= 0.5).length;
});

const complianceRate = computed(() => {
  if (completedTrips.value.length === 0) return 100;
  return Math.round((compliantTripsCount.value / completedTrips.value.length) * 100);
});

// ==========================================
// KHỞI TẠO BIỂU ĐỒ CHART.JS
// ==========================================
const fuelChartCanvas = ref<HTMLCanvasElement | null>(null);
const latexDonutCanvas = ref<HTMLCanvasElement | null>(null);
const routeChartCanvas = ref<HTMLCanvasElement | null>(null);

let fuelChartInstance: Chart | null = null;
let latexDonutInstance: Chart | null = null;
let routeChartInstance: Chart | null = null;

function renderFuelComparisonChart() {
  if (!fuelChartCanvas.value) return;
  fuelChartInstance?.destroy();

  const labels = completedTrips.value.map((t) => `${t.tripCode}\n(${t.vehiclePlate})`);
  const standardFuelData = completedTrips.value.map((t) => t.calculatedFuelLiters || 0);
  const actualFuelData = completedTrips.value.map((t) => t.actualFuelFilledLiters || 0);

  fuelChartInstance = new Chart(fuelChartCanvas.value, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Dầu Tiêu Chuẩn (NLP+NLC)',
          data: standardFuelData,
          backgroundColor: 'rgba(2, 132, 199, 0.85)', // Sky blue bồn téc
          borderColor: '#0284c7',
          borderWidth: 1,
          borderRadius: 4,
          maxBarThickness: 32,
        },
        {
          label: 'Dầu Thực Tế Cấp Đổ',
          data: actualFuelData,
          backgroundColor: completedTrips.value.map((t) =>
            Number(t.fuelVarianceLiters || 0) < 0
              ? 'rgba(220, 38, 38, 0.85)' // Đỏ nếu âm (-)
              : 'rgba(22, 163, 74, 0.85)' // Xanh nếu dương (+)
          ),
          borderColor: completedTrips.value.map((t) =>
            Number(t.fuelVarianceLiters || 0) < 0 ? '#dc2626' : '#16a34a'
          ),
          borderWidth: 1,
          borderRadius: 4,
          maxBarThickness: 32,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: {
          position: 'top',
          labels: {
            font: { family: "'Plus Jakarta Sans', sans-serif", size: 12, weight: 600 },
            usePointStyle: true,
            padding: 16,
          },
        },
        tooltip: {
          callbacks: {
            afterBody(items) {
              const idx = items[0]?.dataIndex;
              if (idx !== undefined && completedTrips.value[idx]) {
                const trip = completedTrips.value[idx];
                const variance = trip.fuelVarianceLiters || 0;
                const sign = Number(variance) > 0 ? '+' : '';
                return `Chênh lệch: ${sign}${variance} Lít (${trip.routeName})`;
              }
              return '';
            },
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Nhiên liệu (Lít)',
            font: { size: 11, weight: 600 },
          },
          grid: { color: 'rgba(0, 0, 0, 0.05)' },
        },
        x: {
          grid: { display: false },
          ticks: { font: { size: 11 } },
        },
      },
    },
  });
}

function renderLatexDonutChart() {
  if (!latexDonutCanvas.value) return;
  latexDonutInstance?.destroy();

  const w1 = latexWater1Total.value;
  const w23 = latexWater23Total.value;
  const wTap = latexTapTotal.value;

  latexDonutInstance = new Chart(latexDonutCanvas.value, {
    type: 'doughnut',
    data: {
      labels: ['Mủ nước loại 1 (DRC cao)', 'Mủ nước loại 2 & 3', 'Mủ tạp / chén đông'],
      datasets: [
        {
          data: [w1, w23, wTap],
          backgroundColor: [
            '#16a34a', // Xanh rừng cao su chuẩn
            '#4ade80', // Xanh chồi non
            '#d97706', // Vàng đất bazan
          ],
          borderColor: '#ffffff',
          borderWidth: 3,
          hoverOffset: 6,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '72%',
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          callbacks: {
            label(context) {
              const val = Number(context.raw) || 0;
              const sum = w1 + w23 + wTap;
              const pct = sum > 0 ? ((val / sum) * 100).toFixed(1) : '0';
              return ` ${context.label}: ${val.toLocaleString()} kg (${pct}%)`;
            },
          },
        },
      },
    },
  });
}

function renderRouteProductionChart() {
  if (!routeChartCanvas.value) return;
  routeChartInstance?.destroy();

  // Nhóm theo tên tuyến
  const routeMap = new Map<string, { weightKg: number; tripCount: number }>();
  completedTrips.value.forEach((t) => {
    const route = t.routeName || 'Tuyến nội bộ';
    const cur = routeMap.get(route) || { weightKg: 0, tripCount: 0 };
    cur.weightKg += t.totalLatexWeightKg || 0;
    cur.tripCount += 1;
    routeMap.set(route, cur);
  });

  const routeLabels = Array.from(routeMap.keys());
  const routeWeights = Array.from(routeMap.values()).map((v) => (v.weightKg / 1000)); // đổi sang Tấn

  routeChartInstance = new Chart(routeChartCanvas.value, {
    type: 'bar',
    data: {
      labels: routeLabels,
      datasets: [
        {
          label: 'Sản lượng mủ vận chuyển (Tấn)',
          data: routeWeights,
          backgroundColor: 'rgba(21, 128, 61, 0.85)',
          borderColor: '#15803d',
          borderWidth: 1,
          borderRadius: 6,
          maxBarThickness: 28,
        },
      ],
    },
    options: {
      indexAxis: 'y', // Biểu đồ nằm ngang
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label(context) {
              const val = Number(context.raw) || 0;
              return ` Sản lượng: ${val.toFixed(2)} Tấn (${(val * 1000).toLocaleString()} kg)`;
            },
          },
        },
      },
      scales: {
        x: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Sản lượng (Tấn)',
            font: { size: 11, weight: 600 },
          },
          grid: { color: 'rgba(0, 0, 0, 0.05)' },
        },
        y: {
          grid: { display: false },
          ticks: { font: { size: 11, weight: 600 } },
        },
      },
    },
  });
}

function initAllCharts() {
  nextTick(() => {
    renderFuelComparisonChart();
    renderLatexDonutChart();
    renderRouteProductionChart();
  });
}

function destroyAllCharts() {
  fuelChartInstance?.destroy();
  latexDonutInstance?.destroy();
  routeChartInstance?.destroy();
}

onMounted(() => {
  initAllCharts();
});

watch(
  [completedTrips, filterVehicle, filterTimeRange],
  () => {
    initAllCharts();
  },
  { deep: true }
);

onUnmounted(() => {
  destroyAllCharts();
});

function exportReportAlert() {
  alert('Đang trích xuất dữ liệu Báo Cáo Đối Chiếu Nhiên Liệu & Sản Lượng Mủ (Định dạng Excel / PDF)...');
}
</script>

<template>
  <div class="reports-page">
    <!-- Header Phân Hệ & Bộ Lọc -->
    <div class="page-header">
      <div>
        <div class="header-badge-row">
          <span class="badge-module">Trung Tâm Điều Vận ECOTECH 2A</span>
          <span class="badge-count">{{ completedTrips.length }} Chuyến xe đã đối soát</span>
        </div>
        <h1 class="page-title">Báo Cáo Vận Hành, Sản Lượng Mủ & Đối Chiếu Nhiên Liệu</h1>
        <p class="page-subtitle">
          Báo cáo thống kê trực quan sản lượng mủ cao su vận chuyển, chi phí và biểu đồ đối chiếu tiêu hao nhiên liệu tiêu chuẩn vs thực tế
        </p>
      </div>

      <div class="header-controls">
        <div class="filter-box">
          <label class="filter-lbl">Lọc phương tiện:</label>
          <select v-model="filterVehicle" class="form-select-sm">
            <option value="ALL">Tất cả xe trong đội</option>
            <option v-for="plate in availableVehicles" :key="plate" :value="plate">
              {{ plate }}
            </option>
          </select>
        </div>

        <button class="btn btn-secondary btn-sm" @click="exportReportAlert">
          <Download :size="14" />
          <span>Xuất Báo Cáo</span>
        </button>
      </div>
    </div>

    <!-- 4 Khối Số Liệu Tổng Hợp (KPIs) -->
    <div class="grid-4 mb-4">
      <MetricCard
        title="Tổng Sản Lượng Mủ"
        :value="(totalLatexKg / 1000).toFixed(2)"
        unit="Tấn"
        :sub-text="`Quy đổi ${(totalLatexKg).toLocaleString()} kg mủ`"
        variant="success"
        :icon="Droplet"
      />

      <MetricCard
        title="Dầu Chuẩn (Định Mức)"
        :value="totalFuelStandard"
        unit="Lít"
        sub-text="Theo công thức NLP + NLC"
        variant="primary"
        :icon="Fuel"
      />

      <MetricCard
        title="Dầu Thực Tế Cấp Đổ"
        :value="totalFuelActual"
        unit="Lít"
        :sub-text="'Chênh lệch: ' + (Number(totalVariance) > 0 ? '+' : '') + totalVariance + ' Lít'"
        :variant="Number(totalVariance) > 0.5 ? 'danger' : 'info'"
        :icon="Fuel"
      />

      <MetricCard
        title="Tổng Chi Phí Chuyến Đi"
        :value="totalExpenses.toLocaleString()"
        unit="VNĐ"
        :sub-text="`Tỷ lệ đạt định mức dầu: ${complianceRate}%`"
        variant="warning"
        :icon="DollarSign"
      />
    </div>

    <!-- KHU VỰC BIỂU ĐỒ TRỰC QUAN (CHARTS SECTION) -->
    <div class="charts-grid mb-4">
      <!-- Biểu đồ 1: Đối Chiếu Nhiên Liệu Grouped Bar -->
      <div class="card chart-card chart-span-2">
        <div class="chart-header">
          <div class="chart-title-group">
            <div class="chart-icon-wrap icon-blue">
              <BarChart3 :size="18" />
            </div>
            <div>
              <h3 class="chart-title">Biểu Đồ Đối Chiếu Nhiên Liệu Tiêu Chuẩn vs Thực Tế Từng Chuyến</h3>
              <span class="chart-subtitle">So sánh Lít dầu định mức lý thuyết (NLP+NLC) với Lít dầu cấp đổ thực tế của tài xế</span>
            </div>
          </div>
          <div class="chart-legend-badge">
            <span class="legend-dot dot-blue"></span> Dầu Chuẩn
            <span class="legend-dot dot-green ml-2"></span> Chênh lệch (+)
            <span class="legend-dot dot-red ml-2"></span> Chênh lệch (-)
          </div>
        </div>

        <div class="chart-body">
          <div v-if="completedTrips.length === 0" class="empty-chart-notice">
            Chưa có chuyến đi hoàn thành để lập biểu đồ đối chiếu.
          </div>
          <div v-else class="chart-canvas-container">
            <canvas ref="fuelChartCanvas"></canvas>
          </div>
        </div>
      </div>

      <!-- Biểu đồ 2: Cơ Cấu Mủ Cao Su Doughnut Chart -->
      <div class="card chart-card">
        <div class="chart-header">
          <div class="chart-title-group">
            <div class="chart-icon-wrap icon-green">
              <PieChartIcon :size="18" />
            </div>
            <div>
              <h3 class="chart-title">Cơ Cấu Sản Lượng Mủ</h3>
              <span class="chart-subtitle">Tỷ trọng mủ nước DRC cao vs mủ tạp</span>
            </div>
          </div>
        </div>

        <div class="chart-body flex-center">
          <div v-if="totalLatexKg === 0" class="empty-chart-notice">
            Không có dữ liệu mủ thu gom.
          </div>
          <div v-else class="donut-canvas-container">
            <canvas ref="latexDonutCanvas"></canvas>
            <div class="donut-center-info">
              <span class="center-val">{{ (totalLatexKg / 1000).toFixed(1) }}</span>
              <span class="center-unit">Tấn</span>
            </div>
          </div>
        </div>

        <!-- Chú thích chi tiết 3 loại mủ -->
        <div class="latex-stat-summary">
          <div class="latex-stat-item">
            <span class="stat-dot dot-darkgreen"></span>
            <div class="stat-meta">
              <span class="stat-name">Mủ nước loại 1:</span>
              <strong class="stat-weight text-success">{{ latexWater1Total.toLocaleString() }} kg</strong>
            </div>
          </div>
          <div class="latex-stat-item">
            <span class="stat-dot dot-lightgreen"></span>
            <div class="stat-meta">
              <span class="stat-name">Mủ nước loại 2 & 3:</span>
              <strong class="stat-weight text-info">{{ latexWater23Total.toLocaleString() }} kg</strong>
            </div>
          </div>
          <div class="latex-stat-item">
            <span class="stat-dot dot-amber"></span>
            <div class="stat-meta">
              <span class="stat-name">Mủ chén / đông tạp:</span>
              <strong class="stat-weight text-amber">{{ latexTapTotal.toLocaleString() }} kg</strong>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Biểu đồ 3: Sản Lượng Mủ Theo Tuyến Đường Huyết Mạch -->
    <div class="card chart-card mb-4">
      <div class="chart-header">
        <div class="chart-title-group">
          <div class="chart-icon-wrap icon-purple">
            <Navigation :size="18" />
          </div>
          <div>
            <h3 class="chart-title">Phân Bổ Sản Lượng Mủ Theo Tuyến Đường Quy Chuẩn</h3>
            <span class="chart-subtitle">Khối lượng mủ vận chuyển thực tế từ các nông trường đội về trạm cân và nhà máy</span>
          </div>
        </div>
      </div>

      <div class="chart-body horizontal-bar-body">
        <div v-if="completedTrips.length === 0" class="empty-chart-notice">
          Chưa có dữ liệu chuyến đi theo tuyến.
        </div>
        <div v-else class="horizontal-canvas-container">
          <canvas ref="routeChartCanvas"></canvas>
        </div>
      </div>
    </div>

    <!-- BẢNG ĐỐI CHIẾU CHI TIẾT TỪNG CHUYẾN XE -->
    <div class="card">
      <div class="card-header-bar">
        <h3 class="table-card-title">Chi Tiết Đối Chiếu Định Mức Nhiên Liệu Từng Chuyến Xe</h3>
        <span class="badge-note">Ghi nhận ODO xuất bến - kết thúc và lượng dầu thực tế</span>
      </div>

      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Mã Chuyến</th>
              <th>Phương Tiện</th>
              <th>Tài Xế Phụ Trách</th>
              <th>Tuyến Quy Chuẩn</th>
              <th>Cự Ly Chạy</th>
              <th>Sản Lượng Mủ</th>
              <th>Dầu Chuẩn</th>
              <th>Dầu Thực Tế</th>
              <th>Chênh Lệch</th>
              <th>Chi Phí (VNĐ)</th>
              <th>Đánh Giá</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="completedTrips.length === 0">
              <td colspan="11" class="text-center py-5 text-muted">
                Chưa có chuyến đi nào hoàn thành để tạo báo cáo đối chiếu.
              </td>
            </tr>

            <tr v-for="t in completedTrips" :key="t.id">
              <td>
                <span class="code-badge">{{ t.tripCode }}</span>
              </td>
              <td>
                <div class="vehicle-plate-box">
                  <strong>{{ t.vehiclePlate }}</strong>
                  <span class="text-xs text-muted">{{ t.vehicleType }}</span>
                </div>
              </td>
              <td>
                <span class="driver-name-text">{{ t.driverName }}</span>
              </td>
              <td>
                <span class="route-name-text">{{ t.routeName }}</span>
              </td>
              <td>
                <strong>{{ t.actualDistanceKm || t.standardDistanceKm }} km</strong>
              </td>
              <td>
                <strong v-if="t.totalLatexWeightKg" class="text-success">
                  {{ t.totalLatexWeightKg.toLocaleString() }} kg
                </strong>
                <span v-else class="text-muted">—</span>
              </td>
              <td>
                <strong>{{ t.calculatedFuelLiters }} L</strong>
              </td>
              <td>
                <strong class="text-primary">{{ t.actualFuelFilledLiters }} L</strong>
              </td>
              <td>
                <span
                  class="font-bold"
                  :class="Number(t.fuelVarianceLiters || 0) < 0 ? 'text-danger' : Number(t.fuelVarianceLiters || 0) > 0 ? 'text-success' : 'text-muted'"
                >
                  {{ Number(t.fuelVarianceLiters || 0) > 0 ? '+' : '' }}{{ t.fuelVarianceLiters }} L
                </span>
              </td>
              <td>
                <div v-if="t.expenses && t.expenses.length > 0" class="flex-col">
                  <strong class="text-primary">{{ (t.expenses || []).reduce((acc, e) => acc + (e.amount || 0), 0).toLocaleString() }} đ</strong>
                  <button
                    type="button"
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
                <span
                  class="eval-badge"
                  :class="Number(t.fuelVarianceLiters || 0) <= 0.5 ? 'eval-pass' : 'eval-warn'"
                >
                  <CheckCircle2 v-if="Number(t.fuelVarianceLiters || 0) <= 0.5" :size="12" />
                  <AlertTriangle v-else :size="12" />
                  <span>{{ Number(t.fuelVarianceLiters || 0) <= 0.5 ? 'Đạt định mức' : 'Vượt định mức' }}</span>
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal Xem Chi tiết & Thẩm định Bằng chứng Chi phí -->
    <TripExpensesModal
      v-if="viewExpensesTrip"
      :trip="viewExpensesTrip"
      @close="viewExpensesTrip = null"
    />
  </div>
</template>

<style scoped>
.reports-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 16px;
  margin-bottom: 4px;
}

.header-badge-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.badge-module {
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #15803d;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  padding: 2px 8px;
  border-radius: 4px;
}

.badge-count {
  font-size: 0.6875rem;
  font-weight: 600;
  color: #475569;
  background: #f1f5f9;
  padding: 2px 8px;
  border-radius: 4px;
}

.page-title {
  font-size: 1.35rem;
  font-weight: 800;
  color: var(--text-main);
  margin-bottom: 4px;
}

.page-subtitle {
  font-size: 0.8125rem;
  color: var(--text-muted);
  max-width: 820px;
}

.header-controls {
  display: flex;
  align-items: center;
  gap: 12px;
}

.filter-box {
  display: flex;
  align-items: center;
  gap: 6px;
}

.filter-lbl {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-muted);
}

.form-select-sm {
  padding: 6px 10px;
  border-radius: var(--radius-sm);
  border: 1px solid #cbd5e1;
  background: #ffffff;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-main);
  cursor: pointer;
  outline: none;
}

/* Charts Grid */
.charts-grid {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 16px;
}

@media (max-width: 1024px) {
  .charts-grid {
    grid-template-columns: 1fr;
  }
}

.chart-card {
  background: #ffffff;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-card);
  box-shadow: var(--shadow-sm);
  display: flex;
  flex-direction: column;
}

.chart-header {
  padding: 16px 20px;
  border-bottom: 1px solid #f1f5f9;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
}

.chart-title-group {
  display: flex;
  align-items: center;
  gap: 12px;
}

.chart-icon-wrap {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.icon-blue { background: #f0f9ff; color: #0284c7; }
.icon-green { background: #f0fdf4; color: #16a34a; }
.icon-purple { background: #f5f3ff; color: #7c3aed; }

.chart-title {
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--text-main);
}

.chart-subtitle {
  font-size: 0.6875rem;
  color: var(--text-muted);
  display: block;
}

.chart-legend-badge {
  font-size: 0.6875rem;
  font-weight: 600;
  color: #475569;
  display: flex;
  align-items: center;
  gap: 4px;
}

.legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}
.dot-blue { background: #0284c7; }
.dot-green { background: #16a34a; }
.dot-red { background: #dc2626; }
.ml-2 { margin-left: 8px; }

.chart-body {
  padding: 18px;
  position: relative;
  min-height: 280px;
}

.chart-canvas-container {
  position: relative;
  height: 270px;
  width: 100%;
}

.flex-center {
  display: flex;
  align-items: center;
  justify-content: center;
}

.donut-canvas-container {
  position: relative;
  width: 210px;
  height: 210px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.donut-center-info {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  text-align: center;
}

.center-val {
  font-size: 1.65rem;
  font-weight: 800;
  color: #15803d;
  line-height: 1;
}

.center-unit {
  font-size: 0.6875rem;
  font-weight: 700;
  color: #64748b;
  text-transform: uppercase;
  margin-top: 3px;
  letter-spacing: 0.06em;
}

.latex-stat-summary {
  padding: 12px 18px;
  background: #f8fafc;
  border-top: 1px solid #f1f5f9;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.latex-stat-item {
  display: flex;
  align-items: center;
  gap: 10px;
}

.stat-dot {
  width: 10px;
  height: 10px;
  border-radius: 3px;
  flex-shrink: 0;
}
.dot-darkgreen { background: #16a34a; }
.dot-lightgreen { background: #4ade80; }
.dot-amber { background: #d97706; }

.stat-meta {
  display: flex;
  justify-content: space-between;
  width: 100%;
  font-size: 0.75rem;
}

.stat-name {
  color: var(--text-secondary);
}

.stat-weight {
  font-weight: 700;
}

.horizontal-bar-body {
  min-height: 220px;
  padding: 16px 20px;
}

.horizontal-canvas-container {
  position: relative;
  height: 190px;
  width: 100%;
}

.empty-chart-notice {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 220px;
  color: #94a3b8;
  font-size: 0.8125rem;
  font-style: italic;
}

/* Data Table */
.card-header-bar {
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-card);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.table-card-title {
  font-size: 0.9375rem;
  font-weight: 700;
  color: var(--text-main);
}

.badge-note {
  font-size: 0.6875rem;
  color: var(--text-muted);
}

.table-responsive {
  width: 100%;
  overflow-x: auto;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  font-size: 0.8125rem;
}

.data-table th {
  padding: 12px 16px;
  background: #f8fafc;
  color: #475569;
  font-weight: 700;
  font-size: 0.75rem;
  border-bottom: 1px solid var(--border-subtle);
  white-space: nowrap;
}

.data-table td {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-subtle);
  vertical-align: middle;
  white-space: nowrap;
}

.data-table tr:hover {
  background: #fafcf9;
}

.code-badge {
  display: inline-block;
  font-family: monospace;
  font-size: 0.75rem;
  font-weight: 700;
  background: #f1f5f9;
  color: #0f172a;
  border: 1px solid #cbd5e1;
  padding: 2px 8px;
  border-radius: 4px;
}

.vehicle-plate-box {
  display: flex;
  flex-direction: column;
}

.driver-name-text {
  font-weight: 600;
  color: var(--text-main);
}

.route-name-text {
  font-size: 0.75rem;
  color: #334155;
}

.eval-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 0.6875rem;
  font-weight: 700;
}

.eval-pass {
  background: #f0fdf4;
  color: #166534;
  border: 1px solid #bbf7d0;
}

.eval-warn {
  background: #fef2f2;
  color: #991b1b;
  border: 1px solid #fecaca;
}

.flex-col {
  display: flex;
  flex-direction: column;
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

.text-xs { font-size: 0.75rem; }
.text-muted { color: var(--text-muted); }
.text-success { color: #16a34a; }
.text-info { color: #0284c7; }
.text-amber { color: #d97706; }
.text-danger { color: #dc2626; }
.text-primary { color: #15803d; }
.font-bold { font-weight: 700; }
.py-5 { padding-top: 40px; padding-bottom: 40px; }
.text-center { text-align: center; }
</style>
