import type { SalesOrder } from './salesModel'
/** PM 17/11: nháp đơn bán nằm ở tab "Nháp" của màn Đơn bán (không còn mục "Đơn nháp" trên sidebar). */
export const salesDraftsPath = '/sales-orders?tab=DRAFT'

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
  canRelease?: boolean
  /** PM 21/11: đặt cọc cho đơn chờ hàng (AWAITING_STOCK). */
  canRecordDeposit?: boolean
  canChangeDepositExpiry?: boolean
  canForfeitDeposit?: boolean
  cancelForfeitsDeposit?: boolean
}
/** Loại khoản tiền: thu/hoàn đơn, thu/hoàn nợ, cọc và hoàn cọc. */
export type SalesPaymentType =
  | 'ORDER_PAYMENT'
  | 'REFUND'
  | 'DEBT_PAYMENT'
  | 'DEPOSIT'
  | 'DEPOSIT_REFUND'
/** Trạng thái cọc của đơn (cùng enum với cột depositStatus của danh sách). */
export type DepositStatus =
  | 'NONE'
  | 'ACTIVE'
  | 'EXPIRED'
  | 'FORFEITED'
  | 'SETTLED'
export type DepositExpiryChange = {
  oldDate: string | null
  newDate: string
  changedById: number | null
  changedBy: string | null
  changedAt: string
}
/** Cọc của đơn chờ hàng; null với Staff và đơn nháp. */
export type OrderDeposit = {
  total: number
  unverified: number
  applied: number
  refunded: number
  remaining: number
  /** YYYY-MM-DD */
  expiresOn: string | null
  status: DepositStatus
  forfeitedAmount: number | null
  forfeitedAt: string | null
  forfeitedById: number | null
  forfeitedBy: string | null
  expiryChanges: DepositExpiryChange[]
}
export type OrderDto = {
  id: number
  version: number
  status:
    | 'DRAFT'
    | 'AWAITING_STOCK'
    | 'AWAITING_PICKING'
    | 'PICKED'
    | 'CONFIRMED'
    | 'COMPLETED'
    | 'CANCELLED'
  storeId: number
  storeName: string
  customerId: number | null
  customerName: string | null
  customerPhone: string | null
  note?: string | null
  priceType: 'RETAIL' | 'WHOLESALE'
  discountThreshold?: number | null
  discountRate: number
  createdAt: string
  picker: { id: number; name: string } | null
  total: number | null
  money: {
    payments?: {
      id: number
      type: SalesPaymentType
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
    /** Cọc đã đưa vào đơn này khi nhả đơn chờ; đã nằm trong netCollected. */
    depositApplied?: number
    credit: { amount: number | null } | null
  } | null
  actions: OrderActions
  /** PM 21/11: null với Staff và đơn nháp. */
  deposit?: OrderDeposit | null
  history: { action: string; actorName: string | null; occurredAt: string }[]
  /** BE #79: đơn này tách từ đơn nào ("Tách từ BH-xxx"). */
  splitFromOrderId?: number | null
  split?: OrderSplit | null
  lines: {
    id?: number
    productId: number
    sku: string
    partName: string
    baseUnit: string
    sellableQty?: number
    heldByOthersQty?: number | null
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
export type SalesNextAction =
  | 'RELEASE'
  | 'ASSIGN_PICKER'
  | 'RECORD_PICKING'
  | 'CONFIRM'
  | 'COLLECT_PAYMENT'
  | null

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
  nextAction: SalesNextAction
  /** PM 21/11: null khi đơn không bao giờ có cọc và với Staff. */
  depositStatus?: DepositStatus | null
  depositRemaining?: number | null
  /** YYYY-MM-DD */
  depositExpiresOn?: string | null
}

/**
 * BE #79 (GVHD 20/11): `split` chỉ có trong kết quả của lần gọi tách đơn (tạo đơn, xác nhận giao thiếu,
 * nhả đơn chờ). Mã đơn null khi không có phần nào vào đơn đó; `declined` là phần khách bỏ.
 */
export type OrderSplit = {
  salesOrderId: number | null
  waitingOrderId: number | null
  declinedOrderId: number | null
  declined: { productId: number; quantity: number }[]
}

/** Thông báo sau khi tách đơn: mã đơn bán và đơn chờ (có link ở màn chi tiết), phần khách bỏ báo một lần. */
export function splitNotice(
  split: OrderSplit | null | undefined,
  lines: { productId: number; sku: string }[],
) {
  if (!split) return undefined
  const parts: string[] = []
  if (split.salesOrderId != null)
    parts.push('đơn bán SO-' + split.salesOrderId)
  if (split.waitingOrderId != null)
    parts.push('đơn chờ hàng SO-' + split.waitingOrderId)
  const declined = split.declined
    .filter((item) => item.quantity > 0)
    .map(
      (item) =>
        (lines.find((line) => line.productId === item.productId)?.sku ??
          '#' + item.productId) +
        ' × ' +
        item.quantity,
    )
  if (!parts.length && !declined.length) return undefined
  return (
    (parts.length ? 'Đã tạo ' + parts.join(' và ') + '.' : '') +
    (declined.length ? ' Khách bỏ: ' + declined.join(', ') + '.' : '')
  ).trim()
}

export function orderFromDto(dto: OrderDto): SalesOrder {
  return {
    id: dto.id,
    code: 'SO-' + dto.id,
    splitFromOrderId: dto.splitFromOrderId ?? null,
    version: dto.version,
    status: dto.status,
    storeId: dto.storeId,
    storeName: dto.storeName,
    customerId: dto.customerId,
    customerName: dto.customerName ?? 'Khách lẻ',
    customerPhone: dto.customerPhone,
    note: dto.note ?? null,
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
    depositApplied: dto.money?.depositApplied ?? 0,
    deposit: dto.deposit ?? null,
    actions: dto.actions,
    lines: dto.lines.map((l) => ({
      productId: l.productId,
      lineId: l.id,
      sku: l.sku,
      partName: l.partName,
      baseUnit: l.baseUnit,
      requested: l.requestedQty,
      sellableQty: l.sellableQty,
      heldByOthersQty: l.heldByOthersQty,
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
