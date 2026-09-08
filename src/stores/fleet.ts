import { defineStore } from 'pinia';
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
} from '@/types';

export const useFleetStore = defineStore('fleet', () => {
  const vehicles = ref<Vehicle[]>(mockStorage.getVehicles());
  const vehicleCategories = ref<VehicleCategory[]>(mockStorage.getVehicleCategories());
  const drivers = ref<Driver[]>(mockStorage.getDrivers());
  const routes = ref<StandardRoute[]>(mockStorage.getRoutes());
  const incidents = ref<IncidentReport[]>(mockStorage.getIncidents());
  const maintenances = ref<MaintenanceRecord[]>(mockStorage.getMaintenanceRecords());
  const maintenanceTypes = ref<MaintenanceType[]>(mockStorage.getMaintenanceTypes());

  // Lưu tự động
  function saveState() {
    mockStorage.saveVehicles(vehicles.value);
    mockStorage.saveVehicleCategories(vehicleCategories.value);
    mockStorage.saveDrivers(drivers.value);
    mockStorage.saveRoutes(routes.value);
    mockStorage.saveIncidents(incidents.value);
    mockStorage.saveMaintenanceRecords(maintenances.value);
    mockStorage.saveMaintenanceTypes(maintenanceTypes.value);
  }

  // Getters
  const availableVehicles = computed(() => {
    return vehicles.value.filter(
      (v) => v.status === 'Available' && v.maintenanceStatus !== 'Overdue'
    );
  });

  const dueMaintenanceVehicles = computed(() => {
    return vehicles.value.filter((v) => {
      const distanceSinceLast = v.currentOdoKm - v.lastMaintenanceOdo;
      return v.maintenanceStatus === 'Due' || v.maintenanceStatus === 'Overdue' || distanceSinceLast >= 5000;
    });
  });

  const activeDrivers = computed(() => {
    return drivers.value.filter((d) => d.employmentStatus === 'Active' && !d.isCurrentlyOnTrip);
  });

  // Actions
  function updateVehicleOdo(vehicleId: number, newOdo: number) {
    const v = vehicles.value.find((item) => item.id === vehicleId);
    if (!v) return;
    v.currentOdoKm = newOdo;

    // Rule 27: Cảnh báo bảo dưỡng 5.000 km
    if (newOdo - v.lastMaintenanceOdo >= 5000) {
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

  function addVehicle(vehicle: Omit<Vehicle, 'id'>) {
    const newVeh: Vehicle = {
      ...vehicle,
      id: Date.now(),
    };
    vehicles.value.push(newVeh);
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

  function addMaintenanceType(item: Omit<MaintenanceType, 'id'>) {
    const newItem: MaintenanceType = {
      ...item,
      id: Date.now(),
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

  return {
    vehicles,
    vehicleCategories,
    drivers,
    routes,
    incidents,
    maintenances,
    maintenanceTypes,
    availableVehicles,
    dueMaintenanceVehicles,
    activeDrivers,
    updateVehicleOdo,
    setVehicleStatus,
    setDriverStatus,
    reportIncident,
    recordMaintenance,
    addRoute,
    addVehicle,
    addDriver,
    addVehicleCategory,
    updateVehicleCategory,
    deleteVehicleCategory,
    addMaintenanceType,
    updateMaintenanceType,
    deleteMaintenanceType,
    toggleMaintenanceTypeStatus,
  };
});
