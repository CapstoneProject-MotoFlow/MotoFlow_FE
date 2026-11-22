import type { DocumentType, PrintForm } from './model'

export type Evidence = {
  id: number
  fileName: string
  downloadUrl: string | null
}

export type DocumentRow = {
  type: DocumentType
  id: number
  number: string
  subType: string | null
  status: string
  documentDate: string
  storeId: number
  storeName: string
  otherStoreName: string | null
  partnerName: string | null
  value: number | null
  printForms: PrintForm[]
}

export type DocumentLink = {
  recordType: string
  id: number
  number: string
  status: string | null
  documentType: DocumentType | null
  note: string | null
}

export type HistoryItem = {
  action: string
  occurredAt: string
  actorName?: string | null
  actor?: Person | null
  reason: string | null
}

export type DocumentLine = {
  id?: number
  productId: number
  sku: string
  partName: string
  baseUnit: string
  deliveredQty?: number | null
  actualUnitPrice?: number | null
  lineTotal?: number | null
  documentQty?: number
  passedQty?: number
  wrongItemQty?: number
  damagedQty?: number
  toStockQty?: number
  unitPrice?: number | null
  plannedQty?: number
  dispatchedQty?: number | null
  receivedQty?: number | null
}

export type DocumentDetail = {
  document: DocumentRow
  content: {
    lines?: DocumentLine[]
    note?: string | null
    createdBy?: string | Person | null
    createdByName?: string | null
    recordedByName?: string | null
    requestedBy?: string | Person | null
    version?: number
    priceType?: string
    deliveryDocumentNo?: string | null
    transferOrderId?: number
    arrivedAt?: string
    confirmedAt?: string | null
    paymentMethod?: string
    paymentType?: string
    amount?: number
    recordedBy?: string
    transactionReference?: string | null
    reason?: string
    documents?: Evidence[]
    attachments?: Evidence[]
    evidence?: Evidence[]
    stockLines?: Array<
      Pick<
        StockEffect,
        | 'sku'
        | 'partName'
        | 'baseUnit'
        | 'lotId'
        | 'manufacturerLotNo'
        | 'quantityChange'
      >
    >
    amountLines?: Array<
      Pick<AmountEffect, 'paymentId' | 'receivableId' | 'amountChange'>
    >
  }
  sources: DocumentLink[]
  related: DocumentLink[]
  adjustments: {
    id: number
    number: string
    adjustmentType: string
    status: string
    reason: string
  }[]
  history: HistoryItem[]
}

export type PrintParty = {
  name: string
  address: string | null
  phone: string | null
  taxCode: string | null
}

export type PrintLayout = 'SMALL' | 'LARGE'

export type PrintLine = {
  no: number
  productId: number | null
  sku: string
  partName: string
  baseUnit: string
  lotId: number | null
  manufacturerLotNo: string | null
  quantity: number
  unitPrice: number | null
  amount: number | null
}

export type PrintTotals = {
  referenceTotal: number | null
  discountAmount: number | null
  discountRate: number | null
  total: number | null
  paid: number | null
  credit: number | null
  deposit: number | null
  amountDue: number | null
}

export type PrintPayment = {
  paymentType:
    | 'ORDER_PAYMENT'
    | 'REFUND'
    | 'DEBT_PAYMENT'
    | 'DEPOSIT'
    | 'DEPOSIT_REFUND'
  paymentMethod: 'CASH' | 'BANK_TRANSFER'
  amount: number
  tenderedAmount: number | null
  changeGiven: number | null
  transactionReference: string | null
  allocations: {
    receivableId: number
    salesOrderId: number | null
    amount: number
  }[]
  depositExpiresOn: string | null
}

export type DocumentPrint = {
  documentType: DocumentType
  form: PrintForm
  id: number
  number: string
  status: string
  documentDate: string
  printedAt: string
  printedBy: string
  store: PrintParty
  counterpart: PrintParty | null
  lines: PrintLine[]
  totals: PrintTotals | null
  payment: PrintPayment | null
  note: string | null
  title: string | null
  layout: PrintLayout | null
}

type Person = { id: number; fullName: string }

type Source = { type: string; id: number; number: string }

export type AdjustmentSummary = {
  id: number
  number: string
  adjustmentType: string
  status: string
  storeName: string
  source: Source | null
  reason: string
  totalValue: number | null
  requestedBy: Person | null
  submittedAt: string | null
}

export type StockEffect = {
  sku: string
  partName: string
  baseUnit: string
  lotId: number | null
  manufacturerLotNo: string | null
  stockStatus: string
  quantityChange: number
  currentQty: number
  afterQty: number
  value: number | null
}

type AmountEffect = {
  paymentId: number | null
  receivableId: number | null
  label: string
  before: number
  after: number
  amountChange: number
}

export type AdjustmentEffects = {
  postingDate: string | null
  stockLines: StockEffect[]
  amountLines: AmountEffect[]
  totalValue: number | null
}

export type AdjustmentDetail = AdjustmentSummary &
  AdjustmentEffects & {
    decisionReason: string | null
    appliedAt: string | null
    evidence: Evidence[]
    history: HistoryItem[]
    actions: {
      canApprove: boolean
      canReject: boolean
      canApply: boolean
      canWithdraw: boolean
    }
  }
