import type { StandardRoute, TransportRequest } from '@/types';
import type { HubLocation } from '@/types/map';
import { ECOTECH_HUBS } from '@/mocks/mapData';

/**
 * Chuẩn hóa chuỗi tiếng Việt: bỏ dấu, viết thường, xóa ký tự đặc biệt
 */
export function normalizeText(str: string | undefined | null): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Tìm Hub gần nhất hoặc khớp nhất theo tên/địa điểm
 */
export function findMatchingHub(locationName: string, hubs: HubLocation[] = ECOTECH_HUBS): HubLocation | null {
  const norm = normalizeText(locationName);
  if (!norm) return null;

  for (const hub of hubs) {
    const normCode = normalizeText(hub.code);
    const normName = normalizeText(hub.name);
    const normShort = normalizeText(hub.shortName);

    if (norm === normCode || norm === normShort || norm === normName) {
      return hub;
    }
    if (normName.includes(norm) || norm.includes(normShort) || norm.includes(normCode)) {
      return hub;
    }
  }

  return null;
}

export interface RouteMatchResult {
  route: StandardRoute;
  score: number;
  reason: string;
  matchedFromHub?: HubLocation | null;
  matchedToHub?: HubLocation | null;
}

/**
 * Gợi ý lộ trình quy chuẩn phù hợp nhất từ điểm đi và điểm đến
 * Ưu tiên:
 * 1. Tuyến đường xuất phát từ điểm đi (hoặc Hub gần nhất) và đến điểm đích
 * 2. Tuyến hành lang 2 chiều kết nối cả 2 điểm
 * 3. Tuyến xuất phát từ điểm đi gần nhất
 */
export function suggestOptimalRoute(
  routes: StandardRoute[],
  fromLocation: string,
  toLocation?: string,
  hubs: HubLocation[] = ECOTECH_HUBS
): RouteMatchResult {
  if (!routes || routes.length === 0) {
    throw new Error('Danh sách tuyến đường cấu hình trống');
  }

  const normFrom = normalizeText(fromLocation);
  const normTo = normalizeText(toLocation || '');

  const fromHub = findMatchingHub(fromLocation, hubs);
  const toHub = toLocation ? findMatchingHub(toLocation, hubs) : null;

  let bestRoute = routes[0];
  let maxScore = -1;
  let bestReason = 'Tuyến mặc định hệ thống';

  for (const r of routes) {
    let score = 0;
    const reasons: string[] = [];

    const normStart = normalizeText(r.startPoint);
    const normEnd = normalizeText(r.endPoint);
    const normName = normalizeText(r.name);
    const normCode = normalizeText(r.routeCode);

    // 1. Kiểm tra điểm xuất phát (ưu tiên cao nhất theo yêu cầu: "xuất phát từ điểm đi gần nhất")
    const isStartMatchDirect = normStart.includes(normFrom) || normFrom.includes(normStart);
    const isStartMatchHub = fromHub && (normStart.includes(normalizeText(fromHub.name)) || normStart.includes(normalizeText(fromHub.shortName)) || normCode.includes(normalizeText(fromHub.code)));

    if (isStartMatchDirect || isStartMatchHub) {
      score += 60;
      reasons.push(`Xuất phát từ ${r.startPoint}`);
    } else if (normName.includes(normFrom) || (fromHub && normName.includes(normalizeText(fromHub.shortName)))) {
      score += 30;
      reasons.push(`Tuyến đi qua điểm xuất phát`);
    }

    // 2. Kiểm tra điểm đến
    if (normTo) {
      const isEndMatchDirect = normEnd.includes(normTo) || normTo.includes(normEnd);
      const isEndMatchHub = toHub && (normEnd.includes(normalizeText(toHub.name)) || normEnd.includes(normalizeText(toHub.shortName)) || normCode.includes(normalizeText(toHub.code)));

      if (isEndMatchDirect || isEndMatchHub) {
        score += 50;
        reasons.push(`Đích đến tại ${r.endPoint}`);
      } else if (normName.includes(normTo) || (toHub && normName.includes(normalizeText(toHub.shortName)))) {
        score += 25;
        reasons.push(`Tuyến kết nối điểm đến`);
      }

      // Bonus nếu khớp cả 2 đầu điểm đi & điểm đến
      if ((isStartMatchDirect || isStartMatchHub) && (isEndMatchDirect || isEndMatchHub)) {
        score += 50;
        reasons.push(`Khớp chính xác cả điểm đi và điểm đến`);
      }

      // Tuyến khứ hồi bao trùm (ví dụ Trạm Cân 1 ➔ Đội 1 ➔ Trạm Cân 1)
      if (
        (normName.includes(normFrom) || (fromHub && normName.includes(normalizeText(fromHub.shortName)))) &&
        (normName.includes(normTo) || (toHub && normName.includes(normalizeText(toHub.shortName))))
      ) {
        score += 40;
      }
    }

    if (score > maxScore) {
      maxScore = score;
      bestRoute = r;
      bestReason = reasons.length > 0 ? reasons.join(' + ') : 'Tuyến quy chuẩn gần nhất';
    }
  }

  return {
    route: bestRoute,
    score: maxScore,
    reason: bestReason,
    matchedFromHub: fromHub,
    matchedToHub: toHub,
  };
}

/**
 * Kiểm tra 2 yêu cầu có chung cung đường / tương thích lộ trình hay không
 */
export function areRequestsRouteCompatible(
  r1: TransportRequest,
  r2: TransportRequest,
  routes: StandardRoute[]
): boolean {
  // 1. Cùng chọn mã tuyến nếu có
  if (r1.standardRouteId && r2.standardRouteId && r1.standardRouteId === r2.standardRouteId) {
    return true;
  }

  // 2. Trực tiếp trùng điểm đi & điểm đến
  const nFrom1 = normalizeText(r1.fromLocation);
  const nTo1 = normalizeText(r1.toLocation);
  const nFrom2 = normalizeText(r2.fromLocation);
  const nTo2 = normalizeText(r2.toLocation);

  if (nFrom1 === nFrom2 && nTo1 === nTo2) {
    return true;
  }

  // 3. Cùng chung lộ trình quy chuẩn được gợi ý
  if (routes && routes.length > 0) {
    const match1 = suggestOptimalRoute(routes, r1.fromLocation, r1.toLocation);
    const match2 = suggestOptimalRoute(routes, r2.fromLocation, r2.toLocation);
    if (match1.route.id === match2.route.id) {
      return true;
    }
  }

  // 4. Chung điểm xuất phát và cùng hướng hành lang
  if (nFrom1 === nFrom2) {
    return true;
  }

  return false;
}
