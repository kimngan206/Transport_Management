import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Khắc phục đường dẫn icon mặc định của Leaflet trong môi trường Vite bundler
try {
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  });
} catch (e) {}

/**
 * Khởi tạo Leaflet map an toàn trên DOM element container.
 * Tự động xóa _leaflet_id và dọn dẹp map instance cũ nếu có
 * để triệt tiêu hoàn toàn lỗi "Error: Map container is already initialized."
 */
export function safeInitMap(
  container: HTMLElement,
  options?: L.MapOptions
): L.Map {
  if (!container) {
    throw new Error('safeInitMap: container element is null or undefined');
  }

  // Nếu container đã có thuộc tính _leaflet_id từ lần mount trước
  if ((container as any)._leaflet_id) {
    try {
      delete (container as any)._leaflet_id;
    } catch (e) {}
  }

  return L.map(container, options);
}

/**
 * Tạo lớp bản đồ vệ tinh / GIS chuẩn hóa
 * Mặc định sử dụng CartoDB Voyager: Tốc độ cao, đường nét sắc sảo, không bị chặn CORS/403 như OpenStreetMap raw.
 */
export function createTileLayer(style: 'osm' | 'topo' = 'osm'): L.TileLayer {
  if (style === 'topo') {
    return L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
      maxZoom: 17,
      subdomains: ['a', 'b', 'c'],
      attribution: '&copy; OpenTopoMap & OpenStreetMap | ECOTECH 2A',
    });
  }

  // CartoDB Voyager - Ổn định và hiển thị địa danh tiếng Việt chuẩn xác
  return L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    maxZoom: 19,
    subdomains: ['a', 'b', 'c', 'd'],
    attribution: '&copy; CartoDB & OpenStreetMap | ECOTECH 2A Fleet GIS',
  });
}

export default L;
export { L };
