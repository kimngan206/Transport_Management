<script setup lang="ts">
import { ref, computed } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { useDriverStore } from '@/stores/driver';
import { useDispatchStore } from '@/stores/dispatch';
import { useFleetStore } from '@/stores/fleet';
import { mockStorage } from '@/services/mockStorage';
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
  Phone,
  AlertTriangle,
  ExternalLink,
  Truck,
  Filter,
} from 'lucide-vue-next';

const authStore = useAuthStore();
const driverStore = useDriverStore();
const dispatchStore = useDispatchStore();
const fleetStore = useFleetStore();
const myVehicle = computed(() => driverStore.myVehicle);

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

function getVehicleShortType(v: any): string {
  if (!v) return '';
  if (v.vehicleType === 'LatexTruck') {
    return v.capacityTons ? `Tải ${v.capacityTons}T` : 'Xe tải';
  }
  if (v.vehicleType === 'PassengerCar') return 'Bán tải';
  if (v.vehicleType === 'MillingMachine') return 'Máy đào';
  return v.model?.split(' ')[0] || 'Xe';
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

// Danh sách các chuyến xe cứu viện được phân công cho tài xế này
const rescueTrips = computed(() => {
  return pendingOrRunningTrips.value.filter((t) => t.replacementInfo?.isRescueTrip);
});

// Chuyến xe của tài xế này nhưng đã được chuyển giao sang xe cứu viện khác
const myTransferredTrips = computed(() => {
  const currentDriverId = authStore.currentUser.driverId;
  const currentPhone = authStore.currentUser.phone;
  return dispatchStore.trips.filter((t) => {
    if (!t.replacementInfo) return false;
    const isOriginalDriver = t.replacementInfo.originalDriverId === currentDriverId ||
      t.replacementInfo.originalDriverPhone === currentPhone;
    return isOriginalDriver && t.driverId !== currentDriverId;
  });
});

function confirmRescueHandover(trip: TransportTrip) {
  if (!trip.replacementInfo) return;
  trip.replacementInfo.handoverStatus = 'HANDED_OVER';
  dispatchStore.saveState();
  showToast('Đã xác nhận tiếp nhận bàn giao lô mủ cao su tại hiện trường thành công!');
}

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
          <span v-if="myVehicle" class="text-primary font-bold"> • Phương tiện phụ trách: {{ myVehicle.licensePlate }} ({{ myVehicle.model }})</span>
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

    <!-- Banner thông báo cho TÀI XẾ CŨ: Cuốc xe đã được chuyển giao cho xe cứu viện -->
    <div v-for="t in myTransferredTrips" :key="'transferred-' + t.id" class="transferred-trip-banner mb-4">
      <div class="banner-icon-box">
        <Truck :size="24" class="text-amber-600" />
      </div>
      <div class="banner-body-text">
        <div class="flex items-center gap-2">
          <span class="badge-tag-amber">THÔNG BÁO BÀN GIAO CHUYẾN XE</span>
          <span class="font-bold text-amber-900 text-sm">Chuyến {{ t.tripCode }} (Xe {{ t.replacementInfo?.originalVehiclePlate }})</span>
        </div>
        <p class="text-xs text-amber-900 mt-1">
          Điều phối viên đã điều động xe cứu viện <strong>{{ t.vehiclePlate }}</strong> do tài xế <strong>{{ t.driverName }}</strong>
          (SĐT: <a :href="'tel:' + t.driverPhone" class="underline font-bold text-amber-900">{{ t.driverPhone }}</a>)
          đến hiện trường tiếp quản lô mủ cao su của chuyến xe.
        </p>
        <p class="text-xs text-slate-700 mt-1">
          👉 <strong>Chỉ dẫn tài xế:</strong> Vui lòng giữ an toàn hiện trường, bàn giao hàng hóa/phiếu cân khi xe đến, và chờ xe cứu hộ kỹ thuật tới xử lý vỏ/máy.
        </p>
      </div>
    </div>

    <!-- Banner thông báo cho TÀI XẾ MỚI: Nhận lệnh điều xe cứu viện khẩn cấp -->
    <div v-for="t in rescueTrips" :key="'rescue-' + t.id" class="rescue-alert-banner mb-4">
      <div class="banner-icon-box">
        <span class="rescue-banner-pulse">🚨</span>
      </div>
      <div class="banner-body-text">
        <div class="flex items-center gap-2">
          <span class="badge-tag-red">LỆNH ĐIỀU ĐỘNG CỨU VIỆN KHẨN CẤP</span>
          <span class="font-bold text-red-900 text-sm">Chuyến: {{ t.tripCode }}</span>
        </div>
        <p class="text-xs text-red-950 mt-1">
          Bạn được điều động xe <strong>{{ t.vehiclePlate }}</strong> tiếp quản chuyến xe thay cho xe <strong>{{ t.replacementInfo?.originalVehiclePlate }}</strong> gặp sự cố:
          <em>"{{ t.replacementInfo?.incidentReason }}"</em>.
        </p>
        <div class="rescue-quick-actions mt-2.5 flex flex-wrap items-center gap-2 text-xs">
          <a :href="'tel:' + t.replacementInfo?.originalDriverPhone" class="btn btn-xs btn-outline-danger flex items-center gap-1.5 font-bold">
            <Phone :size="12" />
            <span>Gọi tài xế cũ: {{ t.replacementInfo?.originalDriverName }} ({{ t.replacementInfo?.originalDriverPhone }})</span>
          </a>
          <a
            v-if="t.replacementInfo?.incidentGps"
            :href="'https://www.google.com/maps?q=' + t.replacementInfo?.incidentGps"
            target="_blank"
            class="btn btn-xs btn-primary flex items-center gap-1.5 font-bold"
          >
            <MapPin :size="12" />
            <span>Mở Google Maps Dẫn Đường Đến Hiện Trường ({{ t.replacementInfo?.incidentGps }})</span>
            <ExternalLink :size="11" />
          </a>
        </div>
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
        :class="{
          'border-assigned': trip.status === 'ASSIGNED',
          'border-accepted': trip.status === 'ACCEPTED',
          'border-running': trip.status === 'INPROGRESS',
          'border-arrived': trip.status === 'ARRIVED',
          'border-rescue': !!trip.replacementInfo?.isRescueTrip,
        }"
      >
        <div class="trip-card-header">
          <div class="trip-code-box">
            <span class="trip-code">{{ trip.tripCode }}</span>
            <StatusBadge :status="trip.status" />
            <span v-if="trip.replacementInfo?.isRescueTrip" class="badge-rescue-mini">🚨 Xe Cứu Viện</span>
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

          <!-- Thông tin tiếp nhận cuốc xe sự cố / xe cứu viện -->
          <div v-if="trip.replacementInfo" class="rescue-card-box mb-3">
            <div class="rescue-box-header">
              <AlertTriangle :size="14" class="text-danger" />
              <strong>TIẾP QUẢN CHUYẾN XE SỰ CỐ DỌC ĐƯỜNG</strong>
            </div>
            <div class="rescue-box-grid">
              <div>
                <span class="text-muted text-xs">Phương tiện & Tài xế cũ:</span>
                <div class="font-bold text-red-700">
                  {{ trip.replacementInfo.originalVehiclePlate }} — {{ trip.replacementInfo.originalDriverName }}
                </div>
                <a :href="'tel:' + trip.replacementInfo.originalDriverPhone" class="text-xs text-primary font-bold inline-flex items-center gap-1 mt-0.5">
                  <Phone :size="11" />
                  <span>{{ trip.replacementInfo.originalDriverPhone }} (Bấm gọi)</span>
                </a>
              </div>
              <div>
                <span class="text-muted text-xs">Nguyên nhân điều xe:</span>
                <div class="text-xs text-danger font-bold mt-0.5">
                  {{ trip.replacementInfo.incidentReason }}
                </div>
                <span class="text-xs text-muted">{{ trip.replacementInfo.incidentLocationDesc }}</span>
              </div>
              <div v-if="trip.replacementInfo.incidentGps" class="col-span-full">
                <span class="text-muted text-xs">Tọa độ hiện trường:</span>
                <div class="mt-0.5">
                  <a
                    :href="'https://www.google.com/maps?q=' + trip.replacementInfo.incidentGps"
                    target="_blank"
                    class="btn-maps-route"
                  >
                    <MapPin :size="12" class="text-danger" />
                    <span>{{ trip.replacementInfo.incidentGps }} — Bấm mở Google Maps dẫn đường</span>
                    <ExternalLink :size="11" />
                  </a>
                </div>
              </div>
            </div>
            <div class="rescue-handover-footer mt-2 pt-2 border-t border-red-200">
              <button
                v-if="trip.replacementInfo.handoverStatus !== 'HANDED_OVER'"
                class="btn btn-xs btn-success flex items-center gap-1.5 font-bold shadow-sm"
                @click="confirmRescueHandover(trip)"
              >
                <CheckCircle2 :size="13" />
                <span>Xác Nhận Đã Đến Hiện Trường & Tiếp Nhận Lô Mủ</span>
              </button>
              <div v-else class="text-xs text-success font-bold flex items-center gap-1.5">
                <CheckCircle2 :size="14" />
                <span>Đã tiếp nhận bàn giao lô mủ cao su tại hiện trường</span>
              </div>
            </div>
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

    <!-- 2. Lịch sử chuyến đã hoàn thành của xe tài xế phụ trách -->
    <div class="card mt-4">
      <div class="card-header flex-between history-header">
        <div class="flex items-center gap-2">
          <h3 class="card-title mb-0">Lịch Sử Chuyến Đi Đã Hoàn Thành</h3>
          <span v-if="myVehicle" class="badge badge-blue">
            <Truck :size="12" />
            <span>Xe: {{ myVehicle.licensePlate }}</span>
          </span>
        </div>
        <!-- Bộ lọc phương tiện thiết kế dạng Segmented Chips trực quan & hiện đại -->
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
      </div>

      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th style="width: 155px; white-space: nowrap">Mã Chuyến</th>
              <th style="width: 110px; white-space: nowrap">Phương Tiện</th>
              <th style="min-width: 200px">Lộ Trình</th>
              <th style="width: 150px; white-space: nowrap">Cự Ly Chạy</th>
              <th style="width: 140px; white-space: nowrap">Sản Lượng Mủ (kg)</th>
              <th style="width: 170px; white-space: nowrap">Dầu Chuẩn / Thực Tế</th>
              <th style="width: 140px; white-space: nowrap">Chi Phí (VNĐ)</th>
              <th style="width: 120px; white-space: nowrap">Trạng Thái</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="finishedTrips.length === 0">
              <td colspan="8" class="text-center py-5 text-muted">
                Chưa có chuyến xe nào hoàn thành cho phương tiện này.
              </td>
            </tr>

            <tr v-for="t in finishedTrips" :key="t.id">
              <td style="white-space: nowrap"><strong class="font-mono text-slate-800">{{ t.tripCode }}</strong></td>
              <td style="white-space: nowrap"><strong class="font-mono text-slate-800">{{ t.vehiclePlate }}</strong></td>
              <td>{{ t.routeName }}</td>
              <td style="white-space: nowrap">
                <strong>{{ t.actualDistanceKm }} km</strong>
                <span class="text-xs text-muted"> ({{ t.startOdo }} ➔ {{ t.endOdo }})</span>
              </td>
              <td style="white-space: nowrap">
                <strong v-if="t.totalLatexWeightKg" class="text-success">
                  {{ t.totalLatexWeightKg.toLocaleString() }} kg
                </strong>
                <span v-else class="text-muted">—</span>
              </td>
              <td style="white-space: nowrap">
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
              <td style="white-space: nowrap">
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

