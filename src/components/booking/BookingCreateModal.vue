<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { useBookingStore } from '@/stores/booking';
import { useDialogStore } from '@/stores/dialog';
import { mockStorage } from '@/services/mockStorage';
import { getFreshHubs } from '@/mocks/mapData';
import type { HubLocation } from '@/types/map';
import type { VehicleType } from '@/types';
import {
  X,
  AlertCircle,
  CheckCircle2,
  Clock,
  MapPin,
  Compass,
  Truck,
  Wrench,
  Car,
  Building2,
  Trees,
  ArrowRight,
} from 'lucide-vue-next';

const props = withDefaults(
  defineProps<{
    moduleType?: 'team' | 'factory';
  }>(),
  {
    moduleType: 'team',
  }
);

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'created'): void;
}>();

const authStore = useAuthStore();
const bookingStore = useBookingStore();
const dialog = useDialogStore();

// Xác định phân hệ: Đặt xe Đội vs Đặt xe Nhà máy
const isTeamModule = computed(() => props.moduleType === 'team');

const selectedTeam = ref<string>('Đội 1');
const teamList = ref<string[]>([
  'Đội 1',
  'Đội 2',
  'Đội 3',
  'Đội 4',
  'Đội 5',
]);

// Cụm thu gom tại Đội: Mỗi đội có từ 1-2 cụm, mủ được thu gom và vận chuyển về Nhà máy
const selectedCluster = ref<string>('cum_1');
const clusterOptions = [
  { value: 'cum_1', label: 'Cụm 1', sub: 'Khu vực cụm 1' },
  { value: 'cum_2', label: 'Cụm 2', sub: 'Khu vực cụm 2' },
  { value: 'cum_1_2', label: 'Cụm 1 & 2', sub: 'Thu gom cả 2 cụm' },
];
const selectedClusterLabel = computed(() => {
  const found = clusterOptions.find((c) => c.value === selectedCluster.value);
  return found ? found.label : 'Cụm 1';
});

// Form state
const vehicleType = ref<VehicleType>('LatexTruck');
// Danh mục điểm trạm cố định chuẩn hóa trong hệ thống
const systemHubs = computed<HubLocation[]>(() => getFreshHubs());
// Danh sách điểm trạm vận chuyển cho phân hệ Nhà máy (lấy từ danh mục điểm trạm hệ thống)
const locations = ref<string[]>([
  'Nhà Máy Chế Biến ECOTECH 2A',
  'Trạm Cân 1 (Trung tâm)',
]);
const selectedHubToAdd = ref<string>('');

// Giờ máy dự kiến cho xe cơ giới (MillingMachine)
const operatingHours = ref<number>(4);

// Thuộc tính riêng cho PassengerCar
const pickupTime = ref<string>('');
const dropoffTime = ref<string>('');
const contactPerson = ref<string>('');
const contactPhone = ref<string>('');

// Danh mục loại phương tiện phân theo 2 module riêng biệt:
// 1. Phân hệ ĐẶT XE ĐỘI: MẶC ĐỊNH & CHỈ GỒM "Xe chuyên dùng chở mủ" & "Xe cơ giới" (không có xe con/bán tải)
// 2. Phân hệ ĐẶT XE NHÀ MÁY: Gồm xe bồn téc ly tâm, xe xuất mủ thành phẩm SVR, và xe bán tải công tác KCS
const availableVehicleTypes = computed(() => {
  if (isTeamModule.value) {
    return [
      {
        value: 'LatexTruck' as VehicleType,
        label: 'Xe chuyên dùng chở mủ cao su (Bồn inox / Mui bạt thu gom)',
        shortLabel: 'Xe chuyên dùng chở mủ',
        badge: 'Ưu tiên mủ tươi',
      },
      {
        value: 'MillingMachine' as VehicleType,
        label: 'Xe cơ giới nông trường (Máy xúc đào mương / San ủi vườn cây)',
        shortLabel: 'Xe cơ giới',
        badge: 'Cơ giới hóa',
      },
    ];
  }
  return [
    {
      value: 'LatexTruck' as VehicleType,
      label: 'Xe bồn téc mủ ly tâm & xe tải xuất mủ thành phẩm SVR',
      shortLabel: 'Xe bồn mủ & xuất hàng',
      badge: 'Mủ ly tâm / SVR',
    },
    {
      value: 'PassengerCar' as VehicleType,
      label: 'Xe bán tải đưa đón / công tác KCS & kiểm tra kỹ thuật (5 chỗ)',
      shortLabel: 'Xe công tác / KCS',
      badge: 'Kiểm định KCS',
    },
    {
      value: 'MillingMachine' as VehicleType,
      label: 'Xe cơ giới / Máy xúc nạo vét hồ xử lý nước thải nhà máy',
      shortLabel: 'Xe cơ giới nhà máy',
      badge: 'Hạ tầng / Môi trường',
    },
  ];
});

