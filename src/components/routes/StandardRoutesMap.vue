<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch, nextTick } from 'vue';
import type { HubLocation, RoutePath } from '@/types/map';
import { ECOTECH_HUBS, ECOTECH_ROUTES, calculateHaversineKm, addEcotechRoute } from '@/mocks/mapData';
import { useFleetStore } from '@/stores/fleet';
import { useDialogStore } from '@/stores/dialog';
import {
  MapPin,
  RefreshCw,
  Maximize2,
  Minimize2,
  Search,
  Plus,
  Compass,
  CheckCircle2,
  Navigation,
  ChevronRight,
  ShieldCheck,
  X,
} from 'lucide-vue-next';

// Declare Leaflet global loaded from CDN
declare const L: any;

const props = defineProps<{
  initialSelectedRouteCode?: string;
}>();

const emit = defineEmits<{
  (e: 'routeSelected', routeCode: string): void;
}>();

const fleetStore = useFleetStore();
const dialog = useDialogStore();

//=============================================================================
// 1. STATE & COMPUTED
//=============================================================================
const mapContainer = ref<HTMLElement | null>(null);
const mapInstance = ref<any>(null);
const isFullScreen = ref(false);
const mapStyle = ref<'osm' | 'topo'>('osm');
const searchQuery = ref('');
const selectedRouteCode = ref<string | null>(props.initialSelectedRouteCode || null);

// Danh sách các tuyến từ ECOTECH_ROUTES
const routesList = computed(() => {
  return ECOTECH_ROUTES;
});

// Lọc tuyến đường theo từ khóa tìm kiếm
const filteredRoutes = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  if (!q) return routesList.value;
  return routesList.value.filter(
    (r) =>
      r.code.toLowerCase().includes(q) ||
      r.name.toLowerCase().includes(q) ||
      r.from.name.toLowerCase().includes(q) ||
      r.to.name.toLowerCase().includes(q)
  );
});

// Tuyến đường đang được chọn
const selectedRoute = computed(() => {
  if (!selectedRouteCode.value) return null;
  return routesList.value.find((r) => r.code === selectedRouteCode.value) || null;
});

// Đồng bộ khi prop tuyến được chọn từ bên ngoài thay đổi
watch(
  () => props.initialSelectedRouteCode,
  (newCode) => {
    if (newCode) {
      selectRoute(newCode);
    } else {
      resetMapView();
    }
  }
);

// Thống kê nhanh
const totalStandardKm = computed(() => {
  return routesList.value.reduce((sum, r) => sum + r.distanceKm, 0);
});
const avgDistanceKm = computed(() => {
  if (!routesList.value.length) return 0;
  return Number((totalStandardKm.value / routesList.value.length).toFixed(1));
});

// Layers Leaflet
let tileLayer: any = null;
let routePolylines: any[] = [];
let hubMarkers: any[] = [];
let resizeObserver: ResizeObserver | null = null;

//=============================================================================
// 2. MODAL CÀI ĐẶT TUYẾN ĐƯỜNG MỚI VỚI GPS
//=============================================================================
const showAddModal = ref(false);
const newFromHubId = ref<string>(ECOTECH_HUBS[0].id);
const newToHubId = ref<string>(ECOTECH_HUBS[1].id);
const newRouteCode = ref('');
const newRouteName = ref('');
const newDistanceKm = ref<number>(26.0);
const newDescription = ref('');
const newIsRoundTrip = ref(true);

function onFromToHubChange() {
  const fromHub = ECOTECH_HUBS.find((h) => h.id === newFromHubId.value);
  const toHub = ECOTECH_HUBS.find((h) => h.id === newToHubId.value);
  if (!fromHub || !toHub) return;

  const codeSuffix = newIsRoundTrip.value ? `-${fromHub.code}` : '';
  newRouteCode.value = `${fromHub.code}-${toHub.code}${codeSuffix}`;
  newRouteName.value = `${fromHub.shortName} ➔ ${toHub.shortName}${newIsRoundTrip.value ? ` ➔ ${fromHub.shortName}` : ''}`;

  // Tính cự ly ước tính theo GPS (km)
  const calcKm = calculateHaversineKm(fromHub.lat, fromHub.lng, toHub.lat, toHub.lng);
  newDistanceKm.value = newIsRoundTrip.value ? Number((calcKm * 2).toFixed(1)) : calcKm;
}

watch([newFromHubId, newToHubId, newIsRoundTrip], () => {
  onFromToHubChange();
});

function openAddRouteModal() {
  newFromHubId.value = ECOTECH_HUBS[0].id;
  newToHubId.value = ECOTECH_HUBS[1].id;
  newIsRoundTrip.value = true;
  newDescription.value = 'Tuyến quy chuẩn chở mủ nông trường về trạm tiếp nhận';
  onFromToHubChange();
  showAddModal.value = true;
}

