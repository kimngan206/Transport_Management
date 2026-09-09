<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useBookingStore } from '@/stores/booking';
import { useFleetStore } from '@/stores/fleet';
import { useDispatchStore } from '@/stores/dispatch';
import { useAuthStore } from '@/stores/auth';
import { useDialogStore } from '@/stores/dialog';
import type { TransportRequest } from '@/types';
import { suggestOptimalRoute } from '@/utils/routeMatcher';
import {
  Truck,
  UserCheck,
  Navigation,
  Sparkles,
  MapPin,
  Route,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Clock,
  Calendar,
  Package,
  Building,
  User,
  FileText,
  Save,
  Check,
  X,
  Phone,
  ShieldCheck,
} from 'lucide-vue-next';

const props = defineProps<{
  request: TransportRequest;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'dispatched'): void;
}>();

const bookingStore = useBookingStore();
const fleetStore = useFleetStore();
const dispatchStore = useDispatchStore();
const authStore = useAuthStore();
const dialog = useDialogStore();

const vehicleId = ref<number | ''>('');
const driverId = ref<number | ''>('');
const scheduledStartTime = ref<string>(props.request.startTime);
const scheduledEndTime = ref<string>(props.request.endTime);
const notes = ref<string>(`Điều động xe phục vụ yêu cầu ${props.request.requestCode}`);
const errorMsg = ref<string>('');

// Gợi ý tuyến đường quy chuẩn dựa trên điểm đi và điểm đến
const routeMatchResult = computed(() => {
  if (!props.request) {
    return {
      route: fleetStore.routes[0],
      score: 0,
      reason: 'Chưa có thông tin yêu cầu',
      matchedFromHub: null,
      matchedToHub: null,
    };
  }
  const vType = (props.request.vehicleType as string) || '';
  if (vType === 'PassengerCar' || vType === 'Pickup') {
    return {
      route: fleetStore.routes.find((r) => r.id === 999) || fleetStore.routes[0],
      score: 100,
      reason: 'Lộ trình tùy chỉnh cho xe công tác / chở người',
      matchedFromHub: null,
      matchedToHub: null,
    };
  }
  return suggestOptimalRoute(fleetStore.routes, props.request.fromLocation, props.request.toLocation);
});

// Tuyến đường quy chuẩn đang chọn (mặc định lấy theo gợi ý)
const selectedRouteId = ref<number>(
  routeMatchResult.value.route?.id || fleetStore.routes[0]?.id || 1
);

watch(
  () => routeMatchResult.value.route?.id,
  (newId) => {
    if (newId) {
      selectedRouteId.value = newId;
    }
  },
  { immediate: true }
);

// Tuyến đường hiệu lực
const activeRoute = computed(() => {
  return (
    fleetStore.routes.find((r) => r.id === selectedRouteId.value) ||
    routeMatchResult.value.route ||
    fleetStore.routes[0]
  );
});

// Danh sách xe phù hợp loại xe yêu cầu
const compatibleVehicles = computed(() => {
  const reqType = (props.request.vehicleType || '').toLowerCase();
  return fleetStore.vehicles.filter((v) => {
    const vType = (v.vehicleType || '').toLowerCase();
    if (reqType === 'latextruck' || reqType === 'truck') {
      return vType === 'latextruck' || vType === 'truck';
    }
    if (reqType === 'passengercar' || reqType === 'pickup') {
      return vType === 'passengercar' || vType === 'pickup';
    }
    return true;
  });
});

// Danh sách tất cả xe (ưu tiên xe phù hợp lên trước)
const sortedVehicles = computed(() => {
  const reqType = (props.request.vehicleType || '').toLowerCase();
  return [...fleetStore.vehicles].sort((a, b) => {
    const aMatch = (a.vehicleType || '').toLowerCase() === reqType ? 1 : 0;
    const bMatch = (b.vehicleType || '').toLowerCase() === reqType ? 1 : 0;
    if (aMatch !== bMatch) return bMatch - aMatch;
    const aAvail = a.status === 'Available' ? 1 : 0;
    const bAvail = b.status === 'Available' ? 1 : 0;
    return bAvail - aAvail;
  });
});

