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

export type DashboardData = {
  accounts: DashboardAccount[]
  stores: DashboardStore[]
  products: DashboardProduct[]
  productCount: number
  permissionHistory: PermissionHistoryItem[]
}
import type {
  DashboardAccount,
  PermissionHistoryItem,
} from '../../../shared/types/account'
import type { DashboardStore } from '../../../shared/types/store'

export type { DashboardAccount, DashboardStore, PermissionHistoryItem }
