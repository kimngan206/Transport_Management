<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useFleetStore } from '@/stores/fleet';
import { useAuthStore } from '@/stores/auth';
import { useDialogStore } from '@/stores/dialog';
import StatusBadge from '@/components/common/StatusBadge.vue';
import TablePagination from '@/components/common/TablePagination.vue';
import type { Vehicle, IncidentReport, MaintenanceRecord, MaintenanceType } from '@/types';
import {
  Wrench,
  AlertTriangle,
  ShieldAlert,
  Plus,
  Settings,
  MapPin,
  ExternalLink,
  Search,
  X,
  RotateCcw,
  History
} from 'lucide-vue-next';

// -----------------------------------------------------------------------------
// Store References
// -----------------------------------------------------------------------------
const fleetStore = useFleetStore();
const authStore = useAuthStore();
const dialog = useDialogStore();

// -----------------------------------------------------------------------------
// Domain Interfaces
// -----------------------------------------------------------------------------
interface CombinedMaintenanceItem {
  id: string;
  type: 'DUE' | 'INCIDENT';
  vehiclePlate: string;
  model: string;
  vehicleType?: string;
  driverName?: string;
  reportDate?: string;
  currentOdoKm?: number;
  lastMaintenanceOdo?: number;
  threshold?: number;
  maintenanceStatus?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  issueDescription?: string;
  severity?: 'Warning' | 'StopOperation';
  status?: string;
  rawVehicle?: Vehicle;
  rawIncident?: IncidentReport;
}

// -----------------------------------------------------------------------------
// Reactive Dialog & Form State
// -----------------------------------------------------------------------------
const showIncidentModal = ref(false);
const showRecordModal = ref(false);
const showHistoryModal = ref(false);
const historyVehicle = ref<Vehicle | null>(null);

// Incident Form Fields
const incVehId = ref<number | ''>('');
const incDesc = ref('');
const incSeverity = ref<'Warning' | 'StopOperation'>('Warning');

// Maintenance Record Form Fields
const recVehId = ref<number | ''>('');
const recMaintenanceTypeId = ref<number | ''>('');
const recOdo = ref<number>(0);
const recCost = ref<number>(0);
const recGarage = ref('');
const recParts = ref('');

// Master Table Filter & Pagination State
const masterSearchKeyword = ref('');
const masterCategoryFilter = ref<'ALL' | 'DUE' | 'INCIDENT'>('ALL');
const masterStatusFilter = ref<string>('ALL');
const masterPage = ref(1);
const masterPageSize = ref(10);

// -----------------------------------------------------------------------------
// Computed Properties
// -----------------------------------------------------------------------------
// Danh sách xe thuộc sở hữu Công ty (Loại trừ hoàn toàn xe thuê ngoài / external)
const companyVehiclesOnly = computed<Vehicle[]>(() =>
  fleetStore.vehicles.filter((v) => !v.isExternal)
);

// Danh sách tổng hợp gộp chung Cảnh báo BD & Báo cáo sự cố xe (Chỉ xe Công ty)
const combinedMaintenanceItems = computed<CombinedMaintenanceItem[]>(() => {
  const items: CombinedMaintenanceItem[] = [];

  // 1. Ghi nhận toàn bộ xe Công ty để theo dõi bảo dưỡng
  companyVehiclesOnly.value.forEach((v) => {
    items.push({
      id: `due-${v.id}`,
      type: 'DUE',
      vehiclePlate: v.licensePlate,
      model: v.model,
      vehicleType: v.vehicleType,
      driverName: v.assignedDriverName || 'Hệ thống',
      lastMaintenanceOdo: v.lastMaintenanceOdo,
      currentOdoKm: v.currentOdoKm,
      threshold: getThreshold(v),
      maintenanceStatus: v.maintenanceStatus,
      rawVehicle: v,
    });
  });

  // 2. Ghi nhận từ Báo cáo sự cố & hư hỏng (Chỉ xe Công ty)
  fleetStore.incidents.forEach((inc) => {
    const matchedV = fleetStore.vehicles.find(
      (v) => v.licensePlate === inc.vehiclePlate || v.id === inc.vehicleId
    );
    if (matchedV?.isExternal) return;

    items.push({
      id: `inc-${inc.id}`,
      type: 'INCIDENT',
      vehiclePlate: inc.vehiclePlate,
      model: matchedV?.model || '—',
      vehicleType: matchedV?.vehicleType,
      driverName: inc.driverName || 'Tài xế',
      reportDate: inc.reportDate,
      currentOdoKm: matchedV?.currentOdoKm,
      location: inc.location,
      latitude: inc.latitude,
      longitude: inc.longitude,
      issueDescription: inc.issueDescription,
      severity: inc.severity,
      status: inc.status,
      rawVehicle: matchedV,
      rawIncident: inc,
    });
  });

  return items;
});

