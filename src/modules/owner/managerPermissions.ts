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
      'Không đọc được dữ liệu quyền Branch Manager. Vui lòng thử lại.',
    )
  return value
}
