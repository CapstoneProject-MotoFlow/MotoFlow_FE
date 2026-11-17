# CI cho MotoFlow Frontend

GitHub Actions chỉ kiểm tra code. Cloudflare Pages xuất bản site.

```
PR hoặc push vào main ──► build-test (npm ci → lint → test → build)
Push vào main          ──► Cloudflare Pages build lại và xuất bản production
```

## Cloudflare Pages

Tạo project, nối repo `MotoFlow_FE`:

- Production branch: `main`
- Build command: `npm run build`
- Output directory: `dist`
- Biến `VITE_API_BASE_URL`: gốc API kèm `/api/v1`, ví dụ `https://api.example.com/api/v1`

`public/_redirects` gửi mọi đường về `index.html` để route phía client không bị 404 khi tải lại trang.

Máy local không đặt `VITE_API_BASE_URL`. Vite chuyển `/api` tới `http://127.0.0.1:8080`.

Không đặt secret trong biến `VITE_*`. Giá trị này có trong file JavaScript mà trình duyệt tải về.

Cookie refresh chỉ được gửi khi trang và API cùng một domain gốc, ví dụ `app.example.com` và `api.example.com`. Domain `pages.dev` với API ở domain khác thì đăng nhập xong, tải lại trang sẽ mất phiên.