const purpose = ref<string>('Vận chuyển mủ cao su ca thu hoạch ngày lẻ');

// Tự động cập nhật mục đích mặc định theo phân hệ, loại xe và cụm được chọn
watch(
  [vehicleType, selectedTeam, selectedClusterLabel],
  ([newType, team, cluster]) => {
    if (isTeamModule.value) {
      if (newType === 'LatexTruck') {
        purpose.value = `Thu gom mủ cao su ${team} (${cluster})`;
      } else if (newType === 'MillingMachine') {
        purpose.value = `Đào mương thoát nước & san ủi vườn cây ${team} (${cluster})`;
      }
    } else {
      if (newType === 'LatexTruck') {
        purpose.value = 'Xuất hàng mủ ly tâm & mủ thành phẩm SVR';
      } else if (newType === 'MillingMachine') {
        purpose.value = 'Nạo vét bùn hồ xử lý nước thải nhà máy chế biến';
      } else if (newType === 'PassengerCar') {
        purpose.value = 'Công tác kiểm tra chất lượng mủ KCS & đối ngoại';
      }
    }
  },
  { immediate: true }
);

function addSystemHub(hubName: string) {
  if (!locations.value.includes(hubName)) {
    locations.value.push(hubName);
  }
}

function removeLocation(index: number) {
  locations.value.splice(index, 1);
}

function onSelectHubToAdd() {
  if (selectedHubToAdd.value) {
    addSystemHub(selectedHubToAdd.value);
    selectedHubToAdd.value = '';
  }
}

function getHubTypePrefix(type: string): string {
  if (type === 'factory') return '🏭 Nhà máy';
  if (type === 'weigh_station') return '⚖️ Trạm cân';
  if (type === 'office') return '🏢 Văn phòng';
  if (type === 'farm') return '🌳 Đội NT';
  return '📍 Điểm trạm';
}
const estimatedWeightKg = ref<number>(2500);
const passengersCount = ref<number>(3);

// Helper default times (tự động tìm khung giờ trống hợp lệ: sau hiện tại ít nhất 30 phút và không trùng các chuyến đã duyệt)
function getNextValidTimeSlot(): { start: string; end: string } {
  const pad = (n: number) => String(n).padStart(2, '0');
  const format = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

  const now = new Date();
  // Kiểm tra xem hôm nay có chuyến nào đang duyệt không
  const myApproved = bookingStore.requests.filter(
    (r) => r.requesterId === authStore.currentUser.id && (r.status === 'APPROVED' || r.status === 'INPROGRESS')
  );

  let targetStart = new Date(now.getTime() + 45 * 60 * 1000); // Tối thiểu 45p sau hiện tại

  // Nếu bị vướng chuyến cũ thì đẩy ra sau chuyến kết thúc muộn nhất + 45 phút
  for (const req of myApproved) {
    const reqEnd = new Date(req.endTime).getTime();
    if (targetStart.getTime() < reqEnd + 45 * 60 * 1000) {
      targetStart = new Date(reqEnd + 45 * 60 * 1000);
    }
  }

  const targetEnd = new Date(targetStart.getTime() + 2 * 60 * 60 * 1000);
  return { start: format(targetStart), end: format(targetEnd) };
}

const initialSlot = getNextValidTimeSlot();
const startTime = ref<string>(initialSlot.start);
const endTime = ref<string>(initialSlot.end);
const errorMsg = ref<string>('');

