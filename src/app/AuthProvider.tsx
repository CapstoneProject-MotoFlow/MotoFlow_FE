/**
 * File: app/AuthProvider.tsx
 * Loại: THÀNH PHẦN / XỬ LÝ HỖ TRỢ — không phải màn hình độc lập.
 * Công dụng: Quản lý user đăng nhập trong React Context; khôi phục phiên; xử lý hết phiên, đăng nhập, đăng xuất và hoàn tất đổi mật khẩu; bổ sung tên cửa hàng từ dữ liệu home.
 */
import { getHome } from '../shared/api/homeService'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthContext } from '../shared/hooks/useAuth'
import type { AuthUser } from '../shared/types/auth'
import { logout, restoreSession } from '../modules/auth/services/authService'

/** AuthProvider: Quản lý user đăng nhập trong React Context; khôi phục phiên; xử lý hết phiên, đăng nhập, đăng xuất và hoàn tất đổi mật khẩu; bổ sung tên cửa hàng từ dữ liệu home. */
export default function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const currentUser = useRef(user)
  currentUser.current = user
  const navigate = useNavigate()
  const [restoring, setRestoring] = useState(true)
  useEffect(() => {
    let active = true
    restoreSession()
      .then((nextUser) => {
        if (active) setUser(nextUser)
      })
      .catch(() => {
        if (active) setUser(null)
      })
      .finally(() => {
        if (active) setRestoring(false)
      })
    return () => {
      active = false
    }
  }, [])
  useEffect(() => {
    const expired = () => {
      if (!currentUser.current) return
      setUser(null)
      navigate('/login', { replace: true })
    }
    window.addEventListener('auth-session-expired', expired)
    return () => window.removeEventListener('auth-session-expired', expired)
  }, [navigate])
  useEffect(() => {
    if (!user?.storeId) return
    let active = true
    const accountId = user.id
    getHome()
      .then((response) => {
        if (active && response.data.storeName)
          setUser((current) =>
            current && current.id === accountId
              ? { ...current, storeName: response.data.storeName! }
              : current,
          )
      })
      .catch(() => {
        /* Keep authentication valid if store display lookup fails. */
      })
    return () => {
      active = false
    }
  }, [user?.id, user?.storeId])
  const value = useMemo(
    () => ({
      user,
      signIn: (nextUser: AuthUser) => setUser(nextUser),
      signOut: async () => {
        try {
          await logout()
        } catch {
          /* End the local session even when the API is unavailable. */
        } finally {
          setUser(null)
          navigate('/login')
        }
      },
      finishPasswordChange: () => {
        setUser((current) =>
          current ? { ...current, mustChangePassword: false } : current,
        )
        navigate('/dashboard')
      },
    }),
    [user, navigate],
  )
  if (restoring)
    return (
      <main className="empty-state" role="status">
        Đang khôi phục phiên đăng nhập…
      </main>
    )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
