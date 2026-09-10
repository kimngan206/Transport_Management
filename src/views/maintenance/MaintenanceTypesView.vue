<script setup lang="ts">
import { ref, computed } from 'vue';
import { useFleetStore } from '@/stores/fleet';
import { useDialogStore } from '@/stores/dialog';
import type { MaintenanceType } from '@/types';
import {
  Wrench,
  Plus,
  Search,
  Edit2,
  Trash2,
  CheckCircle2,
  Truck,
  CheckSquare,
  AlertCircle,
  X,
} from 'lucide-vue-next';

const fleetStore = useFleetStore();
const dialog = useDialogStore();

// Tìm kiếm & Bộ lọc
const searchQuery = ref('');
const selectedGroup = ref<string>('ALL');
const selectedStatus = ref<string>('ALL');

// Modal Thêm / Chỉnh sửa
const showModal = ref(false);
const editingItem = ref<MaintenanceType | null>(null);

// Modal xem chi tiết Checklist
const showDetailModal = ref(false);
const viewingItem = ref<MaintenanceType | null>(null);

// Modal phân bổ xe áp dụng nhanh
const showAssignModal = ref(false);
const assigningItem = ref<MaintenanceType | null>(null);
const assignVehicleIds = ref<number[]>([]);

// Form state
const formCode = ref('');
const formName = ref('');
const formGroup = ref<'Bảo dưỡng định kỳ' | 'Sửa chữa phục hồi' | 'Hệ thống chuyên dụng'>('Bảo dưỡng định kỳ');
const formCycleKm = ref<number | undefined>(5000);
const formCycleMonths = ref<number | undefined>(3);
const formCycleHours = ref<number | undefined>(undefined);
const formEstimatedCost = ref<number>(2500000);
const formEstimatedDurationHours = ref<number>(3);
const formDescription = ref('');
const formChecklistItems = ref<string[]>([
  'Xả và thay nhớt động cơ chuyên dụng',
  'Thay mới cốc lọc nhớt chính hãng',
  'Kiểm tra hệ thống phanh và gầm xe',
]);
const newChecklistText = ref('');
const formIsActive = ref(true);
const formAssignedVehicleIds = ref<number[]>([]);


// Danh sách sau khi lọc
const filteredTypes = computed(() => {
  return fleetStore.maintenanceTypes.filter((m) => {
    const q = searchQuery.value.trim().toLowerCase();
    const matchSearch =
      !q ||
      m.code.toLowerCase().includes(q) ||
      m.name.toLowerCase().includes(q) ||
      m.description.toLowerCase().includes(q) ||
      m.checklistItems.some((c) => c.toLowerCase().includes(q));

    const matchGroup = selectedGroup.value === 'ALL' || m.group === selectedGroup.value;

    const matchStatus =
      selectedStatus.value === 'ALL' ||
      (selectedStatus.value === 'ACTIVE' && m.isActive) ||
      (selectedStatus.value === 'INACTIVE' && !m.isActive);

    return matchSearch && matchGroup && matchStatus;
  });
});

// Format tiền tệ
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}

// Lấy danh sách đối tượng xe từ ID
function getAssignedVehicles(vehicleIds?: number[]) {
  if (!vehicleIds || !vehicleIds.length) return [];
  return fleetStore.vehicles.filter((v) => vehicleIds.includes(v.id));
}

// Quản lý gán xe trong Modal riêng
function openAssignModal(item: MaintenanceType) {
  assigningItem.value = item;
  assignVehicleIds.value = item.assignedVehicleIds ? [...item.assignedVehicleIds] : [];
  showAssignModal.value = true;
}

function toggleVehicleInAssign(vehId: number) {
  const idx = assignVehicleIds.value.indexOf(vehId);
  if (idx >= 0) {
    assignVehicleIds.value.splice(idx, 1);
  } else {
    assignVehicleIds.value.push(vehId);
  }
}

function selectAllAssignVehicles() {
  assignVehicleIds.value = fleetStore.vehicles.map((v) => v.id);
}

function clearAllAssignVehicles() {
  assignVehicleIds.value = [];
}

function saveAssignedVehicles() {
  if (!assigningItem.value) return;
  fleetStore.assignVehiclesToMaintenanceType(assigningItem.value.id, assignVehicleIds.value);
  dialog.showSuccess(
    `Đã cập nhật cấu hình cho ${assignVehicleIds.value.length} xe áp dụng loại bảo dưỡng "${assigningItem.value.name}"!`,
    'Cài Đặt Xe Áp Dụng Thành Công'
  );
  showAssignModal.value = false;
}

// Quản lý gán xe trong Form Thêm / Sửa
function toggleVehicleInForm(vehId: number) {
  const idx = formAssignedVehicleIds.value.indexOf(vehId);
  if (idx >= 0) {
    formAssignedVehicleIds.value.splice(idx, 1);
  } else {
    formAssignedVehicleIds.value.push(vehId);
  }
}

function selectAllFormVehicles() {
  formAssignedVehicleIds.value = fleetStore.vehicles.map((v) => v.id);
}

function clearAllFormVehicles() {
  formAssignedVehicleIds.value = [];
}

// Modal actions
function openAddModal() {
  editingItem.value = null;
  formCode.value = '';
  formName.value = '';
  formGroup.value = 'Bảo dưỡng định kỳ';
  formCycleKm.value = 5000;
  formCycleMonths.value = 3;
  formCycleHours.value = undefined;
  formEstimatedCost.value = 2500000;
  formEstimatedDurationHours.value = 3;
  formDescription.value = '';
  formChecklistItems.value = [
    'Kiểm tra mức dầu động cơ và chất lỏng',
    'Vệ sinh và kiểm tra hệ thống lọc gió',
    'Kiểm tra độ rơ lái và phanh an toàn',
  ];
  newChecklistText.value = '';
  formIsActive.value = true;
  formAssignedVehicleIds.value = [];
  showModal.value = true;
}