// Kết quả lọc danh sách tổng hợp
const filteredCombinedItems = computed<CombinedMaintenanceItem[]>(() => {
  return combinedMaintenanceItems.value.filter((item) => {
    // 1. Lọc theo loại ghi nhận (Bảo dưỡng / Sự cố)
    if (masterCategoryFilter.value !== 'ALL' && item.type !== masterCategoryFilter.value) {
      return false;
    }

    // 2. Lọc theo từ khóa tìm kiếm
    if (masterSearchKeyword.value.trim()) {
      const kw = masterSearchKeyword.value.trim().toLowerCase();
      const matchPlate = item.vehiclePlate.toLowerCase().includes(kw);
      const matchModel = item.model.toLowerCase().includes(kw);
      const matchDriver = (item.driverName || '').toLowerCase().includes(kw);
      const matchLoc = (item.location || '').toLowerCase().includes(kw);
      const matchDesc = (item.issueDescription || '').toLowerCase().includes(kw);
      if (!matchPlate && !matchModel && !matchDriver && !matchLoc && !matchDesc) {
        return false;
      }
    }

    // 3. Lọc theo trạng thái / mức độ
    if (masterStatusFilter.value !== 'ALL') {
      if (item.type === 'DUE') {
        if (item.maintenanceStatus !== masterStatusFilter.value) return false;
      } else {
        if (item.severity !== masterStatusFilter.value && item.status !== masterStatusFilter.value) {
          return false;
        }
      }
    }

    return true;
  });
});

// Danh sách sau khi phân trang
const paginatedCombinedItems = computed<CombinedMaintenanceItem[]>(() => {
  const start = (masterPage.value - 1) * masterPageSize.value;
  return filteredCombinedItems.value.slice(start, start + masterPageSize.value);
});

// Lịch sử bảo dưỡng của chiếc xe được chọn trong modal xem lịch sử
const selectedVehicleHistory = computed<MaintenanceRecord[]>(() => {
  if (!historyVehicle.value) return [];
  const veh = historyVehicle.value;
  return fleetStore.maintenances.filter(
    (m) => m.vehicleId === veh.id || m.vehiclePlate === veh.licensePlate
  );
});

// Danh mục bảo dưỡng đang hoạt động
const activeMaintenanceTypes = computed<MaintenanceType[]>(() =>
  fleetStore.maintenanceTypes.filter((m) => m.isActive)
);

// Danh mục bảo dưỡng được chọn trong form ghi phiếu
const selectedMaintenanceType = computed<MaintenanceType | null>(() =>
  fleetStore.maintenanceTypes.find((m) => m.id === Number(recMaintenanceTypeId.value)) ?? null
);

// Xe được chọn trong form ghi phiếu
const selectedVehicle = computed<Vehicle | null>(() =>
  fleetStore.vehicles.find((v) => v.id === Number(recVehId.value)) ?? null
);

// Các xe được cấu hình áp dụng danh mục bảo dưỡng hiện tại
const configuredVehiclesForType = computed<Vehicle[]>(() => {
  if (!selectedMaintenanceType.value) return companyVehiclesOnly.value;
  const assigned = selectedMaintenanceType.value.assignedVehicleIds || [];
  if (assigned.length === 0) return companyVehiclesOnly.value;
  return companyVehiclesOnly.value.filter((v) => assigned.includes(v.id));
});

// Các xe khác ngoài danh sách cấu hình
const otherVehiclesForType = computed<Vehicle[]>(() => {
  if (!selectedMaintenanceType.value) return [];
  const assigned = selectedMaintenanceType.value.assignedVehicleIds || [];
  if (assigned.length === 0) return [];
  return companyVehiclesOnly.value.filter((v) => !assigned.includes(v.id));
});

// -----------------------------------------------------------------------------
// Watchers
// -----------------------------------------------------------------------------
watch([masterSearchKeyword, masterCategoryFilter, masterStatusFilter], () => {
  masterPage.value = 1;
});

// Tự động điền chi phí & vật tư khi đổi danh mục bảo dưỡng
watch(selectedMaintenanceType, (mt) => {
  if (mt) {
    recCost.value = mt.estimatedCost;
    recParts.value = mt.checklistItems.join(', ');
  }
});

// Tự động điền ODO khi chọn xe
watch(selectedVehicle, (v) => {
  if (v) recOdo.value = v.currentOdoKm;
});

// -----------------------------------------------------------------------------
// Action Handlers
// -----------------------------------------------------------------------------
function openVehicleHistoryModal(v: Vehicle) {
  historyVehicle.value = v;
  showHistoryModal.value = true;
}

