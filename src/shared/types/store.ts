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
