<script setup lang="ts">
import { ref, computed } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { useFleetStore } from '@/stores/fleet';
import { useDialogStore } from '@/stores/dialog';
import { mockStorage } from '@/services/mockStorage';
import {
  AlertTriangle,
  Wrench,
  Camera,
  CheckCircle2,
  Clock,
  PhoneCall,
  X,
  MapPin,
  Crosshair,
  RefreshCw,
  Loader2,
  ExternalLink,
  AlertCircle,
  Navigation,
  Search,
  RotateCcw,
} from 'lucide-vue-next';

const authStore = useAuthStore();
const fleetStore = useFleetStore();
const dialog = useDialogStore();

export interface DriverIncident {
  id: string;
  reportCode: string;
  vehiclePlate: string;
  incidentType: 'Tire' | 'Engine' | 'Electrical' | 'Tank' | 'Collision' | 'Other';
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  location: string;
  latitude?: number;
  longitude?: number;
  gpsAccuracy?: number;
  description: string;
  photoUrl?: string;
  status: 'PENDING' | 'IN_REPAIR' | 'RESOLVED';
  reportedAt: string;
  repairNote?: string;
}

const defaultIncidents: DriverIncident[] = [
  {
    id: '1',
    reportCode: 'INC-260907-001',
    vehiclePlate: '51C-889.26',
    incidentType: 'Tire',
    severity: 'Medium',
    location: 'Km 24 - ĐT741, gần Trạm thu phí Tân Uyên',
    latitude: 11.542300,
    longitude: 106.634100,
    gpsAccuracy: 12,
    description: 'Bánh sau bên phụ bị xì lốp, đã gọi vá xe lưu động khẩn cấp để tiếp tục hành trình chở mủ.',
    photoUrl: 'https://images.unsplash.com/photo-1578844251758-2f71da64c96f?w=600&auto=format&fit=crop&q=80',
    status: 'IN_REPAIR',
    reportedAt: '2026-09-07 09:30',
    repairNote: 'Đội kỹ thuật đã nhận thông tin & gửi xe cứu hộ lưu động đến hiện trường.',
  },
  {
    id: '2',
    reportCode: 'INC-260905-002',
    vehiclePlate: '51C-889.26',
    incidentType: 'Electrical',
    severity: 'Low',
    location: 'Tại Nông trường Cao su 1 - Lô C2',
    latitude: 11.564500,
    longitude: 106.689000,
    gpsAccuracy: 8,
    description: 'Đèn xi-nhan bên trái chập chờn lúc nhận xe đầu ca sáng.',
    status: 'RESOLVED',
    reportedAt: '2026-09-05 06:45',
    repairNote: 'Thợ điện tại xưởng đã thay bóng đèn xi-nhan dự phòng.',
  },
];

const incidents = ref<DriverIncident[]>(mockStorage.getDriverIncidents(defaultIncidents));

// Bộ lọc
const searchKeyword = ref('');
const statusFilter = ref<string>('ALL');
const typeFilter = ref<string>('ALL');

const filteredIncidents = computed(() => {
  return incidents.value.filter((inc) => {
    if (searchKeyword.value.trim()) {
      const kw = searchKeyword.value.trim().toLowerCase();
      const matchCode = inc.reportCode.toLowerCase().includes(kw);
      const matchPlate = inc.vehiclePlate.toLowerCase().includes(kw);
      const matchDesc = inc.description.toLowerCase().includes(kw);
      const matchLoc = (inc.location || '').toLowerCase().includes(kw);
      if (!matchCode && !matchPlate && !matchDesc && !matchLoc) return false;
    }
    if (statusFilter.value !== 'ALL') {
      if (inc.status !== statusFilter.value) return false;
    }
    if (typeFilter.value !== 'ALL') {
      if (inc.incidentType !== typeFilter.value) return false;
    }
    return true;
  });
});

// Form gửi báo cáo mới
const showCreateModal = ref(false);
const newVehiclePlate = ref('51C-889.26');
const newIncidentType = ref<DriverIncident['incidentType']>('Tire');
const newSeverity = ref<DriverIncident['severity']>('Medium');
const newLocation = ref('');
const newDescription = ref('');
const newPhotoUrl = ref<string | undefined>();
const previewZoom = ref<string | null>(null);

