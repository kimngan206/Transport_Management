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
    placeholder: 'Ví dụ: ( [Cự ly chuẩn] * [Định mức không tải (NLP)] ) + ( ( [Tổng tải trọng hàng] / 1000 ) * [Cự ly chuẩn] * [Định mức có tải (NLC)] )',
    label: 'Công Thức',
  }
);

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();

const activeTab = ref<'Hàm' | 'Công thức' | 'Biểu thức'>('Công thức');
const customNumberInput = ref('');

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

// Bảng ánh xạ các biến tiếng Anh cũ sang tiếng Việt có dấu ngoặc vuông để dễ đọc
const legacyTokenMap: Record<string, string> = {
  StandardDistanceKm: '[Cự ly chuẩn]',
  NLP: '[Định mức không tải (NLP)]',
  NLC: '[Định mức có tải (NLC)]',
  TotalWeightKg: '[Tổng tải trọng hàng]',
  StartHour: '[Giờ máy bắt đầu]',
  EndHour: '[Giờ máy kết thúc]',
  HourQuota: '[Định mức theo giờ máy]',
  ElectricNormPerKm: '[Định mức điện / km]',
  DistanceKm: '[Quãng đường thực tế]',
  StartOdo: '[Số ODO bắt đầu]',
  EndOdo: '[Số ODO kết thúc]',
  CurrentOdoKm: '[Số ODO hiện tại]',
};

// 1. Toán tử toán học
const mathOperators: TokenItem[] = [
  { label: '+ (Cộng)', value: '+', description: 'Phép cộng hai giá trị' },
  { label: '- (Trừ)', value: '-', description: 'Phép trừ hai giá trị' },
  { label: '× (Nhân)', value: '*', description: 'Phép nhân hai giá trị (*)' },
  { label: '÷ (Chia)', value: '/', description: 'Phép chia hai giá trị (/)' },
  { label: '( (Mở ngoặc)', value: '(', description: 'Mở ngoặc nhóm biểu thức tính trước' },
  { label: ') (Đóng ngoặc)', value: ')', description: 'Đóng ngoặc nhóm biểu thức' },
];

// 2. Các hàm tính toán
const functionItems: TokenItem[] = [
  { label: 'Trị tuyệt đối (ABS)', value: 'ABS()', badge: 'Hàm', description: 'Lấy giá trị dương tuyệt đối của một số hoặc biểu thức' },
  { label: 'Giá trị lớn nhất (MAX)', value: 'MAX()', badge: 'Hàm', description: 'Lấy giá trị lớn nhất trong các đối số truyền vào' },
  { label: 'Giá trị nhỏ nhất (MIN)', value: 'MIN()', badge: 'Hàm', description: 'Lấy giá trị nhỏ nhất trong các đối số truyền vào' },
  { label: 'Làm tròn số (ROUND)', value: 'ROUND()', badge: 'Hàm', description: 'Làm tròn số đến số chữ số thập phân mong muốn' },
  { label: 'Căn bậc hai (SQRT)', value: 'SQRT()', badge: 'Hàm', description: 'Lấy căn bậc hai của một số' },
];

// 3. Hằng số và quy đổi
const constantItems: TokenItem[] = [
  { label: '1000 (Kg ➔ Tấn)', value: '1000', badge: 'Quy đổi', description: 'Hằng số 1000 dùng để đổi khối lượng từ Kg sang Tấn' },
  { label: '100 (Tỷ lệ %)', value: '100', badge: '%', description: 'Hằng số 100 dùng để tính tỷ lệ phần trăm' },
  { label: '0', value: '0', badge: 'Số', description: 'Hằng số 0' },
  { label: '1', value: '1', badge: 'Số', description: 'Hằng số 1' },
];

