# FE04 — Bảng giá và quy tắc giá gợi ý

## Các màn

- `/pricing/retail-prices`: bảng giá bán lẻ toàn chuỗi, tìm SKU/tên, nhóm hàng, trạng thái và lọc giá gợi ý khác giá hiện hành (mặc định bật cho người có quyền sửa giá). Phân trang theo tổng BE.
- Popup sửa giá: nhập số nguyên dương hoặc áp dụng giá gợi ý, ngày hiệu lực từ hôm nay, lý do tối đa 500 ký tự, thông tin lịch giá đã hẹn và kết quả áp dụng toàn chuỗi. Giá không tự thay đổi khi chỉ cấu hình gợi ý.
- Popup lịch sử: giá, thời gian hiệu lực, chênh lệch, lý do, người thay đổi và trạng thái; 10 lần gần nhất, có xem tất cả.
- Popup Owner thiết lập chiết khấu tối đa và biên lợi nhuận tối thiểu: tỷ lệ 0–100%, tối đa 2 số lẻ, ngày hiệu lực. Mở được từ Bảng giá và Quy tắc giá.
- `/pricing/rules`: hai tab theo mockup. Tab mặc định Ngưỡng và biên lợi nhuận gồm hai thẻ có form lưu trực tiếp, giá trị hiện hành/chờ áp dụng và ba dòng lịch sử gần nhất, mở rộng xem tất cả. Tab Giá bán lẻ gợi ý chứa cấu hình tỷ lệ/làm tròn, xem trước và lưu theo ngày hiệu lực.
- Tab Giá bán lẻ gợi ý sửa trực tiếp trên màn: bảng tỷ lệ nhóm kèm loại xe, danh sách tỷ lệ riêng theo phụ tùng (tìm/thêm/bỏ); cột phải có làm tròn, ngày áp dụng, lưu quy tắc và bảng xem trước tự cập nhật từ BE. Giữ toàn bộ tỷ lệ đã có khi mở; không tự gán tỷ lệ cho nhóm chưa cấu hình.

## Kết nối

- GET/POST `/pricing/retail-prices`, GET `/pricing/retail-prices/{productId}/history`.
- GET/PUT `/pricing/sales-limits`.
- GET/POST `/pricing/markup-rules`, POST `/pricing/markup-rules/preview`.
- GET `/part-categories`; GET `/products` có tìm kiếm/phân trang khi mở bộ chọn.

Owner được cấu hình tất cả. BM xem bảng giá/lịch sử; chỉ sửa khi có `RETAIL_PRICE_EDIT`. BM không thấy giá nhập/cơ sở tính giá. Staff/Admin không có route giá. Quyền ghi cuối cùng do BE kiểm tra; lỗi BE hiển thị và giữ dữ liệu form. Khóa gửi lặp trong lúc lưu, không tự ghi dữ liệu khi tải màn.

Lưu quy tắc thay thế toàn bộ cấu hình; giữ lại các tỷ lệ hiện có khi mở chỉnh sửa, báo rõ việc bỏ dòng. Không tự cộng tỷ lệ hay tự tính lại giá trong FE; kết quả xem trước do BE trả. Không hiển thị kết quả xem trước cũ sau khi đổi cấu hình.

## Kiểm tra 09/11/2026

- 70/70 tests đạt, gồm kiểm tra quyền sửa giá và giới hạn tiền/tỷ lệ.
- Build đạt, lint các file thay đổi không có lỗi/cảnh báo.
- Trình duyệt dùng API mô phỏng: lưu giá gợi ý, lịch sử, lưu ngưỡng bằng 0, xem trước và lưu quy tắc, BM có/không có quyền sửa và ẩn giá nhập, desktop/mobile không tràn ngang toàn trang.
- Không sửa BE/database; chưa thực hiện giao dịch giá với dữ liệu thật.

Mockup tham chiếu: `motoflow_ui/screens_pricing.js`, UC34–36/38/101. Phần này thuộc FE04, bổ sung ngoài phạm vi rà FE05–FE13 trước đó.