function openRecordModal(v?: Vehicle) {
  if (v) {
    recVehId.value = v.id;
    recOdo.value = v.currentOdoKm;
    const matchType = fleetStore.maintenanceTypes.find(
      (m) =>
        m.isActive &&
        (m.assignedVehicleIds?.includes(v.id) ||
          !m.assignedVehicleIds ||
          m.assignedVehicleIds.length === 0)
    );
    recMaintenanceTypeId.value = matchType ? matchType.id : (activeMaintenanceTypes.value[0]?.id ?? '');
    if (matchType) {
      recCost.value = matchType.estimatedCost;
      recParts.value = matchType.checklistItems.join(', ');
    }
  } else {
    const firstType = activeMaintenanceTypes.value[0];
    recMaintenanceTypeId.value = firstType ? firstType.id : '';
    recCost.value = firstType ? firstType.estimatedCost : 0;
    recParts.value = firstType ? firstType.checklistItems.join(', ') : '';
    if (firstType?.assignedVehicleIds && firstType.assignedVehicleIds.length > 0) {
      recVehId.value = firstType.assignedVehicleIds[0];
      const autoV = fleetStore.vehicles.find((item) => item.id === firstType.assignedVehicleIds[0]);
      if (autoV) recOdo.value = autoV.currentOdoKm;
    } else {
      recVehId.value = '';
      recOdo.value = 0;
    }
  }
  recGarage.value = '';
  showRecordModal.value = true;
}

function handleCreateIncident() {
  if (!incVehId.value || !incDesc.value) {
    dialog.showWarning('Vui lòng chọn xe và nhập mô tả chi tiết sự cố!', 'Thiếu Thông Tin Bắt Buộc', 'Kiểm tra lại');
    return;
  }
  const v = fleetStore.vehicles.find((item) => item.id === Number(incVehId.value));
  fleetStore.reportIncident({
    vehicleId: Number(incVehId.value),
    vehiclePlate: v?.licensePlate || '',
    reportedByDriverId: authStore.currentUser.driverId || 101,
    driverName: authStore.currentUser.fullName,
    reportDate: new Date().toISOString().slice(0, 10),
    issueDescription: incDesc.value,
    severity: incSeverity.value,
  });
  showIncidentModal.value = false;
  incVehId.value = '';
  incDesc.value = '';
  dialog.showSuccess(
    `Báo cáo sự cố xe ${v?.licensePlate || ''} đã được tiếp nhận và cập nhật trạng thái vận hành thành công!`,
    'Báo Cáo Sự Cố Thành Công'
  );
}

function handleCreateRecord() {
  if (!recVehId.value) {
    dialog.showWarning('Vui lòng chọn xe cần ghi nhận bảo dưỡng!', 'Thiếu Thông Tin Xe', 'Kiểm tra lại');
    return;
  }
  if (!recMaintenanceTypeId.value) {
    dialog.showWarning('Vui lòng chọn danh mục bảo dưỡng!', 'Thiếu Danh Mục Bảo Dưỡng', 'Kiểm tra lại');
    return;
  }
  const v = fleetStore.vehicles.find((item) => item.id === Number(recVehId.value));
  const mt = selectedMaintenanceType.value;
  fleetStore.recordMaintenance({
    vehicleId: Number(recVehId.value),
    vehiclePlate: v?.licensePlate || '',
    maintenanceTypeId: Number(recMaintenanceTypeId.value),
    maintenanceTypeName: mt?.name ?? '',
    maintenanceType: mt?.code ?? '',
    maintenanceOdo: Number(recOdo.value),
    cost: Number(recCost.value),
    garageName: recGarage.value,
    replacedParts: recParts.value,
    maintenanceDate: new Date().toISOString().slice(0, 10),
  });
  showRecordModal.value = false;
  dialog.showSuccess(
    `Đã lưu hồ sơ bảo dưỡng "${mt?.name}" cho xe ${v?.licensePlate || ''} thành công!`,
    'Ghi Nhận Bảo Dưỡng Thành Công'
  );
}

function resetMasterFilters() {
  masterSearchKeyword.value = '';
  masterCategoryFilter.value = 'ALL';
  masterStatusFilter.value = 'ALL';
}

function getThreshold(v: Vehicle): number {
  if (fleetStore && typeof fleetStore.getVehicleMaintenanceThreshold === 'function') {
    return fleetStore.getVehicleMaintenanceThreshold(v);
  }
  return 5000;
}
</script>

