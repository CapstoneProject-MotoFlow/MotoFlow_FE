/**
 * File: modules/auth/pages/LoginPage.tsx
 * Loại: MÀN HÌNH — Đăng nhập.
 * Đường dẫn: /login.
 * Công dụng: Form username/password, gửi đăng nhập, hiển thị lỗi và điều hướng sau thành công (quay lại trang người dùng đã mở trước đó nếu có).
 */
import { useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import axios from 'axios'
import PasswordField from '../../../shared/ui/PasswordField'
import { login } from '../services/authService'
import { useAuth } from '../../../shared/hooks/useAuth'
import { requestedPathFrom } from '../../../shared/utils/requestedPath'
import { homePath } from '../../../shared/utils/roles'
import '../auth.css'

/** LoginPage: Form username/password, gửi đăng nhập, hiển thị lỗi và điều hướng sau thành công. */
export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { signIn } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      const user = await login(username, password)
      signIn(user)
      // replace: nút Back không quay lại /login sau khi đã đăng nhập.
      navigate(
        user.mustChangePassword
          ? '/change-password'
          : (requestedPathFrom(location.state) ?? homePath(user)),
        { replace: true },
      )
    } catch (requestError) {
      const message = axios.isAxiosError(requestError)
        ? requestError.response?.data?.message
        : undefined
      setError(
        typeof message === 'string'
          ? message
          : 'Không thể đăng nhập. Vui lòng kiểm tra kết nối và thử lại.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-experience">
      <form className="login-form login-card" onSubmit={handleSubmit}>
        <p className="login-system-name">MotoFlow</p>
        <h1>Chào mừng trở lại</h1>
        <label htmlFor="username">
          Tên đăng nhập <span className="required">*</span>
        </label>
        <input
          id="username"
          name="username"
          type="text"
          autoComplete="username"
          placeholder="Ví dụ: ha.tt..."
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          required
        />

        <PasswordField
          id="password"
          label="Mật khẩu"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
        />

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button className="submit-button" type="submit" disabled={submitting}>
          {submitting ? 'Đang đăng nhập…' : 'Đăng nhập'}
        </button>
      </form>
    </div>
  )
}
