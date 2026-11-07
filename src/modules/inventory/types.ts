export type Page<T> = {
  items: T[]
  totalItems: number
  page: number
  size: number
}

export type StockRow = {
  storeId: number
  storeName: string
  productId: number
  sku: string
  partName: string
  baseUnit: string
  productStatus: string
  storageArea: string | null
  binLocation: string | null
  lowStockThreshold: number | null
  availableQty: number
  awaitingInspectionQty: number
  wrongItemQty: number
  damagedQty: number
  awaitingSupplierReturnQty: number
  inTransitQty: number
  onHandQty: number
  nearExpiryQty: number
  expiredQty: number
  lowStock: boolean
  stockValue: number | null
}
export type StockSummary = {
  withStock: number
  lowStock: number
  unavailable: number
  expiryAlert: number
}
export type StockDetail = {
  stock: StockRow
  movingAvgCost: number | null
  expiryWarningDays: number | null
  lots: {
    lotId: number
    sourceType: string
    receivedDate: string
    supplierId: number | null
    supplierName: string | null
    manufacturerLotNo: string | null
    expiryDate: string | null
    expiryState: string
    stockStatus: string
    quantity: number
    purchaseUnitPrice: number | null
  }[]
}
export type Movement = {
  id: number
  occurredAt: string
  storeId: number
  productId: number
  sku: string
  lotId: number | null
  movementType: string
  stockStatus: string
  quantityChange: number
  sourceType: string
  sourceId: number
  reason: string | null
  performedBy: number
  performedByName: string | null
  unitCost: number | null
  value: number | null
}
export type LotRow = {
  lotId: number
  storeId: number
  storeName: string
  productId: number
  sku: string
  partName: string
  baseUnit: string
  sourceType: string
  supplierId: number | null
  supplierName: string | null
  manufacturerLotNo: string | null
  manufactureDate: string | null
  expiryDate: string | null
  daysToExpiry: number | null
  remainingQty: number
  receivedDate: string
}
export type LotList = { expiryWarningDays: number | null; page: Page<LotRow> }
export type LotDetail = Omit<LotRow, 'storeId' | 'storeName'> & {
  state: string
  sourceDocument: { type: string; id: number } | null
  firstStoreId: number
  firstStoreName: string
  receivedQty: number
  viewStoreId: number
  byStatus: { stockStatus: string; quantity: number }[]
  movements: Movement[]
  purchaseUnitPrice: number | null
  issueOrder: {
    lotId: number
    expiryDate: string | null
    receivedDate: string
    availableQty: number
    current: boolean
    skipped: boolean
  }[]
}
export type WarningVersion = {
  days: number
  effectiveFrom: string
  setBy: number
  setByName: string
}
export type ExpiryWarning = {
  inEffect: WarningVersion | null
  waiting: WarningVersion | null
  history: WarningVersion[]
}
