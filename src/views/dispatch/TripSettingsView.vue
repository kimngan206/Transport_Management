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
    <!-- HEADER TRANG -->
    <div class="page-header">
      <div class="header-left">
        <div class="header-icon-box">
          <Clock :size="24" class="text-primary" />
        </div>
        <div>
          <div class="flex items-center gap-2">
            <h1 class="page-title">Cài Đặt Chuyến & Giãn Cách Điều Động</h1>
            <span class="badge-system-version">Quy Chuẩn Cao Su</span>
          </div>
          <p class="page-subtitle">
            Cấu hình thời gian đệm giữa các chuyến xe (Turnaround Buffer) và thời gian giãn cách khởi hành giữa các xe cụ thể (Inter-Vehicle Interval)
          </p>
        </div>
      </div>

      <div class="header-actions">
        <button class="btn btn-outline" @click="handleResetConfig" title="Khôi phục mặc định">
          <RotateCcw :size="15" />
          <span>Khôi phục mặc định</span>
        </button>

        <button class="btn btn-success" @click="handleSaveConfig">
          <Save :size="16" />
          <span>Lưu Cấu Hình</span>
        </button>
      </div>
    </div>

    <!-- Alert thông báo lưu thành công -->
    <div v-if="isSaved" class="alert alert-success mt-3 animate-fade-in">
      <CheckCircle2 :size="18" />
      <span>{{ saveMessage }}</span>
    </div>

    <!-- THANH CHUYỂN TABS CHỨC NĂNG -->
    <div class="settings-tabs-bar mt-4">
      <button
        class="tab-item-btn"
        :class="{ active: activeTab === 'timeline' }"
        @click="activeTab = 'timeline'"
      >
        <Calendar :size="17" />
        <span>1. Sơ Đồ Giãn Cách & Trục Thời Gian</span>
        <span class="tab-badge">{{ dayTrips.length }} chuyến</span>
      </button>

      <button
        class="tab-item-btn"
        :class="{ active: activeTab === 'vehicles' }"
        @click="activeTab = 'vehicles'"
      >
        <Truck :size="17" />
        <span>2. Cài Đặt Theo Từng Xe Cụ Thể</span>
        <span class="tab-badge">{{ config.specificVehicleSettings.length }} xe</span>
      </button>

      <button
        class="tab-item-btn"
        :class="{ active: activeTab === 'categories' }"
        @click="activeTab = 'categories'"
      >
        <Sliders :size="17" />
        <span>3. Quy Chuẩn Chung & Loại Xe</span>
      </button>
    </div>

    <!-- ======================================================= -->
    <!-- TAB 1: SƠ ĐỒ GIÃN CÁCH & TRỤC THỜI GIAN (VISUAL TIMELINE) -->
    <!-- ======================================================= -->
    <div v-if="activeTab === 'timeline'" class="tab-content mt-4">
      <!-- THANH ĐIỀU KHIỂN & LỌC NGÀY -->
      <div class="card p-4 filter-control-card">
        <div class="filter-controls-grid">
          <div class="form-group mb-0">
            <label class="form-label font-bold text-xs">
              <Calendar :size="13" class="inline text-primary mr-1" />
              <span>Ngày kiểm tra sơ đồ:</span>
            </label>
            <input v-model="selectedDate" type="date" class="form-control" />
          </div>

          <div class="form-group mb-0">
            <label class="form-label font-bold text-xs">
              <Truck :size="13" class="inline text-primary mr-1" />
              <span>Lọc loại phương tiện:</span>
            </label>
            <select v-model="filterType" class="form-select">
              <option value="ALL">-- Tất cả loại xe --</option>
              <option value="LatexTruck">Xe bồn chở mủ cao su</option>
              <option value="PassengerCar">Xe chở người / cán bộ</option>
              <option value="MillingMachine">Xe cơ giới / máy xúc</option>
            </select>
          </div>

          <div class="form-group mb-0">
            <label class="form-label font-bold text-xs">
              <Building :size="13" class="inline text-primary mr-1" />
              <span>Đơn vị trực thuộc:</span>
            </label>
            <select v-model="filterUnit" class="form-select">
              <option value="ALL">-- Tất cả đơn vị --</option>
              <option value="Factory">Nhà máy chế biến</option>
              <option value="Team:Đội 1">Đội sản xuất 1</option>
              <option value="Team:Đội 2">Đội sản xuất 2</option>
              <option value="Team:Đội 3">Đội sản xuất 3</option>
              <option value="Team:Đội 4">Đội sản xuất 4</option>
            </select>
          </div>

          <div class="kpi-mini-box">
            <div class="kpi-mini-item">
              <span class="kpi-lbl">Chuyến trong ngày:</span>
              <strong class="kpi-val text-primary">{{ dayTrips.length }}</strong>
            </div>
            <div class="kpi-mini-item">
              <span class="kpi-lbl">Xe lăn bánh:</span>
              <strong class="kpi-val text-emerald-700">{{ activeVehiclesInDay.length }} / {{ fleetStore.vehicles.length }}</strong>
            </div>
            <div class="kpi-mini-item">
              <span class="kpi-lbl">Cảnh báo giãn cách:</span>
              <strong class="kpi-val" :class="interVehicleGaps.some(g => !g.isSafe) ? 'text-amber-600' : 'text-slate-500'">
                {{ interVehicleGaps.filter(g => !g.isSafe).length }}
              </strong>
            </div>
          </div>
        </div>
      </div>

      <!-- KHỐI BIỂU ĐỒ TRỤC THỜI GIAN (GANTT TIMELINE) -->
      <div class="card mt-4 timeline-card">
        <div class="card-header flex justify-between items-center">
          <div>
            <h3 class="card-title text-base mb-0">
              <Clock :size="18" class="text-primary inline mr-1" />
              <span>Trục Phân Bổ Thời Gian Chuyến Xe & Khoảng Đệm Giữa Các Chuyến (Ngày {{ selectedDate }})</span>
            </h3>
            <p class="text-xs text-muted mt-1 mb-0">
              Thể hiện các chuyến xe chạy trong ngày của từng xe, thời gian nghỉ/quay đầu (Buffer Gap) và độ so le giữa các xe với nhau
            </p>
          </div>

          <div class="legend-box">
            <span class="legend-item"><span class="legend-color bg-completed"></span> Đã hoàn thành</span>
            <span class="legend-item"><span class="legend-color bg-inprogress"></span> Đang chạy</span>
            <span class="legend-item"><span class="legend-color bg-dispatched"></span> Đã xếp lịch</span>
            <span class="legend-item"><span class="legend-color bg-gap"></span> Đệm nghỉ / Vệ sinh</span>
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
                  <span class="text-xxs text-muted ml-1">• Đệm: {{ getVehicleBufferMinutes(v.id).turnaroundMinutes }}p</span>
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
                      <span class="trip-block-route truncate">{{ t.routeName }}</span>
                    </div>
                  </div>

                  <!-- Render các khoảng đệm giữa 2 chuyến (Turnaround Gap) -->
                  <template v-for="(gap, gIdx) in analyzeVehicleTurnaroundGaps(v.id, selectedDate, dispatchStore.trips)" :key="'gap-' + gIdx">
                    <div
                      class="turnaround-gap-block"
                      :class="gap.isAdequate ? 'gap-adequate' : 'gap-violation'"
                      :style="getTimelineGapStyle(gap.trip1.scheduledEndTime, gap.trip2.scheduledStartTime)"
                      :title="`Khoảng đệm giữa Chuyến #${gIdx + 1} và #${gIdx + 2}: ${gap.gapMinutes} phút (Quy chuẩn tối thiểu: ${gap.requiredBufferMinutes} phút)`"
                    >
                      <div class="gap-inner-label">
                        <Clock :size="10" />
                        <span>Nghỉ/Đệm: {{ gap.gapMinutes }}p</span>
                        <span v-if="gap.isAdequate" class="gap-check">✓ Đạt</span>
                        <span v-else class="gap-warn">⚠️ Thiếu</span>
                      </div>
                    </div>
                  </template>
                </template>

                <!-- Xe không có chuyến -->
                <div v-else class="empty-track-placeholder">
                  <span>Trống lịch cả ngày</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- BẢNG SO SÁNH GIÃN CÁCH KHỞI HÀNH GIỮA CÁC XE (INTER-VEHICLE INTERVALS) -->
      <div class="card mt-4 p-4">
        <div class="card-header border-b pb-3 mb-3 flex justify-between items-center">
          <div>
            <h3 class="card-title text-base mb-0">
              <Sliders :size="17" class="text-primary inline mr-1" />
              <span>Ma Trận So Sánh Thời Gian Giãn Cách Giữa Các Xe Khác Nhau</span>
            </h3>
            <p class="text-xs text-muted mt-0.5">
              Theo dõi khoảng cách giờ xuất phát giữa các xe lăn bánh trong ngày để tránh dồn ứ tại trạm cân nông trường và trạm dỡ mủ nhà máy
            </p>
          </div>

          <span class="badge badge-blue">
            {{ interVehicleGaps.length }} cặp xe xuất phát trong khung 60 phút
          </span>
        </div>

        <div v-if="interVehicleGaps.length > 0" class="table-responsive">
          <table class="table align-middle">
            <thead>
              <tr>
                <th style="width: 140px;">Xe Xuất Phát Trước</th>
                <th style="width: 140px;">Xe Xuất Phát Sau</th>
                <th>Giờ Xuất Phát Xe 1</th>
                <th>Giờ Xuất Phát Xe 2</th>
                <th class="text-center">Khoảng Cách Giờ (Interval)</th>
                <th class="text-center">Quy Chuẩn Yêu Cầu</th>
                <th>Đánh Giá Vận Hành</th>
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
                  <span class="text-xs font-semibold text-slate-700">&gt;= {{ p.recommendedMinutes }} phút</span>
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

        <div v-else class="text-center py-6 text-muted">
          <CheckCircle2 :size="24" class="text-success mb-2" />
          <p class="mb-0 text-sm font-medium text-slate-600">
            Không có cặp xe nào xuất bến quá gần nhau trong ngày {{ selectedDate }}. Lịch trình được phân bổ giãn cách thông thoáng!
          </p>
        </div>
      </div>
    </div>

    <!-- ======================================================= -->
    <!-- TAB 2: CÀI ĐẶT THEO TỪNG XE CỤ THỂ (PER-VEHICLE CONFIG) -->
    <!-- ======================================================= -->
    <div v-if="activeTab === 'vehicles'" class="tab-content mt-4">
      <!-- THANH TÌM KIẾM & BỘ LỌC XE -->
      <div class="card p-3 mb-4">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="flex items-center gap-3 flex-1 min-w-xs">
            <div class="search-input-box flex-1">
              <Search :size="15" class="search-icon" />
              <input
                v-model="searchPlate"
                type="text"
                class="form-control pl-8"
                placeholder="Tìm theo biển số xe (51C-889.26...)"
              />
            </div>

            <div class="unit-filter-box">
              <select v-model="filterVehicleTeam" class="form-select text-xs font-bold">
                <option value="ALL">-- Tất cả đơn vị --</option>
                <option value="Factory">Xe Nhà máy</option>
                <option value="Team:Đội 1">Xe Đội 1</option>
                <option value="Team:Đội 2">Xe Đội 2</option>
                <option value="Team:Đội 3">Xe Đội 3</option>
                <option value="Team:Đội 4">Xe Đội 4</option>
              </select>
            </div>
          </div>

          <!-- Nút áp dụng nhanh theo loại -->
          <div class="flex items-center gap-2">
            <span class="text-xs text-muted font-bold">Áp dụng mẫu chuẩn:</span>
            <button class="btn btn-outline btn-xs" @click="applyBatchTemplate('LatexTruck')">
              Xe Bồn Mủ (45p)
            </button>
            <button class="btn btn-outline btn-xs" @click="applyBatchTemplate('PassengerCar')">
              Xe Khách (20p)
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
                <th style="width: 170px;">Phương Tiện</th>
                <th style="width: 140px;">Đơn Vị Quản Lý</th>
                <th style="width: 160px;" class="text-center">Chế Độ Áp Dụng</th>
                <th style="width: 160px;" class="text-center">
                  Đệm Giữa 2 Chuyến
                  <div class="th-sub">(Turnaround Gap)</div>
                </th>
                <th style="width: 160px;" class="text-center">
                  Giãn Cách Với Xe Khác
                  <div class="th-sub">(Departure Interval)</div>
                </th>
                <th style="width: 150px;" class="text-center">
                  Vệ Sinh Bồn Téc
                  <div class="th-sub">(Cleaning Time)</div>
                </th>
                <th>Ghi Chú Vận Hành & Đặc Thù Xe</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="s in paginatedVehicleSettings"
                :key="s.vehicleId"
                :class="{ 'row-custom-active': s.useCustom }"
              >
                <!-- Cột Xe -->
                <td>
                  <div class="veh-info-cell">
                    <strong class="font-mono text-slate-800 text-sm">{{ s.licensePlate }}</strong>
                    <span class="veh-type-sub">{{ getVehicleTypeLabel(s.vehicleType) }}</span>
                  </div>
                </td>

                <!-- Cột Đơn vị -->
                <td>
                  <span v-if="s.operatingUnitType === 'Factory'" class="badge-unit-factory">Nhà máy</span>
                  <span v-else class="badge-unit-team">{{ s.teamName || 'Đội sản xuất' }}</span>
                </td>

                <!-- Chế độ áp dụng: Toggle switch -->
                <td class="text-center">
                  <div class="flex flex-col items-center gap-1">
                    <button
                      type="button"
                      class="btn-toggle-custom"
                      :class="{ active: s.useCustom }"
                      @click="toggleVehicleCustom(s)"
                    >
                      <span class="toggle-slider"></span>
                      <span class="toggle-text">{{ s.useCustom ? 'Cấu hình riêng' : 'Theo loại xe' }}</span>
                    </button>
                    <span v-if="s.useCustom" class="text-xxs font-bold text-emerald-700">Tùy biến riêng</span>
                    <span v-else class="text-xxs text-muted">Mặc định chuẩn</span>
                  </div>
                </td>

                <!-- Thời gian đệm giữa 2 chuyến -->
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

                <!-- Giãn cách so với xe khác -->
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

                <!-- Vệ sinh bồn téc / súc rửa -->
                <td class="text-center">
                  <div class="input-spin-group" :class="{ disabled: !s.useCustom }">
                    <input
                      v-model.number="s.cleaningDurationMinutes"
                      type="number"
                      class="form-control text-center font-bold"
                      :disabled="!s.useCustom"
                      min="0"
                      max="60"
                      step="5"
                    />
                    <span class="input-unit">phút</span>
                  </div>
                </td>

                <!-- Ghi chú vận hành -->
                <td>
                  <input
                    v-model="s.notes"
                    type="text"
                    class="form-control form-control-sm text-xs"
                    :disabled="!s.useCustom"
                    placeholder="Nhập ghi chú đặc thù (van xả chậm, xe chuyên chạy dài...)"
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
    <!-- TAB 3: QUY CHUẨN CHUNG & THEO LOẠI XE (CATEGORY DEFAULTS)-->
    <!-- ======================================================= -->
    <div v-if="activeTab === 'categories'" class="tab-content mt-4">
      <div class="grid-2 gap-4">
        <!-- Cột 1: Cấu hình mặc định toàn hệ thống -->
        <div class="card p-4">
          <div class="card-header border-b pb-3 mb-4">
            <h3 class="card-title text-base mb-0">
              <Settings :size="17" class="text-primary inline mr-1" />
              <span>Quy Chuẩn Mặc Định Toàn Hệ Thống</span>
            </h3>
            <p class="text-xs text-muted mt-1 mb-0">
              Áp dụng cho các phương tiện chưa thiết lập cấu hình riêng
            </p>
          </div>

          <div class="form-group mb-4">
            <label class="form-label font-bold">Thời gian đệm tối thiểu giữa 2 chuyến của cùng 1 xe:</label>
            <div class="input-group-with-unit">
              <input
                v-model.number="config.defaultTurnaroundMinutes"
                type="number"
                class="form-control font-bold"
                min="10"
                max="120"
                step="5"
              />
              <span class="unit-box">phút</span>
            </div>
            <span class="text-xs text-muted mt-1 block">
              Khuyến nghị từ 30 – 45 phút để tài xế bàn giao chứng từ mủ, kiểm tra lốp, thắng và nghỉ ngơi trước khi nhận chuyến kế tiếp.
            </span>
          </div>

          <div class="form-group mb-4">
            <label class="form-label font-bold">Thời gian giãn cách tối thiểu giữa 2 xe cùng xuất bến:</label>
            <div class="input-group-with-unit">
              <input
                v-model.number="config.defaultInterVehicleIntervalMinutes"
                type="number"
                class="form-control font-bold"
                min="5"
                max="60"
                step="5"
              />
              <span class="unit-box">phút</span>
            </div>
            <span class="text-xs text-muted mt-1 block">
              Tránh xe tập trung đồng thời tại các điểm trạm cân Nông trường hoặc hầm tiếp nhận mủ Nhà máy gây ùn ứ.
            </span>
          </div>

          <div class="emergency-override-box">
            <div class="flex items-start gap-3">
              <input
                id="emergency-override-checkbox"
                v-model="config.allowEmergencyOverride"
                type="checkbox"
                class="mt-1 form-checkbox"
              />
              <label for="emergency-override-checkbox" class="cursor-pointer">
                <strong class="text-sm text-slate-800">Cho phép rút ngắn đệm khi Điều Xe Cứu Viện Khẩn Cấp</strong>
                <p class="text-xs text-slate-600 mb-0 mt-0.5">
                  Khi xảy ra sự cố hỏng xe téc giữa đường hoặc tràn mủ, điều phối viên có quyền bỏ qua đệm 30p để cử xe rỗng gần nhất đến ứng cứu ngay lập tức.
                </p>
              </label>
            </div>
          </div>
        </div>

        <!-- Cột 2: Cấu hình quy chuẩn theo từng loại phương tiện -->
        <div class="card p-4">
          <div class="card-header border-b pb-3 mb-4">
            <h3 class="card-title text-base mb-0">
              <Layers :size="17" class="text-primary inline mr-1" />
              <span>Quy Chuẩn Theo Chủng Loại Phương Tiện</span>
            </h3>
            <p class="text-xs text-muted mt-1 mb-0">
              Định mức thời gian đệm và vệ sinh đặc thù theo tính chất hàng hóa cao su
            </p>
          </div>

          <!-- Xe bồn téc chở mủ cao su -->
          <div class="category-config-card mb-3">
            <div class="cat-header">
              <div class="cat-title-wrap">
                <Truck :size="16" class="text-primary" />
                <strong class="text-slate-800 text-sm">1. Xe Bồn Téc Chở Mủ Cao Su (Latex Truck)</strong>
              </div>
              <span class="badge-cat latex">Trọng Điểm Mủ</span>
            </div>
            <p class="cat-desc text-xs text-slate-600">
              Cần thời gian xả cặn mủ tươi, súc rửa bồn téc bằng nước áp lực cao và kiểm tra gioăng nắp van xả trước khi nhận đợt mủ kế tiếp.
            </p>
            <div class="cat-inputs-row">
              <div class="cat-input-item">
                <span class="cat-input-lbl">Đệm giữa 2 chuyến:</span>
                <div class="input-with-unit-mini">
                  <input v-model.number="config.vehicleTypeSettings.LatexTruck.turnaroundBufferMinutes" type="number" class="form-control" />
                  <span>phút</span>
                </div>
              </div>
              <div class="cat-input-item">
                <span class="cat-input-lbl">Giãn cách với xe khác:</span>
                <div class="input-with-unit-mini">
                  <input v-model.number="config.vehicleTypeSettings.LatexTruck.interVehicleIntervalMinutes" type="number" class="form-control" />
                  <span>phút</span>
                </div>
              </div>
              <div class="cat-input-item">
                <span class="cat-input-lbl">Thời gian súc rửa bồn:</span>
                <div class="input-with-unit-mini">
                  <input v-model.number="config.vehicleTypeSettings.LatexTruck.cleaningDurationMinutes" type="number" class="form-control" />
                  <span>phút</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Xe chở người / cán bộ kỹ thuật -->
          <div class="category-config-card mb-3">
            <div class="cat-header">
              <div class="cat-title-wrap">
                <Car :size="16" class="text-info" />
                <strong class="text-slate-800 text-sm">2. Xe Chở Người / Chuyên Gia (Passenger Car)</strong>
              </div>
              <span class="badge-cat passenger">Công Vụ</span>
            </div>
            <p class="cat-desc text-xs text-slate-600">
              Phục vụ đưa đón công nhân cạo mủ, cán bộ nông trường và đoàn chuyên gia. Quy trình quay đầu nhanh gọn.
            </p>
            <div class="cat-inputs-row">
              <div class="cat-input-item">
                <span class="cat-input-lbl">Đệm giữa 2 chuyến:</span>
                <div class="input-with-unit-mini">
                  <input v-model.number="config.vehicleTypeSettings.PassengerCar.turnaroundBufferMinutes" type="number" class="form-control" />
                  <span>phút</span>
                </div>
              </div>
              <div class="cat-input-item">
                <span class="cat-input-lbl">Giãn cách với xe khác:</span>
                <div class="input-with-unit-mini">
                  <input v-model.number="config.vehicleTypeSettings.PassengerCar.interVehicleIntervalMinutes" type="number" class="form-control" />
                  <span>phút</span>
                </div>
              </div>
              <div class="cat-input-item">
                <span class="cat-input-lbl">Vệ sinh khoang xe:</span>
                <div class="input-with-unit-mini">
                  <input v-model.number="config.vehicleTypeSettings.PassengerCar.cleaningDurationMinutes" type="number" class="form-control" />
                  <span>phút</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Xe cơ giới / Máy xúc -->
          <div class="category-config-card">
            <div class="cat-header">
              <div class="cat-title-wrap">
                <Sliders :size="16" class="text-amber" />
                <strong class="text-slate-800 text-sm">3. Cơ Giới Nông Trường / Máy Xúc (Milling Machine)</strong>
              </div>
              <span class="badge-cat milling">Cơ Giới</span>
            </div>
            <p class="cat-desc text-xs text-slate-600">
              Kiểm tra mức dầu bôi trơn, áp suất dầu thủy lực và hệ thống xích truyền động trước khi sang lô cạo mới.
            </p>
            <div class="cat-inputs-row">
              <div class="cat-input-item">
                <span class="cat-input-lbl">Đệm giữa 2 ca/chuyến:</span>
                <div class="input-with-unit-mini">
                  <input v-model.number="config.vehicleTypeSettings.MillingMachine.turnaroundBufferMinutes" type="number" class="form-control" />
                  <span>phút</span>
                </div>
              </div>
              <div class="cat-input-item">
                <span class="cat-input-lbl">Giãn cách với xe khác:</span>
                <div class="input-with-unit-mini">
                  <input v-model.number="config.vehicleTypeSettings.MillingMachine.interVehicleIntervalMinutes" type="number" class="form-control" />
                  <span>phút</span>
                </div>
              </div>
              <div class="cat-input-item">
                <span class="cat-input-lbl">Kiểm tra kỹ thuật:</span>
                <div class="input-with-unit-mini">
                  <input v-model.number="config.vehicleTypeSettings.MillingMachine.cleaningDurationMinutes" type="number" class="form-control" />
                  <span>phút</span>
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
  gap: 8px;
  background: #e2e8f0;
  padding: 4px;
  border-radius: var(--radius-md);
  flex-wrap: wrap;
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

