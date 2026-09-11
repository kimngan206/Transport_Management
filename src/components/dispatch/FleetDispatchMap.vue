<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch, nextTick } from 'vue';
import type { HubLocation, VehicleMapState } from '@/types/map';
import { ECOTECH_HUBS, ECOTECH_ROUTES, initialVehicleMapStates } from '@/mocks/mapData';
import { getRoadRouteBetweenHubs } from '@/services/routingService';
import { useDispatchStore } from '@/stores/dispatch';
import { mockStorage } from '@/services/mockStorage';
import {
  Truck,
  MapPin,
  RefreshCw,
  Maximize2,
  Minimize2,
  CheckCircle2,
  ChevronRight,
  Search,
  Clock,
} from 'lucide-vue-next';
import L, { safeInitMap, createTileLayer } from '@/utils/leaflet';

//=============================================================================
// 1. KHỞI TẠO STATE & COMPUTED
//=============================================================================
const dispatchStore = useDispatchStore();
const mapContainer = ref<HTMLElement | null>(null);
const mapInstance = ref<any>(null);
const isFullScreen = ref(false);
const filterStatus = ref<'ALL' | 'RUNNING' | 'AVAILABLE' | 'MAINTENANCE'>('ALL');
const searchQuery = ref('');
const selectedVehicleId = ref<number | null>(null);
const mapStyle = ref<'google_streets' | 'google_hybrid' | 'osm'>('google_streets');

// Tra cứu thông tin chuyến xe liên kết của phương tiện (nếu có)
function getTripForVehicle(vehiclePlate?: string) {
  if (!vehiclePlate) return undefined;
  return dispatchStore.trips.find(
    (t) =>
      t.vehiclePlate === vehiclePlate &&
      t.status !== 'COMPLETED' &&
      t.status !== 'CANCELLED'
  );
}

// Danh sách trạng thái xe động
const vehicleMapStates = ref<VehicleMapState[]>(mockStorage.getVehicleMapStates(initialVehicleMapStates));

// Xe đang được chọn
const selectedVehicle = computed(() => {
  if (selectedVehicleId.value === null) return null;
  return vehicleMapStates.value.find((item) => item.id === selectedVehicleId.value) || null;
});

// Tuyến đường đang được chọn theo xe
const selectedRoute = computed(() => {
  if (selectedVehicleId.value === null) return null;
  const v = vehicleMapStates.value.find((item) => item.id === selectedVehicleId.value);
  if (!v || !v.routeCode) return null;
  return ECOTECH_ROUTES.find((r) => r.code === v.routeCode) || null;
});

// Tra cứu cự ly quy chuẩn tuyến đường (km)
function getRouteDistance(routeCode?: string): number | null {
  if (!routeCode) return null;
  const route = ECOTECH_ROUTES.find((r) => r.code === routeCode);
  return route ? route.distanceKm : null;
}

// Danh sách xe sau khi lọc theo status & từ khóa tìm kiếm
const filteredVehicles = computed(() => {
  let list = vehicleMapStates.value;
  if (filterStatus.value !== 'ALL') {
    list = list.filter((v) => v.status === filterStatus.value);
  }
  const q = searchQuery.value.trim().toLowerCase();
  if (q) {
    list = list.filter(
      (v) =>
        v.licensePlate.toLowerCase().includes(q) ||
        v.driverName.toLowerCase().includes(q) ||
        (v.fromHub && v.fromHub.name.toLowerCase().includes(q)) ||
        (v.toHub && v.toHub.name.toLowerCase().includes(q)) ||
        (v.tripCode && v.tripCode.toLowerCase().includes(q))
    );
  }
  return list;
});

// Thống kê nhanh đội xe
const stats = computed(() => {
  const total = vehicleMapStates.value.length;
  const running = vehicleMapStates.value.filter((v) => v.status === 'RUNNING').length;
  const available = vehicleMapStates.value.filter((v) => v.status === 'AVAILABLE').length;
  const maintenance = vehicleMapStates.value.filter((v) => v.status === 'MAINTENANCE').length;
  return { total, running, available, maintenance };
});

// Layers quản lý trên Leaflet
let tileLayer: any = null;
let routeLayerGroup: any = null;
let hubMarkers: any[] = [];
let vehicleMarkers: Map<number, any> = new Map();
let resizeObserver: ResizeObserver | null = null;

//=============================================================================
// 2. KHỞI TẠO BẢN ĐỒ & QUẢN LÝ LỘ TRÌNH (ROUTES)
//=============================================================================
function initMap() {
  if (!mapContainer.value) return;

  if (mapInstance.value) {
    try {
      mapInstance.value.remove();
    } catch (e) {}
    mapInstance.value = null;
  }

  // Khởi tạo bản đồ an toàn theo chuẩn GIS
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

  mapInstance.value.on('moveend', () => {
    if (mapInstance.value) {
      mapInstance.value.invalidateSize();
    }
  });

  routeLayerGroup = L.layerGroup().addTo(mapInstance.value);

  updateTileLayer();
  renderStandardRoutes();
  renderHubMarkers();
  renderVehicleMarkers();

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
}

