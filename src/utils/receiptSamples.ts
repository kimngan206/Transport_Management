/**
 * Bộ mẫu bằng chứng / hóa đơn xác minh chi phí chuyến đi cho tài xế
 * Cung cấp SVG Data URL chuẩn nghiệp vụ Việt Nam (Xăng dầu Petrolimex, Vé BOT ĐT741, Phiếu cân mủ, Sửa chữa xe)
 */

function svgToDataUrl(svgString: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svgString.trim())}`;
}

// 1. Hóa đơn Xăng Dầu Petrolimex
export function getPetrolimexReceiptSample(plate = '51C-889.26', amount = '850.000 đ', liters = '45.2 Lít'): string {
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="400" height="520" viewBox="0 0 400 520">
    <rect width="400" height="520" fill="#ffffff" stroke="#cbd5e1" stroke-width="2" rx="8"/>
    <!-- Header Petrolimex -->
    <rect width="400" height="70" fill="#ea580c" rx="8" />
    <rect y="60" width="400" height="10" fill="#ea580c" />
    <text x="200" y="32" font-family="Arial, sans-serif" font-size="16" font-weight="bold" fill="#ffffff" text-anchor="middle">TẬP ĐOÀN XĂNG DẦU VIỆT NAM</text>
    <text x="200" y="52" font-family="Arial, sans-serif" font-size="13" font-weight="bold" fill="#fef08a" text-anchor="middle">PETROLIMEX - CỬA HÀNG SỐ 12</text>
    
    <!-- Title -->
    <text x="200" y="105" font-family="Arial, sans-serif" font-size="15" font-weight="bold" fill="#0f172a" text-anchor="middle">HÓA ĐƠN ĐIỆN TỬ BÁN LẺ XĂNG DẦU</text>
    <text x="200" y="125" font-family="Arial, sans-serif" font-size="11" fill="#64748b" text-anchor="middle">Ký hiệu: 1C26TPL - Số HĐ: 0048291</text>
    <line x1="30" y1="140" x2="370" y2="140" stroke="#cbd5e1" stroke-dasharray="4 4" stroke-width="1.5"/>

    <!-- Metadata -->
    <text x="35" y="165" font-family="Arial, sans-serif" font-size="12" fill="#475569">Thời gian:</text>
    <text x="365" y="165" font-family="Arial, sans-serif" font-size="12" font-weight="bold" fill="#0f172a" text-anchor="end">2026-09-07 14:15:22</text>

    <text x="35" y="190" font-family="Arial, sans-serif" font-size="12" fill="#475569">Biển số phương tiện:</text>
    <text x="365" y="190" font-family="Arial, sans-serif" font-size="13" font-weight="bold" fill="#0369a1" text-anchor="end">${plate}</text>

    <text x="35" y="215" font-family="Arial, sans-serif" font-size="12" fill="#475569">Vòi bơm / Trụ bơm:</text>
    <text x="365" y="215" font-family="Arial, sans-serif" font-size="12" fill="#0f172a" text-anchor="end">Trụ số 03 (Vòi Dầu DO 0.05S-II)</text>

    <line x1="30" y1="235" x2="370" y2="235" stroke="#cbd5e1" stroke-width="1"/>

    <!-- Items -->
    <text x="35" y="260" font-family="Arial, sans-serif" font-size="12" font-weight="bold" fill="#334155">Mặt hàng: Dầu Đi-ê-zen (DO 0.05S)</text>
    
    <text x="35" y="285" font-family="Arial, sans-serif" font-size="12" fill="#475569">Số lượng bơm:</text>
    <text x="365" y="285" font-family="Arial, sans-serif" font-size="13" font-weight="bold" fill="#0f172a" text-anchor="end">${liters}</text>

    <text x="35" y="310" font-family="Arial, sans-serif" font-size="12" fill="#475569">Đơn giá (đã có VAT):</text>
    <text x="365" y="310" font-family="Arial, sans-serif" font-size="12" fill="#0f172a" text-anchor="end">18.800 đ/Lít</text>

    <line x1="30" y1="330" x2="370" y2="330" stroke="#cbd5e1" stroke-width="1.5"/>

    <!-- Total -->
    <rect x="30" y="345" width="340" height="50" fill="#f8fafc" stroke="#e2e8f0" rx="6"/>
    <text x="45" y="375" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="#0f172a">TỔNG THANH TOÁN:</text>
    <text x="355" y="377" font-family="Arial, sans-serif" font-size="18" font-weight="bold" fill="#ea580c" text-anchor="end">${amount}</text>

    <!-- Footer Seal -->
    <text x="200" y="425" font-family="Arial, sans-serif" font-size="11" fill="#64748b" text-anchor="middle">Hình thức thanh toán: Thẻ đội xe / Tiền mặt</text>
    <text x="200" y="445" font-family="Arial, sans-serif" font-size="11" fill="#16a34a" font-weight="bold" text-anchor="middle">✓ ĐÃ XÁC THỰC HÓA ĐƠN ĐIỆN TỬ HỢP LỆ</text>
    <rect x="130" y="460" width="140" height="35" fill="#f0fdf4" stroke="#86efac" rx="4"/>
    <text x="200" y="482" font-family="Arial, sans-serif" font-size="11" font-weight="bold" fill="#15803d" text-anchor="middle">[ ĐÃ THANH TOÁN ]</text>
  </svg>
  `;
  return svgToDataUrl(svg);
}

