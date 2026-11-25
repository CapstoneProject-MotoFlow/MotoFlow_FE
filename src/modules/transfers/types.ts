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
  /** BE #98: số hỏng khi nhận (Đã nhận = số đạt); null với Staff. */
  damagedQty?: number | null
  /**
   * PM 23/11: số thiếu = đã xuất − đạt − hỏng − mất − không giao bù; hàng giao sai không tính là thiếu. unresolvedQty
   * là phần thiếu chưa ai chọn Nhận sau hay Không cần giao bù (Chờ quyết). null với Staff.
   */
  shortageQty?: number | null
  /** PM 23/11: giao sai (mặt hàng khác mặt hàng yêu cầu) ghi khi kiểm nhận. */
  wrongItemQty?: number | null
  /** Giao sai chưa lập phiếu nhận hàng giao sai và chưa hoàn trả. */
  wrongPendingQty?: number | null
  /** GVHD 24/11: giao sai trên phiếu nhận hàng giao sai đang chờ BM kho gửi xác nhận. */
  wrongAwaitingSourceQty?: number | null
  /** GVHD 24/11: giao sai trên phiếu kho gửi đã xác nhận (đã nhập kho nhận). */
  wrongConfirmedQty?: number | null
  /** GVHD 24/11: giao sai đã hoàn trả kho gửi (không đổi tồn). */
  wrongReturnedQty?: number | null
  /** Không cần giao bù: khi Owner đóng phiếu cộng lại tồn khả dụng kho gửi. */
  noReplacementQty?: number | null
  /** Nhận sau: chưa tới. */
  latePendingQty?: number | null
  /** Owner đã sửa dòng theo "Bên nhận kiểm sai": kho nhận có đủ số đã xuất. */
  receiverMiscounted?: boolean | null
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
  awaitingReceiptConfirmation: boolean
}
/** UC73 detail response has people and lines rather than list aggregates. */
export type Transfer = Omit<
  TransferRow,
  'createdByName' | 'lineCount' | 'totalPlannedQty'
> & {
  /** GVHD 24/11: ảnh yêu cầu đối soát có purpose RECONCILIATION. */
  attachments: (Evidence & { purpose?: string | null })[]
  extraDispatchConfirmedBy: { id: number; fullName: string } | null
  extraDispatchConfirmedAt: string | null
  createdBy: { id: number; fullName: string } | null
  dispatchedBy: { id: number; fullName: string } | null
  delivererName?: string | null
  vehiclePlateNo?: string | null
  closedBy: { id: number; fullName: string } | null
  /** GVHD 24/11: BM kho nhận đã gửi yêu cầu đối soát (cột cũ "xác nhận xử lý"). */
  discrepancyAcknowledgedBy?: { id: number; fullName: string } | null
  discrepancyAcknowledgedAt?: string | null
  reconciliationNote?: string | null
  /** GVHD 24/11: BM kho gửi xác nhận đối soát; có cả hai bước thì Owner mới đóng phiếu (MSG363). */
  reconciliationConfirmedBy?: { id: number; fullName: string } | null
  reconciliationConfirmedAt?: string | null
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
    /** BE #98: hồ sơ giao sai / hỏng cũng cần kho nhận xác nhận (MSG336). */
    wrongItemQty?: number
    damagedQty?: number
    status: string
    events: {
      id: number
      resolutionType: string
      quantity: number
      reason: string | null
      confirmedAt: string | null
      /**
       * PM 23/11: phiếu nhận hàng giao sai (RECEIVED_AS_OTHER_PRODUCT): phụ tùng thực nhận, HSD, trạng thái.
       * GVHD 24/11: hoàn trả (WRONG_ITEM_RETURNED) cũng có phụ tùng thực nhận; phiếu bị từ chối có lý do.
       */
      receivedProductId?: number | null
      receivedSku?: string | null
      receivedPartName?: string | null
      receivedExpiryDate?: string | null
      status?: 'AWAITING_SOURCE' | 'CONFIRMED' | 'REJECTED' | 'CANCELLED' | null
      recordedBy?: { id: number; fullName: string } | null
      confirmedBy?: { id: number; fullName: string } | null
      rejectedBy?: { id: number; fullName: string } | null
      rejectedAt?: string | null
      rejectionReason?: string | null
      attachments?: Evidence[]
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
  recordedByName?: string | null
  confirmedAt: string | null
  submittedAt: string | null
  confirmedBy: number | null
  arrivedAt: string
  recountReason: string | null
  inspectionNote?: string | null
  lines: {
    productId: number
    sku: string
    partName: string
    documentQty: number
    deliveredQty: number
    passedQty: number
    damagedQty: number
    /** PM 23/11: số hỏng ghi vượt số đã xuất, chỉ lưu trên phiếu, không đổi tồn (damagedQty là phần trong số xuất). */
    damagedBeyondQty?: number
    wrongItemQty: number
    excessQty: number
    /** BE #98: dòng phiếu, HSD bên nhận ghi cho hàng thừa, quyết định của Owner. */
    lineId?: number | null
    expiryDate?: string | null
    excessDecision?: string | null
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
