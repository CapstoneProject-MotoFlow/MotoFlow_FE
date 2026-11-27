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
  legacyExcessQty?: number | null
}) {
  const base =
    line.legacyExcessQty !== undefined
      ? (line.legacyExcessQty ?? 0)
      : (line.extraReceivedQty ?? 0)
  return Math.max(0, base - (line.extraDispatchedQty ?? 0))
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

type Person = { fullName: string } | null | undefined
type TimelineEvent = {
  id: number
  resolutionType: string
  quantity: number
  reason: string | null
  occurredAt?: string | null
  confirmedAt: string | null
  receivedSku?: string | null
  status?: string | null
  recordedBy?: Person
  confirmedBy?: Person
  rejectedBy?: Person
  rejectedAt?: string | null
  rejectionReason?: string | null
}
export type TimelineEntry = {
  key: string
  at: string
  title: string
  by: string | null
  detail: string | null
}

/**
 * Review 25/11 (R-02, plan C5): "Lịch sử đối soát" của lệnh, cũ trước: kho nhận gửi yêu cầu đối soát, lập phiếu nhận
 * hàng giao sai hoặc hoàn trả, kho gửi xác nhận hoặc từ chối, kho gửi xác nhận đối soát, Owner đóng phiếu.
 */
export function reconciliationTimeline(order: {
  discrepancyAcknowledgedAt?: string | null
  discrepancyAcknowledgedBy?: Person
  reconciliationNote?: string | null
  reconciliationConfirmedAt?: string | null
  reconciliationConfirmedBy?: Person
  closedAt: string | null
  closedBy: Person
  discrepancies: { productId: number; events: TimelineEvent[] }[]
  lines: { productId: number; sku: string }[]
}): TimelineEntry[] {
  const entries: TimelineEntry[] = []
  const skuOf = new Map(order.lines.map((line) => [line.productId, line.sku]))
  const name = (person: Person) => person?.fullName ?? null
  for (const item of order.discrepancies) {
    const ordered = skuOf.get(item.productId) ?? ''
    for (const event of item.events) {
      const wrong =
        event.quantity +
        ' × ' +
        (event.receivedSku ?? 'phụ tùng khác') +
        (ordered ? ' (giao kèm ' + ordered + ')' : '')
      const handBack = event.resolutionType === 'WRONG_ITEM_RETURNED'
      if (handBack || event.resolutionType === 'RECEIVED_AS_OTHER_PRODUCT') {
        if (event.occurredAt)
          entries.push({
            key: event.id + ':recorded',
            at: event.occurredAt,
            title:
              (handBack
                ? 'Kho nhận hoàn trả hàng giao sai: '
                : 'Kho nhận lập phiếu nhận hàng giao sai: ') + wrong,
            by: name(event.recordedBy),
            detail: event.reason,
          })
        if (event.status === 'CONFIRMED' && event.confirmedAt)
          entries.push({
            key: event.id + ':confirmed',
            at: event.confirmedAt,
            title:
              (handBack
                ? 'Kho gửi xác nhận đã nhận lại: '
                : 'Kho gửi xác nhận phiếu nhận hàng giao sai: ') + wrong,
            by: name(event.confirmedBy),
            detail: null,
          })
        if (event.status === 'REJECTED' && event.rejectedAt)
          entries.push({
            key: event.id + ':rejected',
            at: event.rejectedAt,
            title:
              (handBack
                ? 'Kho gửi từ chối việc hoàn trả: '
                : 'Kho gửi từ chối phiếu nhận hàng giao sai: ') + wrong,
            by: name(event.rejectedBy),
            detail: event.rejectionReason ?? null,
          })
      } else if (
        event.resolutionType === 'RECEIVER_MISCOUNT' &&
        event.occurredAt
      ) {
        entries.push({
          key: event.id + ':miscount',
          at: event.occurredAt,
          title: 'Owner sửa dòng ' + ordered + ': bên nhận kiểm sai',
          by: name(event.recordedBy),
          detail: event.reason,
        })
      }
    }
  }
  if (order.discrepancyAcknowledgedAt)
    entries.push({
      key: 'acknowledged',
      at: order.discrepancyAcknowledgedAt,
      title: 'Kho nhận gửi yêu cầu đối soát',
      by: name(order.discrepancyAcknowledgedBy),
      detail: order.reconciliationNote ?? null,
    })
  if (order.reconciliationConfirmedAt)
    entries.push({
      key: 'reconciled',
      at: order.reconciliationConfirmedAt,
      title: 'Kho gửi xác nhận đối soát',
      by: name(order.reconciliationConfirmedBy),
      detail: null,
    })
  if (entries.length && order.closedAt)
    entries.push({
      key: 'closed',
      at: order.closedAt,
      title: 'Owner đóng phiếu',
      by: name(order.closedBy),
      detail: null,
    })
  return entries.sort((a, b) => (a.at === b.at ? 0 : a.at < b.at ? -1 : 1))
}

/**
 * Review 25/11 (R-03): hàng giao sai còn chặn đóng phiếu (MSG342), để hiện sẵn cạnh nút đóng: chưa lập phiếu hay
 * hoàn trả, và đang chờ kho gửi xác nhận.
 */
export function openWrongItems(
  lines: {
    sku: string
    wrongPendingQty?: number | null
    wrongAwaitingSourceQty?: number | null
  }[],
) {
  const pending = lines.reduce((sum, l) => sum + (l.wrongPendingQty ?? 0), 0)
  const awaiting = lines.reduce(
    (sum, l) => sum + (l.wrongAwaitingSourceQty ?? 0),
    0,
  )
  const skus = lines
    .filter(
      (l) => (l.wrongPendingQty ?? 0) + (l.wrongAwaitingSourceQty ?? 0) > 0,
    )
    .map(
      (l) =>
        l.sku +
        ' x' +
        ((l.wrongPendingQty ?? 0) + (l.wrongAwaitingSourceQty ?? 0)),
    )
  return { pending, awaiting, total: pending + awaiting, skus }
}

/**
 * Tóm tắt hàng giao sai đang hiệu lực của một dòng (phiếu nhận và hoàn trả đang chờ hoặc đã xác nhận; bỏ phiếu đã bị
 * từ chối hoặc đã hủy).
 */
export function wrongParts(
  order: {
    discrepancies: {
      productId: number
      events: {
        resolutionType: string
        quantity: number
        receivedSku?: string | null
        status?: string | null
      }[]
    }[]
  },
  productId: number,
) {
  return order.discrepancies
    .filter((item) => item.productId === productId)
    .flatMap((item) => item.events)
    .filter((event) => {
      if (event.resolutionType === 'WRONG_ITEM_RETURNED')
        return (
          event.status == null ||
          event.status === 'AWAITING_SOURCE' ||
          event.status === 'CONFIRMED'
        )
      if (event.resolutionType === 'RECEIVED_AS_OTHER_PRODUCT')
        return (
          event.status === 'AWAITING_SOURCE' || event.status === 'CONFIRMED'
        )
      return false
    })
    .map((event) => {
      const sku = event.receivedSku ?? 'phụ tùng khác'
      if (event.resolutionType === 'WRONG_ITEM_RETURNED')
        return (
          sku +
          ' x' +
          event.quantity +
          (event.status === 'AWAITING_SOURCE'
            ? ' hoàn trả (chờ kho gửi)'
            : ' hoàn trả')
        )
      return (
        sku +
        ' x' +
        event.quantity +
        (event.status === 'CONFIRMED' ? ' nhập kho' : ' chờ kho gửi')
      )
    })
    .join(', ')
}