function handleSaveNewRoute() {
  if (!newRouteCode.value || !newRouteName.value) {
    dialog.showWarning('Vui lòng nhập đầy đủ mã tuyến đường và tên tuyến quy chuẩn!', 'Thiếu Thông Tin Tuyến', 'Kiểm tra lại');
    return;
  }

  const fromHub = ECOTECH_HUBS.find((h) => h.id === newFromHubId.value) || ECOTECH_HUBS[0];
  const toHub = ECOTECH_HUBS.find((h) => h.id === newToHubId.value) || ECOTECH_HUBS[1];

  // Tạo các mốc GPS trung gian mô phỏng chân thực
  const midLat1 = fromHub.lat + (toHub.lat - fromHub.lat) * 0.35 + (Math.random() - 0.5) * 0.006;
  const midLng1 = fromHub.lng + (toHub.lng - fromHub.lng) * 0.35 + (Math.random() - 0.5) * 0.006;
  const midLat2 = fromHub.lat + (toHub.lat - fromHub.lat) * 0.7 + (Math.random() - 0.5) * 0.006;
  const midLng2 = fromHub.lng + (toHub.lng - fromHub.lng) * 0.7 + (Math.random() - 0.5) * 0.006;

  const generatedWaypoints: [number, number][] = [
    [fromHub.lat, fromHub.lng],
    [Number(midLat1.toFixed(4)), Number(midLng1.toFixed(4))],
    [Number(midLat2.toFixed(4)), Number(midLng2.toFixed(4))],
    [toHub.lat, toHub.lng],
  ];

  const newRouteObj: RoutePath = {
    id: Date.now(),
    code: newRouteCode.value.toUpperCase().trim(),
    name: newRouteName.value.trim(),
    from: fromHub,
    to: toHub,
    distanceKm: Number(newDistanceKm.value),
    waypoints: generatedWaypoints,
  };

  // Thêm vào danh mục bản đồ GIS
  addEcotechRoute(newRouteObj);

  // Thêm vào FleetStore
  fleetStore.addRoute({
    routeCode: newRouteObj.code,
    name: newRouteObj.name,
    startPoint: fromHub.shortName,
    endPoint: toHub.shortName,
    standardDistanceKm: newRouteObj.distanceKm,
    description: newDescription.value.trim(),
  });

  showAddModal.value = false;

  // Chọn ngay tuyến vừa tạo và vẽ lên bản đồ
  selectRoute(newRouteObj.code);
  dialog.showSuccess(`Đã lưu và thiết lập tuyến đường quy chuẩn "${newRouteObj.name}" (${newRouteObj.code}) thành công!`, 'Lưu Tuyến Thành Công');
}

//=============================================================================
// 3. KHỞI TẠO BẢN ĐỒ LEAFLET
//=============================================================================
function initMap() {
  if (!mapContainer.value || typeof L === 'undefined') return;

  mapInstance.value = L.map(mapContainer.value, {
    center: [11.5400, 106.6200],
    zoom: 12,
    zoomControl: false,
    preferCanvas: true,
  });

  L.control.zoom({ position: 'bottomright' }).addTo(mapInstance.value);

  mapInstance.value.on('zoomend', () => {
    if (mapInstance.value) {
      mapInstance.value.invalidateSize();
    }
  });

  updateTileLayer();
  renderHubMarkers();
  renderRoutes();

  setTimeout(() => {
    if (mapInstance.value) {
      mapInstance.value.invalidateSize();
    }
  }, 120);
  setTimeout(() => {
    if (mapInstance.value) {
      mapInstance.value.invalidateSize();
    }
  }, 350);

  if (selectedRouteCode.value) {
    focusRoute(selectedRouteCode.value);
  }
}

function updateTileLayer() {
  if (!mapInstance.value || typeof L === 'undefined') return;
  if (tileLayer) mapInstance.value.removeLayer(tileLayer);

  if (mapStyle.value === 'osm') {
    tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap | ECOTECH 2A Fleet GIS',
    });
  } else {
    tileLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      attribution: '&copy; CartoDB & OpenStreetMap | ECOTECH 2A',
    });
  }
  tileLayer.addTo(mapInstance.value);
}

watch(mapStyle, () => {
  updateTileLayer();
});

//=============================================================================
// 4. VẼ CÁC TRẠM (HUBS)
//=============================================================================
function getHubIconHtml(hub: HubLocation) {
  let iconBg = '#15803d';
  if (hub.type === 'weigh_station') iconBg = '#0284c7';
  else if (hub.type === 'factory') iconBg = '#ea580c';
  else if (hub.type === 'office') iconBg = '#4f46e5';

  return `
    <div class="hub-marker-wrapper" style="--hub-color: ${iconBg}">
      <div class="hub-pin"><span class="hub-code">${hub.code}</span></div>
      <div class="hub-label">${hub.shortName}</div>
    </div>
  `;
}

