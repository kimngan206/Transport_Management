<script setup lang="ts">
import { useAuthStore } from '@/stores/auth';
import { useDialogStore } from '@/stores/dialog';
import { mockStorage } from '@/services/mockStorage';
import type { UserRole } from '@/types';
import { RotateCcw, Droplets, Check, Sprout } from 'lucide-vue-next';

const authStore = useAuthStore();
const dialog = useDialogStore();

function selectUser(userId: number) {
  authStore.switchUser(userId);
}

function handleResetData() {
  dialog.showConfirm({
    title: 'Đặt Lại Dữ Liệu Mẫu?',
    message: 'Bạn có chắc muốn đặt lại toàn bộ dữ liệu mẫu (mock data) về trạng thái ban đầu?',
    confirmText: 'Xác nhận đặt lại',
    cancelText: 'Hủy bỏ',
    onConfirm: () => {
      mockStorage.resetAll();
      window.location.reload();
    },
  });
}

// Bảng màu sắc chuyên ngành: Xanh rừng cao su, Đất đỏ bazan, Bồn téc inox, Than kỹ thuật
const roleColors: Record<UserRole, { bg: string; text: string; border: string; roleLabel: string }> = {
  Requester: { bg: '#f0fdf4', text: '#166534', border: '#bbf7d0', roleLabel: 'Tổ Trưởng Nông Trường' },
  Approver: { bg: '#ecfdf5', text: '#065f46', border: '#a7f3d0', roleLabel: 'P.GĐ Kỹ Thuật / Trưởng NT' },
  Dispatcher: { bg: '#eff6ff', text: '#1e40af', border: '#bfdbfe', roleLabel: 'Điều Độ Đội Xe Mủ' },
  Driver: { bg: '#fefce8', text: '#854d0e', border: '#fef08a', roleLabel: 'Tài Xế Xe Bồn Mủ' },
  Admin: { bg: '#fff1f2', text: '#9f1239', border: '#fecdd3', roleLabel: 'Quản Trị Cơ Giới' },
};
</script>

<template>
  <header class="demo-top-bar">
    <div class="top-bar-container">
      <!-- Trái: Logo Thương Hiệu Ngành Công Nghiệp Cao Su -->
      <div class="system-brand">
        <div class="brand-badge-icon">
          <Droplets :size="18" class="brand-latex-svg" />
        </div>
        <div class="brand-text-group">
          <div class="brand-title-row">
            <span class="brand-title">HỆ THỐNG ĐIỀU ĐỘ XE MỦ CAO SU</span>
            <span class="brand-pill-tag">VRG SYSTEM</span>
          </div>
          <span class="brand-subtitle">Quản Lý Vận Tải Mủ Tươi, Xe Bồn Xi-Téc & Cơ Giới Nông Trường</span>
        </div>
      </div>

      <!-- Giữa: Persona Chips Switcher (Chuyển vai trò nhân sự nông trường & nhà máy) -->
      <div class="persona-chips-bar">
        <span class="persona-label">
          <Sprout :size="13" class="sprout-ico" />
          <span>Vai trò nghiệp vụ:</span>
        </span>
        <div class="persona-chips-list">
          <button
            v-for="u in authStore.users"
            :key="u.id"
            class="persona-btn"
            :class="{ active: authStore.currentUser.id === u.id }"
            @click="selectUser(u.id)"
          >
            <div class="avatar-ring-wrap">
              <img :src="u.avatarUrl" class="persona-avatar" alt="avatar" />
              <div v-if="authStore.currentUser.id === u.id" class="check-dot">
                <Check :size="9" />
              </div>
            </div>
            <div class="persona-info-box">
              <span class="persona-name">{{ u.fullName.split(' ').slice(-2).join(' ') }}</span>
              <span
                class="persona-role-tag"
                :style="{
                  backgroundColor: roleColors[u.roles[0]].bg,
                  color: roleColors[u.roles[0]].text,
                  borderColor: roleColors[u.roles[0]].border,
                }"
              >
                {{ roleColors[u.roles[0]].roleLabel }}
              </span>
            </div>
          </button>
        </div>
      </div>

      <!-- Phải: Reset Data -->
      <div class="top-actions">
        <button class="btn-reset-demo" @click="handleResetData" title="Khôi phục dữ liệu mẫu gốc ban đầu">
          <RotateCcw :size="12" class="rotate-ico" />
          <span>Reset Dữ Liệu</span>
        </button>
      </div>
    </div>
  </header>
