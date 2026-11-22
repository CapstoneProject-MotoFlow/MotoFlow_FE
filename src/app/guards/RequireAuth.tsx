/**
 * File: app/guards/RequireAuth.tsx
 * Loại: KIỂM TRA TRUY CẬP — không phải màn hình.
 * Công dụng: Chặn người chưa đăng nhập (ghi trang đang mở vào state `from` để quay lại sau khi đăng nhập); chuyển người đang dùng mật khẩu được cấp sang trang đổi mật khẩu; dùng Outlet để cho route con hiển thị khi hợp lệ.
 */
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../shared/hooks/useAuth'

/** RequireAuth: Chặn người chưa đăng nhập; chuyển người đang dùng mật khẩu được cấp sang trang đổi mật khẩu; dùng Outlet để cho route con hiển thị khi hợp lệ. */
export default function RequireAuth({
  allowPasswordChange = false,
}: {
  allowPasswordChange?: boolean
}) {
  const { user, signedOutByChoice } = useAuth()
  const location = useLocation()
  if (!user)
    return (
      <Navigate
        to="/login"
        replace
        // Sau khi bấm Đăng xuất thì không ghi trang đang mở làm điểm quay lại.
        state={
          signedOutByChoice
            ? undefined
            : { from: location.pathname + location.search + location.hash }
        }
      />
    )
  if (user.mustChangePassword && !allowPasswordChange)
    return <Navigate to="/change-password" replace />
  return <Outlet />
}
