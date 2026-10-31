/**
 * File: modules/auth/pages/ForgotPasswordPage.tsx
 * Loại: MÀN HÌNH — Quên mật khẩu.
 * Đường dẫn: /forgot-password.
 * Công dụng: Hướng dẫn liên hệ Admin lấy mật khẩu được cấp; không tự gửi email khôi phục.
 */
import { Link } from 'react-router-dom'
import '../auth.css'

/** ForgotPasswordPage: Hướng dẫn liên hệ Admin lấy mật khẩu được cấp; không tự gửi email khôi phục. */
export default function ForgotPasswordPage() {
  return (
    <section
      className="login-form forgot-password-page"
      aria-labelledby="forgot-password-title"
    >
      <h1 id="forgot-password-title">Quên mật khẩu</h1>
      <div className="password-notice" role="note">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle
            cx="12"
            cy="12"
            r="9"
            stroke="currentColor"
            strokeWidth="1.7"
          />
          <path
            d="M12 11v5m0-8h.01"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </svg>
        <span>
          Liên hệ quản trị viên để được hỗ trợ khôi phục quyền truy cập tài khoản.
        </span>
      </div>
      <Link className="submit-button forgot-back-button" to="/login">
        Quay lại đăng nhập
      </Link>
    </section>
  )
}