const selectedVehicle = computed(() => {
  return fleetStore.vehicles.find((v) => v.id === Number(vehicleId.value));
});

const selectedDriver = computed(() => {
  return fleetStore.drivers.find((d) => d.id === Number(driverId.value));
});

// Tự động gán tài xế khi chọn xe
watch(vehicleId, (newId) => {
  if (newId && selectedVehicle.value && selectedVehicle.value.assignedDriverId) {
    driverId.value = selectedVehicle.value.assignedDriverId;
  }
});

// Khởi tạo tự động chọn xe phù hợp nhất còn trống
onMounted(() => {
  const firstAvailable = compatibleVehicles.value.find((v) => v.status === 'Available');
  if (firstAvailable) {
    vehicleId.value = firstAvailable.id;
    if (firstAvailable.assignedDriverId) {
      driverId.value = firstAvailable.assignedDriverId;
    }
  } else if (sortedVehicles.value.length > 0) {
    const anyAvailable = sortedVehicles.value.find((v) => v.status === 'Available');
    if (anyAvailable) {
      vehicleId.value = anyAvailable.id;
      if (anyAvailable.assignedDriverId) {
        driverId.value = anyAvailable.assignedDriverId;
      }
    }
  }
});

// Kiểm tra sức chứa
const isCapacityOk = computed(() => {
  if (!selectedVehicle.value) return true;
  if (selectedVehicle.value.vehicleType === 'LatexTruck') {
    const reqKg = props.request.estimatedWeightKg || 0;
    const maxKg = selectedVehicle.value.capacityTons * 1000;
    return reqKg <= maxKg;
  }
  if (selectedVehicle.value.vehicleType === 'PassengerCar') {
    const reqPassengers = props.request.passengersCount || 1;
    const maxPassengers = selectedVehicle.value.passengerCapacity || 5;
    return reqPassengers <= maxPassengers;
  }
  return true;
});

// Tỷ lệ tải trọng
const loadPercentage = computed(() => {
  if (!selectedVehicle.value) return 0;
  if (selectedVehicle.value.vehicleType === 'LatexTruck') {
    const reqKg = props.request.estimatedWeightKg || 0;
    const maxKg = selectedVehicle.value.capacityTons * 1000;
    if (maxKg === 0) return 0;
    return Math.min(Math.round((reqKg / maxKg) * 100), 100);
  }
  if (selectedVehicle.value.vehicleType === 'PassengerCar') {
    const reqPassengers = props.request.passengersCount || 1;
    const maxPassengers = selectedVehicle.value.passengerCapacity || 5;
    if (maxPassengers === 0) return 0;
    return Math.min(Math.round((reqPassengers / maxPassengers) * 100), 100);
  }
  return 0;
});

function getVehicleTypeLabel(type: string): string {
  const t = (type || '').toLowerCase();
  switch (t) {
    case 'latextruck':
    case 'truck':
      return 'Xe tải';
    case 'passengercar':
    case 'pickup':
      return 'Bán tải';
    case 'millingmachine':
    case 'excavator':
      return 'Máy đào';
    default:
      return type;
  }
}

function getVehicleStatusLabel(status: string): string {
  switch (status) {
    case 'Available':
      return 'Sẵn sàng';
    case 'OnTrip':
      return 'Đang chạy';
    case 'UnderMaintenance':
      return 'Bảo dưỡng';
    case 'Broken':
      return 'Hỏng hóc';
    default:
      return status;
  }
}

