export type DashboardAccount = {
  id: number
  username: string
  fullName: string
  role: string
  status: 'ACTIVE' | 'LOCKED'
  state: 'ACTIVE' | 'TEMPORARILY_LOCKED' | 'LOCKED'
  lastLoginAt: string | null
}

export type DashboardStore = {
  id: number
  storeName: string
  address: string
  phone: string | null
  status: 'PLANNED' | 'ACTIVE' | 'INACTIVE'
  warehouse: { id: number; name: string; central: boolean } | null
  managers: { id: number; fullName: string; phone: string | null }[]
  productsInStock?: number
}

export type DashboardProduct = {
  id: number
  sku: string
  partName: string
  brand: string
  baseUnit: string
  categoryName: string
  status: string
  retailPrice: number | null
  availableQty: number | null
  storageArea: string | null
  binLocation: string | null
}

export type PermissionHistoryItem = {
  id: number
  changeType: string
  permissionCode: string | null
  oldValue: string | null
  newValue: string | null
  reason: string | null
  changedBy: number
  changedByName: string
  changedAt: string
  accountId: number
}

export type DashboardData = {
  accounts: DashboardAccount[]
  stores: DashboardStore[]
  products: DashboardProduct[]
  productCount: number
  permissionHistory: PermissionHistoryItem[]
}