</template>

<style scoped>
.demo-top-bar {
  background: linear-gradient(180deg, #090e1a 0%, #060a14 100%);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  color: #f8fafc;
  padding: 8px 24px;
  position: sticky;
  top: 0;
  z-index: 999;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
  backdrop-filter: blur(12px);
}

.top-bar-container {
  max-width: 1720px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.system-brand {
  display: flex;
  align-items: center;
  gap: 12px;
}

.brand-badge-icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: linear-gradient(135deg, #10b981 0%, #047857 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 14px rgba(16, 185, 129, 0.35);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.brand-truck-svg {
  color: white;
}

.brand-text-group {
  display: flex;
  flex-direction: column;
}

.brand-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.brand-title {
  font-size: 0.9375rem;
  font-weight: 800;
  color: #ffffff;
  letter-spacing: 0.06em;
}

.brand-pill-tag {
  font-size: 0.5625rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  background: rgba(16, 185, 129, 0.16);
  color: #34d399;
  border: 1px solid rgba(52, 211, 153, 0.35);
  padding: 1px 6px;
  border-radius: 4px;
}

.brand-subtitle {
  font-size: 0.6875rem;
  color: #94a3b8;
  font-weight: 500;
  letter-spacing: -0.01em;
}

.persona-chips-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.persona-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: #94a3b8;
  display: flex;
  align-items: center;
  gap: 5px;
}

.sparkle-ico {
  color: #f59e0b;
}

.persona-chips-list {
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(255, 255, 255, 0.04);
  padding: 3px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.07);
}

.persona-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  background: transparent;
  border: 1px solid transparent;
  color: #94a3b8;
  padding: 4px 10px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  font-family: inherit;
}

.persona-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #ffffff;
  transform: translateY(-1px);
}

.persona-btn.active {
  background: rgba(255, 255, 255, 0.12);
  color: #ffffff;
  border-color: rgba(255, 255, 255, 0.22);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
}

.avatar-ring-wrap {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.persona-avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  object-fit: cover;
  border: 1.5px solid rgba(255, 255, 255, 0.3);
}

.persona-btn.active .persona-avatar {
  border-color: #34d399;
}

.check-dot {
  position: absolute;
  bottom: -2px;
  right: -2px;
  background: #10b981;
  color: white;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1.5px solid #090e1a;
}

.persona-info-box {
  display: flex;
  align-items: center;
  gap: 6px;
}

.persona-name {
  font-size: 0.75rem;
  font-weight: 700;
  white-space: nowrap;
}

.persona-role-tag {
  font-size: 0.625rem;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 4px;
  border: 1px solid;
  letter-spacing: 0.02em;
}

.top-actions {
  display: flex;
  align-items: center;
}

.btn-reset-demo {
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(239, 68, 68, 0.12);
  border: 1px solid rgba(239, 68, 68, 0.28);
  color: #fca5a5;
  padding: 6px 12px;
  border-radius: 8px;
  font-size: 0.6875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  font-family: inherit;
}

.btn-reset-demo:hover {
  background: rgba(239, 68, 68, 0.22);
  color: #ffffff;
  border-color: rgba(239, 68, 68, 0.5);
  box-shadow: 0 2px 8px rgba(239, 68, 68, 0.2);
}

.btn-reset-demo:hover .rotate-ico {
  transform: rotate(-180deg);
  transition: transform 0.4s ease;
}

.rotate-ico {
  transition: transform 0.3s ease;
}
</style>
