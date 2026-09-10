<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import TablePagination from '@/components/common/TablePagination.vue';
import {
  Clock,
  Truck,
  Car,
  Settings,
  Sliders,
  Calendar,
  Layers,
  AlertTriangle,
  CheckCircle2,
  RotateCcw,
  Save,
  Info,
  ChevronRight,
  Filter,
  Search,
  Sparkles,
  RefreshCw,
  Fuel,
  ArrowRight,
  ShieldCheck,
  Building,
} from 'lucide-vue-next';
import { useFleetStore } from '@/stores/fleet';
import { useDispatchStore } from '@/stores/dispatch';
import { mockStorage } from '@/services/mockStorage';
import type { TripSettingsConfig, VehicleTripSetting, VehicleType, TransportTrip } from '@/types';
import {
  getVehicleBufferMinutes,
  getVehicleDailyTrips,
  analyzeVehicleTurnaroundGaps,
} from '@/utils/tripHelpers';

const fleetStore = useFleetStore();
const dispatchStore = useDispatchStore();

// Tab đang chọn: 'timeline' | 'vehicles' | 'categories'
const activeTab = ref<'timeline' | 'vehicles' | 'categories'>('timeline');

// Trạng thái cấu hình
const config = ref<TripSettingsConfig>(mockStorage.getTripSettings());
const isSaved = ref(false);
const saveMessage = ref('');

// Bộ lọc cho Tab Timeline & Giãn cách
const selectedDate = ref('2026-09-07'); // Mặc định ngày có các chuyến mẫu
const filterType = ref<string>('ALL');
const filterUnit = ref<string>('ALL');

// Bộ lọc cho Tab Cài đặt từng xe
const searchPlate = ref('');
const filterVehicleTeam = ref('ALL');

onMounted(() => {
  config.value = mockStorage.getTripSettings();
});

// Lưu cấu hình
function handleSaveConfig() {
  mockStorage.saveTripSettings(config.value);
  isSaved.value = true;
  saveMessage.value = 'Đã lưu cấu hình cài đặt chuyến và giãn cách thành công!';
  setTimeout(() => {
    isSaved.value = false;
  }, 3500);
}

// Khôi phục mặc định
function handleResetConfig() {
  if (confirm('Bạn có chắc chắn muốn khôi phục toàn bộ cài đặt thời gian đệm và giãn cách về mặc định ban đầu không?')) {
    config.value = mockStorage.resetTripSettings();
    isSaved.value = true;
    saveMessage.value = 'Đã khôi phục cài đặt gốc thành công!';
    setTimeout(() => {
      isSaved.value = false;
    }, 3500);
  }
}

// Toggle chế độ custom của một xe
function toggleVehicleCustom(setting: VehicleTripSetting) {
  setting.useCustom = !setting.useCustom;
  if (!setting.useCustom) {
    // Reset về theo loại xe
    const typeCfg = config.value.vehicleTypeSettings[setting.vehicleType as keyof typeof config.value.vehicleTypeSettings];
    if (typeCfg) {
      setting.turnaroundBufferMinutes = typeCfg.turnaroundBufferMinutes;
      setting.interVehicleIntervalMinutes = typeCfg.interVehicleIntervalMinutes;
      setting.cleaningDurationMinutes = typeCfg.cleaningDurationMinutes;
    }
  }
}

// Lấy nhãn loại xe
function getVehicleTypeLabel(type: string): string {
  switch (type) {
    case 'LatexTruck':
      return 'Xe bồn chở mủ';
    case 'PassengerCar':
      return 'Xe chở người / khách';
    case 'MillingMachine':
      return 'Xe cơ giới / xúc';
    default:
      return type;
  }
}

// ==========================================
// DỮ LIỆU TAB 1: SƠ ĐỒ TIMELINE & GIÃN CÁCH XE
// ==========================================

// Danh sách xe thỏa bộ lọc ở Tab 1
const timelineVehicles = computed(() => {
  return fleetStore.vehicles.filter((v) => {
    if (filterType.value !== 'ALL' && v.vehicleType !== filterType.value) return false;
    if (filterUnit.value === 'Factory' && v.operatingUnitType !== 'Factory') return false;
    if (filterUnit.value.startsWith('Team:') && v.teamName !== filterUnit.value.replace('Team:', '')) return false;
    return true;
  });
});

// Các chuyến xe trong ngày được chọn
const dayTrips = computed(() => {
  return dispatchStore.trips.filter(
    (t) =>
      t.status !== 'CANCELLED' &&
      t.scheduledStartTime &&
      t.scheduledStartTime.slice(0, 10) === selectedDate.value
  );
});

// Xe có chuyến trong ngày
const activeVehiclesInDay = computed(() => {
  const activeIds = new Set(dayTrips.value.map((t) => t.vehicleId));
  return fleetStore.vehicles.filter((v) => activeIds.has(v.id));
});

// Phân tích ma trận giãn cách giữa các xe trong ngày (Inter-Vehicle Departure Gaps)
interface InterVehicleGapPair {
  vehicleA: string;
  vehicleB: string;
  tripA: TransportTrip;
  tripB: TransportTrip;
  diffMinutes: number;
  recommendedMinutes: number;
  isSafe: boolean;
  notes: string;
}

const interVehicleGaps = computed<InterVehicleGapPair[]>(() => {
  const trips = [...dayTrips.value].sort(
    (a, b) => new Date(a.scheduledStartTime).getTime() - new Date(b.scheduledStartTime).getTime()
  );
  const pairs: InterVehicleGapPair[] = [];

  for (let i = 0; i < trips.length; i++) {
    for (let j = i + 1; j < trips.length; j++) {
      const tA = trips[i];
      const tB = trips[j];

      // Chỉ xét giữa 2 xe khác nhau
      if (tA.vehicleId === tB.vehicleId) continue;

      const startA = new Date(tA.scheduledStartTime).getTime();
      const startB = new Date(tB.scheduledStartTime).getTime();
      const diffMinutes = Math.round(Math.abs(startB - startA) / 60000);

      // Nếu 2 xe xuất phát trong vòng 60 phút
      if (diffMinutes <= 60) {
        const { interVehicleMinutes } = getVehicleBufferMinutes(tB.vehicleId);
        const isSafe = diffMinutes >= interVehicleMinutes;
        pairs.push({
          vehicleA: tA.vehiclePlate,
          vehicleB: tB.vehiclePlate,
          tripA: tA,
          tripB: tB,
          diffMinutes,
          recommendedMinutes: interVehicleMinutes,
          isSafe,
          notes: isSafe
            ? `Giãn cách ${diffMinutes} phút đảm bảo an toàn trạm cân (>= ${interVehicleMinutes}p)`
            : `⚠️ Giãn cách chỉ ${diffMinutes} phút — Cần tối thiểu ${interVehicleMinutes} phút để tránh ùn ứ trạm tiếp nhận`,
        });
      }
    }
  }

  return pairs;
});

// Giờ từ 06:00 đến 18:00 (13 mốc giờ)
const timelineHours = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
const TIMELINE_START_HOUR = 6;
const TIMELINE_END_HOUR = 18;
const TOTAL_MINUTES = (TIMELINE_END_HOUR - TIMELINE_START_HOUR) * 60; // 720 phút

