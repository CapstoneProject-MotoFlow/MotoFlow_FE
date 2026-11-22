// Chỉ import kiểu: file này được test bằng cách chuyển TypeScript sang JS (tests/discrepancy-rules.test.mjs).
import type { AcceptanceType, Case, GoodsKind } from './discrepancy/types'

/** Loại hàng mà BM nhập số trực tiếp trong thẻ hồ sơ. Hàng thừa bị từ chối chỉ ghi nhận ở hộp "Ghi nhận đã trả". */
export type ReturnKind = 'WRONG_ITEM' | 'DAMAGED'

/** Nội dung đang sửa của một hồ sơ; replacement chưa sửa thì hiển thị số gợi ý. */
export type CaseDraft = {
  wrong: string
  damaged: string
  replacement?: string
  note: string
}

export type Metric = [label: string, quantity: number]

export type SummaryBox = { title: string; parts: Metric[]; warn: boolean }

const digits = /^\d+$/

function count(text: string) {
  return digits.test(text.trim()) ? Number(text) : 0
}

/** Số phải trả nhà cung cấp của một loại (gồm phần đã trả). */
export function returnRequiredOf(row: Case, kind: GoodsKind) {
  if (kind === 'WRONG_ITEM') return row.wrongReturnRequiredQty
  if (kind === 'DAMAGED') return row.damagedReturnRequiredQty
  return row.rejectedExcessQty
}

/** Số còn phải trả nhà cung cấp của một loại. */
export function outstandingReturnOf(row: Case, kind: GoodsKind) {
  if (kind === 'WRONG_ITEM') return row.wrongOutstandingReturnQty
  if (kind === 'DAMAGED') return row.damagedOutstandingReturnQty
  return row.excessOutstandingReturnQty
}

/** Số đã trả nhà cung cấp của một loại = phải trả trừ còn phải trả. */
export function returnedOf(row: Case, kind: GoodsKind) {
  return Math.max(returnRequiredOf(row, kind) - outstandingReturnOf(row, kind), 0)
}

export function heldOf(row: Case, kind: ReturnKind) {
  return kind === 'WRONG_ITEM' ? row.wrongUndecidedQty : row.damagedUndecidedQty
}

/**
 * Giới hạn ô trả của một loại: tối đa = phần phải trả + phần còn giữ tại kho;
 * tối thiểu = phần đã trả của loại đó (BE báo MSG134 nếu thấp hơn).
 */
export function returnLimits(row: Case, kind: ReturnKind) {
  return {
    max: returnRequiredOf(row, kind) + heldOf(row, kind),
    floor: returnedOf(row, kind),
  }
}

/** Số giao bù tối đa: không quá số thiếu + số giao sai + số hỏng và không quá hạn mức BE; hàng giao thẳng thì 0. */
export function replacementMax(row: Case) {
  return row.replacementDelivery
    ? 0
    : Math.min(row.replacementLimitQty, row.shortQty + row.wrongItemQty + row.damagedQty)
}

/**
 * Số giao bù tối thiểu (BE MSG193): không thấp hơn số thiếu, và không thấp hơn số đã giao bù,
 * đã bỏ giao bù và đang chờ giao bù cộng lại.
 */
export function replacementMin(row: Case) {
  return row.replacementDelivery
    ? 0
    : Math.max(row.shortQty, row.replacedQty + row.waivedQty + row.pendingReplacementQty)
}

/** Các loại còn phải trả nhà cung cấp, để chọn trong hộp "Ghi nhận đã trả". */
export function returnKindOptions(row: Case) {
  return (['WRONG_ITEM', 'DAMAGED', 'REJECTED_EXCESS'] as const)
    .map((kind) => ({ kind, outstanding: outstandingReturnOf(row, kind) }))
    .filter((option) => option.outstanding > 0)
}

/** Loại còn hàng đang giữ chưa quyết định và chưa có đề nghị chờ duyệt (mỗi loại khóa riêng). */
export function acceptanceOpenTypes(row: Case): AcceptanceType[] {
  const pending = new Set((row.pendingRequests ?? []).map((item) => item.type))
  const types: AcceptanceType[] = []
  if (row.damagedUndecidedQty > 0 && !pending.has('DAMAGED')) types.push('DAMAGED')
  if (row.wrongUndecidedQty > 0 && !pending.has('WRONG_ITEM')) types.push('WRONG_ITEM')
  return types
}

/** Ba hộp tóm tắt của thẻ: nhận / đang giữ / còn phải trả, mỗi hộp tách Giao sai và Hỏng. */
export function summaryBoxes(row: Case): SummaryBox[] {
  const received: Metric[] = [
    ['Giao sai', row.wrongItemQty],
    ['Hỏng', row.damagedQty],
  ]
  if (row.shortQty > 0) received.push(['Thiếu', row.shortQty])
  if (row.rejectedExcessQty > 0) received.push(['Thừa từ chối', row.rejectedExcessQty])
  const held: Metric[] = [
    ['Giao sai', row.wrongUndecidedQty],
    ['Hỏng', row.damagedUndecidedQty],
  ]
  const owed: Metric[] = [
    ['Giao sai', row.wrongOutstandingReturnQty],
    ['Hỏng', row.damagedOutstandingReturnQty],
  ]
  if (row.excessOutstandingReturnQty > 0)
    owed.push(['Thừa từ chối', row.excessOutstandingReturnQty])
  return [
    { title: 'Sai lệch khi nhận', parts: received, warn: false },
    {
      title: 'Đang giữ tại kho, chưa quyết định',
      parts: held,
      warn: row.heldUndecidedQty > 0,
    },
    {
      title: 'Còn phải trả nhà cung cấp',
      parts: owed,
      warn: row.outstandingReturnQty > 0,
    },
  ]
}

