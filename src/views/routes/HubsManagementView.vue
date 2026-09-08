<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import type { HubLocation, HubType } from '@/types/map';
import {
  getFreshHubs,
  addEcotechHub,
  updateEcotechHub,
  deleteEcotechHub,
} from '@/mocks/mapData';
import {
  MapPin,
  Plus,
  Edit2,
  Trash2,
  Compass,
  Building2,
  Trees,
  Scale,
  Factory,
  CheckCircle2,
  Search,
  X,
  RefreshCw,
  LocateFixed,
  Navigation,
  Globe,
  Loader2,
  Sliders,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from 'lucide-vue-next';

import { useDialogStore } from '@/stores/dialog';
import {
  VIETNAM_PROVINCES,
  smartGeocodeAddress,
  type DistrictItem,
  type WardItem,
} from '@/services/vietnamLocations';
import L, { safeInitMap, createTileLayer } from '@/utils/leaflet';

const dialog = useDialogStore();
const hubsList = ref<HubLocation[]>([...getFreshHubs()]);
const selectedTypeFilter = ref<string>('ALL');
const searchQuery = ref('');

// Refresh list from storage
function refreshHubs() {
  hubsList.value = [...getFreshHubs()];
  renderHubsOnMap();
}

// Lọc danh sách trạm
const filteredHubs = computed(() => {
  return hubsList.value.filter((h) => {
    const matchType = selectedTypeFilter.value === 'ALL' || h.type === selectedTypeFilter.value;
    const q = searchQuery.value.trim().toLowerCase();
    const matchQuery =
      !q ||
      h.name.toLowerCase().includes(q) ||
      h.code.toLowerCase().includes(q) ||
      h.shortName.toLowerCase().includes(q) ||
      h.address.toLowerCase().includes(q);
    return matchType && matchQuery;
  });
});

// Modal Thêm / Sửa
const showModal = ref(false);
const isEditing = ref(false);
const editingId = ref<string>('');

const formCode = ref('');
const formName = ref('');
const formShortName = ref('');
const formType = ref<HubType>('farm');
const formLat = ref<number>(11.5120);
const formLng = ref<number>(106.6025);
const formAddress = ref('');
const formDescription = ref('');

// Quản lý Địa chỉ Hành chính & Định vị GPS tự động
const selectedProvince = ref<string>('Tỉnh Bình Phước');
const selectedDistrict = ref<string>('Huyện Đồng Phú');
const selectedWard = ref<string>('Xã Tân Lập');
const streetAddress = ref<string>('Đường nội bộ nông trường');
const isGeocoding = ref<boolean>(false);
const geocodeSource = ref<'nominatim' | 'administrative' | 'manual' | 'fallback'>('administrative');
const showManualCoords = ref<boolean>(false);

// Danh sách Quận/Huyện theo Tỉnh đã chọn
const currentDistricts = computed<DistrictItem[]>(() => {
  const p = VIETNAM_PROVINCES.find((item) => item.name === selectedProvince.value);
  return p ? p.districts : [];
});

// Danh sách Xã/Phường theo Huyện đã chọn
const currentWards = computed<WardItem[]>(() => {
  const d = currentDistricts.value.find((item) => item.name === selectedDistrict.value);
  return d ? d.wards : [];
});

// Mini Map trong modal định vị
const miniMapContainer = ref<HTMLElement | null>(null);
let miniMapInstance: any = null;
let miniMapMarker: any = null;

function updateFullAddress() {
  const parts = [
    streetAddress.value.trim(),
    selectedWard.value.trim(),
    selectedDistrict.value.trim(),
    selectedProvince.value.trim(),
  ].filter(Boolean);
  formAddress.value = parts.join(', ');
}

function handleProvinceChange() {
  if (currentDistricts.value.length > 0) {
    selectedDistrict.value = currentDistricts.value[0].name;
    if (currentWards.value.length > 0) {
      selectedWard.value = currentWards.value[0].name;
    } else {
      selectedWard.value = '';
    }
  } else {
    selectedDistrict.value = '';
    selectedWard.value = '';
  }
  updateFullAddress();
  triggerGeocode(true);
}

function handleDistrictChange() {
  if (currentWards.value.length > 0) {
    selectedWard.value = currentWards.value[0].name;
  } else {
    selectedWard.value = '';
  }
  updateFullAddress();
  triggerGeocode(true);
}

function handleWardChange() {
  updateFullAddress();
  triggerGeocode(true);
}

let geocodeDebounceTimer: any = null;
function handleStreetInput() {
  updateFullAddress();
  if (geocodeDebounceTimer) clearTimeout(geocodeDebounceTimer);
  geocodeDebounceTimer = setTimeout(() => {
    triggerGeocode(false);
  }, 500);
}

async function triggerGeocode(immediate = false) {
  if (geocodeDebounceTimer && immediate) clearTimeout(geocodeDebounceTimer);

  isGeocoding.value = true;
  try {
    const res = await smartGeocodeAddress(
      streetAddress.value,
      selectedWard.value,
      selectedDistrict.value,
      selectedProvince.value
    );

    formLat.value = res.lat;
    formLng.value = res.lng;
    geocodeSource.value = res.source;

    updateMiniMapPosition();
  } catch (err) {
    console.warn('Geocoding error:', err);
  } finally {
    isGeocoding.value = false;
  }
}

function initMiniMap() {
  if (!miniMapContainer.value || typeof L === 'undefined') return;

  if (miniMapInstance) {
    try {
      miniMapInstance.remove();
    } catch (e) {}
    miniMapInstance = null;
    miniMapMarker = null;
  }

  miniMapInstance = L.map(miniMapContainer.value, {
    center: [formLat.value, formLng.value],
    zoom: 14,
    zoomControl: false,
  });

  L.control.zoom({ position: 'bottomright' }).addTo(miniMapInstance);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap',
  }).addTo(miniMapInstance);

  const customIcon = L.divIcon({
    className: 'custom-minimap-marker',
    html: `
      <div class="minimap-pin-wrapper">
        <div class="pin-ring"></div>
        <div class="pin-core">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
          </svg>
        </div>
      </div>
    `,
    iconSize: [36, 42],
    iconAnchor: [18, 40],
  });

  miniMapMarker = L.marker([formLat.value, formLng.value], {
    icon: customIcon,
    draggable: true,
  }).addTo(miniMapInstance);

  // Kéo thả marker để tinh chỉnh tọa độ
  miniMapMarker.on('dragend', (e: any) => {
    const pos = e.target.getLatLng();
    formLat.value = Number(pos.lat.toFixed(6));
    formLng.value = Number(pos.lng.toFixed(6));
    geocodeSource.value = 'manual';
  });

  // Click trên bản đồ để di chuyển vị trí
  miniMapInstance.on('click', (e: any) => {
    const lat = Number(e.latlng.lat.toFixed(6));
    const lng = Number(e.latlng.lng.toFixed(6));
    formLat.value = lat;
    formLng.value = lng;
    geocodeSource.value = 'manual';
    if (miniMapMarker) {
      miniMapMarker.setLatLng([lat, lng]);
    }
  });

  setTimeout(() => {
    if (miniMapInstance) {
      miniMapInstance.invalidateSize();
    }
  }, 200);
}

