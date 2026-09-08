<script setup lang="ts">
import { useDialogStore } from '@/stores/dialog';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  X,
  RotateCcw,
  Check,
} from 'lucide-vue-next';

const dialog = useDialogStore();
</script>

<template>
  <Transition name="fade-modal">
    <div
      v-if="dialog.isOpen"
      class="feedback-modal-backdrop"
      @click.self="dialog.type !== 'confirm' ? dialog.close() : null"
    >
      <div class="feedback-modal-card" :class="`type-${dialog.type}`">
        <!-- Nút đóng nhanh ở góc trên -->
        <button
          v-if="dialog.type !== 'confirm'"
          class="btn-quick-close"
          @click="dialog.close()"
          title="Đóng"
        >
          <X :size="18" />
        </button>

        <!-- Icon nổi bật theo loại thông báo -->
        <div class="feedback-icon-wrapper">
          <div v-if="dialog.type === 'success'" class="icon-circle icon-success">
            <CheckCircle2 :size="36" />
          </div>
          <div v-else-if="dialog.type === 'warning'" class="icon-circle icon-warning">
            <AlertTriangle :size="36" />
          </div>
          <div v-else-if="dialog.type === 'error'" class="icon-circle icon-error">
            <XCircle :size="36" />
          </div>
          <div v-else-if="dialog.type === 'confirm'" class="icon-circle icon-confirm">
            <HelpCircle :size="36" />
          </div>
        </div>

        <!-- Tiêu đề & Nội dung -->
        <div class="feedback-body">
          <h3 class="feedback-title">{{ dialog.title }}</h3>
          <p class="feedback-message">{{ dialog.message }}</p>
        </div>

        <!-- Hàng nút hành động -->
        <div class="feedback-actions">
          <!-- Trường hợp Xác nhận: có nút Hủy và Đồng ý -->
          <template v-if="dialog.type === 'confirm'">
            <button class="btn btn-secondary btn-action-cancel" @click="dialog.handleCancel">
              {{ dialog.cancelText }}
            </button>
            <button class="btn btn-primary btn-action-confirm" @click="dialog.handleConfirm">
              <Check :size="16" />
              <span>{{ dialog.confirmText }}</span>
            </button>
          </template>

          <!-- Trường hợp Cảnh Báo: nút Thực hiện lại -->
          <template v-else-if="dialog.type === 'warning'">
            <button class="btn btn-warning btn-action-main" @click="dialog.close">
              <RotateCcw :size="16" />
              <span>{{ dialog.confirmText }}</span>
            </button>
          </template>

          <!-- Trường hợp Thành Công: nút Xác nhận -->
          <template v-else-if="dialog.type === 'success'">
            <button class="btn btn-success btn-action-main" @click="dialog.close">
              <Check :size="16" />
              <span>{{ dialog.confirmText }}</span>
            </button>
          </template>

          <!-- Trường hợp Lỗi -->
          <template v-else>
            <button class="btn btn-danger btn-action-main" @click="dialog.close">
              <span>{{ dialog.confirmText }}</span>
            </button>
          </template>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.feedback-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.65);
  backdrop-filter: blur(5px);
  z-index: 100000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.feedback-modal-card {
  position: relative;
  background: #ffffff;
  border-radius: 16px;
  width: 100%;
  max-width: 440px;
  padding: 28px 24px;
  text-align: center;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.05);
  display: flex;
  flex-direction: column;
  align-items: center;
}

.btn-quick-close {
  position: absolute;
  top: 14px;
  right: 14px;
  background: transparent;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.btn-quick-close:hover {
  background: #f1f5f9;
  color: #334155;
}

/* Icon Styles */
.feedback-icon-wrapper {
  margin-bottom: 16px;
}

.icon-circle {
  width: 68px;
  height: 68px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: pop-in 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.icon-success {
  background: #dcfce7;
  color: #16a34a;
  box-shadow: 0 0 0 8px rgba(34, 197, 94, 0.15);
}

.icon-warning {
  background: #fef3c7;
  color: #d97706;
  box-shadow: 0 0 0 8px rgba(245, 158, 11, 0.15);
}

.icon-error {
  background: #fee2e2;
  color: #dc2626;
  box-shadow: 0 0 0 8px rgba(239, 68, 68, 0.15);
}

.icon-confirm {
  background: #e0f2fe;
  color: #0284c7;
  box-shadow: 0 0 0 8px rgba(2, 132, 199, 0.15);
}

@keyframes pop-in {
  0% { transform: scale(0.5); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}

/* Text Styles */
.feedback-body {
  margin-bottom: 24px;
}

.feedback-title {
  font-size: 1.1875rem;
  font-weight: 800;
  color: #0f172a;
  margin: 0 0 8px 0;
}

.type-success .feedback-title { color: #15803d; }
.type-warning .feedback-title { color: #b45309; }
.type-error .feedback-title { color: #b91c1c; }
.type-confirm .feedback-title { color: #0369a1; }

.feedback-message {
  font-size: 0.875rem;
  line-height: 1.5;
  color: #475569;
  margin: 0;
  white-space: pre-line;
}

/* Action Buttons */
.feedback-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  width: 100%;
}

.btn-action-main {
  width: 100%;
  padding: 10px 18px;
  font-size: 0.875rem;
  font-weight: 700;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  cursor: pointer;
  border: none;
  transition: all 0.2s ease;
}

.btn-success {
  background: #16a34a;
  color: #ffffff;
}
.btn-success:hover {
  background: #15803d;
  box-shadow: 0 4px 12px rgba(22, 163, 74, 0.3);
}

.btn-warning {
  background: #f59e0b;
  color: #ffffff;
}
.btn-warning:hover {
  background: #d97706;
  box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
}

.btn-danger {
  background: #dc2626;
  color: #ffffff;
}
.btn-danger:hover {
  background: #b91c1c;
  box-shadow: 0 4px 12px rgba(220, 38, 38, 0.3);
}

.btn-action-cancel {
  flex: 1;
  padding: 9px 16px;
  font-size: 0.875rem;
  font-weight: 600;
  border-radius: 8px;
  cursor: pointer;
}

.btn-action-confirm {
  flex: 1.2;
  padding: 9px 16px;
  font-size: 0.875rem;
  font-weight: 700;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  cursor: pointer;
}

/* Transitions */
.fade-modal-enter-active,
.fade-modal-leave-active {
  transition: opacity 0.25s ease;
}

.fade-modal-enter-from,
.fade-modal-leave-to {
  opacity: 0;
}

.fade-modal-enter-active .feedback-modal-card {
  animation: modal-zoom 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes modal-zoom {
  0% { transform: scale(0.92); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}
</style>