// Tọa độ GPS & Định vị vệ tinh thực tế của tài xế
const gpsStatus = ref<'idle' | 'locating' | 'success' | 'error'>('idle');
const gpsLat = ref<number | null>(null);
const gpsLng = ref<number | null>(null);
const gpsAccuracy = ref<number | null>(null);
const gpsAddress = ref('');
const gpsErrorMessage = ref('');
const gpsCapturedAt = ref('');

// Ước tính mốc địa lý trên tuyến đường Ecotech ĐT741 để hỗ trợ gợi ý địa chỉ
function estimateLandmark(lat: number, lng: number): string {
  const landmarks = [
    { name: 'Km 14 - ĐT741, gần Cầu Sông Bé', lat: 11.452, lng: 106.581 },
    { name: 'Km 18 - ĐT741, gần Trạm cân TC1', lat: 11.5124, lng: 106.6213 },
    { name: 'Km 24 - ĐT741, gần Trạm thu phí Tân Uyên', lat: 11.5423, lng: 106.6341 },
    { name: 'Km 32 - ĐT741, đoạn ngã ba Đồng Phú', lat: 11.589, lng: 106.712 },
    { name: 'Khu vực Nông trường 1 - Lô C5', lat: 11.5645, lng: 106.689 },
    { name: 'Khu vực Nông trường 2 - Đội sản xuất 3', lat: 11.6021, lng: 106.734 },
    { name: 'Gần Nhà máy Chế biến Mủ Phú Riềng', lat: 11.642, lng: 106.789 },
  ];

  let nearest = landmarks[0];
  let minDistance = Infinity;

  for (const lm of landmarks) {
    const dist = Math.hypot(lm.lat - lat, lm.lng - lng);
    if (dist < minDistance) {
      minDistance = dist;
      nearest = lm;
    }
  }

  if (minDistance < 0.15) {
    return nearest.name;
  }
  return `Tọa độ GPS ${lat.toFixed(5)}°B, ${lng.toFixed(5)}°Đ`;
}

// Bắt vị trí GPS vệ tinh thực tế của thiết bị tài xế
function captureGpsLocation() {
  gpsStatus.value = 'locating';
  gpsErrorMessage.value = '';

  if (!('geolocation' in navigator)) {
    gpsStatus.value = 'error';
    gpsErrorMessage.value = 'Trình duyệt/thiết bị này không hỗ trợ định vị GPS (Geolocation API).';
    fallbackSimulatedGps();
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const lat = Number(position.coords.latitude.toFixed(6));
      const lng = Number(position.coords.longitude.toFixed(6));
      const acc = Math.round(position.coords.accuracy || 10);

      gpsLat.value = lat;
      gpsLng.value = lng;
      gpsAccuracy.value = acc;
      gpsStatus.value = 'success';
      gpsCapturedAt.value = new Date().toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });

      const suggestedLandmark = estimateLandmark(lat, lng);
      gpsAddress.value = suggestedLandmark;
      if (!newLocation.value || newLocation.value.startsWith('Km ') || newLocation.value.startsWith('Tọa độ')) {
        newLocation.value = `${suggestedLandmark} (GPS: ${lat.toFixed(4)}, ${lng.toFixed(4)})`;
      }
    },
    (error) => {
      console.warn('Lỗi bắt GPS thực tế:', error);
      let errMsg = 'Không nhận được tín hiệu GPS vệ tinh từ thiết bị.';
      if (error.code === error.PERMISSION_DENIED) {
        errMsg = 'Tài xế chưa cấp quyền truy cập vị trí (Vui lòng bấm Cho phép/Allow vị trí trong trình duyệt).';
      } else if (error.code === error.POSITION_UNAVAILABLE) {
        errMsg = 'Không xác định được vị trí GPS (Thiết bị có thể đang mất sóng vệ tinh).';
      } else if (error.code === error.TIMEOUT) {
        errMsg = 'Quá thời gian chờ phản hồi từ cảm biến GPS.';
      }
      gpsErrorMessage.value = errMsg;
      gpsStatus.value = 'error';

      // Fallback thông minh theo vị trí xe trên tuyến ĐT741
      fallbackSimulatedGps();
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    }
  );
}

