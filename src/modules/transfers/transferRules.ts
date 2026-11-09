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
