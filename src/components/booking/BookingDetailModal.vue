<script setup lang="ts">
import { ref, computed } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { useBookingStore } from '@/stores/booking';
import { useFleetStore } from '@/stores/fleet';
import { useDispatchStore } from '@/stores/dispatch';
import { useDialogStore } from '@/stores/dialog';
import type { TransportRequest } from '@/types';
import { suggestOptimalRoute } from '@/utils/routeMatcher';
import StatusBadge from '@/components/common/StatusBadge.vue';
import {
  X,
  Calendar,
  MapPin,
  Package,
  User,
  FileText,
  Ban,
  Navigation,
  Sparkles,
  Truck,
} from 'lucide-vue-next';

const props = defineProps<{
  request: TransportRequest;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'updated'): void;
}>();

const authStore = useAuthStore();
const bookingStore = useBookingStore();
const fleetStore = useFleetStore();
const dispatchStore = useDispatchStore();
const dialog = useDialogStore();
const cancelReason = ref('');
const showCancelPrompt = ref(false);

// Tuyến đường quy chuẩn (đã được điều phối phân công hoặc tự động gợi ý từ điểm đi)
const standardRoute = computed(() => {
  if (props.request.standardRouteId) {
    return fleetStore.routes.find((r) => r.id === props.request.standardRouteId);
  }
  // Gợi ý tự động từ điểm đi và điểm đến
  const match = suggestOptimalRoute(fleetStore.routes, props.request.fromLocation, props.request.toLocation);
  return match.route;
});

// Chuyến xe đã phân công nếu có
const assignedTrip = computed(() => {
  if (!props.request.assignedTripId) return null;
  return dispatchStore.trips.find((t) => t.id === props.request.assignedTripId);
});

function handleCancel() {
  if (!cancelReason.value.trim()) {
    dialog.showWarning('Vui lòng nhập lý do hủy yêu cầu đặt xe!', 'Thiếu Lý Do Hủy', 'Kiểm tra lại');
    return;
  }
  const res = bookingStore.cancelRequest(
    props.request.id,
    authStore.currentUser.fullName,
    cancelReason.value
  );
  if (res.success) {
    emit('updated');
    emit('close');
    dialog.showSuccess(`Yêu cầu đặt xe ${props.request.requestCode} đã được hủy thành công.`, 'Hủy Yêu Cầu Thành Công');
  } else {
    dialog.showWarning(res.message || 'Không thể hủy yêu cầu!', 'Không Thể Hủy Yêu Cầu', 'Thực hiện lại');
  }
}
</script>

