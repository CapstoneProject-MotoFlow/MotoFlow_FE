import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthContext } from '../shared/hooks/useAuth'
import type { AuthUser } from '../shared/types/auth'
import { logout, restoreSession } from '../modules/auth/services/authService'

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const navigate = useNavigate()
  const [restoring, setRestoring] = useState(true)
  useEffect(() => {
    let active = true
    restoreSession().then(nextUser => { if (active) setUser(nextUser) })
      .catch(() => { if (active) setUser(null) })
      .finally(() => { if (active) setRestoring(false) })
    return () => { active = false }
  }, [])
  const value = useMemo(() => ({
    user,
    signIn: (nextUser: AuthUser) => setUser(nextUser),
    signOut: async () => {
      try { await logout() } catch { /* End the local session even when the API is unavailable. */ }
      finally { setUser(null); navigate('/login') }
    },
    finishPasswordChange: () => {
      setUser((current) => current ? { ...current, mustChangePassword: false } : current)
      navigate('/dashboard')
    },
  }), [user, navigate])
  if (restoring) return <main className="empty-state" role="status">Đang khôi phục phiên đăng nhập…</main>
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

