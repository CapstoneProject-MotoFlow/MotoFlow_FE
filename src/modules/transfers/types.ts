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
  receipts: ({
    id: number
    receiptType: string
    status: string
    arrivedAt: string
  } & ReceiptDocumentInfo)[]
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
/**
 * Chứng từ giao hàng của phiếu nhận điều chuyển (BE trả thêm khi Staff lập phiếu; phiếu cũ có thể không có).
 * Người lập: createdBy hoặc createdByName tùy DTO.
 */
export type ReceiptDocumentInfo = {
  deliveryDocumentNo?: string | null
  deliveryDocumentDate?: string | null
  delivererName?: string | null
  vehiclePlateNo?: string | null
  createdBy?: { id: number; fullName: string } | null
  createdByName?: string | null
  documents?: {
    id: number
    fileName: string
    contentType?: string | null
    downloadUrl: string | null
  }[]
}
export type Receipt = ReceiptDocumentInfo & {
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
export {
  transferStatusLabels as states,
  transferResolutionLabels as resolutionNames,
} from '../../shared/labels/status'
