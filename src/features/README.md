# Cách tìm code FE MotoFlow

Code được nhóm theo **nghiệp vụ/vai trò**. Mỗi màn hình có file riêng; phần dùng chung chỉ viết một lần. Không dồn toàn bộ ứng dụng vào một component lớn vì sẽ khó tìm và khó sửa.

## Màn Admin

| Việc cần sửa | Mở file |
| --- | --- |
| Danh sách, tìm/lọc tài khoản; tạo tài khoản; quyền danh mục; khóa/mở khóa; cấp mật khẩu tạm | `admin/AdminAccountsPage.tsx` |
| Lịch sử cấp/đổi/thu hồi quyền, lọc ngày/loại/tài khoản và xuất CSV | `admin/AdminPermissionHistoryPage.tsx` |
| Giao diện và kiểu dáng màn tài khoản Admin | `admin/admin.css` |
| Thống kê/tổng quan riêng của Admin | `admin/AdminDashboardOverview.tsx` |
| Menu trái, thanh trên cùng, tìm kiếm chung | `dashboard/DashboardPage.tsx`, tìm `DashboardShell`, `DashboardSidebar`, `DashboardHeader` |
| Icon, thẻ thống kê, trạng thái cửa hàng dùng chung | `dashboard/DashboardWidgets.tsx` |

## Màn dùng chung hoặc dùng theo nhiều vai trò

| Việc cần sửa | Mở file |
| --- | --- |
| Quản lý cửa hàng (Admin và Owner dùng chung màn này) | `stores/StoresPage.tsx` |
| Đổi mật khẩu từ menu hồ sơ sau khi đã đăng nhập | `profile/ProfileChangePasswordPage.tsx` |
| Tổng quan Owner, Quản lý cửa hàng và Nhân viên | `dashboard/DashboardPage.tsx`, tìm `BusinessOverview` |
| Gọi dữ liệu dashboard từ BE | `dashboard/dashboardService.ts` |
| Kiểu dữ liệu dashboard | `dashboard/dashboardTypes.ts` |
| Gọi API chung, đính kèm access token | `../shared/api/axiosClient.ts` |
| Đường dẫn trang và kiểm tra vai trò được vào trang | `../app/App.tsx` |

## Quy tắc khi thêm màn mới

1. Màn chỉ dành cho Admin đặt trong `admin/` và tên file bắt đầu bằng `Admin`.
2. Màn Owner, Quản lý cửa hàng hoặc Nhân viên đặt trong thư mục vai trò tương ứng khi vai trò đó có nghiệp vụ riêng.
3. Màn nhiều vai trò cùng dùng đặt theo nghiệp vụ, ví dụ `stores/`.
4. Mỗi file trang giữ phần điều phối của trang; biểu mẫu/danh sách được tách thành component có tên rõ nếu chúng cần tái sử dụng hoặc có luồng riêng.
5. Không tạo thêm tầng thư mục chỉ để chứa một file; tạo thư mục khi có nhiều file cùng một nghiệp vụ.
