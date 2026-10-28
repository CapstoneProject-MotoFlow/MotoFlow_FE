import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import axios from 'axios'
import AuthLayout from '../../../shared/components/AuthLayout'
import PasswordField from '../../../shared/components/PasswordField'
import axiosClient from '../../../shared/api/axiosClient'
import { setAccessToken } from '../../../shared/auth/accessToken'
import type { AuthUser, LoginResponse } from '../../../shared/types/auth'

type LoginPageProps = {
  onLogin: (user: AuthUser) => void
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [rememberSession, setRememberSession] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      const response = await axiosClient.post<LoginResponse>('/auth/login', {
        username: username.trim(),
        password,
      })
      setAccessToken(response.data.accessToken)
      onLogin(response.data.user)
      navigate(response.data.user.mustChangePassword ? '/change-password' : '/dashboard')
    } catch (requestError) {
      const message = axios.isAxiosError(requestError)
        ? requestError.response?.data?.message
        : undefined
      setError(typeof message === 'string' ? message : 'Không thể đăng nhập. Vui lòng kiểm tra kết nối và thử lại.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout>
      <form className="login-form" onSubmit={handleSubmit}>
        <h1>Đăng nhập</h1>
        <label htmlFor="username">Tên đăng nhập <span className="required">*</span></label>
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

        <PasswordField id="password" label="Mật khẩu" value={password} onChange={setPassword} autoComplete="current-password" />

        <label className="remember-row">
          <input
            type="checkbox"
            checked={rememberSession}
            onChange={(event) => setRememberSession(event.target.checked)}
          />
          <span>Ghi nhớ phiên đăng nhập</span>
        </label>

        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="submit-button" type="submit" disabled={submitting}>
          {submitting ? 'Đang đăng nhập…' : 'Đăng nhập'}
        </button>
        <p className="forgot-note"><Link to="/forgot-password">Quên mật khẩu?</Link> Liên hệ Admin để được cấp mật khẩu tạm.</p>
      </form>
    </AuthLayout>
  )
}