function handleSave() {
  errorMsg.value = '';
  if (!vehicleId.value || !driverId.value) {
    errorMsg.value = 'Vui lòng chọn đầy đủ Phương tiện vận tải và Tài xế!';
    dialog.showWarning(
      'Vui lòng chọn đầy đủ Phương tiện vận tải và Tài xế trước khi lưu ghép xe!',
      'Thiếu Thông Tin Điều Phối',
      'Kiểm tra lại'
    );
    return;
  }

  if (!isCapacityOk.value) {
    dialog.showWarning(
      'Khối lượng hoặc số người vượt quá sức chứa tối đa của phương tiện đã chọn!',
      'Vượt Tải Trọng',
      'Chọn xe khác'
    );
    return;
  }

  // Tự động phê duyệt nếu yêu cầu đang ở trạng thái PENDING
  if (props.request.status === 'PENDING') {
    bookingStore.approveRequest(
      props.request.id,
      authStore.currentUser.id,
      authStore.currentUser.fullName,
      'Điều phối viên duyệt và gán xe trực tiếp'
    );
  }

  const res = dispatchStore.dispatchTrip({
    vehicleId: Number(vehicleId.value),
    driverId: Number(driverId.value),
    requestIds: [props.request.id],
    routeId: activeRoute.value.id,
    scheduledStartTime: scheduledStartTime.value,
    scheduledEndTime: scheduledEndTime.value,
    notes: notes.value,
    dispatcherName: authStore.currentUser.fullName,
  });

  if (!res.success) {
    errorMsg.value = res.message;
    dialog.showWarning(res.message || 'Không thể điều phối chuyến xe!', 'Lỗi Điều Phối', 'Thực hiện lại');
  } else {
    dialog.showSuccess(
      `Đã ghép xe thành công cho yêu cầu ${props.request.requestCode}! Chuyến xe được gán cho phương tiện ${selectedVehicle.value?.licensePlate} và tài xế ${selectedDriver.value?.fullName}.`,
      'Ghép Xe Thành Công'
    );
    emit('dispatched');
    emit('close');
  }
}
</script>

