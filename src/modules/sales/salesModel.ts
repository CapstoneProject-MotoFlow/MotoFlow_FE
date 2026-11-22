import type {
  OrderActions,
  OrderDeposit,
  SalesPaymentType,
} from './salesApi'
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
    type: SalesPaymentType
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
  /** Cọc đã đưa vào đơn này khi nhả đơn chờ (đã tính trong netPaid). */
  depositApplied: number
  /** PM 21/11: null với Staff và đơn nháp. */
  deposit: OrderDeposit | null
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
 * (suggestedNow) hoặc min(cần, còn bán được); không vượt số còn bán được vì BE chỉ bán ngay tối đa số đó.
 * Phần lấy sau luôn chờ hàng (BE tự tách đơn cho khách có hồ sơ). Khách lẻ không tách: truyền sellable null.
 */
export function splitLine(input: {
  requested: number
  sellable?: number | null
  suggestedNow?: number | null
  nowQty?: number | null
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
  }
}

/**
 * Góp ý UI 21/11 (#8): khách lẻ (không hồ sơ) chỉ mua được số đang có. Trả số còn bán được khi dòng xin nhiều hơn,
 * null khi đủ. Chỉ áp dụng khi tạo đơn mới (BE update không kiểm MSG332) và theo sellableQty của preview;
 * chưa có preview (null/undefined) thì không chặn.
 */
export function walkInShortLeft(input: {
  walkIn: boolean
  editing: boolean
  quantity: number
  previewSellable?: number | null
}): number | null {
  if (!input.walkIn || input.editing) return null
  const left = input.previewSellable
  if (left == null || !Number.isFinite(left)) return null
  return input.quantity > left ? Math.max(0, left) : null
}

/** Câu báo trên dòng của khách lẻ xin nhiều hơn số còn bán được. */
export function walkInShortageText(sellable: number) {
  return `Khách lẻ chỉ mua được số đang có: còn ${sellable}. Tạo hồ sơ khách để chờ hàng.`
}

/**
 * Góp ý UI 21/11: các dòng gửi tạo đơn kèm nowQty (số lấy ngay). Không có waitForRest: BE tự cho phần còn lại
 * chờ hàng (khách có hồ sơ) hoặc bỏ (khách lẻ không tách). Dòng không có trong bảng lấy ngay giữ nguyên số lượng.
 */
export function orderLinesWithNowQty<T extends { productId: number; quantity: number }>(
  lines: T[],
  takeNowByProduct: Map<number, number>,
) {
  return lines.map((line) => ({
    ...line,
    nowQty: takeNowByProduct.get(line.productId) ?? line.quantity,
  }))
}