function openEditModal(item: MaintenanceType) {
  editingItem.value = item;
  formCode.value = item.code;
  formName.value = item.name;
  formGroup.value = item.group;
  formCycleKm.value = item.cycleKm;
  formCycleMonths.value = item.cycleMonths;
  formCycleHours.value = item.cycleHours;
  formEstimatedCost.value = item.estimatedCost;
  formEstimatedDurationHours.value = item.estimatedDurationHours;
  formDescription.value = item.description;
  formChecklistItems.value = [...item.checklistItems];
  newChecklistText.value = '';
  formIsActive.value = item.isActive;
  formAssignedVehicleIds.value = item.assignedVehicleIds ? [...item.assignedVehicleIds] : [];
  showModal.value = true;
}

function openDetailModal(item: MaintenanceType) {
  viewingItem.value = item;
  showDetailModal.value = true;
}

function addChecklistItem() {
  const text = newChecklistText.value.trim();
  if (text) {
    formChecklistItems.value.push(text);
    newChecklistText.value = '';
  }
}

function removeChecklistItem(index: number) {
  formChecklistItems.value.splice(index, 1);
}

function onGroupChange() {
  if (formGroup.value === 'Bảo dưỡng định kỳ') {
    if (!formCycleKm.value) formCycleKm.value = 5000;
    if (!formCycleMonths.value) formCycleMonths.value = 3;
  } else if (formGroup.value === 'Hệ thống chuyên dụng') {
    formCycleHours.value = 500;
    formCycleKm.value = undefined;
  }
}

function saveItem() {
  if (!formCode.value.trim() || !formName.value.trim()) {
    dialog.showWarning(
      'Vui lòng nhập đầy đủ Mã loại bảo dưỡng và Tên loại bảo dưỡng!',
      'Thiếu Thông Tin Bắt Buộc',
      'Kiểm tra lại'
    );
    return;
  }

  // Kiểm tra trùng mã code nếu thêm mới
  if (!editingItem.value) {
    const isDuplicate = fleetStore.maintenanceTypes.some(
      (m) => m.code.toUpperCase() === formCode.value.trim().toUpperCase()
    );
    if (isDuplicate) {
      dialog.showWarning(
        `Mã loại bảo dưỡng "${formCode.value.trim().toUpperCase()}" đã tồn tại trong hệ thống!`,
        'Trùng Mã Loại Bảo Dưỡng',
        'Thay đổi mã khác'
      );
      return;
    }
  }

  const payload: Omit<MaintenanceType, 'id'> = {
    code: formCode.value.trim().toUpperCase(),
    name: formName.value.trim(),
    group: formGroup.value,
    cycleKm: formCycleKm.value ? Number(formCycleKm.value) : undefined,
    cycleMonths: formCycleMonths.value ? Number(formCycleMonths.value) : undefined,
    cycleHours: formCycleHours.value ? Number(formCycleHours.value) : undefined,
    estimatedCost: Number(formEstimatedCost.value) || 0,
    estimatedDurationHours: Number(formEstimatedDurationHours.value) || 1,
    description: formDescription.value.trim(),
    checklistItems: formChecklistItems.value.filter((t) => t.trim().length > 0),
    isActive: formIsActive.value,
    assignedVehicleIds: formAssignedVehicleIds.value,
  };

  if (editingItem.value) {
    fleetStore.updateMaintenanceType({
      ...payload,
      id: editingItem.value.id,
    });
    dialog.showSuccess(
      `Đã cập nhật cấu hình loại bảo dưỡng "${payload.name}" (${payload.code}) thành công!`,
      'Cập Nhật Thành Công'
    );
  } else {
    fleetStore.addMaintenanceType(payload);
    dialog.showSuccess(
      `Đã thêm mới loại bảo dưỡng "${payload.name}" (${payload.code}) vào hệ thống thành công!`,
      'Thêm Mới Thành Công'
    );
  }

  showModal.value = false;
}

function toggleStatus(item: MaintenanceType) {
  fleetStore.toggleMaintenanceTypeStatus(item.id);
  const newStatus = !item.isActive;
  dialog.showSuccess(
    `Đã ${newStatus ? 'kích hoạt áp dụng' : 'tạm dừng áp dụng'} loại bảo dưỡng "${item.name}"!`,
    'Cập Nhật Trạng Thái'
  );
}

function confirmDelete(item: MaintenanceType) {
  dialog.showConfirm({
    title: 'Xóa Loại Bảo Dưỡng?',
    message: `Bạn có chắc chắn muốn xóa loại bảo dưỡng "${item.name}" (${item.code}) khỏi hệ thống? Các hồ sơ bảo dưỡng đã ghi nhận trước đây vẫn được lưu trữ.`,
    confirmText: 'Xác nhận xóa',
    cancelText: 'Hủy bỏ',
    onConfirm: () => {
      fleetStore.deleteMaintenanceType(item.id);
      dialog.showSuccess(
        `Đã xóa loại bảo dưỡng "${item.name}" khỏi danh mục thành công!`,
        'Xóa Thành Công'
      );
    },
  });
}
</script>