// Tính vị trí % left và width cho một khoảng thời gian trên thanh Timeline
function getTimelineBlockStyle(startTimeStr: string, endTimeStr: string) {
  try {
    const startDate = new Date(startTimeStr);
    const endDate = new Date(endTimeStr);

    const startMin = startDate.getHours() * 60 + startDate.getMinutes() - TIMELINE_START_HOUR * 60;
    const endMin = endDate.getHours() * 60 + endDate.getMinutes() - TIMELINE_START_HOUR * 60;

    const clampedStart = Math.max(0, Math.min(TOTAL_MINUTES, startMin));
    const clampedEnd = Math.max(0, Math.min(TOTAL_MINUTES, endMin));

    const leftPercent = (clampedStart / TOTAL_MINUTES) * 100;
    const widthPercent = Math.max(2, ((clampedEnd - clampedStart) / TOTAL_MINUTES) * 100);

    return {
      left: `${leftPercent}%`,
      width: `${widthPercent}%`,
    };
  } catch {
    return { left: '0%', width: '10%' };
  }
}

// Tính vị trí % left và width cho khoảng Đệm giữa 2 chuyến
function getTimelineGapStyle(endTimeTrip1: string, startTimeTrip2: string) {
  try {
    const endDate = new Date(endTimeTrip1);
    const startDate = new Date(startTimeTrip2);

    const startMin = endDate.getHours() * 60 + endDate.getMinutes() - TIMELINE_START_HOUR * 60;
    const endMin = startDate.getHours() * 60 + startDate.getMinutes() - TIMELINE_START_HOUR * 60;

    const clampedStart = Math.max(0, Math.min(TOTAL_MINUTES, startMin));
    const clampedEnd = Math.max(0, Math.min(TOTAL_MINUTES, endMin));

    const leftPercent = (clampedStart / TOTAL_MINUTES) * 100;
    const widthPercent = Math.max(1, ((clampedEnd - clampedStart) / TOTAL_MINUTES) * 100);

    return {
      left: `${leftPercent}%`,
      width: `${widthPercent}%`,
    };
  } catch {
    return { left: '0%', width: '5%' };
  }
}

// ==========================================
// DỮ LIỆU TAB 2: CÀI ĐẶT TỪNG XE CỤ THỂ
// ==========================================
const filteredVehicleSettings = computed(() => {
  return config.value.specificVehicleSettings.filter((s) => {
    if (searchPlate.value && !s.licensePlate.toLowerCase().includes(searchPlate.value.toLowerCase())) {
      return false;
    }
    if (filterVehicleTeam.value !== 'ALL') {
      if (filterVehicleTeam.value === 'Factory' && s.operatingUnitType !== 'Factory') return false;
      if (filterVehicleTeam.value.startsWith('Team:') && s.teamName !== filterVehicleTeam.value.replace('Team:', '')) return false;
    }
    return true;
  });
});

// Phân trang Tab 2: Cài đặt từng xe
const vehPage = ref(1);
const vehPageSize = ref(8);
const paginatedVehicleSettings = computed(() => {
  const start = (vehPage.value - 1) * vehPageSize.value;
  return filteredVehicleSettings.value.slice(start, start + vehPageSize.value);
});
watch([searchPlate, filterVehicleTeam], () => {
  vehPage.value = 1;
});

// Phân trang Tab 1: Ma trận giãn cách giữa các xe
const gapPage = ref(1);
const gapPageSize = ref(5);
const paginatedInterVehicleGaps = computed(() => {
  const start = (gapPage.value - 1) * gapPageSize.value;
  return interVehicleGaps.value.slice(start, start + gapPageSize.value);
});
watch(selectedDate, () => {
  gapPage.value = 1;
});

// Áp dụng cấu hình mẫu nhanh cho các xe theo loại
function applyBatchTemplate(type: VehicleType) {
  const typeCfg = config.value.vehicleTypeSettings[type as keyof typeof config.value.vehicleTypeSettings];
  if (!typeCfg) return;

  if (confirm(`Áp dụng thông số chuẩn (${typeCfg.turnaroundBufferMinutes}p đệm, ${typeCfg.interVehicleIntervalMinutes}p giãn cách) cho tất cả ${getVehicleTypeLabel(type)}?`)) {
    config.value.specificVehicleSettings
      .filter((s) => s.vehicleType === type)
      .forEach((s) => {
        s.turnaroundBufferMinutes = typeCfg.turnaroundBufferMinutes;
        s.interVehicleIntervalMinutes = typeCfg.interVehicleIntervalMinutes;
        s.cleaningDurationMinutes = typeCfg.cleaningDurationMinutes;
      });
  }
}
</script>