function setQuickSlot(type: 'today_next' | 'tomorrow_morning' | 'tomorrow_afternoon') {
  const pad = (n: number) => String(n).padStart(2, '0');
  const format = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

  if (type === 'today_next') {
    const slot = getNextValidTimeSlot();
    startTime.value = slot.start;
    endTime.value = slot.end;
  } else if (type === 'tomorrow_morning') {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const st = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 8, 0);
    const et = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 10, 30);
    startTime.value = format(st);
    endTime.value = format(et);
  } else if (type === 'tomorrow_afternoon') {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const st = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 13, 30);
    const et = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 16, 0);
    startTime.value = format(st);
    endTime.value = format(et);
  }
}

// Live Validation: Rule 30 phút
const rule30Status = computed(() => {
  if (!startTime.value) return { valid: false, text: 'Chưa chọn giờ' };
  const st = new Date(startTime.value).getTime();
  const diffMins = (st - Date.now()) / (60 * 1000);
  if (diffMins < 30) {
    return {
      valid: false,
      text: `Vi phạm quy định: Giờ bắt đầu chỉ còn ${Math.round(diffMins)} phút (Tối thiểu phải trước 30 phút)!`,
    };
  }
  return {
    valid: true,
    text: `Đạt chuẩn quy tắc 30 phút (Đặt trước ${Math.round(diffMins)} phút)`,
  };
});

// Live Validation: Rule chống trùng lịch 45 phút
const conflictStatus = computed(() => {
  if (!startTime.value || !endTime.value) return { hasConflict: false };
  return bookingStore.hasScheduleConflict(
    authStore.currentUser.id,
    startTime.value.replace('T', ' '),
    endTime.value.replace('T', ' ')
  );
});

function handleSubmit() {
  errorMsg.value = '';

  if (isTeamModule.value) {
    if (!startTime.value || !endTime.value) {
      dialog.showWarning('Vui lòng chọn thời gian bắt đầu và kết thúc chuyến đi!', 'Thiếu Thời Gian', 'Kiểm tra lại');
      return;
    }
  } else {
    if (locations.value.length === 0 || !startTime.value || !endTime.value) {
      dialog.showWarning('Vui lòng điền đầy đủ các thông tin bắt buộc: ít nhất 1 địa điểm và thời gian!', 'Thiếu Thông Tin Bắt Buộc', 'Kiểm tra lại');
      return;
    }
  }

  if (!rule30Status.value.valid) {
    dialog.showWarning(rule30Status.value.text, 'Vi Phạm Quy Định 30 Phút', 'Kiểm tra lại');
    return;
  }

  if (conflictStatus.value.hasConflict) {
    dialog.showWarning(conflictStatus.value.message || 'Khung giờ bạn chọn đã bị trùng lịch với chuyến công tác khác!', 'Trùng Lịch Đặt Xe', 'Kiểm tra lại');
    return;
  }

  const fromLoc = isTeamModule.value
    ? `${selectedTeam.value} (${selectedClusterLabel.value})`
    : (locations.value[0] || 'Nhà Máy Chế Biến ECOTECH 2A');
  const toLoc = isTeamModule.value
    ? (vehicleType.value === 'LatexTruck' ? 'Nhà máy Chế biến ECOTECH 2A' : `Lô vườn cây ${selectedTeam.value}`)
    : (locations.value.length > 1
        ? locations.value.slice(1).join(' ➔ ')
        : (locations.value[0] === 'Nhà Máy Chế Biến ECOTECH 2A' ? 'Trạm Cân 1 (Trung tâm)' : 'Nhà Máy Chế Biến ECOTECH 2A'));

  const res = bookingStore.createRequest({
    requesterId: authStore.currentUser.id,
    requesterName: authStore.currentUser.fullName,
    requesterPhone: authStore.currentUser.phone,
    departmentId: isTeamModule.value ? authStore.currentUser.departmentId : 5,
    departmentName: isTeamModule.value
      ? (authStore.currentUser.departmentName || 'Ban Quản lý Nông trường')
      : 'Nhà máy Chế biến Mủ Cao su',
    teamName: isTeamModule.value ? selectedTeam.value : undefined,
    vehicleType: vehicleType.value,
    startTime: startTime.value.replace('T', ' '),
    endTime: endTime.value.replace('T', ' '),
    fromLocation: fromLoc,
    toLocation: toLoc,
    purpose: purpose.value,
    estimatedWeightKg: vehicleType.value === 'LatexTruck' ? Number(estimatedWeightKg.value) : undefined,
    operatingHours: vehicleType.value === 'MillingMachine' ? Number(operatingHours.value) : undefined,
    passengersCount: vehicleType.value === 'PassengerCar' ? Number(passengersCount.value) : undefined,
    pickupTime: vehicleType.value === 'PassengerCar' ? pickupTime.value.replace('T', ' ') : undefined,
    dropoffTime: vehicleType.value === 'PassengerCar' ? dropoffTime.value.replace('T', ' ') : undefined,
    contactPerson: vehicleType.value === 'PassengerCar' ? contactPerson.value : undefined,
    contactPhone: vehicleType.value === 'PassengerCar' ? contactPhone.value : undefined,
  });

  if (!res.success) {
    errorMsg.value = res.message;
    dialog.showWarning(res.message || 'Không thể tạo yêu cầu đặt xe!', 'Đặt Xe Không Thành Công', 'Thực hiện lại');
  } else {
    emit('created');
    emit('close');
    dialog.showSuccess('Yêu cầu đặt xe của bạn đã được gửi trực tiếp đến Bộ phận Điều phối để duyệt và xếp xe vận chuyển.', 'Đặt Xe Thành Công');
  }
}
</script>

