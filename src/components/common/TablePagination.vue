<script setup lang="ts">
import { computed } from 'vue';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-vue-next';

interface Props {
  totalItems: number;
  currentPage: number;
  pageSize?: number;
  pageSizeOptions?: number[];
  showPageSizeSelector?: boolean;
  showSummary?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  pageSize: 10,
  pageSizeOptions: () => [5, 10, 20, 50],
  showPageSizeSelector: true,
  showSummary: true,
});

const emit = defineEmits<{
  (e: 'update:currentPage', page: number): void;
  (e: 'update:pageSize', size: number): void;
  (e: 'pageChange', page: number): void;
}>();

const totalPages = computed(() => {
  return Math.max(1, Math.ceil(props.totalItems / props.pageSize));
});

const startItem = computed(() => {
  if (props.totalItems === 0) return 0;
  return (props.currentPage - 1) * props.pageSize + 1;
});

const endItem = computed(() => {
  return Math.min(props.totalItems, props.currentPage * props.pageSize);
});

function goToPage(page: number) {
  if (page < 1 || page > totalPages.value || page === props.currentPage) return;
  emit('update:currentPage', page);
  emit('pageChange', page);
}

function handlePageSizeChange(event: Event) {
  const target = event.target as HTMLSelectElement;
  const newSize = Number(target.value);
  emit('update:pageSize', newSize);
  emit('update:currentPage', 1);
  emit('pageChange', 1);
}

// Tính danh sách các nút số trang hiển thị (thông minh với dấu ...)
const visiblePages = computed<(number | string)[]>(() => {
  const total = totalPages.value;
  const current = props.currentPage;

  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages: (number | string)[] = [];

  if (current <= 4) {
    pages.push(1, 2, 3, 4, 5, '...', total);
  } else if (current >= total - 3) {
    pages.push(1, '...', total - 4, total - 3, total - 2, total - 1, total);
  } else {
    pages.push(1, '...', current - 1, current, current + 1, '...', total);
  }

  return pages;
});
// Tự động chuẩn hóa các tùy chọn số dòng để luôn bao gồm giá trị pageSize hiện tại
const normalizedPageSizeOptions = computed<number[]>(() => {
  const base = Array.isArray(props.pageSizeOptions) && props.pageSizeOptions.length > 0
    ? [...props.pageSizeOptions]
    : [5, 10, 20, 50];

  const current = Number(props.pageSize);
  if (current > 0 && !base.includes(current)) {
    base.push(current);
    base.sort((a, b) => a - b);
  }
  return base;
});
</script>

<template>
  <div v-if="totalItems > 0" class="table-pagination-container">
    <!-- Tóm tắt số bản ghi -->
    <div v-if="showSummary" class="pagination-summary">
      <span>Hiển thị </span>
      <strong class="text-slate-800">{{ startItem }} - {{ endItem }}</strong>
      <span> trong tổng số </span>
      <strong class="text-primary font-bold">{{ totalItems }}</strong>
      <span> bản ghi</span>
    </div>

    <div class="pagination-right-group">
      <!-- Dropdown chọn số dòng trên trang -->
      <div v-if="showPageSizeSelector" class="page-size-selector">
        <label for="page-size-select" class="page-size-label">Số dòng:</label>
        <select
          id="page-size-select"
          :value="pageSize"
          class="page-size-select"
          @change="handlePageSizeChange"
        >
          <option v-for="opt in normalizedPageSizeOptions" :key="opt" :value="opt">
            {{ opt }} / trang
          </option>
        </select>
      </div>

      <!-- Danh sách nút chuyển trang -->
      <nav class="pagination-nav" aria-label="Phân trang bảng dữ liệu">
        <!-- Nút Về đầu trang -->
        <button
          type="button"
          class="page-btn nav-btn"
          :disabled="currentPage <= 1"
          title="Về trang đầu tiên"
          @click="goToPage(1)"
        >
          <ChevronsLeft :size="14" />
        </button>

        <!-- Nút Trang trước -->
        <button
          type="button"
          class="page-btn nav-btn"
          :disabled="currentPage <= 1"
          title="Trang trước"
          @click="goToPage(currentPage - 1)"
        >
          <ChevronLeft :size="14" />
        </button>

        <!-- Các số trang -->
        <template v-for="(p, idx) in visiblePages" :key="idx">
          <span v-if="p === '...'" class="page-ellipsis">…</span>
          <button
            v-else
            type="button"
            class="page-btn num-btn"
            :class="{ active: p === currentPage }"
            @click="goToPage(Number(p))"
          >
            {{ p }}
          </button>
        </template>

        <!-- Nút Trang sau -->
        <button
          type="button"
          class="page-btn nav-btn"
          :disabled="currentPage >= totalPages"
          title="Trang sau"
          @click="goToPage(currentPage + 1)"
        >
          <ChevronRight :size="14" />
        </button>

        <!-- Nút Đến trang cuối -->
        <button
          type="button"
          class="page-btn nav-btn"
          :disabled="currentPage >= totalPages"
          title="Đến trang cuối cùng"
          @click="goToPage(totalPages)"
        >
          <ChevronsRight :size="14" />
        </button>
      </nav>
    </div>
  </div>
</template>

<style scoped>
.table-pagination-container {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  padding: 12px 16px;
  background: #ffffff;
  border-top: 1px solid #e2e8f0;
  border-bottom-left-radius: inherit;
  border-bottom-right-radius: inherit;
  font-size: 0.8125rem;
}

.pagination-summary {
  color: #64748b;
  font-size: 0.78125rem;
}

.pagination-right-group {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.page-size-selector {
  display: flex;
  align-items: center;
  gap: 6px;
}

.page-size-label {
  color: #64748b;
  font-size: 0.75rem;
  margin-bottom: 0;
  white-space: nowrap;
}

.page-size-select {
  padding: 3px 8px;
  font-size: 0.78125rem;
  font-weight: 600;
  color: #1e293b;
  background: #f8fafc;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  cursor: pointer;
  outline: none;
  transition: all 0.15s ease;
}

.page-size-select:hover {
  border-color: #94a3b8;
  background: #ffffff;
}

.page-size-select:focus {
  border-color: #16a34a;
  box-shadow: 0 0 0 2px rgba(22, 163, 74, 0.15);
}

.pagination-nav {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.page-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 30px;
  height: 30px;
  padding: 0 6px;
  border-radius: 6px;
  border: 1px solid #e2e8f0;
  background: #ffffff;
  color: #475569;
  font-size: 0.78125rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
  user-select: none;
}

.page-btn:hover:not(:disabled) {
  background: #f1f5f9;
  border-color: #cbd5e1;
  color: #0f172a;
}

.page-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  background: #f8fafc;
}

.page-btn.num-btn.active {
  background: #16a34a;
  border-color: #16a34a;
  color: #ffffff;
  font-weight: 700;
  box-shadow: 0 1px 4px rgba(22, 163, 74, 0.25);
}

.page-ellipsis {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  color: #94a3b8;
  font-size: 0.875rem;
  user-select: none;
}

@media (max-width: 640px) {
  .table-pagination-container {
    flex-direction: column;
    align-items: flex-start;
  }
  .pagination-right-group {
    width: 100%;
    justify-content: space-between;
  }
}
</style>
