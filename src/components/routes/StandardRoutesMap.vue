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
  Trash2,
} from 'lucide-vue-next';
import L, { safeInitMap, createTileLayer } from '@/utils/leaflet';

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
// 2. MODAL CÀI ĐẶT TUYẾN ĐƯỜNG MỚI VỚI GPS (1 ĐIỂM ĐI -> NHIỀU ĐIỂM ĐẾN)
//=============================================================================
interface DestItem {
  hubId: string;
  distanceKm: number;
}

const showAddModal = ref(false);
const newFromHubId = ref<string>(ECOTECH_HUBS[0]?.id || '');
const newDestinations = ref<DestItem[]>([
  { hubId: ECOTECH_HUBS[1]?.id || '', distanceKm: 26.0 },
]);
const newIsRoundTrip = ref(false);
const newRouteCode = ref('');
const newRouteName = ref('');
const newTotalDistanceKm = ref<number>(26.0);
const newDescription = ref('');

function getHubShort(hubId: string): string {
  const h = ECOTECH_HUBS.find((item) => item.id === hubId);
  return h ? h.shortName : 'Điểm trước';
}

function addDestination() {
  const chosenIds = [newFromHubId.value, ...newDestinations.value.map((d) => d.hubId)];
  const nextHub = ECOTECH_HUBS.find((h) => !chosenIds.includes(h.id)) || ECOTECH_HUBS[newDestinations.value.length % ECOTECH_HUBS.length];

  const prevHubId = newDestinations.value.length > 0 ? newDestinations.value[newDestinations.value.length - 1].hubId : newFromHubId.value;
  const prevHub = ECOTECH_HUBS.find((h) => h.id === prevHubId) || ECOTECH_HUBS[0];
  const estKm = calculateHaversineKm(prevHub.lat, prevHub.lng, nextHub.lat, nextHub.lng);

  newDestinations.value.push({
    hubId: nextHub.id,
    distanceKm: estKm,
  });

  recalculateRouteInfo();
}

function removeDestination(index: number) {
  if (newDestinations.value.length <= 1) {
    dialog.showWarning('Tuyến đường phải có ít nhất 1 điểm đến!', 'Không Thể Xóa', 'Đã hiểu');
    return;
  }
  newDestinations.value.splice(index, 1);
  recalculateRouteInfo();
}

function recalculateRouteInfo() {
  const fromHub = ECOTECH_HUBS.find((h) => h.id === newFromHubId.value) || ECOTECH_HUBS[0];
  const destHubs = newDestinations.value.map((d) => ECOTECH_HUBS.find((h) => h.id === d.hubId) || ECOTECH_HUBS[0]);

  let runningHub = fromHub;
  let totalKm = 0;
  newDestinations.value.forEach((d) => {
    const currHub = ECOTECH_HUBS.find((h) => h.id === d.hubId);
    if (currHub) {
      const legKm = calculateHaversineKm(runningHub.lat, runningHub.lng, currHub.lat, currHub.lng);
      d.distanceKm = legKm;
      totalKm += legKm;
      runningHub = currHub;
    }
  });

  if (newIsRoundTrip.value && destHubs.length > 0) {
    const lastHub = destHubs[destHubs.length - 1];
    const returnKm = calculateHaversineKm(lastHub.lat, lastHub.lng, fromHub.lat, fromHub.lng);
    totalKm += returnKm;
  }

  newTotalDistanceKm.value = Number(totalKm.toFixed(1));

  const destCodes = destHubs.map((h) => h.code).join('-');
  const returnCode = newIsRoundTrip.value ? `-${fromHub.code}` : '';
  newRouteCode.value = `${fromHub.code}-${destCodes}${returnCode}`;

  const destNames = destHubs.map((h) => h.shortName).join(' ➔ ');
  const returnName = newIsRoundTrip.value ? ` ➔ ${fromHub.shortName}` : '';
  newRouteName.value = `${fromHub.shortName} ➔ ${destNames}${returnName}`;
}

