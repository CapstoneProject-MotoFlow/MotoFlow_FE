import type { SalesOrder } from './salesModel'
export type OrderActions = {
  canUpdate: boolean
  canAssignPicker: boolean
  canRecordPicking: boolean
  canConfirm: boolean
  canRecordPayment: boolean
  canRefund: boolean
  canRecordCredit: boolean
  canComplete: boolean
  canCancel: boolean
}
export type OrderDto = {
  id: number
  version: number
  status:
    'AWAITING_PICKING' | 'PICKED' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED'
  storeId: number
  storeName: string
  customerId: number | null
  customerName: string | null
  customerPhone: string | null
  priceType: 'RETAIL' | 'WHOLESALE'
  discountThreshold?: number | null
  discountRate: number
  createdAt: string
  picker: { id: number; name: string } | null
  total: number | null
  money: {
    payments?: {
      id: number
      type: string
      method: string
      amount: number
      status: string
      recordedAt: string
      recordedBy: string | null
    }[]
    netCollected: number
    remainingPayable: number
    refundable: number
    payableNow: number
    credit: { amount: number | null } | null
  } | null
  actions: OrderActions
  history: { action: string; actorName: string | null; occurredAt: string }[]
  lines: {
    productId: number
    sku: string
    partName: string
    baseUnit: string
    sellableQty?: number
    requestedQty: number
    pickedQty: number | null
    deliveredQty: number | null
    referencePrice: number | null
    actualUnitPrice: number | null
    binLocation: string | null
    shortReason: string | null
    barcodes: string[]
    pickFirst: { lotId: number; expiryDate: string | null; takeQty: number }[]
  }[]
}
export type SummaryDto = {
  id: number
  version: number
  status: OrderDto['status']
  storeId: number
  storeName: string
  customerName: string | null
  createdAt: string
  total: number | null
  pickerName: string | null
  nextAction:
    'ASSIGN_PICKER' | 'RECORD_PICKING' | 'CONFIRM' | 'COLLECT_PAYMENT' | null
}
export function orderFromDto(dto: OrderDto): SalesOrder {
  return {
    id: dto.id,
    code: 'SO-' + dto.id,
    version: dto.version,
    status: dto.status,
    storeId: dto.storeId,
    storeName: dto.storeName,
    customerId: dto.customerId,
    customerName: dto.customerName ?? 'Khách lẻ',
    customerPhone: dto.customerPhone,
    priceType: dto.priceType,
    discount: Number(dto.discountRate ?? 0),
    discountThreshold: dto.discountThreshold,
    createdAt: dto.createdAt,
    assigneeName: dto.picker?.name ?? null,
    netPaid: dto.money?.netCollected ?? 0,
    payments: dto.money?.payments ?? [],
    credit: dto.money?.credit?.amount ?? 0,
    total: dto.total,
    payableNow: dto.money?.payableNow,
    refundable: dto.money?.refundable,
    remainingPayable: dto.money?.remainingPayable,
    actions: dto.actions,
    lines: dto.lines.map((l) => ({
      productId: l.productId,
      sku: l.sku,
      partName: l.partName,
      baseUnit: l.baseUnit,
      requested: l.requestedQty,
      sellableQty: l.sellableQty,
      picked: l.pickedQty,
      delivered: l.deliveredQty,
      retailPrice: l.referencePrice,
      actualUnitPrice: l.actualUnitPrice,
      binLocation: l.binLocation,
      short: !!l.shortReason,
      shortReason: l.shortReason ?? '',
      barcodes: l.barcodes,
      lotHint: l.pickFirst
        ?.map(
          (lot) =>
            'Lô ' +
            lot.lotId +
            ' · ' +
            (lot.expiryDate ?? 'không hạn dùng') +
            ' · lấy ' +
            lot.takeQty,
        )
        .join('; '),
    })),
    versions: [],
    events:
      dto.history?.map((h) => ({
        at: h.occurredAt,
        by: h.actorName ?? '',
        text: h.action,
      })) ?? [],
  }
}
export type UnmetRow = {
  customerId: number | null
  orderId: number
  storeId: number
  storeName: string
  customerName: string | null
  productId: number
  sku: string
  partName: string
  baseUnit: string
  missingQty: number
  sellableQty: number
  occurredAt: string
}
