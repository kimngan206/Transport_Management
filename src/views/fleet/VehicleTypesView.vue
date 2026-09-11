<script setup lang="ts">
import { ref, computed } from 'vue';
import { useFleetStore } from '@/stores/fleet';
import FormulaBuilder from '@/components/common/FormulaBuilder.vue';
import type { VehicleCategory, VehicleType } from '@/types';
import {
  Truck,
  Plus,
  Search,
  Edit2,
  Trash2,
} from 'lucide-vue-next';

import { useDialogStore } from '@/stores/dialog';

const fleetStore = useFleetStore();
const dialog = useDialogStore();

// Tìm kiếm & Bộ lọc
const searchQuery = ref('');
const selectedGroup = ref<string>('ALL');
const selectedStatus = ref<string>('ALL');

// Modal Thêm / Chỉnh sửa
const showModal = ref(false);
const editingCategory = ref<VehicleCategory | null>(null);

// Form state
const formCode = ref('');
const formName = ref('');
const formGroup = ref<'Vận tải mủ' | 'Cơ giới nông trường' | 'Công tác & Kỹ thuật'>('Vận tải mủ');
const formVehicleType = ref<VehicleType>('LatexTruck');
const formCapacityTons = ref<number | undefined>(5.0);
const formSeats = ref<number | undefined>(undefined);
const formFuelQuotaType = ref<'L_PER_KM' | 'L_PER_TON_KM' | 'L_PER_HOUR' | 'KWH_PER_KM'>('L_PER_TON_KM');
const formDefaultQuotaEmpty = ref<number>(0.25);
const formDefaultQuotaLoaded = ref<number | undefined>(0.02);
const formDescription = ref('');
const formFuelFormulaText = ref('');
const formIsActive = ref(true);
const showFormulaModal = ref(false);
const formulaEditorDraft = ref('');

// Thống kê nhanh
const totalCategories = computed(() => fleetStore.vehicleCategories.length);

// Đếm số xe thực tế trong đội xe tương ứng với từng loại xe
function countVehiclesForCategory(category: VehicleCategory): number {
  return fleetStore.vehicles.filter((v) => {
    if (category.vehicleTypeCode === 'MillingMachine') return v.vehicleType === 'MillingMachine';
    if (category.vehicleTypeCode === 'PassengerCar') return v.vehicleType === 'PassengerCar';
    // Truck: chia thành xe tải hoặc xe bồn téc theo model/tải trọng
    if (category.code === 'TANKER_LATEX') {
      return v.vehicleType === 'LatexTruck' && (v.capacityTons >= 7.0 || v.model.toLowerCase().includes('bồn'));
    }
    return v.vehicleType === 'LatexTruck' && !v.model.toLowerCase().includes('bồn');
  }).length;
}

// Danh sách sau khi lọc
const filteredCategories = computed(() => {
  return fleetStore.vehicleCategories.filter((c) => {
    const matchSearch =
      c.code.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      c.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      c.description.toLowerCase().includes(searchQuery.value.toLowerCase());

    const matchGroup = selectedGroup.value === 'ALL' || c.group === selectedGroup.value;
    const matchStatus =
      selectedStatus.value === 'ALL' ||
      (selectedStatus.value === 'ACTIVE' && c.isActive) ||
      (selectedStatus.value === 'INACTIVE' && !c.isActive);

    return matchSearch && matchGroup && matchStatus;
  });
});

function openAddModal() {
  editingCategory.value = null;
  formCode.value = '';
  formName.value = '';
  formGroup.value = 'Vận tải mủ';
  formVehicleType.value = 'LatexTruck';
  formCapacityTons.value = 5.0;
  formSeats.value = undefined;
  formFuelQuotaType.value = 'L_PER_TON_KM';
  formDefaultQuotaEmpty.value = 0.25;
  formDefaultQuotaLoaded.value = 0.02;
  formDescription.value = '';
  formFuelFormulaText.value = '';
  formIsActive.value = true;
  showModal.value = true;
}

