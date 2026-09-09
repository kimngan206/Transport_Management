<script setup lang="ts">
import { ref } from 'vue';
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
} from 'lucide-vue-next';

const authStore = useAuthStore();
const fleetStore = useFleetStore();
const dialog = useDialogStore();

interface DriverIncident {
  id: number;
  reportCode: string;
  vehiclePlate: string;
  incidentType: 'Tire' | 'Engine' | 'Electrical' | 'Tank' | 'Collision' | 'Other';
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  location: string;
  description: string;
  photoUrl?: string;
  status: 'REPORTED' | 'IN_REPAIR' | 'RESOLVED';
  reportedAt: string;
  repairNote?: string;
}

const defaultIncidents: DriverIncident[] = [
  {
    id: 1,
    reportCode: 'INC-260907-001',
    vehiclePlate: '51C-889.26',
    incidentType: 'Tire',
    severity: 'Medium',
    location: 'Km 24 - ĐT741, gần Trạm thu phí',
    description: 'Bánh sau bên phụ bị xì lốp, đã gọi vá xe lưu động khẩn cấp để tiếp tục hành trình chở mủ.',
    photoUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200"><rect width="100%" height="100%" fill="%23fee2e2"/><text x="50%" y="45%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="14" font-weight="bold" fill="%23dc2626">ẢNH HIỆN TRƯỜNG SỰ CỐ</text><text x="50%" y="65%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="12" fill="%23b91c1c">Xì lốp sau - 51C-889.26</text></svg>',
    status: 'RESOLVED',
    reportedAt: '2026-09-07 09:30',
    repairNote: 'Đội kỹ thuật đã xác nhận & tài xế đã kê khai chi phí vá vỏ lưu động 150.000 đ',
  },
  {
    id: 2,
    reportCode: 'INC-260905-002',
    vehiclePlate: '51C-889.26',
    incidentType: 'Electrical',
    severity: 'Low',
    location: 'Tại Nông trường 1',
    description: 'Đèn xi-nhan bên trái chập chờn lúc nhận xe đầu ca sáng.',
    status: 'RESOLVED',
    reportedAt: '2026-09-05 06:45',
    repairNote: 'Thợ điện tại xưởng đã thay bóng đèn xi-nhan dự phòng.',
  },
];

const incidents = ref<DriverIncident[]>(mockStorage.getDriverIncidents(defaultIncidents));

// Form gửi báo cáo mới
const showCreateModal = ref(false);
const newVehiclePlate = ref('51C-889.26');
const newIncidentType = ref<DriverIncident['incidentType']>('Tire');
const newSeverity = ref<DriverIncident['severity']>('Medium');
const newLocation = ref('');
const newDescription = ref('');
const newPhotoUrl = ref<string | undefined>();
const previewZoom = ref<string | null>(null);

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

  const newId = Date.now();
  const code = `INC-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${String(incidents.value.length + 1).padStart(3, '0')}`;

  const newReport: DriverIncident = {
    id: newId,
    reportCode: code,
    vehiclePlate: newVehiclePlate.value,
    incidentType: newIncidentType.value,
    severity: newSeverity.value,
    location: newLocation.value,
    description: newDescription.value,
    photoUrl: newPhotoUrl.value,
    status: 'REPORTED',
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
  });

  dialog.showSuccess(`Đã gửi báo cáo sự cố ${code} đến Đội bảo dưỡng & Điều phối viên thành công!`, 'Báo Cáo Thành Công');
  showCreateModal.value = false;
  // Reset form
  newLocation.value = '';
  newDescription.value = '';
  newPhotoUrl.value = undefined;
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
        <button class="btn btn-danger" @click="showCreateModal = true">
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
        <h3 class="card-title">Nhật Ký Sự Cố Xe Đã Báo Cáo ({{ incidents.length }})</h3>
      </div>

      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Mã Báo Cáo</th>
              <th>Phương Tiện</th>
              <th>Loại Sự Cố</th>
              <th>Mức Độ</th>
              <th>Vị Trí Gặp Sự Cố</th>
              <th>Mô Tả Hiện Trường & Ảnh</th>
              <th>Thời Gian</th>
              <th>Trạng Thái Xử Lý</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="inc in incidents" :key="inc.id">
              <td>
                <span class="code-badge">{{ inc.reportCode }}</span>
              </td>
              <td>
                <strong>{{ inc.vehiclePlate }}</strong>
              </td>
              <td>
                <span class="font-semibold">{{ getIncidentTypeName(inc.incidentType) }}</span>
              </td>
              <td>
                <span class="badge" :class="getSeverityBadge(inc.severity)">
                  {{ inc.severity === 'Critical' ? 'Khẩn cấp' : inc.severity === 'High' ? 'Cao' : inc.severity === 'Medium' ? 'Trung bình' : 'Nhẹ' }}
                </span>
              </td>
              <td>
                <span class="text-xs font-semibold">{{ inc.location }}</span>
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
              <td>
                <span class="text-xs text-muted">{{ inc.reportedAt }}</span>
              </td>
              <td>
                <span v-if="inc.status === 'RESOLVED'" class="status-pill pill-green">
                  <CheckCircle2 :size="12" />
                  <span>Đã Khắc Phục</span>
                </span>
                <span v-else-if="inc.status === 'IN_REPAIR'" class="status-pill pill-amber">
                  <Wrench :size="12" />
                  <span>Đang Sửa Chữa</span>
                </span>
                <span v-else class="status-pill pill-red">
                  <Clock :size="12" />
                  <span>Đã Tiếp Nhận</span>
                </span>
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

            <div class="form-group">
              <label class="form-label">Vị trí gặp sự cố <span class="required">*</span></label>
              <input
                v-model="newLocation"
                type="text"
                class="form-input"
                placeholder="VD: Km 18 ĐT741, gần cầu vượt..."
              />
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
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 700;
  font-size: 0.75rem;
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
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.6875rem;
  font-weight: 700;
}
.badge-red { background: #fee2e2; color: #dc2626; }
.badge-orange { background: #ffedd5; color: #ea580c; }
.badge-amber { background: #fef3c7; color: #d97706; }
.badge-blue { background: #e0f2fe; color: #0284c7; }

/* Status pills */
.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.6875rem;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 12px;
}
.pill-green { background: #dcfce7; color: #166534; }
.pill-amber { background: #fef3c7; color: #b45309; }
.pill-red { background: #fee2e2; color: #991b1b; }

.modal-md { max-width: 580px; width: 95%; }
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
</style>
