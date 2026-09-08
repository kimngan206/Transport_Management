<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useBookingStore } from '@/stores/booking';
import { useFleetStore } from '@/stores/fleet';
import { useDriverStore } from '@/stores/driver';
import { useDialogStore } from '@/stores/dialog';
import { mockStorage } from '@/services/mockStorage';
import {
  LayoutDashboard,
  CalendarCheck,
  Layers,
  Car,
  Truck,
  MapPin,
  Wrench,
  BarChart3,
  Settings,
  ChevronDown,
  ChevronRight,
  Filter,
  LogOut,
  RotateCcw,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-vue-next';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const bookingStore = useBookingStore();
const fleetStore = useFleetStore();
const driverStore = useDriverStore();
const dialog = useDialogStore();

// Trạng thái đóng/mở Menu Sidebar
const isSidebarCollapsed = ref(localStorage.getItem('qldv_sidebar_collapsed') === 'true');

function toggleSidebar() {
  isSidebarCollapsed.value = !isSidebarCollapsed.value;
  localStorage.setItem('qldv_sidebar_collapsed', String(isSidebarCollapsed.value));
}

function goToLogin() {
  router.push('/login');
}

function handleResetData() {
  dialog.showConfirm({
    title: 'Đặt Lại Dữ Liệu Mẫu?',
    message: 'Hành động này sẽ khôi phục lại toàn bộ xe, tài xế, yêu cầu và trạm về trạng thái ban đầu.',
    confirmText: 'Xác nhận đặt lại',
    cancelText: 'Hủy bỏ',
    onConfirm: () => {
      mockStorage.resetAll();
      window.location.reload();
    },
  });
}

// Chế độ lọc menu theo vai trò (Bật mặc định theo Rule trang 42)
const filterByRole = ref(true);

// Trạng thái mở từng nhóm accordion
const openGroups = ref<Record<string, boolean>>({
  booking: true,
  dispatch: true,
  fleet: true,
  routes: false,
  operations: true,
  maintenance: false,
  reports: false,
  system: false,
});

watch(
  () => route.path,
  (path) => {
    if (path.startsWith('/maintenance')) {
      openGroups.value.maintenance = true;
    }
    if (path.startsWith('/fleet')) {
      openGroups.value.fleet = true;
    }
    if (path.startsWith('/routes') || path.startsWith('/hubs')) {
      openGroups.value.routes = true;
    }
  },
  { immediate: true }
);

function toggleGroup(key: string) {
  if (isSidebarCollapsed.value) {
    isSidebarCollapsed.value = false;
    localStorage.setItem('qldv_sidebar_collapsed', 'false');
  }
  openGroups.value[key] = !openGroups.value[key];
}

// Badges thông báo
const pendingCount = computed(() => bookingStore.pendingRequests.length);
const approvedCount = computed(() => bookingStore.approvedRequests.length);
const dueMaintCount = computed(() => fleetStore.dueMaintenanceVehicles.length);
const myTripsCount = computed(() => driverStore.myTrips.filter((t) => t.status !== 'COMPLETED').length);

// Kiểm tra quyền hiển thị từng nhóm menu (Role-based Navigation - Trang 42)
const showSection = computed(() => {
  if (!filterByRole.value) {
    return {
      dashboard: true,
      booking: true,
      approval: true,
      dispatch: true,
      fleet: true,
      routes: true,
      operations: true,
      maintenance: true,
      reports: true,
      system: true,
    };
  }

  const role = authStore.activeRole;
  if (role === 'Admin') {
    return {
      dashboard: true,
      booking: true,
      approval: true,
      dispatch: true,
      fleet: true,
      routes: true,
      operations: true,
      maintenance: true,
      reports: true,
      system: true,
    };
  }

  if (role === 'Requester') {
    return {
      dashboard: false,
      booking: true,
      approval: false,
      dispatch: false,
      fleet: false,
      routes: false,
      operations: false,
      maintenance: false,
      reports: false,
      system: false,
    };
  }

  if (role === 'Approver') {
    return {
      dashboard: false,
      booking: false,
      approval: true,
      dispatch: false,
      fleet: false,
      routes: false,
      operations: false,
      maintenance: false,
      reports: false,
      system: false,
    };
  }

  if (role === 'Dispatcher') {
    return {
      dashboard: true,
      booking: false,
      approval: false,
      dispatch: true,
      fleet: true,
      routes: true,
      operations: true,
      maintenance: true,
      reports: true,
      system: false,
    };
  }

  if (role === 'Driver') {
    return {
      dashboard: false,
      booking: false,
      approval: false,
      dispatch: false,
      fleet: false,
      routes: false,
      operations: true,
      maintenance: true,
      reports: false,
      system: false,
    };
  }

  return {
    dashboard: false,
    booking: true,
    approval: false,
    dispatch: false,
    fleet: false,
    routes: false,
    operations: false,
    maintenance: false,
    reports: false,
    system: false,
  };
});
</script>

<template>
  <div class="app-layout-container">
    <!-- Header Top Bar Thanh Lịch Chuẩn Doanh Nghiệp ECOTECH 2A -->
    <header class="app-top-header">
      <div class="header-left-brand">
        <!-- Nút Đóng / Mở Menu Sidebar Trên Header -->
        <button
          class="btn-header-toggle-sidebar"
          @click="toggleSidebar"
          :title="isSidebarCollapsed ? 'Mở rộng menu điều hướng' : 'Thu gọn menu điều hướng'"
        >
          <Menu :size="18" />
        </button>

        <div class="header-logo-box">
          <img src="/logo.png" alt="ECOTECH 2A Logo" class="header-logo-img" />
        </div>
        <div class="brand-title-group">
          <span class="brand-name">ECOTECH 2A</span>
          <span class="brand-corp">HỆ THỐNG ĐIỀU ĐỘ ĐỘI XE & MỦ CAO SU</span>
        </div>
      </div>

      <div class="header-right-actions">
        <!-- Nút Reset Mock Dữ Liệu -->
        <button class="btn-header-reset" @click="handleResetData" title="Khôi phục dữ liệu mẫu gốc">
          <RotateCcw :size="12" class="reset-ico" />
          <span>Reset Dữ Liệu</span>
        </button>

        <!-- Thẻ người dùng hiện hành -->
        <div class="current-user-badge">
          <img :src="authStore.currentUser.avatarUrl" alt="Avatar" class="user-avatar-mini" />
          <div class="user-meta-info">
            <span class="user-name-text">{{ authStore.currentUser.fullName }}</span>
            <span class="user-role-text">{{ authStore.activeRole }}</span>
          </div>
        </div>

        <!-- Nút Đổi Vai Trò / Đăng Xuất đưa về /login -->
        <button class="btn-header-switch-role" @click="goToLogin" title="Đổi sang vai trò nhân sự khác">
          <LogOut :size="13" />
          <span>Đổi vai trò</span>
        </button>
      </div>
    </header>

    <div class="app-main-layout">
      <!-- Sidebar hoàn thiện theo chuẩn ngành chế biến cao su -->
      <aside class="app-sidebar" :class="{ 'is-collapsed': isSidebarCollapsed }">
        <!-- Header phụ của Sidebar: Định danh đơn vị sản xuất cao su -->
        <div class="sidebar-workspace-header">
          <div class="workspace-brand-badge" :title="'ECOTECH 2A'">
            <img src="/logo.png" alt="ECOTECH 2A" class="sidebar-logo-img" />
          </div>
          <div v-if="!isSidebarCollapsed" class="workspace-info">
            <span class="workspace-name">ECOTECH 2A</span>
            <span class="workspace-branch">Đội Xe Mủ & Cơ Giới Nông Trường</span>
          </div>
          <button
            class="btn-sidebar-collapse"
            @click="toggleSidebar"
            :title="isSidebarCollapsed ? 'Mở rộng menu' : 'Thu gọn menu'"
          >
            <PanelLeftClose v-if="!isSidebarCollapsed" :size="15" />
            <PanelLeftOpen v-else :size="15" />
          </button>
        </div>

        <nav class="sidebar-nav-scroll">
          <!-- SECTION 1: TỔNG QUAN -->
          <template v-if="showSection.dashboard">
            <div class="menu-section-label">Trung Tâm Điều Hành</div>
            <router-link to="/" class="nav-root-link" :class="{ active: route.path === '/' }" :title="'Dashboard Sản Lượng & Xe'">
              <LayoutDashboard :size="17" class="nav-icon" />
              <span>Dashboard Sản Lượng & Xe</span>
            </router-link>
          </template>

          <!-- SECTION 2: NGHIỆP VỤ ĐIỀU ĐỘ -->
          <div
            v-if="showSection.booking || showSection.approval || showSection.dispatch || showSection.fleet || showSection.routes"
            class="menu-section-label"
          >
            Nghiệp Vụ Điều Độ
          </div>

          <!-- 1. ĐẶT XE & PHÊ DUYỆT -->
          <div v-if="showSection.booking || showSection.approval" class="menu-group">
            <button class="group-btn" @click="toggleGroup('booking')" :title="'Đặt Xe Công Tác & Mủ'">
              <span class="group-btn-title">
                <CalendarCheck :size="17" class="nav-icon" />
                <span>{{ !showSection.booking && showSection.approval ? 'Phê Duyệt Đặt Xe' : 'Đặt Xe Công Tác & Mủ' }}</span>
              </span>
              <div class="group-btn-right">
                <span v-if="pendingCount > 0 && showSection.approval" class="mini-badge badge-amber">{{ pendingCount }}</span>
                <ChevronDown v-if="openGroups.booking" :size="13" />
                <ChevronRight v-else :size="13" />
              </div>
            </button>

            <div v-show="openGroups.booking" class="sub-links-list">
              <router-link
                v-if="showSection.booking"
                to="/booking"
                class="sub-nav-link"
                :class="{ active: route.path === '/booking' }"
              >
                <span>Đặt xe</span>
              </router-link>

              <router-link
                v-if="showSection.approval"
                to="/approval"
                class="sub-nav-link"
                :class="{ active: route.path === '/approval' }"
              >
                <span>Phê duyệt đặt xe</span>
                <span v-if="pendingCount > 0" class="mini-badge badge-amber">{{ pendingCount }}</span>
              </router-link>
            </div>
          </div>

          <!-- 2. ĐIỀU VẬN -->
          <div v-if="showSection.dispatch" class="menu-group">
            <button class="group-btn" @click="toggleGroup('dispatch')">
              <span class="group-btn-title">
                <Layers :size="17" class="nav-icon" />
                <span>Điều Phối Chuyến</span>
              </span>
              <div class="group-btn-right">
                <span v-if="approvedCount > 0" class="mini-badge badge-blue">{{ approvedCount }}</span>
                <ChevronDown v-if="openGroups.dispatch" :size="13" />
                <ChevronRight v-else :size="13" />
              </div>
            </button>

            <div v-show="openGroups.dispatch" class="sub-links-list">
              <router-link to="/dispatch" class="sub-nav-link" :class="{ active: route.path === '/dispatch' && (!route.query.view || route.query.view === 'map') }">
                <span>Bản đồ & Lộ trình xe</span>
              </router-link>
              <router-link to="/dispatch?view=board" class="sub-nav-link" :class="{ active: route.path === '/dispatch' && route.query.view === 'board' }">
                <span>Bảng điều phối thẻ</span>
              </router-link>
            </div>
          </div>

          <!-- 3. ĐỘI XE -->
          <div v-if="showSection.fleet" class="menu-group">
            <button class="group-btn" @click="toggleGroup('fleet')">
              <span class="group-btn-title">
                <Truck :size="17" class="nav-icon" />
                <span>Đội Xe & Thiết Bị</span>
              </span>
              <div class="group-btn-right">
                <ChevronDown v-if="openGroups.fleet" :size="13" />
                <ChevronRight v-else :size="13" />
              </div>
            </button>

            <div v-show="openGroups.fleet" class="sub-links-list">
              <router-link to="/fleet?tab=vehicles" class="sub-nav-link" :class="{ active: route.path === '/fleet' && (!route.query.tab || route.query.tab === 'vehicles') }">
                <span>Danh sách phương tiện</span>
              </router-link>

              <router-link to="/fleet/types" class="sub-nav-link" :class="{ active: route.path === '/fleet/types' }">
                <span>Danh sách loại xe</span>
              </router-link>

              <router-link to="/fleet?tab=drivers" class="sub-nav-link" :class="{ active: route.path === '/fleet' && route.query.tab === 'drivers' }">
                <span>Danh sách tài xế</span>
              </router-link>

              <router-link to="/fleet?tab=handover" class="sub-nav-link" :class="{ active: route.path === '/fleet' && route.query.tab === 'handover' }">
                <span>Bàn giao / Mượn trả xe</span>
              </router-link>
            </div>
          </div>

          <!-- 4. TUYẾN ĐƯỜNG -->
          <div v-if="showSection.routes" class="menu-group">
            <button class="group-btn" @click="toggleGroup('routes')">
              <span class="group-btn-title">
                <MapPin :size="17" class="nav-icon" />
                <span>Tuyến Đường</span>
              </span>
              <div class="group-btn-right">
                <ChevronDown v-if="openGroups.routes" :size="13" />
                <ChevronRight v-else :size="13" />
              </div>
            </button>

            <div v-show="openGroups.routes" class="sub-links-list">
              <router-link to="/routes" class="sub-nav-link" :class="{ active: route.path === '/routes' }">
                <span>Tuyến đường quy chuẩn</span>
              </router-link>

              <router-link to="/hubs" class="sub-nav-link" :class="{ active: route.path === '/hubs' }">
                <span>Điểm trạm & Nông trường</span>
              </router-link>
            </div>
          </div>

          <!-- 5. VẬN HÀNH TÀI XẾ -->
          <div v-if="showSection.operations" class="menu-group">
            <button class="group-btn" @click="toggleGroup('operations')">
              <span class="group-btn-title">
                <Car :size="17" class="nav-icon" />
                <span>Vận Hành Tài Xế</span>
              </span>
              <div class="group-btn-right">
                <span v-if="myTripsCount > 0" class="mini-badge badge-green">{{ myTripsCount }}</span>
                <ChevronDown v-if="openGroups.operations" :size="13" />
                <ChevronRight v-else :size="13" />
              </div>
            </button>

            <div v-show="openGroups.operations" class="sub-links-list">
              <router-link to="/driver-schedule" class="sub-nav-link" :class="{ active: route.path === '/driver-schedule' }">
                <span>Lịch trình nhận xe</span>
              </router-link>
            </div>
          </div>

          <!-- SECTION 3: BẢO DƯỠNG & BÁO CÁO -->
          <div
            v-if="showSection.maintenance || showSection.reports || showSection.operations"
            class="menu-section-label"
          >
            Bảo Trì & Báo Cáo
          </div>

          <!-- 6. BẢO DƯỠNG -->
          <div v-if="showSection.maintenance" class="menu-group">
            <button class="group-btn" @click="toggleGroup('maintenance')">
              <span class="group-btn-title">
                <Wrench :size="17" class="nav-icon" />
                <span>Bảo Dưỡng & Sự Cố</span>
              </span>
              <div class="group-btn-right">
                <span v-if="dueMaintCount > 0" class="mini-badge badge-red">{{ dueMaintCount }}</span>
                <ChevronDown v-if="openGroups.maintenance" :size="13" />
                <ChevronRight v-else :size="13" />
              </div>
            </button>

            <div v-show="openGroups.maintenance" class="sub-links-list">
              <router-link to="/maintenance" class="sub-nav-link" :class="{ active: route.path === '/maintenance' }">
                <span>Cảnh báo bảo dưỡng</span>
                <span v-if="dueMaintCount > 0" class="mini-badge badge-red">{{ dueMaintCount }}</span>
              </router-link>
              <router-link to="/maintenance/types" class="sub-nav-link" :class="{ active: route.path === '/maintenance/types' }">
                <span>Loại bảo dưỡng</span>
              </router-link>
            </div>
          </div>

          <!-- 7. BÁO CÁO -->
          <div v-if="showSection.reports" class="menu-group">
            <button class="group-btn" @click="toggleGroup('reports')">
              <span class="group-btn-title">
                <BarChart3 :size="17" class="nav-icon" />
                <span>Báo Cáo Đối Chiếu</span>
              </span>
              <div class="group-btn-right">
                <ChevronDown v-if="openGroups.reports" :size="13" />
                <ChevronRight v-else :size="13" />
              </div>
            </button>

            <div v-show="openGroups.reports" class="sub-links-list">
              <router-link to="/reports" class="sub-nav-link" :class="{ active: route.path === '/reports' }">
                <span>Đối chiếu nhiên liệu</span>
              </router-link>
            </div>
          </div>

          <!-- SECTION 4: HỆ THỐNG -->
          <div v-if="showSection.system" class="menu-section-label">Hệ Thống</div>

          <!-- 8. HỆ THỐNG -->
          <div v-if="showSection.system" class="menu-group">
            <button class="group-btn" @click="toggleGroup('system')">
              <span class="group-btn-title">
                <Settings :size="17" class="nav-icon" />
                <span>Quản Trị Hệ Thống</span>
              </span>
              <div class="group-btn-right">
                <ChevronDown v-if="openGroups.system" :size="13" />
                <ChevronRight v-else :size="13" />
              </div>
            </button>

            <div v-show="openGroups.system" class="sub-links-list">
              <router-link to="/system" class="sub-nav-link" :class="{ active: route.path === '/system' }">
                <span>Người dùng & Vai trò</span>
              </router-link>
            </div>
          </div>
        </nav>

        <!-- Footer Sidebar với Profile & Nút lọc Role tinh gọn -->
        <div class="sidebar-bottom-panel">
          <div class="role-filter-row">
            <button
              class="btn-subtle-filter"
              :class="{ active: filterByRole }"
              @click="filterByRole = !filterByRole"
            >
              <Filter :size="11" />
              <span>Lọc Role: <strong>{{ filterByRole ? authStore.activeRole : 'Tất cả' }}</strong></span>
            </button>
          </div>

          <div class="user-profile-strip">
            <div class="avatar-wrap-active">
              <img :src="authStore.currentUser.avatarUrl" alt="Avatar" class="avatar-img" />
              <span class="online-indicator"></span>
            </div>
            <div class="user-text-info">
              <span class="user-display-name">{{ authStore.currentUser.fullName }}</span>
              <span class="user-display-dept">{{ authStore.currentUser.departmentName }}</span>
            </div>
          </div>
        </div>
      </aside>

      <!-- Vùng nội dung chính -->
      <main class="app-content-viewport">
        <router-view />
      </main>
    </div>
  </div>
</template>

<style scoped>
.app-layout-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}

