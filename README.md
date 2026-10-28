# MotoFlow Frontend

Frontend quản lý bán hàng và kho MotoFlow, xây dựng bằng React, TypeScript và Vite.

## Setup lần đầu sau khi clone

### 1. Cài công cụ cần thiết

- Cài Node.js **22.12 trở lên** từ [nodejs.org](https://nodejs.org/). npm được cài cùng Node.js.
- Kiểm tra cài đặt:

```bash
node --version
npm --version
```

Nếu terminal chưa nhận lệnh `node` hoặc `npm`, đóng rồi mở lại terminal sau khi cài Node.js.

### 2. Clone repo và cài thư viện

```bash
git clone https://github.com/CapstoneProject-MotoFlow/MotoFlow_FE.git
cd MotoFlow_FE
npm ci
```

`npm ci` cài đúng các phiên bản đã ghi trong `package-lock.json`. Chạy lại lệnh này sau khi pull code mới nếu `package.json` hoặc `package-lock.json` thay đổi.

### 3. Chạy frontend

```bash
npm run dev
```

Mở địa chỉ Vite in trong terminal, thường là <http://localhost:5173/>. Giữ terminal này mở trong lúc làm việc; nhấn `Ctrl+C` để dừng server.

## Pull cập nhật mới nhất

Nếu đã clone repo trước đó, mở terminal tại thư mục `MotoFlow_FE` rồi chạy:

```bash
git pull origin main
npm ci
npm run dev
```

Nếu đang dùng nhánh khác, thay `main` bằng tên nhánh của bạn.

## Chạy cùng backend

Frontend chuyển tiếp request `/api/*` tới backend ở `http://localhost:8080`. Để đăng nhập và gọi API được, backend cần chạy đồng thời.

1. Mở terminal thứ nhất, vào thư mục `MotoFlow_BE` và khởi động backend theo README của backend. Với PostgreSQL nhúng trên Windows:

   ```powershell
   .\mvnw.cmd spring-boot:test-run
   ```

   Backend sẽ chạy ở `http://localhost:8080`.
2. Mở terminal thứ hai, vào `MotoFlow_FE`, chạy `npm run dev` và mở <http://localhost:5173/>.

Khi chỉ cần làm giao diện, vẫn có thể chạy FE riêng; chức năng cần API sẽ không hoạt động nếu backend chưa bật.

## Lệnh thường dùng

```bash
npm run dev       # chạy môi trường phát triển
npm run lint      # kiểm tra ESLint
npm run build     # kiểm tra TypeScript và tạo dist/
npm run preview   # xem thử bản build
```

## Cấu trúc và lưu ý

- `src/shared/api/axiosClient.ts`: Axios client dùng chung, `baseURL: '/api'`, gửi cookie.
- `src/App.tsx`: định tuyến trang và giao diện đăng nhập.
- `vite.config.ts`: cấu hình proxy API khi chạy local.
- Không đặt secret trong biến `VITE_*`; giá trị trong bundle có thể xem được trên trình duyệt.
- CI dùng `npm ci`, vì vậy cần commit `package-lock.json` khi thay đổi dependency.

## Docker

`npm run build` tạo thư mục `dist/`. Dockerfile Caddy trong repo phục vụ nội dung đã build; proxy `/api` ở tầng deploy được cấu hình riêng.
