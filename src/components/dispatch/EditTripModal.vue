<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useFleetStore } from '@/stores/fleet';
import { useDispatchStore } from '@/stores/dispatch';
import { useDialogStore } from '@/stores/dialog';
import type { TransportTrip } from '@/types';
import {
  X,
  Truck,
  UserCheck,
  Navigation,
  Clock,
  Save,
  CheckCircle2,
} from 'lucide-vue-next';

const props = defineProps<{
  trip: TransportTrip;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'updated'): void;
}>();

const fleetStore = useFleetStore();
const dispatchStore = useDispatchStore();
const dialog = useDialogStore();

// Trạng thái form
const vehicleId = ref<number | ''>(props.trip.vehicleId);
const driverId = ref<number | ''>(props.trip.driverId);
const routeId = ref<number | ''>(props.trip.routeId);
const scheduledStartTime = ref(props.trip.scheduledStartTime);
const scheduledEndTime = ref(props.trip.scheduledEndTime);
const notes = ref<string>(props.trip.notes || '');

const errorMsg = ref<string>('');
const isSubmitting = ref(false);

const vehicles = computed(() => fleetStore.vehicles);
const drivers = computed(() => fleetStore.drivers);
const routes = computed(() => fleetStore.routes);

const selectedVehicle = computed(() => {
  return vehicles.value.find((v) => v.id === Number(vehicleId.value));
});

const selectedDriver = computed(() => {
  return drivers.value.find((d) => d.id === Number(driverId.value));
});

// Tự động gán tài xế nếu đổi xe (giống BatchTripModal)
watch(vehicleId, (newId, oldId) => {
  if (newId && newId !== oldId && selectedVehicle.value && selectedVehicle.value.assignedDriverId) {
    driverId.value = selectedVehicle.value.assignedDriverId;
  }
});

function getVehicleStatusLabel(status: string): string {
  switch (status) {
    case 'Available': return 'Sẵn sàng';
    case 'OnTrip': return 'Đang chạy chuyến';
    case 'UnderMaintenance': return 'Đang bảo dưỡng';
    case 'Broken': return 'Sự cố / Hỏng hóc';
    default: return status;
  }
}

function getVehicleTypeLabel(type: string): string {
  switch (type) {
    case 'LatexTruck': return 'Xe tải';
    case 'PassengerCar': return 'Bán tải';
    case 'MillingMachine': return 'Máy đào';
    default: return type;
  }
}

function handleSave() {
  if (!vehicleId.value || !driverId.value || !routeId.value || !scheduledStartTime.value || !scheduledEndTime.value) {
    errorMsg.value = 'Vui lòng điền đầy đủ các thông tin bắt buộc!';
    return;
  }
  
  if (new Date(scheduledStartTime.value) >= new Date(scheduledEndTime.value)) {
    errorMsg.value = 'Thời gian dự kiến kết thúc phải sau thời gian bắt đầu!';
    return;
  }

  isSubmitting.value = true;
  errorMsg.value = '';

  const res = dispatchStore.updateTrip({
    tripId: props.trip.id,
    vehicleId: Number(vehicleId.value),
    driverId: Number(driverId.value),
    routeId: Number(routeId.value),
    scheduledStartTime: scheduledStartTime.value,
    scheduledEndTime: scheduledEndTime.value,
    notes: notes.value,
  });

  isSubmitting.value = false;

  if (res.success) {
    dialog.showSuccess(res.message, 'Cập Nhật Thành Công');
    emit('updated');
  } else {
    errorMsg.value = res.message;
  }
}
</script>