function openEditModal(category: VehicleCategory) {
  editingCategory.value = category;
  formCode.value = category.code;
  formName.value = category.name;
  formGroup.value = category.group;
  formVehicleType.value = category.vehicleTypeCode;
  formCapacityTons.value = category.standardCapacityTons;
  formSeats.value = category.standardSeats;
  formFuelQuotaType.value = category.fuelQuotaType;
  formDefaultQuotaEmpty.value = category.defaultQuotaEmpty;
  formDefaultQuotaLoaded.value = category.defaultQuotaLoaded;
  formDescription.value = category.description;
  formFuelFormulaText.value = category.fuelFormulaText || '';
  formIsActive.value = category.isActive;
  showModal.value = true;
}

function openFormulaEditor() {
  formulaEditorDraft.value = formFuelFormulaText.value;
  showFormulaModal.value = true;
}

function saveFormulaFromModal() {
  formFuelFormulaText.value = formulaEditorDraft.value.trim();
  showFormulaModal.value = false;
}

function applyVehicleTypeDefaults(type: VehicleType) {
  if (type === 'LatexTruck') {
    formFuelQuotaType.value = 'L_PER_TON_KM';
    formDefaultQuotaEmpty.value = 0.25;
    formDefaultQuotaLoaded.value = 0.02;
    formCapacityTons.value = 5.0;
    formSeats.value = undefined;
  } else if (type === 'MillingMachine') {
    formFuelQuotaType.value = 'L_PER_HOUR';
    formDefaultQuotaEmpty.value = 14.5;
    formDefaultQuotaLoaded.value = undefined;
    formCapacityTons.value = 20.0;
    formSeats.value = undefined;
  } else {
    formFuelQuotaType.value = 'L_PER_KM';
    formDefaultQuotaEmpty.value = 0.10;
    formDefaultQuotaLoaded.value = 0.005;
    formCapacityTons.value = 0.8;
    formSeats.value = 5;
  }
}

function onGroupChange() {
  if (formGroup.value === 'Vận tải mủ') {
    formVehicleType.value = 'LatexTruck';
  } else if (formGroup.value === 'Cơ giới nông trường') {
    formVehicleType.value = 'MillingMachine';
  } else {
    formVehicleType.value = 'PassengerCar';
  }

  applyVehicleTypeDefaults(formVehicleType.value);
}

function saveCategory() {
  if (!formCode.value.trim() || !formName.value.trim()) {
    dialog.showWarning('Vui lòng nhập đầy đủ Mã loại xe và Tên loại xe!', 'Thiếu Thông Tin Bắt Buộc', 'Kiểm tra lại');
    return;
  }

  const payload: Omit<VehicleCategory, 'id'> = {
    code: formCode.value.trim().toUpperCase(),
    name: formName.value.trim(),
    group: formGroup.value,
    vehicleTypeCode: formVehicleType.value,
    standardCapacityTons: formCapacityTons.value,
    standardSeats: formSeats.value,
    fuelQuotaType: formFuelQuotaType.value,
    defaultQuotaEmpty: Number(formDefaultQuotaEmpty.value) || 0,
    defaultQuotaLoaded: formDefaultQuotaLoaded.value ? Number(formDefaultQuotaLoaded.value) : undefined,
    fuelFormulaText: formFuelFormulaText.value.trim() || undefined,
    description: formDescription.value.trim(),
    isActive: formIsActive.value,
  };

  const isEdit = !!editingCategory.value;
  if (editingCategory.value) {
    fleetStore.updateVehicleCategory({
      ...payload,
      id: editingCategory.value.id,
    });
  } else {
    fleetStore.addVehicleCategory(payload);
  }

  showModal.value = false;
  dialog.showSuccess(
    `Loại xe [${payload.name}] đã được ${isEdit ? 'cập nhật' : 'thêm mới'} thành công!`,
    isEdit ? 'Cập Nhật Thành Công' : 'Thêm Loại Xe Mới Thành Công'
  );
}



