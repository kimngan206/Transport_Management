import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { mockStorage } from '@/services/mockStorage';
import { initialUsers } from '@/mocks';
import type { User, UserRole } from '@/types';

export const useAuthStore = defineStore('auth', () => {
  const users = ref<User[]>(mockStorage.getUsers());
  const currentUserId = ref<number>(mockStorage.getCurrentUserId());

  // Đảm bảo users đồng bộ với initialUsers (loại bỏ user đã xóa và cập nhật thông tin)
  users.value = users.value.filter((u) => initialUsers.some((iu) => iu.id === u.id));
  for (const iu of initialUsers) {
    const existing = users.value.find((u) => u.id === iu.id);
    if (!existing) {
      users.value.push({ ...iu });
    } else {
      existing.jobTitle = iu.jobTitle;
      existing.fullName = iu.fullName;
      existing.roles = iu.roles;
      existing.departmentName = iu.departmentName;
    }
  }
  mockStorage.saveUsers(users.value);

  // Nếu user hiện tại không tồn tại trong danh sách, đặt lại về Dispatcher (id: 3)
  if (!users.value.some((u) => u.id === currentUserId.value)) {
    currentUserId.value = 3;
    mockStorage.saveCurrentUserId(3);
  }

  const currentUser = computed<User>(() => {
    return users.value.find((u) => u.id === currentUserId.value) || users.value[0];
  });

  const activeRole = ref<UserRole>(
    mockStorage.getActiveRole<UserRole>(currentUser.value.roles[0] || 'Dispatcher')
  );
  if ((activeRole.value as string) === 'Approver') {
    activeRole.value = 'Dispatcher';
    mockStorage.saveActiveRole('Dispatcher');
  }

  function switchUser(userId: number) {
    const target = users.value.find((u) => u.id === userId);
    if (!target) return;
    currentUserId.value = userId;
    mockStorage.saveCurrentUserId(userId);
    const newRole = target.roles[0] || 'Requester';
    activeRole.value = newRole;
    mockStorage.saveActiveRole(newRole);
  }

  function switchRole(role: UserRole) {
    activeRole.value = role;
    mockStorage.saveActiveRole(role);
  }

  function isRole(role: UserRole): boolean {
    return activeRole.value === role || activeRole.value === 'Admin';
  }

  return {
    users,
    currentUser,
    activeRole,
    switchUser,
    switchRole,
    isRole,
  };
});
