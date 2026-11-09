# Tổng quan Staff theo mockup

- Một bảng Việc của tôi với các cột Việc, Chứng từ, Giao lúc, Hạn, Trạng thái, Thao tác; phần đã gửi chờ BM xác nhận thu gọn phía dưới.
- Lấy dữ liệu từ sales-orders (OPEN), goods-receipt-notes/assigned-to-me, transfer-orders và stock-counts, tối đa 20 chứng từ mỗi nguồn trên trang; có chuyển trang. Không gọi chi tiết theo từng dòng.
- Phiếu nhập dùng goodsReceiptNoteId; quét/lấy hàng đơn bán mở route /sales-orders/{id}/pick. Kết quả đã gửi được phân nhóm khi status/taskStatus trả về đủ xác định.
- Thời điểm giao chỉ có ở AssignedReceiptResponse hiện tại; các nguồn khác giữ —. Hạn kiểm kê dùng countDate, không tự suy đoán hạn giao từ ngày chứng từ.
- DTO danh sách kiểm kê/điều chuyển chưa có trạng thái task đầy đủ nên các dòng này mở phiếu để xem quyền và kết quả mới nhất. Không tự gọi API warehouse-tasks dành BM và không suy diễn Staff chưa gửi từ status COUNTING.
- Con số trong tiêu đề là số dòng đang hiển thị của trang, không thay bằng số home chỉ đếm việc chưa bắt đầu. Footer ghi rõ phạm vi trang.

Kiểm tra: build/lint đạt, 69/69 tests đạt. Browser API mô phỏng kiểm tra bảng hợp nhất, nhóm đã gửi, đường dẫn phiếu nhận/lấy hàng chính xác, không có undefined/lỗi JavaScript và desktop/mobile không tràn ngang toàn trang. Không ghi DB thật.