<template>
  <div class="modal-backdrop" @click.self="emit('close')">
    <div class="modal-content">
      <div class="modal-header">
        <div class="header-left">
          <h3 class="modal-title">Chi tiết Yêu cầu {{ request.requestCode }}</h3>
          <StatusBadge :status="request.status" />
        </div>
        <button class="btn-close" @click="emit('close')">
          <X :size="18" />
        </button>
      </div>

      <div class="modal-body">
        <!-- Thông tin cơ bản -->
        <div class="detail-grid">
          <div class="detail-item">
            <span class="detail-label"><User :size="14" /> Người yêu cầu</span>
            <span class="detail-val">
              {{ request.requesterName }} ({{ request.departmentName }})
              <span v-if="request.teamName" class="badge-team-tag">
                {{ request.teamName }}
              </span>
            </span>
          </div>

          <div class="detail-item">
            <span class="detail-label"><Calendar :size="14" /> Thời gian</span>
            <span class="detail-val">{{ request.startTime }} ➔ {{ request.endTime.slice(11) }}</span>
          </div>

          <div class="detail-item">
            <span class="detail-label"><MapPin :size="14" /> Lộ trình</span>
            <span class="detail-val">{{ request.fromLocation }} ➔ {{ request.toLocation }}</span>
          </div>

          <div class="detail-item">
            <span class="detail-label"><Package :size="14" /> Phương tiện / Tải trọng</span>
            <span class="detail-val">
              {{
                request.vehicleType === 'LatexTruck'
                  ? 'Xe chuyên dùng chở mủ cao su'
                  : request.vehicleType === 'PassengerCar'
                  ? 'Xe bán tải công tác / đưa đón'
                  : 'Xe cơ giới nông trường'
              }}
              <strong v-if="request.estimatedWeightKg"> ({{ request.estimatedWeightKg.toLocaleString() }} kg mủ)</strong>
              <strong v-if="request.operatingHours"> ({{ request.operatingHours }} giờ máy)</strong>
              <strong v-if="request.passengersCount"> ({{ request.passengersCount }} người)</strong>
            </span>
          </div>
          
          <div v-if="request.vehicleType === 'PassengerCar'" class="detail-item full-width mt-1 p-2 bg-light rounded border">
            <strong>Thông tin công tác:</strong>
            <div class="text-sm mt-1">
              <div>- Giờ đón trả: <strong>{{ request.pickupTime }} ➔ {{ request.dropoffTime }}</strong></div>
              <div>- Người liên hệ: <strong>{{ request.contactPerson }}</strong> (SĐT: {{ request.contactPhone }})</div>
            </div>
          </div>

          <!-- Lộ trình quy chuẩn trả kết quả cho người đặt xe -->
          <div class="detail-item full-width" v-if="standardRoute">
            <span class="detail-label">
              <Navigation :size="14" class="text-primary" />
              <span>Lộ trình quy chuẩn {{ request.standardRouteId ? 'được phân công' : 'gợi ý từ điểm đi' }}:</span>
              <span v-if="!request.standardRouteId" class="badge-suggest-pill">
                <Sparkles :size="10" /> Gợi ý tự động
              </span>
            </span>
            <div class="route-result-box">
              <div class="route-header-line">
                <span class="route-tag">{{ standardRoute.routeCode }}</span>
                <strong class="route-name">{{ standardRoute.name }}</strong>
                <span class="dist-badge">{{ standardRoute.standardDistanceKm }} km</span>
              </div>
              <div v-if="standardRoute.description" class="route-desc-line">
                {{ standardRoute.description }}
              </div>
            </div>
          </div>

          <!-- Thông tin xe & tài xế đã điều phối (nếu có) -->
          <div class="detail-item full-width" v-if="assignedTrip">
            <span class="detail-label">
              <Truck :size="14" class="text-success" />
              <span>Chuyến xe & Phương tiện điều phối:</span>
            </span>
            <div class="assigned-trip-box">
              <span class="trip-tag">{{ assignedTrip.tripCode }}</span>
              <span>Xe: <strong>{{ assignedTrip.vehiclePlate }}</strong></span>
              <span>•</span>
              <span>Tài xế: <strong>{{ assignedTrip.driverName }}</strong> ({{ assignedTrip.driverPhone }})</span>
            </div>
          </div>
        </div>

        <div class="purpose-box">
          <span class="detail-label"><FileText :size="14" /> Mục đích</span>
          <p class="purpose-text">{{ request.purpose }}</p>
        </div>

        <!-- Lý do từ chối nếu có -->
        <div v-if="request.rejectionReason" class="reject-box">
          <strong>Lý do từ chối:</strong> {{ request.rejectionReason }}
        </div>

        <!-- Tiến trình Timeline -->
        <div class="timeline-section">
          <h4 class="section-title">Tiến trình xử lý (Timeline)</h4>
          <div class="timeline-list">
            <div
              v-for="(step, idx) in request.timeline"
              :key="idx"
              class="timeline-item"
            >
              <div class="timeline-marker">
                <div class="marker-dot"></div>
                <div v-if="idx < request.timeline.length - 1" class="marker-line"></div>
              </div>
              <div class="timeline-content">
                <div class="timeline-meta">
                  <span class="actor-name">{{ step.actor }}</span>
                  <span class="timestamp">{{ step.timestamp }}</span>
                </div>
                <div class="timeline-status">
                  <StatusBadge :status="step.status" />
                </div>
                <div class="timeline-note">{{ step.note }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Khung hủy yêu cầu -->
        <div v-if="showCancelPrompt" class="cancel-form">
          <label class="form-label">Lý do hủy yêu cầu <span class="required">*</span></label>
          <input v-model="cancelReason" type="text" class="form-input" placeholder="Nhập lý do hủy chuyến..." />
          <div class="cancel-actions">
            <button class="btn btn-secondary btn-sm" @click="showCancelPrompt = false">Đóng</button>
            <button class="btn btn-danger btn-sm" @click="handleCancel">Xác nhận hủy</button>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button
          v-if="request.status !== 'INPROGRESS' && request.status !== 'COMPLETED' && request.status !== 'CANCELLED' && !showCancelPrompt"
          class="btn btn-outline-danger"
          @click="showCancelPrompt = true"
        >
          <Ban :size="16" />
          <span>Hủy yêu cầu</span>
        </button>
        <button class="btn btn-secondary" @click="emit('close')">Đóng</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}
