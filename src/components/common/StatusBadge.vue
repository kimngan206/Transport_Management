<script setup lang="ts">
import { computed } from 'vue';
import type { RequestStatus, TripStatus, MaintenanceStatus } from '@/types';

const props = defineProps<{
  status: RequestStatus | TripStatus | MaintenanceStatus | string;
  type?: 'request' | 'trip' | 'maintenance';
}>();

const labelMap: Record<string, string> = {
  // Request Status
  PENDING: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Từ chối',
  DISPATCHED: 'Đã điều phối',
  INPROGRESS: 'Đang chạy',
  COMPLETED: 'Hoàn thành',
  CANCELLED: 'Đã hủy',

  // Trip Status
  ASSIGNED: 'Đã phân công',

  // Maintenance Status
  Normal: 'Bình thường',
  Due: 'Đến hạn (≥5k km)',
  Overdue: 'Quá hạn bảo dưỡng',
};

const badgeClass = computed(() => {
  const s = props.status.toLowerCase();
  switch (s) {
    case 'pending':
      return 'badge-pending';
    case 'approved':
      return 'badge-approved';
    case 'dispatched':
    case 'assigned':
      return 'badge-dispatched';
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