<template>
  <div class="card inline-dispatch-card">
    <!-- Header của khối ghép xe -->
    <div class="dispatch-form-header">
      <div class="header-left">
        <button class="btn-back" @click="emit('close')" title="Quay lại danh sách yêu cầu">
          <ArrowLeft :size="18" />
          <span>Quay lại danh sách</span>
        </button>
        <div class="title-wrap">
          <h2 class="dispatch-title">
            <Truck :size="22" class="text-primary" />
            <span>Thiết Lập Điều Phối & Ghép Chuyến Xe</span>
          </h2>
          <p class="dispatch-sub">
            Gán phương tiện, tài xế và kiểm tra lộ trình chuẩn hóa cho yêu cầu vận chuyển mủ cao su
          </p>
        </div>
      </div>

      <div class="header-right">
        <div class="req-badge-summary">
          <span class="req-code-big">{{ props.request.requestCode }}</span>
          <span v-if="props.request.status === 'PENDING'" class="badge-pending-tag">
            <Clock :size="11" /> Chờ duyệt
          </span>
          <span v-else class="badge-approved-tag">
            <Check :size="11" /> Đã duyệt
          </span>
        </div>
      </div>
    </div>

    <!-- Alert thông báo lỗi nếu có -->
    <div v-if="errorMsg" class="alert alert-danger mx-6 mt-4">
      <AlertCircle :size="18" />
      <span>{{ errorMsg }}</span>
    </div>

    <div class="dispatch-form-body">
      <!-- 1. THẺ TÓM TẮT THÔNG TIN YÊU CẦU ĐẶT XE -->
      <div class="request-summary-card">
        <div class="summary-grid">
          <div class="summary-col">
            <span class="summary-lbl">
              <MapPin :size="14" class="text-primary" />
              <span>Lộ Trình Đặt Xe</span>
            </span>
            <div class="summary-val route-display">
              <strong>{{ props.request.fromLocation }}</strong>
              <span class="route-arrow">➔</span>
              <strong>{{ props.request.toLocation }}</strong>
            </div>
          </div>

          <div class="summary-col">
            <span class="summary-lbl">
              <Calendar :size="14" class="text-amber" />
              <span>Thời Gian Cần Xe</span>
            </span>
            <div class="summary-val">
              <div class="font-bold text-slate-800">{{ props.request.startTime.slice(0, 10) }}</div>
              <div class="text-xs text-muted">{{ props.request.startTime.slice(11) }} - {{ props.request.endTime.slice(11) }}</div>
            </div>
          </div>

          <div class="summary-col">
            <span class="summary-lbl">
              <Package :size="14" class="text-success" />
              <span>Khối Lượng / Người</span>
            </span>
            <div class="summary-val">
              <strong v-if="props.request.estimatedWeightKg" class="text-success text-sm font-bold">
                {{ props.request.estimatedWeightKg.toLocaleString() }} kg mủ
              </strong>
              <strong v-if="props.request.passengersCount" class="text-info text-sm font-bold">
                {{ props.request.passengersCount }} người
              </strong>
              <span v-if="!props.request.estimatedWeightKg && !props.request.passengersCount" class="text-muted">—</span>
              <span class="req-type-pill mt-1">{{ getVehicleTypeLabel(props.request.vehicleType) }}</span>
            </div>
          </div>

          <div class="summary-col">
            <span class="summary-lbl">
              <User :size="14" class="text-blue" />
              <span>Người Đặt & Đơn Vị</span>
            </span>
            <div class="summary-val">
              <div class="font-bold text-slate-800">{{ props.request.requesterName }}</div>
              <div class="text-xs text-muted">{{ props.request.departmentName }}</div>
            </div>
          </div>
        </div>

        <div v-if="props.request.purpose" class="summary-purpose mt-3">
          <FileText :size="13" class="text-muted" />
          <span class="text-xs text-slate-600"><strong>Mục đích:</strong> {{ props.request.purpose }}</span>
        </div>
      </div>

      <!-- 2. LỘ TRÌNH QUY CHUẨN ÁP DỤNG & GỢI Ý TỰ ĐỘNG -->
      <div class="section-box route-box mt-4">
        <div class="section-box-header">
          <h4 class="section-title">
            <Navigation :size="17" class="text-primary" />
            <span>1. Lộ trình quy chuẩn áp dụng (Tự động gợi ý từ điểm xuất phát)</span>
          </h4>
          <span v-if="selectedRouteId === routeMatchResult.route?.id" class="badge-ai-suggest">
            <Sparkles :size="13" /> Gợi ý tối ưu từ điểm đi gần nhất
          </span>
        </div>

        <p class="route-hint-text">
          Dựa trên yêu cầu từ <strong>{{ props.request.fromLocation }}</strong>
          <span v-if="props.request.toLocation"> ➔ <strong>{{ props.request.toLocation }}</strong></span>:
          Hệ thống đã tự động tra cứu danh mục tuyến quy chuẩn và gợi ý tuyến đường phù hợp nhất có cự ly định mức km chuẩn.
        </p>

        <div class="form-group mb-3">
          <label class="form-label font-bold">Tuyến đường quy chuẩn áp dụng:</label>
          <select v-model="selectedRouteId" class="form-select">
            <option
              v-for="r in fleetStore.routes"
              :key="r.id"
              :value="r.id"
            >
              {{ r.routeCode }} - {{ r.name }} ({{ r.standardDistanceKm }} km) {{ r.id === routeMatchResult.route?.id ? '★ [Khớp nhất]' : '' }}
            </option>
          </select>
        </div>

        <!-- Chi tiết tuyến đang chọn -->
        <div v-if="activeRoute" class="route-detail-card">
          <div class="route-detail-main">
            <div class="route-name-row">
              <span class="route-code-badge">{{ activeRoute.routeCode }}</span>
              <strong class="route-name-title">{{ activeRoute.name }}</strong>
            </div>
            <div class="route-points-row">
              <span class="point-chip start">
                <MapPin :size="12" /> Điểm xuất phát: <strong>{{ activeRoute.startPoint }}</strong>
              </span>
              <span class="point-arrow">➔</span>
              <span class="point-chip end">
                <MapPin :size="12" /> Điểm đến: <strong>{{ activeRoute.endPoint }}</strong>
              </span>
            </div>
            <div v-if="activeRoute.description" class="route-description-text">
              <Route :size="12" />
              <span>{{ activeRoute.description }}</span>
            </div>
          </div>

          <div class="route-distance-badge">
            <div class="dist-val">{{ activeRoute.standardDistanceKm }} <span class="dist-unit">km</span></div>
            <div class="dist-lbl">Cự ly định mức</div>
          </div>
        </div>
      </div>

      <!-- 3. CHỌN PHƯƠNG TIỆN & TÀI XẾ -->
      <div class="grid-2 mt-4">
        <!-- Cột Trái: Phương tiện -->
        <div class="form-card-col">
          <div class="col-header">
            <Truck :size="17" class="text-primary" />
            <h4 class="col-title">2. Chọn Phương Tiện Vận Tải <span class="text-danger">*</span></h4>
          </div>

          <div class="form-group mb-3">
            <label class="form-label">Phương tiện điều động:</label>
            <select v-model="vehicleId" class="form-select">
              <option value="">-- Chọn xe phù hợp --</option>
              <option
                v-for="v in sortedVehicles"
                :key="v.id"
                :value="v.id"
                :disabled="v.status !== 'Available'"
              >
                {{ v.licensePlate }} ({{ getVehicleTypeLabel(v.vehicleType) }} - Tải {{ v.capacityTons }}T) [{{ getVehicleStatusLabel(v.status) }}]
              </option>
            </select>
          </div>

          <!-- Card thông tin xe được chọn -->
          <div v-if="selectedVehicle" class="resource-preview-card">
            <div class="preview-row">
              <span class="preview-lbl">Biển số:</span>
              <strong class="font-mono text-base text-slate-800">{{ selectedVehicle.licensePlate }}</strong>
              <span class="status-pill-avail" :class="'status-' + selectedVehicle.status.toLowerCase()">
                {{ getVehicleStatusLabel(selectedVehicle.status) }}
              </span>
            </div>
            <div class="preview-row mt-1">
              <span class="preview-lbl">Loại xe:</span>
              <span class="text-slate-700">{{ getVehicleTypeLabel(selectedVehicle.vehicleType) }}</span>
            </div>
            <div class="preview-row mt-1">
              <span class="preview-lbl">Sức chứa định mức:</span>
              <strong class="text-slate-800">
                {{ (selectedVehicle.capacityTons * 1000).toLocaleString() }} kg
                <span class="text-muted font-normal">({{ selectedVehicle.capacityTons }} tấn)</span>
              </strong>
            </div>

            <!-- Thanh kiểm tra sức chứa -->
            <div class="capacity-bar-wrap mt-3">
              <div class="capacity-header">
                <span class="text-xs font-semibold text-slate-700">Tải trọng yêu cầu:</span>
                <span class="text-xs font-bold" :class="isCapacityOk ? 'text-success' : 'text-danger'">
                  {{ (props.request.estimatedWeightKg || 0).toLocaleString() }} kg / {{ (selectedVehicle.capacityTons * 1000).toLocaleString() }} kg ({{ loadPercentage }}%)
                </span>
              </div>
              <div class="progress-track">
                <div
                  class="progress-fill"
                  :style="{ width: loadPercentage + '%' }"
                  :class="isCapacityOk ? 'bg-success' : 'bg-danger'"
                ></div>
              </div>
              <div v-if="isCapacityOk" class="capacity-status-ok mt-1">
                <CheckCircle2 :size="13" class="text-success" />
                <span>Không vượt sức chứa phương tiện</span>
              </div>
              <div v-else class="capacity-status-fail mt-1">
                <AlertCircle :size="13" class="text-danger" />
                <span>Vượt quá tải trọng tối đa của xe! Vui lòng chọn xe tải lớn hơn.</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Cột Phải: Tài xế -->
        <div class="form-card-col">
          <div class="col-header">
            <UserCheck :size="17" class="text-primary" />
            <h4 class="col-title">3. Chọn Tài Xế Phân Công <span class="text-danger">*</span></h4>
          </div>

          <div class="form-group mb-3">
            <label class="form-label">Tài xế nhận chuyến:</label>
            <select v-model="driverId" class="form-select">
              <option value="">-- Chọn tài xế --</option>
              <option
                v-for="d in fleetStore.drivers"
                :key="d.id"
                :value="d.id"
                :disabled="d.employmentStatus !== 'Active' || d.isCurrentlyOnTrip"
              >
                {{ d.fullName }} ({{ d.licenseClass }} - Hạn: {{ d.licenseExpiryDate }})
              </option>
            </select>
          </div>

          <!-- Card thông tin tài xế được chọn -->
          <div v-if="selectedDriver" class="resource-preview-card">
            <div class="preview-row">
              <span class="preview-lbl">Họ và tên:</span>
              <strong class="text-base text-slate-800">{{ selectedDriver.fullName }}</strong>
              <span class="status-pill-avail" :class="selectedDriver.isCurrentlyOnTrip ? 'status-ontrip' : 'status-available'">
                {{ selectedDriver.isCurrentlyOnTrip ? 'Đang chạy' : 'Sẵn sàng' }}
              </span>
            </div>
            <div class="preview-row mt-1">
              <span class="preview-lbl">Số điện thoại:</span>
              <a :href="'tel:' + selectedDriver.phone" class="text-primary font-mono font-bold flex items-center gap-1">
                <Phone :size="12" />
                <span>{{ selectedDriver.phone }}</span>
              </a>
            </div>
            <div class="preview-row mt-1">
              <span class="preview-lbl">Hạng bằng lái:</span>
              <div class="flex items-center gap-2">
                <span class="badge-license">{{ selectedDriver.licenseClass }}</span>
                <span class="text-xs text-muted">Hạn: {{ selectedDriver.licenseExpiryDate }}</span>
                <ShieldCheck :size="14" class="text-success" title="Bằng lái còn hiệu lực" />
              </div>
            </div>
            <div class="preview-row mt-1">
              <span class="preview-lbl">Trạng thái hồ sơ:</span>
              <span class="text-xs font-semibold text-success">Đang hoạt động (Chính thức)</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 4. THỜI GIAN & GHI CHÚ ĐIỀU ĐỘNG -->
      <div class="grid-2 mt-4">
        <div class="form-group">
          <label class="form-label font-bold">Thời gian khởi hành dự kiến:</label>
          <div class="input-with-icon">
            <Clock :size="16" class="input-icon" />
            <input v-model="scheduledStartTime" type="text" class="form-control pl-9" placeholder="YYYY-MM-DD HH:mm" />
          </div>
          <span class="text-xs text-muted mt-1 block">Mặc định lấy theo thời gian yêu cầu</span>
        </div>

        <div class="form-group">
          <label class="form-label font-bold">Thời gian kết thúc dự kiến:</label>
          <div class="input-with-icon">
            <Clock :size="16" class="input-icon" />
            <input v-model="scheduledEndTime" type="text" class="form-control pl-9" placeholder="YYYY-MM-DD HH:mm" />
          </div>
          <span class="text-xs text-muted mt-1 block">Mặc định lấy theo thời gian yêu cầu</span>
        </div>
      </div>

      <div class="form-group mt-3">
        <label class="form-label font-bold">Ghi chú điều động & Dặn dò tài xế:</label>
        <input
          v-model="notes"
          type="text"
          class="form-control"
          placeholder="Nhập dặn dò tài xế (ví dụ: chú ý kiểm tra nắp bồn téc, cân mủ đúng quy định...)"
        />
      </div>
    </div>

    <!-- FOOTER HÀNH ĐỘNG -->
    <div class="dispatch-form-footer">
      <button class="btn btn-outline btn-cancel-dispatch" @click="emit('close')">
        <X :size="15" />
        <span>Hủy bỏ / Quay lại</span>
      </button>

      <button
        class="btn btn-success btn-submit-dispatch"
        :disabled="!vehicleId || !driverId || !isCapacityOk"
        @click="handleSave"
      >
        <Save :size="17" />
        <span>Lưu & Xác Nhận Ghép Xe</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.inline-dispatch-card {
  background: white;
  border-radius: var(--radius-lg, 12px);
  border: 1px solid var(--border-card, #d6e4d7);
  box-shadow: 0 4px 20px -2px rgba(21, 128, 61, 0.08);
  overflow: hidden;
  margin-bottom: 24px;
  animation: slideDown 0.2s ease-out;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Header */
.dispatch-form-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  background: linear-gradient(to right, #f0fdf4, #ffffff);
  border-bottom: 1px solid var(--border-card, #d6e4d7);
  flex-wrap: wrap;
  gap: 16px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.btn-back {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  background: white;
  border: 1px solid #cbd5e1;
  border-radius: var(--radius-md, 8px);
  font-size: 0.8125rem;
  font-weight: 700;
  color: #334155;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-back:hover {
  background: #f8fafc;
  border-color: #94a3b8;
  color: #0f172a;
}

.title-wrap {
  display: flex;
  flex-direction: column;
}

.dispatch-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 1.15rem;
  font-weight: 800;
  color: #0c1a11;
  margin: 0;
}

.dispatch-sub {
  font-size: 0.8125rem;
  color: #52705d;
  margin: 2px 0 0 0;
}

.req-badge-summary {
  display: flex;
  align-items: center;
  gap: 10px;
  background: white;
  padding: 6px 14px;
  border-radius: var(--radius-md, 8px);
  border: 1px solid #e2e8f0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.req-code-big {
  font-family: monospace;
  font-size: 0.95rem;
  font-weight: 800;
  color: #15803d;
}

.badge-pending-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: #fef3c7;
  color: #b45309;
  font-size: 0.725rem;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 9999px;
  border: 1px solid #fde68a;
}

.badge-approved-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: #dcfce7;
  color: #15803d;
  font-size: 0.725rem;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 9999px;
  border: 1px solid #bbf7d0;
}

/* Body */
.dispatch-form-body {
  padding: 20px 24px;
}

/* Tóm tắt yêu cầu */
.request-summary-card {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: var(--radius-md, 8px);
  padding: 16px 20px;
}

.summary-grid {
  display: grid;
  grid-template-columns: 1.5fr 1fr 1fr 1fr;
  gap: 16px;
}

@media (max-width: 900px) {
  .summary-grid {
    grid-template-columns: 1fr 1fr;
  }
}

.summary-col {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.summary-lbl {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: #64748b;
}

.summary-val {
  font-size: 0.875rem;
  color: #1e293b;
}

.route-display {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.route-arrow {
  color: #15803d;
  font-weight: 800;
}

.req-type-pill {
  display: inline-block;
  background: #e2e8f0;
  color: #334155;
  font-size: 0.7rem;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 4px;
}

.summary-purpose {
  display: flex;
  align-items: center;
  gap: 6px;
  padding-top: 10px;
  border-top: 1px dashed #cbd5e1;
}

/* Khối lộ trình quy chuẩn */
.section-box {
  background: #fbfdf9;
  border: 1px solid #d6e4d7;
  border-radius: var(--radius-md, 8px);
  padding: 18px 20px;
}

.section-box-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  flex-wrap: wrap;
  gap: 8px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.925rem;
  font-weight: 800;
  color: #0c1a11;
  margin: 0;
}

.badge-ai-suggest {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: #dcfce7;
  color: #166534;
  font-size: 0.75rem;
  font-weight: 700;
  padding: 3px 10px;
  border-radius: 9999px;
  border: 1px solid #86efac;
}

.route-hint-text {
  font-size: 0.8125rem;
  color: #52705d;
  margin-bottom: 12px;
  line-height: 1.5;
}

.route-detail-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: white;
  border: 1px solid #d6e4d7;
  border-radius: var(--radius-sm, 6px);
  padding: 12px 16px;
  gap: 16px;
}

.route-name-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.route-code-badge {
  background: #15803d;
  color: white;
  font-size: 0.75rem;
  font-weight: 800;
  padding: 2px 8px;
  border-radius: 4px;
}

.route-name-title {
  font-size: 0.9rem;
  color: #0f172a;
}

.route-points-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.8rem;
  flex-wrap: wrap;
}

