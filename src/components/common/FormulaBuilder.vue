<script setup lang="ts">
import { computed, ref } from 'vue';
import { ArrowRightLeft, Check } from 'lucide-vue-next';

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

const activeTab = ref<'Biểu thức' | 'Công thức'>('Biểu thức');
const customNumberInput = ref('');

// Trạng thái chọn để hoán đổi (Swap)
const selectedFormulaIndex = ref<number | null>(null);
const selectedPaletteItem = ref<TokenItem | null>(null);
const swapSuccessToast = ref('');
let toastTimer: any = null;

// Quản lý lịch sử Hoàn tác (Undo) và Làm lại (Redo) thực sự
const historyStack = ref<string[]>([]);
const redoStack = ref<string[]>([]);

function recordHistory() {
  historyStack.value.push(formulaValue.value);
  if (historyStack.value.length > 50) {
    historyStack.value.shift();
  }
  redoStack.value = [];
}

function undo() {
  if (historyStack.value.length === 0) return;
  const previousState = historyStack.value.pop()!;
  redoStack.value.push(formulaValue.value);
  formulaValue.value = previousState;

  selectedFormulaIndex.value = null;
  selectedPaletteItem.value = null;
  showSwapSuccessToast('Đã hoàn tác thao tác trước!');
}

function redo() {
  if (redoStack.value.length === 0) return;
  const nextState = redoStack.value.pop()!;
  historyStack.value.push(formulaValue.value);
  formulaValue.value = nextState;

  selectedFormulaIndex.value = null;
  selectedPaletteItem.value = null;
  showSwapSuccessToast('Đã làm lại thao tác!');
}

function showSwapSuccessToast(msg: string = 'Đã hoán đổi vị trí thành công!') {
  swapSuccessToast.value = msg;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    swapSuccessToast.value = '';
  }, 2500);
}

function toggleSelectFormulaToken(index: number) {
  if (selectedFormulaIndex.value === index) {
    selectedFormulaIndex.value = null;
    selectedPaletteItem.value = null;
  } else {
    selectedFormulaIndex.value = index;
  }
}

function handlePaletteItemClick(item: TokenItem) {
  if (selectedFormulaIndex.value !== null) {
    // Nếu đang chọn 1 token trên công thức -> chọn phần tử này ở dưới để chuẩn bị SWAP
    if (selectedPaletteItem.value?.value === item.value) {
      selectedPaletteItem.value = null;
    } else {
      selectedPaletteItem.value = item;
    }
  } else {
    // Chưa chọn token trên công thức -> Thêm vào cuối như thông thường
    insertToken(item.value);
  }
}

function executeSwap() {
  if (selectedFormulaIndex.value === null || !selectedPaletteItem.value) return;

  const targetIndex = selectedFormulaIndex.value;
  const currentTokens = [...formulaTokens.value];
  if (targetIndex < 0 || targetIndex >= currentTokens.length) return;

  recordHistory();

  const oldTokenVal = currentTokens[targetIndex];
  const rawVal = selectedPaletteItem.value.value.trim();
  const mapped = legacyTokenMap[rawVal] || rawVal;

  if (mapped.includes(' ')) {
    const newTokens = tokenizeFormula(mapped);
    currentTokens.splice(targetIndex, 1, ...newTokens);
  } else {
    currentTokens[targetIndex] = mapped;
  }

  formulaValue.value = currentTokens.join(' ');
  selectedFormulaIndex.value = null;
  selectedPaletteItem.value = null;
  showSwapSuccessToast(`Đã đổi "${oldTokenVal}" thành "${mapped}" thành công!`);
}

function cancelSwapSelection() {
  selectedFormulaIndex.value = null;
  selectedPaletteItem.value = null;
}

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

const builderGroups: Record<'Biểu thức' | 'Công thức', BuilderGroup[]> = {
  'Biểu thức': [
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
    {
      title: 'BIẾN HÀNH TRÌNH THỰC TẾ CỦA XE',
      items: tripVariables,
    },
    {
      title: 'CÔNG THỨC MẪU GỢI Ý (NHẤN ĐỂ ÁP DỤNG NHANH)',
      items: sampleFormulas,
    },
  ],
  'Công thức': [
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
  ],
};

