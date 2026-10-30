export type DashboardStore = {
  id: number
  storeName: string
  address: string
  phone: string | null
  status: 'PLANNED' | 'ACTIVE' | 'INACTIVE'
  central: boolean
  managers: { id: number; fullName: string; phone: string | null }[]
  productsInStock?: number
}
