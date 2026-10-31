/**
 * File: shared/hooks/useAuth.tsx
 * Loại: THÀNH PHẦN / XỬ LÝ HỖ TRỢ — không phải màn hình độc lập.
 * Công dụng: Định nghĩa AuthContext, AuthContextValue và hook useAuth để component lấy user/signIn/signOut/finishPasswordChange. Hook phải nằm bên trong AuthProvider.
 */
import { createContext, useContext } from 'react'
import type { AuthUser } from '../types/auth'

export type AuthContextValue = {
  user: AuthUser | null
  signIn: (user: AuthUser) => void
  signOut: () => Promise<void>
  finishPasswordChange: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)

/** useAuth: Lấy user và các thao tác phiên từ AuthContext; báo lỗi nếu dùng ngoài AuthProvider. */
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context)
    throw new Error('useAuth phải được dùng bên trong AuthProvider.')
  return context
}