/** Các việc còn dở của hồ sơ đang mở; rỗng khi đã xử lý đủ. */
export function caseStatusParts(row: Case) {
  const parts: string[] = []
  if (row.heldUndecidedQty > 0)
    parts.push(`Đang giữ ${row.heldUndecidedQty}, chờ quyết định`)
  if (row.outstandingReturnQty > 0) parts.push(`Còn phải trả ${row.outstandingReturnQty}`)
  const replacement = Math.max(row.outstandingReplacementQty, row.openReplacementQty)
  if (replacement > 0) parts.push(`Chờ NCC giao bù ${replacement}`)
  if (row.pendingRequests?.length) parts.push('Chờ Owner duyệt')
  return parts
}

export function isCaseSettled(row: Case) {
  return row.status !== 'OPEN' || caseStatusParts(row).length === 0
}

export function caseStatusLabel(row: Case) {
  if (row.status !== 'OPEN') return 'Đã đóng'
  const parts = caseStatusParts(row)
  return parts.length ? parts.join(' · ') : 'Đã xử lý đủ'
}

export function caseDraft(row: Case): CaseDraft {
  return {
    wrong: String(row.wrongReturnRequiredQty),
    damaged: String(row.damagedReturnRequiredQty),
    // Chưa có hướng xử lý nào được thỏa thuận: hiện số gợi ý. Đã thỏa thuận thì hiện đúng số đang lưu (kể cả 0).
    replacement:
      row.wrongReturnRequiredQty + row.damagedReturnRequiredQty === 0 &&
      row.replacementRequiredQty === 0
        ? undefined
        : String(row.replacementRequiredQty),
    note: '',
  }
}

/** Số giao bù đang hiển thị: số đã sửa, hoặc gợi ý = số thiếu + số giao sai/hỏng đang chọn trả, kẹp trong [tối thiểu, tối đa]. */
export function shownReplacement(row: Case, draft: CaseDraft) {
  if (row.replacementDelivery) return '0'
  if (draft.replacement !== undefined) return draft.replacement
  return String(
    Math.min(
      replacementMax(row),
      Math.max(
        replacementMin(row),
        row.shortQty + count(draft.wrong) + count(draft.damaged),
      ),
    ),
  )
}

export type CaseFieldErrors = { wrong: string; damaged: string; replacement: string }

/** Lỗi của từng ô nhập, mỗi ô một câu; ô hợp lệ là chuỗi rỗng. */
export function caseDraftFieldErrors(row: Case, draft: CaseDraft): CaseFieldErrors {
  const notInt = 'Nhập số nguyên từ 0 trở lên.'
  const returnError = (
    value: string,
    limit: { max: number; floor: number },
    label: string,
  ) => {
    if (!digits.test(value.trim())) return notInt
    const quantity = Number(value)
    if (quantity > limit.max) return `${label} trả tối đa ${limit.max}.`
    if (quantity < limit.floor)
      return `Đã trả nhà cung cấp ${limit.floor} ${label.toLowerCase()}, không nhập thấp hơn.`
    return ''
  }
  const replacementText = shownReplacement(row, draft)
  let replacement = ''
  if (!digits.test(replacementText.trim())) replacement = notInt
  else if (Number(replacementText) > replacementMax(row))
    replacement = `NCC giao bù tối đa ${replacementMax(row)}.`
  else if (Number(replacementText) < replacementMin(row))
    replacement = `NCC giao bù tối thiểu ${replacementMin(row)}.`
  return {
    wrong: returnError(draft.wrong, returnLimits(row, 'WRONG_ITEM'), 'Hàng giao sai'),
    damaged: returnError(draft.damaged, returnLimits(row, 'DAMAGED'), 'Hàng hỏng'),
    replacement,
  }
}

/** Câu lỗi đầu tiên của một hồ sơ, rỗng nếu hợp lệ (chặn lưu). */
export function caseDraftError(row: Case, draft: CaseDraft) {
  const errors = caseDraftFieldErrors(row, draft)
  return errors.wrong || errors.damaged || errors.replacement
}

/**
 * Có thay đổi số lượng so với hướng xử lý đang lưu. Chỉ ghi chú thì không tính là thay đổi:
 * BE bỏ qua dòng không đổi nên ghi chú chỉ được gửi kèm một thay đổi số lượng.
 */
export function caseDraftChanged(row: Case, draft: CaseDraft) {
  return (
    Number(draft.wrong) !== row.wrongReturnRequiredQty ||
    Number(draft.damaged) !== row.damagedReturnRequiredQty ||
    Number(shownReplacement(row, draft)) !== row.replacementRequiredQty
  )
}

/** Dòng gửi PUT /goods-receipt-notes/{id}/discrepancies: số trả theo từng loại, không gửi returnRequiredQty. */
export function caseLine(row: Case, draft: CaseDraft) {
  return {
    caseId: row.id,
    wrongReturnQty: Number(draft.wrong),
    damagedReturnQty: Number(draft.damaged),
    replacementRequiredQty: Number(shownReplacement(row, draft)),
  }
}
