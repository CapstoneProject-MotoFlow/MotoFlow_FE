/**
 * File: shared/utils/roles.ts
 * Loại: THÀNH PHẦN / XỬ LÝ HỖ TRỢ — không phải màn hình độc lập.
 * Công dụng: Nhãn role tiếng Việt và canEditCatalog kiểm tra quyền sửa danh mục.
 */
import type { AuthUser } from '../types/auth'
/** roleNames: Nhãn vai trò dùng chung cho mọi màn (theo bảng thuật ngữ). */
export const roleNames: Record<string, string> = {
  ADMIN: 'Quản trị viên',
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

/** homePath: trang mở ra sau khi đăng nhập. PM 22/11: BM vào thẳng màn Tạo đơn bán; vai trò khác vào Tổng quan. */
export function homePath(user: AuthUser | null) {
  return user?.role === 'BRANCH_MANAGER' ? '/sales-orders/new' : '/dashboard'
}

export function canCoordinateTransfers(user: AuthUser | null) {
  return (
    user?.role === 'OWNER' ||
    (user?.role === 'BRANCH_MANAGER' && user.central === true)
  )
}
