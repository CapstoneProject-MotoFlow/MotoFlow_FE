import type { Evidence } from '../receivables/types'
export type PickLot = {
  lotId: number
  manufacturerLotNo: string | null
  expiryDate: string | null
  availableQty: number
  takeQty: number
}
export type PartLine = {
  productId: number
  sku: string
  partName: string
  baseUnit: string
  plannedQty: number
  preparedQty: number | null
  dispatchedQty: number | null
  receivedQty: number | null
  returnedQty: number | null
  lossQty: number | null
  extraReceivedQty: number | null
  extraDispatchedQty: number | null
  unresolvedQty: number | null
}
/** UC69 list response. Does not include lines or related documents. */
export type ReplenishmentRow = {
  id: number
  requestingStoreId: number
  storeName: string
  status: string
  createdByName: string
  createdAt: string
  lineCount: number
  totalRequestedQty: number
}
/** UC70 detail response. Counts belong only to the list response. */
export type Replenishment = Omit<
  ReplenishmentRow,
  'lineCount' | 'totalRequestedQty'
> & {
  note: string | null
  lines: {
    productId: number
    sku: string
    partName: string
    baseUnit: string
    requestedQty: number
    plannedQty: number
    fulfilledQty: number
    toPurchaseQty: number
    remainingQty: number
  }[]
  transferOrders: { id: number; sourceStoreName: string; status: string }[]
  purchaseOrders: { id: number; supplierName: string; status: string }[]
}
/** UC72 list response. Never use this as a detail response. */
export type TransferRow = {
  id: number
  status: string
  sourceStoreId: number
  sourceStoreName: string
  destStoreId: number
  destStoreName: string
  replenishmentRequestId: number | null
  createdAt: string
  createdByName: string
  lineCount: number
  totalPlannedQty: number
  dispatchedAt: string | null
  closedAt: string | null
}
/** UC73 detail response has people and lines rather than list aggregates. */
export type Transfer = Omit<
  TransferRow,
  'createdByName' | 'lineCount' | 'totalPlannedQty'
> & {
  attachments: Evidence[]
  extraDispatchConfirmedBy: { id: number; fullName: string } | null
  extraDispatchConfirmedAt: string | null
  createdBy: { id: number; fullName: string } | null
  dispatchedBy: { id: number; fullName: string } | null
  closedBy: { id: number; fullName: string } | null
  lines: PartLine[]
  receipts: {
    id: number
    receiptType: string
    status: string
    arrivedAt: string
  }[]
  lots: {
    productId: number
    lotId: number
    manufacturerLotNo: string | null
    expiryDate: string | null
    quantity: number
    unitCost: number | null
  }[]
  discrepancies: {
    id: number
    productId: number
    shortQty: number
    status: string
    events: {
      id: number
      resolutionType: string
      quantity: number
      reason: string | null
      confirmedAt: string | null
    }[]
  }[]
}
export type Receipt = {
  id: number
  transferOrderId: number
  receiptType: string
  status: string
  recordedBy: number | null
  confirmedAt: string | null
  submittedAt: string | null
  confirmedBy: number | null
  arrivedAt: string
  recountReason: string | null
  lines: {
    productId: number
    sku: string
    partName: string
    documentQty: number
    deliveredQty: number
    passedQty: number
    damagedQty: number
    excessQty: number
  }[]
}
export type Preparation = {
  status: string
  id: number
  canRecord: boolean
  preparer: { id: number; name: string; taskStatus: string } | null
  lines: {
    productId: number
    sku: string
    partName: string
    plannedQty: number
    preparedQty: number | null
    shortReason: string | null
    sellableQty: number
    storageArea: string | null
    binLocation: string | null
    barcodes: string[]
    shortQty: number | null
    pickFirst: PickLot[]
  }[]
}
export const states: Record<string, string> = {
  AWAITING_COORDINATION: 'Chờ điều phối',
  IN_PROGRESS: 'Đang đáp ứng',
  AWAITING_DISPATCH: 'Chờ xuất',
  IN_TRANSIT: 'Đang chuyển',
  RECONCILING: 'Đang đối soát',
  CLOSED: 'Đã đóng',
  DRAFT: 'Nháp',
  AWAITING_INSPECTION: 'Chờ kiểm nhận',
  AWAITING_CONFIRMATION: 'Chờ xác nhận',
  AWAITING_RECOUNT: 'Chờ kiểm lại',
  INSPECTING: 'Đang kiểm nhận',
  RESULT_SUBMITTED: 'Đã gửi kết quả',
  CONFIRMED: 'Đã xác nhận',
  OPEN: 'Đang xử lý',
  RESOLVED: 'Đã xử lý',
}
export const resolutionNames: Record<string, string> = {
  MOVED_TO_AWAITING_RETURN: 'Chuyển chờ trả',
  RETURNED_TO_SUPPLIER: 'Đã trả nhà cung cấp',
  REPLACEMENT_RECEIVED: 'Đã nhận hàng thay thế',
  LATE_DELIVERY_RECEIVED: 'Nhận hàng đến muộn',
  RECEIVED_BACK_AT_SOURCE: 'Trả về kho nguồn',
  APPROVED_LOSS: 'Mất/hỏng',
  CLOSED_BY_AGREEMENT: 'Đóng theo thỏa thuận',
}
