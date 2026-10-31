import { canEditCatalog } from '../../shared/utils/roles'
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../shared/hooks/useAuth'

export default function RequireCatalogEdit() {
  const { user } = useAuth()
  const allowed = canEditCatalog(user)
  return allowed ? (
    <Outlet />
  ) : (
    <Navigate to="/dashboard" state={{ accessDenied: true }} replace />
  )
}