.point-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: #334155;
}

.point-chip.start strong {
  color: #0284c7;
}

.point-chip.end strong {
  color: #15803d;
}

.point-arrow {
  color: #94a3b8;
}

.route-description-text {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.75rem;
  color: #64748b;
  margin-top: 6px;
}

.route-distance-badge {
  text-align: right;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  padding: 8px 14px;
  border-radius: 8px;
  min-width: 90px;
}

.dist-val {
  font-size: 1.25rem;
  font-weight: 900;
  color: #15803d;
  line-height: 1;
}

.dist-unit {
  font-size: 0.75rem;
  font-weight: 600;
}

.dist-lbl {
  font-size: 0.6875rem;
  color: #475569;
  text-transform: uppercase;
  font-weight: 700;
  margin-top: 2px;
}

/* Grid 2 cột cho Phương tiện & Tài xế */
.grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

@media (max-width: 800px) {
  .grid-2 {
    grid-template-columns: 1fr;
  }
}

.form-card-col {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: var(--radius-md, 8px);
  padding: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
}

.col-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #f1f5f9;
}

.col-title {
  font-size: 0.9rem;
  font-weight: 800;
  color: #0f172a;
  margin: 0;
}

.resource-preview-card {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 12px 14px;
}

.preview-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.8125rem;
}