// 4. Biến định mức xe tải
const truckQuotaItems: TokenItem[] = [
  { label: 'Cự ly quy chuẩn', value: '[Cự ly chuẩn]', badge: 'Km', description: 'Quãng đường quy chuẩn đã đo lường giữa các trạm/nông trường theo tuyến' },
  { label: 'Định mức không tải (NLP)', value: '[Định mức không tải (NLP)]', badge: 'L/km', description: 'Định mức tiêu hao nhiên liệu khi xe chạy không tải (Lít/km)' },
  { label: 'Định mức có tải (NLC)', value: '[Định mức có tải (NLC)]', badge: 'L/tấn.km', description: 'Định mức phụ trội khi xe chở hàng có tải (Lít/tấn.km)' },
  { label: 'Tổng tải trọng hàng', value: '[Tổng tải trọng hàng]', badge: 'Kg', description: 'Khối lượng mủ cao su hoặc hàng hóa vận chuyển thực tế (kg)' },
];

// 5. Biến định mức xe xúc / máy công trình
const excavatorItems: TokenItem[] = [
  { label: 'Giờ máy bắt đầu', value: '[Giờ máy bắt đầu]', badge: 'Giờ', description: 'Chỉ số đồng hồ giờ máy tại thời điểm bắt đầu làm việc' },
  { label: 'Giờ máy kết thúc', value: '[Giờ máy kết thúc]', badge: 'Giờ', description: 'Chỉ số đồng hồ giờ máy tại thời điểm hoàn thành ca' },
  { label: 'Định mức theo giờ máy', value: '[Định mức theo giờ máy]', badge: 'L/giờ', description: 'Định mức tiêu hao dầu cho 1 giờ máy hoạt động thực tế của máy xúc' },
];

// 6. Biến định mức xe điện & xe công tác
const electricItems: TokenItem[] = [
  { label: 'Định mức điện / km', value: '[Định mức điện / km]', badge: 'kWh/km', description: 'Định mức tiêu hao điện năng trung bình trên từng km di chuyển' },
  { label: 'Cự ly quy chuẩn', value: '[Cự ly chuẩn]', badge: 'Km', description: 'Quãng đường quy chuẩn giữa các điểm di chuyển' },
];

// 7. Hằng số định mức NLP & NLC thường dùng
const quotaConstants: TokenItem[] = [
  { label: 'NLP = 0.10 (L/km)', value: '0.1', badge: 'NLP', description: 'Hằng số định mức không tải NLP là 0.1 L/km' },
  { label: 'NLC = 0.22 (L/t.km)', value: '0.22', badge: 'NLC', description: 'Hằng số định mức có tải NLC là 0.22 L/tấn.km' },
  { label: 'NLP = 0.25 (L/km)', value: '0.25', badge: 'NLP bồn', description: 'Hằng số định mức không tải NLP thông dụng xe bồn 0.25 L/km' },
  { label: 'NLC = 0.02 (L/t.km)', value: '0.02', badge: 'NLC bồn', description: 'Hằng số định mức có tải NLC thông dụng xe bồn 0.02 L/tấn.km' },
];

// 8. Biến hành trình thực tế
const tripVariables: TokenItem[] = [
  { label: 'Quãng đường thực tế', value: '[Quãng đường thực tế]', badge: 'Km', description: 'Quãng đường xe chạy thực tế trong chuyến đi (ODO kết thúc - ODO bắt đầu)' },
  { label: 'Số ODO bắt đầu', value: '[Số ODO bắt đầu]', badge: 'Km', description: 'Chỉ số công-tơ-mét (ODO) khi xe xuất bến' },
  { label: 'Số ODO kết thúc', value: '[Số ODO kết thúc]', badge: 'Km', description: 'Chỉ số công-tơ-mét (ODO) khi xe hoàn thành chuyến về bến' },
  { label: 'Số ODO hiện tại', value: '[Số ODO hiện tại]', badge: 'Km', description: 'Chỉ số công-tơ-mét (ODO) hiện tại ghi nhận trên xe' },
];

