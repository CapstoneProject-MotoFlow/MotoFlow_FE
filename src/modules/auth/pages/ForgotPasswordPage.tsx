/**
 * File: modules/auth/pages/ForgotPasswordPage.tsx
 * Loại: MÀN HÌNH — Quên mật khẩu.
 * Đường dẫn: /forgot-password.
 * Công dụng: Trang quên mật khẩu và liên kết quay lại đăng nhập.
 */
import { Link } from 'react-router-dom'
import '../auth.css'

/** ForgotPasswordPage: Trang quên mật khẩu và liên kết quay lại đăng nhập. */
export default function ForgotPasswordPage() {
  return (
    <section
      className="login-form forgot-password-page"
      aria-labelledby="forgot-password-title"
    >
      <h1 id="forgot-password-title">Quên mật khẩu</h1>
      <Link className="submit-button forgot-back-button" to="/login">
        Quay lại đăng nhập
      </Link>
    </section>
  )
}