<template>
  <div class="modal-backdrop" @click.self="$emit('close')">
    <div class="modal-content modal-lg">
      <div class="modal-header">
        <div class="modal-header-title">
          <Truck :size="20" class="text-primary" />
          <h3 class="modal-title">Sửa Thông Tin Cuốc Xe <span>{{ trip.tripCode }}</span></h3>
        </div>
        <button class="btn-close" @click="$emit('close')">
          <X :size="18" />
        </button>
      </div>

      <div class="modal-body p-0">
        <!-- Error Alert -->
        <div v-if="errorMsg" class="px-4 pt-3">
          <div class="alert alert-danger flex items-start gap-2 text-sm p-3 rounded bg-red-50 text-red-700 border border-red-200">
            <AlertCircle :size="16" class="mt-0.5 shrink-0" />
            <span>{{ errorMsg }}</span>
          </div>
        </div>

        <div class="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <!-- Col 1: Xe và Lộ trình -->
          <div class="space-y-4">
            <div class="form-group mb-0">
              <label class="form-label required flex items-center gap-1.5">
                <Truck :size="14" class="text-primary" />
                <span>Phương tiện thực hiện</span>
              </label>
              <select v-model="vehicleId" class="form-select font-semibold">
                <option value="" disabled>-- Chọn phương tiện --</option>
                <option v-for="v in vehicles" :key="v.id" :value="v.id">
                  {{ v.licensePlate }} ({{ getVehicleTypeLabel(v.vehicleType) }}) - {{ getVehicleStatusLabel(v.status) }}
                </option>
              </select>
            </div>

            <div class="form-group mb-0">
              <label class="form-label required flex items-center gap-1.5">
                <UserCheck :size="14" class="text-primary" />
                <span>Tài xế phụ trách</span>
              </label>
              <select v-model="driverId" class="form-select font-semibold">
                <option value="" disabled>-- Chọn tài xế --</option>
                <option v-for="d in drivers" :key="d.id" :value="d.id">
                  {{ d.fullName }} - {{ d.phone }}
                </option>
              </select>
              <p v-if="selectedDriver && selectedDriver.licenseExpiryDate" class="text-xs text-muted mt-1 flex items-center gap-1">
                <CheckCircle2 :size="12" class="text-success" />
                Bằng lái ({{ selectedDriver.licenseClass }}) hiệu lực đến: {{ selectedDriver.licenseExpiryDate }}
              </p>
            </div>

            <div class="form-group mb-0">
              <label class="form-label required flex items-center gap-1.5">
                <Navigation :size="14" class="text-primary" />
                <span>Lộ trình quy chuẩn</span>
              </label>
              <select v-model="routeId" class="form-select font-semibold">
                <option value="" disabled>-- Chọn lộ trình --</option>
                <option v-for="r in routes" :key="r.id" :value="r.id">
                  {{ r.name }} ({{ r.standardDistanceKm }} km)
                </option>
              </select>
            </div>
          </div>

          <!-- Col 2: Thời gian và Ghi chú -->
          <div class="space-y-4">
            <div class="form-group mb-0">
              <label class="form-label required flex items-center gap-1.5">
                <Clock :size="14" class="text-primary" />
                <span>Dự kiến khởi hành</span>
              </label>
              <input type="datetime-local" v-model="scheduledStartTime" class="form-input" />
            </div>

            <div class="form-group mb-0">
              <label class="form-label required flex items-center gap-1.5">
                <Clock :size="14" class="text-primary" />
                <span>Dự kiến kết thúc</span>
              </label>
              <input type="datetime-local" v-model="scheduledEndTime" class="form-input" />
            </div>

            <div class="form-group mb-0">
              <label class="form-label">Ghi chú chuyến xe</label>
              <textarea
                v-model="notes"
                class="form-control"
                rows="3"
                placeholder="Ghi chú điều động..."
              ></textarea>
            </div>
          </div>
        </div>
      </div>

      <div class="modal-footer justify-between">
        <button class="btn btn-outline" type="button" @click="$emit('close')" :disabled="isSubmitting">
          Hủy bỏ
        </button>
        <button class="btn btn-primary" type="button" @click="handleSave" :disabled="isSubmitting">
          <Save :size="16" />
          <span>Lưu Thay Đổi</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-lg {
  max-width: 800px;
}
</style>
