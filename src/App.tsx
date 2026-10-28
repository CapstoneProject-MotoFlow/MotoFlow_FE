import { useState, type FormEvent } from 'react'
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import axios from 'axios'
import axiosClient from './shared/api/axiosClient'
import { clearAccessToken, getAccessToken, setAccessToken } from './shared/auth/accessToken'

const stores = ['Nga Minh Yên Viên', 'Nga Minh Long Biên', 'Nga Minh Đông Anh']

type AuthUser = {
  username: string
  role?: string
  storeName?: string
  mustChangePassword?: boolean
}

type LoginResponse = {
  accessToken: string
  user: AuthUser
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand${compact ? ' brand-compact' : ''}`}>
      <span className="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M4 17V7l5 6 3-4 3 4 5-6v10" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span>MotoFlow</span>
    </div>
  )
}

function StoreIcon() {
  return (
    <span className="store-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none">
        <path d="M4 10h16M5 10v9h14v-9M3.5 10l1.6-5h13.8l1.6 5M9 19v-5h6v5M8 10v2m4-2v2m4-2v2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  )
}

function LoginPage({ onLogin }: { onLogin: (user: AuthUser) => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
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
    <main className="login-layout">
      <section className="login-pane" aria-labelledby="login-title">
        <form className="login-form" onSubmit={handleSubmit}>
          <h1 id="login-title">Đăng nhập</h1>

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

          <label htmlFor="password">Mật khẩu <span className="required">*</span></label>
          <div className="password-field">
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Nhập mật khẩu"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            <button
              className="password-toggle"
              type="button"
              onClick={() => setShowPassword((visible) => !visible)}
              aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
            >
              {showPassword ? (
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.9 5.2A10.8 10.8 0 0112 5c5 0 8.5 4.4 9.5 6-.4.7-1.2 1.7-2.4 2.7M6.2 6.2C4.2 7.5 2.9 9.3 2.5 11c1 1.6 4.5 6 9.5 6 1 0 1.9-.2 2.7-.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M2.5 12S6 6 12 6s9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z" stroke="currentColor" strokeWidth="1.6" /><circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.6" /></svg>
              )}
            </button>
          </div>

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

          <p className="forgot-note">Quên mật khẩu? Liên hệ Admin để được cấp mật khẩu tạm.</p>
        </form>
      </section>

      <aside className="brand-pane">
        <div className="brand-content">
          <Brand />
          <p className="brand-description">Quản lý phụ tùng, nhập hàng và tồn kho cho<br className="desktop-break" /> chuỗi cửa hàng phụ tùng xe Nga Minh.</p>
          <ul className="store-list" aria-label="Các cửa hàng Nga Minh">
            {stores.map((store) => (
              <li className="store-item" key={store}>
                <StoreIcon />
                <span>{store}</span>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </main>
  )
}

function DashboardPage({ user, onLogout }: { user: AuthUser; onLogout: () => void }) {
  return (
    <main className="signed-in-page">
      <Brand compact />
      <section className="signed-in-card">
        <span className="signed-in-kicker">MOTOFLOW</span>
        <h1>Đăng nhập thành công</h1>
        <p>Xin chào <strong>{user.username}</strong>{user.storeName ? ` · ${user.storeName}` : ''}.</p>
        {user.mustChangePassword && <p className="change-password-hint">Tài khoản cần đổi mật khẩu tạm trước khi tiếp tục.</p>}
        <button className="logout-button" onClick={onLogout}>Đăng xuất</button>
      </section>
    </main>
  )
}

export default function App() {
  const navigate = useNavigate()
  const [user, setUser] = useState<AuthUser | null>(null)

  async function logout() {
    try {
      await axiosClient.post('/auth/logout', undefined, {
        headers: { Authorization: `Bearer ${getAccessToken()}` },
      })
    } finally {
      clearAccessToken()
      setUser(null)
      navigate('/login')
    }
  }

  return (
    <Routes>
      <Route path="/" element={<Navigate to={user ? '/dashboard' : '/login'} replace />} />
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <LoginPage onLogin={setUser} />} />
      <Route path="/dashboard" element={user ? <DashboardPage user={user} onLogout={logout} /> : <Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}
