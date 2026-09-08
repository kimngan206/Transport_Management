import { defineStore } from 'pinia';
import { ref } from 'vue';

export type DialogType = 'success' | 'warning' | 'error' | 'confirm';

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel?: () => void;
}

export const useDialogStore = defineStore('dialog', () => {
  const isOpen = ref(false);
  const type = ref<DialogType>('success');
  const title = ref('');
  const message = ref('');
  const confirmText = ref('Xác nhận');
  const cancelText = ref('Hủy bỏ');
  let confirmCallback: (() => void) | null = null;
  let cancelCallback: (() => void) | null = null;

  function showSuccess(msg: string, customTitle = 'Thao Tác Thành Công', btnText = 'Xác nhận') {
    type.value = 'success';
    title.value = customTitle;
    message.value = msg;
    confirmText.value = btnText;
    confirmCallback = null;
    cancelCallback = null;
    isOpen.value = true;
  }

  function showWarning(msg: string, customTitle = 'Cảnh Báo - Yêu Cầu Kiểm Tra', btnText = 'Thực hiện lại') {
    type.value = 'warning';
    title.value = customTitle;
    message.value = msg;
    confirmText.value = btnText;
    confirmCallback = null;
    cancelCallback = null;
    isOpen.value = true;
  }

  function showError(msg: string, customTitle = 'Thao Tác Thất Bại', btnText = 'Thử lại') {
    type.value = 'error';
    title.value = customTitle;
    message.value = msg;
    confirmText.value = btnText;
    confirmCallback = null;
    cancelCallback = null;
    isOpen.value = true;
  }

  function showConfirm(options: ConfirmOptions) {
    type.value = 'confirm';
    title.value = options.title || 'Xác Nhận Thao Tác';
    message.value = options.message;
    confirmText.value = options.confirmText || 'Đồng ý';
    cancelText.value = options.cancelText || 'Hủy bỏ';
    confirmCallback = options.onConfirm;
    cancelCallback = options.onCancel || null;
    isOpen.value = true;
  }

  function handleConfirm() {
    isOpen.value = false;
    if (confirmCallback) {
      confirmCallback();
      confirmCallback = null;
    }
  }

  function handleCancel() {
    isOpen.value = false;
    if (cancelCallback) {
      cancelCallback();
      cancelCallback = null;
    }
  }

  function close() {
    isOpen.value = false;
  }

  return {
    isOpen,
    type,
    title,
    message,
    confirmText,
    cancelText,
    showSuccess,
    showWarning,
    showError,
    showConfirm,
    handleConfirm,
    handleCancel,
    close,
  };
});
