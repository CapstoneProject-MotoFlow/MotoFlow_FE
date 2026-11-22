import { isAxiosError } from 'axios'
import { apiMessage } from '../supplierService'

export type AcceptanceType = 'DAMAGED' | 'WRONG_ITEM'

/** Loại hàng đã trả nhà cung cấp (goodsKind của phiếu trả). Hàng thừa bị từ chối chỉ có khi ghi nhận trả. */
export type GoodsKind = 'WRONG_ITEM' | 'DAMAGED' | 'REJECTED_EXCESS'

export type PendingRequest = {
  type: AcceptanceType
  productId: number | null
  sku: string | null
  partName: string | null
  quantity: number
  note: string | null
  requestedById: number
  requestedByName: string | null
  requestedAt: string
}

export const acceptanceLabels: Record<AcceptanceType, string> = {
  DAMAGED: 'Hàng lỗi vẫn nhận',
  WRONG_ITEM: 'Hàng giao sai',
}

export const goodsKindLabels: Record<GoodsKind, string> = {
  WRONG_ITEM: 'Hàng giao sai',
  DAMAGED: 'Hàng hỏng',
  REJECTED_EXCESS: 'Hàng thừa từ chối',
}

export type CaseEvent = {
  id: number
  type: string
  quantity: number
  goodsKind: GoodsKind | null
  reason: string | null
  recordedByName: string | null
  occurredAt: string
  evidence?: { id: number; fileName: string; downloadUrl: string | null }[]
}

/** Một hồ sơ sai lệch (DiscrepancyCaseResponse của BE). */
export type Case = {
  id: number
  goodsReceiptNoteId: number
  replacementDelivery: boolean
  purchaseOrderId: number | null
  supplierName: string | null
  storeId?: number
  storeName?: string | null
  productId: number
  sku: string
  partName: string
  status: string
  openedAt?: string
  deliveryDate?: string
  /** Số nhận được lúc nhập hàng. */
  shortQty: number
  wrongItemQty: number
  damagedQty: number
  rejectedExcessQty: number
  /** Phần phải trả nhà cung cấp, theo từng loại (đã gồm phần đã trả). */
  returnRequiredQty: number
  wrongReturnRequiredQty: number
  damagedReturnRequiredQty: number
  returnedQty: number
  /** Còn phải trả, theo từng loại. */
  outstandingReturnQty: number
  wrongOutstandingReturnQty: number
  damagedOutstandingReturnQty: number
  excessOutstandingReturnQty: number
  /** Hàng giao sai / hỏng còn giữ tại kho, chưa quyết định. */
  heldUndecidedQty: number
  wrongUndecidedQty: number
  damagedUndecidedQty: number
  replacementRequiredQty: number
  replacementLimitQty: number
  /** Đã giao bù, đã bỏ giao bù và đang chờ giao bù: cộng lại là số giao bù tối thiểu (BE MSG193). */
  replacedQty: number
  waivedQty: number
  pendingReplacementQty: number
  outstandingReplacementQty: number
  openReplacementQty: number
  canHandle: boolean
  canRecordReturn: boolean
  canWaiveReplacement: boolean
  canCreateReplacement?: boolean
  canRequestAcceptance?: boolean
  canApproveAcceptance?: boolean
  pendingRequests?: PendingRequest[]
  events?: CaseEvent[]
}

export function errorMessage(error: unknown) {
  if (!isAxiosError(error))
    return error instanceof Error ? error.message : apiMessage(error)
  const code = error.response?.data?.code
  return code ? code + ' · ' + apiMessage(error) : apiMessage(error)
}
