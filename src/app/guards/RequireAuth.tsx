/**
 * File: app/guards/RequireAuth.tsx
 * Loại: KIỂM TRA TRUY CẬP — không phải màn hình.
 * Công dụng: Chặn người chưa đăng nhập; chuyển người đang dùng mật khẩu được cấp sang trang đổi mật khẩu; dùng Outlet để cho route con hiển thị khi hợp lệ.
 */
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../shared/hooks/useAuth'

/** RequireAuth: Chặn người chưa đăng nhập; chuyển người đang dùng mật khẩu được cấp sang trang đổi mật khẩu; dùng Outlet để cho route con hiển thị khi hợp lệ. */
export default function RequireAuth({
  allowPasswordChange = false,
}: {
  allowPasswordChange?: boolean
}) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (user.mustChangePassword && !allowPasswordChange)
    return <Navigate to="/change-password" replace />
  return <Outlet />
}
