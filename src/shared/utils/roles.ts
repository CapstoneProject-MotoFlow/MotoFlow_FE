/**
 * File: shared/utils/roles.ts
 * Loại: THÀNH PHẦN / XỬ LÝ HỖ TRỢ — không phải màn hình độc lập.
 * Công dụng: Nhãn role tiếng Việt và canEditCatalog kiểm tra quyền sửa danh mục.
 */
import type { AuthUser } from '../types/auth'
export const roleNames: Record<string, string> = {
  ADMIN: 'Admin',
  OWNER: 'Chủ cửa hàng',
  BRANCH_MANAGER: 'Quản lý cửa hàng',
  STAFF: 'Nhân viên',
}

/** canEditCatalog: Kiểm tra user là Owner hoặc BM được cấp CATALOG_EDIT trước khi hiện chức năng sửa danh mục. */
export function canEditCatalog(user: AuthUser | null) {
  return (
    user?.role === 'OWNER' ||
    (user?.role === 'BRANCH_MANAGER' &&
      !!user.permissions?.includes('CATALOG_EDIT'))
  )
}