// 2. Vé Thu Phí Cầu Đường BOT (Toll Ticket)
export function getTollReceiptSample(plate = '51C-889.26', amount = '35.000 đ', stationName = 'Trạm Thu Phí ĐT741 - Đồng Phú'): string {
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="400" height="420" viewBox="0 0 400 420">
    <rect width="400" height="420" fill="#ffffff" stroke="#0284c7" stroke-width="2" rx="8"/>
    <!-- Header BOT -->
    <rect width="400" height="65" fill="#0284c7" rx="8" />
    <rect y="55" width="400" height="10" fill="#0284c7" />
    <text x="200" y="28" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="#ffffff" text-anchor="middle">CÔNG TY CỔ PHẦN BOT ĐƯỜNG BỘ</text>
    <text x="200" y="48" font-family="Arial, sans-serif" font-size="12" fill="#e0f2fe" text-anchor="middle">${stationName}</text>
    
    <!-- Title -->
    <text x="200" y="98" font-family="Arial, sans-serif" font-size="16" font-weight="bold" fill="#0369a1" text-anchor="middle">VÉ SỬ DỤNG ĐƯỜNG BỘ</text>
    <text x="200" y="118" font-family="Arial, sans-serif" font-size="11" fill="#64748b" text-anchor="middle">Mẫu vé số: 01VE/BOT - Số: AB/26-094182</text>
    <line x1="30" y1="135" x2="370" y2="135" stroke="#cbd5e1" stroke-dasharray="4 4" stroke-width="1.5"/>

    <!-- Metadata -->
    <text x="35" y="165" font-family="Arial, sans-serif" font-size="12" fill="#475569">Làn thu phí / Ca:</text>
    <text x="365" y="165" font-family="Arial, sans-serif" font-size="12" font-weight="bold" fill="#0f172a" text-anchor="end">Làn 02 (ETC/Tự động) - Ca 2</text>

    <text x="35" y="195" font-family="Arial, sans-serif" font-size="12" fill="#475569">Thời gian qua trạm:</text>
    <text x="365" y="195" font-family="Arial, sans-serif" font-size="12" font-weight="bold" fill="#0f172a" text-anchor="end">2026-09-07 14:02:18</text>

    <text x="35" y="225" font-family="Arial, sans-serif" font-size="12" fill="#475569">Biển số xe nhận diện:</text>
    <text x="365" y="225" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="#0284c7" text-anchor="end">${plate}</text>

    <text x="35" y="255" font-family="Arial, sans-serif" font-size="12" fill="#475569">Loại phương tiện:</text>
    <text x="365" y="255" font-family="Arial, sans-serif" font-size="12" fill="#0f172a" text-anchor="end">Xe tải tải trọng từ 4 đến 10 tấn (Loại 2)</text>

    <line x1="30" y1="275" x2="370" y2="275" stroke="#0284c7" stroke-width="1.5"/>

    <!-- Price -->
    <rect x="30" y="290" width="340" height="50" fill="#f0f9ff" stroke="#bae6fd" rx="6"/>
    <text x="45" y="320" font-family="Arial, sans-serif" font-size="13" font-weight="bold" fill="#0369a1">MỆNH GIÁ VÉ:</text>
    <text x="355" y="322" font-family="Arial, sans-serif" font-size="20" font-weight="bold" fill="#0284c7" text-anchor="end">${amount}</text>

    <!-- Barcode simulation -->
    <rect x="80" y="360" width="240" height="24" fill="#0f172a"/>
    <text x="200" y="400" font-family="monospace" font-size="11" fill="#475569" text-anchor="middle">||| | || |||| | | ||| ||||| 260907001 |||</text>
  </svg>
  `;
  return svgToDataUrl(svg);
}

// 3. Phiếu Cân Mủ Cao Su / Bến Bãi (Weigh Ticket)
export function getWeighStationReceiptSample(plate = '51C-889.26', netWeight = '4.800 kg mủ', fee = '50.000 đ'): string {
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="400" height="460" viewBox="0 0 400 460">
    <rect width="400" height="460" fill="#ffffff" stroke="#16a34a" stroke-width="2" rx="8"/>
    <!-- Header -->
    <rect width="400" height="65" fill="#15803d" rx="8" />
    <rect y="55" width="400" height="10" fill="#15803d" />
    <text x="200" y="28" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="#ffffff" text-anchor="middle">TRẠM CÂN ĐIỆN TỬ NÔNG TRƯỜNG</text>
    <text x="200" y="48" font-family="Arial, sans-serif" font-size="12" fill="#dcfce7" text-anchor="middle">TRẠM CÂN TIẾP NHẬN TC1 - ECOTECH 2A</text>

    <!-- Title -->
    <text x="200" y="98" font-family="Arial, sans-serif" font-size="16" font-weight="bold" fill="#15803d" text-anchor="middle">PHIẾU CÂN XE & DỊCH VỤ BẾN CÂN</text>
    <text x="200" y="118" font-family="Arial, sans-serif" font-size="11" fill="#64748b" text-anchor="middle">Mã phiếu cân: PC-260907-TC1 - Cân điện tử 60 Tấn</text>
    <line x1="30" y1="135" x2="370" y2="135" stroke="#cbd5e1" stroke-dasharray="4 4" stroke-width="1.5"/>

    <text x="35" y="165" font-family="Arial, sans-serif" font-size="12" fill="#475569">Biển số phương tiện:</text>
    <text x="365" y="165" font-family="Arial, sans-serif" font-size="13" font-weight="bold" fill="#15803d" text-anchor="end">${plate}</text>

    <text x="35" y="195" font-family="Arial, sans-serif" font-size="12" fill="#475569">Hàng hóa vận chuyển:</text>
    <text x="365" y="195" font-family="Arial, sans-serif" font-size="12" font-weight="bold" fill="#0f172a" text-anchor="end">Mủ nước cao su Đội 1</text>

    <text x="35" y="225" font-family="Arial, sans-serif" font-size="12" fill="#475569">Khối lượng tổng (Gross):</text>
    <text x="365" y="225" font-family="Arial, sans-serif" font-size="12" fill="#0f172a" text-anchor="end">9.820 kg</text>

    <text x="35" y="255" font-family="Arial, sans-serif" font-size="12" fill="#475569">Khối lượng xe bì (Tare):</text>
    <text x="365" y="255" font-family="Arial, sans-serif" font-size="12" fill="#0f172a" text-anchor="end">5.020 kg</text>

    <line x1="30" y1="275" x2="370" y2="275" stroke="#cbd5e1" stroke-width="1"/>

    <text x="35" y="300" font-family="Arial, sans-serif" font-size="13" font-weight="bold" fill="#15803d">Khối lượng mủ thực tế (Net):</text>
    <text x="365" y="300" font-family="Arial, sans-serif" font-size="15" font-weight="bold" fill="#15803d" text-anchor="end">${netWeight}</text>

    <!-- Fee -->
    <rect x="30" y="325" width="340" height="50" fill="#f0fdf4" stroke="#86efac" rx="6"/>
    <text x="45" y="355" font-family="Arial, sans-serif" font-size="13" font-weight="bold" fill="#166534">PHÍ DỊCH VỤ CÂN XE:</text>
    <text x="355" y="357" font-family="Arial, sans-serif" font-size="18" font-weight="bold" fill="#15803d" text-anchor="end">${fee}</text>

    <text x="200" y="415" font-family="Arial, sans-serif" font-size="11" fill="#64748b" text-anchor="middle">Nhân viên bàn cân: Nguyễn Thị Lan (Đã ký số)</text>
    <text x="200" y="435" font-family="Arial, sans-serif" font-size="11" fill="#15803d" font-weight="bold" text-anchor="middle">✓ BẰNG CHỨNG HỢP LỆ THEO QUY ĐỊNH NÔNG TRƯỜNG</text>
  </svg>
  `;
  return svgToDataUrl(svg);
}

