/** Matches BranchManagerResponse and ManagerPermissionsRequest on BE main. */
export type ManagerPermission = 'CATALOG_EDIT' | 'RETAIL_PRICE_EDIT'
export type Manager = {
  id: number
  username: string
  fullName: string | null
  storeId: number | null
  storeName: string | null
  status: string
  catalogEdit: boolean
  retailPriceEdit: boolean
}
/** Nhãn hiển thị của quyền cấp thêm cho quản lý cửa hàng; dùng chung cho mọi màn. */
export const managerPermissionLabels: Record<ManagerPermission, string> = {
  CATALOG_EDIT: 'Sửa danh mục',
  RETAIL_PRICE_EDIT: 'Sửa giá bán lẻ',
}
export function managerPermissionLabel(code: string | null | undefined) {
  if (!code) return ''
  return managerPermissionLabels[code as ManagerPermission] || code
}
export const managerPermissionCodes: ManagerPermission[] = [
  'CATALOG_EDIT',
  'RETAIL_PRICE_EDIT',
]
export function hasManagerPermission(
  row: Manager,
  permission: ManagerPermission,
) {
  return permission === 'CATALOG_EDIT' ? row.catalogEdit : row.retailPriceEdit
}
export function managerPermissionChange(
  row: Manager,
  permission: ManagerPermission,
  reason: string,
) {
  return {
    catalogEdit:
      permission === 'CATALOG_EDIT' ? !row.catalogEdit : row.catalogEdit,
    retailPriceEdit:
      permission === 'RETAIL_PRICE_EDIT'
        ? !row.retailPriceEdit
        : row.retailPriceEdit,
    reason: reason.trim(),
  }
}
export function readManagers(value: unknown): Manager[] {
  if (
    !Array.isArray(value) ||
    value.some(
      (row) =>
        !row ||
        !Number.isSafeInteger(row.id) ||
        row.id < 1 ||
        typeof row.username !== 'string' ||
        (row.fullName != null && typeof row.fullName !== 'string') ||
        (row.storeName != null && typeof row.storeName !== 'string') ||
        typeof row.catalogEdit !== 'boolean' ||
        typeof row.retailPriceEdit !== 'boolean',
    )
  )
    throw new Error(
      'Không đọc được dữ liệu quyền của quản lý cửa hàng. Vui lòng thử lại.',
    )
  return value
}