<template>
  <div class="modal-backdrop" @click.self="emit('close')">
    <div class="modal-content modal-lg">
      <div class="modal-header">
        <h3 class="modal-title">
          <Trees v-if="isTeamModule" :size="20" class="text-primary" />
          <Building2 v-else :size="20" class="text-primary" />
          <span>{{ isTeamModule ? 'Tạo Yêu Cầu Đặt Xe Đội Nông Trường' : 'Tạo Yêu Cầu Đặt Xe Nhà Máy Chế Biến' }}</span>
          <span class="module-mode-badge" :class="isTeamModule ? 'badge-team' : 'badge-factory'">
            {{ isTeamModule ? '🌱 Phân hệ: Đặt xe Đội' : '🏭 Phân hệ: Đặt xe Nhà máy' }}
          </span>
        </h3>
        <button class="btn-close" @click="emit('close')">
          <X :size="18" />
        </button>
      </div>

      <div class="modal-body">
        <!-- Thông báo lỗi nếu có -->
        <div v-if="errorMsg" class="alert alert-danger">
          <AlertCircle :size="18" />
          <span>{{ errorMsg }}</span>
        </div>

        <div class="info-banner">
          Người yêu cầu: <strong>{{ authStore.currentUser.fullName }}</strong> ({{ authStore.currentUser.departmentName }})
        </div>

        <!-- Banner thông tin đơn vị theo đúng phân hệ (Độc lập 2 module) -->
        <div v-if="isTeamModule" class="module-scope-card team-mode">
          <div class="scope-header-row">
            <div class="scope-unit-info">
              <Trees :size="16" class="text-success" />
              <span>Đơn vị đặt xe: <strong>Đội sản xuất nông trường cao su</strong></span>
            </div>
            <div class="team-dropdown-inline">
              <label class="team-sub-label">Đội phục vụ <span class="required">*</span>:</label>
              <select v-model="selectedTeam" class="form-select form-select-sm team-select-input">
                <option v-for="team in teamList" :key="team" :value="team">
                  {{ team }}
                </option>
              </select>
            </div>
          </div>
        </div>

        <div v-else class="module-scope-card factory-mode">
          <div class="scope-header-row">
            <div class="scope-unit-info">
              <Building2 :size="16" class="text-primary" />
              <span>Đơn vị đặt xe: <strong>Nhà máy Chế biến Mủ Cao su ECOTECH 2A</strong></span>
            </div>
          </div>
        </div>

        <!-- 1. Loại phương tiện yêu cầu -->
        <div class="form-group">
          <div class="form-label-with-hint">
            <label class="form-label">Loại phương tiện yêu cầu <span class="required">*</span></label>
            <span class="hint-pill" :class="isTeamModule ? 'pill-team' : 'pill-factory'">
              {{ isTeamModule ? 'Mặc định Đội: Xe chuyên dùng chở mủ & Xe cơ giới' : 'Xe phục vụ Nhà máy chế biến & xuất hàng' }}
            </span>
          </div>

          <select v-model="vehicleType" class="form-select vehicle-select-highlight">
            <option
              v-for="opt in availableVehicleTypes"
              :key="opt.value"
              :value="opt.value"
            >
              {{ opt.label }}
            </option>
          </select>
        </div>

        <!-- 2. LỰA CHỌN ĐỊA ĐIỂM THEO PHÂN HỆ -->
        <!-- A. Phân hệ ĐẶT XE ĐỘI: Chỉ cần chọn địa điểm (Cụm tại Đội), không hiển thị lộ trình -->
        <div v-if="isTeamModule" class="form-group team-cluster-select-group">
          <label class="form-label">
            <MapPin :size="14" class="text-success" />
            <span>Địa điểm yêu cầu tại {{ selectedTeam }} <span class="required">*</span></span>
          </label>
          <div class="cluster-segmented-group">
            <button
              v-for="c in clusterOptions"
              :key="c.value"
              type="button"
              class="cluster-seg-btn"
              :class="{ active: selectedCluster === c.value }"
              @click="selectedCluster = c.value"
            >
              <span class="cluster-dot"></span>
              <span class="cluster-name">{{ c.label }}</span>
              <span class="cluster-sub">{{ c.sub }}</span>
            </button>
          </div>
        </div>

        <!-- B. Phân hệ ĐẶT XE NHÀ MÁY: Lựa chọn từ danh mục điểm trạm cố định trong hệ thống -->
        <div v-else class="factory-hubs-container">
          <div class="form-group mb-0">
            <div class="factory-hubs-title-row">
              <label class="form-label mb-0">
                <MapPin :size="15" class="text-primary" />
                <span>Các địa điểm yêu cầu <span class="required">*</span></span>
              </label>
              <span class="text-xs text-muted">Lấy từ danh mục điểm trạm hệ thống</span>
            </div>

            <!-- Hiển thị các địa điểm đã chọn dạng thẻ đơn giản -->
            <div v-if="locations.length > 0" class="selected-locations-wrap mb-2">
              <span
                v-for="(loc, index) in locations"
                :key="index"
                class="location-chip"
              >
                <MapPin :size="13" class="text-primary flex-shrink-0" />
                <span class="location-name">{{ loc }}</span>
                <button
                  type="button"
                  class="btn-remove-loc"
                  @click="removeLocation(index)"
                  title="Bỏ địa điểm này"
                >
                  <X :size="13" />
                </button>
              </span>
            </div>
            <div v-else class="empty-locations-hint mb-2">
              <span>Chưa chọn địa điểm nào. Vui lòng chọn địa điểm từ danh mục bên dưới.</span>
            </div>

            <!-- Dropdown chọn thêm điểm trạm từ danh mục -->
            <div class="hub-select-wrapper">
              <select
                v-model="selectedHubToAdd"
                class="form-select hub-dropdown"
                @change="onSelectHubToAdd"
              >
                <option value="" disabled>-- Chọn địa điểm từ danh mục hệ thống --</option>
                <option
                  v-for="hub in systemHubs"
                  :key="'opt-' + hub.id"
                  :value="hub.name"
                  :disabled="locations.includes(hub.name)"
                >
                  [{{ getHubTypePrefix(hub.type) }}] {{ hub.name }} - {{ hub.address }}
                </option>
              </select>
            </div>
          </div>
        </div>

        <!-- Khung giờ & Rule kiểm tra -->
        <div class="quick-slots-container">
          <span class="quick-slots-label">Chọn nhanh khung giờ hợp lệ:</span>
          <div class="quick-slots-btns">
            <button type="button" class="btn-quick-slot" @click="setQuickSlot('today_next')">
              ⚡ Gợi ý hôm nay (Tránh trùng lịch)
            </button>
            <button type="button" class="btn-quick-slot" @click="setQuickSlot('tomorrow_morning')">
              🌅 Ca sáng mai (08:00 - 10:30)
            </button>
            <button type="button" class="btn-quick-slot" @click="setQuickSlot('tomorrow_afternoon')">
              ☀️ Ca chiều mai (13:30 - 16:00)
            </button>
          </div>
        </div>

        <div class="grid-2">
          <div class="form-group">
            <label class="form-label">Thời gian bắt đầu <span class="required">*</span></label>
            <input v-model="startTime" type="datetime-local" class="form-input" />
            <!-- Chỉ báo Rule 30 phút -->
            <div class="rule-feedback" :class="rule30Status.valid ? 'text-success' : 'text-danger'">
              <CheckCircle2 v-if="rule30Status.valid" :size="13" />
              <AlertCircle v-else :size="13" />
              <span>{{ rule30Status.text }}</span>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Thời gian dự kiến kết thúc <span class="required">*</span></label>
            <input v-model="endTime" type="datetime-local" class="form-input" />
          </div>
        </div>

        <!-- Cảnh báo chống trùng lịch 45 phút -->
        <div v-if="conflictStatus.hasConflict" class="alert alert-warning">
          <AlertCircle :size="16" />
          <span>{{ conflictStatus.message }}</span>
        </div>

        <!-- Tùy biến theo loại xe: Xe chuyên dùng chở mủ -->
        <div v-if="vehicleType === 'LatexTruck'" class="form-group vehicle-detail-box">
          <label class="form-label">Khối lượng mủ dự kiến (kg) <span class="required">*</span></label>
          <input v-model.number="estimatedWeightKg" type="number" step="100" min="100" class="form-input" />
          <div class="quick-chips-row">
            <span class="quick-chip-label">Chọn nhanh:</span>
            <button type="button" class="btn-micro-chip" @click="estimatedWeightKg = 1500">+ 1.500 kg (Mủ chén)</button>
            <button type="button" class="btn-micro-chip" @click="estimatedWeightKg = 2500">+ 2.500 kg (Xe 5 tấn)</button>
            <button type="button" class="btn-micro-chip" @click="estimatedWeightKg = 5000">+ 5.000 kg (Đầy thùng)</button>
            <button type="button" class="btn-micro-chip" @click="estimatedWeightKg = 7500">+ 7.500 kg (Xe bồn)</button>
          </div>
          <span class="form-hint">Khối lượng mủ dùng để kiểm tra sức chứa khi điều phối ghép chuyến và tính định mức dầu (Lít/tấn.km).</span>
        </div>

        <!-- Tùy biến theo loại xe: Xe cơ giới nông trường -->
        <div v-else-if="vehicleType === 'MillingMachine'" class="form-group vehicle-detail-box">
          <div class="grid-2">
            <div>
              <label class="form-label">Số giờ máy dự kiến (giờ) <span class="required">*</span></label>
              <input v-model.number="operatingHours" type="number" step="0.5" min="0.5" max="24" class="form-input" />
            </div>
            <div>
              <label class="form-label">Định mức tiêu hao dầu cơ giới</label>
              <input type="text" class="form-input bg-light font-medium" value="14.5 Lít / Giờ máy chạy" disabled />
            </div>
          </div>
          <div class="quick-chips-row">
            <span class="quick-chip-label">Chọn nhanh ca máy:</span>
            <button type="button" class="btn-micro-chip" @click="operatingHours = 2">2 Giờ (Khẩn cấp)</button>
            <button type="button" class="btn-micro-chip" @click="operatingHours = 4">4 Giờ (Nửa ca)</button>
            <button type="button" class="btn-micro-chip" @click="operatingHours = 8">8 Giờ (Nguyên ca ngày)</button>
          </div>
          <span class="form-hint">Số giờ máy dùng để bố trí thợ máy vận hành và nghiệm thu ca đào mương / san ủi vườn cây.</span>
        </div>

        <!-- Tùy biến theo loại xe: Xe bán tải công tác -->
        <div v-else-if="vehicleType === 'PassengerCar'" class="passenger-car-fields">
          <div class="grid-2">
            <div class="form-group">
              <label class="form-label">Giờ đón (Pick-up) <span class="required">*</span></label>
              <input v-model="pickupTime" type="datetime-local" class="form-input" />
            </div>
            <div class="form-group">
              <label class="form-label">Giờ trả (Drop-off) <span class="required">*</span></label>
              <input v-model="dropoffTime" type="datetime-local" class="form-input" />
            </div>
          </div>
          
          <div class="grid-2">
            <div class="form-group">
              <label class="form-label">Người liên hệ <span class="required">*</span></label>
              <input v-model="contactPerson" type="text" class="form-input" placeholder="Tên người điều phối đoàn / liên hệ" />
            </div>
            <div class="form-group">
              <label class="form-label">SĐT liên hệ <span class="required">*</span></label>
              <input v-model="contactPhone" type="text" class="form-input" placeholder="09xxxxxxx" />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Số người tham gia công tác <span class="required">*</span></label>
            <input v-model.number="passengersCount" type="number" min="1" class="form-input" />
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Mục đích chuyến đi / Công việc <span class="required">*</span></label>
          <textarea v-model="purpose" rows="2" class="form-textarea" placeholder="Mô tả cụ thể mục đích sử dụng xe..."></textarea>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn btn-secondary" @click="emit('close')">Hủy bỏ</button>
        <button
          class="btn btn-primary"
          :disabled="!rule30Status.valid || conflictStatus.hasConflict"
          @click="handleSubmit"
        >
          Gửi Yêu Cầu Đặt Xe
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.btn-close {
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--text-muted);
}
.btn-close:hover {
  color: var(--text-primary);
}
.info-banner {
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  color: #166534;
  padding: 10px 14px;
  border-radius: var(--radius-sm);
  font-size: 0.8125rem;
  margin-bottom: 16px;
}
.alert {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border-radius: var(--radius-sm);
  font-size: 0.8125rem;
  font-weight: 500;
  margin-bottom: 16px;
}
.alert-danger {
  background: #fee2e2;
  border: 1px solid #fecaca;
  color: #b91c1c;
}
.alert-warning {
  background: #fef3c7;
  border: 1px solid #fde68a;
  color: #b45309;
}
.rule-feedback {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 0.75rem;
  font-weight: 600;
  margin-top: 4px;
}
.text-success { color: #16a34a; }
.text-danger { color: #dc2626; }

.quick-slots-container {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 12px;
  background: #f8fafc;
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  border: 1px dashed #cbd5e1;
}
.quick-slots-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-secondary);
}
.quick-slots-btns {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.btn-quick-slot {
  background: #ffffff;
  border: 1px solid #15803d;
  color: #15803d;
  padding: 4px 10px;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}
.btn-quick-slot:hover {
  background: #15803d;
  color: #ffffff;
  box-shadow: 0 2px 4px rgba(21, 128, 61, 0.2);
}
.modal-lg {
  max-width: 860px !important;
  width: 95vw;
}

/* Factory Hubs Selector */
.factory-hubs-container {
  background: #f8fafc;
  border: 1px solid #cbd5e1;
  border-radius: var(--radius-md, 8px);
  padding: 14px 16px;
  margin-bottom: 16px;
}
.factory-hubs-title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}
.selected-locations-wrap {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  background: #ffffff;
  border: 1.5px solid #cbd5e1;
  border-radius: 7px;
  min-height: 44px;
}
.location-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #f0f9ff;
  border: 1px solid #bae6fd;
  color: #0369a1;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 0.8125rem;
  font-weight: 600;
  transition: all 0.15s ease;
}
.location-chip .location-name {
  color: #0f172a;
}
.btn-remove-loc {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: #64748b;
  cursor: pointer;
  padding: 2px;
  border-radius: 3px;
  transition: all 0.12s ease;
}
.btn-remove-loc:hover {
  background: #fee2e2;
  color: #dc2626;
}
.empty-locations-hint {
  padding: 8px 12px;
  background: #ffffff;
  border: 1px dashed #cbd5e1;
  border-radius: 6px;
  font-size: 0.78125rem;
  color: #64748b;
  text-align: center;
}
.hub-dropdown {
  background: #ffffff;
  border: 1px solid #cbd5e1;
  font-size: 0.8125rem;
  font-weight: 500;
}

