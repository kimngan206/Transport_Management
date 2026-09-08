<script setup lang="ts">
import { ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useFleetStore } from '@/stores/fleet';
import StandardRoutesMap from '@/components/routes/StandardRoutesMap.vue';
import { Plus, ShieldCheck, MapPin, Table as TableIcon } from 'lucide-vue-next';

const route = useRoute();
const router = useRouter();
const fleetStore = useFleetStore();

// Chế độ xem: 'map' (Bản đồ số GIS & Tuyến đường GPS quy chuẩn) hoặc 'table' (Bảng chi tiết danh mục)
const viewMode = ref<'map' | 'table'>((route.query.view as string) === 'table' ? 'table' : 'map');
const selectedRouteCode = ref<string>((route.query.route as string) || '');
const routesMapRef = ref<InstanceType<typeof StandardRoutesMap> | null>(null);

watch(
  () => route.query.view,
  (newVal) => {
    viewMode.value = newVal === 'table' ? 'table' : 'map';
    if (viewMode.value === 'map') {
      setTimeout(() => {
        routesMapRef.value?.invalidateSize();
      }, 120);
    }
  }
);

function switchView(mode: 'map' | 'table') {
  viewMode.value = mode;
  router.replace({ query: { ...route.query, view: mode } });
  if (mode === 'map') {
    setTimeout(() => {
      routesMapRef.value?.invalidateSize();
    }, 120);
  }
}

function viewRouteOnMap(routeCode: string) {
  selectedRouteCode.value = routeCode;
  switchView('map');
  setTimeout(() => {
    routesMapRef.value?.selectRoute(routeCode);
  }, 100);
}

function openAddRouteModal() {
  if (viewMode.value === 'map' && routesMapRef.value) {
    routesMapRef.value.openAddRouteModal();
  } else {
    switchView('map');
    setTimeout(() => {
      routesMapRef.value?.openAddRouteModal();
    }, 150);
  }
}
</script>

