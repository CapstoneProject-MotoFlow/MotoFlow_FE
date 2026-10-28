import { Link } from 'react-router-dom'
import AuthLayout from '../../../shared/components/AuthLayout'

export default function ForgotPasswordPage() {
  return (
    <AuthLayout>
      <section className="login-form forgot-password-page" aria-labelledby="forgot-password-title">
        <h1 id="forgot-password-title">Quên mật khẩu</h1>
        <div className="password-notice" role="note">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" />
            <path d="M12 11v5m0-8h.01" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
          <span>Vui lòng liên hệ Admin để được cấp mật khẩu tạm. Sau khi đăng nhập bằng mật khẩu tạm, hệ thống sẽ yêu cầu bạn đổi mật khẩu.</span>
        </div>
        <Link className="submit-button forgot-back-button" to="/login">Quay lại đăng nhập</Link>
      </section>
    </AuthLayout>
  )
}