/* Header Top Bar Thanh Lịch - Tone Xanh Rừng Cao Su & Nền Cạo Mủ Cao Su Chân Thực */
.app-top-header {
  height: 52px;
  background: 
    linear-gradient(90deg, rgba(10, 24, 16, 0.91) 0%, rgba(15, 36, 24, 0.86) 50%, rgba(10, 24, 16, 0.91) 100%),
    url('/images/images.jpg') center 35% / cover no-repeat;
  border-bottom: 1px solid rgba(255, 255, 255, 0.09);
  padding: 0 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: relative;
  z-index: 1000;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.18);
  flex-shrink: 0;
  backdrop-filter: blur(3px);
}

.header-left-brand {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-logo-box {
  width: 34px;
  height: 34px;
  border-radius: 8px;
  background: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 3px;
  box-shadow: 0 1px 5px rgba(0, 0, 0, 0.25);
  flex-shrink: 0;
}

.header-logo-img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.brand-title-group {
  display: flex;
  flex-direction: column;
}

.brand-name {
  font-size: 0.9375rem;
  font-weight: 800;
  color: #ffffff;
  letter-spacing: 0.04em;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
}

.brand-corp {
  font-size: 0.625rem;
  font-weight: 700;
  color: #a3c4b0;
  letter-spacing: 0.05em;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

.header-right-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.btn-header-reset {
  display: flex;
  align-items: center;
  gap: 5px;
  background: rgba(239, 68, 68, 0.18);
  border: 1px solid rgba(239, 68, 68, 0.32);
  color: #fecaca;
  padding: 5px 11px;
  border-radius: 6px;
  font-size: 0.6875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
}

.btn-header-reset:hover {
  background: rgba(239, 68, 68, 0.3);
  color: #ffffff;
  border-color: rgba(239, 68, 68, 0.6);
}

.current-user-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid rgba(255, 255, 255, 0.15);
  padding: 3px 11px 3px 4px;
  border-radius: 999px;
  backdrop-filter: blur(6px);
}

.user-avatar-mini {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  object-fit: cover;
  border: 1.5px solid rgba(255, 255, 255, 0.4);
}

.user-meta-info {
  display: flex;
  align-items: center;
  gap: 6px;
}

.user-name-text {
  font-size: 0.75rem;
  font-weight: 700;
  color: #f1f5f9;
}

.user-role-text {
  font-size: 0.625rem;
  font-weight: 700;
  background: #144629;
  color: #d1fae5;
  border: 1px solid rgba(74, 222, 128, 0.3);
  padding: 1px 6px;
  border-radius: 4px;
}

.btn-header-switch-role {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #166534;
  border: 1px solid #22c55e;
  color: #ffffff;
  padding: 5px 12px;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  font-family: inherit;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
}

.btn-header-switch-role:hover {
  background: #15803d;
  box-shadow: 0 2px 8px rgba(22, 101, 52, 0.4);
  transform: translateY(-1px);
}

.app-main-layout {
  display: flex;
  flex: 1;
  height: calc(100vh - 52px);
  overflow: hidden;
}

/* Sidebar Nền Cạo Mủ Cao Su Thực Tế & Lớp Màn Đen Mờ */
.app-sidebar {
  width: 256px;
  background: 
    linear-gradient(180deg, rgba(8, 20, 14, 0.89) 0%, rgba(12, 28, 19, 0.85) 45%, rgba(6, 16, 11, 0.92) 100%),
    url('/images/images.jpg') center top / cover no-repeat;
  color: #f1f5f9;
  display: flex;
  flex-direction: column;
  border-right: 1px solid rgba(255, 255, 255, 0.08);
  height: 100%;
  flex-shrink: 0;
  user-select: none;
  box-shadow: 3px 0 14px rgba(0, 0, 0, 0.2);
  scrollbar-width: none;
  -ms-overflow-style: none;
  position: relative;
}

.app-sidebar::-webkit-scrollbar {
  display: none;
  width: 0;
  height: 0;
}

/* Header phụ của Sidebar */
.sidebar-workspace-header {
  padding: 14px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  display: flex;
  align-items: center;
  gap: 10px;
  background: rgba(255, 255, 255, 0.02);
}

.workspace-brand-badge {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 3px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
  flex-shrink: 0;
}

.sidebar-logo-img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.workspace-info {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.workspace-name {
  font-size: 0.75rem;
  font-weight: 700;
  color: #ffffff;
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
}

.workspace-branch {
  font-size: 0.625rem;
  color: #8fa898;
  font-weight: 600;
}

.sidebar-nav-scroll {
  padding: 10px 10px;
  display: flex;
  flex-direction: column;
  gap: 3px;
  flex: 1;
  overflow-y: auto;
  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none; /* IE and Edge */
}

.sidebar-nav-scroll::-webkit-scrollbar {
  display: none; /* Chrome, Safari, Opera */
  width: 0;
  height: 0;
}

/* Section Header Label - Xanh Rêu Phấn Dịu Mắt */
.menu-section-label {
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: #8fa898;
  padding: 12px 12px 6px;
}

/* Nav root link */
.nav-root-link {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  border-radius: 8px;
  color: #cbd5e1;
  text-decoration: none;
  font-size: 0.8125rem;
  font-weight: 600;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  margin-bottom: 2px;
}

.nav-root-link:hover {
  background-color: rgba(255, 255, 255, 0.07);
  color: #ffffff;
}

.nav-root-link.active {
  background: rgba(34, 197, 94, 0.16);
  color: #ffffff;
  border: 1px solid rgba(74, 222, 128, 0.3);
  font-weight: 700;
}

/* Accordion Group */
.menu-group {
  display: flex;
  flex-direction: column;
}

.group-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: transparent;
  border: none;
  color: #cbd5e1;
  padding: 8px 12px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.8125rem;
  font-weight: 600;
  transition: all 0.15s ease;
  font-family: inherit;
}

.group-btn:hover {
  background-color: rgba(255, 255, 255, 0.06);
  color: #ffffff;
}

.group-btn-title {
  display: flex;
  align-items: center;
  gap: 10px;
}

.nav-icon {
  color: #8fa898;
  transition: color 0.15s;
}

.group-btn:hover .nav-icon,
.nav-root-link:hover .nav-icon {
  color: #86efac;
}

.group-btn-right {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #8fa898;
}

.sub-links-list {
  display: flex;
  flex-direction: column;
  padding-left: 12px;
  margin: 2px 0 4px 18px;
  border-left: 1px solid rgba(255, 255, 255, 0.1);
  gap: 2px;
}

.sub-nav-link {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  border-radius: 6px;
  color: #94a3b8;
  text-decoration: none;
  font-size: 0.75rem;
  font-weight: 500;
  transition: all 0.15s;
}

.sub-nav-link:hover {
  background-color: rgba(255, 255, 255, 0.06);
  color: #ffffff;
}

.sub-nav-link.active {
  color: #ffffff;
  background: rgba(34, 197, 94, 0.18);
  border: 1px solid rgba(74, 222, 128, 0.25);
  font-weight: 700;
}

.mini-badge {
  font-size: 0.625rem;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 6px;
}

.badge-amber { background: #d97706; color: white; }
.badge-blue { background: #2563eb; color: white; }
.badge-green { background: #166534; color: white; }
.badge-red { background: #dc2626; color: white; }

/* Footer Sidebar */
.sidebar-bottom-panel {
  padding: 12px 14px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(0, 0, 0, 0.16);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.role-filter-row {
  display: flex;
}

.btn-subtle-filter {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #cbd5e1;
  padding: 6px 8px;
  border-radius: 6px;
  font-size: 0.6875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  font-family: inherit;
}

.btn-subtle-filter:hover {
  background: rgba(255, 255, 255, 0.1);
  color: white;
}

.btn-subtle-filter.active {
  color: #86efac;
  background: rgba(21, 128, 61, 0.25);
  border-color: rgba(74, 222, 128, 0.3);
}

.user-profile-strip {
  display: flex;
  align-items: center;
  gap: 10px;
}

.avatar-wrap-active {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.avatar-img {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
  border: 1.5px solid rgba(255, 255, 255, 0.25);
}

.online-indicator {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #22c55e;
  border: 1.5px solid #0e2218;
  box-shadow: 0 0 4px #22c55e;
}

.user-text-info {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.user-display-name {
  font-size: 0.75rem;
  font-weight: 700;
  color: #ffffff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-display-dept {
  font-size: 0.625rem;
  color: #8fa898;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.app-content-viewport {
  flex: 1;
  padding: 24px 36px;
  background-color: var(--bg-page);
  overflow-y: auto;
  height: 100%;
}

/* Nút toggle mở rộng / thu gọn Sidebar */
.btn-header-toggle-sidebar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: #e2e8f0;
  cursor: pointer;
  transition: all 0.2s;
  margin-right: 6px;
  flex-shrink: 0;
}

.btn-header-toggle-sidebar:hover {
  background: rgba(255, 255, 255, 0.18);
  color: #ffffff;
  border-color: #86efac;
}

.btn-sidebar-collapse {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: #a3c4b0;
  cursor: pointer;
  transition: all 0.2s;
  margin-left: auto;
  flex-shrink: 0;
}

.btn-sidebar-collapse:hover {
  background: rgba(255, 255, 255, 0.16);
  color: #ffffff;
  border-color: #86efac;
}

/* Trạng thái thu gọn của Sidebar (Collapsed) */
.app-sidebar {
  transition: width 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

.app-sidebar.is-collapsed {
  width: 68px;
}

.app-sidebar.is-collapsed .workspace-info,
.app-sidebar.is-collapsed .menu-section-label,
.app-sidebar.is-collapsed .group-btn-title span,
.app-sidebar.is-collapsed .group-btn-right,
.app-sidebar.is-collapsed .sub-links-list,
.app-sidebar.is-collapsed .nav-root-link span,
.app-sidebar.is-collapsed .role-filter-row,
.app-sidebar.is-collapsed .user-text-info {
  display: none !important;
}

.app-sidebar.is-collapsed .sidebar-workspace-header {
  justify-content: center;
  padding: 10px 4px;
  flex-direction: column;
  gap: 8px;
}

.app-sidebar.is-collapsed .btn-sidebar-collapse {
  margin-left: 0;
}

.app-sidebar.is-collapsed .nav-root-link,
.app-sidebar.is-collapsed .group-btn {
  justify-content: center;
  padding: 11px 0;
}

.app-sidebar.is-collapsed .group-btn-title {
  justify-content: center;
  gap: 0;
}

.app-sidebar.is-collapsed .user-profile-strip {
  justify-content: center;
}

@media (max-width: 960px) {
  .app-sidebar { width: 68px; }
  .group-btn-title span, .group-btn-right, .sub-links-list, .role-filter-row, .user-text-info, .sidebar-workspace-header, .menu-section-label { display: none; }
  .app-content-viewport { padding: 16px; }
}
</style>
