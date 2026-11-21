import type { OrderActions } from './salesApi'
/** UI model mapped from the BE sales DTO. */
export type SalesStatus =
  | 'DRAFT'
  | 'AWAITING_STOCK'
  | 'AWAITING_PICKING'
  | 'PICKED'
  | 'CONFIRMED'
  | 'COMPLETED'
  | 'CANCELLED'
export type SalesLine = {
  lineId?: number
  sellableQty?: number
  heldByOthersQty?: number | null
  shortReason?: string
  barcodes?: string[]
  actualUnitPrice?: number | null
  productId: number
  sku: string
  partName: string
  baseUnit: string
  requested: number
  picked: number | null
  delivered: number | null
  retailPrice: number | null
  binLocation?: string | null
  lotHint?: string | null
  short?: boolean
}
export type SalesOrder = {
  /** BE #79: đơn gốc khi đơn này được tách ra (đơn chờ hàng hoặc đơn bán nhả từ đơn chờ). */
  splitFromOrderId?: number | null
  nextAction?: string | null
  payments?: {
    id: number
    type: string
    method: string
    amount: number
    status: string
    recordedAt: string
    recordedBy: string | null
  }[]
  id: number
  storeId?: number
  customerId?: number | null
  customerPhone?: string | null
  note?: string | null
  total?: number | null
  payableNow?: number
  refundable?: number
  remainingPayable?: number
  actions?: OrderActions
  code: string
  version: number
  storeName: string
  customerName: string
  priceType: 'RETAIL' | 'WHOLESALE'
  discountThreshold?: number | null
  discount: number
  status: SalesStatus
  createdAt: string
  assigneeName: string | null
  netPaid: number
  /** Tiền cọc còn giữ. Hủy mà không hoàn thì mất số này khi actions.cancelForfeitsDeposit. */
  depositRemaining?: number
  credit: number
  lines: SalesLine[]
  versions: { version: number; at: string; by: string }[]
  events: { at: string; by: string; text: string }[]
}
export function validQuantity(value: number) {
  return Number.isSafeInteger(value) && value >= 0 && value <= 100000
}
export function suggestedPickingQty(requested: number, sellableQty?: number | null) {
  return Math.max(0, Math.min(requested, sellableQty ?? requested))
}
export function discountedPrice(price: number, discount: number) {
  return Math.round(price * (1 - discount / 100))
}
export function salesTotal(
  lines: { quantity: number; price: number | null }[],
  discount: number,
): number | null {
  if (
    !Number.isFinite(discount) ||
    discount < 0 ||
    discount >= 100 ||
    lines.some(
      (l) =>
        l.price == null ||
        !Number.isSafeInteger(l.price) ||
        l.price < 0 ||
        !validQuantity(l.quantity),
    )
  )
    return null
  const total = lines.reduce(
    (sum, l) => sum + discountedPrice(l.price!, discount) * l.quantity,
    0,
  )
  return Number.isSafeInteger(total) ? total : null
}
export function mayCancel(order: Pick<SalesOrder, 'status' | 'netPaid'>) {
  return (
    order.status !== 'COMPLETED' &&
    order.status !== 'CANCELLED' &&
    order.netPaid === 0
  )
}
export function pickedReady(
  lines: { requested: number; picked: number | null; short?: boolean }[],
) {
  return (
    lines.length > 0 &&
    lines.every(
      (l) =>
        l.picked != null &&
        validQuantity(l.picked) &&
        l.picked <= l.requested &&
        (l.picked === l.requested || l.short),
    )
  )
}

export function cashCollection(input: string, payable: number) {
  const cash = Number(input)
  if (
    !/^\d+$/.test(input) ||
    !Number.isSafeInteger(cash) ||
    cash <= 0 ||
    cash > 100000000000 ||
    !Number.isSafeInteger(payable) ||
    payable <= 0
  )
    return null
  const amount = Math.min(cash, payable)
  return { amount, tenderedAmount: cash, changeGiven: cash - amount }
}

/**
 * BH2 (GVHD 20/11): chia một dòng thành "lấy ngay" và "lấy sau". Mặc định lấy ngay = số BE gợi ý
 * (suggestedNowQty) hoặc min(cần, còn bán được); không vượt số còn bán được vì BE chỉ bán ngay tối đa số đó.
 * waitForRest mặc định bật; bỏ tích thì phần lấy sau là khách bỏ.
 */
export function splitLine(input: {
  requested: number
  sellable?: number | null
  suggestedNow?: number | null
  nowQty?: number | null
  waitForRest?: boolean
}) {
  const requested = Number.isFinite(input.requested)
    ? Math.max(0, input.requested)
    : 0
  const sellable =
    input.sellable == null || !Number.isFinite(input.sellable)
      ? null
      : Math.max(0, input.sellable)
  const nowLimit = sellable == null ? requested : Math.min(requested, sellable)
  const defaultNow =
    input.suggestedNow != null
      ? Math.min(requested, Math.max(0, input.suggestedNow))
      : nowLimit
  const wanted =
    input.nowQty != null && Number.isFinite(input.nowQty)
      ? input.nowQty
      : defaultNow
  const takeNow = Math.min(nowLimit, Math.max(0, wanted))
  return {
    takeNow,
    later: requested - takeNow,
    waitForRest: input.waitForRest ?? true,
  }
}