/* Module Mode Badge & Scope Card Styles */
.module-mode-badge {
  display: inline-flex;
  align-items: center;
  font-size: 0.75rem;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 9999px;
  margin-left: 10px;
}
.badge-team {
  background: #ecfdf5;
  color: #065f46;
  border: 1px solid #a7f3d0;
}
.badge-factory {
  background: #eff6ff;
  color: #1e40af;
  border: 1px solid #bfdbfe;
}

.module-scope-card {
  border-radius: var(--radius-md, 8px);
  padding: 12px 16px;
  margin-bottom: 16px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
}
.module-scope-card.team-mode {
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
}
.module-scope-card.factory-mode {
  background: #f8fafc;
  border: 1px solid #cbd5e1;
}

.scope-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.scope-unit-info {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.84rem;
  color: #1e293b;
}

.team-dropdown-inline {
  display: flex;
  align-items: center;
  gap: 8px;
}
.team-sub-label {
  font-size: 0.8125rem;
  font-weight: 600;
  color: #334155;
  white-space: nowrap;
}
.team-select-input {
  min-width: 140px;
  font-weight: 600;
  border-color: #86efac;
}

.scope-policy-callout {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed rgba(0, 0, 0, 0.08);
  font-size: 0.78125rem;
  line-height: 1.45;
}
.team-mode .scope-policy-callout {
  color: #166534;
}
.factory-mode .scope-policy-callout {
  color: #1e3a8a;
}
.scope-policy-callout .callout-icon {
  flex-shrink: 0;
  margin-top: 2px;
}

