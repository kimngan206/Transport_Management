<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useDriverStore } from '@/stores/driver';
import { mockStorage } from '@/services/mockStorage';
import {
  CalendarClock,
  Receipt,
  AlertTriangle,
  UserCircle,
  Bell,
  CheckCircle2,
  Truck
} from 'lucide-vue-next';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const driverStore = useDriverStore();

const myTripsCount = computed(() => driverStore.myTrips.filter((t) => t.status !== 'COMPLETED').length);
const dispatchNotifications = computed(() => mockStorage.getDriverNotifications());
const unreadNotifs = computed(() => dispatchNotifications.value.filter((n: any) => !n.isRead));

const showNotifications = ref(false);

const tabs = [
  {
    name: 'Lịch trình',
    path: '/driver-schedule',
    icon: CalendarClock,
    badge: myTripsCount
  },
  {
    name: 'Chi phí',
    path: '/driver/expenses',
    icon: Receipt,
    badge: computed(() => 0)
  },
  {
    name: 'Sự cố',
    path: '/driver/incidents',
    icon: AlertTriangle,
    badge: computed(() => 0)
  },
  {
    name: 'Cá nhân',
    path: '/system',
    icon: UserCircle,
    badge: computed(() => 0)
  }
];
</script>

<template>
  <div class="mobile-driver-layout">
    <!-- Topbar -->
    <header class="mobile-topbar">
      <div class="brand">
        <img src="/logo.png" alt="Logo" class="logo-img" />
        <div class="titles">
          <span class="corp">ECOTECH 2A</span>
          <span class="app-name">Tài Xế Hiện Trường</span>
        </div>
      </div>
      
      <div class="actions">
        <button class="btn-icon" @click="showNotifications = !showNotifications">
          <Bell :size="20" />
          <span v-if="unreadNotifs.length > 0" class="badge-dot"></span>
        </button>
      </div>
    </header>

    <!-- Dropdown Thông Báo -->
    <div v-if="showNotifications" class="mobile-notif-dropdown">
      <div class="notif-header">Thông báo mới</div>
      <div class="notif-list">
        <div v-if="unreadNotifs.length === 0" class="notif-empty">
          <CheckCircle2 :size="24" class="text-success" />
          <p>Không có thông báo mới</p>
        </div>
        <div 
          v-for="notif in unreadNotifs.slice(0, 5)" 
          :key="notif.id" 
          class="notif-item"
          @click="showNotifications = false; router.push('/driver-schedule')"
        >
          <Truck :size="16" class="text-primary" />
          <div class="notif-content">
            <strong>{{ notif.title }}</strong>
            <p>{{ notif.content }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <main class="mobile-content">
      <router-view />
    </main>

    <!-- Bottom Navigation -->
    <nav class="mobile-bottom-nav">
      <router-link 
        v-for="tab in tabs" 
        :key="tab.path"
        :to="tab.path"
        class="nav-item"
        :class="{ active: route.path === tab.path }"
      >
        <div class="icon-wrap">
          <component :is="tab.icon" :size="22" />
          <span v-if="tab.badge.value > 0" class="nav-badge">{{ tab.badge.value }}</span>
        </div>
        <span class="nav-label">{{ tab.name }}</span>
      </router-link>
    </nav>
  </div>
</template>

<style scoped>
.mobile-driver-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
  background-color: var(--bg-page);
  overflow: hidden;
}

/* Topbar */
.mobile-topbar {
  height: 56px;
  background: linear-gradient(90deg, #0f2418 0%, #163624 100%);
  color: white;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 16px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  z-index: 50;
  flex-shrink: 0;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
}

.logo-img {
  width: 32px;
  height: 32px;
  background: white;
  border-radius: 6px;
  padding: 2px;
}

.titles {
  display: flex;
  flex-direction: column;
}

.corp {
  font-size: 0.75rem;
  font-weight: 700;
  color: #a3c4b0;
}

.app-name {
  font-size: 0.875rem;
  font-weight: 800;
  letter-spacing: 0.02em;
}

.btn-icon {
  background: transparent;
  border: none;
  color: white;
  position: relative;
  padding: 8px;
}

.badge-dot {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 8px;
  height: 8px;
  background: #dc2626;
  border-radius: 50%;
  border: 2px solid #0f2418;
}

/* Thông báo Dropdown */
.mobile-notif-dropdown {
  position: absolute;
  top: 56px;
  right: 8px;
  left: 8px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 10px 25px rgba(0,0,0,0.2);
  z-index: 100;
  max-height: 60vh;
  display: flex;
  flex-direction: column;
}

.notif-header {
  padding: 12px 16px;
  font-weight: 700;
  border-bottom: 1px solid #e2e8f0;
}

.notif-list {
  overflow-y: auto;
}

.notif-item {
  display: flex;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid #f1f5f9;
}

.notif-content strong {
  font-size: 0.875rem;
  color: #0f172a;
}
.notif-content p {
  font-size: 0.75rem;
  color: #64748b;
  margin: 2px 0 0;
}

.notif-empty {
  padding: 24px;
  text-align: center;
  color: #64748b;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

/* Content */
.mobile-content {
  flex: 1;
  overflow-y: auto;
  padding: 12px 12px 80px 12px;
}

/* Bottom Navigation */
.mobile-bottom-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 64px;
  background: white;
  border-top: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-around;
  align-items: center;
  padding-bottom: env(safe-area-inset-bottom);
  box-shadow: 0 -2px 10px rgba(0,0,0,0.05);
  z-index: 50;
}

.nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  color: #64748b;
  text-decoration: none;
  flex: 1;
  height: 100%;
}

.nav-item.active {
  color: var(--primary);
}

.icon-wrap {
  position: relative;
}

.nav-badge {
  position: absolute;
  top: -6px;
  right: -10px;
  background: #dc2626;
  color: white;
  font-size: 0.625rem;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 10px;
}

.nav-label {
  font-size: 0.6875rem;
  font-weight: 600;
}
</style>
