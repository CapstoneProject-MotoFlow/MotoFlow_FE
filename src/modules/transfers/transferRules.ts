export function transferQuantitiesValid(
  lines: { productId: number; quantity: number }[],
  allowZero = false,
) {
  return (
    lines.length > 0 &&
    lines.length <= 200 &&
    new Set(lines.map((l) => l.productId)).size === lines.length &&
    lines.every(
      (l) =>
        Number.isSafeInteger(l.productId) &&
        l.productId > 0 &&
        Number.isInteger(l.quantity) &&
        l.quantity >= (allowZero ? 0 : 1) &&
        l.quantity <= 2147483647,
    )
  )
}
/** Submitted receipts need confirmation or recount before editing. */
export function receiptAcceptsResult(status: string | undefined) {
  return status === 'AWAITING_INSPECTION' || status === 'AWAITING_RECOUNT'
}
type Demand = {
  requestedQty: number
  plannedQty: number
  toPurchaseQty: number
}
/** Only cancelled purchase orders permit starting another purchase for the request. */
export function hasExistingPurchase(orders: { status: string }[]) {
  return orders.some((order) => order.status !== 'CANCELLED')
}
/** Outstanding receipt quantities must not be reused to plan another dispatch. */
export function unplannedQuantity(line: Demand | undefined) {
  return line
    ? Math.max(0, line.requestedQty - line.plannedQty - line.toPurchaseQty)
    : 0
}
export function purchaseQuantityLimit(
  line: Pick<Demand, 'requestedQty' | 'plannedQty'>,
) {
  return Math.max(0, line.requestedQty - line.plannedQty)
}
export function pendingExcess(line: {
  extraReceivedQty: number | null
  extraDispatchedQty: number | null
}) {
  return Math.max(
    0,
    (line.extraReceivedQty ?? 0) - (line.extraDispatchedQty ?? 0),
  )
}
export function canConfirmExcess(
  status: string,
  lines: Parameters<typeof pendingExcess>[0][],
) {
  return status === 'RECONCILING' && lines.some((l) => pendingExcess(l) > 0)
}
export function returnableQuantities(
  order: {
    lines: { productId: number; sku: string }[]
    discrepancies: {
      productId: number
      events: {
        resolutionType: string
        quantity: number
        confirmedAt: string | null
      }[]
    }[]
  },
  receipts: { lines: { productId: number; documentQty: number }[] }[],
) {
  return order.lines
    .map((line) => {
      const decided = order.discrepancies
          .filter((c) => c.productId === line.productId)
          .flatMap((c) => c.events)
          .filter(
            (e) =>
              e.resolutionType === 'RECEIVED_BACK_AT_SOURCE' &&
              e.confirmedAt == null,
          )
          .reduce((s, e) => s + e.quantity, 0),
        opened = receipts
          .flatMap((r) => r.lines)
          .filter((l) => l.productId === line.productId)
          .reduce((s, l) => s + l.documentQty, 0)
      return {
        productId: line.productId,
        sku: line.sku,
        quantity: Math.max(0, decided - opened),
      }
    })
    .filter((l) => l.quantity > 0)
}

/**
 * Thiếu của một dòng phiếu nhận điều chuyển (PM 23/11): số đã xuất trừ đạt và hỏng. Giao sai là phụ tùng khác, không
 * trừ vào thiếu. Không dùng deliveredQty của BE vì số đó cộng cả giao sai (BR-24, test 23/11 T-11).
 */
export function receiptShortage(line: {
  documentQty: number
  passedQty: number
  damagedQty: number
}) {
  return Math.max(0, line.documentQty - line.passedQty - line.damagedQty)
}

/**
 * Thừa của một dòng phiếu nhận điều chuyển khi đang ghi (PM 23/11): hỏng lấp số đã xuất trước, phần hỏng vượt số xuất
 * chỉ ghi trên phiếu, nên thừa chỉ là hàng đạt vượt số đã xuất (khớp BE). Xuất 5, hỏng 20, đạt 0 thì thừa 0.
 */
export function receiptExcess(line: {
  documentQty: number
  passedQty: number
  damagedQty: number
}) {
  const damaged = Math.min(line.damagedQty, line.documentQty)
  return Math.min(
    line.passedQty,
    Math.max(0, line.passedQty + damaged - line.documentQty),
  )
}

/** PM 24/11: giải thích cột Giao sai / Thừa (biểu tượng (i) cạnh tiêu đề cột). */
export const WRONG_ITEM_TIP = 'Giao sai: sản phẩm khác với sản phẩm yêu cầu.'
export const EXCESS_TIP =
  'Thừa: số lượng sản phẩm nhiều hơn số lượng đúng yêu cầu. Sản phẩm khác mã yêu cầu thì điền ở cột Giao sai.'

/** PM 24/11: thông báo ghi "mã · tên" phụ tùng; thiếu tên thì chỉ mã. */
export const partLabel = (sku?: string | null, name?: string | null) =>
  [sku, name].filter(Boolean).join(' · ') || 'phụ tùng khác'
