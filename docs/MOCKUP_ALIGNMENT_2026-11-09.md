# Chỉnh 7 màn theo mockup — 09/11/2026

Nguồn: bộ MotoFlow_UI_ToanBo người dùng cung cấp, đặc biệt trang_chu.js (Home V3), screens_debt.js, screens_transfer.js, screens_sales.js, screens_period.js và screens_count.js; đối chiếu các ảnh chụp màn hiện tại trong chat.

- Tổng quan Owner: bỏ lời chào/bảng gần đây; đưa về khối việc cần xử lý, số liệu toàn chuỗi và so sánh cửa hàng. Shortcut mở đúng màn; ẩn thẻ bằng 0. Sửa CSS cột kế thừa gây chồng chữ. Không gọi bảng công việc là toàn bộ việc chờ lâu nhất vì API chưa có hàng đợi hợp nhất.
- Công nợ: tiêu đề và breadcrumb trên một hàng, nút ghi nợ nổi bật; thẻ số liệu gọn hơn; checkbox cùng dòng; nhấn mạnh thu nợ quá hạn. Giữ — cho chỉ số tổng hợp chưa có API.
- Yêu cầu bổ sung/lệnh điều chuyển: tiêu đề, card, tab, bảng và kích thước bộ lọc thống nhất; mở Lọc ngày thành hàng riêng với label và ô ngày rõ ràng, không dính chữ.
- Tồn theo ngày: tiêu đề card theo ngày/kho, chọn nhanh ngày; checkbox cùng dòng; phụ tùng kèm SKU, tồn cuối ngày/tồn hiện tại/chênh lệch. Tồn hiện tại lấy GET inventory/stock theo productId và storeId, không lấy nhầm tồn toàn chuỗi hoặc hàng đang chuyển.
- Đơn bán: bỏ dòng chữ Bán hàng thừa, thu khoảng cách tiêu đề/card, bổ sung breadcrumb, tab active rõ.
- Kiểm kê: tên card theo vai trò, tab chờ duyệt/đang mở/hoàn tất/hủy/tất cả, cấu trúc cột theo mockup; thông tin chênh lệch đọc chi tiết thật và phân công chỉ BM được đọc. Bộ lọc nâng cao thu gọn; yêu cầu có mã/ngày/kho tách cột, nút hủy dùng kiểu nút của ứng dụng.

BE chỉ nhận một status kiểm kê mỗi lần: tab Đang mở đọc đủ các trang DRAFT/COUNTING/AWAITING_APPROVAL, bỏ trùng, sắp xếp và phân trang sau khi ghép, không lọc một trang rồi báo tổng sai. Các trường người đếm Owner không được API trả vẫn để —.

Kiểm tra: build đạt, 65 tests đạt; chụp 7 màn tại 1900px và 390px bằng API mô phỏng, không có tràn ngang toàn trang hoặc lỗi JavaScript. Bảng rộng cuộn bên trong card trên mobile. Luồng kiểm kê tạo/bắt đầu/lưu/gửi/xác minh/duyệt/yêu cầu-hủy/đếm lại và lỗi trạng thái đã kiểm tra hồi quy bằng trình duyệt. Không sửa BE/database, không dùng dữ liệu mock trong ứng dụng.