function updateMiniMapPosition() {
  if (miniMapMarker && miniMapInstance) {
    miniMapMarker.setLatLng([formLat.value, formLng.value]);
    miniMapInstance.flyTo([formLat.value, formLng.value], 14, { duration: 0.6 });
  }
}

function parseExistingAddress(addr: string) {
  if (!addr) return;
  const raw = addr.toLowerCase();

  // Tìm Tỉnh
  const foundProv = VIETNAM_PROVINCES.find((p) => {
    const cleanName = p.name.replace('Tỉnh ', '').replace('Thành phố ', '').toLowerCase();
    return raw.includes(p.name.toLowerCase()) || raw.includes(cleanName);
  });

  if (foundProv) {
    selectedProvince.value = foundProv.name;

    // Tìm Huyện
    const foundDist = foundProv.districts.find((d) => {
      const cleanName = d.name.replace('Huyện ', '').replace('Thị xã ', '').replace('Thành phố ', '').replace('Quận ', '').toLowerCase();
      return raw.includes(d.name.toLowerCase()) || raw.includes(cleanName);
    });

    if (foundDist) {
      selectedDistrict.value = foundDist.name;

      // Tìm Xã
      const foundWard = foundDist.wards.find((w) => {
        const cleanName = w.name.replace('Xã ', '').replace('Phường ', '').replace('Thị trấn ', '').toLowerCase();
        return raw.includes(w.name.toLowerCase()) || raw.includes(cleanName);
      });

      if (foundWard) {
        selectedWard.value = foundWard.name;
      }
    }
  }

  // Tách lấy street address
  const tokens = addr.split(',').map((t) => t.trim());
  if (tokens.length > 0) {
    streetAddress.value = tokens[0];
  } else {
    streetAddress.value = addr;
  }
}

