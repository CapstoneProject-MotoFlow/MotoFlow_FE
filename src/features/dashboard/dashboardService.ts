import axiosClient from '../../shared/api/axiosClient'
import type { DashboardAccount, DashboardData, DashboardProduct, DashboardStore, PermissionHistoryItem } from './dashboardTypes'

type ApiPermissionHistory = Omit<PermissionHistoryItem, 'accountId'>
type ProductPage = { items: DashboardProduct[]; totalItems: number; page: number; size: number }

export async function loadDashboard(role: string): Promise<DashboardData> {
  if (role === 'ADMIN') return loadAdminDashboard()

  const [productsResponse, storesResponse] = await Promise.all([
    axiosClient.get<ProductPage>('/products', { params: { page: 0, size: 8 } }),
    role === 'OWNER' ? axiosClient.get<DashboardStore[]>('/stores') : Promise.resolve({ data: [] as DashboardStore[] }),
  ])

  return {
    accounts: [],
    stores: storesResponse.data,
    products: productsResponse.data.items,
    productCount: productsResponse.data.totalItems,
    permissionHistory: [],
  }
}

async function loadAdminDashboard(): Promise<DashboardData> {
  const [accountsResponse, storesResponse] = await Promise.all([
    axiosClient.get<DashboardAccount[]>('/accounts'),
    axiosClient.get<DashboardStore[]>('/stores'),
  ])
  const accounts = accountsResponse.data
  const history: PermissionHistoryItem[] = []

  // The existing API exposes permission history per account, so load it in small batches.
  for (let start = 0; start < accounts.length; start += 6) {
    const batch = accounts.slice(start, start + 6)
    const results = await Promise.all(batch.map(async (account) => {
      try {
        const response = await axiosClient.get<ApiPermissionHistory[]>(`/accounts/${account.id}/permission-history`)
        return response.data.map((entry) => ({ ...entry, accountId: account.id }))
      } catch {
        return []
      }
    }))
    history.push(...results.flat())
  }

  history.sort((left, right) => right.changedAt.localeCompare(left.changedAt))

  return {
    accounts,
    stores: storesResponse.data,
    products: [],
    productCount: 0,
    permissionHistory: history,
  }
}