<template>
  <div class="maintenance-page">
    <!-- Header trang -->
    <div class="page-header">
      <div>
        <h1 class="page-title">Quản Lý Bảo Dưỡng & Sự Cố Xe</h1>
        <p class="page-subtitle">
          Theo dõi chu kỳ bảo dưỡng định mức, tiếp nhận báo hỏng sự cố và ghi nhận chi phí sửa chữa thực tế
        </p>
      </div>

      <div class="header-actions">
        <router-link to="/maintenance/types" class="btn btn-outline">
          <Settings :size="16" />
          <span>Cài Đặt Bảo Dưỡng</span>
        </router-link>
        <button class="btn btn-outline-danger" @click="showIncidentModal = true">
          <AlertTriangle :size="16" />
          <span>Báo Sự Cố Xe</span>
        </button>
        <button class="btn btn-primary" @click="showRecordModal = true">
          <Plus :size="16" />
          <span>Ghi Phiếu Bảo Dưỡng</span>
        </button>
      </div>
    </div>

    <!-- Bảng hợp nhất: Báo cáo bảo dưỡng & Sự cố phương tiện -->
    <div class="card mb-4">
      <div class="card-header">
        <div>
          <h3 class="card-title">Quản Lý Bảo Dưỡng Định Kỳ & Báo Cáo Sự Cố Xe</h3>
          <p class="text-xs text-muted">
            Bảng dữ liệu hợp nhất thông tin cảnh báo ODO bảo dưỡng định kỳ và các sự cố kỹ thuật phương tiện toàn đội xe
          </p>
        </div>

        <div class="header-filters-group">
          <!-- Tìm kiếm từ khóa -->
          <div class="filter-search-wrap">
            <Search :size="15" class="search-ico" />
            <input
              v-model="masterSearchKeyword"
              type="text"
              class="filter-search-input"
              placeholder="Tìm biển số, tài xế, vị trí..."
            />
            <button
              v-if="masterSearchKeyword"
              class="btn-clear-search"
              title="Xóa tìm kiếm"
              @click="masterSearchKeyword = ''"
            >
              <X :size="13" />
            </button>
          </div>

          <!-- Lọc danh mục ghi nhận -->
          <select v-model="masterCategoryFilter" class="filter-select">
            <option value="ALL">Tất cả ghi nhận ({{ combinedMaintenanceItems.length }})</option>
            <option value="DUE">Xe công ty theo dõi bảo dưỡng ({{ companyVehiclesOnly.length }})</option>
            <option value="INCIDENT">Báo cáo sự cố ({{ fleetStore.incidents.length }})</option>
          </select>

          <!-- Lọc trạng thái / mức độ -->
          <select v-model="masterStatusFilter" class="filter-select">
            <option value="ALL">Tất cả trạng thái / mức độ</option>
            <option value="Due">Cần bảo dưỡng (Due)</option>
            <option value="Overdue">Quá hạn bảo dưỡng (Overdue)</option>
            <option value="StopOperation">Dừng hoạt động (Stop)</option>
            <option value="Warning">Cảnh báo (Warning)</option>
            <option value="Pending">Đã tiếp nhận (Pending)</option>
            <option value="InRepair">Đang sửa chữa (InRepair)</option>
            <option value="Resolved">Đã khắc phục (Resolved)</option>
          </select>

          <!-- Đặt lại bộ lọc -->
          <button
            v-if="masterSearchKeyword || masterCategoryFilter !== 'ALL' || masterStatusFilter !== 'ALL'"
            class="btn-reset-filter"
            title="Đặt lại bộ lọc"
            @click="resetMasterFilters"
          >
            <RotateCcw :size="13" />
            <span>Đặt lại</span>
          </button>
        </div>
      </div>

      <!-- Bảng dữ liệu chính -->
      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th style="min-width: 110px;">Biển Số Xe</th>
              <th style="min-width: 130px;">Dòng Xe</th>
              <th style="min-width: 145px;">Loại Ghi Nhận</th>
              <th style="min-width: 140px;">Người Báo / Phụ Trách</th>
              <th style="min-width: 150px;">Thời Gian / ODO Ghi Nhận</th>
              <th style="min-width: 160px;">ODO Hiện Tại & Quãng Đường</th>
              <th style="min-width: 160px;">Vị Trí Hiện Trường & GPS</th>
              <th style="min-width: 260px;">Mô Tả</th>
              <th style="min-width: 120px;">Mức Độ</th>
              <th style="min-width: 130px;">Trạng Thái</th>
              <th style="min-width: 150px;">Thao Tác</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="filteredCombinedItems.length === 0">
              <td colspan="11" class="text-center py-5 text-muted">
                Không tìm thấy dữ liệu nào phù hợp với bộ lọc hiện tại.
              </td>
            </tr>

            <tr v-for="item in paginatedCombinedItems" :key="item.id">
              <!-- 1. Biển số xe -->
              <td><strong class="font-mono text-dark">{{ item.vehiclePlate }}</strong></td>

              <!-- 2. Dòng xe -->
              <td>
                <span>{{ item.model }}</span>
                <span v-if="item.vehicleType" class="text-xs text-muted block">({{ item.vehicleType }})</span>
              </td>

              <!-- 3. Loại ghi nhận -->
              <td>
                <span v-if="item.type === 'DUE'" class="type-badge type-due">
                  <Wrench :size="12" />
                  <span>Bảo dưỡng định kỳ</span>
                </span>
                <span v-else class="type-badge type-incident">
                  <ShieldAlert :size="12" />
                  <span>Báo sự cố & hỏng</span>
                </span>
              </td>

              <!-- 4. Người báo / phụ trách -->
              <td>{{ item.driverName || '—' }}</td>

              <!-- 5. Thời gian / ODO ghi nhận -->
              <td>
                <template v-if="item.type === 'INCIDENT'">
                  <span class="font-medium text-dark">{{ item.reportDate }}</span>
                </template>
                <template v-else>
                  <span class="text-xs text-muted">BD trước:</span>
                  <div><strong>{{ item.lastMaintenanceOdo?.toLocaleString('vi-VN') }} km</strong></div>
                </template>
              </td>

              <!-- 6. ODO hiện tại & quãng đường -->
              <td>
                <div v-if="item.currentOdoKm !== undefined">
                  <strong>{{ item.currentOdoKm.toLocaleString('vi-VN') }} km</strong>
                  <div v-if="item.type === 'DUE' && item.lastMaintenanceOdo !== undefined && item.threshold !== undefined">
                    <span
                      class="text-xs font-bold"
                      :class="(item.currentOdoKm - item.lastMaintenanceOdo) >= item.threshold ? 'text-danger' : 'text-success'"
                    >
                      +{{ (item.currentOdoKm - item.lastMaintenanceOdo).toLocaleString('vi-VN') }} km
                      <span v-if="(item.currentOdoKm - item.lastMaintenanceOdo) >= item.threshold" class="block text-xs">
                        (Vượt {{ item.threshold.toLocaleString('vi-VN') }} km)
                      </span>
                    </span>
                  </div>
                </div>
                <span v-else class="text-muted text-xs">—</span>
              </td>

              <!-- 7. Vị trí hiện trường & GPS -->
              <td>
                <template v-if="item.type === 'INCIDENT'">
                  <div class="incident-loc-cell">
                    <span class="loc-text font-semibold text-xs text-dark">{{ item.location || 'Dọc đường vận chuyển' }}</span>
                    <div v-if="item.latitude && item.longitude" class="gps-loc-row">
                      <span class="gps-loc-badge">
                        <MapPin :size="11" class="text-danger" />
                        {{ item.latitude.toFixed(4) }}, {{ item.longitude.toFixed(4) }}
                      </span>
                      <a
                        :href="`https://www.google.com/maps?q=${item.latitude},${item.longitude}`"
                        target="_blank"
                        class="link-maps-mini"
                        title="Mở Google Maps"
                      >
                        <ExternalLink :size="11" />
                        <span>Maps</span>
                      </a>
                    </div>
                  </div>
                </template>
                <template v-else>
                  <span class="text-xs text-muted">Nông trường / Gara phụ trách</span>
                </template>
              </td>

              <!-- 8. Mô tả -->
              <td>
                <template v-if="item.type === 'INCIDENT'">
                  <span class="text-xs text-dark">{{ item.issueDescription }}</span>
                </template>
                <template v-else>
                  <span class="text-xs text-secondary">Kích hoạt theo định mức chu kỳ ODO cài đặt</span>
                </template>
              </td>

              <!-- 9. Mức độ -->
              <td>
                <template v-if="item.type === 'DUE'">
                  <StatusBadge :status="item.maintenanceStatus || 'Normal'" type="maintenance" />
                </template>
                <template v-else>
                  <span
                    class="badge"
                    :class="item.severity === 'StopOperation' ? 'badge-rejected' : 'badge-pending'"
                  >
                    {{ item.severity === 'StopOperation' ? 'Dừng xe (Stop)' : 'Cảnh báo (Warning)' }}
                  </span>
                </template>
              </td>

              <!-- 10. Trạng thái -->
              <td>
                <template v-if="item.type === 'DUE'">
                  <span
                    v-if="item.rawVehicle?.status === 'UnderMaintenance'"
                    class="badge badge-pending"
                  >
                    Đang bảo dưỡng
                  </span>
                  <span
                    v-else-if="item.rawVehicle?.status === 'Broken'"
                    class="badge badge-rejected"
                  >
                    Đang hỏng
                  </span>
                  <span
                    v-else-if="item.rawVehicle?.status === 'OnTrip'"
                    class="badge badge-dispatched"
                  >
                    Đang đi chuyến
                  </span>
                  <span v-else class="badge badge-completed">
                    Sẵn sàng
                  </span>
                </template>
                <template v-else>
                  <span
                    class="badge"
                    :class="{
                      'badge-pending': item.status === 'Pending',
                      'badge-dispatched': item.status === 'InRepair',
                      'badge-completed': item.status === 'Resolved'
                    }"
                  >
                    {{
                      item.status === 'Pending' ? 'Đã tiếp nhận' :
                      item.status === 'InRepair' ? 'Đang sửa chữa' :
                      item.status === 'Resolved' ? 'Đã khắc phục' : (item.status || '—')
                    }}
                  </span>
                </template>
              </td>

              <!-- 11. Thao tác -->
              <td>
                <div class="action-btn-flex">
                  <button
                    class="btn btn-secondary btn-sm"
                    title="Ghi nhận phiếu bảo dưỡng"
                    @click="openRecordModal(item.rawVehicle)"
                  >
                    <Wrench :size="14" />
                    <span>Bảo dưỡng</span>
                  </button>
                  <button
                    v-if="item.rawVehicle"
                    class="btn btn-icon-history btn-sm"
                    title="Xem lịch sử BD xe này"
                    @click="openVehicleHistoryModal(item.rawVehicle)"
                  >
                    <History :size="14" />
                    <span>Lịch sử BD</span>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Phân trang -->
      <TablePagination
        v-model:currentPage="masterPage"
        v-model:pageSize="masterPageSize"
        :totalItems="filteredCombinedItems.length"
        :pageSizeOptions="[5, 10, 15, 25]"
      />
    </div>

    <!-- Modal Báo sự cố -->
    <div v-if="showIncidentModal" class="modal-backdrop" @click.self="showIncidentModal = false">
      <div class="modal-content">
        <div class="modal-header">
          <h3 class="modal-title text-danger">Báo Sự Cố Phương Tiện</h3>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">Chọn xe gặp sự cố <span class="required">*</span></label>
            <select v-model="incVehId" class="form-select">
              <option value="">-- Chọn xe --</option>
              <option v-for="v in companyVehiclesOnly" :key="v.id" :value="v.id">
                {{ v.licensePlate }} - {{ v.model }}
              </option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">Mức độ nghiêm trọng</label>
            <select v-model="incSeverity" class="form-select">
              <option value="Warning">Warning (Vẫn chạy được, cần theo dõi)</option>
              <option value="StopOperation">StopOperation (Bắt buộc dừng xe, khóa trạng thái xe)</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">Mô tả sự cố <span class="required">*</span></label>
            <textarea
              v-model="incDesc"
              rows="3"
              class="form-textarea"
              placeholder="Ví dụ: Rò rỉ nhớt bơm thủy lực, nứt lốp bánh sau..."
            ></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="showIncidentModal = false">Hủy</button>
          <button class="btn btn-danger" @click="handleCreateIncident">Gửi Báo Sự Cố</button>
        </div>
      </div>
    </div>

    <!-- Modal Ghi phiếu bảo dưỡng -->
    <div v-if="showRecordModal" class="modal-backdrop" @click.self="showRecordModal = false">
      <div class="modal-content">
        <div class="modal-header">
          <h3 class="modal-title text-primary">Ghi Nhận Bảo Dưỡng / Sửa Chữa</h3>
        </div>
        <div class="modal-body">
          <!-- Bước 1: Chọn danh mục bảo dưỡng trước -->
          <div class="form-group">
            <label class="form-label">1. Chọn danh mục bảo dưỡng / quy trình kỹ thuật <span class="required">*</span></label>
            <select v-model="recMaintenanceTypeId" class="form-select">
              <option value="">-- Chọn danh mục bảo dưỡng --</option>
              <optgroup
                v-for="group in ['Bảo dưỡng định kỳ', 'Sửa chữa phục hồi', 'Hệ thống chuyên dụng']"
                :key="group"
                :label="group"
              >
                <option
                  v-for="mt in activeMaintenanceTypes.filter(m => m.group === group)"
                  :key="mt.id"
                  :value="mt.id"
                >
                  {{ mt.name }} — Dự toán: {{ mt.estimatedCost.toLocaleString('vi-VN') }}đ ({{ mt.assignedVehicleIds?.length || 0 }} xe áp dụng)
                </option>
              </optgroup>
            </select>
          </div>

          <!-- Preview danh mục đã chọn -->
          <div v-if="selectedMaintenanceType" class="maintenance-type-preview">
            <div class="preview-header">
              <span class="preview-code">{{ selectedMaintenanceType.code }}</span>
              <span class="preview-name">{{ selectedMaintenanceType.name }}</span>
              <span class="preview-cost font-bold text-primary">
                Dự toán: {{ selectedMaintenanceType.estimatedCost.toLocaleString('vi-VN') }}đ
              </span>
            </div>
            <div v-if="selectedMaintenanceType.checklistItems.length" class="preview-checklist">
              <p class="preview-checklist-title">Hạng mục kiểm chuẩn & thay thế ({{ selectedMaintenanceType.checklistItems.length }} mục):</p>
              <ul>
                <li v-for="(item, i) in selectedMaintenanceType.checklistItems" :key="i">✓ {{ item }}</li>
              </ul>
            </div>
          </div>

          <!-- Bước 2: Chọn chiếc xe cụ thể cần bảo dưỡng -->
          <div class="form-group">
            <label class="form-label">2. Chọn chiếc xe thực hiện bảo dưỡng <span class="required">*</span></label>
            <select v-model="recVehId" class="form-select">
              <option value="">-- Chọn xe thực hiện --</option>
              <optgroup
                v-if="selectedMaintenanceType && (selectedMaintenanceType.assignedVehicleIds?.length || 0) > 0"
                label="Xe đã cài đặt áp dụng danh mục này"
              >
                <option
                  v-for="v in configuredVehiclesForType"
                  :key="v.id"
                  :value="v.id"
                >
                  {{ v.licensePlate }} — {{ v.model }} (ODO: {{ v.currentOdoKm.toLocaleString('vi-VN') }} km)
                </option>
              </optgroup>
              <optgroup
                v-if="selectedMaintenanceType && (selectedMaintenanceType.assignedVehicleIds?.length || 0) > 0"
                label="Các xe khác trong đội xe"
              >
                <option
                  v-for="v in otherVehiclesForType"
                  :key="v.id"
                  :value="v.id"
                >
                  {{ v.licensePlate }} — {{ v.model }} (ODO: {{ v.currentOdoKm.toLocaleString('vi-VN') }} km)
                </option>
              </optgroup>
              <template v-else>
                <option v-for="v in companyVehiclesOnly" :key="v.id" :value="v.id">
                  {{ v.licensePlate }} — {{ v.model }} (ODO: {{ v.currentOdoKm.toLocaleString('vi-VN') }} km)
                </option>
              </template>
            </select>
          </div>

          <!-- Card thông tin xe đã chọn -->
          <div v-if="selectedVehicle" class="vehicle-selected-summary">
            <div class="veh-summary-row">
              <div class="veh-summary-item">
                <span class="label">Biển số:</span>
                <strong class="plate font-mono">{{ selectedVehicle.licensePlate }}</strong>
              </div>
              <div class="veh-summary-item">
                <span class="label">Tài xế phụ trách:</span>
                <span>{{ selectedVehicle.assignedDriverName || 'Chưa gán tài xế' }}</span>
              </div>
              <div class="veh-summary-item">
                <span class="label">ODO lần bảo dưỡng trước:</span>
                <span>{{ selectedVehicle.lastMaintenanceOdo.toLocaleString('vi-VN') }} km</span>
              </div>
              <div class="veh-summary-item">
                <span class="label">Đã chạy thêm:</span>
                <strong :class="(selectedVehicle.currentOdoKm - selectedVehicle.lastMaintenanceOdo) >= getThreshold(selectedVehicle) ? 'text-danger' : 'text-success'">
                  +{{ (selectedVehicle.currentOdoKm - selectedVehicle.lastMaintenanceOdo).toLocaleString('vi-VN') }} km
                </strong>
              </div>
            </div>
          </div>

          <div class="grid-2">
            <div class="form-group">
              <label class="form-label">ODO tại thời điểm bảo dưỡng (km)</label>
              <input v-model.number="recOdo" type="number" class="form-input" />
            </div>
            <div class="form-group">
              <label class="form-label">Chi phí thực tế (VNĐ)</label>
              <input v-model.number="recCost" type="number" step="50000" class="form-input font-bold" />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Gara / Đơn vị thực hiện</label>
            <input v-model="recGarage" type="text" class="form-input" placeholder="Ví dụ: Gara Cao Su Trung Tâm" />
          </div>

          <div class="form-group">
            <label class="form-label">Ghi chú bổ sung / Vật tư phát sinh</label>
            <textarea v-model="recParts" rows="2" class="form-textarea" placeholder="Ghi chú thêm nếu có..."></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="showRecordModal = false">Hủy</button>
          <button class="btn btn-primary" @click="handleCreateRecord">Hoàn Tất & Reset Chu Kỳ ODO</button>
        </div>
      </div>
    </div>

    <!-- Modal Lịch sử sửa chữa & chi phí bảo dưỡng từng xe -->
    <div v-if="showHistoryModal && historyVehicle" class="modal-backdrop" @click.self="showHistoryModal = false">
      <div class="modal-content modal-lg">
        <div class="modal-header">
          <div>
            <h3 class="modal-title text-primary flex-align-center gap-2">
              <History :size="20" />
              <span>Lịch Sử Sửa Chữa & Chi Phí Bảo Dưỡng</span>
            </h3>
            <p class="text-xs text-muted">
              Phương tiện: <strong class="text-dark font-mono font-bold">{{ historyVehicle.licensePlate }}</strong> ({{ historyVehicle.model }} - {{ historyVehicle.vehicleType }})
            </p>
          </div>
          <button class="btn-close-modal" title="Đóng modal" @click="showHistoryModal = false">
            <X :size="16" />
          </button>
        </div>

        <div class="modal-body">
          <div class="table-container">
            <table class="table">
              <thead>
                <tr>
                  <th>Loại Hình BD</th>
                  <th>ODO Ghi Nhận</th>
                  <th>Gara Thực Hiện</th>
                  <th>Linh Kiện Thay Thế</th>
                  <th>Chi Phí (VNĐ)</th>
                  <th>Ngày Hoàn Tất</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="selectedVehicleHistory.length === 0">
                  <td colspan="6" class="text-center py-5 text-muted">
                    <History :size="32" class="mx-auto mb-2 opacity-40 text-secondary" />
                    <p class="font-medium text-sm">Chưa có nhật ký bảo dưỡng hoặc sửa chữa nào cho xe {{ historyVehicle.licensePlate }}.</p>
                  </td>
                </tr>
                <tr v-for="rec in selectedVehicleHistory" :key="rec.id">
                  <td>
                    <span v-if="rec.maintenanceTypeName" class="font-medium text-dark">{{ rec.maintenanceTypeName }}</span>
                    <span v-else class="text-muted text-xs italic">{{ rec.maintenanceType || '—' }}</span>
                  </td>
                  <td><strong>{{ rec.maintenanceOdo ? rec.maintenanceOdo.toLocaleString('vi-VN') + ' km' : '—' }}</strong></td>
                  <td>{{ rec.garageName || '—' }}</td>
                  <td class="text-xs text-muted">{{ rec.replacedParts || '—' }}</td>
                  <td><strong class="text-primary">{{ rec.cost ? rec.cost.toLocaleString('vi-VN') + ' đ' : '0 đ' }}</strong></td>
                  <td>{{ rec.maintenanceDate || '—' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn btn-secondary" @click="showHistoryModal = false">Đóng</button>
          <button
            class="btn btn-primary"
            @click="showHistoryModal = false; openRecordModal(historyVehicle);"
          >
            <Wrench :size="14" />
            <span>Ghi Phiếu Bảo Dưỡng Cho Xe Này</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 12px;
}
.page-title {
  font-size: 1.375rem;
  font-weight: 800;
}
.page-subtitle {
  font-size: 0.8125rem;
  color: var(--text-secondary);
}
.header-actions {
  display: flex;
  gap: 10px;
}
.font-bold { font-weight: 700; }
.text-danger { color: #dc2626; }
.text-success { color: #16a34a; }
.text-primary { color: #15803d; }
.text-xs { font-size: 0.75rem; }
.mb-4 { margin-bottom: 20px; }

.btn-outline {
  background: white;
  border: 1px solid var(--border);
  color: var(--text-secondary);
  text-decoration: none;
}
.btn-outline:hover {
  background: #f8fafc;
  color: var(--text);
}
.btn-setting-link-top {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  color: #166534;
  font-size: 0.8125rem;
  font-weight: 700;
  padding: 6px 12px;
  border-radius: 6px;
  text-decoration: none;
  transition: all 0.2s;
}
.btn-setting-link-top:hover {
  background: #dcfce7;
  color: #14532d;
}

/* Preview danh mục bảo dưỡng trong modal ghi phiếu */
.maintenance-type-preview {
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 8px;
  padding: 12px 16px;
  margin-bottom: 16px;
}
.preview-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}
.preview-code {
  background: #15803d;
  color: white;
  font-size: 0.6875rem;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 4px;
  font-family: monospace;
  letter-spacing: 0.04em;
}
.preview-name {
  font-size: 0.875rem;
  font-weight: 700;
  color: #14532d;
}
.preview-cost {
  margin-left: auto;
  font-size: 0.8125rem;
}
.preview-checklist-title {
  font-size: 0.75rem;
  font-weight: 600;
  color: #166534;
  margin-bottom: 6px;
}
.preview-checklist ul {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.preview-checklist li {
  font-size: 0.8125rem;
  color: #15803d;
}

/* Card tóm tắt phương tiện đang chọn */
.vehicle-selected-summary {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 10px 14px;
  margin-bottom: 16px;
}
.veh-summary-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 10px;
}
.veh-summary-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 0.75rem;
}
.veh-summary-item .label {
  color: #64748b;
  font-size: 0.6875rem;
}
.veh-summary-item .plate {
  color: #0f172a;
  font-weight: 800;
  letter-spacing: 0.02em;
}
.font-mono {
  font-family: monospace;
}

/* GPS & Vị trí sự cố trong bảng bảo dưỡng */
.incident-loc-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.gps-loc-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.gps-loc-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: #f8fafc;
  border: 1px solid #cbd5e1;
  padding: 1px 6px;
  border-radius: 4px;
  font-family: monospace;
  font-size: 0.6875rem;
  font-weight: 600;
  color: #334155;
}
.link-maps-mini {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 0.6875rem;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 4px;
  text-decoration: none;
  transition: all 0.2s;
  background: #e0f2fe;
  color: #0369a1;
}
.link-maps-mini:hover {
  background: #bae6fd;
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
.btn-setting-link-top,
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
  text-decoration: none;
  transition: all 0.2s ease;
}
.btn-setting-link-top:hover,
.btn-reset-filter:hover {
  background: #e2e8f0;
  color: #0f172a;
}

/* Flex buttons trong ô Thao tác */
.action-btn-flex {
  display: flex;
  align-items: center;
  gap: 8px;
}
.btn-icon-history {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: #f0f9ff;
  color: #0369a1;
  border: 1px solid #bae6fd;
  border-radius: 6px;
  font-weight: 600;
  transition: all 0.2s ease;
}
.btn-icon-history:hover {
  background: #e0f2fe;
  color: #0284c7;
  border-color: #7dd3fc;
}

/* Modal rộng & header */
.modal-lg {
  max-width: 860px;
  width: 90%;
}
.flex-align-center {
  display: flex;
  align-items: center;
}
.btn-close-modal {
  background: transparent;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  transition: all 0.2s;
}
.btn-close-modal:hover {
  background: #f1f5f9;
  color: #0f172a;
}

/* Badges phân loại & trạng thái hợp nhất */
.type-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 8px;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 700;
  white-space: nowrap;
}
.type-due {
  background: #f0fdf4;
  color: #15803d;
  border: 1px solid #bbf7d0;
}
.type-incident {
  background: #fff7ed;
  color: #c2410c;
  border: 1px solid #fed7aa;
}
.block {
  display: block;
}
</style>
