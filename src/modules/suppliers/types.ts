export type Supplier = {
  id: number
  supplierCode: string
  supplierName: string
  contactName: string | null
  phone: string | null
  email: string | null
  address: string | null
  taxCode: string | null
  status: 'ACTIVE' | 'INACTIVE'
}