/* FILTER CONTROLS GRID */
.filter-controls-grid {
  display: grid;
  grid-template-columns: 180px 220px 200px 1fr;
  gap: 16px;
  align-items: center;
}

.kpi-mini-box {
  display: flex;
  align-items: center;
  gap: 16px;
  justify-content: flex-end;
  background: #f8fafc;
  padding: 8px 14px;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}

.kpi-mini-item {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.kpi-lbl {
  font-size: 0.6875rem;
  color: #64748b;
  font-weight: 600;
}

.kpi-val {
  font-size: 1rem;
  font-weight: 800;
  line-height: 1.2;
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
.search-input-box {
  position: relative;
}

.search-icon {
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  color: #94a3b8;
}

.specific-vehicles-table th {
  background: #f8fafc;
  color: #475569;
  font-size: 0.75rem;
  font-weight: 800;
  padding: 10px 12px;
}

.th-sub {
  font-size: 0.625rem;
  font-weight: normal;
  color: #64748b;
}

.specific-vehicles-table td {
  padding: 10px 12px;
  font-size: 0.8125rem;
}

.row-custom-active {
  background: #f0fdf4 !important;
}

.veh-info-cell {
  display: flex;
  flex-direction: column;
}

.veh-type-sub {
  font-size: 0.6875rem;
  color: #64748b;
}

.btn-toggle-custom {
  position: relative;
  display: inline-flex;
  align-items: center;
  width: 120px;
  height: 26px;
  border-radius: 13px;
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
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #ffffff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  transition: transform 0.2s ease;
}

.btn-toggle-custom.active .toggle-slider {
  transform: translateX(94px);
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
  gap: 4px;
}

.input-spin-group input {
  width: 65px;
  padding: 4px;
  font-size: 0.8125rem;
  border-radius: 5px;
}

.input-spin-group.disabled input {
  background: #f1f5f9;
  color: #94a3b8;
  cursor: not-allowed;
}

.input-unit {
  font-size: 0.75rem;
  font-weight: 600;
  color: #64748b;
}

/* TAB 3 CATEGORY CONFIG CARDS */
.category-config-card {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 12px 14px;
}

.cat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.cat-title-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
}

.badge-cat {
  font-size: 0.6875rem;
  font-weight: 800;
  padding: 2px 8px;
  border-radius: 4px;
}

.badge-cat.latex {
  background: #ecfdf5;
  color: #065f46;
  border: 1px solid #a7f3d0;
}

.badge-cat.passenger {
  background: #eff6ff;
  color: #1e40af;
  border: 1px solid #bfdbfe;
}

.badge-cat.milling {
  background: #fffbeb;
  color: #92400e;
  border: 1px solid #fde68a;
}

.cat-inputs-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin-top: 10px;
}

.cat-input-item {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.cat-input-lbl {
  font-size: 0.6875rem;
  font-weight: 700;
  color: #475569;
}

.input-with-unit-mini {
  display: flex;
  align-items: center;
  gap: 4px;
}

.input-with-unit-mini input {
  width: 70px;
  padding: 3px 6px;
  font-size: 0.8125rem;
  font-weight: 700;
  text-align: center;
}

.input-with-unit-mini span {
  font-size: 0.6875rem;
  color: #64748b;
  font-weight: 600;
}

.input-group-with-unit {
  display: flex;
  max-width: 160px;
}

.input-group-with-unit input {
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
  text-align: center;
}

.unit-box {
  background: #f1f5f9;
  border: 1px solid #cbd5e1;
  border-left: none;
  border-top-right-radius: 6px;
  border-bottom-right-radius: 6px;
  padding: 0 10px;
  display: flex;
  align-items: center;
  font-size: 0.8125rem;
  font-weight: 700;
  color: #475569;
}

.emergency-override-box {
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 8px;
  padding: 12px;
  margin-top: 16px;
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
