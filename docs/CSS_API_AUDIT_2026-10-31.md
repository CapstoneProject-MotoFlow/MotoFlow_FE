# Rà soát CSS và API FE — 31/10/2026

Phạm vi: kiểm tra mã nguồn FE và đối chiếu controller/DTO BE local. Chưa phải kiểm thử trực quan hoặc kiểm thử tích hợp trên trình duyệt.

## Lỗi đã sửa trong đợt rà soát

- CSS bảng nhà cung cấp kế thừa độ rộng 33% + 32% từ cấu trúc cũ: chia lại cột, giữ điện thoại/tiền/nút trên một dòng, cho cuộn ngang khi thiếu chỗ.
- Ô tìm kiếm và nút phân trang NCC thiếu kiểu: bổ sung selector riêng.
- Selector `.admin-dashboard .table-scroll table` tác động cả Owner/BM/Staff: giới hạn về `.admin-role-dashboard`.
- Cửa hàng vẫn nhập/gửi warehouseName dù BE đã gộp kho vào cửa hàng: bỏ trường khỏi form/payload.
- BM có quyền danh mục không có route sửa phụ tùng: bổ sung route tạo/sửa, kiểm tra quyền ở form và hiển thị nút sửa theo quyền.

## API đã đối chiếu

- Auth: login, refresh, logout, change-password; refresh dùng transport riêng, gom request đồng thời và giới hạn retry.
- Admin: danh sách/tạo tài khoản, quyền, khóa/mở khóa, reset mật khẩu, lịch sử quyền.
- Cửa hàng: danh sách, tạo, sửa và copy cấu hình.
- Khách hàng: danh sách/tìm/lọc mua nợ, tạo/sửa, chi tiết; dùng nợ toàn chuỗi hoặc nợ tại cửa hàng đúng vai trò.
- NCC: danh sách/tìm/lọc, tạo/sửa, activate/deactivate, chi tiết giao dịch.
- Danh mục: nhóm và dòng xe dùng list/create/update/activate/deactivate; phụ tùng dùng list/detail/create/update/discontinue/reactivate.
- Home và chuông: đọc /home, không giả lập số liệu.

## Giới hạn còn lại

- BE chưa có API Owner quản lý quyền danh mục/giá của BM.
- BE chưa hỗ trợ tải tệp ảnh; ảnh chỉ lưu URL HTTPS. ProductRequest chưa có cờ theo dõi hạn dùng.
- Khách hàng chưa có trường người liên hệ/ghi chú/ngày mua gần nhất/tổng quá hạn trong response.
- NCC chưa có tổng phiếu mở, giá trị chưa nhận và đã nhận trong năm; danh sách giao dịch chi tiết bị BE giới hạn số dòng.
- Các mục menu pending là màn chưa triển khai, không phải endpoint đã nối.
- Chưa xác nhận hết lỗi layout ở các kích thước màn hình, chưa chạy CRUD trực tiếp cho từng vai trò và chưa mô phỏng token hết hạn trên trình duyệt.
- Ruleset main thuộc cấu hình GitHub, chưa thay đổi.

## Kiểm tra tự động

Build, ESLint, 7 test hiện có và Prettier. Các test hiện có chỉ bao phủ một phần cấu trúc CSS và danh sách đăng nhập, không thay thế test CRUD/API hoặc kiểm tra trực quan.
