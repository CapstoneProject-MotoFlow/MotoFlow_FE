# MotoFlow Frontend

Giao diện quản lý bán hàng và kho MotoFlow, xây dựng bằng React, TypeScript và Vite.

## Cài đặt và chạy

Cần Node.js 22 trở lên và npm. Tại thư mục `MotoFlow_FE`, chạy:

```bash
npm ci
npm run dev
```

Mở địa chỉ Vite hiện trong terminal (mặc định `http://localhost:5173`). Giữ terminal mở khi sử dụng; nhấn `Ctrl+C` để dừng.

Frontend gửi request `/api/*` đến backend tại `http://localhost:8080`. Các chức năng cần dữ liệu thật sẽ hoạt động khi backend và database đã được khởi chạy theo hướng dẫn riêng của backend. Việc chạy FE không tự tạo hay đồng bộ database.

## Lệnh thường dùng

```bash
npm run dev       # chạy giao diện trong môi trường phát triển
npm run lint      # kiểm tra quy tắc code
npm run build     # kiểm tra TypeScript và tạo dist/
npm run preview   # xem thử bản build
```

Sau khi cập nhật code, thông thường Vite tự tải lại trang. Chạy `npm ci` lại nếu `package.json` hoặc `package-lock.json` thay đổi.

## Cấu trúc thư mục

Code nằm trong `src/` và được chia thành ba vùng. Khi tìm hoặc sửa tính năng, bắt đầu ở `modules/<tên-module>/pages/`; phần dùng chung nằm ở `shared/`, còn điều hướng và khung ứng dụng nằm ở `app/`.

```text
src/
├── app/                 # Ghép ứng dụng: routes, guards, layouts, AuthProvider
│   ├── routes/          # Khai báo URL và nối URL với trang
│   ├── guards/          # Chặn người chưa đăng nhập hoặc sai vai trò
│   └── layouts/         # Khung xác thực và khung dashboard dùng chung
├── modules/             # Mỗi khu vực nghiệp vụ giữ trang, component, service và CSS của nó
│   ├── auth/            # Đăng nhập, quên mật khẩu, đổi mật khẩu tạm
│   ├── dashboard/       # Tổng quan theo role và các khối thống kê
│   ├── admin/            # Quản lý tài khoản và lịch sử phân quyền
│   ├── stores/           # Danh sách và biểu mẫu cửa hàng
│   └── profile/          # Đổi mật khẩu trong hồ sơ
└── shared/              # Thành phần, API client, hook, tiện ích và kiểu dùng chung
    ├── api/              # Axios client và access token
    ├── hooks/            # Hook dùng chung, gồm useAuth
    ├── ui/               # Logo, ô mật khẩu, icon và component giao diện
    ├── types/            # Kiểu dữ liệu dùng chung giữa các module
    ├── utils/            # Quy tắc mật khẩu và tiện ích thuần
    └── assets/styles/    # CSS toàn cục
```

### Tìm file theo việc cần làm

| Việc cần sửa                       | Bắt đầu từ                            |
| ---------------------------------- | ------------------------------------- |
| Thêm URL hoặc đổi trang mặc định   | `src/app/routes/AppRoutes.tsx`        |
| Đổi quyền truy cập theo role       | `src/app/guards/`                     |
| Sửa menu, header, bố cục chung     | `src/app/layouts/DashboardLayout.tsx` |
| Sửa đăng nhập / đổi mật khẩu tạm   | `src/modules/auth/`                   |
| Sửa tổng quan theo từng role       | `src/modules/dashboard/`              |
| Sửa tài khoản / lịch sử phân quyền | `src/modules/admin/`                  |
| Sửa danh sách cửa hàng             | `src/modules/stores/`                 |
| Sửa đổi mật khẩu từ hồ sơ          | `src/modules/profile/`                |
| Sửa API client hoặc kiểu chia sẻ   | `src/shared/`                         |

## Quy ước phụ thuộc

- `app` ghép route, layout và các module; không chứa nghiệp vụ của riêng một màn hình.
- Mỗi `modules/<module>` chứa trang và thành phần thuộc nghiệp vụ đó. Module không nhập trực tiếp trang hoặc component nội bộ của module khác.
- Đưa thứ thật sự dùng ở nhiều nơi vào `shared`; không tạo thêm thư mục shared cho một thành phần chỉ có một nơi dùng.
- API client dùng chung ở `shared/api/axiosClient.ts`; cấu hình proxy nằm trong `vite.config.ts`.
- Không sửa BE hoặc database khi chỉ làm giao diện FE. API mà FE gọi cần khớp với backend hiện có.
- Không đặt secret trong biến `VITE_*`; giá trị này có thể đọc được trong trình duyệt.
- Khi đổi dependency, cập nhật và commit `package-lock.json` vì cài đặt dùng `npm ci`.

## Docker

`npm run build` tạo thư mục `dist/`. Dockerfile trong repo đóng gói frontend đã build; proxy `/api` trong môi trường deploy được cấu hình tại tầng triển khai.
