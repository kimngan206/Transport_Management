<script setup lang="ts">
import { computed } from 'vue';
import type { RequestStatus, TripStatus, MaintenanceStatus } from '@/types';

const props = defineProps<{
  status: RequestStatus | TripStatus | MaintenanceStatus | string;
  type?: 'request' | 'trip' | 'maintenance';
}>();

const labelMap: Record<string, string> = {
  // Request Status
  PENDING: 'Chờ ghép chuyến',
  APPROVED: 'Chờ ghép chuyến',
  REJECTED: 'Từ chối',
  DISPATCHED: 'Đã điều phối',
  INPROGRESS: 'Đang vận chuyển',
  COMPLETED: 'Hoàn Thành',
  CANCELLED: 'Đã hủy',

  // Trip Status
  ASSIGNED: 'Đã phân công',
  ACCEPTED: 'Đã nhận chuyến',
  ARRIVED: 'Đã đến nơi',

  // Maintenance Status
  Normal: 'Bình thường',
  Due: 'Đến hạn (≥5k km)',
  Overdue: 'Quá hạn bảo dưỡng',
  UnderMaintenance: 'Đang bảo dưỡng',
};

const badgeClass = computed(() => {
  const s = props.status.toLowerCase();
  switch (s) {
    case 'pending':
    case 'approved':
      return 'badge-pending';
    case 'dispatched':
    case 'assigned':
      return 'badge-dispatched';
    case 'accepted':
      return 'badge-accepted';
    case 'arrived':
      return 'badge-arrived';
    case 'inprogress':
      return 'badge-inprogress';
    case 'completed':
      return 'badge-completed';
    case 'rejected':
      return 'badge-rejected';
    case 'cancelled':
      return 'badge-cancelled';
    case 'normal':
      return 'badge-normal';
    case 'due':
    case 'overdue':
      return 'badge-due';
    case 'undermaintenance':
      return 'badge-undermaintenance';
    default:
      return 'badge-cancelled';
  }
});

const displayLabel = computed(() => {
  return labelMap[props.status] || props.status;
});
</script>

<template>
  <span class="badge" :class="badgeClass">
    <span class="badge-dot"></span>
    <span>{{ displayLabel }}</span>
  </span>
</template>
