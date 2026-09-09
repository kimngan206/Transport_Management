<script setup lang="ts">
import { computed, ref } from 'vue';

const props = withDefaults(
  defineProps<{
    modelValue?: string;
    placeholder?: string;
    label?: string;
  }>(),
  {
    modelValue: '',
    placeholder: 'Ví dụ: (StandardDistanceKm × NLP) + ((TotalWeightKg / 1000) × StandardDistanceKm × NLC)',
    label: 'Công Thức',
  }
);

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();

const activeTab = ref<'Hàm' | 'Công thức' | 'Biểu thức'>('Công thức');

const formulaValue = computed({
  get: () => props.modelValue,
  set: (value: string) => emit('update:modelValue', value),
});

type TokenItem = {
  label: string;
  value: string;
  badge?: string;
  description: string;
};

type BuilderGroup = {
  title: string;
  items: TokenItem[];
};

const mathOperators: TokenItem[] = [
  { label: '+', value: '+', description: 'Phép cộng hai giá trị' },
  { label: '-', value: '-', description: 'Phép trừ hai giá trị' },
  { label: '*', value: '*', description: 'Phép nhân hai giá trị' },
  { label: '/', value: '/', description: 'Phép chia hai giá trị' },
  { label: '(', value: '(', description: 'Mở ngoặc để nhóm biểu thức' },
  { label: ')', value: ')', description: 'Đóng ngoặc sau khi nhóm biểu thức' },
];

const functionItems: TokenItem[] = [
  { label: 'ABS', value: 'ABS()', badge: 'Fn', description: 'Lấy giá trị tuyệt đối của một số' },
  { label: 'MAX', value: 'MAX()', badge: 'Fn', description: 'Lấy giá trị lớn nhất trong các giá trị được truyền vào' },
  { label: 'MIN', value: 'MIN()', badge: 'Fn', description: 'Lấy giá trị nhỏ nhất trong các giá trị được truyền vào' },
];

const builderGroups: Record<string, BuilderGroup[]> = {
  Hàm: [
    {
      title: 'TOÁN HỌC',
      items: mathOperators,
    },
    {
      title: 'HÀM DÙNG CHUNG',
      items: functionItems,
    },
  ],
  'Công thức': [
    {
      title: 'TOÁN HỌC',
      items: mathOperators,
    },
    {
      title: 'HÀM DÙNG CHUNG',
      items: functionItems,
    },
    {
      title: 'ĐỊNH MỨC XE TẢI',
      items: [
        { label: 'StandardDistanceKm', value: 'StandardDistanceKm', badge: 'Km', description: 'Quãng đường tiêu chuẩn giữa các điểm của tuyến để tính định mức' },
        { label: 'NLP', value: 'NLP', badge: 'L/km', description: 'Định mức nhiên liệu không tải, tính theo lít trên 1 km' },
        { label: 'NLC', value: 'NLC', badge: 'L/t.km', description: 'Định mức nhiên liệu có tải, tính theo lít trên 1 tấn.km' },
        { label: 'TotalWeightKg', value: 'TotalWeightKg', badge: 'Kg', description: 'Tổng khối lượng mủ hoặc hàng hóa cần vận chuyển tính bằng kilogram' },
      ],
    },
    {
      title: 'XE XÚC',
      items: [
        { label: 'StartHour', value: 'StartHour', badge: 'Giờ', description: 'Giờ máy bắt đầu tại thời điểm xuất phát' },
        { label: 'EndHour', value: 'EndHour', badge: 'Giờ', description: 'Giờ máy kết thúc tại thời điểm về bến' },
        { label: 'HourQuota', value: 'HourQuota', badge: 'L/giờ', description: 'Định mức tiêu hao nhiên liệu theo giờ máy của xe xúc' },
      ],
    },
    {
      title: 'XE ĐIỆN',
      items: [
        { label: 'ElectricNormPerKm', value: 'ElectricNormPerKm', badge: 'kWh/km', description: 'Định mức tiêu hao điện trung bình theo từng km đi được' },
        { label: 'StandardDistanceKm', value: 'StandardDistanceKm', badge: 'Km', description: 'Quãng đường tiêu chuẩn giữa các điểm cần đi' },
      ],
    },
  ],
  'Biểu thức': [
    {
      title: 'BIẾN THÔNG DỤNG',
      items: [
        { label: 'DistanceKm', value: 'DistanceKm', badge: 'Km', description: 'Quãng đường thực tế đã đi được trong chuyến' },
        { label: 'StartOdo', value: 'StartOdo', badge: 'Km', description: 'Chỉ số ODO bắt đầu của hành trình' },
        { label: 'EndOdo', value: 'EndOdo', badge: 'Km', description: 'Chỉ số ODO kết thúc của hành trình' },
        { label: 'CurrentOdoKm', value: 'CurrentOdoKm', badge: 'Km', description: 'Chỉ số ODO hiện tại của phương tiện' },
      ],
    },
    {
      title: 'TOÁN HỌC',
      items: mathOperators,
    },
    {
      title: 'HÀM DÙNG CHUNG',
      items: functionItems,
    },
  ],
};

const tabItems = ['Hàm', 'Công thức', 'Biểu thức'] as const;

const formulaTokens = computed(() => {
  const raw = formulaValue.value.trim();
  return raw ? raw.split(/\s+/).filter((token) => token.trim().length > 0) : [];
});