// 9. Các công thức mẫu sẵn
const sampleFormulas: TokenItem[] = [
  {
    label: 'Mẫu xe tải (NLP 0.1 & NLC 0.22): (Cự ly × 0.1) + ((Hàng/1000) × Cự ly × 0.22)',
    value: '( [Cự ly chuẩn] * 0.1 ) + ( ( [Tổng tải trọng hàng] / 1000 ) * [Cự ly chuẩn] * 0.22 )',
    badge: 'Cố định 0.1 & 0.22',
    description: 'Áp dụng công thức xe tải chở mủ với hằng số cụ thể NLP = 0.1 và NLC = 0.22',
  },
  {
    label: 'Mẫu xe tải (Tham chiếu biến NLP & NLC): (Cự ly × NLP) + ((Hàng/1000) × Cự ly × NLC)',
    value: '( [Cự ly chuẩn] * [Định mức không tải (NLP)] ) + ( ( [Tổng tải trọng hàng] / 1000 ) * [Cự ly chuẩn] * [Định mức có tải (NLC)] )',
    badge: 'Mẫu xe tải',
    description: 'Áp dụng công thức định mức tiêu chuẩn tự động lấy NLP và NLC đã cấu hình của xe',
  },
  {
    label: 'Mẫu máy xúc: (Giờ kết thúc - Giờ bắt đầu) × Định mức giờ',
    value: '( [Giờ máy kết thúc] - [Giờ máy bắt đầu] ) * [Định mức theo giờ máy]',
    badge: 'Mẫu máy xúc',
    description: 'Áp dụng công thức định mức tiêu hao dầu theo giờ máy thực tế',
  },
  {
    label: 'Mẫu xe điện: Cự ly chuẩn × Định mức điện / km',
    value: '[Cự ly chuẩn] * [Định mức điện / km]',
    badge: 'Mẫu xe điện',
    description: 'Áp dụng công thức định mức điện cho ô tô điện',
  },
  {
    label: 'Mẫu xe công tác: Quãng đường thực tế × Định mức không tải',
    value: '[Quãng đường thực tế] * [Định mức không tải (NLP)]',
    badge: 'Mẫu xe công tác',
    description: 'Áp dụng công thức tính nhiên liệu xe bán tải theo km thực tế',
  },
];

const builderGroups: Record<string, BuilderGroup[]> = {
  Hàm: [
    {
      title: 'HÀM TOÁN HỌC PHỔ BIẾN',
      items: functionItems,
    },
    {
      title: 'TOÁN TỬ & DẤU NGOẶC',
      items: mathOperators,
    },
    {
      title: 'HẰNG SỐ & QUY ĐỔI',
      items: constantItems,
    },
  ],
  'Công thức': [
    {
      title: 'ĐỊNH MỨC XE TẢI & XE BỒN CHỞ MỦ',
      items: truckQuotaItems,
    },
    {
      title: 'HẰNG SỐ ĐỊNH MỨC NLP & NLC THƯỜNG DÙNG',
      items: quotaConstants,
    },
    {
      title: 'ĐỊNH MỨC XE XÚC & MÁY CÔNG TRÌNH',
      items: excavatorItems,
    },
    {
      title: 'ĐỊNH MỨC XE ĐIỆN & XE CÔNG TÁC',
      items: electricItems,
    },
    {
      title: 'TOÁN TỬ & DẤU NGOẶC',
      items: mathOperators,
    },
    {
      title: 'HÀM TOÁN HỌC',
      items: functionItems,
    },
    {
      title: 'HẰNG SỐ QUY ĐỔI',
      items: constantItems,
    },
  ],
  'Biểu thức': [
    {
      title: 'BIẾN HÀNH TRÌNH THỰC TẾ CỦA XE',
      items: tripVariables,
    },
    {
      title: 'CÔNG THỨC MẪU GỢI Ý (NHẤN ĐỂ ÁP DỤNG NHANH)',
      items: sampleFormulas,
    },
    {
      title: 'TOÁN TỬ & DẤU NGOẶC',
      items: mathOperators,
    },
    {
      title: 'HÀM TOÁN HỌC',
      items: functionItems,
    },
    {
      title: 'HẰNG SỐ QUY ĐỔI',
      items: constantItems,
    },
  ],
};

const tabItems = ['Hàm', 'Công thức', 'Biểu thức'] as const;

function tokenizeFormula(formula: string): string[] {
  if (!formula || !formula.trim()) return [];
  const regex = /\[[^\]]+\]|[A-Za-zÀ-ỹ0-9_]+\(\)|[+\-*/()]|\d+(?:\.\d+)?|[^\s+\-*/()]+/g;
  const matches = formula.match(regex) || [];
  return matches.map((token) => legacyTokenMap[token] || token);
}