<template>
  <div class="trip-settings-view">
    <!-- HEADER TRANG GỌN GÀNG -->
    <div class="page-header">
      <div>
        <h1 class="page-title">Cài Đặt Chuyến & Giãn Cách</h1>
        <p class="page-subtitle">
          Cấu hình thời gian đệm giữa các chuyến và khoảng cách xuất phát an toàn giữa các xe
        </p>
      </div>

      <div class="header-actions">
        <button class="btn btn-outline btn-sm" @click="handleResetConfig" title="Khôi phục mặc định">
          <RotateCcw :size="14" />
          <span>Mặc định</span>
        </button>

        <button class="btn btn-primary btn-sm" @click="handleSaveConfig">
          <Save :size="14" />
          <span>Lưu Cấu Hình</span>
        </button>
      </div>
    </div>

    <!-- Alert thông báo lưu -->
    <div v-if="isSaved" class="alert alert-success mt-2 animate-fade-in">
      <CheckCircle2 :size="16" />
      <span>{{ saveMessage }}</span>
    </div>

    <!-- THANH CHUYỂN TABS GỌN GÀNG -->
    <div class="settings-tabs-bar mt-3">
      <button
        class="tab-item-btn"
        :class="{ active: activeTab === 'timeline' }"
        @click="activeTab = 'timeline'"
      >
        <Calendar :size="15" />
        <span>Sơ Đồ Giãn Cách & Trục Thời Gian</span>
        <span class="tab-badge">{{ dayTrips.length }} chuyến</span>
      </button>

      <button
        class="tab-item-btn"
        :class="{ active: activeTab === 'vehicles' }"
        @click="activeTab = 'vehicles'"
      >
        <Truck :size="15" />
        <span>Cài Đặt Từng Xe Cụ Thể</span>
        <span class="tab-badge">{{ config.specificVehicleSettings.length }} xe</span>
      </button>

      <button
        class="tab-item-btn"
        :class="{ active: activeTab === 'categories' }"
        @click="activeTab = 'categories'"
      >
        <Sliders :size="15" />
        <span>Quy Chuẩn Chung & Loại Xe</span>
      </button>
    </div>

    <!-- ======================================================= -->
    <!-- TAB 1: SƠ ĐỒ GIÃN CÁCH & TRỤC THỜI GIAN -->
    <!-- ======================================================= -->
    <div v-if="activeTab === 'timeline'" class="tab-content mt-3">
      <!-- THANH ĐIỀU KHIỂN & LỌC RÕ RÀNG, DỄ NHÌN -->
      <div class="filter-toolbar card">
        <div class="filter-toolbar-inner">
          <div class="filter-fields-group">
            <div class="filter-field-item">
              <label class="filter-field-label">
                <Calendar :size="13" class="text-primary" />
                <span>Ngày kiểm tra:</span>
              </label>
              <input v-model="selectedDate" type="date" class="filter-input-control filter-input-date" />
            </div>

            <div class="filter-field-item">
              <label class="filter-field-label">
                <Truck :size="13" class="text-primary" />
                <span>Loại phương tiện:</span>
              </label>
              <select v-model="filterType" class="filter-input-control filter-select-type">
                <option value="ALL">-- Tất cả loại xe --</option>
                <option value="LatexTruck">Xe bồn mủ (Latex)</option>
                <option value="PassengerCar">Xe khách / công vụ</option>
                <option value="MillingMachine">Xe cơ giới / xúc</option>
              </select>
            </div>

            <div class="filter-field-item">
              <label class="filter-field-label">
                <Building :size="13" class="text-primary" />
                <span>Đơn vị trực thuộc:</span>
              </label>
              <select v-model="filterUnit" class="filter-input-control filter-select-unit">
                <option value="ALL">-- Tất cả đơn vị --</option>
                <option value="Factory">Nhà máy chế biến</option>
                <option value="Team:Đội 1">Đội sản xuất 1</option>
                <option value="Team:Đội 2">Đội sản xuất 2</option>
                <option value="Team:Đội 3">Đội sản xuất 3</option>
                <option value="Team:Đội 4">Đội sản xuất 4</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <!-- KHỐI BIỂU ĐỒ TRỤC THỜI GIAN (GANTT TIMELINE) -->
      <div class="card mt-3 timeline-card">
        <div class="card-header flex-between py-2 px-3">
          <div class="flex items-center gap-2">
            <h3 class="card-title text-sm font-bold mb-0">Trục Phân Bổ Chuyến Xe & Thời Gian Đệm (Ngày {{ selectedDate }})</h3>
          </div>

          <div class="legend-box">
            <span class="legend-item"><span class="legend-color bg-completed"></span> Hoàn thành</span>
            <span class="legend-item"><span class="legend-color bg-inprogress"></span> Đang chạy</span>
            <span class="legend-item"><span class="legend-color bg-dispatched"></span> Đã xếp lịch</span>
            <span class="legend-item"><span class="legend-color bg-gap"></span> Đệm nghỉ giữa 2 chuyến</span>
          </div>
        </div>

        <div class="timeline-wrapper">
          <!-- Thước đo thời gian (06:00 -> 18:00) -->
          <div class="timeline-header-ruler">
            <div class="ruler-label-col">Phương Tiện / Đội</div>
            <div class="ruler-hours-track">
              <div
                v-for="h in timelineHours"
                :key="h"
                class="ruler-hour-marker"
              >
                <span>{{ String(h).padStart(2, '0') }}:00</span>
              </div>
            </div>
          </div>

          <!-- Các dòng từng xe -->
          <div class="timeline-rows-container">
            <div
              v-for="v in timelineVehicles"
              :key="v.id"
              class="timeline-vehicle-row"
              :class="{ 'has-trips': getVehicleDailyTrips(v.id, selectedDate, dispatchStore.trips).length > 0 }"
            >
              <!-- Cột thông tin xe -->
              <div class="vehicle-label-col">
                <div class="veh-id-badge">
                  <strong class="font-mono">{{ v.licensePlate }}</strong>
                  <span class="veh-type-tag">{{ getVehicleTypeLabel(v.vehicleType) }}</span>
                </div>
                <div class="veh-meta-sub">
                  <span v-if="v.operatingUnitType === 'Factory'" class="unit-tag factory">Nhà máy</span>
                  <span v-else class="unit-tag team">{{ v.teamName || 'Đội' }}</span>
                  <span class="text-xxs text-muted ml-1">• Đệm {{ getVehicleBufferMinutes(v.id).turnaroundMinutes }}p</span>
                </div>
              </div>

              <!-- Dòng thời gian 24 giờ của xe -->
              <div class="vehicle-track-col">
                <!-- Lưới vạch giờ dọc mờ -->
                <div class="grid-hour-lines">
                  <div v-for="h in timelineHours" :key="'grid-' + h" class="hour-line"></div>
                </div>

                <!-- Danh sách chuyến của xe này -->
                <template v-if="getVehicleDailyTrips(v.id, selectedDate, dispatchStore.trips).length > 0">
                  <!-- Render các block chuyến xe -->
                  <div
                    v-for="(t, idx) in getVehicleDailyTrips(v.id, selectedDate, dispatchStore.trips)"
                    :key="t.id"
                    class="trip-block"
                    :class="'trip-status-' + t.status.toLowerCase()"
                    :style="getTimelineBlockStyle(t.scheduledStartTime, t.scheduledEndTime)"
                    :title="`${t.tripCode} (Chuyến #${idx + 1}): ${t.scheduledStartTime.slice(11, 16)} - ${t.scheduledEndTime.slice(11, 16)} | Tuyến: ${t.routeName}`"
                  >
                    <div class="trip-block-inner">
                      <span class="trip-block-code font-mono">#{{ idx + 1 }} {{ t.tripCode }}</span>
                      <span class="trip-block-time">{{ t.scheduledStartTime.slice(11, 16) }} - {{ t.scheduledEndTime.slice(11, 16) }}</span>
                    </div>
                  </div>

                  <!-- Render các khoảng đệm giữa 2 chuyến (Turnaround Gap) -->
                  <template v-for="(gap, gIdx) in analyzeVehicleTurnaroundGaps(v.id, selectedDate, dispatchStore.trips)" :key="'gap-' + gIdx">
                    <div
                      class="turnaround-gap-block"
                      :class="gap.isAdequate ? 'gap-adequate' : 'gap-violation'"
                      :style="getTimelineGapStyle(gap.trip1.scheduledEndTime, gap.trip2.scheduledStartTime)"
                      :title="`Khoảng đệm giữa Chuyến #${gIdx + 1} và #${gIdx + 2}: ${gap.gapMinutes} phút (Quy chuẩn: ${gap.requiredBufferMinutes} phút)`"
                    >
                      <div class="gap-inner-label">
                        <Clock :size="10" />
                        <span>Đệm: {{ gap.gapMinutes }}p</span>
                        <span v-if="gap.isAdequate" class="gap-check">✓</span>
                        <span v-else class="gap-warn">⚠️</span>
                      </div>
                    </div>
                  </template>
                </template>

                <!-- Xe không có chuyến -->
                <div v-else class="empty-track-placeholder">
                  <span>Trống lịch</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- BẢNG SO SÁNH GIÃN CÁCH KHỞI HÀNH GIỮA CÁC XE -->
      <div class="card mt-3">
        <div class="card-header flex-between py-2 px-3">
          <div>
            <h3 class="card-title text-sm font-bold mb-0">Ma Trận So Sánh Thời Gian Giãn Cách Giữa Các Xe</h3>
            <span class="text-xs text-muted">Khoảng cách giờ xuất phát giữa các xe trong ngày để tránh dồn ứ trạm cân và nhà máy</span>
          </div>

          <span class="badge badge-blue">
            {{ interVehicleGaps.length }} cặp xe trong khung 60p
          </span>
        </div>

        <div v-if="interVehicleGaps.length > 0" class="table-responsive">
          <table class="table align-middle table-sm">
            <thead>
              <tr>
                <th style="width: 140px;">Xe Xuất Phát Trước</th>
                <th style="width: 140px;">Xe Xuất Phát Sau</th>
                <th>Giờ Xuất Phát Xe 1</th>
                <th>Giờ Xuất Phát Xe 2</th>
                <th class="text-center">Khoảng Cách</th>
                <th class="text-center">Quy Chuẩn</th>
                <th>Đánh Giá</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(p, idx) in paginatedInterVehicleGaps" :key="idx">
                <td>
                  <strong class="font-mono text-primary">{{ p.vehicleA }}</strong>
                  <div class="text-xxs text-muted">{{ p.tripA.tripCode }}</div>
                </td>
                <td>
                  <strong class="font-mono text-primary">{{ p.vehicleB }}</strong>
                  <div class="text-xxs text-muted">{{ p.tripB.tripCode }}</div>
                </td>
                <td>
                  <span class="font-mono font-bold">{{ p.tripA.scheduledStartTime.slice(11, 16) }}</span>
                  <div class="text-xxs text-slate-500 truncate max-w-xs">{{ p.tripA.routeName }}</div>
                </td>
                <td>
                  <span class="font-mono font-bold">{{ p.tripB.scheduledStartTime.slice(11, 16) }}</span>
                  <div class="text-xxs text-slate-500 truncate max-w-xs">{{ p.tripB.routeName }}</div>
                </td>
                <td class="text-center">
                  <span
                    class="badge-interval-pill"
                    :class="p.isSafe ? 'pill-safe' : 'pill-warning'"
                  >
                    <Clock :size="11" />
                    <strong>{{ p.diffMinutes }} phút</strong>
                  </span>
                </td>
                <td class="text-center">
                  <span class="text-xs font-semibold text-slate-700">&ge; {{ p.recommendedMinutes }} phút</span>
                </td>
                <td>
                  <div class="status-eval-cell" :class="p.isSafe ? 'text-emerald-700' : 'text-amber-700'">
                    <CheckCircle2 v-if="p.isSafe" :size="14" class="text-success inline mr-1" />
                    <AlertTriangle v-else :size="14" class="text-amber-600 inline mr-1" />
                    <span class="text-xs font-medium">{{ p.notes }}</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

          <TablePagination
            v-model:currentPage="gapPage"
            v-model:pageSize="gapPageSize"
            :totalItems="interVehicleGaps.length"
            :pageSizeOptions="[5, 10, 20]"
          />
        </div>

        <div v-else class="text-center py-4 text-muted">
          <CheckCircle2 :size="20" class="text-success mb-1" />
          <p class="mb-0 text-xs font-medium text-slate-600">
            Không có cặp xe nào xuất bến quá gần nhau trong ngày {{ selectedDate }}. Lịch trình phân bổ giãn cách an toàn.
          </p>
        </div>
      </div>
    </div>

    <!-- ======================================================= -->
    <!-- TAB 2: CÀI ĐẶT TỪNG XE CỤ THỂ -->
    <!-- ======================================================= -->
    <div v-if="activeTab === 'vehicles'" class="tab-content mt-3">
      <!-- THANH TÌM KIẾM & BỘ LỌC XE GỌN GÀNG, ĐỒNG BỘ -->
      <div class="filter-toolbar card">
        <div class="veh-filter-toolbar-inner">
          <div class="veh-filter-left-group">
            <!-- Ô TÌM KIẾM BIỂN SỐ XE -->
            <div class="veh-search-box">
              <Search :size="15" class="veh-search-icon" />
              <input
                v-model="searchPlate"
                type="text"
                class="veh-search-input"
                placeholder="Tìm theo biển số xe..."
              />
            </div>

            <!-- CHỌN ĐƠN VỊ TRỰC THUỘC -->
            <div class="veh-select-box">
              <Building :size="14" class="veh-select-icon" />
              <select v-model="filterVehicleTeam" class="veh-select-control">
                <option value="ALL">-- Tất cả đơn vị --</option>
                <option value="Factory">Xe Nhà máy chế biến</option>
                <option value="Team:Đội 1">Xe Đội 1</option>
                <option value="Team:Đội 2">Xe Đội 2</option>
                <option value="Team:Đội 3">Xe Đội 3</option>
                <option value="Team:Đội 4">Xe Đội 4</option>
              </select>
            </div>

            <!-- CHIP ĐẾM SỐ XE -->
            <div class="veh-counter-tag">
              <span>Hiển thị:</span>
              <strong>{{ filteredVehicleSettings.length }}</strong>
              <span class="text-muted">/ {{ config.specificVehicleSettings.length }} xe</span>
            </div>
          </div>

          <!-- NÚT ÁP DỤNG NHANH THEO MẪU -->
          <div class="veh-batch-actions">
            <span class="veh-batch-label">Áp dụng mẫu:</span>
            <button
              type="button"
              class="btn-batch-template btn-batch-latex"
              @click="applyBatchTemplate('LatexTruck')"
              title="Áp dụng chuẩn 45p đệm & 20p giãn cách cho toàn bộ xe bồn mủ"
            >
              <Truck :size="14" />
              <span>Xe Bồn Mủ (45p)</span>
            </button>
            <button
              type="button"
              class="btn-batch-template btn-batch-passenger"
              @click="applyBatchTemplate('PassengerCar')"
              title="Áp dụng chuẩn 20p đệm & 10p giãn cách cho toàn bộ xe khách"
            >
              <Car :size="14" />
              <span>Xe Khách (20p)</span>
            </button>
          </div>
        </div>
      </div>

      <!-- BẢNG DANH SÁCH CẤU HÌNH TỪNG XE -->
      <div class="card p-0">
        <div class="table-responsive">
          <table class="table align-middle specific-vehicles-table mb-0">
            <thead>
              <tr>
                <th style="width: 130px;">Phương Tiện</th>
                <th style="width: 170px;">Loại Xe</th>
                <th style="width: 120px;">Đơn Vị</th>
                <th style="width: 140px;" class="text-center">Chế Độ Áp Dụng</th>
                <th style="width: 130px;" class="text-center">Đệm 2 Chuyến</th>
                <th style="width: 150px;" class="text-center">Giãn Cách Xuất Bến</th>
                <th>Ghi Chú Vận Hành</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="s in paginatedVehicleSettings"
                :key="s.vehicleId"
                :class="{ 'row-custom-active': s.useCustom }"
              >
                <td>
                  <strong class="font-mono text-slate-800 text-sm">{{ s.licensePlate }}</strong>
                </td>

                <td>
                  <span class="veh-type-cell">
                    {{ getVehicleTypeLabel(s.vehicleType) }}
                  </span>
                </td>

                <td>
                  <span v-if="s.operatingUnitType === 'Factory'" class="badge-unit-factory">Nhà máy</span>
                  <span v-else class="badge-unit-team">{{ s.teamName || 'Đội' }}</span>
                </td>

                <td class="text-center">
                  <button
                    type="button"
                    class="btn-toggle-custom"
                    :class="{ active: s.useCustom }"
                    @click="toggleVehicleCustom(s)"
                  >
                    <span class="toggle-slider"></span>
                    <span class="toggle-text">{{ s.useCustom ? 'Tùy biến' : 'Chuẩn loại' }}</span>
                  </button>
                </td>

                <td class="text-center">
                  <div class="input-spin-group" :class="{ disabled: !s.useCustom }">
                    <input
                      v-model.number="s.turnaroundBufferMinutes"
                      type="number"
                      class="form-control text-center font-bold"
                      :disabled="!s.useCustom"
                      min="10"
                      max="180"
                      step="5"
                    />
                    <span class="input-unit">phút</span>
                  </div>
                </td>

                <td class="text-center">
                  <div class="input-spin-group" :class="{ disabled: !s.useCustom }">
                    <input
                      v-model.number="s.interVehicleIntervalMinutes"
                      type="number"
                      class="form-control text-center font-bold"
                      :disabled="!s.useCustom"
                      min="5"
                      max="60"
                      step="5"
                    />
                    <span class="input-unit">phút</span>
                  </div>
                </td>

                <td>
                  <input
                    v-model="s.notes"
                    type="text"
                    class="veh-note-input"
                    :disabled="!s.useCustom"
                    placeholder="Ghi chú đặc thù..."
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <TablePagination
          v-model:currentPage="vehPage"
          v-model:pageSize="vehPageSize"
          :totalItems="filteredVehicleSettings.length"
          :pageSizeOptions="[5, 8, 15, 30]"
        />
      </div>
    </div>

    <!-- ======================================================= -->
    <!-- TAB 3: QUY CHUẨN CHUNG & THEO LOẠI XE -->
    <!-- ======================================================= -->
    <div v-if="activeTab === 'categories'" class="tab-content mt-3">
      <div class="grid-2 gap-4">
        <!-- Cột 1: Cấu hình mặc định toàn hệ thống -->
        <div class="card p-4 category-panel-card">
          <div class="panel-card-header">
            <div class="panel-header-title-wrap">
              <div class="panel-icon-wrap primary">
                <Settings :size="18" />
              </div>
              <div>
                <h3 class="panel-title">Quy Chuẩn Mặc Định Toàn Hệ Thống</h3>
                <p class="panel-subtitle">Áp dụng cho các phương tiện chưa có cấu hình tùy biến riêng</p>
              </div>
            </div>
          </div>

          <div class="default-rules-list">
            <!-- Rule 1: Đệm 2 chuyến -->
            <div class="rule-setting-card">
              <div class="rule-info">
                <div class="rule-title-row">
                  <Clock :size="16" class="text-primary" />
                  <strong class="rule-title">Thời gian đệm nghỉ giữa 2 chuyến:</strong>
                </div>
                <p class="rule-desc">
                  Thời gian bàn giao chứng từ, kiểm tra lốp, phanh và nghỉ ngơi trước chuyến mới (khuyến nghị 30 - 45 phút).
                </p>
              </div>
              <div class="rule-input-wrap">
                <div class="input-unit-composite">
                  <input
                    v-model.number="config.defaultTurnaroundMinutes"
                    type="number"
                    class="composite-input"
                    min="10"
                    max="180"
                    step="5"
                  />
                  <span class="composite-unit">phút</span>
                </div>
              </div>
            </div>

            <!-- Rule 2: Giãn cách xuất bến -->
            <div class="rule-setting-card">
              <div class="rule-info">
                <div class="rule-title-row">
                  <ArrowRight :size="16" class="text-emerald-600" />
                  <strong class="rule-title">Giãn cách xuất bến tối thiểu giữa 2 xe:</strong>
                </div>
                <p class="rule-desc">
                  Khoảng cách thời gian tối thiểu giữa giờ xuất bến của 2 xe khác nhau, tránh dồn ứ trạm cân hoặc trạm tiếp nhận nhà máy.
                </p>
              </div>
              <div class="rule-input-wrap">
                <div class="input-unit-composite">
                  <input
                    v-model.number="config.defaultInterVehicleIntervalMinutes"
                    type="number"
                    class="composite-input"
                    min="5"
                    max="60"
                    step="5"
                  />
                  <span class="composite-unit">phút</span>
                </div>
              </div>
            </div>

            <!-- Rule 3: Chế độ điều xe cứu viện khẩn cấp -->
            <div class="emergency-override-card" :class="{ active: config.allowEmergencyOverride }">
              <div class="emergency-card-body">
                <div class="emergency-icon-wrap">
                  <ShieldCheck v-if="config.allowEmergencyOverride" :size="20" class="text-amber-600" />
                  <AlertTriangle v-else :size="20" class="text-slate-400" />
                </div>
                <div class="emergency-info">
                  <strong class="emergency-title">Bỏ qua đệm khi Điều Xe Cứu Viện Khẩn Cấp</strong>
                  <p class="emergency-desc">
                    Cho phép điều phối viên xuất chuyến ngay lập tức cho xe rỗng ứng cứu sự cố, không áp dụng thời gian đệm thông thường.
                  </p>
                </div>
                <div class="emergency-toggle">
                  <label class="toggle-switch-label">
                    <input
                      v-model="config.allowEmergencyOverride"
                      type="checkbox"
                      class="toggle-switch-input"
                    />
                    <span class="toggle-switch-slider"></span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Cột 2: Cấu hình quy chuẩn theo từng loại phương tiện -->
        <div class="card p-4 category-panel-card">
          <div class="panel-card-header">
            <div class="panel-header-title-wrap">
              <div class="panel-icon-wrap info">
                <Layers :size="18" />
              </div>
              <div>
                <h3 class="panel-title">Định Mức Theo Chủng Loại Xe</h3>
                <p class="panel-subtitle">Thời gian đệm nghỉ và khoảng cách xuất phát an toàn theo từng phương tiện</p>
              </div>
            </div>
          </div>

          <div class="type-cards-list">
            <!-- Xe bồn téc chở mủ -->
            <div class="type-setting-card">
              <div class="type-card-header">
                <div class="type-title-box">
                  <div class="type-icon-circle latex">
                    <Truck :size="18" />
                  </div>
                  <div>
                    <strong class="type-name">Xe Bồn Chở Mủ</strong>
                    <span class="type-name-sub">Latex Truck</span>
                  </div>
                </div>
                <span class="badge-cat latex">Mủ Cao Su</span>
              </div>

              <div class="type-params-grid">
                <div class="type-param-item">
                  <span class="type-param-label">
                    <Clock :size="13" class="text-slate-400" />
                    Đệm 2 chuyến:
                  </span>
                  <div class="input-unit-composite">
                    <input
                      v-model.number="config.vehicleTypeSettings.LatexTruck.turnaroundBufferMinutes"
                      type="number"
                      class="composite-input"
                      min="10"
                      max="180"
                      step="5"
                    />
                    <span class="composite-unit">phút</span>
                  </div>
                </div>

                <div class="type-param-item">
                  <span class="type-param-label">
                    <ArrowRight :size="13" class="text-slate-400" />
                    Giãn cách xuất bến:
                  </span>
                  <div class="input-unit-composite">
                    <input
                      v-model.number="config.vehicleTypeSettings.LatexTruck.interVehicleIntervalMinutes"
                      type="number"
                      class="composite-input"
                      min="5"
                      max="60"
                      step="5"
                    />
                    <span class="composite-unit">phút</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Xe chở người / cán bộ -->
            <div class="type-setting-card">
              <div class="type-card-header">
                <div class="type-title-box">
                  <div class="type-icon-circle passenger">
                    <Car :size="18" />
                  </div>
                  <div>
                    <strong class="type-name">Xe Chở Người / Cán Bộ</strong>
                    <span class="type-name-sub">Passenger Car</span>
                  </div>
                </div>
                <span class="badge-cat passenger">Công Vụ</span>
              </div>

              <div class="type-params-grid">
                <div class="type-param-item">
                  <span class="type-param-label">
                    <Clock :size="13" class="text-slate-400" />
                    Đệm 2 chuyến:
                  </span>
                  <div class="input-unit-composite">
                    <input
                      v-model.number="config.vehicleTypeSettings.PassengerCar.turnaroundBufferMinutes"
                      type="number"
                      class="composite-input"
                      min="10"
                      max="180"
                      step="5"
                    />
                    <span class="composite-unit">phút</span>
                  </div>
                </div>

                <div class="type-param-item">
                  <span class="type-param-label">
                    <ArrowRight :size="13" class="text-slate-400" />
                    Giãn cách xuất bến:
                  </span>
                  <div class="input-unit-composite">
                    <input
                      v-model.number="config.vehicleTypeSettings.PassengerCar.interVehicleIntervalMinutes"
                      type="number"
                      class="composite-input"
                      min="5"
                      max="60"
                      step="5"
                    />
                    <span class="composite-unit">phút</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Xe cơ giới / Máy xúc -->
            <div class="type-setting-card">
              <div class="type-card-header">
                <div class="type-title-box">
                  <div class="type-icon-circle milling">
                    <Sliders :size="18" />
                  </div>
                  <div>
                    <strong class="type-name">Xe Cơ Giới / Máy Xúc</strong>
                    <span class="type-name-sub">Milling Machine</span>
                  </div>
                </div>
                <span class="badge-cat milling">Cơ Giới</span>
              </div>

              <div class="type-params-grid">
                <div class="type-param-item">
                  <span class="type-param-label">
                    <Clock :size="13" class="text-slate-400" />
                    Đệm 2 ca máy:
                  </span>
                  <div class="input-unit-composite">
                    <input
                      v-model.number="config.vehicleTypeSettings.MillingMachine.turnaroundBufferMinutes"
                      type="number"
                      class="composite-input"
                      min="10"
                      max="180"
                      step="5"
                    />
                    <span class="composite-unit">phút</span>
                  </div>
                </div>

                <div class="type-param-item">
                  <span class="type-param-label">
                    <ArrowRight :size="13" class="text-slate-400" />
                    Giãn cách xuất bến:
                  </span>
                  <div class="input-unit-composite">
                    <input
                      v-model.number="config.vehicleTypeSettings.MillingMachine.interVehicleIntervalMinutes"
                      type="number"
                      class="composite-input"
                      min="5"
                      max="60"
                      step="5"
                    />
                    <span class="composite-unit">phút</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.trip-settings-view {
  padding-bottom: 50px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
  background: #ffffff;
  padding: 16px 20px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-card);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 14px;
}