function deleteCategory(category: VehicleCategory) {
  const count = countVehiclesForCategory(category);
  const msg = count > 0
    ? `Loại xe [${category.name}] hiện đang có ${count} phương tiện trong đội xe. Bạn có chắc chắn muốn xóa khỏi danh mục?`
    : `Bạn có chắc chắn muốn xóa loại xe [${category.name}] khỏi hệ thống?`;

  dialog.showConfirm({
    title: 'Xác Nhận Xóa Loại Xe',
    message: msg,
    confirmText: 'Xác Nhận Xóa',
    onConfirm: () => {
      fleetStore.deleteVehicleCategory(category.id);
      dialog.showSuccess(`Đã xóa loại xe [${category.name}] khỏi hệ thống thành công!`, 'Xóa Thành Công');
    },
  });
}
</script>

<template>
  <div class="vehicle-types-page">
    <!-- Header phân hệ -->
    <div class="page-header">
      <div>
        <div class="header-badge-row">
          <span class="badge-module">Phân Hệ Đội Xe & Cơ Giới</span>
          <span class="badge-count">{{ totalCategories }} Loại xe</span>
        </div>
        <h1 class="page-title">Danh Sách Loại Xe</h1>
        <p class="page-subtitle">
          Danh mục chuẩn hóa các loại phương tiện chở mủ nước, mủ đông, xe bán tải kỹ thuật và máy cơ giới nông trường kèm định mức tiêu chuẩn
        </p>
      </div>

      <button class="btn btn-primary" @click="openAddModal">
        <Plus :size="16" />
        <span>Thêm Loại Xe Mới</span>
      </button>
    </div>

    <!-- Khung Danh Sách & Bộ Lọc -->
    <div class="card content-card">
      <div class="card-header-bar">
        <div class="search-box">
          <Search :size="16" class="search-icon" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Tìm theo mã loại, tên xe hoặc mô tả nhiệm vụ..."
            class="search-input"
          />
        </div>

        <div class="filter-actions">
          <div class="filter-item">
            <span class="filter-label">Nhóm:</span>
            <select v-model="selectedGroup" class="filter-select">
              <option value="ALL">Tất cả nhóm</option>
              <option value="Vận tải mủ">Vận tải mủ cao su</option>
              <option value="Cơ giới nông trường">Cơ giới nông trường</option>
              <option value="Công tác & Kỹ thuật">Công tác & Kỹ thuật</option>
            </select>
          </div>

          <div class="filter-item">
            <span class="filter-label">Trạng thái:</span>
            <select v-model="selectedStatus" class="filter-select">
              <option value="ALL">Tất cả</option>
              <option value="ACTIVE">Đang áp dụng</option>
              <option value="INACTIVE">Tạm dừng</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Bảng danh sách loại xe -->
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Mã Loại</th>
              <th>Tên Loại Phương Tiện</th>
              <th>Nhóm Phân Loại</th>
              <th>Xe Trực Thuộc</th>
              <th>Trạng Thái</th>
              <th>Mô Tả</th>
              <th class="text-right">Hành Động</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="filteredCategories.length === 0">
              <td colspan="7" class="text-center py-5 text-muted">
                Không tìm thấy loại xe nào phù hợp với bộ lọc tìm kiếm.
              </td>
            </tr>

            <tr v-for="cat in filteredCategories" :key="cat.id" :class="{ 'row-inactive': !cat.isActive }">
              <td>
                <span class="code-badge">{{ cat.code }}</span>
              </td>
              <td class="cat-name-cell">
                <strong class="cat-name">{{ cat.name }}</strong>
              </td>
              <td>
                <span
                  class="group-tag"
                  :class="{
                    'group-latex': cat.group === 'Vận tải mủ',
                    'group-machine': cat.group === 'Cơ giới nông trường',
                    'group-work': cat.group === 'Công tác & Kỹ thuật',
                  }"
                >
                  {{ cat.group }}
                </span>
              </td>
              <td>
                <span
                  class="fleet-count-badge"
                  :class="countVehiclesForCategory(cat) > 0 ? 'has-vehicles' : 'no-vehicles'"
                >
                  <strong>{{ countVehiclesForCategory(cat) }}</strong> phương tiện
                </span>
              </td>
              <td>
                <span class="status-indicator-tag" :class="cat.isActive ? 'status-active' : 'status-inactive'">
                  <span class="dot"></span>
                  <span>{{ cat.isActive ? 'Đang áp dụng' : 'Tạm dừng' }}</span>
                </span>
              </td>
              <td class="cat-desc-cell">
                <span class="cat-desc-text">{{ cat.description }}</span>
              </td>
              <td class="text-right">
                <div class="actions-group">
                  <button class="btn-action btn-edit" @click="openEditModal(cat)" title="Chỉnh sửa loại xe">
                    <Edit2 :size="14" />
                  </button>
                  <button class="btn-action btn-delete" @click="deleteCategory(cat)" title="Xóa loại xe">
                    <Trash2 :size="14" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal Thêm / Chỉnh Sửa Loại Xe -->
    <div v-if="showModal" class="modal-backdrop" @click.self="showModal = false">
      <div class="modal-card">
        <div class="modal-header">
          <div class="modal-title-box">
            <Truck :size="18" class="text-success" />
            <h3>{{ editingCategory ? 'Chỉnh Sửa Loại Xe' : 'Thêm Mới Loại Xe & Thiết Bị' }}</h3>
          </div>
          <button class="btn-close" @click="showModal = false">✕</button>
        </div>

        <div class="modal-body">
          <div class="form-grid-2">
            <div class="form-item">
              <label class="form-label">Mã Loại Xe <span class="required">*</span></label>
              <input
                v-model="formCode"
                type="text"
                placeholder="Ví dụ: TRUCK_LATEX, TANKER_LATEX..."
                class="form-input"
                style="text-transform: uppercase"
              />
            </div>

            <div class="form-item">
              <label class="form-label">Nhóm Phương Tiện <span class="required">*</span></label>
              <select v-model="formGroup" class="form-select" @change="onGroupChange">
                <option value="Vận tải mủ">Vận tải mủ cao su</option>
                <option value="Cơ giới nông trường">Cơ giới nông trường</option>
                <option value="Công tác & Kỹ thuật">Công tác & Kỹ thuật</option>
              </select>
            </div>
          </div>

          <div class="form-item">
            <label class="form-label">Tên Loại Phương Tiện <span class="required">*</span></label>
            <input
              v-model="formName"
              type="text"
              placeholder="Ví dụ: Xe tải chở mủ cao su 5 tấn..."
              class="form-input"
            />
          </div>


          <div class="form-item">
            <label class="form-label">Mô Tả Nhiệm Vụ & Phạm Vi Áp Dụng</label>
            <textarea
              v-model="formDescription"
              rows="3"
              class="form-textarea"
              placeholder="Mô tả phạm vi hoạt động của loại xe, phục vụ chuyên chở mủ hay công tác nông trường..."
            ></textarea>
          </div>

          <div class="form-item">
            <label class="form-label">Công Thức Hao Phí / Tiêu Hao</label>
            <div class="formula-action-row">
              <button type="button" class="btn btn-secondary btn-small" @click="openFormulaEditor">
                Sửa công thức
              </button>
            </div>
            <div v-if="formFuelFormulaText" class="formula-preview-box">
              {{ formFuelFormulaText }}
            </div>
            <div v-else class="formula-preview-box empty">
              Chưa có công thức
            </div>
          </div>

          <div class="form-switch-row">
            <label class="switch-label">
              <input v-model="formIsActive" type="checkbox" class="switch-input" />
              <span class="switch-slider"></span>
            </label>
            <span class="switch-text">
              <strong>Kích hoạt loại xe này</strong> (Cho phép chọn loại xe này khi khai báo phương tiện mới)
            </span>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn btn-secondary" @click="showModal = false">Hủy</button>
          <button class="btn btn-primary" @click="saveCategory">
            <span>{{ editingCategory ? 'Lưu Thay Đổi' : 'Thêm Loại Xe' }}</span>
          </button>
        </div>
      </div>
    </div>

    <div v-if="showFormulaModal" class="modal-backdrop" @click.self="showFormulaModal = false">
      <div class="modal-card formula-modal-card">
        <div class="modal-header">
          <div class="modal-title-box">
            <Truck :size="18" class="text-success" />
            <h3>Sửa Công Thức Hao Phí / Tiêu Hao</h3>
          </div>
          <button class="btn-close" @click="showFormulaModal = false">✕</button>
        </div>

        <div class="modal-body">
          <FormulaBuilder
            v-model="formulaEditorDraft"
            label="Công Thức Hao Phí / Tiêu Hao"
            placeholder="Ví dụ: StandardDistanceKm × ElectricNormPerKm"
          />
        </div>

        <div class="modal-footer">
          <button class="btn btn-secondary" @click="showFormulaModal = false">Hủy</button>
          <button class="btn btn-primary" @click="saveFormulaFromModal">Lưu Công Thức</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.vehicle-types-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.header-badge-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.badge-module {
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #15803d;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  padding: 2px 8px;
  border-radius: 4px;
}

