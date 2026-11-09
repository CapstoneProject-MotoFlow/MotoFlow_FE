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