.header-icon-box {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  background: #ecfdf5;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #16a34a;
  border: 1px solid #bbf7d0;
}

.page-title {
  font-size: 1.25rem;
  font-weight: 800;
  color: #0f172a;
  margin-bottom: 2px;
}

.page-subtitle {
  font-size: 0.8125rem;
  color: #64748b;
  margin-bottom: 0;
}

.badge-system-version {
  display: inline-flex;
  padding: 2px 7px;
  border-radius: 4px;
  background: #f1f5f9;
  color: #475569;
  font-size: 0.6875rem;
  font-weight: 700;
  border: 1px solid #cbd5e1;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

/* TABS BAR */
.settings-tabs-bar {
  display: flex;
  gap: 6px;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  padding: 4px;
  border-radius: var(--radius-md);
  flex-wrap: wrap;
  margin-bottom: 14px;
}

.tab-item-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: #475569;
  font-size: 0.8125rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s ease;
}

.tab-item-btn:hover {
  color: #0f172a;
  background: rgba(255, 255, 255, 0.5);
}

.tab-item-btn.active {
  background: #ffffff;
  color: #15803d;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.tab-badge {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 10px;
  background: #f1f5f9;
  color: #64748b;
  font-size: 0.6875rem;
  font-weight: 800;
}

.tab-item-btn.active .tab-badge {
  background: #dcfce7;
  color: #166534;
}

