<script setup lang="ts">
import { ref, computed } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { useBookingStore } from '@/stores/booking';
import { useDialogStore } from '@/stores/dialog';
import type { TransportRequest } from '@/types';
import StatusBadge from '@/components/common/StatusBadge.vue';
import { CheckSquare, Check, X, AlertCircle } from 'lucide-vue-next';

const authStore = useAuthStore();
const bookingStore = useBookingStore();
const dialog = useDialogStore();

const tab = ref<'pending' | 'history'>('pending');

// Modal từ chối
const showRejectModal = ref(false);
const rejectingRequest = ref<TransportRequest | null>(null);
const rejectReason = ref('');
const rejectError = ref('');

// Danh sách yêu cầu thuộc phòng ban của Approver
const departmentRequests = computed(() => {
  const deptId = authStore.currentUser.departmentId;
  // Nếu là Admin thì có thể xem duyệt của tất cả phòng ban
  if (authStore.activeRole === 'Admin') {
    return bookingStore.requests;
  }
  return bookingStore.getDepartmentRequests(deptId);
});

const pendingList = computed(() =>
  departmentRequests.value.filter((r) => r.status === 'PENDING')
);

const historyList = computed(() =>
  departmentRequests.value.filter((r) => r.status === 'APPROVED' || r.status === 'REJECTED')
);

function handleApprove(req: TransportRequest) {
  const res = bookingStore.approveRequest(
    req.id,
    authStore.currentUser.id,
    authStore.currentUser.fullName,
    'Đã duyệt bởi cấp quản lý phòng ban'
  );
  if (!res.success) {
    dialog.showWarning(res.message || 'Không thể phê duyệt yêu cầu đặt xe!', 'Phê Duyệt Thất Bại', 'Thực hiện lại');
  } else {
    dialog.showSuccess(`Đã phê duyệt yêu cầu đặt xe ${req.requestCode} thành công!`, 'Phê Duyệt Thành Công');
  }
}

function openReject(req: TransportRequest) {
  rejectingRequest.value = req;
  rejectReason.value = '';
  rejectError.value = '';
  showRejectModal.value = true;
}

function confirmReject() {
  if (!rejectingRequest.value) return;
  if (!rejectReason.value.trim()) {
    rejectError.value = 'Bắt buộc nhập lý do từ chối yêu cầu!';
    dialog.showWarning('Bắt buộc nhập lý do từ chối yêu cầu!', 'Thiếu Lý Do Từ Chối', 'Kiểm tra lại');
    return;
  }

  const reqCode = rejectingRequest.value.requestCode;
  const res = bookingStore.rejectRequest(
    rejectingRequest.value.id,
    authStore.currentUser.id,
    authStore.currentUser.fullName,
    rejectReason.value
  );

  if (!res.success) {
    rejectError.value = res.message;
    dialog.showWarning(res.message || 'Không thể từ chối yêu cầu!', 'Từ Chối Thất Bại', 'Thực hiện lại');
  } else {
    showRejectModal.value = false;
    rejectingRequest.value = null;
    dialog.showSuccess(`Đã từ chối yêu cầu đặt xe ${reqCode}!`, 'Từ Chối Thành Công');
  }
}
</script>