.form-label-with-hint {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}
.hint-pill {
  font-size: 0.71875rem;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 9999px;
  border: 1px solid transparent;
}
.hint-pill.pill-team {
  color: #047857;
  background: #d1fae5;
  border-color: #a7f3d0;
}
.hint-pill.pill-factory {
  color: #1d4ed8;
  background: #dbeafe;
  border-color: #bfdbfe;
}
.vehicle-select-highlight {
  font-weight: 600;
  color: #0f172a;
}
.vehicle-detail-box {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: var(--radius-sm, 6px);
  padding: 12px;
  margin-bottom: 14px;
}
.quick-chips-row,
.quick-purpose-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
}
.quick-chip-label {
  font-size: 0.71875rem;
  font-weight: 600;
  color: #64748b;
  margin-right: 2px;
}
.btn-micro-chip {
  background: #ffffff;
  border: 1px solid #cbd5e1;
  color: #334155;
  padding: 3px 8px;
  border-radius: 9999px;
  font-size: 0.71875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.12s ease;
}
.btn-micro-chip:hover {
  background: #e2e8f0;
  color: #0f172a;
  border-color: #94a3b8;
}

/* Team Pickup Card (Cụm thu gom & Điểm đến Nhà máy) */
.team-pickup-card {
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: var(--radius-md, 8px);
  padding: 14px 16px;
  margin-bottom: 16px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
}
.team-pickup-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 12px;
}
@media (max-width: 640px) {
  .team-pickup-grid {
    grid-template-columns: 1fr;
  }
}

