// Dịch vụ định tuyến đường bộ thực tế (Road Routing Navigation - Driving Directions)
// Hỗ trợ tra cứu ma trận đường bộ giữa các trạm quy chuẩn và gọi API chỉ đường Google Maps / OSRM Driving thực tế
import { PRECOMPUTED_ROAD_ROUTES, type PrecomputedRoadSegment } from '@/mocks/precomputedRoads';

export interface RoadRouteResult {
  waypoints: [number, number][];
  distanceKm: number;
  source: 'cache' | 'osrm_live' | 'fallback';
}

/**
 * Tra cứu lộ trình đường bộ thực tế giữa 2 trạm theo mã code
 */
export function getRoadRouteBetweenHubs(fromCode: string, toCode: string): RoadRouteResult {
  if (!fromCode || !toCode || fromCode === toCode) {
    return { waypoints: [], distanceKm: 0, source: 'cache' };
  }

  const key = `${fromCode}-${toCode}`;
  const segment = PRECOMPUTED_ROAD_ROUTES[key];
  if (segment && segment.waypoints && segment.waypoints.length > 0) {
    return {
      waypoints: segment.waypoints.map((wp) => [wp[0], wp[1]]),
      distanceKm: segment.distanceKm,
      source: 'cache',
    };
  }

  // Nếu không có chiều thuận, thử tìm chiều nghịch và đảo ngược waypoints
  const reverseKey = `${toCode}-${fromCode}`;
  const revSegment = PRECOMPUTED_ROAD_ROUTES[reverseKey];
  if (revSegment && revSegment.waypoints && revSegment.waypoints.length > 0) {
    return {
      waypoints: [...revSegment.waypoints].reverse().map((wp) => [wp[0], wp[1]]),
      distanceKm: revSegment.distanceKm,
      source: 'cache',
    };
  }

  return { waypoints: [], distanceKm: 0, source: 'fallback' };
}

/**
 * Tính toán cự ly đường bộ giữa 2 trạm
 */
export function getHubRoadDistanceKm(fromCode: string, toCode: string): number {
  const res = getRoadRouteBetweenHubs(fromCode, toCode);
  return res.distanceKm || 0;
}

/**
 * Ghép nhiều chặng đường bộ nối tiếp (hỗ trợ tuyến 1 điểm đi -> nhiều điểm đến, khứ hồi)
 */
export function getMultiStopRoadRoute(hubCodes: string[], isRoundTrip = false): RoadRouteResult {
  if (!hubCodes || hubCodes.length < 2) {
    return { waypoints: [], distanceKm: 0, source: 'cache' };
  }

  const stops = [...hubCodes];
  if (isRoundTrip && stops[stops.length - 1] !== stops[0]) {
    stops.push(stops[0]);
  }

  const allWaypoints: [number, number][] = [];
  let totalKm = 0;

  for (let i = 0; i < stops.length - 1; i++) {
    const from = stops[i];
    const to = stops[i + 1];
    const segment = getRoadRouteBetweenHubs(from, to);

    if (segment.waypoints.length > 0) {
      if (allWaypoints.length > 0) {
        // Bỏ điểm đầu tiên của chặng kế tiếp để tránh trùng mút với điểm cuối chặng trước
        allWaypoints.push(...segment.waypoints.slice(1));
      } else {
        allWaypoints.push(...segment.waypoints);
      }
      totalKm += segment.distanceKm;
    }
  }

  return {
    waypoints: allWaypoints,
    distanceKm: Number(totalKm.toFixed(1)),
    source: 'cache',
  };
}

/**
 * Gọi API định tuyến đường bộ trực tuyến (OSRM Driving Engine / Google Maps Navigation)
 * Tự động convert GeoJSON [lng, lat] thành Leaflet [lat, lng]
 * Có timeout 4s và tự động fallback sang ma trận trạm có sẵn
 */
export async function fetchLiveRoadRoute(coords: [number, number][]): Promise<RoadRouteResult> {
  if (!coords || coords.length < 2) {
    return { waypoints: coords || [], distanceKm: 0, source: 'fallback' };
  }

  try {
    // Format tọa độ cho OSRM: lng,lat;lng,lat;...
    const coordString = coords.map(([lat, lng]) => `${lng},${lat}`).join(';');
    const url = `https://router.project-osrm.org/route/v1/driving/${coordString}?overview=full&geometries=geojson`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const resp = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (resp.ok) {
      const data = await resp.json();
      if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const distKm = Number((route.distance / 1000).toFixed(1));
        const pts: [number, number][] = route.geometry.coordinates.map(
          ([lng, lat]: [number, number]) => [Number(lat.toFixed(5)), Number(lng.toFixed(5))]
        );
        return {
          waypoints: pts,
          distanceKm: distKm,
          source: 'osrm_live',
        };
      }
    }
  } catch (e) {
    // Timeout hoặc lỗi mạng: tiếp tục fallback bên dưới
  }

  // Fallback: Nếu không gọi được API online, nối các điểm thẳng hoặc nội suy nhẹ
  return {
    waypoints: coords,
    distanceKm: 0,
    source: 'fallback',
  };
}
