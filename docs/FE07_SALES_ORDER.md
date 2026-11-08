# FE-07 — Quản lý đơn bán

Cập nhật 08/11/2026.

Đã kết nối API danh sách, tạo/sửa và preview đơn, lịch sử phiên bản, giao việc, ghi số nhặt, xác nhận, thu/hoàn tiền, bán chịu, hủy, xác minh và hoàn tất. Quyền thao tác dùng actions của BE. Staff không thấy tiền. Hỗ trợ tìm phụ tùng, quét mã bàn phím và camera, tạo nhanh khách, nhu cầu chưa đáp ứng và yêu cầu bổ sung.

## Sửa theo review PR #27

- Tham số action được xóa khỏi URL sau khi tải đơn để popup không mở lại sau lưu.
- Staff chỉ có Cần lấy và Đã gửi.
- Cột liên kết thu tiền mang tên Thanh toán; nút rời form là Quay lại.
- Trạng thái tải/lỗi dùng InventoryNotice.

## Phụ thuộc và giới hạn

R-02 còn chờ BE hỗ trợ status trong SalesOrderSearch. Hiện FE vẫn tải các trang để lọc trạng thái; sau khi BE hỗ trợ sẽ chuyển sang phân trang tại server.

Nhặt hàng phiếu điều chuyển thuộc chức năng điều chuyển khi có API. Chưa kiểm thử toàn bộ luồng với BE trên trình duyệt hoặc camera trên thiết bị thật. Cần kiểm tra giao việc và thu một phần: lưu xong popup không tự mở lại.
