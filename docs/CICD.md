# CI/CD cho MotoFlow Frontend

Pipeline giống hệt bên backend. Phần AWS, server, rollback và xử lý lỗi nằm trong **`MotoFlow_BE/docs/CICD.md`**; file này chỉ ghi những gì riêng của frontend.

```
PR vào main ──► build-test (npm ci → lint → test → build)
Merge main  ──► build-test ──► build-push-image (ECR motoflow-frontend, tag = commit SHA) ──► deploy-dev ──► smoke test
Tag v1.0.0  ──► release.yml: deploy đúng image của commit đó lên production
```

Image frontend là **Caddy + thư mục `dist/`** (`Dockerfile`, `deploy/Caddyfile`). Trên server, proxy chuyển `/api/*` sang backend và mọi đường dẫn khác sang frontend, nên FE và BE chạy chung một domain.

## Yêu cầu với code frontend

1. **Commit project Vite cùng `package.json` và `package-lock.json`.** Pipeline dùng `npm ci`, nên nhóm thống nhất dùng npm (không dùng yarn/pnpm).
2. **`npm run build` phải tạo ra `dist/`** (mặc định của Vite).
3. **Gọi API bằng đường dẫn tương đối `/api`**, không hard-code `http://localhost:8080`:
   ```js
   // shared/api/axiosClient.js
   const axiosClient = axios.create({ baseURL: '/api', withCredentials: true })
   ```
   Khi chạy ở máy, dùng proxy của Vite để mọi thứ giống trên server (không cần CORS, cookie refresh vẫn hoạt động):
   ```js
   // vite.config.js
   export default defineConfig({
     plugins: [react()],
     server: { proxy: { '/api': 'http://localhost:8080' } },
   })
   ```
   Nhờ đó **một bản build chạy được ở mọi môi trường**: CI không cần biến `VITE_*` nào, và image đã test ở dev được đưa nguyên lên production.
4. **Không đặt secret trong biến `VITE_*`.** Mọi thứ trong bundle đều đọc được bằng F12.
5. Script `lint` và `test` là tùy chọn: có thì CI chạy, không có thì bỏ qua. Nếu dùng Vitest, đặt `"test": "vitest run"`.
6. **Bổ sung `.gitignore`**: file hiện tại là mẫu Java, chưa có `node_modules/` và `dist/`.
7. Routing phía client (`BrowserRouter`) chạy được: mọi URL không phải file thật đều trả về `index.html`.

## Smoke test sau mỗi lần deploy

`.github/scripts/smoke-test.sh` kiểm tra ba điều:

- `<URL>/version.txt` chứa đúng commit SHA vừa build (CI ghi file này vào `dist/`). Điều này xác nhận server đang phục vụ **đúng bản mới**, chứ không phải bản cũ còn trong cache.
- `<URL>/` trả về HTML có `id="root"`.
- Một deep link (`/smoke-test/deep-link`) cũng trả về `index.html`.

Nếu sau này đổi id của thẻ gốc trong `index.html`, sửa luôn script này.

## Biến GitHub (Settings → Secrets and variables → Actions → Variables)

Giống bên backend: `AWS_ACCOUNT_ID`, `DEV_BASE_URL`, và khi có production thì `PROD_ENABLED=true`, `PROD_BASE_URL`. Không cần secret.

## Phát hành

Tag `v*` trên `main`, **sau khi** đã tag backend:

```bash
git switch main
git pull
git tag -a v1.0.0 -m "Software Package v1"
git push origin v1.0.0
```

`.github/scripts/ssm-deploy.sh` giống hệt bản trong MotoFlow_BE. Khi sửa một bên thì chép sang bên kia.