.cluster-segmented-group {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-top: 4px;
}
.cluster-seg-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 8px 6px;
  background: #ffffff;
  border: 1.5px solid #cbd5e1;
  border-radius: 7px;
  cursor: pointer;
  transition: all 0.15s ease;
  text-align: center;
}
.cluster-seg-btn:hover {
  border-color: #10b981;
  background: #f7fee7;
}
.cluster-seg-btn.active {
  background: #ffffff;
  border-color: #059669;
  box-shadow: 0 0 0 2px rgba(5, 150, 105, 0.2);
}
.cluster-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #94a3b8;
  margin-bottom: 4px;
}
.cluster-seg-btn.active .cluster-dot {
  background: #059669;
}
.cluster-name {
  font-size: 0.8125rem;
  font-weight: 700;
  color: #1e293b;
}
.cluster-seg-btn.active .cluster-name {
  color: #065f46;
}
.cluster-sub {
  font-size: 0.6875rem;
  color: #64748b;
  margin-top: 1px;
}

.fixed-dest-box {
  background: #ffffff;
  border: 1px solid #cbd5e1;
  border-radius: 7px;
  padding: 8px 12px;
  margin-top: 4px;
  min-height: 62px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.dest-main {
  display: flex;
  align-items: center;
  gap: 6px;
}
.dest-icon {
  font-size: 1rem;
}
.dest-title {
  font-size: 0.8125rem;
  font-weight: 700;
  color: #0f172a;
}
.dest-desc {
  font-size: 0.6875rem;
  color: #64748b;
  margin-top: 3px;
  line-height: 1.35;
}

.team-route-badge {
  display: flex;
  align-items: center;
  gap: 10px;
  background: #ffffff;
  border: 1px dashed #86efac;
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 0.78125rem;
}
.badge-label {
  font-weight: 600;
  color: #475569;
}
.badge-flow {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
}
.flow-point.from {
  color: #047857;
}
.flow-point.to {
  color: #1d4ed8;
}
.flow-arrow {
  color: #94a3b8;
}
</style>
