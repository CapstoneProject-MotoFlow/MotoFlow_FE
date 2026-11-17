export type HandlingCase = {
  shortQty: number
  wrongItemQty: number
  damagedQty: number
  rejectedExcessQty: number
  returnRequiredQty: number
  replacementRequiredQty: number
  replacementLimitQty: number
  replacementDelivery: boolean
}
export type HandlingDraft = { returned: string; replacement?: string }

export function handlingDraft(row: HandlingCase): HandlingDraft {
  return {
    returned: String(row.returnRequiredQty),
    replacement:
      row.returnRequiredQty === 0 && row.replacementRequiredQty === 0
        ? undefined
        : String(row.replacementRequiredQty),
  }
}

export function replacementLimit(row: HandlingCase) {
  return row.replacementDelivery
    ? 0
    : Math.min(
        row.replacementLimitQty,
        row.shortQty + row.wrongItemQty + row.damagedQty,
      )
}

export function replacementValue(row: HandlingCase, draft: HandlingDraft) {
  if (row.replacementDelivery) return '0'
  return (
    draft.replacement ??
    String(
      Math.min(
        replacementLimit(row),
        Math.max(
          0,
          row.shortQty + Number(draft.returned) - row.rejectedExcessQty,
        ),
      ),
    )
  )
}

export type WorkReceipt = {
  id: number
  purchaseOrderId: number
  status: string
  assigneeName: string | null
  deliveryDocumentNo: string | null
}

export function receiptWork(receipts: WorkReceipt[], orderId: number) {
  const matches = receipts.filter(
    (receipt) => receipt.purchaseOrderId === orderId,
  )
  return (
    matches.find((receipt) => receipt.status === 'AWAITING_CONFIRMATION') ??
    matches.find(
      (receipt) =>
        ['AWAITING_INSPECTION', 'AWAITING_RECOUNT'].includes(receipt.status) &&
        !receipt.assigneeName,
    )
  )
}

export function inspectionQuantitiesValid(values: number[]) {
  const [document, delivered, wrong, damaged] = values
  return (
    values.length === 4 &&
    values.every(
      (value) => Number.isInteger(value) && value >= 0 && value <= 1_000_000,
    ) &&
    wrong + damaged <= delivered &&
    document >= 0
  )
}

export const inspectionCountFields = [
  ['documentQty', 'Số lượng trên chứng từ'],
  ['deliveredQty', 'Thực giao'],
  ['wrongItemQty', 'Giao sai'],
  ['damagedQty', 'Hư hỏng'],
] as const

export const inspectionResultFields = [
  ['passedQty', 'Đạt'],
  ['shortQty', 'Thiếu'],
  ['excessQty', 'Thừa'],
] as const

export function inspectionResult(values: string[], expectedQty: number) {
  if (values.some((value) => value.trim() === '')) return null
  const quantities = values.map(Number)
  if (!inspectionQuantitiesValid(quantities)) return null
  const [documentQty, deliveredQty, wrongItemQty, damagedQty] = quantities
  const passedQty = deliveredQty - wrongItemQty - damagedQty
  return {
    documentQty,
    deliveredQty,
    wrongItemQty,
    damagedQty,
    passedQty,
    shortQty: Math.max(documentQty - deliveredQty, 0),
    // BR-67: the order or replacement case determines how much passed stock is still needed.
    excessQty: Math.max(passedQty - expectedQty, 0),
  }
}

export function receiptDateLimits(now = new Date()) {
  const pad = (value: number) => String(value).padStart(2, '0')
  const date = [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
  ].join('-')
  return {
    date,
    dateTime: date + 'T' + pad(now.getHours()) + ':' + pad(now.getMinutes()),
  }
}

export function receiptDatesInFuture(
  documentDate: string,
  arrivedAt: string,
  now = new Date(),
) {
  const limits = receiptDateLimits(now)
  return documentDate > limits.date || arrivedAt > limits.dateTime
}
