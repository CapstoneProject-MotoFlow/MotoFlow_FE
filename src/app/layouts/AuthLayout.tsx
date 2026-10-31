/**
 * File: app/layouts/AuthLayout.tsx
 * Loại: KHUNG GIAO DIỆN — bao quanh màn hình, không phải trang nghiệp vụ.
 * Công dụng: Khung dùng cho đăng nhập/quên mật khẩu/đổi mật khẩu bắt buộc, có vùng biểu mẫu và vùng thương hiệu.
 */
import './layouts.css'
import { Outlet } from 'react-router-dom'

/** AuthLayout: Khung dùng cho đăng nhập/quên mật khẩu/đổi mật khẩu bắt buộc, có vùng biểu mẫu và vùng thương hiệu. */
export default function AuthLayout() {
  return (
    <main className="login-layout login-layout-centered">
      <section className="login-pane">
        <Outlet />
      </section>
    </main>
  )
}