function openAddModal() {
  isEditing.value = false;
  editingId.value = '';
  formCode.value = '';
  formName.value = '';
  formShortName.value = '';
  formType.value = 'farm';
  showManualCoords.value = false;
  geocodeSource.value = 'administrative';

  // Mặc định vùng Bình Phước - Đồng Phú
  selectedProvince.value = 'Tỉnh Bình Phước';
  selectedDistrict.value = 'Huyện Đồng Phú';
  selectedWard.value = 'Xã Tân Lập';
  streetAddress.value = 'Đường nội bộ nông trường cao su';
  formLat.value = 11.5120;
  formLng.value = 106.6025;
  formDescription.value = '';
  updateFullAddress();

  showModal.value = true;

  nextTick(() => {
    initMiniMap();
    triggerGeocode(true);
  });
}

function openEditModal(hub: HubLocation) {
  isEditing.value = true;
  editingId.value = hub.id;
  formCode.value = hub.code;
  formName.value = hub.name;
  formShortName.value = hub.shortName;
  formType.value = hub.type;
  formLat.value = hub.lat;
  formLng.value = hub.lng;
  formAddress.value = hub.address;
  formDescription.value = hub.description;
  showManualCoords.value = false;
  geocodeSource.value = 'manual';

  parseExistingAddress(hub.address);

  showModal.value = true;

  nextTick(() => {
    initMiniMap();
  });
}

function closeModal() {
  showModal.value = false;
  if (miniMapInstance) {
    try {
      miniMapInstance.remove();
    } catch (e) {}
    miniMapInstance = null;
    miniMapMarker = null;
  }
}

function handleSaveHub() {
  if (!formCode.value || !formName.value) {
    dialog.showWarning('Vui lòng nhập đầy đủ Mã trạm và Tên điểm trạm!', 'Thiếu Thông Tin Bắt Buộc', 'Kiểm tra lại');
    return;
  }

  // Đảm bảo địa chỉ đầy đủ được đồng bộ
  updateFullAddress();

  const hubData: HubLocation = {
    id: isEditing.value ? editingId.value : formCode.value.toUpperCase().trim(),
    code: formCode.value.toUpperCase().trim(),
    name: formName.value.trim(),
    shortName: formShortName.value.trim() || formName.value.trim(),
    type: formType.value,
    lat: Number(formLat.value),
    lng: Number(formLng.value),
    address: formAddress.value.trim() || 'Nông trường ECOTECH 2A',
    description: formDescription.value.trim(),
  };

  const isEdit = isEditing.value;
  if (isEditing.value) {
    updateEcotechHub(hubData);
  } else {
    addEcotechHub(hubData);
  }

  refreshHubs();
  closeModal();
  dialog.showSuccess(
    `Điểm trạm [${hubData.name}] đã được ${isEdit ? 'cập nhật' : 'thêm mới'} thành công!`,
    isEdit ? 'Cập Nhật Thành Công' : 'Thêm Điểm Trạm Thành Công'
  );
}

function handleDeleteHub(hub: HubLocation) {
  dialog.showConfirm({
    title: 'Xác Nhận Xóa Điểm Trạm',
    message: `Bạn có chắc chắn muốn xóa điểm trạm [${hub.code}] ${hub.name} khỏi hệ thống?`,
    confirmText: 'Xác Nhận Xóa',
    onConfirm: () => {
      deleteEcotechHub(hub.id);
      refreshHubs();
      dialog.showSuccess(`Đã xóa điểm trạm [${hub.name}] thành công!`, 'Xóa Thành Công');
    },
  });
}

// Bản đồ xem vị trí các trạm
const mapContainer = ref<HTMLElement | null>(null);
const mapInstance = ref<any>(null);
let hubMarkers: any[] = [];

