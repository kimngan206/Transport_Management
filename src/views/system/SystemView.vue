<script setup lang="ts">
import { ref } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { mockStorage } from '@/services/mockStorage';
import { Users, Shield, Building2, Key } from 'lucide-vue-next';

const authStore = useAuthStore();
const activeTab = ref<'users' | 'roles' | 'departments'>('users');

const departments = ref(mockStorage.getDepartments());
const users = ref(authStore.users);

const rolesList = [
  {
    role: 'Requester',
    name: 'Người Đặt Xe (Nhân viên)',
    desc: 'Tạo yêu cầu đặt xe, theo dõi tiến trình timeline, hủy yêu cầu khi chưa lăn bánh.',
    color: '#0284c7',
  },
  {
    role: 'Approver',
    name: 'Cấp Quản Lý Phê Duyệt',
    desc: 'Duyệt hoặc từ chối yêu cầu đặt xe theo phạm vi phòng ban phụ trách (Bắt buộc lý do khi từ chối).',
    color: '#d97706',
  },
  {
    role: 'Dispatcher',
    name: 'Điều Phối Viên Đội Xe',
    desc: 'Quản lý đội xe, tài xế, tuyến đường; thực hiện ghép chuyến và gán tài nguyên.',
    color: '#7c3aed',
  },
  {
    role: 'Driver',
    name: 'Đội Ngũ Tài Xế',
    desc: 'Xem lịch phân công cá nhân, bắt đầu xuất bến nhập ODO, hoàn thành chuyến nhập ODO và sản lượng mủ.',
    color: '#15803d',
  },
  {
    role: 'Admin',
    name: 'Quản Trị Viên Hệ Thống',
    desc: 'Toàn quyền cấu hình danh mục, tài khoản, phân quyền vai trò và thông số kỹ thuật định mức.',
    color: '#dc2626',
  },
];
</script>

<template>
  <div class="system-page">
    <div class="page-header">
      <div>
        <h1 class="page-title">Quản Trị Hệ Thống (Phân hệ 9 - Sitemap)</h1>
        <p class="page-subtitle">Quản lý danh sách tài khoản, vai trò người dùng và cơ cấu tổ chức phòng ban</p>
      </div>

      <div class="tab-toggle">
        <button
          class="toggle-btn"
          :class="{ active: activeTab === 'users' }"
          @click="activeTab = 'users'"
        >
          <Users :size="15" />
          <span>Người Dùng ({{ users.length }})</span>
        </button>

        <button
          class="toggle-btn"
          :class="{ active: activeTab === 'roles' }"
          @click="activeTab = 'roles'"
        >
          <Shield :size="15" />
          <span>Vai Trò & Quyền (5)</span>
        </button>

        <button
          class="toggle-btn"
          :class="{ active: activeTab === 'departments' }"
          @click="activeTab = 'departments'"
        >
          <Building2 :size="15" />
          <span>Phòng Ban ({{ departments.length }})</span>
        </button>
      </div>
    </div>

    <!-- 1. Danh sách người dùng -->
    <div v-if="activeTab === 'users'" class="card">
      <div class="card-header">
        <h3 class="card-title">Danh Sách Người Dùng & Tài Khoản</h3>
      </div>

      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th>Họ Và Tên</th>
              <th>Chức Vụ Chuyên Môn</th>
              <th>Tên Đăng Nhập</th>
              <th>Email</th>
              <th>Số Điện Thoại</th>
              <th>Phòng Ban Trực Thuộc</th>
              <th>Vai Trò (Roles)</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="u in users" :key="u.id">
              <td>
                <div class="user-row-cell">
                  <img :src="u.avatarUrl" class="avatar-sm" alt="avatar" />
                  <strong>{{ u.fullName }}</strong>
                </div>
              </td>
              <td>
                <span class="badge badge-green">{{ u.jobTitle || 'Chuyên viên' }}</span>
              </td>
              <td><code>{{ u.username }}</code></td>
              <td>{{ u.email }}</td>
              <td>{{ u.phone }}</td>
              <td>{{ u.departmentName }}</td>
              <td>
                <div class="roles-chips">
                  <span
                    v-for="r in u.roles"
                    :key="r"
                    class="role-badge-sm"
                    :class="r.toLowerCase()"
                  >
                    {{ r }}
                  </span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 2. Danh sách vai trò -->
    <div v-else-if="activeTab === 'roles'" class="roles-grid">
      <div v-for="item in rolesList" :key="item.role" class="card role-card">
        <div class="role-card-header">
          <div class="role-icon-box" :style="{ backgroundColor: item.color + '20', color: item.color }">
            <Key :size="20" />
          </div>
          <div>
            <h4 class="role-title">{{ item.name }}</h4>
            <span class="role-slug">Mã quyền: <code>{{ item.role }}</code></span>
          </div>
        </div>
        <p class="role-desc">{{ item.desc }}</p>
      </div>
    </div>

    <!-- 3. Danh sách phòng ban -->
    <div v-else class="card">
      <div class="card-header">
        <h3 class="card-title">Cơ Cấu Tổ Chức & Phòng Ban</h3>
      </div>

      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th>Mã Đơn Vị</th>
              <th>Tên Phòng Ban / Đơn Vị Nông Trường</th>
              <th>Người Quản Lý Phụ Trách</th>
              <th>Chức Năng Chính</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="dept in departments" :key="dept.id">
              <td><span class="dept-code">{{ dept.code }}</span></td>
              <td><strong>{{ dept.name }}</strong></td>
              <td>Trần Trọng Quản (Trưởng phòng)</td>
              <td class="text-sm text-secondary">
                Quản lý kế hoạch khai thác, thu hoạch và vận chuyển mủ cao su
              </td>
            </tr>
          </tbody>
        </table>
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
.tab-toggle {
  display: flex;
  background: #e2e8f0;
  padding: 3px;
  border-radius: var(--radius-sm);
}
.toggle-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  border: none;
  background: transparent;
  padding: 6px 14px;
  font-size: 0.8125rem;
  font-weight: 600;
  border-radius: 4px;
  cursor: pointer;
  color: var(--text-secondary);
}
.toggle-btn.active {
  background: white;
  color: var(--text-primary);
  box-shadow: var(--shadow-sm);
}
.user-row-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}
.avatar-sm {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  object-fit: cover;
}
.roles-chips {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}
.role-badge-sm {
  font-size: 0.6875rem;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 12px;
}
.role-badge-sm.requester { background: #e0f2fe; color: #0369a1; }
.role-badge-sm.approver { background: #fef3c7; color: #b45309; }
.role-badge-sm.dispatcher { background: #ede9fe; color: #6d28d9; }
.role-badge-sm.driver { background: #dcfce7; color: #15803d; }
.role-badge-sm.admin { background: #fee2e2; color: #b91c1c; }

.roles-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}
.role-card {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.role-card-header {
  display: flex;
  align-items: center;
  gap: 12px;
}
.role-icon-box {
  width: 42px;
  height: 42px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.role-title {
  font-size: 0.9375rem;
  font-weight: 800;
}
.role-slug {
  font-size: 0.75rem;
  color: var(--text-muted);
}
.role-desc {
  font-size: 0.8125rem;
  color: var(--text-secondary);
  line-height: 1.5;
}
.dept-code {
  background: #f1f5f9;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 700;
  font-size: 0.75rem;
}
.text-sm { font-size: 0.8125rem; }
.text-secondary { color: var(--text-secondary); }
</style>