const tabItems = ['Biểu thức', 'Công thức'] as const;

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

  recordHistory();

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
  recordHistory();
  if (selectedFormulaIndex.value === index) {
    selectedFormulaIndex.value = null;
    selectedPaletteItem.value = null;
  } else if (selectedFormulaIndex.value !== null && selectedFormulaIndex.value > index) {
    selectedFormulaIndex.value -= 1;
  }
  const tokens = [...formulaTokens.value];
  tokens.splice(index, 1);
  formulaValue.value = tokens.join(' ');
}

function clearFormula() {
  if (!formulaValue.value) return;
  recordHistory();
  selectedFormulaIndex.value = null;
  selectedPaletteItem.value = null;
  formulaValue.value = '';
}

function insertCustomNumber() {
  const val = customNumberInput.value.trim();
  if (!val) return;
  if (selectedFormulaIndex.value !== null) {
    selectedPaletteItem.value = {
      label: val,
      value: val,
      description: 'Số/giá trị tùy chỉnh',
    };
    customNumberInput.value = '';
    return;
  }
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
          title="Hoàn tác thao tác vừa thực hiện"
          :disabled="historyStack.length === 0"
          @click="undo"
        >
          ↩ Hoàn tác
        </button>

        <button
          v-if="redoStack.length > 0"
          type="button"
          class="clear-button btn-redo"
          title="Làm lại thao tác vừa hoàn tác"
          @click="redo"
        >
          ↪ Làm lại
        </button>

        <button
          type="button"
          class="clear-button btn-clear-all"
          title="Xóa toàn bộ công thức"
          :disabled="!formulaValue"
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
              'is-selected': selectedFormulaIndex === index,
            }"
            :title="selectedFormulaIndex === index ? 'Đang chọn vị trí này (Bấm lại để bỏ chọn)' : 'Bấm để chọn vị trí này muốn sửa/hoán đổi'"
            @click="toggleSelectFormulaToken(index)"
          >
            <span>{{ token }}</span>
            <button
              type="button"
              class="formula-token-remove"
              :title="`Xóa ${token}`"
              @click.stop="removeToken(index)"
            >
              ×
            </button>
          </div>
        </div>

        <!-- Thanh hỗ trợ Hoán đổi (Swap) vị trí giữa chừng công thức -->
        <transition name="swap-fade">
          <div v-if="selectedFormulaIndex !== null" class="swap-action-banner">
            <div class="swap-meta-col">
              <div class="swap-flow-row">
                <div class="swap-pill-box pill-source">
                  <span class="swap-pill-title">Vị trí #{{ selectedFormulaIndex + 1 }} (Trên công thức)</span>
                  <span class="swap-token-val font-mono">{{ formulaTokens[selectedFormulaIndex] }}</span>
                </div>

                <div class="swap-direction-icon" :class="{ 'has-target': !!selectedPaletteItem }">
                  <ArrowRightLeft :size="16" />
                </div>

                <div class="swap-pill-box pill-target" :class="{ 'is-waiting': !selectedPaletteItem }">
                  <span class="swap-pill-title">Phần tử thay thế (Ở dưới danh mục)</span>
                  <span v-if="selectedPaletteItem" class="swap-token-val font-mono text-emerald-700">
                    {{ selectedPaletteItem.label || selectedPaletteItem.value }}
                  </span>
                  <span v-else class="swap-token-placeholder">
                    👈 Bấm chọn 1 phần tử ở bên dưới...
                  </span>
                </div>
              </div>
            </div>

            <div class="swap-btn-col">
              <button
                v-if="selectedPaletteItem"
                type="button"
                class="btn-execute-swap"
                title="Bấm để hoán đổi / thay thế phần tử đã chọn vào vị trí này"
                @click="executeSwap"
              >
                <ArrowRightLeft :size="15" />
                <span>Hoán Đổi (Swap)</span>
              </button>

              <button
                type="button"
                class="btn-cancel-selection"
                title="Hủy thao tác hoán đổi"
                @click="cancelSwapSelection"
              >
                ✕ Hủy chọn
              </button>
            </div>
          </div>
        </transition>

        <!-- Thông báo toast khi swap thành công -->
        <transition name="swap-fade">
          <div v-if="swapSuccessToast" class="swap-toast-alert">
            <Check :size="14" />
            <span>{{ swapSuccessToast }}</span>
          </div>
        </transition>
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
              :class="{
                'token-button-sample': item.badge?.includes('Mẫu'),
                'is-palette-selected': selectedPaletteItem?.value === item.value,
              }"
              :title="item.description"
              @click="handlePaletteItemClick(item)"
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
  cursor: pointer;
  user-select: none;
}

