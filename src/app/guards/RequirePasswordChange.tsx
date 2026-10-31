/**
 * File: app/guards/RequirePasswordChange.tsx
 * Loại: KIỂM TRA TRUY CẬP — không phải màn hình.
 * Công dụng: Chỉ mở luồng đổi mật khẩu bắt buộc cho user có mustChangePassword.
 */
import { Navigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../../shared/hooks/useAuth'

/** RequirePasswordChange: Chỉ mở luồng đổi mật khẩu bắt buộc cho user có mustChangePassword. */
export default function RequirePasswordChange({
  children,
}: {
  children: ReactNode
}) {
  const { user } = useAuth()
  return user?.mustChangePassword ? (
    children
  ) : (
    <Navigate to="/dashboard" replace />
  )
}