<template>
  <div class="routes-page">
    <div class="page-header">
      <div>
        <h1 class="page-title">Tuyến Đường Quy Chuẩn</h1>
        <p class="page-subtitle">
          Bản đồ số GIS & danh mục định lượng khoảng cách chuẩn phục vụ tính định mức dầu và chống gian lận ODO
        </p>
      </div>

      <div class="header-actions">
        <router-link to="/hubs" class="btn btn-secondary">
          <MapPin :size="16" />
          <span>Quản Lý Điểm Trạm / Hubs</span>
        </router-link>

        <button class="btn btn-primary" @click="openAddRouteModal">
          <Plus :size="16" />
          <span>Cài Đặt Tuyến Mới (GPS)</span>
        </button>
      </div>
    </div>

    <!-- Bộ chuyển đổi chế độ xem -->
    <div class="view-mode-tabs mb-4">
      <button
        class="tab-btn"
        :class="{ active: viewMode === 'map' }"
        @click="switchView('map')"
      >
        <MapPin :size="16" />
        <span>Bản Đồ GPS & Tuyến Quy Chuẩn (GIS)</span>
      </button>
      <button
        class="tab-btn"
        :class="{ active: viewMode === 'table' }"
        @click="switchView('table')"
      >
        <TableIcon :size="16" />
        <span>Danh Sách Dạng Bảng Chi Tiết</span>
      </button>
    </div>

    <!-- 1. CHẾ ĐỘ XEM BẢN ĐỒ GPS & QUY CHUẨN GIS -->
    <div v-show="viewMode === 'map'">
      <StandardRoutesMap
        ref="routesMapRef"
        :initial-selected-route-code="selectedRouteCode"
      />
    </div>

    <!-- 2. CHẾ ĐỘ XEM BẢNG DANH MỤC -->
    <div v-show="viewMode === 'table'">
      <!-- Banner giải thích nghiệp vụ -->
      <div class="rule-banner card mb-4">
        <div class="rule-banner-icon">
          <ShieldCheck :size="24" class="text-primary" />
        </div>
        <div class="rule-banner-content">
          <h4 class="rule-banner-title">Quy Chuẩn Kiểm Soát Cự Ly Tuyến Đường:</h4>
          <p class="rule-banner-text">
            Hệ thống bắt buộc áp dụng cự ly quy chuẩn được đo đạc chính xác từ trước giữa các điểm Trạm cân ➔ Đội sản xuất ➔ Nhà máy chế biến.
            Khi Điều phối viên hoặc Tài xế chọn tuyến (ví dụ <code>TC1-D1-TC1</code>), hệ thống sẽ tự động gán cự ly chuẩn <strong>26 km</strong>,
            không cho phép nhập tự do nhằm ngăn chặn việc gian lận số km để trục lợi nhiên liệu.
          </p>
        </div>
      </div>

      <!-- Bảng danh sách tuyến -->
      <div class="card">
        <div class="card-header flex-between">
          <h3 class="card-title">Danh Sách Tuyến Đường Được Phê Duyệt</h3>
          <span class="badge-total">{{ fleetStore.routes.length }} tuyến</span>
        </div>

        <div class="table-container">
          <table class="table">
            <thead>
              <tr>
                <th>Mã Tuyến (RouteCode)</th>
                <th>Tên Cung Đường</th>
                <th>Điểm Đầu</th>
                <th>Điểm Cuối</th>
                <th>Cự Ly Quy Chuẩn</th>
                <th>Mô Tả Nghiệp Vụ</th>
                <th class="text-center">Thao Tác</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in fleetStore.routes" :key="r.id">
                <td><span class="route-code-tag">{{ r.routeCode }}</span></td>
                <td><strong>{{ r.name }}</strong></td>
                <td>{{ r.startPoint }}</td>
                <td>{{ r.endPoint }}</td>
                <td>
                  <span class="distance-badge">{{ r.standardDistanceKm }} km</span>
                </td>
                <td class="text-muted text-sm">{{ r.description }}</td>
                <td class="text-center">
                  <button class="btn btn-outline btn-sm" @click="viewRouteOnMap(r.routeCode)" title="Xem vị trí GPS trên bản đồ">
                    <MapPin :size="14" />
                    <span>Xem GPS</span>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
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
  align-items: center;
  gap: 10px;
}

/* Tabs */
.view-mode-tabs {
  display: inline-flex;
  background: #f1f5f9;
  padding: 4px;
  border-radius: var(--radius-md);
  gap: 4px;
  border: 1px solid var(--border-card);
}
.tab-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: var(--radius-sm);
  border: none;
  background: transparent;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s ease;
}
.tab-btn:hover {
  color: var(--text-primary);
}
.tab-btn.active {
  background: #ffffff;
  color: #15803d;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.rule-banner {
  display: flex;
  gap: 16px;
  padding: 16px 20px;
  background: #f0fdf4;
  border: 1px solid #86efac;
  align-items: flex-start;
}
.rule-banner-icon {
  margin-top: 2px;
}
.rule-banner-title {
  font-size: 0.875rem;
  font-weight: 700;
  color: #166534;
  margin-bottom: 4px;
}
.rule-banner-text {
  font-size: 0.8125rem;
  color: #14532d;
  line-height: 1.5;
}
.route-code-tag {
  background: #e2e8f0;
  color: #0f172a;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 0.8125rem;
}
.distance-badge {
  background: #dcfce7;
  color: #15803d;
  font-weight: 800;
  padding: 3px 10px;
  border-radius: 20px;
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
.btn-outline {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: #ffffff;
  border: 1px solid #cbd5e1;
  color: #15803d;
  font-weight: 700;
  font-size: 0.75rem;
  padding: 4px 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s;
}
.btn-outline:hover {
  background: #f0fdf4;
  border-color: #16a34a;
}
.flex-between {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.text-center { text-align: center; }
.font-bold { font-weight: 700; }
.text-primary { color: #15803d; }
.text-muted { color: var(--text-muted); }
.text-sm { font-size: 0.8125rem; }
.mb-4 { margin-bottom: 20px; }
</style>