/* Banner chuyến xe chuyển giao & Cứu viện */
.transferred-trip-banner {
  background: #fffbeb;
  border: 1.5px solid #f59e0b;
  border-radius: var(--radius-md);
  padding: 14px 18px;
  display: flex;
  align-items: flex-start;
  gap: 14px;
  box-shadow: 0 2px 6px rgba(245, 158, 11, 0.1);
}
.rescue-alert-banner {
  background: #fef2f2;
  border: 1.5px solid #ef4444;
  border-radius: var(--radius-md);
  padding: 14px 18px;
  display: flex;
  align-items: flex-start;
  gap: 14px;
  box-shadow: 0 3px 8px rgba(239, 68, 68, 0.15);
}
.banner-icon-box {
  flex-shrink: 0;
  margin-top: 2px;
}
.rescue-banner-pulse {
  font-size: 1.6rem;
  animation: pulse-rescue 1.5s infinite;
  display: inline-block;
}
@keyframes pulse-rescue {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.2); opacity: 0.85; }
}
.badge-tag-amber {
  background: #fef3c7;
  color: #b45309;
  border: 1px solid #fde68a;
  font-size: 0.6875rem;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 9999px;
}
.badge-tag-red {
  background: #fee2e2;
  color: #b91c1c;
  border: 1px solid #fca5a5;
  font-size: 0.6875rem;
  font-weight: 800;
  padding: 2px 8px;
  border-radius: 9999px;
  letter-spacing: 0.3px;
}
.border-rescue {
  border: 2px solid #ef4444 !important;
  box-shadow: 0 4px 12px rgba(239, 68, 68, 0.12) !important;
}
.badge-rescue-mini {
  background: #ef4444;
  color: #ffffff;
  font-size: 0.6875rem;
  font-weight: 800;
  padding: 2px 6px;
  border-radius: 4px;
  letter-spacing: 0.2px;
}
.rescue-card-box {
  background: #fff5f5;
  border: 1px solid #fecaca;
  border-radius: var(--radius-md);
  padding: 10px 14px;
}
.rescue-box-header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.75rem;
  color: #991b1b;
  margin-bottom: 8px;
  border-bottom: 1px dashed #fca5a5;
  padding-bottom: 4px;
}
.rescue-box-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px 12px;
}
.btn-maps-route {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: #eff6ff;
  color: #1d4ed8;
  border: 1px solid #bfdbfe;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 0.725rem;
  font-weight: 600;
  text-decoration: none;
  transition: all 0.15s ease;
}
.btn-maps-route:hover {
  background: #dbeafe;
  color: #1e40af;
}

/* =======================================================
   VEHICLE FILTER CHIPS TOOLBAR (CARD HEADER)
   ======================================================= */
.history-header {
  flex-wrap: wrap;
  gap: 12px;
}

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

@media (max-width: 900px) {
  .veh-filter-wrapper {
    width: 100%;
    flex-direction: column;
    align-items: flex-start;
  }
}

@media (max-width: 768px) {
  .trip-cards-grid { grid-template-columns: 1fr; }
  .inprogress-actions-row { grid-template-columns: 1fr; }
  .trip-expense-summary-strip { flex-direction: column; align-items: flex-start; }
  .rescue-box-grid { grid-template-columns: 1fr; }
}
</style>