.preview-lbl {
  color: #64748b;
  font-weight: 600;
}

.status-pill-avail {
  font-size: 0.7rem;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 9999px;
}

.status-available {
  background: #dcfce7;
  color: #15803d;
}

.status-ontrip {
  background: #e0f2fe;
  color: #0369a1;
}

.badge-license {
  background: #f1f5f9;
  border: 1px solid #cbd5e1;
  color: #1e293b;
  font-size: 0.75rem;
  font-weight: 800;
  padding: 1px 6px;
  border-radius: 4px;
}

/* Capacity bar */
.capacity-bar-wrap {
  background: white;
  padding: 8px 10px;
  border-radius: 6px;
  border: 1px solid #e2e8f0;
}

.capacity-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 4px;
}

.progress-track {
  width: 100%;
  height: 8px;
  background: #e2e8f0;
  border-radius: 9999px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  transition: width 0.3s ease;
}

.bg-success {
  background: #16a34a;
}

.bg-danger {
  background: #dc2626;
}

.capacity-status-ok {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.75rem;
  font-weight: 700;
  color: #15803d;
}

.capacity-status-fail {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.75rem;
  font-weight: 700;
  color: #dc2626;
}

/* Inputs */
.form-group {
  margin-bottom: 0;
}

.form-label {
  display: block;
  font-size: 0.8125rem;
  font-weight: 700;
  color: #334155;
  margin-bottom: 6px;
}

