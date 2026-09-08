<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import type { UserRole } from '@/types';
import {
  Sprout,
  ShieldCheck,
  Layers,
  Truck,
  Settings,
  ArrowRight,
  Sparkles,
  Building2,
  Wrench,
  Car,
} from 'lucide-vue-next';
import { initialUsers } from '@/mocks';

const router = useRouter();
const authStore = useAuthStore();
const selectedUserId = ref<number | null>(null);
const selectedCategory = ref<'ALL' | 'MANAGEMENT' | 'DRIVERS' | 'ADMIN'>('ALL');

interface RoleProfile {
  userId: number;
  role: UserRole;
  roleTitle: string;
  jobTitle: string;
  category: 'MANAGEMENT' | 'DRIVERS' | 'ADMIN';
  assignedEquipment?: string;
  duty: string;
  badgeColor: { bg: string; text: string; border: string };
  icon: any;
  targetRoute: string;
}

const roleProfiles: RoleProfile[] = [
  {
    userId: 1,
    role: 'Requester',
    roleTitle: 'Người Đặt Xe (Requester)',
    jobTitle: 'Tổ Trưởng Nông Trường Khai Thác Mủ',
    category: 'MANAGEMENT',
    duty: 'Lập kế hoạch & tạo yêu cầu điều động xe bồn chở mủ nước, mủ chén đông và máy xúc san ủi vườn cây cao su',
    badgeColor: { bg: '#f0fdf4', text: '#166534', border: '#bbf7d0' },
    icon: Sprout,
    targetRoute: '/booking',
  },
  {
    userId: 2,
    role: 'Approver',
    roleTitle: 'Người Phê Duyệt (Approver)',
    jobTitle: 'Phó Giám Đốc Kỹ Thuật Nông Nghiệp',
    category: 'MANAGEMENT',
    duty: 'Phê duyệt điều động xe, kiểm soát kế hoạch thu gom mủ và điều chuyển trang thiết bị cơ giới nông trường',
    badgeColor: { bg: '#ecfdf5', text: '#065f46', border: '#a7f3d0' },
    icon: ShieldCheck,
    targetRoute: '/approval',
  },
  {
    userId: 3,
    role: 'Dispatcher',
    roleTitle: 'Điều Phối Viên (Dispatcher)',
    jobTitle: 'Trưởng Bộ Phận Điều Độ & Vận Tải',
    category: 'MANAGEMENT',
    duty: 'Ghép chuyến xe bồn, tối ưu cung đường Nông trường → Trạm cân → Nhà máy chế biến, gán tài xế',
    badgeColor: { bg: '#eff6ff', text: '#1e40af', border: '#bfdbfe' },
    icon: Layers,
    targetRoute: '/dispatch',
  },
  {
    userId: 4,
    role: 'Driver',
    roleTitle: 'Tài Xế Vận Hành (Driver)',
    jobTitle: 'Tài Xế Chính - Xe Tải Chở Mủ',
    assignedEquipment: 'Xe tải 51C-889.26 (Hino 5.0 tấn)',
    category: 'DRIVERS',
    duty: 'Nhận chuyến mủ nước/mủ tạp, ghi nhận chỉ số ODO xuất bến/về bến, kiểm soát định mức nhiên liệu theo tấn.km',
    badgeColor: { bg: '#fefce8', text: '#854d0e', border: '#fef08a' },
    icon: Truck,
    targetRoute: '/driver-schedule',
  },
  {
    userId: 5,
    role: 'Driver',
    roleTitle: 'Tài Xế Vận Hành (Driver)',
    jobTitle: 'Tài Xế Chính - Xe Bồn Téc Mủ Cao Su',
    assignedEquipment: 'Xe bồn 51C-772.18 (Isuzu 7.5 tấn bồn inox)',
    category: 'DRIVERS',
    duty: 'Vận chuyển mủ nước cao su ly tâm từ các đội về trạm cân và giao mủ vào bể chứa nhà máy chế biến',
    badgeColor: { bg: '#fefce8', text: '#854d0e', border: '#fef08a' },
    icon: Truck,
    targetRoute: '/driver-schedule',
  },
  {
    userId: 6,
    role: 'Driver',
    roleTitle: 'Tài Xế Vận Hành (Driver)',
    jobTitle: 'Tài Xế - Xe Bán Tải Công Tác',
    assignedEquipment: 'Xe bán tải 51A-992.34 (Ford Ranger 4x4)',
    category: 'DRIVERS',
    duty: 'Phục vụ đưa đón cán bộ kỹ thuật kiểm tra ca ép mủ, tuần tra lô vườn cây và các chuyến công tác nghiệp vụ',
    badgeColor: { bg: '#f0f9ff', text: '#0369a1', border: '#bae6fd' },
    icon: Car,
    targetRoute: '/driver-schedule',
  },
  {
    userId: 7,
    role: 'Driver',
    roleTitle: 'Thợ Máy Cơ Giới (Operator)',
    jobTitle: 'Vận Hành Máy Xúc Đào Vườn Cây',
    assignedEquipment: 'Máy đào MX-01 (Komatsu PC200-8)',
    category: 'DRIVERS',
    duty: 'Vận hành máy đào mương thoát nước vườn cao su, san ủi đất tái canh, ghi nhận giờ máy hoạt động',
    badgeColor: { bg: '#fff7ed', text: '#c2410c', border: '#fed7aa' },
    icon: Wrench,
    targetRoute: '/driver-schedule',
  },
  {
    userId: 8,
    role: 'Admin',
    roleTitle: 'Quản Trị Hệ Thống (Admin)',
    jobTitle: 'Kỹ Sư Quản Trị Hệ Thống & CNTT',
    category: 'ADMIN',
    duty: 'Quản lý toàn bộ danh mục xe bồn, máy xúc, định mức NLP/NLC, cảnh báo 5.000 km, phân quyền người dùng',
    badgeColor: { bg: '#fff1f2', text: '#9f1239', border: '#fecdd3' },
    icon: Settings,
    targetRoute: '/',
  },
];