// 4. Hóa Đơn Sửa Chữa Nhanh / Vá Vỏ Dọc Đường (Repair Invoice)
export function getRepairReceiptSample(plate = '51C-889.26', amount = '150.000 đ', item = 'Vá lốp xe tải 5 tấn lưu động + Thay van vòi'): string {
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="400" height="440" viewBox="0 0 400 440">
    <rect width="400" height="440" fill="#ffffff" stroke="#b91c1c" stroke-width="2" rx="8"/>
    <!-- Header -->
    <rect width="400" height="65" fill="#dc2626" rx="8" />
    <rect y="55" width="400" height="10" fill="#dc2626" />
    <text x="200" y="28" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="#ffffff" text-anchor="middle">GARAGE CỨU HỘ VÀ SỬA CHỮA LỐP</text>
    <text x="200" y="48" font-family="Arial, sans-serif" font-size="12" fill="#fee2e2" text-anchor="middle">TIỆM VÁ VỎ XE LƯU ĐỘNG TÂN KHAI</text>

    <!-- Title -->
    <text x="200" y="98" font-family="Arial, sans-serif" font-size="16" font-weight="bold" fill="#dc2626" text-anchor="middle">BIÊN BẢN SỬA CHỮA & THU TIỀN</text>
    <text x="200" y="118" font-family="Arial, sans-serif" font-size="11" fill="#64748b" text-anchor="middle">Số phiếu: SC-2609-082 - Dịch vụ xử lý sự cố khẩn cấp</text>
    <line x1="30" y1="135" x2="370" y2="135" stroke="#cbd5e1" stroke-dasharray="4 4" stroke-width="1.5"/>

    <text x="35" y="165" font-family="Arial, sans-serif" font-size="12" fill="#475569">Xe sửa chữa:</text>
    <text x="365" y="165" font-family="Arial, sans-serif" font-size="13" font-weight="bold" fill="#dc2626" text-anchor="end">${plate}</text>

    <text x="35" y="195" font-family="Arial, sans-serif" font-size="12" fill="#475569">Địa điểm xử lý:</text>
    <text x="365" y="195" font-family="Arial, sans-serif" font-size="12" fill="#0f172a" text-anchor="end">Km14 Đường liên nông trường</text>

    <text x="35" y="225" font-family="Arial, sans-serif" font-size="12" fill="#475569">Nội dung khắc phục:</text>
    <text x="35" y="245" font-family="Arial, sans-serif" font-size="12" font-weight="bold" fill="#0f172a">${item}</text>

    <line x1="30" y1="270" x2="370" y2="270" stroke="#cbd5e1" stroke-width="1"/>

    <text x="35" y="295" font-family="Arial, sans-serif" font-size="12" fill="#475569">Thời gian hoàn tất:</text>
    <text x="365" y="295" font-family="Arial, sans-serif" font-size="12" fill="#0f172a" text-anchor="end">2026-09-07 15:40</text>

    <!-- Total -->
    <rect x="30" y="320" width="340" height="50" fill="#fef2f2" stroke="#fecaca" rx="6"/>
    <text x="45" y="350" font-family="Arial, sans-serif" font-size="13" font-weight="bold" fill="#991b1b">TIỀN CÔNG & VẬT TƯ:</text>
    <text x="355" y="352" font-family="Arial, sans-serif" font-size="18" font-weight="bold" fill="#dc2626" text-anchor="end">${amount}</text>

    <text x="200" y="405" font-family="Arial, sans-serif" font-size="11" fill="#64748b" text-anchor="middle">Thợ kỹ thuật: Bùi Văn Sửa (0971.234.567)</text>
    <text x="200" y="425" font-family="Arial, sans-serif" font-size="11" fill="#16a34a" font-weight="bold" text-anchor="middle">✓ ĐÃ THU ĐỦ TIỀN MẶT TẠI CHỖ</text>
  </svg>
  `;
  return svgToDataUrl(svg);
}