function renderHubMarkers() {
  if (!mapInstance.value || typeof L === 'undefined') return;

  hubMarkers.forEach((m) => {
    try {
      mapInstance.value.removeLayer(m);
    } catch (err) {}
  });
  hubMarkers = [];

  // Khi đang chọn 1 tuyến đường cụ thể:
  // Điểm đi (A) và điểm đến (B) đã được biểu diễn trực quan qua Pin A và Pin B trong renderRoutes().
  // Ẩn toàn bộ các trạm khác trên mạng lưới để chỉ hiển thị duy nhất tuyến đang chọn, tránh chồng lấn và rối mắt.
  if (selectedRouteCode.value) {
    return;
  }

  ECOTECH_HUBS.forEach((hub) => {
    const customIcon = L.divIcon({
      className: 'custom-hub-icon',
      html: getHubIconHtml(hub),
      iconSize: [0, 0],
      iconAnchor: [0, 0],
    });

    const marker = L.marker([hub.lat, hub.lng], { icon: customIcon }).addTo(mapInstance.value);

    const popupContent = `
      <div class="map-popup-card">
        <div class="popup-header">
          <span class="popup-tag tag-${hub.type}">${hub.code}</span>
          <h4 class="popup-title">${hub.name}</h4>
        </div>
        <p class="popup-desc">${hub.description}</p>
        <div class="popup-info">
          <div>📍 ${hub.address}</div>
          <div>🌐 GPS: ${hub.lat.toFixed(4)}, ${hub.lng.toFixed(4)}</div>
        </div>
      </div>
    `;

    marker.bindPopup(popupContent, { maxWidth: 280, className: 'custom-leaflet-popup' });
    hubMarkers.push(marker);
  });
}

//=============================================================================
// 5. VẼ CÁC TUYẾN ĐƯỜNG QUY CHUẨN
//=============================================================================
function renderRoutes() {
  if (!mapInstance.value || typeof L === 'undefined') return;

  routePolylines.forEach((layer) => {
    try {
      mapInstance.value.removeLayer(layer);
    } catch (err) {}
  });
  routePolylines = [];

  // TRƯỜNG HỢP 1: ĐANG CHỌN 1 TUYẾN CỤ THỂ
  if (selectedRouteCode.value) {
    const route = ECOTECH_ROUTES.find((r) => r.code === selectedRouteCode.value);
    if (route && route.waypoints && route.waypoints.length > 0) {
      const activeWaypoints: [number, number][] = route.waypoints.map((wp) => [wp[0], wp[1]]);

      // 1. Viền sáng phát quang (Glow)
      const glowLine = L.polyline(activeWaypoints, {
        color: '#22c55e',
        weight: 12,
        opacity: 0.45,
        lineCap: 'round',
      }).addTo(mapInstance.value);

      // 2. Tuyến đường chính
      const mainLine = L.polyline(activeWaypoints, {
        color: '#15803d',
        weight: 6,
        opacity: 1,
        lineCap: 'round',
      }).addTo(mapInstance.value);

      // 3. Vạch chỉ hướng đứt đoạn trắng
      const animatedLine = L.polyline(activeWaypoints, {
        color: '#ffffff',
        weight: 2.5,
        opacity: 0.95,
        dashArray: '10, 14',
        lineCap: 'round',
      }).addTo(mapInstance.value);

      routePolylines.push(glowLine, mainLine, animatedLine);

      // 4. PIN ĐIỂM ĐẦU (A - XUẤT PHÁT) - Ghim chính xác đầu mút đầu tiên của tuyến
      const originPoint = activeWaypoints[0];
      const originShort = route.from?.shortName || 'Điểm Đi';
      const originIcon = L.divIcon({
        className: 'route-endpoint-divicon',
        html: `
          <div class="route-pin-node is-start">
            <div class="pin-pill">
              <span class="pin-letter">A</span>
              <span class="pin-text">Điểm đi: <strong>${originShort}</strong></span>
            </div>
            <div class="pin-anchor-dot"></div>
          </div>
        `,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });
      const originMarker = L.marker(originPoint, { icon: originIcon, zIndexOffset: 2500 }).addTo(mapInstance.value);
      routePolylines.push(originMarker);

      // 5. PIN ĐIỂM CUỐI (B - ĐÍCH ĐẾN) - Ghim chính xác đầu mút cuối cùng của tuyến
      const destPoint = activeWaypoints[activeWaypoints.length - 1];
      const destShort = route.to?.shortName || 'Điểm Đến';
      const destIcon = L.divIcon({
        className: 'route-endpoint-divicon',
        html: `
          <div class="route-pin-node is-end">
            <div class="pin-pill">
              <span class="pin-letter">B</span>
              <span class="pin-text">Điểm đến: <strong>${destShort}</strong></span>
            </div>
            <div class="pin-anchor-dot"></div>
          </div>
        `,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });
      const destMarker = L.marker(destPoint, { icon: destIcon, zIndexOffset: 2500 }).addTo(mapInstance.value);
      routePolylines.push(destMarker);

      // 6. CÁC MŨI TÊN CHỈ HƯỚNG DI CHUYỂN DỌC TUYẾN ĐƯỜNG (›)
      for (let i = 0; i < activeWaypoints.length - 1; i++) {
        const p1 = activeWaypoints[i];
        const p2 = activeWaypoints[i + 1];
        const midLat = (p1[0] + p2[0]) / 2;
        const midLng = (p1[1] + p2[1]) / 2;

        const dLng = p2[1] - p1[1];
        const dLat = p2[0] - p1[0];
        const angleDeg = (Math.atan2(-dLat, dLng) * 180) / Math.PI;

        const arrowIcon = L.divIcon({
          className: 'route-arrow-divicon',
          html: `<div class="route-direction-arrow" style="transform: rotate(${angleDeg}deg);">›</div>`,
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        });
        const arrowMarker = L.marker([midLat, midLng], { icon: arrowIcon, zIndexOffset: 1200 }).addTo(mapInstance.value);
        routePolylines.push(arrowMarker);
      }
    }
    return;
  }

  // TRƯỜNG HỢP 2: HIỂN THỊ TOÀN BỘ MẠNG LƯỚI TUYẾN ĐƯỜNG
  ECOTECH_ROUTES.forEach((r, idx) => {
    if (!r.waypoints || r.waypoints.length === 0) return;

    // Màu sắc hài hòa cho mạng lưới
    const colors = ['#0284c7', '#16a34a', '#d97706', '#9333ea', '#e11d48'];
    const lineColor = colors[idx % colors.length];

    const line = L.polyline(r.waypoints, {
      color: lineColor,
      weight: 4,
      opacity: 0.75,
      dashArray: '6, 6',
      lineCap: 'round',
    }).addTo(mapInstance.value);

    line.on('click', () => {
      selectRoute(r.code);
    });

    line.bindTooltip(
      `<strong>${r.code}</strong>: ${r.name} (${r.distanceKm} km)`,
      { sticky: true, className: 'route-leaflet-tooltip' }
    );

    routePolylines.push(line);
  });
}