<template>
  <div class="approval-page">
    <div class="page-header">
      <div>
        <h1 class="page-title">Phê Duyệt Yêu Cầu Đặt Xe</h1>
        <p class="page-subtitle">
          Cấp quản lý xem xét và phê duyệt các yêu cầu sử dụng xe thuộc phạm vi phòng ban:
          <strong>{{ authStore.currentUser.departmentName }}</strong>
        </p>
      </div>

      <div class="tab-selector">
        <button
          class="tab-btn"
          :class="{ active: tab === 'pending' }"
          @click="tab = 'pending'"
        >
          <CheckSquare :size="16" />
          <span>Chờ phê duyệt</span>
          <span v-if="pendingList.length > 0" class="badge-count">{{ pendingList.length }}</span>
        </button>
        <button
          class="tab-btn"
          :class="{ active: tab === 'history' }"
          @click="tab = 'history'"
        >
          <span>Lịch sử duyệt</span>
        </button>
      </div>
    </div>

    <!-- Danh sách chờ duyệt -->
    <div v-if="tab === 'pending'" class="card">
      <div class="card-header">
        <h3 class="card-title">Danh Sách Yêu Cầu Đang Chờ Xử Lý</h3>
      </div>

      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th>Mã YC</th>
              <th>Người Đặt</th>
              <th>Phương Tiện</th>
              <th>Thời Gian</th>
              <th>Lộ Trình</th>
              <th>Mục Đích</th>
              <th>Khối Lượng / Khách</th>
              <th>Thao Tác Quyết Định</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="pendingList.length === 0">
              <td colspan="8" class="text-center py-5 text-muted">
                Tuyệt vời! Hiện không còn yêu cầu nào đang chờ phê duyệt.
              </td>
            </tr>

            <tr v-for="req in pendingList" :key="req.id">
              <td><strong>{{ req.requestCode }}</strong></td>
              <td>
                <div class="flex-col">
                  <span>{{ req.requesterName }}</span>
                  <span class="text-xs text-muted">{{ req.requesterPhone }}</span>
                </div>
              </td>
              <td><span class="type-tag">{{ req.vehicleType }}</span></td>
              <td>
                <div class="flex-col">
                  <span>{{ req.startTime }}</span>
                  <span class="text-xs text-muted">đến {{ req.endTime.slice(11) }}</span>
                </div>
              </td>
              <td>{{ req.fromLocation }} ➔ {{ req.toLocation }}</td>
              <td class="max-w-purpose">{{ req.purpose }}</td>
              <td>
                <strong v-if="req.estimatedWeightKg" class="text-success">
                  {{ req.estimatedWeightKg.toLocaleString() }} kg mủ
                </strong>
                <strong v-else-if="req.passengersCount" class="text-info">
                  {{ req.passengersCount }} người
                </strong>
                <span v-else class="text-muted">—</span>
              </td>
              <td>
                <div class="action-buttons">
                  <button class="btn btn-success btn-sm" @click="handleApprove(req)">
                    <Check :size="14" />
                    <span>Duyệt</span>
                  </button>
                  <button class="btn btn-outline-danger btn-sm" @click="openReject(req)">
                    <X :size="14" />
                    <span>Từ chối</span>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Lịch sử duyệt -->
    <div v-else class="card">
      <div class="card-header">
        <h3 class="card-title">Lịch Sử Phê Duyệt Của Phòng Ban</h3>
      </div>

      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th>Mã YC</th>
              <th>Người Đặt</th>
              <th>Loại Xe</th>
              <th>Thời Gian Chuyến</th>
              <th>Trạng Thái</th>
              <th>Người Xử Lý</th>
              <th>Lý Do / Ghi Chú</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="historyList.length === 0">
              <td colspan="7" class="text-center py-5 text-muted">
                Chưa có lịch sử phê duyệt nào.
              </td>
            </tr>

            <tr v-for="req in historyList" :key="req.id">
              <td><strong>{{ req.requestCode }}</strong></td>
              <td>{{ req.requesterName }}</td>
              <td>{{ req.vehicleType }}</td>
              <td>{{ req.startTime }}</td>
              <td><StatusBadge :status="req.status" /></td>
              <td>{{ req.approvedByName || '—' }}</td>
              <td>
                <span v-if="req.status === 'REJECTED'" class="text-danger font-bold">
                  {{ req.rejectionReason }}
                </span>
                <span v-else class="text-muted">Đã duyệt theo kế hoạch</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal Từ Chối (US-04: Bắt buộc RejectReason) -->
    <div v-if="showRejectModal && rejectingRequest" class="modal-backdrop" @click.self="showRejectModal = false">
      <div class="modal-content">
        <div class="modal-header">
          <h3 class="modal-title text-danger">
            <X :size="20" />
            <span>Từ Chối Yêu Cầu {{ rejectingRequest.requestCode }}</span>
          </h3>
        </div>

        <div class="modal-body">
          <div v-if="rejectError" class="alert alert-danger">
            <AlertCircle :size="16" />
            <span>{{ rejectError }}</span>
          </div>

          <p class="text-secondary text-sm mb-3">
            Người yêu cầu: <strong>{{ rejectingRequest.requesterName }}</strong><br />
            Mục đích: {{ rejectingRequest.purpose }}
          </p>

          <div class="form-group">
            <label class="form-label">Lý do từ chối <span class="required">*</span></label>
            <textarea
              v-model="rejectReason"
              rows="3"
              class="form-textarea"
              placeholder="Nhập cụ thể lý do từ chối để thông báo cho nhân viên..."
            ></textarea>
            <span class="form-hint">Lý do từ chối không được để trống.</span>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn btn-secondary" @click="showRejectModal = false">Hủy</button>
          <button class="btn btn-danger" @click="confirmReject">Xác Nhận Từ Chối</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 12px;
}
.page-title {
  font-size: 1.375rem;
  font-weight: 800;
}
.page-subtitle {
  font-size: 0.8125rem;
  color: var(--text-secondary);
}
.tab-selector {
  display: flex;
  background: #e2e8f0;
  padding: 3px;
  border-radius: var(--radius-md);
}
.tab-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  border: none;
  background: transparent;
  padding: 8px 16px;
  font-size: 0.8125rem;
  font-weight: 600;
  border-radius: 6px;
  cursor: pointer;
  color: var(--text-secondary);
  transition: all 0.2s;
}
.tab-btn.active {
  background: white;
  color: var(--text-primary);
  box-shadow: var(--shadow-sm);
}
.badge-count {
  background: var(--warning);
  color: white;
  padding: 2px 6px;
  border-radius: 10px;
  font-size: 0.6875rem;
}
.action-buttons {
  display: flex;
  gap: 6px;
}
.flex-col { display: flex; flex-direction: column; }
.text-xs { font-size: 0.75rem; }
.text-muted { color: var(--text-muted); }
.text-success { color: #16a34a; }
.text-info { color: #0284c7; }
.text-danger { color: #dc2626; }
.font-bold { font-weight: 700; }
.max-w-purpose { max-width: 250px; font-size: 0.8125rem; }
.py-5 { padding-top: 40px; padding-bottom: 40px; }
.text-center { text-align: center; }
.mb-3 { margin-bottom: 12px; }
.alert { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-radius: var(--radius-sm); margin-bottom: 12px; }
.alert-danger { background: #fee2e2; border: 1px solid #fecaca; color: #b91c1c; }
</style>
