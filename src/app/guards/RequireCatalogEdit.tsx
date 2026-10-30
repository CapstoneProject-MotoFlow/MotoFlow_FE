import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../shared/hooks/useAuth'

export default function RequireCatalogEdit() {
  const { user } = useAuth()
  const allowed =
    user?.role === 'OWNER' ||
    (user?.role === 'BRANCH_MANAGER' &&
      user.permissions?.some((permission) =>
        ['CATALOG_EDIT', 'PERM_CATALOG_EDIT'].includes(permission),
      ))
  return allowed ? <Outlet /> : <Navigate to="/dashboard" replace />
}