function insertToken(token: string) {
  const normalized = token.trim();
  const current = formulaValue.value.trim();
  const nextValue = current ? `${current} ${normalized}` : normalized;
  formulaValue.value = nextValue;
}

function removeToken(index: number) {
  const tokens = [...formulaTokens.value];
  tokens.splice(index, 1);
  formulaValue.value = tokens.join(' ');
}

function clearFormula() {
  formulaValue.value = '';
}
</script>

<template>
  <div class="formula-builder">
    <div class="formula-builder-header">
      <div class="tab-switcher">
        <button
          v-for="tab in tabItems"
          :key="tab"
          type="button"
          class="tab-button"
          :class="{ active: activeTab === tab }"
          @click="activeTab = tab"
        >
          {{ tab }}
        </button>
      </div>
      <button type="button" class="clear-button" @click="clearFormula">Xóa</button>
    </div>

    <div class="formula-builder-body">
      <div v-if="formulaValue.trim()" class="formula-input-wrap">
        <label class="formula-label">{{ label }}</label>

        <div class="formula-preview" aria-label="Công thức đang chọn">
          <div
            v-for="(token, index) in formulaTokens"
            :key="`${token}-${index}`"
            class="formula-token"
          >
            <span>{{ token }}</span>
            <button
              type="button"
              class="formula-token-remove"
              :title="`Xóa ${token}`"
              @click="removeToken(index)"
            >
              ×
            </button>
          </div>
        </div>
      </div>

      <div class="token-panel">
        <div
          v-for="group in builderGroups[activeTab]"
          :key="group.title"
          class="token-group"
        >
          <div class="token-group-title">{{ group.title }}</div>
          <div class="token-group-grid">
            <button
              v-for="item in group.items"
              :key="`${group.title}-${item.label}`"
              type="button"
              class="token-button"
              :title="item.description"
              @click="insertToken(item.value)"
            >
              <span class="token-button-label">{{ item.label }}</span>
              <span v-if="item.badge" class="token-badge">{{ item.badge }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.formula-builder {
  border: 1px solid #f4b067;
  border-radius: 12px;
  background: #fffaf3;
  box-shadow: inset 0 0 0 1px rgba(251, 146, 60, 0.08);
  max-height: 54vh;
  overflow-y: auto;
  overflow-x: hidden;
}

.formula-builder-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  background: linear-gradient(180deg, #fff5eb 0%, #fbe6d0 100%);
  border-bottom: 1px solid #f4b067;
  padding: 12px 14px;
}

.tab-switcher {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.tab-button {
  border: 1px solid #f4b067;
  background: #fff;
  color: #c76b18;
  border-radius: 999px;
  padding: 7px 16px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
}

.tab-button.active {
  background: linear-gradient(135deg, #f59e0b 0%, #f97316 100%);
  color: #fff;
  border-color: #ea580c;
  box-shadow: 0 6px 16px rgba(249, 115, 22, 0.2);
}

.clear-button {
  border: 1px solid #f4b067;
  background: #fff;
  color: #b45309;
  border-radius: 999px;
  padding: 7px 16px;
  font-weight: 700;
  cursor: pointer;
}

.formula-builder-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px;
}

.token-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.token-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.token-group-title {
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  color: #a15b13;
  text-transform: uppercase;
}

.token-group-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.token-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 30px;
  padding: 6px 10px;
  border-radius: 8px;
  border: 1px solid #f4b067;
  background: linear-gradient(180deg, #fff 0%, #fff7ee 100%);
  color: #7c2d12;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
}

.token-button:hover {
  border-color: #f59e0b;
  box-shadow: 0 8px 18px rgba(249, 115, 22, 0.12);
  transform: translateY(-1px);
}

.token-button-label {
  font-size: 0.85rem;
}

.token-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  padding: 2px 5px;
  border-radius: 999px;
  background: #ffedd5;
  color: #b45309;
  font-size: 0.64rem;
  font-weight: 800;
}

.formula-input-wrap {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.formula-preview {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  min-height: 42px;
  padding: 10px 12px;
  border: 1px solid #f4b067;
  border-radius: 10px;
  background: #fff;
}

.formula-token {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 30px;
  padding: 6px 16px 6px 10px;
  border-radius: 8px;
  border: 1px solid #f4b067;
  background: linear-gradient(180deg, #fff 0%, #fff4e8 100%);
  color: #7c2d12;
  font-weight: 800;
  font-size: 0.85rem;
}

.formula-token-remove {
  position: absolute;
  top: -6px;
  right: -6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  border: 1px solid rgba(239, 68, 68, 0.6);
  border-radius: 50%;
  background: #ef4444;
  color: #fff;
  font-size: 0.68rem;
  font-weight: 700;
  line-height: 1;
  cursor: pointer;
  padding: 0;
  box-shadow: 0 2px 6px rgba(239, 68, 68, 0.25);
}

.formula-label {
  font-size: 0.8rem;
  font-weight: 800;
  color: #7c2d12;
}

.formula-textarea {
  width: 100%;
  min-height: 112px;
  resize: vertical;
  border: 1px solid #f4b067;
  border-radius: 10px;
  background: #fff;
  color: #1f2937;
  padding: 12px 14px;
  font-size: 0.92rem;
  line-height: 1.5;
  outline: none;
  box-shadow: inset 0 0 0 1px rgba(251, 146, 60, 0.06);
}

.formula-textarea:focus {
  border-color: #f59e0b;
  box-shadow: 0 0 0 3px rgba(249, 115, 22, 0.1);
}
</style>