.form-select,
.form-control {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #cbd5e1;
  border-radius: var(--radius-sm, 6px);
  font-size: 0.875rem;
  color: #0f172a;
  background-color: #ffffff;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.form-select:focus,
.form-control:focus {
  outline: none;
  border-color: #16a34a;
  box-shadow: 0 0 0 3px rgba(22, 163, 74, 0.15);
}

.input-with-icon {
  position: relative;
  display: flex;
  align-items: center;
}

.input-icon {
  position: absolute;
  left: 10px;
  color: #94a3b8;
  pointer-events: none;
}

.pl-9 {
  padding-left: 34px !important;
}

/* Footer Action */
.dispatch-form-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  background: #f8fafc;
  border-top: 1px solid #e2e8f0;
}

.btn-cancel-dispatch {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 18px;
  font-weight: 700;
  color: #475569;
  border-color: #cbd5e1;
  background: white;
  border-radius: var(--radius-md, 8px);
  cursor: pointer;
  transition: all 0.15s;
}

.btn-cancel-dispatch:hover {
  background: #f1f5f9;
  color: #0f172a;
}

.btn-submit-dispatch {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 24px;
  font-size: 0.925rem;
  font-weight: 800;
  background: linear-gradient(135deg, #16a34a, #15803d);
  color: white;
  border: none;
  border-radius: var(--radius-md, 8px);
  box-shadow: 0 4px 12px rgba(22, 163, 74, 0.25);
  cursor: pointer;
  transition: all 0.15s;
}

.btn-submit-dispatch:hover:not(:disabled) {
  background: linear-gradient(135deg, #15803d, #14532d);
  box-shadow: 0 6px 16px rgba(22, 163, 74, 0.35);
  transform: translateY(-1px);
}

.btn-submit-dispatch:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  box-shadow: none;
  transform: none;
}
</style>
