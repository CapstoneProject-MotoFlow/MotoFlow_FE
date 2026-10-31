import type { AuthUser } from '../types/auth'
export const roleNames: Record<string, string> = {
  ADMIN: 'Admin',
  OWNER: 'Chủ cửa hàng',
  BRANCH_MANAGER: 'Quản lý cửa hàng',
  STAFF: 'Nhân viên',
}

export function canEditCatalog(user: AuthUser | null) {
  return (
    user?.role === 'OWNER' ||
    (user?.role === 'BRANCH_MANAGER' &&
      !!user.permissions?.includes('CATALOG_EDIT'))
  )
}