function updateTileLayer() {
  if (!mapInstance.value) return;
  if (tileLayer) mapInstance.value.removeLayer(tileLayer);
  tileLayer = createTileLayer(mapStyle.value);
  tileLayer.addTo(mapInstance.value);
}

// Hàm chuẩn hóa waypoints chính xác theo đường bộ thực tế (Road Network Navigation)
function getVehicleTripWaypoints(v: VehicleMapState): [number, number][] {
  if (!v.fromHub || !v.toHub) return [];

  const startPt: [number, number] = [v.fromHub.lat, v.fromHub.lng];
  const endPt: [number, number] = [v.toHub.lat, v.toHub.lng];

  // Nếu cùng trạm (ví dụ xe đỗ sẵn sàng)
  if (Math.hypot(startPt[0] - endPt[0], startPt[1] - endPt[1]) < 0.0001) {
    return [startPt];
  }

  let finalPts: [number, number][] = [];

  if (v.routeCode) {
    const route = ECOTECH_ROUTES.find((r) => r.code === v.routeCode);
    if (route && route.waypoints && route.waypoints.length >= 2) {
      let rWps = route.waypoints.map((wp) => [wp[0], wp[1]] as [number, number]);

      // Xác định chiều: nếu chiều ngược lại gần startPt hơn thì lật lại
      const dStart = Math.hypot(startPt[0] - rWps[0][0], startPt[1] - rWps[0][1]);
      const dEnd = Math.hypot(startPt[0] - rWps[rWps.length - 1][0], startPt[1] - rWps[rWps.length - 1][1]);
      if (dEnd < dStart) {
        rWps.reverse();
      }

      // Sử dụng đúng danh sách tọa độ đường bộ của tuyến
      finalPts = rWps;
    }
  }

  // Nếu chưa có lộ trình quy chuẩn, sử dụng ma trận đường bộ thực tế giữa 2 trạm
  if (finalPts.length < 2 && v.fromHub.code && v.toHub.code) {
    const roadRes = getRoadRouteBetweenHubs(v.fromHub.code, v.toHub.code);
    if (roadRes.waypoints && roadRes.waypoints.length >= 2) {
      finalPts = roadRes.waypoints.map((wp) => [wp[0], wp[1]] as [number, number]);
    }
  }

  // Fallback an toàn nếu không tìm thấy đường bộ
  if (finalPts.length < 2) {
    finalPts = [startPt, endPt];
  }

  // Đảm bảo điểm đầu và cuối trùng khít 100% với tọa độ GPS của Hub xuất phát và Hub đích
  if (finalPts.length >= 2) {
    finalPts[0] = startPt;
    finalPts[finalPts.length - 1] = endPt;
  }

  return finalPts;
}