const formulaTokens = computed(() => {
  return tokenizeFormula(formulaValue.value || '');
});

function insertToken(token: string) {
  const normalized = token.trim();
  if (!normalized) return;

  // Nếu là công thức mẫu nhiều phần tử
  if (normalized.includes(' ')) {
    const newTokens = tokenizeFormula(normalized);
    const currentTokens = [...formulaTokens.value];
    formulaValue.value = [...currentTokens, ...newTokens].join(' ');
    return;
  }

  const mapped = legacyTokenMap[normalized] || normalized;
  const currentTokens = [...formulaTokens.value];
  currentTokens.push(mapped);
  formulaValue.value = currentTokens.join(' ');
}

function removeToken(index: number) {
  const tokens = [...formulaTokens.value];
  tokens.splice(index, 1);
  formulaValue.value = tokens.join(' ');
}

function undoLastToken() {
  const tokens = [...formulaTokens.value];
  if (tokens.length > 0) {
    tokens.pop();
    formulaValue.value = tokens.join(' ');
  }
}

function clearFormula() {
  formulaValue.value = '';
}

function insertCustomNumber() {
  const val = customNumberInput.value.trim();
  if (!val) return;
  insertToken(val);
  customNumberInput.value = '';
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

      <div class="header-actions">
        <div class="quick-input-box">
          <input
            v-model="customNumberInput"
            type="text"
            class="custom-number-field"
            placeholder="Nhập số/giá trị..."
            @keyup.enter="insertCustomNumber"
          />
          <button
            type="button"
            class="btn-quick-add"
            title="Thêm số hoặc giá trị tùy ý vào công thức"
            @click="insertCustomNumber"
          >
            + Thêm
          </button>
        </div>

        <button
          type="button"
          class="clear-button btn-undo"
          title="Xóa phần tử vừa thêm cuối cùng"
          :disabled="formulaTokens.length === 0"
          @click="undoLastToken"
        >
          ↩ Hoàn tác
        </button>

        <button
          type="button"
          class="clear-button btn-clear-all"
          title="Xóa toàn bộ công thức"
          @click="clearFormula"
        >
          Xóa hết
        </button>
      </div>
    </div>

    <div class="formula-builder-body">
      <div class="formula-input-wrap">
        <label class="formula-label">{{ label }}</label>

        <div class="formula-preview" aria-label="Công thức đang chọn">
          <div v-if="formulaTokens.length === 0" class="formula-empty-hint">
            Chưa có phần tử nào trong công thức. Nhấn vào các phần tử bên dưới để ghép công thức.
          </div>

          <div
            v-for="(token, index) in formulaTokens"
            :key="`${token}-${index}`"
            class="formula-token"
            :class="{
              'token-operator': ['+', '-', '*', '/', '(', ')'].includes(token),
              'token-function': token.endsWith('()'),
              'token-variable': token.startsWith('[') && token.endsWith(']'),
              'token-number': !isNaN(Number(token)),
            }"
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
              :class="{ 'token-button-sample': item.badge?.includes('Mẫu') }"
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
  max-height: 58vh;
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
  padding: 10px 14px;
  flex-wrap: wrap;
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
  padding: 6px 16px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 0.86rem;
}

