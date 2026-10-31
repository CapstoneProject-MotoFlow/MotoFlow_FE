/**
 * File: app/guards/RequireRole.tsx
 * Loại: KIỂM TRA TRUY CẬP — không phải màn hình.
 * Công dụng: Chỉ cho các vai trò được khai báo truy cập route; nếu bị từ chối chuyển về dashboard kèm trạng thái để hiện MSG05.
 */
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../shared/hooks/useAuth'

/** RequireRole: Chỉ cho các vai trò được khai báo truy cập route; nếu bị từ chối chuyển về dashboard kèm trạng thái để hiện MSG05. */
export default function RequireRole({ roles }: { roles: string[] }) {
  const { user } = useAuth()
  return user && roles.includes(user.role || '') ? (
    <Outlet />
  ) : (
    <Navigate to="/dashboard" state={{ accessDenied: true }} replace />
  )
}