function initMap() {
  if (!mapContainer.value) return;

  if (mapInstance.value) {
    try {
      mapInstance.value.remove();
    } catch (e) {}
    mapInstance.value = null;
  }

  mapInstance.value = safeInitMap(mapContainer.value, {
    center: [11.5400, 106.6200],
    zoom: 12,
    zoomControl: false,
  });

  L.control.zoom({ position: 'bottomright' }).addTo(mapInstance.value);

  createTileLayer('osm').addTo(mapInstance.value);

  renderHubsOnMap();
}

function getHubColor(type: HubType): string {
  if (type === 'weigh_station') return '#0284c7';
  if (type === 'factory') return '#ea580c';
  if (type === 'office') return '#4f46e5';
  return '#15803d'; // farm
}

function renderHubsOnMap() {
  if (!mapInstance.value || typeof L === 'undefined') return;

  hubMarkers.forEach((m) => {
    try {
      mapInstance.value.removeLayer(m);
    } catch (e) {}
  });
  hubMarkers = [];

  hubsList.value.forEach((hub) => {
    const iconBg = getHubColor(hub.type);

    const customIcon = L.divIcon({
      className: 'custom-hub-icon',
      html: `
        <div class="hub-marker-wrapper" style="--hub-color: ${iconBg}">
          <div class="hub-pin"><span class="hub-code">${hub.code}</span></div>
          <div class="hub-label">${hub.shortName}</div>
        </div>
      `,
      iconSize: [100, 48],
      iconAnchor: [50, 34],
    });

    const marker = L.marker([hub.lat, hub.lng], { icon: customIcon }).addTo(mapInstance.value);

    const popupHtml = `
      <div class="map-popup-card">
        <div class="popup-header">
          <span class="popup-tag tag-${hub.type}">${hub.code}</span>
          <h4 class="popup-title">${hub.name}</h4>
        </div>
        <p class="popup-desc">${hub.description || 'Điểm nút mạng lưới sản xuất'}</p>
        <div class="popup-info">
          <div>📍 ${hub.address}</div>
          <div>🌐 GPS: ${hub.lat.toFixed(4)}, ${hub.lng.toFixed(4)}</div>
        </div>
      </div>
    `;
    marker.bindPopup(popupHtml, { maxWidth: 280, className: 'custom-leaflet-popup' });
    hubMarkers.push(marker);
  });
}

function focusHub(hub: HubLocation) {
  if (mapInstance.value) {
    mapInstance.value.flyTo([hub.lat, hub.lng], 14, { duration: 0.8 });
  }
}

function resetMapView() {
  if (mapInstance.value) {
    mapInstance.value.flyTo([11.5400, 106.6200], 12, { duration: 0.8 });
  }
}

function handleStorageEvent(e: StorageEvent) {
  if (e.key === 'qldv_hubs') {
    refreshHubs();
  }
}

onMounted(() => {
  refreshHubs();
  window.addEventListener('storage', handleStorageEvent);
  nextTick(() => {
    initMap();
  });
});

onUnmounted(() => {
  window.removeEventListener('storage', handleStorageEvent);
  if (mapInstance.value) {
    mapInstance.value.remove();
    mapInstance.value = null;
  }
});
</script>