function onLegDistanceChange() {
  const fromHub = ECOTECH_HUBS.find((h) => h.id === newFromHubId.value) || ECOTECH_HUBS[0];
  const destHubs = newDestinations.value.map((d) => ECOTECH_HUBS.find((h) => h.id === d.hubId) || ECOTECH_HUBS[0]);

  let sum = newDestinations.value.reduce((acc, cur) => acc + (Number(cur.distanceKm) || 0), 0);
  if (newIsRoundTrip.value && destHubs.length > 0) {
    const lastHub = destHubs[destHubs.length - 1];
    sum += calculateHaversineKm(lastHub.lat, lastHub.lng, fromHub.lat, fromHub.lng);
  }
  newTotalDistanceKm.value = Number(sum.toFixed(1));
}

function openAddRouteModal() {
  newFromHubId.value = ECOTECH_HUBS[0].id;
  newDestinations.value = [
    { hubId: ECOTECH_HUBS[1]?.id || '', distanceKm: 26.0 },
  ];
  newIsRoundTrip.value = false;
  newDescription.value = 'Tuyến quy chuẩn vận tải mủ cao su đa điểm đến';
  recalculateRouteInfo();
  showAddModal.value = true;
}

function handleSaveNewRoute() {
  if (!newRouteCode.value.trim() || !newRouteName.value.trim()) {
    dialog.showWarning('Vui lòng nhập đầy đủ mã tuyến và tên tuyến quy chuẩn!', 'Thiếu Thông Tin Tuyến', 'Kiểm tra lại');
    return;
  }

  const fromHub = ECOTECH_HUBS.find((h) => h.id === newFromHubId.value) || ECOTECH_HUBS[0];
  const destHubs = newDestinations.value.map((d) => ECOTECH_HUBS.find((h) => h.id === d.hubId) || ECOTECH_HUBS[0]);
  const lastDestHub = destHubs[destHubs.length - 1] || fromHub;

  const allStops = [fromHub, ...destHubs];
  if (newIsRoundTrip.value) {
    allStops.push(fromHub);
  }

  const generatedWaypoints: [number, number][] = [];
  for (let s = 0; s < allStops.length - 1; s++) {
    const pStart = allStops[s];
    const pEnd = allStops[s + 1];

    if (s === 0) {
      generatedWaypoints.push([pStart.lat, pStart.lng]);
    }

    const midLat1 = pStart.lat + (pEnd.lat - pStart.lat) * 0.35 + (Math.random() - 0.5) * 0.005;
    const midLng1 = pStart.lng + (pEnd.lng - pStart.lng) * 0.35 + (Math.random() - 0.5) * 0.005;
    const midLat2 = pStart.lat + (pEnd.lat - pStart.lat) * 0.7 + (Math.random() - 0.5) * 0.005;
    const midLng2 = pStart.lng + (pEnd.lng - pStart.lng) * 0.7 + (Math.random() - 0.5) * 0.005;

    generatedWaypoints.push(
      [Number(midLat1.toFixed(4)), Number(midLng1.toFixed(4))],
      [Number(midLat2.toFixed(4)), Number(midLng2.toFixed(4))],
      [pEnd.lat, pEnd.lng]
    );
  }

  const newRouteObj: RoutePath = {
    id: Date.now(),
    code: newRouteCode.value.toUpperCase().trim(),
    name: newRouteName.value.trim(),
    from: fromHub,
    to: lastDestHub,
    destinations: destHubs,
    stops: newDestinations.value.map((d) => ({
      hubId: d.hubId,
      hub: ECOTECH_HUBS.find((h) => h.id === d.hubId) || fromHub,
      distanceKm: d.distanceKm,
    })),
    isRoundTrip: newIsRoundTrip.value,
    distanceKm: Number(newTotalDistanceKm.value),
    waypoints: generatedWaypoints,
    description: newDescription.value.trim(),
  };

  addEcotechRoute(newRouteObj);

  fleetStore.addRoute({
    routeCode: newRouteObj.code,
    name: newRouteObj.name,
    startPoint: fromHub.shortName,
    endPoint: destHubs.map((h) => h.shortName).join(' ➔ ') + (newIsRoundTrip.value ? ` ➔ ${fromHub.shortName}` : ''),
    standardDistanceKm: newRouteObj.distanceKm,
    description: newDescription.value.trim(),
  });

  showAddModal.value = false;
  selectRoute(newRouteObj.code);
  dialog.showSuccess(
    `Đã thiết lập tuyến đường quy chuẩn 1 điểm đi ➔ ${destHubs.length} điểm đến (${newRouteObj.code}) thành công!`,
    'Cài Đặt Tuyến Thành Công'
  );
}