const counts = computed(() => {
  return {
    all: roleProfiles.length,
    management: roleProfiles.filter((p) => p.category === 'MANAGEMENT').length,
    drivers: roleProfiles.filter((p) => p.category === 'DRIVERS').length,
    admin: roleProfiles.filter((p) => p.category === 'ADMIN').length,
  };
});

const filteredProfiles = computed(() => {
  if (selectedCategory.value === 'MANAGEMENT') {
    return roleProfiles.filter((p) => p.category === 'MANAGEMENT');
  }
  if (selectedCategory.value === 'DRIVERS') {
    return roleProfiles.filter((p) => p.category === 'DRIVERS');
  }
  if (selectedCategory.value === 'ADMIN') {
    return roleProfiles.filter((p) => p.category === 'ADMIN');
  }
  return roleProfiles;
});

function getUser(userId: number) {
  return authStore.users.find((u) => u.id === userId) || initialUsers.find((u) => u.id === userId);
}

function handleSelectRole(profile: RoleProfile) {
  selectedUserId.value = profile.userId;
  authStore.switchUser(profile.userId);

  // Hiệu ứng chuyển cảnh mượt mà
  setTimeout(() => {
    router.push(profile.targetRoute);
  }, 220);
}
</script>

<template>
  <div class="login-portal-wrapper">
    <!-- Nền phong cảnh cao su nghệ thuật -->
    <div class="portal-backdrop-decor">
      <div class="decor-circle circle-1"></div>
      <div class="decor-circle circle-2"></div>
      <div class="latex-droplet-watermark">💧</div>
    </div>

    <div class="portal-content-box">
      <!-- Header Thương Hiệu ECOTECH 2A -->
      <div class="portal-brand-header">
        <div class="brand-logo-container">
          <img src="/logo.png" alt="ECOTECH 2A Logo" class="brand-logo-img" />
        </div>
        <div class="brand-title-group">
          <div class="company-pill">DOANH NGHIỆP SẢN XUẤT & ĐIỀU HÀNH VẬN TẢI CAO SU</div>
          <h1 class="portal-main-title">ECOTECH 2A</h1>
          <p class="portal-sub-desc">
            Hệ Thống Điều Độ Đội Xe & Vận Chuyển Mủ Cao Su — Khối Nông Trường & Nhà Máy Chế Biến
          </p>
        </div>
      </div>

      <!-- Khung Chọn Vai Trò Nhanh (Không cần mật khẩu) -->
      <div class="role-selector-card card">
        <div class="selector-card-header">
          <div class="card-header-left">
            <Sparkles :size="16" class="header-sparkle" />
            <h2 class="selector-title">Danh Sách Nhân Viên & Chức Vụ Hoạt Động ({{ roleProfiles.length }} Nhân Sự)</h2>
          </div>
          <span class="auto-login-hint">
            ✓ Đăng nhập tức thì 1 chạm — Không yêu cầu mật khẩu
          </span>
        </div>

        <!-- Thanh phân loại nhóm nhân sự -->
        <div class="category-filter-bar">
          <button
            class="cat-tab-btn"
            :class="{ active: selectedCategory === 'ALL' }"
            @click="selectedCategory = 'ALL'"
          >
            Tất cả nhân sự ({{ counts.all }})
          </button>
          <button
            class="cat-tab-btn"
            :class="{ active: selectedCategory === 'MANAGEMENT' }"
            @click="selectedCategory = 'MANAGEMENT'"
          >
            Khối Quản Lý & Điều Độ ({{ counts.management }})
          </button>
          <button
            class="cat-tab-btn"
            :class="{ active: selectedCategory === 'DRIVERS' }"
            @click="selectedCategory = 'DRIVERS'"
          >
            Đội Ngũ Vận Hành & Lái Xe ({{ counts.drivers }})
          </button>
          <button
            class="cat-tab-btn"
            :class="{ active: selectedCategory === 'ADMIN' }"
            @click="selectedCategory = 'ADMIN'"
          >
            Quản Trị Hệ Thống ({{ counts.admin }})
          </button>
        </div>

        <div class="role-cards-grid">
          <div
            v-for="profile in filteredProfiles"
            :key="profile.userId"
            class="role-card-item"
            :class="{ active: selectedUserId === profile.userId }"
            @click="handleSelectRole(profile)"
          >
            <!-- Cột trái: Avatar & Icon vai trò -->
            <div class="role-card-left">
              <div class="avatar-box">
                <img
                  :src="getUser(profile.userId)?.avatarUrl"
                  alt="avatar"
                  class="role-avatar-img"
                />
                <div class="role-icon-pill">
                  <component :is="profile.icon" :size="13" />
                </div>
              </div>
            </div>

            <!-- Cột giữa: Thông tin nhân sự & Trách nhiệm -->
            <div class="role-card-center">
              <div class="role-name-row">
                <span class="user-fullname">
                  {{ getUser(profile.userId)?.fullName }}
                </span>
                <span class="job-title-pill">
                  {{ profile.jobTitle }}
                </span>
                <span
                  class="role-tag-badge"
                  :style="{
                    backgroundColor: profile.badgeColor.bg,
                    color: profile.badgeColor.text,
                    borderColor: profile.badgeColor.border,
                  }"
                >
                  {{ profile.roleTitle }}
                </span>
              </div>

              <div class="role-dept-row">
                <div class="dept-box">
                  <Building2 :size="12" class="dept-ico" />
                  <span>{{ getUser(profile.userId)?.departmentName }}</span>
                </div>
                <div v-if="profile.assignedEquipment" class="equipment-box">
                  <Truck :size="12" class="eq-ico" />
                  <span>{{ profile.assignedEquipment }}</span>
                </div>
              </div>

              <p class="role-duty-text">{{ profile.duty }}</p>
            </div>

            <!-- Cột phải: Nút vào hệ thống -->
            <div class="role-card-right">
              <button class="btn-enter-system">
                <span>Vào trang</span>
                <ArrowRight :size="14" class="enter-arrow" />
              </button>
            </div>
          </div>
        </div>

        <!-- Footer Card -->
        <div class="selector-card-footer">
          <div class="footer-note">
            Đầy đủ <strong>8 nhân sự</strong> trực thuộc các bộ phận: <strong>Tổ trưởng Nông trường → P.Giám đốc Kỹ thuật → Điều độ xe bồn → Đội ngũ tài xế xe tải, xe bồn, xe bán tải & thợ máy xúc → Quản trị hệ thống</strong>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-portal-wrapper {
  min-height: 100vh;
  background: linear-gradient(135deg, #09130d 0%, #0d1e14 50%, #060e09 100%);
  color: #f8fafc;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 24px;
  position: relative;
  overflow: hidden;
  font-family: inherit;
}

/* Trang trí hình tròn mờ sắc xanh cao su */
.portal-backdrop-decor {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}

.decor-circle {
  position: absolute;
  border-radius: 50%;
  filter: blur(100px);
  opacity: 0.15;
}

.circle-1 {
  width: 600px;
  height: 600px;
  background: #15803d;
  top: -150px;
  right: -100px;
}

.circle-2 {
  width: 500px;
  height: 500px;
  background: #22c55e;
  bottom: -120px;
  left: -80px;
}

.latex-droplet-watermark {
  position: absolute;
  right: 5%;
  bottom: 8%;
  font-size: 18rem;
  opacity: 0.03;
  user-select: none;
  line-height: 1;
}

.portal-content-box {
  width: 100%;
  max-width: 1040px;
  position: relative;
  z-index: 10;
  display: flex;
  flex-direction: column;
  gap: 28px;
}

/* Header thương hiệu */
.portal-brand-header {
  display: flex;
  align-items: center;
  gap: 20px;
}

.brand-logo-container {
  width: 72px;
  height: 72px;
  border-radius: 18px;
  background: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  border: 2px solid rgba(255, 255, 255, 0.3);
  padding: 6px;
  flex-shrink: 0;
}

.brand-logo-img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.brand-title-group {
  display: flex;
  flex-direction: column;
}

.company-pill {
  font-size: 0.6875rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  color: #4ade80;
  margin-bottom: 2px;
}

.portal-main-title {
  font-size: 1.65rem;
  font-weight: 800;
  color: #ffffff;
  letter-spacing: -0.025em;
  line-height: 1.25;
}

.portal-sub-desc {
  font-size: 0.875rem;
  color: #94a3b8;
  margin-top: 4px;
}

/* Card chọn vai trò */
.role-selector-card {
  background: rgba(255, 255, 255, 0.98);
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  box-shadow: 0 24px 60px -10px rgba(0, 0, 0, 0.5);
  color: #0f172a;
  overflow: hidden;
}

.selector-card-header {
  padding: 20px 28px;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

.card-header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-sparkle {
  color: #15803d;
}

.selector-title {
  font-size: 1.05rem;
  font-weight: 800;
  color: #0c1a11;
  letter-spacing: -0.01em;
}

.auto-login-hint {
  font-size: 0.75rem;
  font-weight: 600;
  color: #15803d;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  padding: 4px 12px;
  border-radius: 999px;
}

.category-filter-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  background: #f1f5f9;
  border-bottom: 1px solid #e2e8f0;
  flex-wrap: wrap;
}

.cat-tab-btn {
  background: transparent;
  border: 1px solid transparent;
  padding: 6px 14px;
  border-radius: 8px;
  font-size: 0.75rem;
  font-weight: 600;
  color: #64748b;
  cursor: pointer;
  transition: all 0.15s ease;
  font-family: inherit;
}

.cat-tab-btn:hover {
  color: #0f172a;
  background: rgba(255, 255, 255, 0.6);
}

.cat-tab-btn.active {
  background: #ffffff;
  color: #15803d;
  border-color: #cbd5e1;
  font-weight: 700;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.role-cards-grid {
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.role-card-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  background: #ffffff;
  border: 1.5px solid #e2e8f0;
  border-radius: 14px;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  gap: 18px;
}

.role-card-item:hover {
  border-color: #15803d;
  background: #fbfdf9;
  transform: translateY(-2px);
  box-shadow: 0 8px 20px -4px rgba(21, 128, 61, 0.15);
}

.role-card-item.active {
  border-color: #15803d;
  background: #f0fdf4;
  box-shadow: 0 0 0 3px rgba(21, 128, 61, 0.2);
}

.role-card-left {
  flex-shrink: 0;
}

.avatar-box {
  position: relative;
  width: 48px;
  height: 48px;
}

.role-avatar-img {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid #15803d;
}

.role-icon-pill {
  position: absolute;
  bottom: -2px;
  right: -4px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #15803d;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid white;
}

.role-card-center {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.role-name-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.user-fullname {
  font-size: 0.9375rem;
  font-weight: 800;
  color: #0c1a11;
}

.job-title-pill {
  font-size: 0.6875rem;
  font-weight: 700;
  color: #15803d;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  padding: 2px 8px;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
}

.role-tag-badge {
  font-size: 0.6875rem;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 6px;
  border: 1px solid;
  letter-spacing: 0.02em;
}

.role-dept-row {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 0.75rem;
  color: #64748b;
  font-weight: 500;
  flex-wrap: wrap;
}

.dept-box {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.dept-ico {
  color: #94a3b8;
}

.equipment-box {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 0.6875rem;
  font-weight: 600;
  color: #1e293b;
}

.eq-ico {
  color: #0284c7;
}

.role-duty-text {
  font-size: 0.75rem;
  color: #475569;
  line-height: 1.4;
  margin-top: 2px;
}

.role-card-right {
  flex-shrink: 0;
}

.btn-enter-system {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #f1f5f9;
  border: 1px solid #cbd5e1;
  color: #334155;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 0.75rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  font-family: inherit;
}

.role-card-item:hover .btn-enter-system {
  background: linear-gradient(135deg, #166534 0%, #15803d 100%);
  color: white;
  border-color: #14532d;
  box-shadow: 0 4px 12px rgba(21, 128, 61, 0.3);
}

.enter-arrow {
  transition: transform 0.2s ease;
}

.role-card-item:hover .enter-arrow {
  transform: translateX(3px);
}

.selector-card-footer {
  padding: 14px 28px;
  background: #f8fafc;
  border-top: 1px solid #e2e8f0;
}

.footer-note {
  font-size: 0.75rem;
  color: #64748b;
  line-height: 1.5;
}

@media (max-width: 768px) {
  .portal-brand-header { flex-direction: column; text-align: center; }
  .role-card-item { flex-direction: column; align-items: flex-start; }
  .role-card-right { width: 100%; }
  .btn-enter-system { width: 100%; justify-content: center; }
}
</style>
