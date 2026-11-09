import type { Page } from './types'
import type { StockCount } from './stockCountModel'
export type CountRequest = {
  id: number
  storeId: number
  storeName: string
  scopeType: 'WHOLE' | 'AREA' | 'PRODUCTS'
  scopeNote: string | null
  reason: string
  status: 'PENDING' | 'DONE' | 'CANCELLED'
  requestedByName: string
  requestedAt: string
  products: { productId: number; sku: string; partName: string }[]
}
export type CountRow = {
  id: number
  storeId: number
  storeName: string
  countType: StockCount['type']
  countDate: string
  scopeType: string
  scopeNote: string | null
  status: StockCount['status']
  createdAt: string
}
export type CountList = {
  counts: Page<CountRow>
  pendingRequests: CountRequest[]
}
export type CountDto = CountRow & {
  createdByName: string
  countingStartedAt: string | null
  confirmedBy: number | null
  confirmedAt: string | null
  approvedBy: number | null
  approvedAt: string | null
  cancelledBy: number | null
  cancelledAt: string | null
  cancellationReason: string | null
  decisionReason: string | null
  awaitingBookQuantities: boolean
  request: CountRequest | null
  lines: {
    id: number
    productId: number
    sku: string
    partName: string
    baseUnit: string
    lotId: number | null
    expiryDate: string | null
    storageArea: string | null
    binLocation: string | null
    bookQty: number | null
    countedQty: number | null
    difference: number | null
    differenceValue: number | null
    reason: string | null
    recountRequested: boolean
    recountReason: string | null
    countedAt: string | null
  }[]
}
export function countScope(type: string, note: string | null) {
  return type === 'WHOLE'
    ? 'Toàn kho'
    : type === 'AREA'
      ? 'Khu vực ' + (note ?? '')
      : 'Theo phụ tùng'
}
export function countFromDto(dto: CountDto): StockCount {
  return {
    id: dto.id,
    code: 'KK-' + String(dto.id).padStart(4, '0'),
    storeId: dto.storeId,
    storeName: dto.storeName,
    type: dto.countType,
    status: dto.status,
    countDate: dto.countDate,
    scopeLabel: countScope(dto.scopeType, dto.scopeNote),
    cancellationReason: dto.cancellationReason,
    recountReason:
      [...new Set(dto.lines.map((l) => l.recountReason).filter(Boolean))].join(
        '; ',
      ) || null,
    sourceReason: dto.request?.reason,
    sourceLabel: dto.request
      ? 'Yêu cầu #' + dto.request.id
      : 'Quản lý cửa hàng',
    assigneeName: null,
    submittedAt: null,
    createdByName: dto.createdByName,
    createdAt: dto.createdAt,
    confirmedByName: dto.confirmedBy == null ? null : '#' + dto.confirmedBy,
    confirmedAt: dto.confirmedAt,
    approvedByName: dto.approvedBy == null ? null : '#' + dto.approvedBy,
    approvedAt: dto.approvedAt,
    lines: dto.lines.map((l) => ({
      ...l,
      lotCode: l.lotId == null ? null : '#' + l.lotId,
      note: null,
      recount: l.recountRequested,
      unitCost: null,
      differenceValue: l.differenceValue,
    })),
    events: [],
  }
}