<template>
  <div class="maintenance-types-container">
    <!-- 1. Header Trang & Nút Thao Tác Chính -->
    <div class="page-header">
      <div class="header-left">
        <div class="title-with-icon">
          <div class="icon-wrap">
            <Wrench :size="24" class="text-primary" />
          </div>
          <div>
            <h1 class="page-title">Cài Đặt Bảo Dưỡng</h1>
            <p class="page-subtitle">
              Cấu hình định mức chu kỳ bảo dưỡng (Km / Giờ máy), chi phí dự toán và quy trình kiểm chuẩn cho đội xe
            </p>
          </div>
        </div>
      </div>
      <div class="header-right">
        <button class="btn btn-primary" @click="openAddModal">
          <Plus :size="16" />
          <span>Thêm loại bảo dưỡng mới</span>
        </button>
      </div>
    </div>

    <!-- 3. Thanh tìm kiếm & Bộ lọc nâng cao -->
    <div class="filter-card">
      <div class="search-box">
        <Search :size="16" class="search-icon" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Tìm theo mã, tên loại bảo dưỡng, hạng mục kiểm chuẩn..."
          class="search-input"
        />
      </div>

      <div class="filter-group">
        <label class="filter-label">Phân nhóm:</label>
        <select v-model="selectedGroup" class="filter-select">
          <option value="ALL">Tất cả nhóm</option>
          <option value="Bảo dưỡng định kỳ">Bảo dưỡng định kỳ</option>
          <option value="Sửa chữa phục hồi">Sửa chữa phục hồi</option>
          <option value="Hệ thống chuyên dụng">Hệ thống chuyên dụng</option>
        </select>
      </div>

      <div class="filter-group">
        <label class="filter-label">Trạng thái:</label>
        <select v-model="selectedStatus" class="filter-select">
          <option value="ALL">Tất cả trạng thái</option>
          <option value="ACTIVE">Đang áp dụng</option>
          <option value="INACTIVE">Tạm dừng</option>
        </select>
      </div>
    </div>

    <!-- 4. Bảng danh sách Loại bảo dưỡng -->
    <div class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th style="width: 120px; white-space: nowrap">Mã</th>
            <th style="min-width: 180px">Tên Loại Bảo Dưỡng</th>
            <th style="width: 125px">Phân Nhóm</th>
            <th style="width: 95px; text-align: center; white-space: nowrap">Số Xe</th>
            <th style="width: 175px">Biển Số Xe Áp Dụng</th>
            <th style="width: 150px">Chu Kỳ Kỹ Thuật</th>
            <th style="width: 130px">Chi Phí Dự Toán</th>
            <th style="width: 85px">Thời Gian</th>
            <th style="width: 135px; white-space: nowrap">Hạng Mục</th>
            <th style="width: 110px; white-space: nowrap">Trạng Thái</th>
            <th style="width: 85px; text-align: center; white-space: nowrap">Thao Tác</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="filteredTypes.length === 0">
            <td colspan="11" class="empty-row">
              <div class="empty-state">
                <AlertCircle :size="32" class="empty-icon" />
                <p>Không tìm thấy loại bảo dưỡng nào phù hợp với điều kiện tìm kiếm.</p>
              </div>
            </td>
          </tr>
          <tr v-for="item in filteredTypes" :key="item.id" :class="{ 'row-inactive': !item.isActive }">
            <td style="white-space: nowrap">
              <span class="type-code-tag">{{ item.code }}</span>
            </td>
            <td>
              <div class="type-name-block">
                <span class="type-name-text font-medium">{{ item.name }}</span>
                <span v-if="item.description" class="type-desc-mini">{{ item.description }}</span>
              </div>
            </td>
            <td>
              <span
                class="group-badge"
                :class="{
                  'badge-periodic': item.group === 'Bảo dưỡng định kỳ',
                  'badge-repair': item.group === 'Sửa chữa phục hồi',
                  'badge-special': item.group === 'Hệ thống chuyên dụng',
                }"
              >
                {{ item.group }}
              </span>
            </td>
            <!-- Cột 1: Số lượng xe & nút phân bổ -->
            <td style="text-align: center; white-space: nowrap">
              <button
                class="btn-assigned-vehicles"
                :class="{ 'has-vehicles': (item.assignedVehicleIds?.length || 0) > 0 }"
                @click="openAssignModal(item)"
                title="Bấm để phân bổ xe áp dụng"
              >
                <Truck :size="13" />
                <span>{{ (item.assignedVehicleIds?.length || 0) > 0 ? `${item.assignedVehicleIds?.length} xe` : '0 xe' }}</span>
              </button>
            </td>
            <!-- Cột 2 (Đơn vị khoanh đỏ): Danh sách biển số xe cụ thể -->
            <td>
              <div v-if="(item.assignedVehicleIds?.length || 0) > 0" class="vehicle-plate-tags">
                <span
                  v-for="v in getAssignedVehicles(item.assignedVehicleIds)"
                  :key="v.id"
                  class="plate-mini-tag"
                  :title="`${v.model} (ODO: ${v.currentOdoKm.toLocaleString('vi-VN')} km)`"
                >
                  {{ v.licensePlate }}
                </span>
              </div>
              <span v-else class="text-muted-empty">Chưa gán xe</span>
            </td>
            <td>
              <div class="cycle-cell">
                <span v-if="item.cycleKm" class="cycle-km">
                  🏁 <strong>{{ item.cycleKm.toLocaleString('vi-VN') }}</strong> km
                </span>
                <span v-if="item.cycleHours" class="cycle-hours">
                  ⚙️ <strong>{{ item.cycleHours }}</strong> giờ máy
                </span>
                <span v-if="item.cycleMonths" class="cycle-months">
                  📅 Định kỳ: <strong>{{ item.cycleMonths }}</strong> tháng
                </span>
              </div>
            </td>
            <td>
              <div class="cost-cell">
                <span class="cost-value">{{ formatCurrency(item.estimatedCost) }}</span>
              </div>
            </td>
            <td>
              <span class="duration-badge">{{ item.estimatedDurationHours }} giờ</span>
            </td>
            <td style="white-space: nowrap">
              <button
                class="btn-checklist-preview"
                @click="openDetailModal(item)"
                title="Bấm để xem danh sách hạng mục kiểm tra"
              >
                <CheckSquare :size="13" />
                <span>{{ item.checklistItems.length }} hạng mục</span>
              </button>
            </td>
            <td style="white-space: nowrap">
              <span
                class="status-badge"
                :class="item.isActive ? 'badge-active' : 'badge-inactive'"
                style="cursor: pointer"
                @click="toggleStatus(item)"
                title="Bấm để chuyển trạng thái Áp dụng / Tạm dừng"
              >
                <span class="status-dot"></span>
                <span>{{ item.isActive ? 'Áp dụng' : 'Tạm dừng' }}</span>
              </span>
            </td>
            <td>
              <div class="actions-cell">
                <button
                  class="action-btn btn-edit"
                  @click="openEditModal(item)"
                  title="Chỉnh sửa loại bảo dưỡng"
                >
                  <Edit2 :size="14" />
                </button>
                <button
                  class="action-btn btn-delete"
                  @click="confirmDelete(item)"
                  title="Xóa loại bảo dưỡng"
                >
                  <Trash2 :size="14" />
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 5. Modal Thêm / Chỉnh sửa Loại Bảo Dưỡng -->
    <div v-if="showModal" class="modal-backdrop">
      <div class="modal-dialog">
        <div class="modal-header">
          <div class="modal-title-wrap">
            <Wrench :size="18" class="text-primary" />
            <h3 class="modal-title">
              {{ editingItem ? 'Cập Nhật Loại Bảo Dưỡng' : 'Thêm Mới Loại Bảo Dưỡng' }}
            </h3>
          </div>
          <button class="btn-close" @click="showModal = false">
            <X :size="18" />
          </button>
        </div>

        <div class="modal-body">
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label required">Mã loại bảo dưỡng:</label>
              <input
                v-model="formCode"
                type="text"
                placeholder="VD: BD-DK-5000"
                class="form-control uppercase"
                :disabled="!!editingItem"
              />
              <span class="form-hint">Mã định danh duy nhất (chữ in hoa)</span>
            </div>

            <div class="form-group">
              <label class="form-label required">Tên loại bảo dưỡng:</label>
              <input
                v-model="formName"
                type="text"
                placeholder="VD: Bảo dưỡng định kỳ 5.000 km"
                class="form-control"
              />
            </div>

            <div class="form-group">
              <label class="form-label required">Phân nhóm:</label>
              <select v-model="formGroup" class="form-control" @change="onGroupChange">
                <option value="Bảo dưỡng định kỳ">Bảo dưỡng định kỳ</option>
                <option value="Sửa chữa phục hồi">Sửa chữa phục hồi</option>
                <option value="Hệ thống chuyên dụng">Hệ thống chuyên dụng (Bồn mủ/Thủy lực)</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Chu kỳ định mức (Km):</label>
              <input
                v-model.number="formCycleKm"
                type="number"
                placeholder="VD: 5000"
                class="form-control"
              />
              <span class="form-help-text">
                💡 Định mức này được hệ thống sử dụng làm ngưỡng tự động kích hoạt cảnh báo xe cần bảo dưỡng trong Đội xe & Dashboard.
              </span>
            </div>

            <div class="form-group">
              <label class="form-label">Chu kỳ định mức (Tháng):</label>
              <input
                v-model.number="formCycleMonths"
                type="number"
                placeholder="VD: 3 hoặc 6"
                class="form-control"
              />
            </div>

            <div class="form-group">
              <label class="form-label">Chu kỳ định mức (Giờ máy):</label>
              <input
                v-model.number="formCycleHours"
                type="number"
                placeholder="VD: 500 (dành cho máy đào)"
                class="form-control"
              />
            </div>

            <div class="form-group">
              <label class="form-label required">Chi phí dự toán (VNĐ):</label>
              <input
                v-model.number="formEstimatedCost"
                type="number"
                placeholder="VD: 2500000"
                class="form-control"
              />
            </div>

            <div class="form-group">
              <label class="form-label required">Thời gian thực hiện (giờ):</label>
              <input
                v-model.number="formEstimatedDurationHours"
                type="number"
                step="0.5"
                placeholder="VD: 3"
                class="form-control"
              />
            </div>

            <div class="form-group full-width">
              <label class="form-label">Mô tả & Hướng dẫn kỹ thuật:</label>
              <textarea
                v-model="formDescription"
                rows="2"
                placeholder="Ghi chú thêm về quy chuẩn kỹ thuật hoặc vật tư thay thế..."
                class="form-control"
              ></textarea>
            </div>

            <!-- Checklist các hạng mục kiểm tra kỹ thuật -->
            <div class="form-group full-width">
              <label class="form-label">Quy trình kiểm chuẩn & Hạng mục kiểm tra:</label>
              <div class="checklist-builder">
                <div class="checklist-input-row">
                  <input
                    v-model="newChecklistText"
                    type="text"
                    placeholder="Nhập hạng mục kiểm tra kỹ thuật mới..."
                    class="form-control"
                    @keyup.enter="addChecklistItem"
                  />
                  <button type="button" class="btn btn-outline" @click="addChecklistItem">
                    <Plus :size="14" />
                    <span>Thêm</span>
                  </button>
                </div>

                <div v-if="formChecklistItems.length > 0" class="checklist-items-box">
                  <div
                    v-for="(itemText, idx) in formChecklistItems"
                    :key="idx"
                    class="checklist-item-pill"
                  >
                    <span class="item-index">{{ idx + 1 }}</span>
                    <span class="item-text">{{ itemText }}</span>
                    <button
                      type="button"
                      class="btn-remove-item"
                      @click="removeChecklistItem(idx)"
                      title="Xóa hạng mục này"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Xe áp dụng cấu hình này (Cài đặt bảo dưỡng theo từng xe cụ thể) -->
            <div class="form-group full-width">
              <div class="vehicle-select-header">
                <label class="form-label required">
                  Xe áp dụng quy trình bảo dưỡng này (Cài đặt bảo dưỡng theo từng xe cụ thể):
                </label>
                <div class="vehicle-select-actions">
                  <button type="button" class="btn-text-action" @click="selectAllFormVehicles">Chọn tất cả</button>
                  <span class="sep">•</span>
                  <button type="button" class="btn-text-action" @click="clearAllFormVehicles">Bỏ chọn</button>
                  <span class="selected-count-pill">Đã chọn {{ formAssignedVehicleIds.length }}/{{ fleetStore.vehicles.length }} xe</span>
                </div>
              </div>
              <div class="vehicles-checkbox-grid">
                <div
                  v-for="v in fleetStore.vehicles"
                  :key="v.id"
                  class="vehicle-select-card"
                  :class="{ selected: formAssignedVehicleIds.includes(v.id) }"
                  @click="toggleVehicleInForm(v.id)"
                >
                  <input
                    type="checkbox"
                    :checked="formAssignedVehicleIds.includes(v.id)"
                    class="veh-checkbox"
                    @click.stop
                    @change="toggleVehicleInForm(v.id)"
                  />
                  <div class="veh-info">
                    <div class="veh-plate-row">
                      <span class="veh-plate">{{ v.licensePlate }}</span>
                      <span class="veh-type-badge">{{ v.vehicleType }}</span>
                    </div>
                    <div class="veh-model">{{ v.model }}</div>
                    <div class="veh-submeta">
                      <span>ODO: <strong>{{ v.currentOdoKm.toLocaleString('vi-VN') }}</strong> km</span>
                      <span v-if="v.assignedDriverName">• {{ v.assignedDriverName }}</span>
                    </div>
                  </div>
                </div>
              </div>
              <span class="form-help-text">
                🚗 Hệ thống cho phép thiết lập bảo dưỡng dựa trên 1 chiếc xe duy nhất hoặc nhóm xe cụ thể. Ngưỡng cảnh báo tự động sẽ áp dụng chính xác cho từng xe được chọn.
              </span>
            </div>

            <div class="form-group full-width">
              <label class="checkbox-label">
                <input v-model="formIsActive" type="checkbox" />
                <span>Kích hoạt áp dụng loại bảo dưỡng này ngay vào hệ thống điều độ</span>
              </label>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn btn-outline" @click="showModal = false">Hủy bỏ</button>
          <button class="btn btn-primary" @click="saveItem">
            <CheckCircle2 :size="16" />
            <span>{{ editingItem ? 'Lưu cập nhật' : 'Tạo loại bảo dưỡng' }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- 6. Modal Chi Tiết Hạng Mục Kiểm Chuẩn Kỹ Thuật & Xe Áp Dụng -->
    <div v-if="showDetailModal && viewingItem" class="modal-backdrop">
      <div class="modal-dialog modal-detail">
        <div class="modal-header">
          <div class="modal-title-wrap">
            <CheckSquare :size="18" class="text-primary" />
            <h3 class="modal-title">Quy Trình Kiểm Chuẩn Kỹ Thuật</h3>
          </div>
          <button class="btn-close" @click="showDetailModal = false">
            <X :size="18" />
          </button>
        </div>

        <div class="modal-body">
          <div class="detail-overview">
            <div class="detail-header-tag">
              <span class="type-code-tag">{{ viewingItem.code }}</span>
              <h4 class="detail-name">{{ viewingItem.name }}</h4>
            </div>
            <p v-if="viewingItem.description" class="detail-desc">{{ viewingItem.description }}</p>

            <div class="detail-meta-grid">
              <div><strong>Phân nhóm:</strong> {{ viewingItem.group }}</div>
              <div><strong>Chi phí dự toán:</strong> {{ formatCurrency(viewingItem.estimatedCost) }}</div>
              <div><strong>Thời gian dự kiến:</strong> {{ viewingItem.estimatedDurationHours }} giờ</div>
              <div><strong>Số xe áp dụng:</strong> {{ viewingItem.assignedVehicleIds?.length || 0 }} xe</div>
            </div>
          </div>

          <!-- Danh sách xe áp dụng -->
          <div class="detail-vehicles-section">
            <h5 class="checklist-section-title">
              Xe Áp Dụng Cấu Hình Này ({{ (viewingItem.assignedVehicleIds?.length || 0) }} xe):
            </h5>
            <div v-if="getAssignedVehicles(viewingItem.assignedVehicleIds).length === 0" class="empty-assigned-notice">
              <span>Chưa có xe nào được phân bổ áp dụng cho loại bảo dưỡng này.</span>
            </div>
            <div v-else class="detail-vehicles-grid">
              <div
                v-for="v in getAssignedVehicles(viewingItem.assignedVehicleIds)"
                :key="v.id"
                class="detail-vehicle-card"
              >
                <Truck :size="16" class="text-primary" />
                <div class="detail-veh-info">
                  <div class="detail-veh-plate">{{ v.licensePlate }}</div>
                  <div class="detail-veh-meta">{{ v.model }} (ODO: {{ v.currentOdoKm.toLocaleString('vi-VN') }} km)</div>
                </div>
              </div>
            </div>
          </div>

          <h5 class="checklist-section-title" style="margin-top: 16px;">
            Danh Mục Hạng Mục Kiểm Tra & Thay Thế ({{ viewingItem.checklistItems.length }} mục):
          </h5>

          <div class="detail-checklist-list">
            <div
              v-for="(task, i) in viewingItem.checklistItems"
              :key="i"
              class="detail-check-row"
            >
              <span class="check-num">{{ i + 1 }}</span>
              <span class="check-text">{{ task }}</span>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn btn-outline" @click="showDetailModal = false">Đóng</button>
          <button
            class="btn btn-primary"
            @click="
              showDetailModal = false;
              openEditModal(viewingItem);
            "
          >
            <Edit2 :size="14" />
            <span>Chỉnh sửa cấu hình</span>
          </button>
        </div>
      </div>
    </div>

    <!-- 7. Modal Phân Bổ Xe Áp Dụng Nhanh -->
    <div v-if="showAssignModal && assigningItem" class="modal-backdrop">
      <div class="modal-dialog modal-assign">
        <div class="modal-header">
          <div class="modal-title-wrap">
            <Truck :size="18" class="text-primary" />
            <h3 class="modal-title">Phân Bổ Xe Áp Dụng Bảo Dưỡng</h3>
          </div>
          <button class="btn-close" @click="showAssignModal = false">
            <X :size="18" />
          </button>
        </div>

        <div class="modal-body">
          <div class="assign-banner">
            <div class="assign-banner-code">{{ assigningItem.code }}</div>
            <div class="assign-banner-info">
              <h4 class="assign-banner-title">{{ assigningItem.name }}</h4>
              <p class="assign-banner-sub">
                Định mức: <strong>{{ assigningItem.cycleKm ? `${assigningItem.cycleKm.toLocaleString('vi-VN')} km` : (assigningItem.cycleHours ? `${assigningItem.cycleHours} giờ` : 'Định kỳ') }}</strong>
                • Chi phí: <strong>{{ formatCurrency(assigningItem.estimatedCost) }}</strong>
              </p>
            </div>
          </div>

          <div class="vehicle-select-header">
            <label class="form-label">
              Tích chọn các xe sẽ áp dụng quy chuẩn bảo dưỡng này:
            </label>
            <div class="vehicle-select-actions">
              <button type="button" class="btn-text-action" @click="selectAllAssignVehicles">Chọn tất cả</button>
              <span class="sep">•</span>
              <button type="button" class="btn-text-action" @click="clearAllAssignVehicles">Bỏ chọn</button>
              <span class="selected-count-pill">Đã chọn {{ assignVehicleIds.length }}/{{ fleetStore.vehicles.length }} xe</span>
            </div>
          </div>

          <div class="vehicles-checkbox-grid">
            <div
              v-for="v in fleetStore.vehicles"
              :key="v.id"
              class="vehicle-select-card"
              :class="{ selected: assignVehicleIds.includes(v.id) }"
              @click="toggleVehicleInAssign(v.id)"
            >
              <input
                type="checkbox"
                :checked="assignVehicleIds.includes(v.id)"
                class="veh-checkbox"
                @click.stop
                @change="toggleVehicleInAssign(v.id)"
              />
              <div class="veh-info">
                <div class="veh-plate-row">
                  <span class="veh-plate">{{ v.licensePlate }}</span>
                  <span class="veh-type-badge">{{ v.vehicleType }}</span>
                </div>
                <div class="veh-model">{{ v.model }}</div>
                <div class="veh-submeta">
                  <span>ODO: <strong>{{ v.currentOdoKm.toLocaleString('vi-VN') }}</strong> km</span>
                  <span v-if="v.assignedDriverName">• {{ v.assignedDriverName }}</span>
                </div>
              </div>
            </div>
          </div>

          <span class="form-help-text">
            💡 Thiết lập cài đặt bảo dưỡng theo từng xe giúp hệ thống điều vận theo dõi chính xác thời điểm thay nhớt, dầu máy, gầm phanh cho riêng từng phương tiện.
          </span>
        </div>

        <div class="modal-footer">
          <button class="btn btn-outline" @click="showAssignModal = false">Hủy bỏ</button>
          <button class="btn btn-primary" @click="saveAssignedVehicles">
            <CheckCircle2 :size="16" />
            <span>Lưu phân bổ xe ({{ assignVehicleIds.length }})</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.maintenance-types-container {
  padding: 24px;
  background: #f8fafc;
  min-height: calc(100vh - 64px);
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* Page Header */
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.title-with-icon {
  display: flex;
  align-items: center;
  gap: 12px;
}

.icon-wrap {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  background: #dcfce7;
  color: #15803d;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.page-title {
  font-size: 1.35rem;
  font-weight: 800;
  color: #0f172a;
  margin: 0;
}

.page-subtitle {
  font-size: 0.8125rem;
  color: #64748b;
  margin: 4px 0 0 0;
}

/* Filters */
.filter-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 14px 16px;
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
}

.search-box {
  flex: 1;
  min-width: 260px;
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 12px;
  color: #94a3b8;
}

.search-input {
  width: 100%;
  padding: 8px 12px 8px 36px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  font-size: 0.8125rem;
  outline: none;
  transition: border-color 0.2s;
}

.search-input:focus {
  border-color: #15803d;
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.filter-label {
  font-size: 0.8125rem;
  font-weight: 600;
  color: #475569;
  white-space: nowrap;
}

.filter-select {
  padding: 7px 12px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  font-size: 0.8125rem;
  color: #334155;
  background: #ffffff;
  outline: none;
}

.filter-select:focus {
  border-color: #15803d;
}

/* Data Table */
.table-container {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  overflow-x: auto;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8125rem;
  text-align: left;
}

.data-table th {
  background: #f8fafc;
  padding: 12px 14px;
  font-weight: 700;
  color: #334155;
  border-bottom: 1px solid #e2e8f0;
  white-space: nowrap;
}

.data-table td {
  padding: 12px 14px;
  border-bottom: 1px solid #f1f5f9;
  color: #1e293b;
  vertical-align: middle;
}

.data-table tbody tr:hover {
  background: #f0fdf4;
}

.row-inactive {
  opacity: 0.6;
  background: #fafafa;
}

.code-name-wrap {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.type-code-tag {
  display: inline-block;
  font-family: monospace;
  font-size: 0.6875rem;
  font-weight: 800;
  background: #e2e8f0;
  color: #0f172a;
  padding: 3px 8px;
  border-radius: 4px;
  width: fit-content;
  white-space: nowrap;
}

.type-name-text {
  font-weight: 700;
  color: #0f172a;
}

.type-desc-mini {
  font-size: 0.6875rem;
  color: #64748b;
  line-height: 1.3;
}

.group-badge {
  display: inline-block;
  font-size: 0.6875rem;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 6px;
  white-space: nowrap;
}
.badge-periodic { background: #e0f2fe; color: #0369a1; }
.badge-repair { background: #fef3c7; color: #b45309; }
.badge-special { background: #f3e8ff; color: #7e22ce; }

.vehicle-type-tag {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 0.75rem;
  font-weight: 600;
  color: #475569;
  background: #f1f5f9;
  padding: 3px 8px;
  border-radius: 4px;
}

.cycle-cell {
  display: flex;
  flex-direction: column;
  gap: 3px;
  font-size: 0.6875rem;
  color: #475569;
}

.cost-cell {
  display: flex;
  flex-direction: column;
}

.cost-value {
  font-weight: 800;
  color: #15803d;
  font-size: 0.8125rem;
}

.duration-badge {
  display: inline-block;
  font-size: 0.6875rem;
  font-weight: 700;
  background: #f1f5f9;
  color: #334155;
  padding: 2px 6px;
  border-radius: 4px;
}

.btn-checklist-preview {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  color: #1d4ed8;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 0.6875rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.btn-checklist-preview span {
  white-space: nowrap;
}

.btn-checklist-preview:hover {
  background: #dbeafe;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.6875rem;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 12px;
  white-space: nowrap;
}

.status-badge span {
  white-space: nowrap;
}
.badge-active { background: #dcfce7; color: #15803d; }
.badge-inactive { background: #fee2e2; color: #b91c1c; }

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}

.actions-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.action-btn {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: 1px solid #cbd5e1;
  background: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  color: #475569;
}

.action-btn:hover {
  transform: translateY(-1px);
}

.btn-edit:hover { background: #e0f2fe; color: #0284c7; border-color: #7dd3fc; }
.btn-power-off:hover { background: #fee2e2; color: #dc2626; border-color: #fca5a5; }
.btn-power-on:hover { background: #dcfce7; color: #16a34a; border-color: #86efac; }
.btn-delete:hover { background: #fee2e2; color: #dc2626; border-color: #fca5a5; }

.empty-row {
  text-align: center;
  padding: 40px !important;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  color: #94a3b8;
  gap: 10px;
}

.empty-icon {
  color: #cbd5e1;
}

/* Modal Styles */
.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(15, 23, 42, 0.6);
  backdrop-filter: blur(4px);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.modal-dialog {
  background: #ffffff;
  border-radius: 12px;
  width: 100%;
  max-width: 820px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.modal-detail {
  max-width: 560px;
}

.modal-header {
  padding: 16px 20px;
  border-bottom: 1px solid #f1f5f9;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.modal-title-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
}

.modal-title {
  font-size: 1.05rem;
  font-weight: 800;
  color: #0f172a;
  margin: 0;
}

.btn-close {
  background: transparent;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
}

.btn-close:hover {
  color: #0f172a;
  background: #f1f5f9;
}

.modal-body {
  padding: 20px;
  overflow-y: auto;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.form-group.full-width {
  grid-column: 1 / -1;
}

.form-label {
  font-size: 0.75rem;
  font-weight: 700;
  color: #334155;
}

.form-label.required::after {
  content: ' *';
  color: #dc2626;
}

.form-control {
  padding: 8px 12px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  font-size: 0.8125rem;
  outline: none;
  transition: border-color 0.2s;
}

.form-control:focus {
  border-color: #15803d;
}

.form-control.uppercase {
  text-transform: uppercase;
}

.form-hint {
  font-size: 0.6875rem;
  color: #94a3b8;
}

/* Checklist Builder */
.checklist-builder {
  border: 1px solid #e2e8f0;
  background: #f8fafc;
  border-radius: 8px;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.checklist-input-row {
  display: flex;
  gap: 8px;
}

.checklist-items-box {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 160px;
  overflow-y: auto;
}

.checklist-item-pill {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #ffffff;
  border: 1px solid #cbd5e1;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 0.75rem;
}

.item-index {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #e2e8f0;
  color: #334155;
  font-size: 0.625rem;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.item-text {
  flex: 1;
  color: #1e293b;
}

.btn-remove-item {
  background: transparent;
  border: none;
  color: #ef4444;
  cursor: pointer;
  font-weight: 800;
  padding: 2px 6px;
  border-radius: 4px;
}

.btn-remove-item:hover {
  background: #fee2e2;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.8125rem;
  font-weight: 600;
  color: #334155;
  cursor: pointer;
}

.modal-footer {
  padding: 14px 20px;
  border-top: 1px solid #f1f5f9;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  background: #fafafa;
}

/* Detail Modal Styles */
.detail-overview {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 14px;
  margin-bottom: 16px;
}

.detail-header-tag {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.detail-name {
  font-size: 0.9375rem;
  font-weight: 800;
  color: #0f172a;
  margin: 0;
}

.detail-desc {
  font-size: 0.75rem;
  color: #64748b;
  margin: 0 0 10px 0;
}

.detail-meta-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  font-size: 0.75rem;
  color: #334155;
}

.checklist-section-title {
  font-size: 0.8125rem;
  font-weight: 800;
  color: #0f172a;
  margin: 0 0 10px 0;
}

.detail-checklist-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.detail-check-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 8px 12px;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 6px;
  font-size: 0.75rem;
}

.check-num {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #16a34a;
  color: #ffffff;
  font-size: 0.6875rem;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.check-text {
  color: #15803d;
  font-weight: 600;
  line-height: 1.4;
}

/* Button UI Components */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  font-size: 0.8125rem;
  font-weight: 700;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.btn-primary {
  background: #15803d;
  color: #ffffff;
}

.btn-primary:hover {
  background: #166534;
}

.btn-outline {
  background: #ffffff;
  border: 1px solid #cbd5e1;
  color: #475569;
}

.btn-outline:hover {
  background: #f1f5f9;
  color: #0f172a;
}

.auto-rule-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: #ecfdf5;
  color: #047857;
  border: 1px solid #a7f3d0;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.6875rem;
  font-weight: 700;
  margin-top: 4px;
}

.form-help-text {
  display: block;
  font-size: 0.75rem;
  color: #0284c7;
  line-height: 1.4;
  margin-top: 4px;
  font-weight: 500;
}

/* Cột Xe áp dụng & Tags trong Bảng */
.assigned-vehicles-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.btn-assigned-vehicles {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  background: #f1f5f9;
  border: 1px solid #cbd5e1;
  color: #475569;
  font-size: 0.6875rem;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
  width: fit-content;
  white-space: nowrap;
}

.btn-assigned-vehicles span {
  white-space: nowrap;
}

.btn-assigned-vehicles:hover {
  background: #e2e8f0;
  color: #0f172a;
}

.btn-assigned-vehicles.has-vehicles {
  background: #ecfdf5;
  border-color: #a7f3d0;
  color: #065f46;
}

.btn-assigned-vehicles.has-vehicles:hover {
  background: #d1fae5;
}

.vehicle-plate-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
}

.plate-mini-tag {
  background: #ffffff;
  border: 1px solid #cbd5e1;
  color: #1e293b;
  font-size: 0.6875rem;
  font-weight: 700;
  font-family: monospace;
  padding: 1px 5px;
  border-radius: 4px;
}

.plate-more-tag {
  background: #f1f5f9;
  color: #64748b;
  font-size: 0.625rem;
  font-weight: 700;
  padding: 1px 4px;
  border-radius: 4px;
}

.type-name-block {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.text-muted-empty {
  font-size: 0.75rem;
  color: #94a3b8;
  font-style: italic;
}

.btn-assign {
  color: #0284c7;
}

.btn-assign:hover {
  background: #e0f2fe;
  color: #0369a1;
}

/* Vehicle selection UI in Modals */
.vehicle-select-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
}

.vehicle-select-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn-text-action {
  background: none;
  border: none;
  color: #0284c7;
  font-size: 0.75rem;
  font-weight: 700;
  cursor: pointer;
  padding: 0;
}

.btn-text-action:hover {
  text-decoration: underline;
  color: #0369a1;
}

.sep {
  color: #cbd5e1;
  font-size: 0.75rem;
}

.selected-count-pill {
  background: #f0fdf4;
  color: #166534;
  border: 1px solid #bbf7d0;
  font-size: 0.6875rem;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 12px;
}

.vehicles-checkbox-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
  gap: 10px;
  max-height: 240px;
  overflow-y: auto;
  padding: 6px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
}

.vehicle-select-card {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px;
  background: #ffffff;
  border: 1.5px solid #e2e8f0;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.vehicle-select-card:hover {
  border-color: #94a3b8;
  background: #f8fafc;
}

.vehicle-select-card.selected {
  border-color: #16a34a;
  background: #f0fdf4;
}

.veh-checkbox {
  margin-top: 3px;
  width: 16px;
  height: 16px;
  accent-color: #16a34a;
  cursor: pointer;
}

.veh-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.veh-plate-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}

.veh-plate {
  font-weight: 800;
  font-family: monospace;
  font-size: 0.8125rem;
  color: #0f172a;
}

.veh-type-badge {
  font-size: 0.625rem;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 4px;
  background: #e0f2fe;
  color: #0369a1;
}

.veh-model {
  font-size: 0.75rem;
  color: #475569;
  font-weight: 500;
}

.veh-submeta {
  font-size: 0.6875rem;
  color: #64748b;
  display: flex;
  gap: 6px;
  margin-top: 2px;
}

/* Modal Assign */
.modal-assign {
  max-width: 650px;
}

.assign-banner {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 8px;
  margin-bottom: 16px;
}

.assign-banner-code {
  background: #15803d;
  color: #ffffff;
  font-weight: 800;
  font-family: monospace;
  font-size: 0.75rem;
  padding: 4px 8px;
  border-radius: 6px;
}

.assign-banner-info {
  flex: 1;
}

.assign-banner-title {
  font-size: 0.875rem;
  font-weight: 800;
  color: #0f172a;
  margin: 0;
}

.assign-banner-sub {
  font-size: 0.75rem;
  color: #475569;
  margin: 2px 0 0 0;
}

/* Detail Modal Vehicles */
.detail-vehicles-section {
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px dashed #cbd5e1;
}

.detail-vehicles-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 8px;
}

.detail-vehicle-card {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  background: #ffffff;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
}

.detail-veh-info {
  display: flex;
  flex-direction: column;
}

.detail-veh-plate {
  font-weight: 800;
  font-family: monospace;
  font-size: 0.8125rem;
  color: #0f172a;
}

.detail-veh-meta {
  font-size: 0.6875rem;
  color: #64748b;
}

.empty-assigned-notice {
  font-size: 0.75rem;
  color: #94a3b8;
  font-style: italic;
}
</style>