.tab-button.active {
  background: linear-gradient(135deg, #f59e0b 0%, #f97316 100%);
  color: #fff;
  border-color: #ea580c;
  box-shadow: 0 6px 16px rgba(249, 115, 22, 0.2);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.quick-input-box {
  display: flex;
  align-items: center;
  background: #fff;
  border: 1px solid #f4b067;
  border-radius: 8px;
  overflow: hidden;
}

.custom-number-field {
  border: none;
  outline: none;
  padding: 5px 8px;
  font-size: 0.8rem;
  width: 120px;
  background: transparent;
  color: #1f2937;
}

.btn-quick-add {
  border: none;
  background: #ffedd5;
  color: #b45309;
  font-size: 0.78rem;
  font-weight: 700;
  padding: 5px 10px;
  cursor: pointer;
  transition: background 0.15s ease;
}

.btn-quick-add:hover {
  background: #fed7aa;
}

.clear-button {
  border: 1px solid #f4b067;
  background: #fff;
  color: #b45309;
  border-radius: 8px;
  padding: 5px 12px;
  font-weight: 700;
  font-size: 0.82rem;
  cursor: pointer;
  transition: all 0.15s ease;
}

.clear-button:hover:not(:disabled) {
  background: #fff3e5;
  border-color: #ea580c;
}

.clear-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-clear-all {
  color: #dc2626;
  border-color: #fca5a5;
}

.btn-clear-all:hover {
  background: #fee2e2;
  border-color: #ef4444;
}

.formula-builder-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
}

.formula-input-wrap {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.formula-label {
  font-size: 0.84rem;
  font-weight: 800;
  color: #7c2d12;
}

.formula-preview {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  min-height: 48px;
  padding: 10px 12px;
  border: 1px solid #f4b067;
  border-radius: 10px;
  background: #fff;
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.04);
}

.formula-empty-hint {
  font-size: 0.82rem;
  color: #9ca3af;
  font-style: italic;
}

.formula-token {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 32px;
  padding: 5px 12px;
  border-radius: 8px;
  border: 1px solid #f4b067;
  background: linear-gradient(180deg, #fff 0%, #fff4e8 100%);
  color: #7c2d12;
  font-weight: 700;
  font-size: 0.85rem;
  box-shadow: 0 1px 3px rgba(249, 115, 22, 0.08);
  transition: all 0.15s ease;
  cursor: default;
}

.formula-token:hover {
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
}

.formula-token.token-variable {
  background: linear-gradient(180deg, #eff6ff 0%, #dbeafe 100%);
  border-color: #93c5fd;
  color: #1e40af;
}

.formula-token.token-operator {
  background: #f3f4f6;
  border-color: #d1d5db;
  color: #374151;
  font-weight: 800;
  min-width: 28px;
  padding: 5px 10px;
}

.formula-token.token-function {
  background: linear-gradient(180deg, #fdf4ff 0%, #fae8ff 100%);
  border-color: #f0abfc;
  color: #86198f;
}

.formula-token.token-number {
  background: linear-gradient(180deg, #f0fdf4 0%, #dcfce7 100%);
  border-color: #86efac;
  color: #166534;
}

.formula-token-remove {
  position: absolute;
  top: -6px;
  right: -6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border: 1.5px solid #ffffff;
  border-radius: 50%;
  background: #ef4444;
  color: #fff;
  font-size: 0.75rem;
  font-weight: 700;
  line-height: 1;
  cursor: pointer;
  padding: 0;
  box-shadow: 0 2px 4px rgba(239, 68, 68, 0.35);
  opacity: 0;
  visibility: hidden;
  transform: scale(0.6);
  pointer-events: none;
  transition: opacity 0.15s ease, transform 0.15s ease, visibility 0.15s ease, background 0.15s ease;
  z-index: 2;
}

.formula-token:hover .formula-token-remove,
.formula-token:focus-within .formula-token-remove {
  opacity: 1;
  visibility: visible;
  transform: scale(1);
  pointer-events: auto;
}

.formula-token-remove:hover {
  transform: scale(1.2) !important;
  background: #dc2626;
}

.token-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
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
  min-height: 32px;
  padding: 6px 12px;
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
  box-shadow: 0 6px 14px rgba(249, 115, 22, 0.14);
  transform: translateY(-1px);
}

.token-button.token-button-sample {
  background: linear-gradient(180deg, #f0fdf4 0%, #dcfce7 100%);
  border-color: #86efac;
  color: #166534;
}

.token-button.token-button-sample:hover {
  border-color: #22c55e;
  box-shadow: 0 6px 14px rgba(34, 197, 94, 0.16);
}

.token-button-label {
  font-size: 0.84rem;
}

.token-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  padding: 2px 6px;
  border-radius: 999px;
  background: #ffedd5;
  color: #b45309;
  font-size: 0.65rem;
  font-weight: 800;
}

.token-button-sample .token-badge {
  background: #bbf7d0;
  color: #14532d;
}
</style>