// Vẽ các tuyến đường (Đồng bộ định dạng 3 lớp viền phát quang từ Tuyến đường)
function renderStandardRoutes() {
  if (!mapInstance.value || typeof L === 'undefined') return;

  if (routeLayerGroup) {
    routeLayerGroup.clearLayers();
  } else {
    routeLayerGroup = L.layerGroup().addTo(mapInstance.value);
  }

  // Khi có xe được chọn: Hiển thị nổi bật lộ trình của xe
  if (selectedVehicleId.value !== null) {
    const v = vehicleMapStates.value.find((item) => item.id === selectedVehicleId.value);
    if (!v) return;

    const activeWaypoints = getVehicleTripWaypoints(v);
    if (activeWaypoints.length >= 2) {
      // 1. Viền đệm trắng bảo vệ đường (Casing) giúp phân tách rõ với nền bản đồ
      L.polyline(activeWaypoints, {
        color: '#ffffff',
        weight: 7.5,
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(routeLayerGroup);

      // 2. Tuyến đường chính sắc nét Google Maps
      L.polyline(activeWaypoints, {
        color: '#16a34a',
        weight: 4.5,
        opacity: 1,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(routeLayerGroup);

      // 4. PIN ĐIỂM ĐẦU (XUẤT PHÁT) - Ghim chính xác đầu mút xuất phát (Đầu 1 của quãng đường)
      const originPoint = activeWaypoints[0];
      const originShort = v.fromHub?.shortName || 'Xuất phát';
      const originCode = v.fromHub?.code || '';
      const originIcon = L.divIcon({
        className: 'route-endpoint-divicon',
        html: `
          <div class="route-pin-node is-start">
            <div class="pin-pill">
              <span class="pin-letter">Đi</span>
              ${originCode ? `<span class="pin-code-tag">${originCode}</span>` : ''}
              <span class="pin-text">Xuất phát: <strong>${originShort}</strong></span>
            </div>
            <div class="pin-anchor-dot"></div>
          </div>
        `,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });
      L.marker(originPoint, { icon: originIcon, zIndexOffset: 2500 }).addTo(routeLayerGroup);

      // 5. PIN ĐIỂM CUỐI (ĐÍCH ĐẾN) - Ghim chính xác đầu mút đích đến (Đầu 2 của quãng đường)
      const destPoint = activeWaypoints[activeWaypoints.length - 1];
      const destShort = v.toHub?.shortName || 'Đích đến';
      const destCode = v.toHub?.code || '';
      const destIcon = L.divIcon({
        className: 'route-endpoint-divicon',
        html: `
          <div class="route-pin-node is-end">
            <div class="pin-pill">
              <span class="pin-letter">Đến</span>
              ${destCode ? `<span class="pin-code-tag">${destCode}</span>` : ''}
              <span class="pin-text">Đích đến: <strong>${destShort}</strong></span>
            </div>
            <div class="pin-anchor-dot"></div>
          </div>
        `,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });
      L.marker(destPoint, { icon: destIcon, zIndexOffset: 2500 }).addTo(routeLayerGroup);
    }
    return;
  }

  // Khi chưa chọn xe nào: Hiển thị nền mờ mạng lưới đồng bộ như tuyến đường
  ECOTECH_ROUTES.forEach((route) => {
    L.polyline(route.waypoints, {
      color: '#cbd5e1',
      weight: 3,
      opacity: 0.5,
      dashArray: '5, 5',
      lineCap: 'round',
    }).addTo(routeLayerGroup);
  });
}

//=============================================================================
// 3. QUẢN LÝ TRẠM (HUBS) & PHƯƠNG TIỆN (VEHICLES)
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

  // Khi đang chọn 1 xe cụ thể:
  if (selectedVehicleId.value !== null) {
    const v = vehicleMapStates.value.find((item) => item.id === selectedVehicleId.value);
    // Nếu xe đang có lộ trình (routeCode) thì điểm đi (A) và điểm đến (B) đã được biểu diễn
    // qua Pin A và Pin B trong renderStandardRoutes(). Ẩn toàn bộ các trạm khác để tránh chồng lấn gây rối.
    if (v && v.routeCode) {
      return;
    }

    // Nếu xe không có lộ trình (xe đỗ sẵn sàng hoặc bảo dưỡng tại trạm), chỉ hiển thị duy nhất trạm của xe đó
    if (v && v.fromHub) {
      const currentHub = ECOTECH_HUBS.find((h) => h.code === v.fromHub?.code);
      if (currentHub) {
        const customIcon = L.divIcon({
          className: 'custom-hub-icon',
          html: getHubIconHtml(currentHub),
          iconSize: [36, 42],
          iconAnchor: [18, 42],
        });
        const marker = L.marker([currentHub.lat, currentHub.lng], { icon: customIcon }).addTo(mapInstance.value);
        hubMarkers.push(marker);
      }
    }
    return;
  }

  // Chế độ xem tổng thể: Hiển thị đầy đủ tất cả các trạm nông trường
  ECOTECH_HUBS.forEach((hub) => {
    const customIcon = L.divIcon({
      className: 'custom-hub-icon',
      html: getHubIconHtml(hub),
      iconSize: [36, 42],
      iconAnchor: [18, 42],
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

function getVehicleIconHtml(v: VehicleMapState, isSelected: boolean) {
  let statusColor = '#15803d';
  let pulse = '';

  if (v.status === 'RUNNING') {
    statusColor = '#15803d';
    pulse = '<span class="pulse-ring"></span>';
  } else if (v.status === 'AVAILABLE') {
    statusColor = '#0284c7';
  } else {
    statusColor = '#e11d48';
  }

  const selectedClass = isSelected ? 'is-selected' : '';

  return `
    <div class="vehicle-marker-wrapper ${selectedClass}" style="--veh-color: ${statusColor}">
      ${pulse}
      <div class="vehicle-avatar">
        <span class="veh-icon">🚚</span>
        <span class="veh-plate">${v.licensePlate}</span>
      </div>
    </div>
  `;
}

function renderVehicleMarkers() {
  if (!mapInstance.value || typeof L === 'undefined') return;

  vehicleMapStates.value.forEach((v) => {
    const isSelected = selectedVehicleId.value === v.id;
    // Khi đang chọn 1 xe: CHỈ hiển thị duy nhất xe đó trên bản đồ!
    // Các xe khác hoàn toàn bị ẩn để không gây rối mắt và chồng chéo.
    const isVisible = selectedVehicleId.value !== null
      ? isSelected
      : (filterStatus.value === 'ALL' || filterStatus.value === v.status);

    if (!isVisible) {
      if (vehicleMarkers.has(v.id)) {
        mapInstance.value.removeLayer(vehicleMarkers.get(v.id));
        vehicleMarkers.delete(v.id);
      }
      return;
    }

    const icon = L.divIcon({
      className: 'custom-vehicle-icon',
      html: getVehicleIconHtml(v, isSelected),
      iconSize: [110, 30],
      iconAnchor: [55, 15],
    });

    let vLat = v.currentLat;
    let vLng = v.currentLng;

    // Khi xe đang chạy: ghim vị trí xe khớp hoàn toàn vào lộ trình đường bộ của tuyến
    if (v.status === 'RUNNING') {
      const tripWps = getVehicleTripWaypoints(v);
      if (tripWps.length >= 2) {
        let bestDist = Infinity;
        let bestPt: [number, number] = [vLat, vLng];
        for (const wp of tripWps) {
          const d = Math.hypot(wp[0] - vLat, wp[1] - vLng);
          if (d < bestDist) {
            bestDist = d;
            bestPt = wp;
          }
        }
        if (bestDist < 0.05) {
          vLat = bestPt[0];
          vLng = bestPt[1];
        }
      }
    }

    if (vehicleMarkers.has(v.id)) {
      const marker = vehicleMarkers.get(v.id);
      marker.setLatLng([vLat, vLng]);
      marker.setIcon(icon);
      marker.setZIndexOffset(isSelected ? 3500 : 500);
    } else {
      const marker = L.marker([vLat, vLng], { icon, zIndexOffset: isSelected ? 3500 : 500 }).addTo(mapInstance.value);
      marker.on('click', () => focusVehicle(v));
      vehicleMarkers.set(v.id, marker);
    }
  });
}

//=============================================================================
// 4. TƯƠNG TÁC ĐIỀU HÀNH & LIFECYCLE
//=============================================================================
function focusVehicle(v: VehicleMapState) {
  if (selectedVehicleId.value === v.id) {
    resetMapView();
    return;
  }

  selectedVehicleId.value = v.id;
  renderStandardRoutes();
  renderVehicleMarkers();
  renderHubMarkers();

  if (mapInstance.value) {
    mapInstance.value.invalidateSize();
    const tripPts = getVehicleTripWaypoints(v);
    if (tripPts.length >= 2) {
      const allPts = [...tripPts, [v.currentLat, v.currentLng] as [number, number]];
      const bounds = L.latLngBounds(allPts);
      mapInstance.value.fitBounds(bounds, {
        paddingTopLeft: [50, 50],
        paddingBottomRight: [50, 70],
        maxZoom: 13,
      });
    } else {
      mapInstance.value.flyTo([v.currentLat, v.currentLng], 12.5, { duration: 0.8 });
    }

    const marker = vehicleMarkers.get(v.id);
    if (marker) {
      const trip = getTripForVehicle(v.licensePlate);
      let tripStatusHtml = '';
      if (trip) {
        if (trip.status === 'ACCEPTED') {
          tripStatusHtml = `<div class="popup-live-row status-accepted">✓ <strong>Tài xế đã nhận chuyến:</strong> ${trip.acceptedAt ? trip.acceptedAt.slice(11) : ''}</div>`;
        } else if (trip.status === 'ARRIVED') {
          tripStatusHtml = `<div class="popup-live-row status-arrived">📍 <strong>Xe đã đến nơi:</strong> ${trip.arrivedAt ? trip.arrivedAt.slice(11) : ''}${trip.arrivalNote ? ` (${trip.arrivalNote})` : ''}</div>`;
        } else if (trip.status === 'INPROGRESS') {
          tripStatusHtml = `<div class="popup-live-row status-moving">▶ <strong>Đang di chuyển:</strong> ODO xuất bến ${trip.startOdo ? trip.startOdo.toLocaleString() + ' km' : ''}</div>`;
        } else if (trip.status === 'ASSIGNED') {
          tripStatusHtml = `<div class="popup-live-row status-assigned">⏳ <strong>Chờ tài xế xác nhận nhận chuyến</strong></div>`;
        }
      }

      const statusText =
        trip?.status === 'ACCEPTED'
          ? 'Tài xế đã nhận chuyến'
          : trip?.status === 'ARRIVED'
          ? 'Đã đến địa điểm chỉ định'
          : v.status === 'RUNNING'
          ? 'Đang di chuyển chở hàng'
          : v.status === 'AVAILABLE'
          ? 'Đang đỗ - Sẵn sàng'
          : 'Bảo dưỡng / Sự cố';

      const badgeClass =
        trip?.status === 'ACCEPTED'
          ? 'badge-cyan'
          : trip?.status === 'ARRIVED'
          ? 'badge-amber'
          : v.status === 'RUNNING'
          ? 'badge-green'
          : v.status === 'AVAILABLE'
          ? 'badge-blue'
          : 'badge-red';

      const popupContent = `
        <div class="map-popup-card vehicle-popup">
          <div class="popup-header-row">
            <h4 class="popup-plate">🚚 ${v.licensePlate}</h4>
            <span class="popup-status-badge ${badgeClass}">
              ${statusText}
            </span>
          </div>
          <div class="popup-body">
            <div class="popup-detail-row">
              <span class="detail-icon">👤</span>
              <span class="detail-text"><strong>${v.driverName}</strong> · ${v.driverPhone}</span>
            </div>
            ${v.fromHub && v.toHub ? `
            <div class="popup-route-pill">
              <span>📍 ${v.fromHub.shortName}</span>
              <span class="route-arrow">➔</span>
              <span>🏁 ${v.toHub.shortName}</span>
            </div>` : ''}
            <div class="popup-detail-row cargo-row">
              <span class="detail-icon">📦</span>
              <span class="detail-text">${v.cargoDescription || 'Chưa nhận lệnh vận chuyển'}</span>
            </div>
            ${tripStatusHtml}
          </div>
        </div>
      `;
      marker.bindPopup(popupContent, {
        maxWidth: 320,
        offset: [0, -22],
        autoPanPadding: [50, 50],
        className: 'custom-leaflet-popup'
      }).openPopup();
    }
  }
}

function resetMapView() {
  selectedVehicleId.value = null;
  if (mapInstance.value) {
    mapInstance.value.invalidateSize();
    mapInstance.value.closePopup();
    mapInstance.value.flyTo([11.5400, 106.6200], 12, { duration: 0.8 });
  }
  renderStandardRoutes();
  renderVehicleMarkers();
  renderHubMarkers();
}

function toggleFullScreen() {
  isFullScreen.value = !isFullScreen.value;
  nextTick(() => {
    if (mapInstance.value) {
      mapInstance.value.invalidateSize();
    }
  });
}

watch(filterStatus, () => {
  if (selectedVehicleId.value !== null) {
    const v = vehicleMapStates.value.find((item) => item.id === selectedVehicleId.value);
    if (v && filterStatus.value !== 'ALL' && v.status !== filterStatus.value) {
      resetMapView();
      return;
    }
  }
  renderVehicleMarkers();
});

watch(mapStyle, () => {
  updateTileLayer();
});

// Expose phương thức ra ngoài
defineExpose({
  resetMapView,
  focusVehicle,
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
    <!-- 1. Thanh điều khiển Top Bar (Sao chép định dạng đồng bộ từ Tuyến đường) -->
    <div class="map-top-bar">
      <div class="top-bar-left">
        <div class="status-indicator">
          <span class="live-dot"></span>
          <span class="live-text">GIÁM SÁT ĐỘI XE REALTIME (GPS)</span>
        </div>


      </div>

      <div class="top-bar-right">
        <!-- Bộ lọc trạng thái xe -->
        <div class="filter-group">
          <button
            class="btn-filter"
            :class="{ active: filterStatus === 'ALL' }"
            @click="filterStatus = 'ALL'"
          >
            Tất cả
          </button>
          <button
            class="btn-filter"
            :class="{ active: filterStatus === 'RUNNING' }"
            @click="filterStatus = 'RUNNING'"
          >
            Đang chạy ({{ stats.running }})
          </button>
          <button
            class="btn-filter"
            :class="{ active: filterStatus === 'AVAILABLE' }"
            @click="filterStatus = 'AVAILABLE'"
          >
            Sẵn sàng
          </button>
        </div>

        <!-- Chế độ bản đồ -->
        <!-- Nút chuyển đổi kiểu bản đồ Google Maps -->
        <div class="layer-toggle">
          <button
            class="btn-layer"
            :class="{ active: mapStyle === 'google_streets' }"
            @click="mapStyle = 'google_streets'"
            title="Bản đồ giao thông đường bộ Google Maps"
          >
            Đường Bộ
          </button>
          <button
            class="btn-layer"
            :class="{ active: mapStyle === 'google_hybrid' }"
            @click="mapStyle = 'google_hybrid'"
            title="Bản đồ ảnh vệ tinh Google Maps"
          >
            Vệ Tinh
          </button>
          <button
            class="btn-layer"
            :class="{ active: mapStyle === 'osm' }"
            @click="mapStyle = 'osm'"
            title="Bản đồ OpenStreetMap"
          >
            Bản Đồ Mở
          </button>
        </div>

        <!-- Reset View & Toàn màn hình -->
        <button class="btn-icon" @click="resetMapView" title="Về toàn cảnh">
          <RefreshCw :size="15" />
        </button>
        <button class="btn-icon" @click="toggleFullScreen" title="Toàn màn hình">
          <Maximize2 v-if="!isFullScreen" :size="15" />
          <Minimize2 v-else :size="15" />
        </button>
      </div>
    </div>

    <!-- 2. Banner hiển thị khi đang xem lộ trình của 1 xe cụ thể -->
    <div v-if="selectedVehicle" class="active-vehicle-bar">
      <div class="active-veh-info">
        <span class="active-veh-badge">
          <Truck :size="14" />
          <span>Sơ đồ lộ trình xe: <strong>{{ selectedVehicle.licensePlate }}</strong></span>
        </span>
        <span class="active-veh-route">
          📍 <strong>{{ selectedVehicle.fromHub?.shortName || 'Xuất phát' }}</strong>
          ➔
          🏁 <strong>{{ selectedVehicle.toHub?.shortName || 'Đích đến' }}</strong>
        </span>
        <span v-if="selectedRoute" class="active-veh-km">
          (Cự ly quy chuẩn: <strong>{{ selectedRoute.distanceKm }} km</strong>)
        </span>
        <!-- Hiển thị tương tác tài xế trên Top Banner -->
        <span
          v-if="getTripForVehicle(selectedVehicle.licensePlate)?.status === 'ACCEPTED'"
          class="active-trip-status-tag tag-cyan"
        >
          <CheckCircle2 :size="13" />
          <span>Tài xế đã nhận chuyến lúc {{ getTripForVehicle(selectedVehicle.licensePlate)?.acceptedAt?.slice(11) }}</span>
        </span>
        <span
          v-else-if="getTripForVehicle(selectedVehicle.licensePlate)?.status === 'ARRIVED'"
          class="active-trip-status-tag tag-amber"
        >
          <MapPin :size="13" />
          <span>Xe đã đến nơi lúc {{ getTripForVehicle(selectedVehicle.licensePlate)?.arrivedAt?.slice(11) }}<span v-if="getTripForVehicle(selectedVehicle.licensePlate)?.arrivalNote">: {{ getTripForVehicle(selectedVehicle.licensePlate)?.arrivalNote }}</span></span>
        </span>
      </div>
      <button class="btn-clear-selection" @click="resetMapView">
        ✕ Bỏ chọn / Xem tất cả
      </button>
    </div>

    <!-- 3. Khung chính: Bản đồ + Panel danh sách xe -->
    <div class="map-body-container">
      <!-- Container chứa Leaflet Map Canvas -->
      <div ref="mapContainer" class="leaflet-map-canvas"></div>

      <!-- Chú giải sơ đồ (Tự động thích ứng theo chế độ Tổng thể hoặc Chi tiết xe) -->
      <div v-if="!selectedVehicle" class="map-legend-card">
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
        <h5 class="legend-title">Sơ Đồ Xe {{ selectedVehicle.licensePlate }}</h5>
        <div class="legend-item">
          <span class="legend-icon icon-start-pin">Đi</span>
          <span>Điểm xuất phát: <strong>{{ selectedVehicle.fromHub?.shortName || 'Xuất phát' }}</strong></span>
        </div>
        <div class="legend-item">
          <span class="legend-icon icon-end-pin">Đến</span>
          <span>Điểm đích đến: <strong>{{ selectedVehicle.toHub?.shortName || 'Đích đến' }}</strong></span>
        </div>
        <div v-if="selectedRoute" class="legend-item">
          <span class="legend-line line-running"></span>
          <span>Lộ trình chạy ({{ selectedRoute.distanceKm }} km)</span>
        </div>
      </div>

      <!-- Danh sách xe bên phải (Side Fleet Panel đồng bộ) -->
      <div class="side-fleet-panel">
        <div class="panel-header">
          <div class="panel-title-wrap">
            <h4 class="panel-title">Sơ Đồ Điều Xe</h4>
            <span class="panel-count-tag">{{ filteredVehicles.length }} xe</span>
          </div>

          <!-- Ô tìm kiếm phương tiện -->
          <div class="search-box-wrap">
            <Search :size="13" class="search-icon" />
            <input
              v-model="searchQuery"
              type="text"
              class="panel-search-input"
              placeholder="Tìm theo biển số, tài xế, trạm..."
            />
          </div>
        </div>

        <div class="routes-list-scroll">
          <div
            v-for="v in filteredVehicles"
            :key="v.id"
            class="fleet-item-card"
            :class="{
              'is-active': selectedVehicleId === v.id,
              'status-running': v.status === 'RUNNING',
              'status-avail': v.status === 'AVAILABLE',
            }"
            @click="focusVehicle(v)"
          >
            <div class="item-header">
              <div class="item-plate">
                <Truck :size="15" class="plate-icon" />
                <span class="plate-text">{{ v.licensePlate }}</span>
                <span v-if="v.tripCode" class="trip-code-pill">{{ v.tripCode }}</span>
              </div>
              <div class="item-tags-right">
                <span
                  v-if="getTripForVehicle(v.licensePlate)?.status === 'ACCEPTED'"
                  class="status-pill pill-cyan"
                >
                  ✓ Đã nhận chuyến
                </span>
                <span
                  v-else-if="getTripForVehicle(v.licensePlate)?.status === 'ARRIVED'"
                  class="status-pill pill-amber"
                >
                  📍 Đã đến nơi
                </span>
                <span
                  v-else
                  class="status-pill"
                  :class="{
                    'pill-green': v.status === 'RUNNING',
                    'pill-blue': v.status === 'AVAILABLE',
                    'pill-red': v.status === 'MAINTENANCE',
                  }"
                >
                  {{ v.status === 'RUNNING' ? 'Đang chạy' : v.status === 'AVAILABLE' ? 'Sẵn sàng' : 'Bảo dưỡng' }}
                </span>
              </div>
            </div>

            <!-- Dòng chỉ báo nổi bật khi xe được chọn xem sơ đồ -->
            <div v-if="selectedVehicleId === v.id" class="item-selected-strip">
              <span class="pulse-mini-dot"></span>
              <span class="strip-text">Đang xem sơ đồ lộ trình trên bản đồ</span>
            </div>

            <!-- Dòng trạng thái tương tác từ Tài xế -->
            <div v-if="getTripForVehicle(v.licensePlate)" class="driver-trip-status-row">
              <div
                v-if="getTripForVehicle(v.licensePlate)?.status === 'ACCEPTED'"
                class="driver-ack-badge ack-cyan"
              >
                <Clock :size="12" />
                <span>Tài xế nhận chuyến: <strong>{{ getTripForVehicle(v.licensePlate)?.acceptedAt?.slice(11) }}</strong></span>
              </div>
              <div
                v-else-if="getTripForVehicle(v.licensePlate)?.status === 'ARRIVED'"
                class="driver-ack-badge ack-amber"
              >
                <MapPin :size="12" />
                <span>Đã đến nơi: <strong>{{ getTripForVehicle(v.licensePlate)?.arrivedAt?.slice(11) }}</strong><span v-if="getTripForVehicle(v.licensePlate)?.arrivalNote"> ({{ getTripForVehicle(v.licensePlate)?.arrivalNote }})</span></span>
              </div>
              <div
                v-else-if="getTripForVehicle(v.licensePlate)?.status === 'ASSIGNED'"
                class="driver-ack-badge ack-gray"
              >
                <Clock :size="12" />
                <span>Chờ tài xế nhận chuyến</span>
              </div>
            </div>

            <!-- Lộ trình Điểm Đi ➔ Điểm Đến & Cự ly quãng đường -->
            <div v-if="v.fromHub && v.toHub" class="item-route-flow">
              <div class="flow-step">
                <span class="dot dot-from"></span>
                <span class="flow-name">{{ v.fromHub.shortName }}</span>
              </div>
              <div class="flow-arrow">
                <ChevronRight :size="13" />
              </div>
              <div class="flow-step">
                <span class="dot dot-to"></span>
                <span class="flow-name">{{ v.toHub.shortName }}</span>
              </div>
              <span v-if="getRouteDistance(v.routeCode)" class="flow-distance">
                {{ getRouteDistance(v.routeCode) }} km
              </span>
            </div>

            <!-- Thông tin tài xế & loại xe -->
            <div class="item-meta">
              <span>Tài xế: <strong>{{ v.driverName }}</strong></span>
              <span class="model-badge">{{ v.vehicleType === 'LatexTruck' ? 'Xe tải' : v.vehicleType === 'PassengerCar' ? 'Bán tải' : 'Máy đào' }}</span>
            </div>

            <!-- Hàng hóa mô tả -->
            <div v-if="v.cargoDescription" class="item-cargo">
              {{ v.cargoDescription }}
            </div>
          </div>
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

/* Top Bar đồng bộ định dạng Tuyến đường */
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
  flex-wrap: wrap;
}

.filter-group {
  display: flex;
  background: #1e293b;
  border-radius: 6px;
  padding: 2px;
}

.btn-filter {
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

.btn-filter.active {
  background: #334155;
  color: #ffffff;
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
  height: 540px;
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

/* Side Fleet Panel đồng bộ định dạng Tuyến đường */
.side-fleet-panel {
  width: 350px;
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

.fleet-item-card {
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

.fleet-item-card:hover {
  border-color: #86efac;
  background: #f0fdf4;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.fleet-item-card.is-active {
  border-color: #16a34a;
  background: #f0fdf4;
  box-shadow: 0 0 0 2px rgba(22, 163, 74, 0.2);
}

.item-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.item-plate {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.8125rem;
  color: #0f172a;
  white-space: nowrap;
  flex-shrink: 0;
}

.plate-icon {
  flex-shrink: 0;
  color: #334155;
}

.plate-text {
  font-weight: 700;
  white-space: nowrap;
  letter-spacing: 0.2px;
}

.trip-code-pill {
  font-size: 0.625rem;
  background: #e0f2fe;
  color: #0284c7;
  padding: 1px 6px;
  border-radius: 4px;
  font-family: monospace;
  white-space: nowrap;
  letter-spacing: 0.2px;
  flex-shrink: 0;
}

.item-tags-right {
  display: flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
  flex-shrink: 0;
}

.status-pill {
  font-size: 0.6875rem;
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 700;
  white-space: nowrap;
  flex-shrink: 0;
}

.pill-green { background: #dcfce7; color: #15803d; }
.pill-blue { background: #e0f2fe; color: #0369a1; }
.pill-red { background: #fee2e2; color: #b91c1c; }
.pill-cyan { background: #cffafe; color: #0891b2; }
.pill-amber { background: #fef3c7; color: #b45309; }

.active-trip-status-tag {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 0.75rem;
  font-weight: 700;
  padding: 3px 10px;
  border-radius: 12px;
}
.tag-cyan {
  background: #0891b2;
  color: #ffffff;
}
.tag-amber {
  background: #d97706;
  color: #ffffff;
}

.driver-trip-status-row {
  margin-top: 2px;
}
.driver-ack-badge {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 0.6875rem;
  padding: 3px 8px;
  border-radius: 6px;
  line-height: 1.25;
}
.ack-cyan {
  background: #ecfeff;
  border: 1px solid #a5f3fc;
  color: #0e7490;
}
.ack-amber {
  background: #fffbeb;
  border: 1px solid #fde68a;
  color: #b45309;
}
.ack-gray {
  background: #f8fafc;
  border: 1px dashed #cbd5e1;
  color: #64748b;
}

.item-selected-strip {
  display: flex;
  align-items: center;
  gap: 6px;
  background: #dcfce7;
  border: 1px solid #86efac;
  border-radius: 6px;
  padding: 3px 8px;
  font-size: 0.6875rem;
  font-weight: 600;
  color: #15803d;
  white-space: nowrap;
}

.pulse-mini-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #16a34a;
  flex-shrink: 0;
  animation: pulse-dot 1.5s infinite;
}

@keyframes pulse-dot {
  0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(22, 163, 74, 0.7); }
  70% { transform: scale(1); box-shadow: 0 0 0 5px rgba(22, 163, 74, 0); }
  100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(22, 163, 74, 0); }
}

.item-route-flow {
  display: flex;
  align-items: center;
  gap: 6px;
  background: #f8fafc;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 0.6875rem;
}

.flow-step {
  display: flex;
  align-items: center;
  gap: 4px;
  color: #475569;
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}
.dot-from { background: #0284c7; }
.dot-to { background: #dc2626; }

.flow-arrow {
  color: #94a3b8;
  display: flex;
  align-items: center;
}

.flow-distance {
  margin-left: auto;
  font-size: 0.6875rem;
  font-weight: 700;
  color: #15803d;
  background: #dcfce7;
  padding: 1px 6px;
  border-radius: 10px;
}

.item-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.6875rem;
  color: #64748b;
}

.model-badge {
  background: #f1f5f9;
  color: #475569;
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 0.625rem;
}

.item-cargo {
  font-size: 0.6875rem;
  color: #64748b;
  line-height: 1.35;
  background: #fafcf9;
  padding: 4px 8px;
  border-radius: 4px;
  border-left: 2px solid #86efac;
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
  color: white;
  font-weight: 800;
  font-size: 0.625rem;
  border-radius: 9999px;
  min-width: 24px;
  height: 17px;
  padding: 0 4px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  letter-spacing: -0.01em;
}

.icon-end-pin {
  background: #dc2626;
  color: white;
  font-weight: 800;
  font-size: 0.625rem;
  border-radius: 9999px;
  min-width: 24px;
  height: 17px;
  padding: 0 4px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  letter-spacing: -0.01em;
}

.single-vehicle-legend {
  border-left: 3px solid #15803d;
}

/* Pin Nodes A and B */
:deep(.route-pin-box) {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #ffffff;
  padding: 4px 10px;
  border-radius: 20px;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.22);
  white-space: nowrap;
  font-family: inherit;
  pointer-events: auto;
}

:deep(.route-pin-box.is-start) {
  border: 2px solid #0284c7;
}

:deep(.route-pin-box.is-end) {
  border: 2px solid #dc2626;
}

:deep(.route-pin-box .pin-letter) {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  color: white;
  font-size: 0.6875rem;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
}

:deep(.route-pin-box.is-start .pin-letter) {
  background: #0284c7;
}

:deep(.route-pin-box.is-end .pin-letter) {
  background: #dc2626;
}

:deep(.route-pin-box .pin-code-tag) {
  font-size: 0.625rem;
  font-weight: 800;
  padding: 1px 5px;
  border-radius: 4px;
  color: #ffffff;
}

:deep(.route-pin-box.is-start .pin-code-tag) {
  background: #0284c7;
}

:deep(.route-pin-box.is-end .pin-code-tag) {
  background: #dc2626;
}

:deep(.route-pin-box .pin-text) {
  font-size: 0.6875rem;
  font-weight: 600;
  color: #334155;
}

:deep(.route-pin-box.is-start .pin-text strong) {
  color: #0284c7;
}

:deep(.route-pin-box.is-end .pin-text strong) {
  color: #dc2626;
}

:deep(.popup-live-row) {
  margin-top: 6px;
  padding: 5px 8px;
  border-radius: 6px;
  font-size: 0.75rem;
  line-height: 1.35;
}
:deep(.popup-live-row.status-accepted) {
  background: #ecfeff;
  color: #0891b2;
  border: 1px solid #a5f3fc;
}
:deep(.popup-live-row.status-arrived) {
  background: #fffbeb;
  color: #b45309;
  border: 1px solid #fde68a;
}
:deep(.popup-live-row.status-moving) {
  background: #f0fdf4;
  color: #15803d;
  border: 1px solid #bbf7d0;
}
:deep(.popup-live-row.status-assigned) {
  background: #f8fafc;
  color: #64748b;
  border: 1px dashed #cbd5e1;
}
:deep(.badge-cyan) {
  background: #0891b2;
  color: #ffffff;
}
:deep(.badge-amber) {
  background: #d97706;
  color: #ffffff;
}
</style>