//=============================================================================
// 3. KHỞI TẠO BẢN ĐỒ LEAFLET
//=============================================================================
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
  if (!mapInstance.value) return;
  if (tileLayer) mapInstance.value.removeLayer(tileLayer);
  tileLayer = createTileLayer(mapStyle.value);
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
              <span class="pin-text">Xuất phát: <strong>${originShort}</strong></span>
            </div>
            <div class="pin-anchor-dot"></div>
          </div>
        `,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });
      const originMarker = L.marker(originPoint, { icon: originIcon, zIndexOffset: 2500 }).addTo(mapInstance.value);
      routePolylines.push(originMarker);

      // 5. PIN CÁC ĐIỂM ĐẾN (Hỗ trợ 1 điểm đi -> Nhiều điểm đến)
      if (route.destinations && route.destinations.length > 0) {
        route.destinations.forEach((destHub, idx) => {
          const isLast = idx === route.destinations!.length - 1;
          const letter = isLast && !route.isRoundTrip ? 'B' : String(idx + 1);
          const pinClass = isLast && !route.isRoundTrip ? 'is-end' : 'is-mid';
          const destIcon = L.divIcon({
            className: 'route-endpoint-divicon',
            html: `
              <div class="route-pin-node ${pinClass}">
                <div class="pin-pill">
                  <span class="pin-letter">${letter}</span>
                  <span class="pin-text">Đến: <strong>${destHub.shortName}</strong></span>
                </div>
                <div class="pin-anchor-dot"></div>
              </div>
            `,
            iconSize: [0, 0],
            iconAnchor: [0, 0],
          });
          const destMarker = L.marker([destHub.lat, destHub.lng], { icon: destIcon, zIndexOffset: 2400 }).addTo(mapInstance.value);
          routePolylines.push(destMarker);
        });
      } else {
        // Tuyến đơn 1 điểm đến (B)
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
      }

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
  invalidateSize: () => {
    if (mapInstance.value) mapInstance.value.invalidateSize();
  },
});

onMounted(() => {
  nextTick(() => {
    initMap();
  });

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
              <template v-if="route.destinations && route.destinations.length > 1">
                <template v-for="(dest, dIdx) in route.destinations" :key="dIdx">
                  <span class="step-arrow">➔</span>
                  <div class="hub-step">
                    <span class="dot" :class="dIdx === route.destinations.length - 1 && !route.isRoundTrip ? 'to' : 'mid'"></span>
                    <span>{{ dest.shortName }}</span>
                  </div>
                </template>
                <template v-if="route.isRoundTrip">
                  <span class="step-arrow">➔</span>
                  <div class="hub-step">
                    <span class="dot from"></span>
                    <span>{{ route.from.shortName }}</span>
                  </div>
                </template>
              </template>
              <template v-else>
                <span class="step-arrow">➔</span>
                <div class="hub-step">
                  <span class="dot to"></span>
                  <span>{{ route.to.shortName }}</span>
                </div>
              </template>
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

    <!-- 4. Modal Cài Đặt / Thêm Tuyến Đường Quy Chuẩn (1 Điểm Đi -> Nhiều Điểm Đến) -->
    <div v-if="showAddModal" class="modal-backdrop" @click.self="showAddModal = false">
      <div class="modal-content modal-xl route-config-modal">
        <div class="modal-header">
          <h3 class="modal-title">
            <MapPin :size="20" class="text-primary" />
            <span>Cài Đặt Tuyến Đường Quy Chuẩn (Đa Điểm Đến)</span>
          </h3>
          <button class="btn-close" @click="showAddModal = false">
            <X :size="18" />
          </button>
        </div>

        <div class="modal-body">
          <div class="alert alert-theme-notice">
            <ShieldCheck :size="18" class="text-primary" />
            <span>
              Hệ thống hỗ trợ cấu hình <strong>1 điểm xuất phát đi qua nhiều điểm đến</strong>. Cự ly chuẩn của từng chặng được khóa cứng tự động để tính định mức nhiên liệu và chống gian lận ODO.
            </span>
          </div>

          <!-- PHẦN 1: ĐIỂM XUẤT PHÁT -->
          <div class="route-config-card start-card">
            <div class="config-card-header">
              <span class="hub-type-badge origin-badge">A. ĐIỂM XUẤT PHÁT (GỐC)</span>
              <span class="text-xs text-muted">Trạm hoặc Đội bắt đầu hành trình</span>
            </div>
            <div class="form-group mb-0">
              <select v-model="newFromHubId" class="form-select font-bold" @change="recalculateRouteInfo">
                <option v-for="h in ECOTECH_HUBS" :key="h.id" :value="h.id">
                  [{{ h.code }}] {{ h.name }} — {{ h.address }}
                </option>
              </select>
            </div>
          </div>

          <!-- PHẦN 2: DANH SÁCH CÁC ĐIỂM ĐẾN (MULTI-DESTINATIONS) -->
          <div class="destinations-container">
            <div class="destinations-header flex-between">
              <div class="d-flex align-items-center gap-2">
                <span class="destinations-title">B. DANH SÁCH ĐIỂM ĐẾN ({{ newDestinations.length }} điểm đến)</span>
                <span class="badge badge-theme-tag">1 Điểm đi ➔ Nhiều Điểm đến</span>
              </div>
            </div>

            <div class="destinations-list">
              <div
                v-for="(dest, idx) in newDestinations"
                :key="idx"
                class="dest-row-card"
              >
                <div class="dest-step-indicator">
                  <div class="step-num">{{ idx + 1 }}</div>
                  <div class="step-line" v-if="idx < newDestinations.length - 1"></div>
                </div>

                <div class="dest-fields-grid">
                  <div class="dest-hub-select-wrap">
                    <label class="dest-field-label">
                      Điểm đến #{{ idx + 1 }}
                      <span class="text-xs text-muted">
                        (Từ {{ idx === 0 ? getHubShort(newFromHubId) : getHubShort(newDestinations[idx - 1].hubId) }})
                      </span>
                    </label>
                    <select
                      v-model="dest.hubId"
                      class="form-select"
                      @change="recalculateRouteInfo"
                    >
                      <option
                        v-for="h in ECOTECH_HUBS"
                        :key="h.id"
                        :value="h.id"
                        :disabled="h.id === newFromHubId && idx === 0"
                      >
                        [{{ h.code }}] {{ h.name }}
                      </option>
                    </select>
                  </div>

                  <div class="dest-km-wrap">
                    <label class="dest-field-label">Cự ly chặng</label>
                    <div class="input-with-hint">
                      <input
                        v-model.number="dest.distanceKm"
                        type="number"
                        step="0.5"
                        min="0.5"
                        class="form-input text-end"
                        @input="onLegDistanceChange"
                      />
                      <span class="unit-tag">km</span>
                    </div>
                  </div>

                  <div class="dest-actions-wrap" v-if="newDestinations.length > 1">
                    <button
                      type="button"
                      class="btn-icon-danger"
                      @click="removeDestination(idx)"
                      title="Xóa điểm đến này"
                    >
                      <Trash2 :size="15" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <button
              type="button"
              class="btn-add-dest-dashed w-100"
              @click="addDestination"
            >
              <Plus :size="15" />
              <span>+ Bổ sung thêm điểm đến tiếp theo trên tuyến</span>
            </button>
          </div>

          <!-- TÙY CHỌN KHỨ HỒI -->
          <div class="route-roundtrip-box" :class="{ 'is-active': newIsRoundTrip }">
            <label class="roundtrip-label-row">
              <input
                v-model="newIsRoundTrip"
                type="checkbox"
                class="roundtrip-checkbox"
                @change="recalculateRouteInfo"
              />
              <div class="roundtrip-body">
                <div class="roundtrip-headline">
                  <span class="roundtrip-title">Hành trình khứ hồi (2 chiều)</span>
                  <span v-if="newIsRoundTrip" class="badge badge-success">Khứ hồi kích hoạt</span>
                  <span v-else class="badge badge-secondary">Một chiều</span>
                </div>
                <div class="roundtrip-hint">
                  Sau khi đến điểm cuối, xe quay về lại điểm xuất phát ban đầu (<strong>{{ getHubShort(newFromHubId) }}</strong>) để hoàn tất một vòng vận chuyển.
                </div>
              </div>
            </label>
          </div>

          <!-- THÔNG SỐ TỔNG HỢP TOÀN TUYẾN -->
          <div class="route-summary-panel">
            <div class="summary-panel-header">
              <span class="summary-panel-title">C. THÔNG SỐ TỔNG HỢP TOÀN TUYẾN</span>
              <span class="summary-panel-badge">
                {{ newDestinations.length }} điểm đến{{ newIsRoundTrip ? ' + 1 chặng hồi' : '' }}
              </span>
            </div>

            <div class="summary-panel-body">
              <div class="summary-row-grid">
                <div class="form-group mb-0">
                  <label class="form-label">Mã tuyến tự động sinh <span class="required">*</span></label>
                  <input
                    v-model="newRouteCode"
                    type="text"
                    class="form-input summary-code-input"
                    placeholder="VD: TC1-D1-D2-TC1"
                  />
                  <div class="summary-field-hint">Mã định danh duy nhất của tuyến</div>
                </div>

                <div class="form-group mb-0">
                  <label class="form-label">Tổng cự ly quy chuẩn toàn tuyến <span class="required">*</span></label>
                  <div class="input-with-hint">
                    <input
                      v-model.number="newTotalDistanceKm"
                      type="number"
                      step="0.5"
                      class="form-input summary-distance-input text-end"
                    />
                    <span class="unit-tag font-bold">km</span>
                  </div>
                  <div class="summary-field-hint">Tổng cộng cự ly tất cả các chặng</div>
                </div>
              </div>

              <div class="form-group mb-0 mt-3">
                <label class="form-label">Tên cung đường hoàn chỉnh</label>
                <input
                  v-model="newRouteName"
                  type="text"
                  class="form-input summary-name-input"
                  placeholder="Hành trình xe di chuyển qua các điểm..."
                />
              </div>
            </div>
          </div>

          <!-- MÔ TẢ ĐẶC ĐIỂM TUYẾN ĐƯỜNG -->
          <div class="form-group route-desc-section">
            <label class="form-label">Mô tả đặc điểm tuyến đường & lưu ý kỹ thuật</label>
            <textarea
              v-model="newDescription"
              rows="3"
              class="form-textarea route-desc-textarea"
              placeholder="VD: Tuyến vận tải gom mủ liên nông trường, đường đất đỏ nội bộ có đoạn dốc nhẹ, chú ý an toàn mùa mưa..."
            ></textarea>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn btn-secondary" @click="showAddModal = false">Hủy</button>
          <button class="btn btn-primary" @click="handleSaveNewRoute">
            <CheckCircle2 :size="16" />
            <span>Lưu & Vẽ Tuyến Lên Bản Đồ GPS</span>
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
.alert-theme-notice {
  background: #f0fdf4;
  border: 1.5px solid #bbf7d0;
  color: #166534;
  font-size: 0.8125rem;
  padding: 12px 16px;
  border-radius: 10px;
  margin-bottom: 18px;
  line-height: 1.5;
}

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
  background: #f0fdf4;
  color: #15803d;
  border: 1px solid #bbf7d0;
}
.mode-oneway {
  background: #f1f5f9;
  color: #475569;
  border: 1px solid #cbd5e1;
}

/* Modal Wide Sizing */
.route-config-modal {
  max-width: 1080px !important;
  width: 95vw;
}
.route-config-modal .modal-header {
  padding: 18px 28px;
}
.route-config-modal .modal-body {
  padding: 22px 28px;
}
.route-config-modal .modal-footer {
  padding: 16px 28px;
}

/* Multi-destinations Configuration Styling */
.route-config-card {
  background: #f8fafc;
  border: 1.5px solid #d6e4d7;
  border-radius: 10px;
  padding: 16px;
  margin-bottom: 18px;
}
.start-card {
  border-left: 4px solid #15803d;
  background: #f0fdf4;
  border-color: #bbf7d0;
}
.config-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}
.hub-type-badge {
  font-size: 0.6875rem;
  font-weight: 800;
  padding: 3px 8px;
  border-radius: 4px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.origin-badge {
  background: #dcfce7;
  color: #15803d;
  border: 1px solid #86efac;
}
.destinations-container {
  background: #ffffff;
  border: 1.5px solid #d6e4d7;
  border-radius: 10px;
  padding: 16px 18px;
  margin-bottom: 20px;
}
.destinations-header {
  margin-bottom: 14px;
}
.badge-theme-tag {
  background: #f0fdf4;
  color: #15803d;
  border: 1px solid #bbf7d0;
  font-size: 0.6875rem;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 4px;
}
.destinations-title {
  font-size: 0.8125rem;
  font-weight: 800;
  color: #0c1a11;
}
.destinations-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 14px;
}
.dest-row-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 14px;
  background: #fcfdfc;
  border: 1.5px solid #d6e4d7;
  border-radius: 8px;
  transition: all 0.2s;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
}
.dest-row-card:hover {
  border-color: #86efac;
  background: #f0fdf4;
  box-shadow: 0 2px 8px rgba(21, 128, 61, 0.06);
}
.dest-step-indicator {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 28px;
  flex-shrink: 0;
}
.step-num {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: #15803d;
  color: #ffffff;
  font-size: 0.75rem;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
}
.step-line {
  width: 2px;
  height: 100%;
  background: #bbf7d0;
}
.dest-fields-grid {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 160px auto;
  gap: 16px;
  align-items: flex-end;
}
.dest-field-label {
  display: block;
  font-size: 0.75rem;
  font-weight: 700;
  color: #273e30;
  margin-bottom: 4px;
}
.btn-icon-danger {
  width: 34px;
  height: 34px;
  border-radius: 6px;
  border: 1px solid #fecaca;
  background: #fee2e2;
  color: #dc2626;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s;
}
.btn-icon-danger:hover {
  background: #fca5a5;
  color: #991b1b;
}
.btn-add-dest-dashed {
  background: transparent;
  border: 1.5px dashed #15803d;
  color: #15803d;
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 0.8125rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  cursor: pointer;
  transition: all 0.2s;
  margin-top: 6px;
  margin-bottom: 16px;
}
.btn-add-dest-dashed:hover {
  background: #f0fdf4;
  border-color: #166534;
  color: #166534;
}

/* Roundtrip Toggle Box */
.route-roundtrip-box {
  background: #fcfdfc;
  border: 1.5px solid #d6e4d7;
  border-radius: 10px;
  padding: 14px 16px;
  margin-bottom: 16px;
  transition: all 0.2s ease;
}
.route-roundtrip-box.is-active {
  background: #f0fdf4;
  border-color: #86efac;
  box-shadow: 0 2px 6px rgba(21, 128, 61, 0.08);
}
.roundtrip-label-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  cursor: pointer;
  margin: 0;
  width: 100%;
}
.roundtrip-checkbox {
  width: 18px;
  height: 18px;
  margin-top: 2px;
  cursor: pointer;
  accent-color: #15803d;
  flex-shrink: 0;
}
.roundtrip-body {
  flex: 1;
}
.roundtrip-headline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.roundtrip-title {
  font-size: 0.84rem;
  font-weight: 700;
  color: #0c1a11;
}
.roundtrip-hint {
  font-size: 0.75rem;
  color: #52705d;
  margin-top: 4px;
  line-height: 1.4;
}

/* Route Summary Panel */
.route-summary-panel {
  background: #fcfdfc;
  border: 1.5px solid #d6e4d7;
  border-radius: 10px;
  margin-bottom: 16px;
  overflow: hidden;
  box-shadow: 0 1px 4px rgba(21, 128, 61, 0.04);
}
.summary-panel-header {
  background: #f4f8f3;
  border-bottom: 1px solid #d6e4d7;
  padding: 10px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.summary-panel-title {
  font-size: 0.75rem;
  font-weight: 800;
  color: #1e3a24;
  letter-spacing: 0.03em;
  text-transform: uppercase;
}
.summary-panel-badge {
  font-size: 0.6875rem;
  font-weight: 700;
  color: #15803d;
  background: #dcfce7;
  padding: 3px 10px;
  border-radius: 6px;
  border: 1px solid #86efac;
}
.summary-panel-body {
  padding: 16px 18px;
}
.summary-row-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
.summary-code-input {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-weight: 700;
  color: #15803d;
  background: #ffffff;
  border: 1px solid #d6e4d7;
  padding: 10px 12px;
  border-radius: 8px;
}
.summary-code-input:focus {
  border-color: #15803d;
  box-shadow: 0 0 0 3px rgba(21, 128, 61, 0.15);
  outline: none;
}
.summary-distance-input {
  font-weight: 800;
  font-size: 1.05rem;
  color: #15803d;
  background: #ffffff;
  border: 1.5px solid #86efac;
  padding: 10px 38px 10px 12px;
  border-radius: 8px;
}
.summary-distance-input:focus {
  border-color: #15803d;
  box-shadow: 0 0 0 3px rgba(21, 128, 61, 0.15);
  outline: none;
}
.summary-name-input {
  font-weight: 600;
  color: #0c1a11;
  background: #ffffff;
  border: 1px solid #d6e4d7;
  padding: 10px 12px;
  border-radius: 8px;
}
.summary-name-input:focus {
  border-color: #15803d;
  box-shadow: 0 0 0 3px rgba(21, 128, 61, 0.15);
  outline: none;
}
.summary-field-hint {
  font-size: 0.6875rem;
  color: #52705d;
  margin-top: 4px;
}

/* Description Section */
.route-desc-section {
  margin-top: 16px;
  margin-bottom: 4px;
}
.route-desc-section .form-label {
  font-weight: 700;
  color: #1e3a24;
  font-size: 0.8125rem;
  margin-bottom: 6px;
  display: block;
}
.route-desc-textarea {
  min-height: 72px;
  padding: 10px 14px;
  border-radius: 8px;
  border: 1px solid #d6e4d7;
  font-size: 0.8125rem;
  line-height: 1.5;
  background: #ffffff;
}
.route-desc-textarea:focus {
  border-color: #15803d;
  box-shadow: 0 0 0 3px rgba(21, 128, 61, 0.15);
  outline: none;
  background: #ffffff;
}
.mt-3 {
  margin-top: 14px !important;
}
.dot.mid {
  background: #0284c7;
}
.route-pin-node.is-mid .pin-pill {
  background: #0284c7;
  color: #ffffff;
  border-color: #0284c7;
}
.route-pin-node.is-mid .pin-anchor-dot {
  border-top-color: #0284c7;
}
</style>