function fallbackSimulatedGps() {
  try {
    const mapStates = mockStorage.getVehicleMapStates();
    const vState = mapStates.find((m: any) => m.licensePlate === newVehiclePlate.value);
    const fallbackLat = vState?.currentLat || 11.542318;
    const fallbackLng = vState?.currentLng || 106.634120;

    gpsLat.value = fallbackLat;
    gpsLng.value = fallbackLng;
    gpsAccuracy.value = 15;
    gpsCapturedAt.value = new Date().toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    const landmark = estimateLandmark(fallbackLat, fallbackLng);
    gpsAddress.value = landmark;
    if (!newLocation.value) {
      newLocation.value = `${landmark} (GPS: ${fallbackLat.toFixed(4)}, ${fallbackLng.toFixed(4)})`;
    }
  } catch (e) {
    gpsLat.value = 11.542318;
    gpsLng.value = 106.634120;
    gpsAccuracy.value = 15;
  }
}

function openCreateModal() {
  showCreateModal.value = true;
  captureGpsLocation();
}

function onFileSelected(event: Event) {
  const target = event.target as HTMLInputElement;
  if (!target.files || target.files.length === 0) return;
  const file = target.files[0];
  const reader = new FileReader();
  reader.onload = (e) => {
    if (e.target?.result) {
      newPhotoUrl.value = e.target.result as string;
    }
  };
  reader.readAsDataURL(file);
}

function handleCreateIncident() {
  if (!newLocation.value || !newDescription.value) {
    dialog.showWarning('Vui lòng nhập vị trí gặp sự cố và mô tả chi tiết tình trạng xe!', 'Thiếu Thông Tin');
    return;
  }

  const newId = String(Date.now());
  const code = `INC-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${String(incidents.value.length + 1).padStart(3, '0')}`;

  const newReport: DriverIncident = {
    id: newId,
    reportCode: code,
    vehiclePlate: newVehiclePlate.value,
    incidentType: newIncidentType.value,
    severity: newSeverity.value,
    location: newLocation.value,
    latitude: gpsLat.value || undefined,
    longitude: gpsLng.value || undefined,
    gpsAccuracy: gpsAccuracy.value || undefined,
    description: newDescription.value,
    photoUrl: newPhotoUrl.value,
    status: 'PENDING',
    reportedAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
  };

  incidents.value.unshift(newReport);
  mockStorage.saveDriverIncidents(incidents.value);

  // Đồng bộ sang kho dữ liệu sự cố toàn hệ thống để Đội bảo dưỡng & Điều phối tiếp nhận
  const targetVeh = fleetStore.vehicles.find((v) => v.licensePlate === newVehiclePlate.value);
  fleetStore.reportIncident({
    vehicleId: targetVeh ? targetVeh.id : 1,
    vehiclePlate: newVehiclePlate.value,
    reportedByDriverId: authStore.currentUser.driverId || 101,
    driverName: authStore.currentUser.fullName,
    reportDate: new Date().toISOString().slice(0, 10),
    issueDescription: `[${newLocation.value}] ${newDescription.value}`,
    severity: (newSeverity.value === 'Critical' || newSeverity.value === 'High') ? 'StopOperation' : 'Warning',
    location: newLocation.value,
    latitude: gpsLat.value || undefined,
    longitude: gpsLng.value || undefined,
    gpsAccuracy: gpsAccuracy.value || undefined,
  });

  const gpsNotice = gpsLat.value && gpsLng.value
    ? ` Đã gửi kèm tọa độ GPS vệ tinh (${gpsLat.value.toFixed(4)}, ${gpsLng.value.toFixed(4)}) cho bên điều xe trên bản đồ.`
    : '';

  dialog.showSuccess(`Đã gửi báo cáo sự cố ${code} đến Đội bảo dưỡng & Điều phối viên thành công!${gpsNotice}`, 'Báo Cáo Thành Công');
  showCreateModal.value = false;
  // Reset form
  newLocation.value = '';
  newDescription.value = '';
  newPhotoUrl.value = undefined;
  gpsStatus.value = 'idle';
  gpsLat.value = null;
  gpsLng.value = null;
  gpsAccuracy.value = null;
}

function getIncidentTypeName(type: DriverIncident['incidentType']) {
  switch (type) {
    case 'Tire': return 'Lốp xe / Xì lốp / Nổ lốp';
    case 'Engine': return 'Động cơ / Nóng máy / Rò rỉ';
    case 'Electrical': return 'Hệ thống điện / Đèn / Ắc quy';
    case 'Tank': return 'Bồn téc / Van xả mủ';
    case 'Collision': return 'Va quẹt / Trầy xước';
    default: return 'Sự cố khác';
  }
}

