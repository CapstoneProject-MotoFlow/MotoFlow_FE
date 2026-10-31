/**
 * File: app/guards/RequireCatalogEdit.tsx
 * Loại: KIỂM TRA TRUY CẬP — không phải màn hình.
 * Công dụng: Kiểm tra quyền chỉnh danh mục bằng canEditCatalog: Owner hoặc BM có CATALOG_EDIT.
 */
import { canEditCatalog } from '../../shared/utils/roles'
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../shared/hooks/useAuth'

/** RequireCatalogEdit: Kiểm tra quyền chỉnh danh mục bằng canEditCatalog: Owner hoặc BM có CATALOG_EDIT. */
export default function RequireCatalogEdit() {
  const { user } = useAuth()
  const allowed = canEditCatalog(user)
  return allowed ? (
    <Outlet />
  ) : (
    <Navigate to="/dashboard" state={{ accessDenied: true }} replace />
  )
}