/* FILTER CONTROLS TOOLBAR */
.filter-toolbar {
  background: #ffffff;
  border: 1px solid var(--border-card, #e2e8f0);
  border-radius: 12px;
  padding: 12px 18px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  margin-bottom: 12px;
}

.filter-toolbar-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;
}

.filter-fields-group {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
}

.filter-field-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.filter-field-label {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 0.75rem;
  font-weight: 700;
  color: #475569;
  margin-bottom: 0;
  user-select: none;
}

.filter-input-control {
  height: 38px;
  background: #f8fafc;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 6px 12px;
  font-size: 0.8125rem;
  font-weight: 600;
  color: #1e293b;
  transition: all 0.15s ease;
  outline: none;
}

.filter-input-control:hover {
  border-color: #94a3b8;
  background: #ffffff;
}

.filter-input-control:focus {
  border-color: #10b981;
  background: #ffffff;
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.15);
}

.filter-input-date {
  width: 155px;
}

.filter-select-type {
  min-width: 195px;
}

.filter-select-unit {
  min-width: 175px;
}

/* FILTER STATS PANEL */
.filter-stats-panel {
  display: flex;
  align-items: center;
  gap: 14px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 6px 16px;
}

.stat-box {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.stat-title {
  font-size: 0.6875rem;
  font-weight: 600;
  color: #64748b;
  line-height: 1.2;
}

.stat-number {
  font-size: 1.0625rem;
  font-weight: 800;
  line-height: 1.2;
  margin-top: 1px;
}

.stat-sep {
  width: 1px;
  height: 28px;
  background: #e2e8f0;
}

.stat-box-warn .stat-title {
  color: #b45309;
}

/* TIMELINE STYLES */
.timeline-card {
  overflow: hidden;
}

.legend-box {
  display: flex;
  align-items: center;
  gap: 14px;
  font-size: 0.75rem;
  font-weight: 600;
  color: #475569;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 5px;
}

.legend-color {
  width: 12px;
  height: 12px;
  border-radius: 3px;
}

.bg-completed {
  background: #10b981;
}

.bg-inprogress {
  background: #3b82f6;
}

.bg-dispatched {
  background: #f59e0b;
}

.bg-gap {
  background: #f1f5f9;
  border: 1px dashed #94a3b8;
}

.timeline-wrapper {
  overflow-x: auto;
  min-width: 900px;
}

.timeline-header-ruler {
  display: grid;
  grid-template-columns: 240px 1fr;
  background: #f1f5f9;
  border-bottom: 2px solid #cbd5e1;
}

.ruler-label-col {
  padding: 10px 14px;
  font-size: 0.75rem;
  font-weight: 800;
  color: #475569;
  border-right: 1px solid #cbd5e1;
}

.ruler-hours-track {
  position: relative;
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
}

.ruler-hour-marker {
  font-size: 0.6875rem;
  font-family: monospace;
  font-weight: 700;
  color: #64748b;
  transform: translateX(-50%);
}

.ruler-hour-marker:first-child {
  transform: translateX(0);
  padding-left: 4px;
}

.ruler-hour-marker:last-child {
  transform: translateX(-100%);
  padding-right: 4px;
}

.timeline-rows-container {
  display: flex;
  flex-direction: column;
}

.timeline-vehicle-row {
  display: grid;
  grid-template-columns: 240px 1fr;
  border-bottom: 1px solid #e2e8f0;
  min-height: 64px;
  transition: background 0.15s ease;
}

.timeline-vehicle-row:hover {
  background: #f8fafc;
}

.timeline-vehicle-row.has-trips {
  background: #ffffff;
}

.vehicle-label-col {
  padding: 10px 14px;
  border-right: 1px solid #cbd5e1;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.veh-id-badge {
  display: flex;
  align-items: center;
  gap: 6px;
}

.veh-id-badge strong {
  font-size: 0.875rem;
  color: #0f172a;
}

.veh-type-tag {
  font-size: 0.625rem;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 3px;
  background: #f1f5f9;
  color: #475569;
}

.veh-meta-sub {
  margin-top: 3px;
  display: flex;
  align-items: center;
}

.unit-tag {
  font-size: 0.625rem;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 3px;
}

.unit-tag.factory {
  background: #e0f2fe;
  color: #0369a1;
}

.unit-tag.team {
  background: #ecfdf5;
  color: #065f46;
}

.vehicle-track-col {
  position: relative;
  height: 64px;
  display: flex;
  align-items: center;
}

.grid-hour-lines {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  justify-content: space-between;
  pointer-events: none;
}

.hour-line {
  width: 1px;
  height: 100%;
  background: #f1f5f9;
}

.trip-block {
  position: absolute;
  top: 8px;
  height: 48px;
  border-radius: 6px;
  padding: 4px 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
  cursor: pointer;
  z-index: 2;
  transition: transform 0.15s ease;
  overflow: hidden;
}

.trip-block:hover {
  transform: translateY(-2px);
  z-index: 10;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
}

.trip-block-inner {
  display: flex;
  flex-direction: column;
  height: 100%;
  justify-content: space-between;
}

.trip-block-code {
  font-size: 0.6875rem;
  font-weight: 800;
  line-height: 1;
}

.trip-block-time {
  font-size: 0.625rem;
  font-family: monospace;
  font-weight: 700;
  opacity: 0.9;
}

.trip-block-route {
  font-size: 0.5625rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  opacity: 0.85;
}

.trip-status-completed {
  background: #10b981;
  color: #ffffff;
  border: 1px solid #059669;
}

.trip-status-inprogress {
  background: #3b82f6;
  color: #ffffff;
  border: 1px solid #2563eb;
}

.trip-status-dispatched {
  background: #f59e0b;
  color: #ffffff;
  border: 1px solid #d97706;
}

/* Turnaround Gap Block */
.turnaround-gap-block {
  position: absolute;
  top: 14px;
  height: 36px;
  border-radius: 4px;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.625rem;
  font-weight: 700;
  border: 1.5px dashed;
}

.gap-adequate {
  background: #f0fdf4;
  border-color: #86efac;
  color: #15803d;
}

.gap-violation {
  background: #fef2f2;
  border-color: #fca5a5;
  color: #b91c1c;
}

.gap-inner-label {
  display: flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
  padding: 0 4px;
}

.gap-check {
  font-weight: 800;
  color: #16a34a;
}

.gap-warn {
  font-weight: 800;
  color: #dc2626;
}

.empty-track-placeholder {
  position: absolute;
  left: 20px;
  font-size: 0.75rem;
  color: #94a3b8;
  font-style: italic;
}

/* Interval Table */
.badge-interval-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: 6px;
  font-size: 0.75rem;
}

