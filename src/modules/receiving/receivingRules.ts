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

/**
 * Mục 3 (PM 19/11): không còn ô "Số lượng trên chứng từ"; số này bằng số còn chờ nhận nên bảng
 * kiểm nhận không hiện cột riêng. documentQty vẫn nằm trong inspectionCountFields để tính số thiếu.
 */
export const inspectionShownCountFields = inspectionCountFields.filter(
  ([field]) => field !== 'documentQty',
)

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

/** Một dòng của form đơn nhập hàng khi kiểm trước khi gửi. */
export type PurchaseOrderFormLine = {
  /** Cách gọi dòng trong câu báo, ví dụ "dòng 2" hoặc "của BUG-NGK-CPR9". */
  label: string
  /** undefined: dòng đã có sẵn phụ tùng (popup); 0 hoặc NaN: chưa chọn phụ tùng. */
  productId?: number
  quantity: string
  price: string
  /** Popup chuyển mua cho nhập 0 để bỏ dòng, tối đa là số còn thiếu. */
  allowZero?: boolean
  maxQuantity?: number
}

const purchaseNumber = new Intl.NumberFormat('vi-VN')

/**
 * Mục 1 (PM 19/11): popup "Lập đơn nhập hàng" (từ yêu cầu bổ sung) và màn "Tạo đơn nhập hàng" báo cùng một kiểu
 * câu, chỉ đúng ô còn thiếu hoặc sai, thay cho câu chung hoặc bong bóng của trình duyệt. Hợp lệ thì trả chuỗi rỗng.
 */
export function purchaseOrderFormError(form: {
  supplier: boolean
  store: boolean
  lines: PurchaseOrderFormLine[]
}) {
  if (!form.supplier) return 'Vui lòng chọn nhà cung cấp.'
  if (!form.store) return 'Vui lòng chọn kho nhận.'
  if (!form.lines.length) return 'Vui lòng thêm ít nhất một phụ tùng.'
  for (const line of form.lines) {
    if (line.productId !== undefined && !(line.productId > 0))
      return `Vui lòng chọn phụ tùng ${line.label}.`
    if (line.quantity.trim() === '')
      return `Vui lòng nhập số lượng ${line.label}.`
    const min = line.allowZero ? 0 : 1
    const max = Math.min(line.maxQuantity ?? 1_000_000, 1_000_000)
    const quantity = Number(line.quantity)
    if (!Number.isInteger(quantity) || quantity < min || quantity > max)
      return `Số lượng ${line.label} phải là số nguyên từ ${min} đến ${purchaseNumber.format(max)}.`
    if (quantity === 0) continue
    if (line.price.trim() === '') return `Vui lòng nhập giá nhập ${line.label}.`
    const price = Number(line.price)
    if (!Number.isSafeInteger(price) || price < 1 || price > 10_000_000_000)
      return `Giá nhập ${line.label} phải từ 1 đến 10.000.000.000 ₫.`
  }
  if (form.lines.every((line) => Number(line.quantity) === 0))
    return 'Vui lòng nhập số lượng mua cho ít nhất một phụ tùng.'
  return ''
}