<template>
  <div class="hubs-page">
    <div class="page-header">
      <div>
        <h1 class="page-title">Danh Mục Điểm Trạm & Đội Sản Xuất (Hubs)</h1>
        <p class="page-subtitle">
          Quản lý các điểm trạm cân, vườn cây cao su, nhà máy chế biến và văn phòng kèm tọa độ GPS cố định để kết nối tuyến đường quy chuẩn
        </p>
      </div>

      <button class="btn btn-primary" @click="openAddModal">
        <Plus :size="16" />
        <span>Thêm Điểm Trạm Mới</span>
      </button>
    </div>

    <!-- Bản đồ trực quan vị trí GPS của các trạm -->
    <div class="card mb-4 p-0 overflow-hidden">
      <div class="map-card-header">
        <div class="map-card-title">
          <Compass :size="16" class="text-primary" />
          <span>Sơ Đồ Tọa Độ GPS Toàn Bộ Điểm Trạm & Đội (Bình Phước)</span>
        </div>
        <button class="btn btn-secondary btn-sm" @click="resetMapView" title="Về toàn cảnh">
          <RefreshCw :size="14" />
          <span>Về trung tâm</span>
        </button>
      </div>
      <div ref="mapContainer" class="hubs-map-canvas"></div>
    </div>

    <!-- 3. Bảng danh sách chi tiết các điểm trạm -->
    <div class="card">
      <div class="card-header flex-between">
        <div class="flex-center gap-2">
          <h3 class="card-title">Danh Sách Điểm Trạm Cố Định</h3>
          <span class="badge-total">{{ filteredHubs.length }} điểm</span>
        </div>

        <div class="search-box">
          <Search :size="14" class="search-icon" />
          <input
            v-model="searchQuery"
            type="text"
            class="form-input search-input"
            placeholder="Tìm theo mã, tên, địa chỉ..."
          />
        </div>
      </div>

      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th>Mã Trạm</th>
              <th>Tên Điểm Trạm</th>
              <th>Loại Điểm Nút</th>
              <th>Tọa Độ GPS (Vĩ độ, Kinh độ)</th>
              <th>Địa Chỉ</th>
              <th>Mô Tả Chức Năng</th>
              <th class="text-center">Thao Tác</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="hub in filteredHubs" :key="hub.id">
              <td>
                <span class="hub-code-badge" :style="{ backgroundColor: getHubColor(hub.type) }">
                  {{ hub.code }}
                </span>
              </td>
              <td>
                <strong>{{ hub.name }}</strong>
                <span class="text-muted text-xs d-block">Tên ngắn: {{ hub.shortName }}</span>
              </td>
              <td>
                <span class="type-pill" :class="'type-' + hub.type">
                  <Scale v-if="hub.type === 'weigh_station'" :size="12" />
                  <Trees v-else-if="hub.type === 'farm'" :size="12" />
                  <Factory v-else-if="hub.type === 'factory'" :size="12" />
                  <Building2 v-else :size="12" />
                  <span>
                    {{
                      hub.type === 'weigh_station'
                        ? 'Trạm Cân'
                        : hub.type === 'farm'
                        ? 'Đội'
                        : hub.type === 'factory'
                        ? 'Nhà Máy'
                        : 'Văn Phòng'
                    }}
                  </span>
                </span>
              </td>
              <td>
                <code class="gps-code">{{ hub.lat.toFixed(4) }}, {{ hub.lng.toFixed(4) }}</code>
              </td>
              <td class="text-sm">{{ hub.address }}</td>
              <td class="text-muted text-xs max-w-desc">{{ hub.description }}</td>
              <td class="text-center">
                <div class="actions-group">
                  <button
                    class="btn-action text-primary"
                    @click="focusHub(hub)"
                    title="Định vị trên bản đồ"
                  >
                    <MapPin :size="15" />
                  </button>
                  <button
                    class="btn-action text-info"
                    @click="openEditModal(hub)"
                    title="Chỉnh sửa thông tin"
                  >
                    <Edit2 :size="15" />
                  </button>
                  <button
                    class="btn-action text-danger"
                    @click="handleDeleteHub(hub)"
                    title="Xóa điểm trạm"
                  >
                    <Trash2 :size="15" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 4. Modal Thêm / Sửa Điểm Trạm -->
    <div v-if="showModal" class="modal-backdrop" @click.self="showModal = false">
      <div class="modal-content modal-lg">
        <div class="modal-header">
          <h3 class="modal-title">
            <MapPin :size="20" class="text-primary" />
            <span>{{ isEditing ? 'Chỉnh Sửa Điểm Trạm' : 'Thêm Điểm Trạm Mới Vào Mạng Lưới' }}</span>
          </h3>
          <button class="btn-close" @click="showModal = false">
            <X :size="18" />
          </button>
        </div>

        <div class="modal-body">
          <div class="grid-2">
            <div class="form-group">
              <label class="form-label">Mã viết tắt (Hub Code) <span class="required">*</span></label>
              <input
                v-model="formCode"
                type="text"
                class="form-input font-bold"
                placeholder="VD: TC2, D4, KHO1..."
                :disabled="isEditing"
              />
            </div>

            <div class="form-group">
              <label class="form-label">Loại điểm trạm <span class="required">*</span></label>
              <select v-model="formType" class="form-select">
                <option value="weigh_station">Trạm cân tiếp nhận mủ tươi</option>
                <option value="farm">Đội khai thác cao su</option>
                <option value="factory">Nhà máy chế biến mủ</option>
                <option value="office">Văn phòng / Trung tâm hành chính</option>
              </select>
            </div>
          </div>

          <div class="grid-2">
            <div class="form-group">
              <label class="form-label">Tên đầy đủ của điểm trạm <span class="required">*</span></label>
              <input
                v-model="formName"
                type="text"
                class="form-input"
                placeholder="VD: Trạm Cân 2 (Khu Tây Tân Lập)"
              />
            </div>

            <div class="form-group">
              <label class="form-label">Tên rút gọn hiển thị bản đồ <span class="required">*</span></label>
              <input
                v-model="formShortName"
                type="text"
                class="form-input font-bold"
                placeholder="VD: Trạm Cân 2"
              />
            </div>
          </div>

          <!-- Khu vực chọn địa chỉ hành chính & Định vị vị trí -->
          <div class="admin-location-box">
            <div class="section-badge-title">
              <Globe :size="14" class="text-primary" />
              <span>ĐỊA CHỈ HÀNH CHÍNH & VỊ TRÍ ĐỊNH VỊ</span>
            </div>

            <!-- Hàng 1: Tỉnh / Thành phố - Quận / Huyện - Phường / Xã -->
            <div class="grid-3 mb-2">
              <div class="form-group mb-0">
                <label class="form-label">Tỉnh / Thành phố <span class="required">*</span></label>
                <select
                  v-model="selectedProvince"
                  @change="handleProvinceChange"
                  class="form-select font-semibold"
                >
                  <option v-for="prov in VIETNAM_PROVINCES" :key="prov.id" :value="prov.name">
                    {{ prov.name }}
                  </option>
                </select>
              </div>

              <div class="form-group mb-0">
                <label class="form-label">Quận / Huyện <span class="required">*</span></label>
                <select
                  v-model="selectedDistrict"
                  @change="handleDistrictChange"
                  class="form-select font-semibold"
                >
                  <option v-for="dist in currentDistricts" :key="dist.id" :value="dist.name">
                    {{ dist.name }}
                  </option>
                </select>
              </div>

              <div class="form-group mb-0">
                <label class="form-label">Phường / Xã / Thị trấn <span class="required">*</span></label>
                <select
                  v-model="selectedWard"
                  @change="handleWardChange"
                  class="form-select font-semibold"
                >
                  <option v-for="ward in currentWards" :key="ward.id" :value="ward.name">
                    {{ ward.name }}
                  </option>
                </select>
              </div>
            </div>

            <!-- Hàng 2: Địa chỉ cụ thể + Nút Định Vị -->
            <div class="form-group mb-2">
              <label class="form-label">
                Địa chỉ chi tiết (Số nhà, tên đường, ấp/thôn, tiểu khu nông trường...)
              </label>
              <div class="address-input-wrapper">
                <input
                  v-model="streetAddress"
                  @input="handleStreetInput"
                  type="text"
                  class="form-input"
                  placeholder="VD: Ấp Suối Đôi, đường ĐT 741, Lô 18 Nông trường Cao su..."
                />
                <button
                  type="button"
                  class="btn-locate-action"
                  @click="triggerGeocode(true)"
                  :disabled="isGeocoding"
                  title="Kích hoạt định vị GPS theo địa chỉ này"
                >
                  <Loader2 v-if="isGeocoding" :size="15" class="spin" />
                  <LocateFixed v-else :size="15" />
                  <span>{{ isGeocoding ? 'Đang bắt...' : 'Bắt vị trí GPS' }}</span>
                </button>
              </div>
            </div>

            <!-- Hàng 3: Khung hiển thị Tọa độ GPS đã bắt được & Mini Map tương tác -->
            <div class="gps-detected-card">
              <div class="gps-card-header">
                <div class="gps-status-info">
                  <span class="pulse-dot"></span>
                  <span class="gps-label">Tọa độ GPS định vị:</span>
                  <code class="gps-badge">📍 {{ formLat.toFixed(4) }}, {{ formLng.toFixed(4) }}</code>
                  <span class="source-tag" :class="'source-' + geocodeSource">
                    {{
                      geocodeSource === 'nominatim'
                        ? 'Vệ tinh OpenStreetMap'
                        : geocodeSource === 'manual'
                        ? 'Chỉnh ghim thủ công'
                        : 'Hành chính quy chuẩn'
                    }}
                  </span>
                </div>

                <button
                  type="button"
                  class="btn-toggle-manual"
                  @click="showManualCoords = !showManualCoords"
                >
                  <Sliders :size="13" />
                  <span>{{ showManualCoords ? 'Ẩn tọa độ' : 'Tùy chỉnh số GPS' }}</span>
                  <ChevronUp v-if="showManualCoords" :size="13" />
                  <ChevronDown v-else :size="13" />
                </button>
              </div>

              <!-- Ô số tọa độ tùy chỉnh nếu mở rộng -->
              <div v-if="showManualCoords" class="grid-2 manual-inputs-row">
                <div class="form-group mb-0">
                  <label class="form-label text-xs">Vĩ độ GPS (Latitude)</label>
                  <input
                    v-model.number="formLat"
                    @input="updateMiniMapPosition"
                    type="number"
                    step="0.0001"
                    class="form-input form-input-sm font-bold"
                  />
                </div>
                <div class="form-group mb-0">
                  <label class="form-label text-xs">Kinh độ GPS (Longitude)</label>
                  <input
                    v-model.number="formLng"
                    @input="updateMiniMapPosition"
                    type="number"
                    step="0.0001"
                    class="form-input form-input-sm font-bold"
                  />
                </div>
              </div>

              <!-- Chuỗi địa chỉ hoàn chỉnh -->
              <div class="full-addr-display">
                <Navigation :size="14" class="text-primary flex-shrink-0" />
                <span><strong>Địa chỉ hoàn chỉnh:</strong> {{ formAddress || 'Chưa xác định' }}</span>
              </div>

              <!-- Mini Leaflet Map -->
              <div class="modal-map-container">
                <div ref="miniMapContainer" class="mini-map-canvas"></div>
                <div class="mini-map-helper">
                  <Sparkles :size="13" class="text-amber-500 flex-shrink-0" />
                  <span>
                    Bản đồ đã tự động bắt vị trí. Bạn có thể <strong>click trên bản đồ nhỏ này</strong> hoặc <strong>kéo thả ghim đỏ</strong> để tinh chỉnh chính xác từng mét.
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Mô tả đặc điểm và chức năng điều vận</label>
            <textarea
              v-model="formDescription"
              rows="2"
              class="form-textarea"
              placeholder="VD: Tiếp nhận mủ ca chiều, có 2 bàn cân điện tử 80 tấn..."
            ></textarea>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn btn-secondary" @click="closeModal">Hủy</button>
          <button class="btn btn-primary" @click="handleSaveHub">
            <CheckCircle2 :size="16" />
            <span>Lưu Điểm Trạm</span>
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

