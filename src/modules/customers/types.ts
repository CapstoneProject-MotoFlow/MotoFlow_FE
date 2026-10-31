export type Customer = {
  id: number
  customerName: string
  phone: string | null
  address: string | null
  taxCode: string | null
  totalDebt: number
  debtAtOwnStore: number | null
  creditStatus: string
  createdAt: string
  updatedAt: string
}