.pill-safe {
  background: #ecfdf5;
  color: #065f46;
  border: 1px solid #a7f3d0;
}

.pill-warning {
  background: #fffbeb;
  color: #92400e;
  border: 1px solid #fde68a;
}

/* TAB 2 SPECIFIC VEHICLE STYLES */
.veh-filter-toolbar-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 14px;
}

.veh-filter-left-group {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

.veh-search-box {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.veh-search-icon {
  position: absolute;
  left: 12px;
  color: #64748b;
  pointer-events: none;
}

.veh-search-input {
  height: 38px;
  width: 210px;
  padding: 0 12px 0 34px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  font-size: 0.8125rem;
  background: #f8fafc;
  color: #1e293b;
  transition: all 0.15s ease;
}

.veh-search-input:focus {
  background: #ffffff;
  border-color: #10b981;
  outline: none;
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.15);
}

.veh-select-box {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.veh-select-icon {
  position: absolute;
  left: 12px;
  color: #64748b;
  pointer-events: none;
}

.veh-select-control {
  height: 38px;
  padding: 0 28px 0 32px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  font-size: 0.8125rem;
  font-weight: 600;
  background: #f8fafc;
  color: #334155;
  cursor: pointer;
  transition: all 0.15s ease;
}

.veh-select-control:focus {
  background: #ffffff;
  border-color: #10b981;
  outline: none;
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.15);
}

.veh-counter-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 38px;
  padding: 0 12px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 0.75rem;
  color: #475569;
}