/* Map card */
.map-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 18px;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
}

.map-card-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.8125rem;
  font-weight: 800;
  color: #0f172a;
}

.hubs-map-canvas {
  width: 100%;
  height: 280px;
  background: #f8fafc;
}

/* Table */
.hub-code-badge {
  display: inline-block;
  padding: 3px 8px;
  border-radius: 4px;
  color: #ffffff;
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 0.05em;
}

.type-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 8px;
  border-radius: 9999px;
  font-size: 0.6875rem;
  font-weight: 700;
}
.type-weigh_station { background: #e0f2fe; color: #0369a1; }
.type-farm { background: #dcfce7; color: #15803d; }
.type-factory { background: #ffedd5; color: #c2410c; }
.type-office { background: #ede9fe; color: #6d28d9; }

.gps-code {
  background: #f1f5f9;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.75rem;
  font-family: monospace;
  color: #334155;
  font-weight: 600;
}

.max-w-desc {
  max-width: 250px;
  white-space: normal;
  line-height: 1.4;
}

.actions-group {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.btn-action {
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 5px;
  border-radius: 4px;
  transition: all 0.15s;
}
.btn-action:hover {
  background: #f1f5f9;
}
.text-danger { color: #dc2626; }
.text-info { color: #0284c7; }

/* Search box */
.search-box {
  position: relative;
  display: flex;
  align-items: center;
  width: 240px;
}
.search-icon {
  position: absolute;
  left: 9px;
  color: #94a3b8;
  pointer-events: none;
}
.search-input {
  padding-left: 28px !important;
  font-size: 0.8125rem;
}

.badge-total {
  background: #e2e8f0;
  color: #475569;
  font-weight: 700;
  font-size: 0.75rem;
  padding: 3px 8px;
  border-radius: 6px;
}

.flex-between { display: flex; justify-content: space-between; align-items: center; }
.flex-center { display: flex; align-items: center; }
.gap-2 { gap: 8px; }
.text-center { text-align: center; }
.font-bold { font-weight: 700; }
.font-semibold { font-weight: 600; }
.text-primary { color: #15803d; }
.text-muted { color: var(--text-muted); }
.text-xs { font-size: 0.75rem; }
.text-sm { font-size: 0.8125rem; }
.d-block { display: block; }
.mb-0 { margin-bottom: 0 !important; }
.mb-2 { margin-bottom: 10px !important; }
.mb-4 { margin-bottom: 20px; }
.p-0 { padding: 0 !important; }
.overflow-hidden { overflow: hidden; }
.flex-shrink-0 { flex-shrink: 0; }
.text-amber-500 { color: #f59e0b; }

/* Grid 3 columns */
.grid-3 {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

@media (max-width: 640px) {
  .grid-3 {
    grid-template-columns: 1fr;
  }
}

/* Administrative Location Box */
.admin-location-box {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 14px;
  margin-bottom: 14px;
}

.section-badge-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.75rem;
  font-weight: 800;
  color: #15803d;
  letter-spacing: 0.05em;
  margin-bottom: 10px;
}

.address-input-wrapper {
  display: flex;
  gap: 8px;
  align-items: center;
}

.btn-locate-action {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #15803d;
  color: #ffffff;
  border: none;
  padding: 8px 14px;
  border-radius: 6px;
  font-size: 0.8125rem;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s;
}

.btn-locate-action:hover:not(:disabled) {
  background: #166534;
  box-shadow: 0 2px 6px rgba(21, 128, 61, 0.3);
}

.btn-locate-action:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

/* GPS Detected Card */
.gps-detected-card {
  background: #ffffff;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 12px;
  margin-top: 10px;
}

.gps-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
}

.gps-status-info {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.pulse-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #16a34a;
  box-shadow: 0 0 0 3px rgba(22, 163, 74, 0.25);
  animation: pulse-ring 1.5s infinite;
}

@keyframes pulse-ring {
  0% { box-shadow: 0 0 0 0 rgba(22, 163, 74, 0.6); }
  70% { box-shadow: 0 0 0 6px rgba(22, 163, 74, 0); }
  100% { box-shadow: 0 0 0 0 rgba(22, 163, 74, 0); }
}

.gps-label {
  font-size: 0.75rem;
  font-weight: 700;
  color: #334155;
}

.gps-badge {
  background: #f0fdf4;
  color: #15803d;
  border: 1px solid #bbf7d0;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.8125rem;
  font-weight: 800;
  letter-spacing: 0.02em;
}

.source-tag {
  font-size: 0.6875rem;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 4px;
}
.source-nominatim { background: #e0f2fe; color: #0369a1; }
.source-manual { background: #fef3c7; color: #b45309; }
.source-administrative { background: #f1f5f9; color: #475569; }

.btn-toggle-manual {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: transparent;
  border: 1px solid #cbd5e1;
  color: #64748b;
  font-size: 0.6875rem;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-toggle-manual:hover {
  background: #f1f5f9;
  color: #0f172a;
}

.manual-inputs-row {
  background: #f8fafc;
  padding: 8px 10px;
  border-radius: 6px;
  border: 1px dashed #cbd5e1;
  margin-bottom: 8px;
}

.form-input-sm {
  padding: 5px 8px !important;
  font-size: 0.75rem !important;
}

.full-addr-display {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  font-size: 0.75rem;
  color: #475569;
  background: #f8fafc;
  padding: 6px 10px;
  border-radius: 6px;
  margin-bottom: 10px;
  line-height: 1.4;
}

/* Modal Map Container */
.modal-map-container {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.mini-map-canvas {
  width: 100%;
  height: 180px;
  border-radius: 8px;
  border: 1px solid #cbd5e1;
  background: #f1f5f9;
  z-index: 1;
}

.mini-map-helper {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  font-size: 0.6875rem;
  color: #64748b;
  line-height: 1.4;
}

/* Mini map pin animation */
.custom-minimap-marker {
  position: relative;
}

.minimap-pin-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #dc2626;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.25));
  cursor: grab;
}

.minimap-pin-wrapper:active {
  cursor: grabbing;
}

.pin-ring {
  position: absolute;
  bottom: 0px;
  width: 14px;
  height: 6px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.3);
  transform: translateY(18px);
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