//=============================================================================
// 6. TƯƠNG TÁC CHỌN VÀ ZOOM TUYẾN ĐƯỜNG
//=============================================================================
function selectRoute(code: string) {
  if (selectedRouteCode.value === code) {
    resetMapView();
    return;
  }

  selectedRouteCode.value = code;
  emit('routeSelected', code);
  renderRoutes();
  renderHubMarkers();
  focusRoute(code);
}

function focusRoute(code: string) {
  if (!mapInstance.value) return;
  mapInstance.value.invalidateSize();
  const targetRoute = ECOTECH_ROUTES.find((r) => r.code === code);
  if (targetRoute && targetRoute.waypoints && targetRoute.waypoints.length > 0) {
    mapInstance.value.fitBounds(targetRoute.waypoints, {
      padding: [100, 90],
      maxZoom: 13,
    });
  }
}

function resetMapView() {
  selectedRouteCode.value = null;
  renderRoutes();
  renderHubMarkers();
  if (mapInstance.value) {
    mapInstance.value.invalidateSize();
    mapInstance.value.flyTo([11.5400, 106.6200], 12, { duration: 0.8 });
  }
}

function toggleFullScreen() {
  isFullScreen.value = !isFullScreen.value;
  nextTick(() => {
    if (mapInstance.value) {
      mapInstance.value.invalidateSize();
    }
  });
}

// Expose phương thức chọn tuyến từ bên ngoài
defineExpose({
  selectRoute,
  openAddRouteModal,
  resetMapView,
});

onMounted(() => {
  const checkLeaflet = setInterval(() => {
    if (typeof L !== 'undefined') {
      clearInterval(checkLeaflet);
      initMap();
    }
  }, 200);

  setTimeout(() => clearInterval(checkLeaflet), 5000);

  if (mapContainer.value && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => {
      if (mapInstance.value) {
        mapInstance.value.invalidateSize();
      }
    });
    resizeObserver.observe(mapContainer.value);
  }
});

onUnmounted(() => {
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
  if (mapInstance.value) {
    mapInstance.value.remove();
    mapInstance.value = null;
  }
});
</script>

