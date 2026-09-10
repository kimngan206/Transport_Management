import { defineStore, acceptHMRUpdate } from 'pinia';
import { ref, computed } from 'vue';
import { mockStorage } from '@/services/mockStorage';
import type {
  Vehicle,
  VehicleCategory,
  Driver,
  StandardRoute,
  IncidentReport,
  MaintenanceRecord,
  MaintenanceType,
  VehicleAssignmentHistory,
} from '@/types';

export const useFleetStore = defineStore('fleet', () => {
  const vehicles = ref<Vehicle[]>(mockStorage.getVehicles());
  const vehicleCategories = ref<VehicleCategory[]>(mockStorage.getVehicleCategories());
  const drivers = ref<Driver[]>(mockStorage.getDrivers());
  const driverAssignments = ref<VehicleAssignmentHistory[]>(mockStorage.getDriverAssignments());
  const routes = ref<StandardRoute[]>(mockStorage.getRoutes());
  const incidents = ref<IncidentReport[]>(mockStorage.getIncidents());
  const maintenances = ref<MaintenanceRecord[]>(mockStorage.getMaintenanceRecords());
  const maintenanceTypes = ref<MaintenanceType[]>(mockStorage.getMaintenanceTypes());

  // Lưu tự động
  function saveState() {
    mockStorage.saveVehicles(vehicles.value);
    mockStorage.saveVehicleCategories(vehicleCategories.value);
    mockStorage.saveDrivers(drivers.value);
    mockStorage.saveDriverAssignments(driverAssignments.value);
    mockStorage.saveRoutes(routes.value);
    mockStorage.saveIncidents(incidents.value);
    mockStorage.saveMaintenanceRecords(maintenances.value);
    mockStorage.saveMaintenanceTypes(maintenanceTypes.value);
  }

  // Lấy ngưỡng chu kỳ bảo dưỡng định kỳ cấu hình trong Danh mục loại bảo dưỡng cho từng xe cụ thể
  function getVehicleMaintenanceThreshold(vehicle: Vehicle): number {
    if (vehicle.vehicleType === 'MillingMachine') {
      const exType = maintenanceTypes.value.find(
        (m) =>
          m.isActive &&
          m.cycleHours &&
          (m.assignedVehicleIds?.includes(vehicle.id) || !m.assignedVehicleIds || m.assignedVehicleIds.length === 0)
      );
      return exType?.cycleHours || 500;
    }

    // Tìm gói bảo dưỡng định kỳ đang kích hoạt áp dụng cho chính chiếc xe này
    const applicable = maintenanceTypes.value
      .filter(
        (m) =>
          m.isActive &&
          m.group === 'Bảo dưỡng định kỳ' &&
          m.cycleKm &&
          (m.assignedVehicleIds?.includes(vehicle.id) || !m.assignedVehicleIds || m.assignedVehicleIds.length === 0)
      )
      .sort((a, b) => (a.cycleKm || 0) - (b.cycleKm || 0));

    if (applicable.length > 0 && applicable[0].cycleKm) {
      return applicable[0].cycleKm;
    }
    return 5000;
  }

  // Getters
  const availableVehicles = computed(() => {
    return vehicles.value.filter((v) => {
      if (v.status !== 'Available') return false;
      const threshold = getVehicleMaintenanceThreshold(v);
      const distanceSinceLast = v.currentOdoKm - v.lastMaintenanceOdo;
      const isDue = (v.vehicleType !== 'MillingMachine' && distanceSinceLast >= threshold)
        || v.maintenanceStatus === 'Due'
        || v.maintenanceStatus === 'Overdue';
      return !isDue;
    });
  });

  const dueMaintenanceVehicles = computed(() => {
    return vehicles.value.filter((v) => {
      const threshold = getVehicleMaintenanceThreshold(v);
      const distanceSinceLast = v.currentOdoKm - v.lastMaintenanceOdo;
      return v.maintenanceStatus === 'Due' || v.maintenanceStatus === 'Overdue' || distanceSinceLast >= threshold;
    });
  });

  const activeDrivers = computed(() => {
    return drivers.value.filter((d) => d.employmentStatus === 'Active' && !d.isCurrentlyOnTrip);
  });

  const getDriverAssignmentsByVehicleId = (vehicleId: number) => {
    return driverAssignments.value
      .filter(a => a.vehicleId === vehicleId)
      .sort((a, b) => new Date(b.assignedFrom).getTime() - new Date(a.assignedFrom).getTime());
  };

  // Actions
  function assignDriverToVehicle(vehicleId: number, driverId: number | null, notes?: string) {
    const now = new Date().toISOString().slice(0, 10);
    
    // Close active assignment if any
    const activeAssignment = driverAssignments.value.find(
      (a) => a.vehicleId === vehicleId && !a.assignedTo
    );
    if (activeAssignment) {
      if (activeAssignment.driverId === driverId) return;
      activeAssignment.assignedTo = now;
    }
    
    const vehicle = vehicles.value.find((v) => v.id === vehicleId);
    if (!vehicle) return;

    if (driverId !== null) {
      const driver = drivers.value.find((d) => d.id === driverId);
      if (driver) {
        const newAssignment: VehicleAssignmentHistory = {
          id: Date.now(),
          vehicleId,
          driverId,
          driverName: driver.fullName,
          assignedFrom: now,
          notes,
        };
        driverAssignments.value.unshift(newAssignment);
        
        vehicle.assignedDriverId = driver.id;
        vehicle.assignedDriverName = driver.fullName;
        vehicle.assignedDriverPhone = driver.phone;
      }
    } else {
      vehicle.assignedDriverId = undefined;
      vehicle.assignedDriverName = undefined;
      vehicle.assignedDriverPhone = undefined;
    }
    
    saveState();
  }

  function updateVehicleOdo(vehicleId: number, newOdo: number) {
    const v = vehicles.value.find((item) => item.id === vehicleId);
    if (!v) return;
    v.currentOdoKm = newOdo;

    // Kiểm tra tự động theo ngưỡng chu kỳ bảo dưỡng đã cài đặt
    const threshold = getVehicleMaintenanceThreshold(v);
    if (newOdo - v.lastMaintenanceOdo >= threshold) {
      v.maintenanceStatus = 'Due';
    }
    saveState();
  }

  function setVehicleStatus(vehicleId: number, status: Vehicle['status']) {
    const v = vehicles.value.find((item) => item.id === vehicleId);
    if (!v) return;
    v.status = status;
    saveState();
  }

  function setDriverStatus(driverId: number, onTrip: boolean) {
    const d = drivers.value.find((item) => item.id === driverId);
    if (!d) return;
    d.isCurrentlyOnTrip = onTrip;
    saveState();
  }

  function reportIncident(payload: Omit<IncidentReport, 'id' | 'status'>) {
    const newIncident: IncidentReport = {
      ...payload,
      id: Date.now(),
      status: 'Pending',
    };
    incidents.value.unshift(newIncident);

    // Nếu sự cố mức StopOperation thì đổi trạng thái xe
    if (payload.severity === 'StopOperation') {
      const v = vehicles.value.find((item) => item.id === payload.vehicleId);
      if (v) v.status = 'Broken';
    }

    // Đồng bộ tức thời vị trí GPS của tài xế sang bản đồ điều xe trực tiếp
    try {
      const mapStates = mockStorage.getVehicleMapStates();
      const targetMapVeh = mapStates.find(
        (mv: any) => mv.licensePlate === payload.vehiclePlate || mv.id === payload.vehicleId
      );
      if (targetMapVeh) {
        if (payload.latitude && payload.longitude) {
          targetMapVeh.currentLat = payload.latitude;
          targetMapVeh.currentLng = payload.longitude;
        }
        targetMapVeh.status = 'MAINTENANCE';
        const locLabel = payload.location ? `[${payload.location}] ` : '';
        targetMapVeh.cargoDescription = `⚠️ [SỰ CỐ KHẨN CẤP] ${locLabel}${payload.issueDescription}`;
        mockStorage.saveVehicleMapStates(mapStates);
      }
    } catch (err) {
      console.warn('Lỗi đồng bộ GPS bản đồ:', err);
    }

    saveState();
  }

  function recordMaintenance(payload: Omit<MaintenanceRecord, 'id'>) {
    const newRecord: MaintenanceRecord = {
      ...payload,
      id: Date.now(),
    };
    maintenances.value.unshift(newRecord);

    const v = vehicles.value.find((item) => item.id === payload.vehicleId);
    if (v) {
      v.lastMaintenanceOdo = payload.maintenanceOdo;
      v.lastMaintenanceDate = payload.maintenanceDate;
      v.maintenanceStatus = 'Normal';
      if (v.status === 'UnderMaintenance' || v.status === 'Broken') {
        v.status = 'Available';
      }
    }
    saveState();
  }

  function addRoute(route: Omit<StandardRoute, 'id'>) {
    const newRoute: StandardRoute = {
      ...route,
      id: Date.now(),
    };
    routes.value.push(newRoute);
    saveState();
  }

  function updateRoute(route: StandardRoute) {
    const idx = routes.value.findIndex((r) => r.id === route.id);
    if (idx !== -1) {
      routes.value[idx] = { ...route };
      saveState();
    }
  }

  function deleteRoute(id: number) {
    routes.value = routes.value.filter((r) => r.id !== id);
    saveState();
  }

  function addVehicle(vehicle: Omit<Vehicle, 'id'> & { id?: number }) {
    const newVeh: Vehicle = {
      ...vehicle,
      id: vehicle.id || Date.now(),
    };
    vehicles.value.push(newVeh);
    saveState();
    return newVeh;
  }

  function updateVehicle(vehicle: Vehicle) {
    const idx = vehicles.value.findIndex((v) => v.id === vehicle.id);
    if (idx !== -1) {
      vehicles.value[idx] = { ...vehicle };
      saveState();
    }
  }

  function deleteVehicle(id: number) {
    vehicles.value = vehicles.value.filter((v) => v.id !== id);
    saveState();
  }

  function addVehicleCategory(category: Omit<VehicleCategory, 'id'>) {
    const newCat: VehicleCategory = {
      ...category,
      id: Date.now(),
    };
    vehicleCategories.value.push(newCat);
    saveState();
  }

  function updateVehicleCategory(category: VehicleCategory) {
    const idx = vehicleCategories.value.findIndex((c) => c.id === category.id);
    if (idx !== -1) {
      vehicleCategories.value[idx] = { ...category };
      saveState();
    }
  }

  function deleteVehicleCategory(id: number) {
    vehicleCategories.value = vehicleCategories.value.filter((c) => c.id !== id);
    saveState();
  }

  function addDriver(driver: Omit<Driver, 'id'>) {
    const newDriver: Driver = {
      ...driver,
      id: Date.now(),
    };
    drivers.value.push(newDriver);
    saveState();
  }

  function updateDriver(driver: Driver) {
    const idx = drivers.value.findIndex((d) => d.id === driver.id);
    if (idx !== -1) {
      drivers.value[idx] = { ...driver };
      saveState();
    }
  }

  function deleteDriver(id: number) {
    drivers.value = drivers.value.filter((d) => d.id !== id);
    saveState();
  }

  function addMaintenanceType(item: Omit<MaintenanceType, 'id'>) {
    const newItem: MaintenanceType = {
      ...item,
      id: Math.max(0, ...maintenanceTypes.value.map((m) => m.id)) + 1,
      assignedVehicleIds: item.assignedVehicleIds ?? [],
    };
    maintenanceTypes.value.push(newItem);
    saveState();
  }

  function updateMaintenanceType(item: MaintenanceType) {
    const idx = maintenanceTypes.value.findIndex((m) => m.id === item.id);
    if (idx !== -1) {
      maintenanceTypes.value[idx] = { ...item };
      saveState();
    }
  }

  function deleteMaintenanceType(id: number) {
    maintenanceTypes.value = maintenanceTypes.value.filter((m) => m.id !== id);
    saveState();
  }

  function toggleMaintenanceTypeStatus(id: number) {
    const item = maintenanceTypes.value.find((m) => m.id === id);
    if (item) {
      item.isActive = !item.isActive;
      saveState();
    }
  }

  function assignVehiclesToMaintenanceType(maintenanceTypeId: number, vehicleIds: number[]) {
    const item = maintenanceTypes.value.find((m) => m.id === maintenanceTypeId);
    if (item) {
      item.assignedVehicleIds = vehicleIds;
      saveState();
    }
  }

  return {
    vehicles,
    vehicleCategories,
    drivers,
    driverAssignments,
    routes,
    incidents,
    maintenances,
    maintenanceTypes,
    getVehicleMaintenanceThreshold,
    availableVehicles,
    dueMaintenanceVehicles,
    activeDrivers,
    getDriverAssignmentsByVehicleId,
    assignDriverToVehicle,
    updateVehicleOdo,
    setVehicleStatus,
    setDriverStatus,
    reportIncident,
    recordMaintenance,
    addRoute,
    updateRoute,
    deleteRoute,
    addVehicle,
    updateVehicle,
    deleteVehicle,
    addDriver,
    updateDriver,
    deleteDriver,
    addVehicleCategory,
    updateVehicleCategory,
    deleteVehicleCategory,
    addMaintenanceType,
    updateMaintenanceType,
    deleteMaintenanceType,
    toggleMaintenanceTypeStatus,
    assignVehiclesToMaintenanceType,
    saveState,
  };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useFleetStore, import.meta.hot));
}
