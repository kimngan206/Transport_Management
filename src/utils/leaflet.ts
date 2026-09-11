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

// Phòng thủ toàn diện chống lỗi "_latLngToNewLayerPoint of null" khi zoom
// Phòng thủ toàn diện chống lỗi "_latLngToNewLayerPoint of null" khi zoom
// Xảy ra khi marker, popup hoặc tooltip đã bị gỡ khỏi map (hoặc trong chu kỳ tái tạo DOM / Vue proxy)
// nhưng sự kiện zoomanim vẫn phát tín hiệu
if (typeof L !== 'undefined') {
  if (L.Marker && (L.Marker.prototype as any)._animateZoom) {
    const origMarkerAnimateZoom = (L.Marker.prototype as any)._animateZoom;
    (L.Marker.prototype as any)._animateZoom = function (opt: any) {
      if (!this._map) return;
      try {
        return origMarkerAnimateZoom.call(this, opt);
      } catch (err) {
        return;
      }
    };
  }

  if (L.Popup && (L.Popup.prototype as any)._animateZoom) {
    const origPopupAnimateZoom = (L.Popup.prototype as any)._animateZoom;
    (L.Popup.prototype as any)._animateZoom = function (e: any) {
      if (!this._map) return;
      try {
        return origPopupAnimateZoom.call(this, e);
      } catch (err) {
        return;
      }
    };
  }

  if (L.Tooltip && (L.Tooltip.prototype as any)._animateZoom) {
    const origTooltipAnimateZoom = (L.Tooltip.prototype as any)._animateZoom;
    (L.Tooltip.prototype as any)._animateZoom = function (e: any) {
      if (!this._map) return;
      try {
        return origTooltipAnimateZoom.call(this, e);
      } catch (err) {
        return;
      }
    };
  }

  // Bảo vệ chuỗi loop fire('zoomanim'): Không để bất kỳ lỗi nào của 1 listener làm ngắt việc cập nhật vị trí của các pin/marker khác
  if (L.Evented && (L.Evented.prototype as any).fire) {
    const origFire = (L.Evented.prototype as any).fire;
    (L.Evented.prototype as any).fire = function (type: string, data?: any, propagate?: boolean) {
      if (type === 'zoomanim' && (this as any)._events && (this as any)._events[type]) {
        const listeners = (this as any)._events[type].slice();
        (this as any)._firingCount = ((this as any)._firingCount || 0) + 1;
        const event = (L.Util as any).extend({}, data, {
          type,
          target: this,
          sourceTarget: (data && data.sourceTarget) || this,
        });
        for (let i = 0; i < listeners.length; i++) {
          try {
            listeners[i].fn.call(listeners[i].ctx, event);
          } catch (err) {
            // Cách ly lỗi để đảm bảo toàn bộ marker còn lại vẫn nhận tọa độ mới
          }
        }
        (this as any)._firingCount--;
        if (propagate && (this as any)._propagateEvent) {
          (this as any)._propagateEvent(event);
        }
        return this;
      }
      return origFire.call(this, type, data, propagate);
    };
  }
}

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
 * Mặc định sử dụng Google Maps Đường bộ: Chi tiết giao thông sắc nét, 100% tiếng Việt chuẩn, không có watermark API KEY.
 */
export function createTileLayer(style: 'google_streets' | 'google_hybrid' | 'osm' | 'topo' | string = 'google_streets'): L.TileLayer {
  if (style === 'google_hybrid' || style === 'topo') {
    // Google Maps Vệ Tinh Lai (Satellite ảnh chụp thực địa + nhãn đường xá tiếng Việt chuẩn)
    return L.tileLayer('https://mt{s}.google.com/vt/lyrs=y&hl=vi&gl=VN&x={x}&y={y}&z={z}', {
      maxZoom: 20,
      subdomains: ['0', '1', '2', '3'],
      attribution: '&copy; Google Maps Vệ Tinh | ECOTECH 2A Fleet GIS',
    });
  }

  if (style === 'osm') {
    // OpenStreetMap tiêu chuẩn sạch
    return L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap | ECOTECH 2A',
    });
  }

  // Mặc định: Google Maps Giao Thông Đường Bộ chuẩn tiếng Việt có dấu
  return L.tileLayer('https://mt{s}.google.com/vt/lyrs=m&hl=vi&gl=VN&x={x}&y={y}&z={z}', {
    maxZoom: 20,
    subdomains: ['0', '1', '2', '3'],
    attribution: '&copy; Google Maps Giao Thông | ECOTECH 2A Fleet GIS',
  });
}

export default L;
export { L };