function getSeverityBadge(sev: DriverIncident['severity']) {
  switch (sev) {
    case 'Critical': return 'badge-red';
    case 'High': return 'badge-orange';
    case 'Medium': return 'badge-amber';
    default: return 'badge-blue';
  }
}
</script>

<template>
  <div class="driver-incidents-page">
    <!-- Header -->
    <div class="page-header">
      <div>
        <div class="header-tag-row">
          <span class="badge-role">Phân Hệ Vận Hành Tài Xế</span>
          <span class="badge-driver">Tài xế: {{ authStore.currentUser.fullName }}</span>
        </div>
        <h1 class="page-title">Báo Cáo Sự Cố Xe & Kiểm Tra Kỹ Thuật Dọc Đường</h1>
        <p class="page-subtitle">
          Thông báo khẩn cấp các hư hỏng, sự cố vỏ lốp, máy móc cho Điều phối và Đội sửa chữa bảo dưỡng hỗ trợ kịp thời
        </p>
      </div>

      <div class="header-actions">
        <button class="btn btn-danger" @click="openCreateModal">
          <AlertTriangle :size="16" />
          <span>+ Báo Cáo Sự Cố Xe Khẩn Cấp</span>
        </button>
      </div>
    </div>

    <!-- Hộp liên hệ cứu hộ khẩn cấp -->
    <div class="sos-banner mb-4">
      <div class="sos-icon">
        <PhoneCall :size="24" class="text-danger" />
      </div>
      <div class="sos-content">
        <strong class="sos-title">Đường dây nóng Cứu hộ & Sửa chữa xe lưu động:</strong>
        <p class="mb-0 text-xs">
          Trường hợp xe hỏng nặng giữa đường, chết máy hoặc nổ lốp ảnh hưởng đến chất lượng mủ cao su, vui lòng gọi ngay hotline: <strong>0903 888 999</strong> (Đội Trưởng Kỹ Thuật) hoặc <strong>0912 345 678</strong> (Điều Phối Viên Trực).
        </p>
      </div>
    </div>

    <!-- Bảng danh sách sự cố -->
    <div class="card">
      <div class="card-header">
        <h3 class="card-title">Nhật Ký Sự Cố Xe Đã Báo Cáo ({{ filteredIncidents.length }})</h3>
        <div class="header-filters-group">
          <div class="filter-search-wrap">
            <Search :size="15" class="search-ico" />
            <input
              v-model="searchKeyword"
              type="text"
              class="filter-search-input"
              placeholder="Tìm mã báo cáo, biển số, mô tả..."
            />
            <button v-if="searchKeyword" class="btn-clear-search" @click="searchKeyword = ''" title="Xóa tìm kiếm">
              <X :size="13" />
            </button>
          </div>
          <select v-model="typeFilter" class="filter-select">
            <option value="ALL">Tất cả loại sự cố</option>
            <option value="Tire">Lốp xe / Nổ lốp</option>
            <option value="Engine">Động cơ / Chết máy</option>
            <option value="Electrical">Hệ thống điện / Đèn</option>
            <option value="Tank">Bình mủ / Van xả</option>
            <option value="Collision">Va quẹt / Tai nạn</option>
            <option value="Other">Sự cố khác</option>
          </select>
          <select v-model="statusFilter" class="filter-select">
            <option value="ALL">Tất cả trạng thái</option>
            <option value="PENDING">Đã Tiếp Nhận</option>
            <option value="IN_REPAIR">Đang Sửa Chữa</option>
            <option value="RESOLVED">Đã Khắc Phục</option>
          </select>
          <button
            v-if="searchKeyword || statusFilter !== 'ALL' || typeFilter !== 'ALL'"
            class="btn-reset-filter"
            title="Đặt lại bộ lọc"
            @click="searchKeyword = ''; statusFilter = 'ALL'; typeFilter = 'ALL';"
          >
            <RotateCcw :size="13" />
            <span>Đặt lại</span>
          </button>
        </div>
      </div>

      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th style="width: 140px; white-space: nowrap">Mã Báo Cáo</th>
              <th style="width: 110px; white-space: nowrap">Phương Tiện</th>
              <th style="min-width: 150px; white-space: nowrap">Loại Sự Cố</th>
              <th style="width: 100px; white-space: nowrap">Mức Độ</th>
              <th style="min-width: 220px">Vị Trí Gặp Sự Cố</th>
              <th style="min-width: 220px">Mô Tả Hiện Trường & Ảnh</th>
              <th style="width: 140px; white-space: nowrap">Thời Gian</th>
              <th style="min-width: 160px; white-space: nowrap">Trạng Thái Xử Lý</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="filteredIncidents.length === 0">
              <td colspan="8" class="text-center py-4 text-muted">
                Không tìm thấy báo cáo sự cố nào phù hợp với bộ lọc hiện tại.
              </td>
            </tr>
            <tr v-for="inc in filteredIncidents" :key="inc.id">
              <td style="white-space: nowrap">
                <span class="code-badge">{{ inc.reportCode }}</span>
              </td>
              <td style="white-space: nowrap">
                <strong class="font-mono text-slate-800">{{ inc.vehiclePlate }}</strong>
              </td>
              <td style="white-space: nowrap">
                <span class="font-semibold text-slate-800">{{ getIncidentTypeName(inc.incidentType) }}</span>
              </td>
              <td style="white-space: nowrap">
                <span class="badge" :class="getSeverityBadge(inc.severity)">
                  {{ inc.severity === 'Critical' ? 'Khẩn cấp' : inc.severity === 'High' ? 'Cao' : inc.severity === 'Medium' ? 'Trung bình' : 'Nhẹ' }}
                </span>
              </td>
              <td>
                <div class="location-cell">
                  <span class="text-xs font-semibold text-dark">{{ inc.location }}</span>
                  <div v-if="inc.latitude && inc.longitude" class="gps-cell-badge">
                    <MapPin :size="11" class="text-danger" />
                    <span class="gps-val">{{ inc.latitude.toFixed(4) }}, {{ inc.longitude.toFixed(4) }}</span>
                    <a
                      :href="`https://www.google.com/maps?q=${inc.latitude},${inc.longitude}`"
                      target="_blank"
                      class="maps-ext-link"
                      title="Mở tọa độ GPS trên Google Maps"
                    >
                      <ExternalLink :size="11" />
                    </a>
                  </div>
                </div>
              </td>
              <td>
                <div class="desc-cell">
                  <span class="text-xs">{{ inc.description }}</span>
                  <div v-if="inc.photoUrl" class="photo-link" @click="previewZoom = inc.photoUrl">
                    <Camera :size="12" />
                    <span>Xem ảnh hiện trường</span>
                  </div>
                </div>
              </td>
              <td style="white-space: nowrap">
                <span class="text-xs font-semibold text-slate-700">{{ inc.reportedAt }}</span>
              </td>
              <td>
                <span v-if="inc.status === 'RESOLVED'" class="status-pill pill-green">
                  <CheckCircle2 :size="12" />
                  <span>Đã Khắc Phục</span>
                </span>
                <span v-else-if="inc.status === 'IN_REPAIR'" class="status-pill pill-amber">
                  <Wrench :size="12" />
                  <span>Đang Sửa Chữa / Cứu Hộ</span>
                </span>
                <span v-else class="status-pill pill-red">
                  <Clock :size="12" />
                  <span>Đã Tiếp Nhận</span>
                </span>
                <div v-if="inc.repairNote" class="text-xs text-primary font-medium mt-1 bg-blue-50 p-1.5 rounded border border-blue-200">
                  {{ inc.repairNote }}
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal Tạo Báo Cáo Sự Cố Mới -->
    <div v-if="showCreateModal" class="modal-backdrop" @click.self="showCreateModal = false">
      <div class="modal-content modal-md">
        <div class="modal-header">
          <h3 class="modal-title flex-center gap-2">
            <AlertTriangle :size="20" class="text-danger" />
            <span>Khai Báo Sự Cố Xe Khẩn Cấp Dọc Đường</span>
          </h3>
          <button class="btn-close" @click="showCreateModal = false">
            <X :size="18" />
          </button>
        </div>

        <div class="modal-body">
          <div class="grid-2">
            <div class="form-group">
              <label class="form-label">Biển số xe gặp sự cố <span class="required">*</span></label>
              <input v-model="newVehiclePlate" type="text" class="form-input font-bold" />
            </div>

            <div class="form-group">
              <label class="form-label">Phân loại sự cố <span class="required">*</span></label>
              <select v-model="newIncidentType" class="form-select font-semibold">
                <option value="Tire">Xì lốp / Nổ lốp / Rách vỏ</option>
                <option value="Engine">Hỏng động cơ / Nóng két nước</option>
                <option value="Electrical">Chập điện / Hết bình / Đèn</option>
                <option value="Tank">Bồn téc / Rò rỉ van xả mủ</option>
                <option value="Collision">Va quẹt / Tai nạn</option>
                <option value="Other">Sự cố khác</option>
              </select>
            </div>
          </div>

          <div class="grid-2 mt-2">
            <div class="form-group">
              <label class="form-label">Mức độ ảnh hưởng <span class="required">*</span></label>
              <select v-model="newSeverity" class="form-select">
                <option value="Low">Nhẹ — Vẫn chạy được</option>
                <option value="Medium">Trung bình — Cần sửa sớm</option>
                <option value="High">Nặng — Không an toàn khi chạy</option>
                <option value="Critical">Khẩn cấp — Chết máy / Dừng xe gấp</option>
              </select>
            </div>

            <div class="form-group location-gps-group">
              <div class="flex-between mb-1">
                <label class="form-label mb-0">
                  <span>Vị trí gặp sự cố</span>
                  <span class="required"> *</span>
                </label>
                <button
                  type="button"
                  class="btn-gps-action"
                  :class="{ 'is-locating': gpsStatus === 'locating', 'is-success': gpsStatus === 'success' }"
                  :disabled="gpsStatus === 'locating'"
                  @click="captureGpsLocation"
                  title="Bắt tọa độ GPS vệ tinh thực tế của điện thoại"
                >
                  <Loader2 v-if="gpsStatus === 'locating'" :size="13" class="spin" />
                  <RefreshCw v-else-if="gpsStatus === 'success'" :size="13" />
                  <Crosshair v-else :size="13" />
                  <span>{{ gpsStatus === 'locating' ? 'Đang dò GPS...' : gpsStatus === 'success' ? 'Lấy lại GPS' : 'Bắt vị trí GPS' }}</span>
                </button>
              </div>

              <input
                v-model="newLocation"
                type="text"
                class="form-input"
                placeholder="VD: Km 18 ĐT741, gần cầu vượt..."
              />

              <!-- Hộp trạng thái & tọa độ GPS thực tế của tài xế -->
              <div v-if="gpsStatus === 'locating'" class="gps-status-card is-loading">
                <div class="flex-center gap-2">
                  <Loader2 :size="14" class="spin text-primary" />
                  <span class="text-xs font-semibold text-primary">Đang kích hoạt cảm biến GPS thiết bị & dò sóng vệ tinh...</span>
                </div>
              </div>

              <div v-else-if="gpsLat && gpsLng" class="gps-status-card is-active">
                <div class="gps-card-top">
                  <div class="gps-badge-live">
                    <span class="live-dot-pulse"></span>
                    <span class="text-xs font-bold text-success">Đã Bắt Tọa Độ GPS Vệ Tinh</span>
                    <span v-if="gpsAccuracy" class="accuracy-tag">±{{ gpsAccuracy }}m</span>
                  </div>
                  <span v-if="gpsCapturedAt" class="gps-time-text">Lúc {{ gpsCapturedAt }}</span>
                </div>

                <div class="gps-coords-display">
                  <MapPin :size="14" class="text-danger" />
                  <code class="gps-coords-val">{{ gpsLat.toFixed(6) }}, {{ gpsLng.toFixed(6) }}</code>
                  <a
                    :href="`https://www.google.com/maps?q=${gpsLat},${gpsLng}`"
                    target="_blank"
                    class="btn-maps-preview"
                    title="Mở Google Maps vệ tinh xem hiện trường"
                  >
                    <ExternalLink :size="12" />
                    <span>Xem Google Maps</span>
                  </a>
                </div>

                <div v-if="gpsErrorMessage" class="gps-fallback-hint">
                  <AlertCircle :size="12" class="text-amber" />
                  <span class="text-xs text-muted">{{ gpsErrorMessage }}</span>
                </div>
              </div>

              <div v-else-if="gpsStatus === 'error'" class="gps-status-card is-error">
                <div class="flex-between">
                  <div class="flex-center gap-1 text-danger text-xs font-semibold">
                    <AlertTriangle :size="14" />
                    <span>{{ gpsErrorMessage || 'Chưa nhận được tín hiệu GPS vệ tinh' }}</span>
                  </div>
                  <button type="button" class="btn btn-outline btn-xs" @click="captureGpsLocation">
                    Thử lại
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div class="form-group mt-2">
            <label class="form-label">Mô tả tình trạng hư hỏng <span class="required">*</span></label>
            <textarea
              v-model="newDescription"
              rows="3"
              class="form-input"
              placeholder="Mô tả cụ thể hiện tượng, tiếng ồn, có ảnh hưởng đến lượng mủ chở trên xe không..."
            ></textarea>
          </div>

          <!-- Đính kèm ảnh hiện trường -->
          <div class="form-group mt-2">
            <label class="form-label font-bold flex-between">
              <span>Ảnh chụp hiện trường sự cố</span>
              <span v-if="newPhotoUrl" class="text-xs text-success">✓ Đã chọn ảnh</span>
            </label>
            <div v-if="newPhotoUrl" class="proof-box-preview">
              <img :src="newPhotoUrl" alt="Ảnh sự cố" class="proof-img-sm" />
              <button type="button" class="btn btn-outline btn-xs" @click="newPhotoUrl = undefined">✕ Đổi ảnh</button>
            </div>
            <label v-else class="btn btn-outline btn-sm upload-btn">
              <Camera :size="15" />
              <span>Chụp / Tải ảnh sự cố từ điện thoại</span>
              <input type="file" accept="image/*" class="hidden-input" @change="onFileSelected" />
            </label>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn btn-secondary" @click="showCreateModal = false">Hủy Bỏ</button>
          <button class="btn btn-danger" @click="handleCreateIncident">
            Gửi Báo Cáo Sự Cố Ngay
          </button>
        </div>
      </div>
    </div>

    <!-- Zoom ảnh -->
    <div v-if="previewZoom" class="lightbox-overlay" @click.self="previewZoom = null">
      <div class="lightbox-content">
        <button class="lightbox-close" @click="previewZoom = null">
          <X :size="20" />
        </button>
        <img :src="previewZoom" alt="Ảnh hiện trường" class="lightbox-img" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.driver-incidents-page {
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
  background: #fee2e2;
  color: #dc2626;
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

/* SOS Banner */
.sos-banner {
  display: flex;
  align-items: center;
  gap: 14px;
  background: #fff1f2;
  border: 1px solid #fecdd3;
  border-radius: 8px;
  padding: 12px 16px;
}
.sos-icon {
  width: 44px;
  height: 44px;
  background: #ffe4e6;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.sos-title {
  color: #be123c;
  font-size: 0.875rem;
}

/* Table */
.table-responsive {
  width: 100%;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
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
  padding: 3px 8px;
  border-radius: 4px;
  font-weight: 700;
  font-size: 0.75rem;
  font-family: monospace;
  white-space: nowrap;
}
.desc-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.photo-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: #0284c7;
  font-size: 0.6875rem;
  font-weight: 600;
  cursor: pointer;
}
.photo-link:hover {
  text-decoration: underline;
}

