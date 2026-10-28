# Admin

- `AdminDashboardOverview.tsx`: thống kê tài khoản/cửa hàng, lịch sử phân quyền và đăng nhập gần đây của Admin.
- `AdminAccountsPage.tsx`: danh sách/lọc tài khoản, tạo tài khoản, quyền danh mục, khóa/mở khóa và cấp mật khẩu tạm.
- `AdminPermissionHistoryPage.tsx`: gộp lịch sử từ endpoint hiện có theo từng tài khoản; lọc kết quả và xuất CSV.
- `admin.css`: kiểu dáng riêng của màn quản lý tài khoản Admin.
- `../dashboard/DashboardPage.tsx` chỉ tải dữ liệu, dựng khung và chọn nội dung theo role.
- Thành phần khung dashboard dùng chung nằm trong `../dashboard/DashboardPage.tsx` (`DashboardShell`).
- `../dashboard/DashboardWidgets.tsx`: icon, thẻ thống kê và danh sách trạng thái cửa hàng được các role dùng chung.

Mở `../README.md` để xem bản đồ toàn bộ các trang và nơi sửa API, kiểu dữ liệu, route.