<template>
  <div class="fleet-map-wrapper" :class="{ 'is-fullscreen': isFullScreen }">
    <!-- 1. Thanh điều khiển Top Bar -->
    <div class="map-top-bar">
      <div class="top-bar-left">
        <div class="status-indicator">
          <span class="live-dot"></span>
          <span class="live-text">BẢN ĐỒ GPS TUYẾN ĐƯỜNG QUY CHUẨN</span>
        </div>

        <div class="metrics-chips">
          <span class="chip chip-green">
            <Compass :size="13" />
            <strong>{{ routesList.length }}</strong> tuyến quy chuẩn
          </span>
          <span class="chip chip-blue">
            <MapPin :size="13" />
            <strong>{{ ECOTECH_HUBS.length }}</strong> trạm nông trường
          </span>
          <span class="chip chip-purple">
            <Navigation :size="13" />
            TB: <strong>{{ avgDistanceKm }} km</strong> / tuyến
          </span>
        </div>
      </div>

      <div class="top-bar-right">
        <!-- Chế độ bản đồ -->
        <div class="layer-toggle">
          <button
            class="btn-layer"
            :class="{ active: mapStyle === 'osm' }"
            @click="mapStyle = 'osm'"
            title="Bản đồ giao thông OSM"
          >
            Giao thông
          </button>
          <button
            class="btn-layer"
            :class="{ active: mapStyle === 'topo' }"
            @click="mapStyle = 'topo'"
            title="Bản đồ địa hình nông trường"
          >
            Địa hình
          </button>
        </div>

        <button class="btn btn-primary btn-sm btn-add-route" @click="openAddRouteModal">
          <Plus :size="14" />
          <span>Cài Đặt Tuyến Mới</span>
        </button>

        <!-- Reset View & Toàn màn hình -->
        <button class="btn-icon" @click="resetMapView" title="Về toàn cảnh mạng lưới">
          <RefreshCw :size="16" />
        </button>
        <button class="btn-icon" @click="toggleFullScreen" title="Toàn màn hình">
          <Maximize2 v-if="!isFullScreen" :size="16" />
          <Minimize2 v-else :size="16" />
        </button>
      </div>
    </div>

    <!-- 2. Banner hiển thị khi đang focus 1 tuyến cụ thể -->
    <div v-if="selectedRoute" class="active-vehicle-bar">
      <div class="active-veh-info">
        <span class="active-veh-badge">
          <ShieldCheck :size="14" />
          <span>Mã tuyến: <strong>{{ selectedRoute.code }}</strong></span>
        </span>
        <span class="active-veh-route">
          📍 <strong>{{ selectedRoute.from.shortName }}</strong>
          ➔
          🏁 <strong>{{ selectedRoute.to.shortName }}</strong>
        </span>
        <span class="active-veh-km">
          (Cự ly quy chuẩn: <strong>{{ selectedRoute.distanceKm }} km</strong> — {{ selectedRoute.waypoints.length }} mốc GPS)
        </span>
      </div>
      <button class="btn-clear-selection" @click="resetMapView">
        ✕ Bỏ chọn / Hiện toàn bộ mạng lưới
      </button>
    </div>

    <!-- 3. Khung chính: Bản đồ Leaflet + Side Panel danh sách tuyến -->
    <div class="map-body-container">
      <!-- Container chứa Leaflet Map -->
      <div ref="mapContainer" class="leaflet-map-canvas"></div>

      <!-- Chú giải sơ đồ (Legend overlay - Tự động thích ứng theo chế độ Tổng thể hoặc Tuyến đang chọn) -->
      <div v-if="!selectedRoute" class="map-legend-card">
        <h5 class="legend-title">Mạng Lưới Nông Trường</h5>
        <div class="legend-item">
          <span class="legend-icon icon-station">TC1</span>
          <span>Trạm cân tiếp nhận</span>
        </div>
        <div class="legend-item">
          <span class="legend-icon icon-farm">D1-3</span>
          <span>Nông trường cao su Đội 1, 2, 3</span>
        </div>
        <div class="legend-item">
          <span class="legend-icon icon-factory">NM</span>
          <span>Nhà máy chế biến mủ</span>
        </div>
        <div class="legend-item">
          <span class="legend-line"></span>
          <span>Tuyến quy chuẩn</span>
        </div>
      </div>

      <div v-else class="map-legend-card single-vehicle-legend">
        <h5 class="legend-title">Sơ Đồ Tuyến {{ selectedRoute.code }}</h5>
        <div class="legend-item">
          <span class="legend-icon icon-start-pin">A</span>
          <span>Điểm đi: <strong>{{ selectedRoute.from.shortName }}</strong></span>
        </div>
        <div class="legend-item">
          <span class="legend-icon icon-end-pin">B</span>
          <span>Điểm đến: <strong>{{ selectedRoute.to.shortName }}</strong></span>
        </div>
        <div class="legend-item">
          <span class="legend-line line-running"></span>
          <span>Cự ly quy chuẩn ({{ selectedRoute.distanceKm }} km)</span>
        </div>
      </div>

      <!-- Panel danh sách tuyến bên phải -->
      <div class="side-fleet-panel">
        <div class="panel-header">
          <div class="panel-title-wrap">
            <h4 class="panel-title">Danh Mục Tuyến Chuẩn</h4>
            <span class="panel-count-tag">{{ filteredRoutes.length }} tuyến</span>
          </div>

          <!-- Thanh tìm kiếm tuyến -->
          <div class="search-box-wrap">
            <Search :size="14" class="search-icon" />
            <input
              v-model="searchQuery"
              type="text"
              class="panel-search-input"
              placeholder="Tìm mã hoặc tên tuyến..."
            />
          </div>
        </div>

        <div class="routes-list-scroll">
          <div
            v-for="route in filteredRoutes"
            :key="route.id"
            class="route-card-item"
            :class="{ 'is-active': selectedRouteCode === route.code }"
            @click="selectRoute(route.code)"
          >
            <div class="route-card-top">
              <span class="route-code-badge">{{ route.code }}</span>
              <span class="route-dist-badge">{{ route.distanceKm }} km</span>
            </div>

            <h5 class="route-card-name">{{ route.name }}</h5>

            <div class="route-hub-steps">
              <div class="hub-step">
                <span class="dot from"></span>
                <span>{{ route.from.shortName }}</span>
              </div>
              <span class="step-arrow">➔</span>
              <div class="hub-step">
                <span class="dot to"></span>
                <span>{{ route.to.shortName }}</span>
              </div>
            </div>

            <div class="route-card-footer">
              <span class="gps-pts-count">🌐 {{ route.waypoints.length }} tọa độ GPS</span>
              <span class="btn-inspect-route">
                <span>{{ selectedRouteCode === route.code ? 'Đang hiển thị' : 'Xem GPS' }}</span>
                <ChevronRight :size="14" />
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 4. Modal Cài Đặt / Thêm Tuyến Đường Quy Chuẩn (GPS Interactive) -->
    <div v-if="showAddModal" class="modal-backdrop" @click.self="showAddModal = false">
      <div class="modal-content modal-lg">
        <div class="modal-header">
          <h3 class="modal-title">
            <MapPin :size="20" class="text-primary" />
            <span>Cài Đặt Tuyến Đường Quy Chuẩn</span>
          </h3>
          <button class="btn-close" @click="showAddModal = false">
            <X :size="18" />
          </button>
        </div>

        <div class="modal-body">
          <div class="alert alert-info mb-3">
            <ShieldCheck :size="18" />
            <span>
              Cự ly quy chuẩn được khóa cứng để chống gian lận ODO và tự động tính định mức nhiên liệu tiêu chuẩn.
            </span>
          </div>

          <div class="grid-2 section-box">
            <div class="form-group">
              <label class="form-label">Điểm xuất phát (Hub A) <span class="required">*</span></label>
              <select v-model="newFromHubId" class="form-select">
                <option v-for="h in ECOTECH_HUBS" :key="h.id" :value="h.id">
                  [{{ h.code }}] {{ h.name }} ({{ h.address }})
                </option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Điểm đích (Hub B) <span class="required">*</span></label>
              <select v-model="newToHubId" class="form-select">
                <option v-for="h in ECOTECH_HUBS" :key="h.id" :value="h.id">
                  [{{ h.code }}] {{ h.name }} ({{ h.address }})
                </option>
              </select>
            </div>
          </div>

          <div class="form-check-wrap mt-2 mb-3">
            <label class="checkbox-label">
              <input v-model="newIsRoundTrip" type="checkbox" />
              <span>Tuyến khứ hồi (Xuất phát ➔ Đích ➔ Quay về bến xuất phát)</span>
            </label>
          </div>

          <div class="grid-2 route-metrics-row">
            <div class="form-group">
              <label class="form-label">Mã tuyến quy chuẩn <span class="required">*</span></label>
              <input v-model="newRouteCode" type="text" class="form-input font-bold" placeholder="VD: TC1-D3-TC1" />
            </div>

            <div class="form-group">
              <label class="form-label distance-label-row">
                <span>Cự ly chuẩn (km) <span class="required">*</span></span>
                <span v-if="newIsRoundTrip" class="distance-mode-tag mode-round">Đã tính Khứ hồi (Đi + Về)</span>
                <span v-else class="distance-mode-tag mode-oneway">Cự ly 1 chiều</span>
              </label>
              <div class="input-with-hint">
                <input v-model.number="newDistanceKm" type="number" step="0.5" class="form-input font-bold text-end" />
                <span class="unit-tag">km</span>
              </div>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Tên tuyến đường <span class="required">*</span></label>
            <input v-model="newRouteName" type="text" class="form-input" placeholder="VD: Trạm cân 1 ➔ Nông trường Đội 3" />
          </div>

          <div class="form-group">
            <label class="form-label">Mô tả đặc điểm cung đường & quy định vận tải</label>
            <textarea
              v-model="newDescription"
              rows="2"
              class="form-textarea"
              placeholder="VD: Đường đất đỏ nội bộ nông trường, dốc nhẹ, mùa mưa cần giảm tốc độ..."
            ></textarea>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn btn-secondary" @click="showAddModal = false">Hủy</button>
          <button class="btn btn-primary" @click="handleSaveNewRoute">
            <CheckCircle2 :size="16" />
            <span>Lưu & Vẽ Lên Bản Đồ GPS</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.fleet-map-wrapper {
  background: #ffffff;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
  display: flex;
  flex-direction: column;
  margin-bottom: 24px;
}