.veh-counter-tag strong {
  color: #0f172a;
  font-weight: 800;
}

.veh-batch-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.veh-batch-label {
  font-size: 0.75rem;
  font-weight: 700;
  color: #64748b;
}

.btn-batch-template {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 34px;
  padding: 0 12px;
  border-radius: 7px;
  font-size: 0.75rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s ease;
  border: 1px solid transparent;
}

.btn-batch-latex {
  background: #ecfdf5;
  color: #047857;
  border-color: #a7f3d0;
}

.btn-batch-latex:hover {
  background: #d1fae5;
  border-color: #6ee7b7;
  transform: translateY(-1px);
}

.btn-batch-passenger {
  background: #eff6ff;
  color: #1d4ed8;
  border-color: #bfdbfe;
}

.btn-batch-passenger:hover {
  background: #dbeafe;
  border-color: #93c5fd;
  transform: translateY(-1px);
}

.specific-vehicles-table th {
  background: #f8fafc;
  color: #475569;
  font-size: 0.75rem;
  font-weight: 800;
  padding: 11px 12px;
  border-bottom: 1px solid #e2e8f0;
  letter-spacing: 0.02em;
}

.specific-vehicles-table td {
  padding: 10px 12px;
  font-size: 0.8125rem;
  border-bottom: 1px solid #f1f5f9;
  vertical-align: middle;
}

.veh-type-cell {
  display: inline-block;
  font-size: 0.75rem;
  font-weight: 600;
  color: #334155;
  background: #f1f5f9;
  padding: 3px 8px;
  border-radius: 6px;
  border: 1px solid #e2e8f0;
}

.row-custom-active {
  background: #f0fdf4 !important;
}

