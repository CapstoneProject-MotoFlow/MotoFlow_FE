import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../shared/hooks/useAuth'

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
