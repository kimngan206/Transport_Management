import { createRouter, createWebHistory } from 'vue-router';
import LoginView from '@/views/auth/LoginView.vue';
import DashboardView from '@/views/dashboard/DashboardView.vue';
import BookingListView from '@/views/booking/BookingListView.vue';
import DispatchBoardView from '@/views/dispatch/DispatchBoardView.vue';
import DriverScheduleView from '@/views/driver/DriverScheduleView.vue';
import FleetListView from '@/views/fleet/FleetListView.vue';
import VehicleTypesView from '@/views/fleet/VehicleTypesView.vue';
import StandardRoutesView from '@/views/routes/StandardRoutesView.vue';
import HubsManagementView from '@/views/routes/HubsManagementView.vue';
import MaintenanceView from '@/views/maintenance/MaintenanceView.vue';
import ReportsView from '@/views/reports/ReportsView.vue';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: LoginView,
      meta: { title: 'Đăng Nhập Vai Trò - QL_Điều Vận Cao Su' },
    },
    {
      path: '/',
      name: 'root',
      redirect: '/booking',
    },
    {
      path: '/booking',
      name: 'booking',
      component: BookingListView,
      meta: { title: 'Yêu Cầu Đặt Xe - QL_Điều Vận' },
    },
    {
      path: '/approval',
      name: 'approval',
      redirect: '/dispatch?view=board',
    },
    {
      path: '/dispatch',
      name: 'dispatch',
      component: DispatchBoardView,
      meta: { title: 'Bảng Điều Phối & Ghép Chuyến - QL_Điều Vận' },
    },
    {
      path: '/driver-schedule',
      name: 'driver-schedule',
      component: DriverScheduleView,
      meta: { title: 'Lịch Trình Nhận Xe - QL_Điều Vận' },
    },
    {
      path: '/driver/expenses',
      name: 'driver-expenses',
      component: () => import('@/views/driver/DriverExpensesView.vue'),
      meta: { title: 'Kê Khai Chi Phí & Bằng Chứng Hóa Đơn - QL_Điều Vận' },
    },
    {
      path: '/driver/history',
      name: 'driver-history',
      component: () => import('@/views/driver/DriverHistoryView.vue'),
      meta: { title: 'Lịch Sử Chuyến Xe & Mủ Vận Chuyển - QL_Điều Vận' },
    },
    {
      path: '/driver/incidents',
      name: 'driver-incidents',
      component: () => import('@/views/driver/DriverIncidentsView.vue'),
      meta: { title: 'Báo Cáo Sự Cố Xe & Cứu Hộ - QL_Điều Vận' },
    },
    {
      path: '/fleet',
      name: 'fleet',
      component: FleetListView,
      meta: { title: 'Quản Lý Đội Xe & Tài Xế - QL_Điều Vận' },
    },
    {
      path: '/fleet/types',
      name: 'fleet-types',
      component: VehicleTypesView,
      meta: { title: 'Danh Sách Loại Xe & Thiết Bị - QL_Điều Vận' },
    },
    {
      path: '/routes',
      name: 'routes',
      component: StandardRoutesView,
      meta: { title: 'Tuyến Đường Quy Chuẩn - QL_Điều Vận' },
    },
    {
      path: '/hubs',
      name: 'hubs',
      component: HubsManagementView,
      meta: { title: 'Danh Mục Điểm Trạm - QL_Điều Vận' },
    },
    {
      path: '/maintenance',
      name: 'maintenance',
      component: MaintenanceView,
      meta: { title: 'Bảo Dưỡng & Sự Cố - QL_Điều Vận' },
    },
    {
      path: '/maintenance/types',
      name: 'maintenance-types',
      component: () => import('@/views/maintenance/MaintenanceTypesView.vue'),
      meta: { title: 'Cài Đặt Bảo Dưỡng - QL_Điều Vận' },
    },
    {
      path: '/reports',
      name: 'reports',
      component: ReportsView,
      meta: { title: 'Báo Cáo & Nhiên Liệu - QL_Điều Vận' },
    },
    {
      path: '/system',
      name: 'system',
      component: () => import('@/views/system/SystemView.vue'),
      meta: { title: 'Quản Trị Hệ Thống - QL_Điều Vận' },
    },
  ],
});


import { useAuthStore } from '@/stores/auth';

router.beforeEach((to) => {
  if (to.meta?.title) {
    document.title = to.meta.title as string;
  }

  // Phân quyền điều hướng:
  // - Requester chỉ được đặt xe, ẩn dashboard
  // - Dispatcher điều phối chuyến, quản lý xe và tài xế
  try {
    const authStore = useAuthStore();
    if (authStore.activeRole === 'Requester') {
      if (to.path === '/' || to.path === '/approval') {
        return '/booking';
      }
    } else if (authStore.activeRole === 'Dispatcher') {
      if (to.path === '/booking' || to.path === '/approval') {
        return '/dispatch';
      }
    } else if (authStore.activeRole === 'Driver') {
      if (to.path === '/' || to.path === '/booking' || to.path === '/approval' || to.path === '/dispatch' || to.path.startsWith('/maintenance') || to.path.startsWith('/fleet') || to.path === '/system' || to.path === '/reports') {
        return '/driver-schedule';
      }
    }
  } catch (err) {
    // Pinia not yet initialized
  }
});

export default router;