.btn-toggle-custom {
  position: relative;
  display: inline-flex;
  align-items: center;
  width: 110px;
  height: 28px;
  border-radius: 14px;
  background: #e2e8f0;
  border: 1px solid #cbd5e1;
  padding: 2px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-toggle-custom.active {
  background: #10b981;
  border-color: #059669;
}

.toggle-slider {
  position: absolute;
  left: 2px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #ffffff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  transition: transform 0.2s ease;
}

.btn-toggle-custom.active .toggle-slider {
  transform: translateX(82px);
}

.toggle-text {
  width: 100%;
  font-size: 0.6875rem;
  font-weight: 700;
  color: #475569;
  text-align: center;
  padding-left: 20px;
}

.btn-toggle-custom.active .toggle-text {
  color: #ffffff;
  padding-left: 0;
  padding-right: 20px;
}

.input-spin-group {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.input-spin-group input {
  width: 68px;
  height: 32px;
  padding: 4px 6px;
  font-size: 0.875rem;
  font-weight: 700;
  text-align: center;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  background: #ffffff;
  color: #1e293b;
  transition: all 0.15s ease;
}

.input-spin-group input:focus {
  border-color: #10b981;
  box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.15);
  outline: none;
}

.input-spin-group.disabled input {
  background: #f8fafc;
  border-color: #e2e8f0;
  color: #94a3b8;
  cursor: not-allowed;
}

.input-unit {
  font-size: 0.75rem;
  font-weight: 600;
  color: #64748b;
}

.veh-note-input {
  width: 100%;
  height: 32px;
  padding: 4px 10px;
  font-size: 0.8125rem;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  background: #ffffff;
  color: #334155;
  transition: all 0.15s ease;
}

.veh-note-input:focus {
  border-color: #10b981;
  outline: none;
  box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.15);
}

.veh-note-input:disabled {
  background: #f8fafc;
  border-color: #e2e8f0;
  color: #94a3b8;
  cursor: not-allowed;
}

/* TAB 3 REDESIGNED STYLES */
.category-panel-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 24px !important;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.panel-card-header {
  padding-bottom: 16px;
  border-bottom: 1px solid #f1f5f9;
  margin-bottom: 20px;
}

.panel-header-title-wrap {
  display: flex;
  align-items: center;
  gap: 12px;
}

.panel-icon-wrap {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.panel-icon-wrap.primary {
  background: #dcfce7;
  color: #15803d;
}

.panel-icon-wrap.info {
  background: #e0f2fe;
  color: #0369a1;
}

.panel-title {
  font-size: 0.9375rem;
  font-weight: 800;
  color: #0f172a;
  margin: 0;
}

.panel-subtitle {
  font-size: 0.75rem;
  color: #64748b;
  margin: 3px 0 0 0;
}

.default-rules-list {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.rule-setting-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 20px 22px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  transition: all 0.15s ease;
}

.rule-setting-card:hover {
  background: #ffffff;
  border-color: #cbd5e1;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.03);
}

.rule-info {
  flex: 1;
}

.rule-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.rule-title {
  font-size: 0.875rem;
  font-weight: 700;
  color: #1e293b;
}

.rule-desc {
  font-size: 0.8125rem;
  color: #64748b;
  margin: 0;
  line-height: 1.55;
}

.input-unit-composite {
  display: inline-flex;
  align-items: stretch;
  height: 38px;
}

.composite-input {
  width: 75px;
  height: 38px;
  padding: 0 8px;
  font-size: 0.9375rem;
  font-weight: 800;
  text-align: center;
  color: #0f172a;
  background: #ffffff;
  border: 1px solid #cbd5e1;
  border-top-left-radius: 8px;
  border-bottom-left-radius: 8px;
  outline: none;
  transition: all 0.15s ease;
}

.composite-input:focus {
  border-color: #10b981;
  box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.2);
  z-index: 1;
}

.composite-unit {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 12px;
  background: #f1f5f9;
  border: 1px solid #cbd5e1;
  border-left: none;
  border-top-right-radius: 8px;
  border-bottom-right-radius: 8px;
  font-size: 0.75rem;
  font-weight: 700;
  color: #64748b;
}

/* EMERGENCY OVERRIDE CARD */
.emergency-override-card {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 20px 22px;
  transition: all 0.2s ease;
}

.emergency-override-card.active {
  background: #fffbeb;
  border-color: #fcd34d;
}

.emergency-card-body {
  display: flex;
  align-items: center;
  gap: 16px;
}

.emergency-icon-wrap {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  background: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border: 1px solid #e2e8f0;
}

.emergency-override-card.active .emergency-icon-wrap {
  background: #fef3c7;
  border-color: #fde68a;
}

.emergency-info {
  flex: 1;
}

.emergency-title {
  display: block;
  font-size: 0.875rem;
  font-weight: 700;
  color: #1e293b;
  margin-bottom: 4px;
}

.emergency-desc {
  font-size: 0.8125rem;
  color: #64748b;
  margin: 0;
  line-height: 1.5;
}

/* TOGGLE SWITCH */
.toggle-switch-label {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
  cursor: pointer;
  margin: 0;
}

.toggle-switch-input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-switch-slider {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #cbd5e1;
  border-radius: 24px;
  transition: 0.2s;
}

.toggle-switch-slider:before {
  position: absolute;
  content: "";
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  border-radius: 50%;
  transition: 0.2s;
  box-shadow: 0 1px 3px rgba(0,0,0,0.2);
}

.toggle-switch-input:checked + .toggle-switch-slider {
  background-color: #f59e0b;
}

.toggle-switch-input:checked + .toggle-switch-slider:before {
  transform: translateX(20px);
}

/* TYPE SETTING CARDS (RIGHT COLUMN) */
.type-cards-list {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.type-setting-card {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 20px 22px;
  transition: all 0.15s ease;
}

.type-setting-card:hover {
  background: #ffffff;
  border-color: #cbd5e1;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.03);
}

.type-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.type-title-box {
  display: flex;
  align-items: center;
  gap: 12px;
}

.type-icon-circle {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.type-icon-circle.latex {
  background: #dcfce7;
  color: #15803d;
}

.type-icon-circle.passenger {
  background: #e0f2fe;
  color: #0369a1;
}

.type-icon-circle.milling {
  background: #fef3c7;
  color: #b45309;
}

.type-name {
  font-size: 0.875rem;
  font-weight: 800;
  color: #0f172a;
}

.type-name-sub {
  display: block;
  font-size: 0.6875rem;
  color: #64748b;
  margin-top: 1px;
}

.type-params-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
}

.type-param-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.type-param-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.8125rem;
  font-weight: 700;
  color: #475569;
}

.badge-unit-team {
  display: inline-flex;
  padding: 2px 7px;
  border-radius: 4px;
  font-size: 0.6875rem;
  font-weight: 700;
  background: #ecfdf5;
  color: #065f46;
  border: 1px solid #a7f3d0;
}

.badge-unit-factory {
  display: inline-flex;
  padding: 2px 7px;
  border-radius: 4px;
  font-size: 0.6875rem;
  font-weight: 700;
  background: #f0f9ff;
  color: #0369a1;
  border: 1px solid #bae6fd;
}

@media (max-width: 1024px) {
  .filter-controls-grid {
    grid-template-columns: 1fr;
  }
  .kpi-mini-box {
    justify-content: flex-start;
  }
}
</style>