.badge-count {
  font-size: 0.6875rem;
  font-weight: 600;
  color: #475569;
  background: #f1f5f9;
  padding: 2px 8px;
  border-radius: 4px;
}

.page-title {
  font-size: 1.4rem;
  font-weight: 800;
  color: var(--text-main);
  margin-bottom: 4px;
}

.page-subtitle {
  font-size: 0.8125rem;
  color: var(--text-muted);
}


/* Content Card */
.content-card {
  background: #ffffff;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-card);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}

.card-header-bar {
  padding: 16px 20px;
  background: #f8fafc;
  border-bottom: 1px solid var(--border-subtle);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.search-box {
  position: relative;
  flex: 1;
  min-width: 280px;
}

.search-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: #94a3b8;
}

.search-input {
  width: 100%;
  padding: 8px 14px 8px 36px;
  border-radius: var(--radius-sm);
  border: 1px solid #cbd5e1;
  background: #ffffff;
  font-size: 0.8125rem;
  color: var(--text-main);
  outline: none;
  font-family: inherit;
  transition: all 0.15s;
}
.search-input:focus {
  border-color: #15803d;
  box-shadow: 0 0 0 2px rgba(21, 128, 61, 0.15);
}

.filter-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.filter-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.filter-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.filter-select {
  padding: 6px 10px;
  border-radius: var(--radius-sm);
  border: 1px solid #cbd5e1;
  background: #ffffff;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-main);
  cursor: pointer;
  outline: none;
}

/* Data Table */
.table-responsive {
  width: 100%;
  overflow-x: auto;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  font-size: 0.8125rem;
}

.data-table th {
  padding: 12px 16px;
  background: #f8fafc;
  color: #475569;
  font-weight: 700;
  font-size: 0.75rem;
  letter-spacing: 0.02em;
  border-bottom: 1px solid var(--border-subtle);
  white-space: nowrap;
}

.data-table td {
  padding: 14px 16px;
  border-bottom: 1px solid var(--border-subtle);
  vertical-align: middle;
}

.data-table td:not(.cat-desc-cell) {
  white-space: nowrap;
}

.data-table tr:hover {
  background: #fafcf9;
}

.data-table tr.row-inactive {
  opacity: 0.6;
  background: #f8fafc;
}

.code-badge {
  display: inline-block;
  font-family: monospace;
  font-size: 0.75rem;
  font-weight: 700;
  background: #f1f5f9;
  color: #0f172a;
  border: 1px solid #cbd5e1;
  padding: 2px 8px;
  border-radius: 4px;
}

.cat-name-cell {
  white-space: nowrap;
}

.cat-name {
  font-size: 0.875rem;
  font-weight: 700;
  color: #0f172a;
}

.cat-desc-cell {
  min-width: 220px;
  max-width: 360px;
  white-space: normal !important;
}

.cat-desc-text {
  font-size: 0.75rem;
  color: #475569;
  line-height: 1.45;
  display: block;
}

.group-tag {
  display: inline-block;
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 0.6875rem;
  font-weight: 700;
  white-space: nowrap;
}
.group-latex { background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0; }
.group-machine { background: #fefce8; color: #854d0e; border: 1px solid #fef08a; }
.group-work { background: #f0f9ff; color: #075985; border: 1px solid #bae6fd; }


.fleet-count-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 0.75rem;
  white-space: nowrap;
}
.fleet-count-badge.has-vehicles {
  background: #f0fdf4;
  color: #15803d;
  font-weight: 600;
  border: 1px solid #bbf7d0;
}
.fleet-count-badge.no-vehicles {
  background: #f8fafc;
  color: #94a3b8;
  border: 1px solid #e2e8f0;
}

.status-indicator-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
  white-space: nowrap;
}
.status-indicator-tag .dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}
.status-active { background: #f0fdf4; color: #166534; }
.status-active .dot { background: #16a34a; }
.status-inactive { background: #f1f5f9; color: #64748b; }
.status-inactive .dot { background: #94a3b8; }

.actions-group {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.btn-action {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: 1px solid #cbd5e1;
  background: #ffffff;
  color: #475569;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s;
}
.btn-action:hover {
  background: #f8fafc;
  color: #0f172a;
}
.btn-edit:hover { border-color: #0284c7; color: #0284c7; }
.btn-delete:hover { border-color: #dc2626; color: #dc2626; }

/* Modal Styles */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(4px);
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.modal-card {
  width: 100%;
  max-width: 640px;
  background: #ffffff;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-modal);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  max-height: 90vh;
}

.formula-modal-card {
  max-width: 900px;
  max-height: 90vh;
}

.formula-modal-card .modal-body {
  max-height: calc(90vh - 132px);
}

.modal-header {
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-subtle);
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #f8fafc;
}

.modal-title-box {
  display: flex;
  align-items: center;
  gap: 8px;
}
.modal-title-box h3 {
  font-size: 1rem;
  font-weight: 700;
  margin: 0;
}

.btn-close {
  background: transparent;
  border: none;
  font-size: 1.1rem;
  color: #94a3b8;
  cursor: pointer;
  padding: 4px;
}
.btn-close:hover { color: #0f172a; }

.modal-body {
  padding: 20px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
  flex: 1 1 auto;
  min-height: 0;
}


.form-grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.form-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.form-label {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--text-secondary);
}

.required {
  color: #dc2626;
}

.form-input, .form-select, .form-textarea {
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid #cbd5e1;
  font-size: 0.8125rem;
  color: var(--text-main);
  outline: none;
  font-family: inherit;
  transition: all 0.15s;
}

.form-input:focus, .form-select:focus, .form-textarea:focus {
  border-color: #15803d;
  box-shadow: 0 0 0 2px rgba(21, 128, 61, 0.15);
}

.hint-text {
  font-weight: 400;
  color: var(--text-muted);
  font-size: 0.6875rem;
}

.form-switch-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
}

.switch-label {
  position: relative;
  display: inline-block;
  width: 38px;
  height: 20px;
  flex-shrink: 0;
}

.switch-input {
  opacity: 0;
  width: 0;
  height: 0;
}

.switch-slider {
  position: absolute;
  cursor: pointer;
  inset: 0;
  background-color: #cbd5e1;
  transition: 0.2s;
  border-radius: 999px;
}

.switch-slider:before {
  position: absolute;
  content: "";
  height: 14px;
  width: 14px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: 0.2s;
  border-radius: 50%;
}

.switch-input:checked + .switch-slider {
  background-color: #15803d;
}

.switch-input:checked + .switch-slider:before {
  transform: translateX(18px);
}

.switch-text {
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.modal-footer {
  padding: 14px 20px;
  border-top: 1px solid var(--border-subtle);
  background: #f8fafc;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

@media (max-width: 1024px) {
  .kpi-grid { grid-template-columns: repeat(2, 1fr); }
  .form-grid-2, .form-grid-3 { grid-template-columns: 1fr; }
}

@media (max-width: 640px) {
  .kpi-grid { grid-template-columns: 1fr; }
  .card-header-bar { flex-direction: column; align-items: stretch; }
  .filter-actions { justify-content: space-between; }
}
</style>