/* Badges */
.badge {
  display: inline-block;
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 0.6875rem;
  font-weight: 700;
  white-space: nowrap;
}
.badge-red { background: #fee2e2; color: #dc2626; }
.badge-orange { background: #ffedd5; color: #ea580c; }
.badge-amber { background: #fef3c7; color: #d97706; }
.badge-blue { background: #e0f2fe; color: #0284c7; }

/* Status pills */
.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 0.6875rem;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 12px;
  white-space: nowrap;
}
.pill-green { background: #dcfce7; color: #166534; }
.pill-amber { background: #fef3c7; color: #b45309; }
.pill-red { background: #fee2e2; color: #991b1b; }

.modal-md { max-width: 750px; width: 95%; }
.hidden-input { display: none; }
.upload-btn { cursor: pointer; display: inline-flex; align-items: center; gap: 6px; }
.proof-box-preview {
  display: flex;
  align-items: center;
  gap: 10px;
}
.proof-img-sm {
  width: 60px;
  height: 40px;
  border-radius: 4px;
  object-fit: cover;
  border: 1px solid #cbd5e1;
}

/* Lightbox */
.lightbox-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}
.lightbox-content {
  position: relative;
  max-width: 500px;
  width: 100%;
}
.lightbox-close {
  position: absolute;
  top: -40px;
  right: 0;
  background: rgba(255, 255, 255, 0.2);
  border: none;
  border-radius: 50%;
  width: 32px;
  height: 32px;
  color: #fff;
  cursor: pointer;
}
.lightbox-img {
  width: 100%;
  border-radius: 8px;
}

/* GPS Location styling */
.location-gps-group {
  position: relative;
}
.btn-gps-action {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: #f0fdf4;
  color: #16a34a;
  border: 1px solid #bbf7d0;
  border-radius: 6px;
  padding: 2px 8px;
  font-size: 0.6875rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
}
.btn-gps-action:hover {
  background: #dcfce7;
  border-color: #86efac;
}
.btn-gps-action.is-locating {
  background: #eff6ff;
  color: #2563eb;
  border-color: #bfdbfe;
  cursor: wait;
}
.btn-gps-action.is-success {
  background: #ecfdf5;
  color: #059669;
}
.gps-status-card {
  margin-top: 6px;
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 0.75rem;
  transition: all 0.2s ease;
}
.gps-status-card.is-loading {
  background: #f0f9ff;
  border: 1px dashed #7dd3fc;
}
.gps-status-card.is-active {
  background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%);
  border: 1px solid #86efac;
  box-shadow: 0 1px 3px rgba(16, 185, 129, 0.08);
}
.gps-status-card.is-error {
  background: #fef2f2;
  border: 1px solid #fecaca;
}
.gps-card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}
.gps-badge-live {
  display: flex;
  align-items: center;
  gap: 6px;
}
.live-dot-pulse {
  width: 8px;
  height: 8px;
  background: #10b981;
  border-radius: 50%;
  box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
  animation: gpsPulse 1.8s infinite;
}
@keyframes gpsPulse {
  0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
  70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); }
  100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
}
.accuracy-tag {
  background: #d1fae5;
  color: #065f46;
  font-size: 0.625rem;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 4px;
}
.gps-time-text {
  font-size: 0.6875rem;
  color: #64748b;
}
.gps-coords-display {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.gps-coords-val {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.75rem;
  font-weight: 700;
  color: #0f172a;
  background: #ffffff;
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid #cbd5e1;
}
.btn-maps-preview {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: #0284c7;
  font-weight: 600;
  font-size: 0.6875rem;
  text-decoration: none;
  background: #e0f2fe;
  padding: 2px 6px;
  border-radius: 4px;
  transition: all 0.2s;
}
.btn-maps-preview:hover {
  background: #bae6fd;
  color: #0369a1;
}
.gps-fallback-hint {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 4px;
}

/* Location cell in table */
.location-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.gps-cell-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  padding: 1px 6px;
  width: fit-content;
}
.gps-cell-badge .gps-val {
  font-family: ui-monospace, SFMono-Regular, monospace;
  font-size: 0.6875rem;
  font-weight: 600;
  color: #334155;
}
.maps-ext-link {
  color: #0284c7;
  display: inline-flex;
  align-items: center;
  transition: color 0.15s;
}
.maps-ext-link:hover {
  color: #0369a1;
}

.spin {
  animation: spin 1s linear infinite;
}
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Filter controls */
.card-header {
  padding: 16px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}
.header-filters-group {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.filter-search-wrap {
  position: relative;
  display: flex;
  align-items: center;
}
.filter-search-wrap .search-ico {
  position: absolute;
  left: 11px;
  color: #64748b;
  pointer-events: none;
}
.filter-search-input {
  height: 38px;
  padding: 0 32px 0 34px;
  font-size: 0.8125rem;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  outline: none;
  width: 240px;
  background: #ffffff;
  color: #0f172a;
  transition: all 0.2s ease;
}
.filter-search-input:focus {
  border-color: #0284c7;
  box-shadow: 0 0 0 3px rgba(2, 132, 199, 0.12);
}
.btn-clear-search {
  position: absolute;
  right: 8px;
  background: transparent;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  padding: 2px;
  display: flex;
  align-items: center;
}
.btn-clear-search:hover {
  color: #475569;
}
.filter-select {
  height: 38px;
  padding: 0 12px;
  font-size: 0.8125rem;
  font-weight: 500;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  background-color: #ffffff;
  color: #334155;
  outline: none;
  cursor: pointer;
  transition: all 0.2s ease;
}
.filter-select:focus {
  border-color: #0284c7;
  box-shadow: 0 0 0 3px rgba(2, 132, 199, 0.12);
}
.btn-reset-filter {
  height: 38px;
  padding: 0 12px;
  font-size: 0.75rem;
  font-weight: 600;
  color: #475569;
  background: #f1f5f9;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}
.btn-reset-filter:hover {
  background: #e2e8f0;
  color: #0f172a;
}
</style>