.btn-close {
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--text-muted);
}
.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  background: #f8fafc;
  border: 1px solid var(--border);
  padding: 16px;
  border-radius: var(--radius-md);
  margin-bottom: 16px;
}
.detail-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.detail-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-secondary);
}
.detail-val {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary);
}
.full-width {
  grid-column: 1 / -1;
}
.badge-suggest-pill {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  background: #dcfce7;
  color: #15803d;
  font-size: 0.625rem;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 9999px;
  border: 1px solid #86efac;
}
.route-result-box {
  background: white;
  border: 1px solid #cbd5e1;
  border-radius: var(--radius-sm);
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.route-header-line {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.route-tag {
  background: #1e293b;
  color: white;
  font-size: 0.6875rem;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 4px;
}
.route-name {
  font-size: 0.8125rem;
  color: #0f172a;
}
.dist-badge {
  margin-left: auto;
  background: #ecfdf5;
  color: #059669;
  font-size: 0.75rem;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 4px;
  border: 1px solid #a7f3d0;
}
.route-desc-line {
  font-size: 0.7188rem;
  color: var(--text-muted);
  font-style: italic;
}
.assigned-trip-box {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  font-size: 0.8125rem;
  color: #166534;
}
.trip-tag {
  background: #16a34a;
  color: white;
  font-size: 0.6875rem;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 4px;
}
.purpose-box {
  background: white;
  border: 1px solid var(--border);
  padding: 12px 16px;
  border-radius: var(--radius-md);
  margin-bottom: 16px;
}
.purpose-text {
  font-size: 0.875rem;
  color: var(--text-primary);
  margin-top: 4px;
}
.reject-box {
  background: #fee2e2;
  border: 1px solid #fecaca;
  color: #991b1b;
  padding: 10px 14px;
  border-radius: var(--radius-sm);
  font-size: 0.8125rem;
  margin-bottom: 16px;
}
.timeline-section {
  margin-top: 20px;
}
.section-title {
  font-size: 0.9375rem;
  font-weight: 700;
  margin-bottom: 12px;
}
.timeline-list {
  display: flex;
  flex-direction: column;
}
.timeline-item {
  display: flex;
  gap: 14px;
  position: relative;
}
.timeline-marker {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 16px;
}
.marker-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--primary);
  border: 2px solid white;
  box-shadow: 0 0 0 2px var(--primary-light);
  margin-top: 4px;
}
.marker-line {
  flex: 1;
  width: 2px;
  background: var(--border);
  margin-top: 4px;
  min-height: 40px;
}
.timeline-content {
  flex: 1;
  padding-bottom: 20px;
}
.timeline-meta {
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  color: var(--text-muted);
}
.actor-name {
  font-weight: 700;
  color: var(--text-secondary);
}
.timeline-status {
  margin: 4px 0;
}
.timeline-note {
  font-size: 0.8125rem;
  color: var(--text-primary);
}
.cancel-form {
  background: #fff1f2;
  border: 1px solid #fecdd3;
  padding: 14px;
  border-radius: var(--radius-md);
  margin-top: 16px;
}
.cancel-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
}
.badge-team-tag {
  display: inline-flex;
  align-items: center;
  background: #dcfce7;
  color: #166534;
  border: 1px solid #bbf7d0;
  font-size: 0.71875rem;
  font-weight: 600;
  padding: 1px 7px;
  border-radius: 9999px;
  margin-left: 6px;
  vertical-align: middle;
}
</style>
