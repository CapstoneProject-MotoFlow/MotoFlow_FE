export type Evidence = {
  id: number
  fileName: string
  fileSize: number
  downloadUrl: string | null
  uploadedByName: string | null
  uploadedAt: string
}
export type Debtor = {
  customerId: number
  customerName: string
  phone: string
  creditStatus: string
  totalDebt: number
  debt: number
  overdueDebt: number
  openDebtCount: number
  earliestDueDate: string | null
}
export type Debt = {
  id: number
  storeId: number
  storeName: string
  originType: string
  salesOrderId: number | null
  originalAmount: number
  correctionAmount: number
  collectedAmount: number
  remainingAmount: number
  status: string
  dueDate: string
  overdue: boolean
  recognizedAt: string
  evidence: Evidence[]
  recognizedBy: string | null
  settledAt: string | null
  note: string | null
}
export type DebtPayment = {
  id: number
  amount: number
  tenderedAmount: number | null
  changeAmount: number | null
  paymentMethod: string
  transactionReference: string | null
  status: string
  recordedAt: string
  recordedBy: string
  storeName: string
  evidence: Evidence[]
  allocations: {
    receivableId: number
    allocatedAmount: number
    remainingAmount: number
  }[]
}
export type DebtDetail = {
  customerId: number
  customerName: string
  phone: string
  creditStatus: string
  storeId: number | null
  storeName: string | null
  totalDebt: number
  debt: number
  overdueDebt: number
  debts: Debt[]
  payments: DebtPayment[]
}
export type Preview = {
  storeId: number
  amount: number
  eligibleTotal: number
  allocations: {
    receivableId: number
    remainingBefore: number
    allocatedAmount: number
    remainingAfter: number
  }[]
}
