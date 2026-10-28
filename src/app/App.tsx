import { useState } from 'react'
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import axiosClient from '../shared/api/axiosClient'
import { clearAccessToken } from '../shared/auth/accessToken'
import type { AuthUser } from '../shared/types/auth'
import LoginPage from '../features/auth/pages/LoginPage'
import ForgotPasswordPage from '../features/auth/pages/ForgotPasswordPage'
import ChangePasswordPage from '../features/auth/pages/ChangePasswordPage'
import DashboardPage from '../features/dashboard/DashboardPage'
import StoresPage from '../features/stores/StoresPage'
import AdminAccountsPage from '../features/admin/AdminAccountsPage'
import AdminPermissionHistoryPage from '../features/admin/AdminPermissionHistoryPage'
import ProfileChangePasswordPage from '../features/profile/ProfileChangePasswordPage'

export default function App() {
  const navigate = useNavigate()
  const [user, setUser] = useState<AuthUser | null>(null)

  async function logout() {
    try {
      await axiosClient.post('/auth/logout')
    } catch {
      // Clear the local session even if the server is unreachable.
    } finally {
      clearAccessToken()
      setUser(null)
      navigate('/login')
    }
  }

  function finishPasswordChange() {
    setUser((current) => current ? { ...current, mustChangePassword: false } : current)
    navigate('/dashboard')
  }

  return (
    <Routes>
      <Route path="/" element={<Navigate to={!user ? '/login' : user.mustChangePassword ? '/change-password' : '/dashboard'} replace />} />
      <Route path="/login" element={user ? <Navigate to={user.mustChangePassword ? '/change-password' : '/dashboard'} replace /> : <LoginPage onLogin={setUser} />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/change-password" element={user?.mustChangePassword ? <ChangePasswordPage user={user} onChanged={finishPasswordChange} onLogout={logout} /> : <Navigate to={user ? '/dashboard' : '/login'} replace />} />
      <Route path="/dashboard" element={user && !user.mustChangePassword ? <DashboardPage user={user} onLogout={logout} /> : <Navigate to={user ? '/change-password' : '/login'} replace />} />
      <Route path="/stores" element={user && !user.mustChangePassword && ['ADMIN', 'OWNER'].includes(user.role || '') ? <StoresPage user={user} onLogout={logout} /> : <Navigate to={user ? '/dashboard' : '/login'} replace />} />
      <Route path="/accounts" element={user && !user.mustChangePassword && user.role === 'ADMIN' ? <AdminAccountsPage user={user} onLogout={logout} /> : <Navigate to={user ? '/dashboard' : '/login'} replace />} />
      <Route path="/permission-history" element={user && !user.mustChangePassword && user.role === 'ADMIN' ? <AdminPermissionHistoryPage user={user} onLogout={logout} /> : <Navigate to={user ? '/dashboard' : '/login'} replace />} />
      <Route path="/profile/change-password" element={user && !user.mustChangePassword ? <ProfileChangePasswordPage user={user} onLogout={logout} /> : <Navigate to={user ? '/change-password' : '/login'} replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}
