/** View models for the stock-count UI. No server contract is assumed until BE exposes its controller/DTOs. */
export type CountLine = {
  id: number
  productId: number
  partName: string
  sku: string
  baseUnit: string
  binLocation: string | null
  lotCode: string | null
  expiryDate: string | null
  bookQty: number | null
  countedQty: number | null
  note: string | null
  reason: string | null
  recount: boolean
  unitCost: number | null
  createdLotId?: number | null
}
export type StockCount = {
  id: number
  code: string
  storeId: number
  storeName: string
  type: 'CYCLE' | 'YEAR_END' | 'OPENING'
  status: 'DRAFT' | 'COUNTING' | 'AWAITING_APPROVAL' | 'COMPLETED' | 'CANCELLED'
  countDate: string
  scopeLabel: string
  cancellationReason?: string | null
  recountReason?: string | null
  sourceReason?: string | null
  importedFileName?: string | null
  automaticallyCompleted?: boolean
  sourceLabel: string
  assigneeName: string | null
  submittedAt: string | null
  createdByName: string
  createdAt: string
  confirmedByName: string | null
  confirmedAt: string | null
  approvedByName: string | null
  approvedAt: string | null
  lines: CountLine[]
  events: { id: number; at: string; by: string; text: string }[]
}
export const countTypeNames = {
  CYCLE: 'Định kỳ',
  YEAR_END: 'Cuối năm',
  OPENING: 'Đầu kỳ',
}
export const countStateNames = {
  DRAFT: 'Chưa bắt đầu',
  COUNTING: 'Đang đếm',
  AWAITING_APPROVAL: 'Chờ Owner duyệt',
  COMPLETED: 'Hoàn tất',
  CANCELLED: 'Đã hủy',
}
export function countDifference(
  line: Pick<CountLine, 'countedQty' | 'bookQty'>,
) {
  return line.countedQty == null || line.bookQty == null
    ? null
    : line.countedQty - line.bookQty
}
export function validCountQuantity(value: string) {
  return (
    value.trim() !== '' &&
    /^\d+$/.test(value) &&
    Number.isSafeInteger(Number(value)) &&
    Number(value) <= 2147483647
  )
}
export function countSubmissionReady(
  lines: { value: string; note: string }[],
  confirmed: boolean,
) {
  return (
    confirmed &&
    lines.length > 0 &&
    lines.every((line) =>
      line.value.trim() === ''
        ? !!line.note.trim()
        : validCountQuantity(line.value),
    )
  )
}
