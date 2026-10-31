import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../shared/hooks/useAuth'

export default function RequireRole({ roles }: { roles: string[] }) {
  const { user } = useAuth()
  return user && roles.includes(user.role || '') ? (
    <Outlet />
  ) : (
    <Navigate to="/dashboard" state={{ accessDenied: true }} replace />
  )
}