.fleet-map-wrapper.is-fullscreen {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 9999;
  border-radius: 0;
  margin: 0;
}

/* Top Bar */
.map-top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  background: #0f172a;
  color: #ffffff;
  gap: 12px;
  flex-wrap: wrap;
}

.top-bar-left {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
}

.live-dot {
  width: 9px;
  height: 9px;
  background: #22c55e;
  border-radius: 50%;
  box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.3);
  animation: pulse-dot 1.8s infinite;
}

@keyframes pulse-dot {
  0% { transform: scale(0.95); opacity: 0.8; }
  50% { transform: scale(1.15); opacity: 1; }
  100% { transform: scale(0.95); opacity: 0.8; }
}

.live-text {
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 0.05em;
  color: #f8fafc;
}

.metrics-chips {
  display: flex;
  align-items: center;
  gap: 8px;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 0.6875rem;
  padding: 3px 8px;
  border-radius: 9999px;
  background: #1e293b;
  color: #94a3b8;
}

.chip strong {
  color: #ffffff;
}

.chip-green strong { color: #4ade80; }
.chip-blue strong { color: #38bdf8; }
.chip-purple strong { color: #c084fc; }

.top-bar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn-add-route {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  font-size: 0.75rem;
  font-weight: 700;
}

.layer-toggle {
  display: flex;
  background: #1e293b;
  border-radius: 6px;
  padding: 2px;
}

.btn-layer {
  background: transparent;
  border: none;
  color: #94a3b8;
  font-size: 0.6875rem;
  font-weight: 600;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-layer.active {
  background: #334155;
  color: #ffffff;
}

.btn-icon {
  background: #1e293b;
  border: 1px solid #334155;
  color: #94a3b8;
  width: 32px;
  height: 32px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-icon:hover {
  background: #334155;
  color: #ffffff;
}

/* Active Route Bar */
.active-vehicle-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  background: #f0fdf4;
  border-bottom: 1px solid #bbf7d0;
  color: #166534;
  font-size: 0.8125rem;
}

.active-veh-info {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.active-veh-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #dcfce7;
  padding: 3px 8px;
  border-radius: 6px;
  font-weight: 700;
  color: #15803d;
}

.active-veh-route {
  color: #334155;
}

.active-veh-km strong {
  color: #15803d;
}

.btn-clear-selection {
  background: #ffffff;
  border: 1px solid #cbd5e1;
  color: #64748b;
  font-size: 0.75rem;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-clear-selection:hover {
  background: #fee2e2;
  color: #dc2626;
  border-color: #fca5a5;
}

/* Main Canvas Body */
.map-body-container {
  display: flex;
  height: 520px;
  position: relative;
}

.is-fullscreen .map-body-container {
  height: calc(100vh - 52px);
}

.leaflet-map-canvas {
  flex: 1;
  height: 100%;
  background: #f8fafc;
}

/* Side Panel */
.side-fleet-panel {
  width: 340px;
  background: #ffffff;
  border-left: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  z-index: 10;
}

.panel-header {
  padding: 12px 14px;
  border-bottom: 1px solid #f1f5f9;
  background: #f8fafc;
}

.panel-title-wrap {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.panel-title {
  font-size: 0.8125rem;
  font-weight: 800;
  color: #0f172a;
  margin: 0;
}

.panel-count-tag {
  font-size: 0.6875rem;
  font-weight: 700;
  background: #e2e8f0;
  color: #475569;
  padding: 2px 6px;
  border-radius: 4px;
}

.search-box-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 9px;
  color: #94a3b8;
  pointer-events: none;
}

.panel-search-input {
  width: 100%;
  padding: 6px 10px 6px 28px;
  font-size: 0.75rem;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  outline: none;
  transition: border-color 0.2s;
}

.panel-search-input:focus {
  border-color: #15803d;
}

.routes-list-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.route-card-item {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 10px 12px;
  background: #ffffff;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.route-card-item:hover {
  border-color: #86efac;
  background: #f0fdf4;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.route-card-item.is-active {
  border-color: #16a34a;
  background: #f0fdf4;
  box-shadow: 0 0 0 2px rgba(22, 163, 74, 0.2);
}

.route-card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.route-code-badge {
  font-size: 0.6875rem;
  font-weight: 800;
  background: #e2e8f0;
  color: #0f172a;
  padding: 2px 6px;
  border-radius: 4px;
}

.route-dist-badge {
  font-size: 0.75rem;
  font-weight: 800;
  background: #dcfce7;
  color: #15803d;
  padding: 2px 8px;
  border-radius: 12px;
}

.route-card-name {
  font-size: 0.75rem;
  font-weight: 700;
  color: #1e293b;
  margin: 0;
}

.route-hub-steps {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.6875rem;
  color: #64748b;
  background: #f8fafc;
  padding: 4px 8px;
  border-radius: 6px;
}

.hub-step {
  display: flex;
  align-items: center;
  gap: 4px;
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}
.dot.from { background: #0284c7; }
.dot.to { background: #dc2626; }

.step-arrow {
  color: #cbd5e1;
  font-size: 0.625rem;
}

.route-card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 2px;
  font-size: 0.6875rem;
}

.gps-pts-count {
  color: #94a3b8;
}

.btn-inspect-route {
  color: #15803d;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 2px;
}

/* Legend Overlay */
.map-legend-card {
  position: absolute;
  bottom: 20px;
  left: 20px;
  background: rgba(255, 255, 255, 0.94);
  backdrop-filter: blur(8px);
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 10px 14px;
  z-index: 1000;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.08);
  font-size: 0.6875rem;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.legend-title {
  font-size: 0.75rem;
  font-weight: 800;
  color: #0f172a;
  margin: 0 0 4px 0;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #475569;
}

.legend-icon {
  font-size: 0.5625rem;
  font-weight: 800;
  color: #ffffff;
  padding: 1px 4px;
  border-radius: 3px;
}
.icon-station { background: #0284c7; }
.icon-farm { background: #15803d; }
.icon-factory { background: #ea580c; }

.legend-line {
  width: 18px;
  height: 4px;
  background: #16a34a;
  border-radius: 2px;
}

.line-running {
  background: #15803d;
  box-shadow: 0 0 6px rgba(34, 197, 94, 0.6);
}

.icon-start-pin {
  background: #0284c7;
  font-weight: 800;
  border-radius: 50%;
  width: 16px;
  height: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.icon-end-pin {
  background: #dc2626;
  font-weight: 800;
  border-radius: 50%;
  width: 16px;
  height: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.single-vehicle-legend {
  border-left: 3px solid #15803d;
}

/* Modal Styling */
.form-check-wrap {
  background: #f8fafc;
  padding: 10px 12px;
  border-radius: 6px;
  border: 1px solid #e2e8f0;
}
.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.8125rem;
  font-weight: 600;
  color: #334155;
  cursor: pointer;
}
.input-with-hint {
  position: relative;
  display: flex;
  align-items: center;
}
.unit-tag {
  position: absolute;
  right: 12px;
  font-size: 0.75rem;
  font-weight: 700;
  color: #94a3b8;
  pointer-events: none;
}
.text-end { text-align: right; }
.font-bold { font-weight: 700; }
.btn-close { background: transparent; border: none; cursor: pointer; color: #64748b; }
.alert { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-radius: 6px; }
.alert-info { background: #eff6ff; border: 1px solid #bfdbfe; color: #1e40af; }

.btn-quick-add {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  color: #166534;
  font-size: 0.6875rem;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s;
}
.btn-quick-add:hover {
  background: #dcfce7;
  border-color: #16a34a;
}
.quick-hub-backdrop {
  z-index: 10050 !important;
}
.modal-md {
  max-width: 520px;
}
.mb-0 { margin-bottom: 0 !important; }
.mb-1 { margin-bottom: 4px !important; }

.route-metrics-row {
  margin-top: 0;
  margin-bottom: 0;
  align-items: flex-start;
}
.route-metrics-row .form-group {
  margin-bottom: 12px;
}

.distance-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}
.distance-mode-tag {
  font-size: 0.6875rem;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 4px;
}
.mode-round {
  background: #eff6ff;
  color: #1d4ed8;
  border: 1px solid #bfdbfe;
}
.mode-oneway {
  background: #f1f5f9;
  color: #475569;
  border: 1px solid #cbd5e1;
}
</style>