.formula-token:hover {
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
  border-color: #f59e0b;
}

.formula-token.is-selected {
  outline: 2px solid #2563eb !important;
  outline-offset: 2px;
  border-color: #3b82f6 !important;
  background: linear-gradient(180deg, #eff6ff 0%, #dbeafe 100%) !important;
  color: #1d4ed8 !important;
  box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.25), 0 4px 12px rgba(59, 130, 246, 0.2) !important;
  transform: translateY(-2px);
  z-index: 3;
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

.token-button.is-palette-selected {
  border-color: #10b981 !important;
  background: #ecfdf5 !important;
  color: #047857 !important;
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.25), 0 4px 12px rgba(16, 185, 129, 0.15) !important;
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

/* Swap Action Banner Styling */
.swap-action-banner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  background: linear-gradient(135deg, #f8fafc 0%, #f0fdf4 100%);
  border: 1.5px solid #86efac;
  border-radius: 10px;
  padding: 10px 14px;
  margin-top: 10px;
  box-shadow: 0 3px 10px rgba(16, 185, 129, 0.08);
  flex-wrap: wrap;
}

.swap-meta-col {
  flex: 1;
  min-width: 280px;
}

.swap-flow-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.swap-pill-box {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.swap-pill-title {
  font-size: 0.6875rem;
  font-weight: 700;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.swap-token-val {
  display: inline-block;
  font-weight: 800;
  font-size: 0.85rem;
  color: #1e40af;
  background: #ffffff;
  padding: 3px 10px;
  border-radius: 6px;
  border: 1px solid #bfdbfe;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}

.swap-token-placeholder {
  font-size: 0.8125rem;
  font-style: italic;
  color: #059669;
  font-weight: 600;
  background: #ecfdf5;
  padding: 3px 8px;
  border-radius: 6px;
  border: 1px dashed #6ee7b7;
}

.swap-direction-icon {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: #ffffff;
  border: 1px solid #cbd5e1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #94a3b8;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.swap-direction-icon.has-target {
  border-color: #10b981;
  color: #059669;
  background: #dcfce7;
  transform: scale(1.08);
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.2);
}

.swap-btn-col {
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn-execute-swap {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: linear-gradient(135deg, #059669 0%, #10b981 100%);
  color: #ffffff;
  border: none;
  font-weight: 800;
  font-size: 0.8125rem;
  padding: 8px 16px;
  border-radius: 8px;
  box-shadow: 0 3px 8px rgba(16, 185, 129, 0.3);
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-execute-swap:hover {
  transform: translateY(-1px);
  box-shadow: 0 5px 14px rgba(16, 185, 129, 0.45);
  background: linear-gradient(135deg, #047857 0%, #059669 100%);
}

.btn-cancel-selection {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: #ffffff;
  border: 1px solid #cbd5e1;
  color: #64748b;
  font-weight: 700;
  font-size: 0.75rem;
  padding: 7px 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-cancel-selection:hover {
  background: #f1f5f9;
  color: #0f172a;
  border-color: #94a3b8;
}

/* Toast alert */
.swap-toast-alert {
  display: flex;
  align-items: center;
  gap: 6px;
  background: #ecfdf5;
  color: #065f46;
  border: 1px solid #a7f3d0;
  font-size: 0.8125rem;
  font-weight: 700;
  padding: 6px 12px;
  border-radius: 8px;
  margin-top: 8px;
}

/* Transitions */
.swap-fade-enter-active,
.swap-fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.swap-fade-enter-from,
.swap-fade-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>
