1. Sau khi tài xế hoàn thành chuyến — nơi kích hoạt rule

Ở màn hình Chi tiết chuyến / Kết thúc chuyến:

Tài xế
  ↓
INPROGRESS
  ↓
Nhập ODO cuối
  ↓
[Hoàn thành chuyến]
  ↓
Hệ thống kiểm tra BR-011

Hệ thống tính:

ODO hiện tại - ODO bảo dưỡng gần nhất

Nếu:

>= 5.000 km

→ tự động chuyển trạng thái cảnh báo xe thành:

MAINTENANCE_NEED

và tạo thông báo cho Dispatcher.

2. Dispatcher nhìn thấy ở Dashboard — ⭐ nên có

Đây là nơi thể hiện rõ nhất yêu cầu "tự động cảnh báo bảo dưỡng xe".

Ví dụ:

DASHBOARD
────────────────────────────────────

🚨 CẢNH BÁO ĐỘI XE

⚠ 3 xe cần bảo dưỡng

┌─────────────────────────────────────┐
│ 🚛 51C-1726                         │
│ Đã chạy: 5.240 km từ lần bảo dưỡng │
│ Trạng thái: CẦN BẢO DƯỠNG          │
│                                     │
│ [Xem xe] [Tạo lịch bảo dưỡng]      │
└─────────────────────────────────────┘

Đồng thời ở icon thông báo:

🔔 Thông báo (3)

⚠ Xe 51C-1726 đã đến hạn bảo dưỡng
⚠ Xe 51C-xxxx đã đến hạn bảo dưỡng
⚠ Xe xúc XX-01 đã đến hạn bảo dưỡng
3. Trong Đội xe → Danh sách xe

Đây là nơi lưu và hiển thị trạng thái hiện tại của xe.

Ví dụ:

Biển số	Loại xe	ODO hiện tại	ODO BH gần nhất	Km đã chạy	Trạng thái
51C-1726	Xe tải	125.240	120.000	5.240	🔴 Cần bảo dưỡng
51C-1727	Xe tải	98.200	95.000	3.200	🟢 Bình thường

Như vậy Dispatcher mở:

Đội xe → Danh sách xe

là thấy ngay xe nào đang cần bảo dưỡng.

4. Trong Đội xe → Chi tiết xe

Khi click vào xe:

XE 51C-1726
────────────────────────

Trạng thái
🔴 CẦN BẢO DƯỠNG

ODO hiện tại
125.240 km

ODO bảo dưỡng gần nhất
120.000 km

Đã chạy từ lần bảo dưỡng
5.240 km

Ngưỡng bảo dưỡng
5.000 km

⚠ Đã vượt ngưỡng 240 km

Lịch sử bảo dưỡng
────────────────────
01/02/2026   120.000 km
...

Đây là nơi rất phù hợp để giải thích tại sao hệ thống cảnh báo.

5. Trong Bảo dưỡng → Danh sách cần bảo dưỡng

Rule BR-011 cũng phải tạo ra dữ liệu cho module:

BẢO DƯỠNG
├── Cần bảo dưỡng       ← ⭐
├── Lịch bảo dưỡng
├── Phiếu bảo dưỡng
└── Lịch sử bảo dưỡng

Ví dụ:

┌──────────┬──────────────┬───────────┬─────────────┐
│ Biển số  │ ODO hiện tại │ ODO BH    │ Trạng thái  │
├──────────┼──────────────┼───────────┼─────────────┤
│ 51C-1726 │ 125.240      │ 120.000   │ Cần BH      │
│ 51C-1728 │ 110.050      │ 105.000   │ Cần BH      │
└──────────┴──────────────┴───────────┴─────────────┘
6. Quan trọng: BR-011 không phải là một chức năng riêng

Tôi khuyên bạn không tạo menu kiểu:

❌ Cảnh báo bảo dưỡng

mà nên xem nó là Business Rule chạy tự động xuyên suốt hệ thống.

Luồng chính xác:

                    TÀI XẾ
                       │
                       ▼
                Hoàn thành chuyến
                       │
                       ▼
                  Nhập ODO cuối
                       │
                       ▼
          ┌─────────────────────────┐
          │       BR-011            │
          │                         │
          │ ODO hiện tại            │
          │ - ODO bảo dưỡng gần nhất│
          │ >= 5.000 km ?           │
          └────────────┬────────────┘
                       │
                Có     │
                       ▼
             MAINTENANCE_NEED
                       │
            ┌──────────┼──────────┐
            ▼          ▼          ▼
        Dashboard   Đội xe     Thông báo
                                  │
                                  ▼
                              Dispatcher
                                  │
                                  ▼
                         Tạo lịch bảo dưỡng
7. Có một điểm tôi muốn sửa trong thiết kế trước

Trước đây chúng ta có:

Vehicle.Status
Available
OnTrip
InOperation
UnderMaintenance
Broken

Nhưng MAINTENANCE_NEED không nên nhất thiết là một Vehicle.Status vận hành giống Broken.

Nên tách:

Vehicle.Status
├── Available
├── OnTrip
├── InOperation
├── UnderMaintenance
└── Broken

Vehicle.MaintenanceStatus
├── Normal
└── MaintenanceNeed

Vì:

Cần bảo dưỡng ≠ đang bảo dưỡng ≠ xe hỏng.

Ví dụ:

ODO đạt 5.000 km
       ↓
MaintenanceStatus = MaintenanceNeed
       ↓
Dispatcher nhận cảnh báo
       ↓
Xe vẫn có thể được xử lý theo chính sách doanh nghiệp
       ↓
Đưa xe vào bảo dưỡng
       ↓
Status = UnderMaintenance

Còn:

Báo hỏng StopOperation
       ↓
Status = Broken
       ↓
Không được điều vận