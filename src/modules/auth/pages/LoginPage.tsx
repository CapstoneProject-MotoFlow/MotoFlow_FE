import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import axios from 'axios'
import PasswordField from '../../../shared/ui/PasswordField'
import { login } from '../services/authService'
import { useAuth } from '../../../shared/hooks/useAuth'
import '../auth.css'

export default function LoginPage() {
  const navigate = useNavigate()
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
      navigate(user.mustChangePassword ? '/change-password' : '/dashboard')
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
    <form className="login-form" onSubmit={handleSubmit}>
      <h1>Đăng nhập</h1>
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
      <p className="forgot-note">
        <Link to="/forgot-password">Quên mật khẩu?</Link> Liên hệ Admin để được
        cấp mật khẩu tạm.
      </p>
    </form>
  )
}
