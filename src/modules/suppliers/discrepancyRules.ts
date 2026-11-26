// Chỉ import kiểu: file này được test bằng cách chuyển TypeScript sang JS (tests/discrepancy-rules.test.mjs).
import type { AcceptanceType, Case, DecisionType, GoodsKind } from './discrepancy/types'

/** Loại hàng mà người dùng nhập số trả NCC trong bảng hướng xử lý. Hàng thừa từ chối chỉ ghi nhận khi trả. */
export type ReturnKind = 'WRONG_ITEM' | 'DAMAGED'

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

function heldOf(row: Case, kind: ReturnKind) {
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

/**
 * Tình trạng chung của một phiếu nhập trên màn xử lý sai lệch (PM 22/11, Q3).
 * Graphify #72/#73: không tải được hàng thừa (handlingComplete = null) thì không bao giờ báo "Đã xử lý xong".
 */
export function receiptHandlingStatus(input: {
  openCases: number
  waitingExcess: number
  /** BE handlingComplete; null khi không tải được API hàng thừa. */
  handlingComplete: boolean | null
}): { done: boolean; text: string } {
  if (input.handlingComplete === null)
    return { done: false, text: 'Chưa xác định tình trạng hàng thừa' }
  if (input.handlingComplete) return { done: true, text: 'Đã xử lý xong' }
  const parts = [
    input.openCases ? `Còn ${input.openCases} hồ sơ mở` : '',
    input.waitingExcess ? `${input.waitingExcess} hàng thừa chờ Owner` : '',
  ].filter(Boolean)
  return { done: false, text: parts.join(' · ') || 'Chưa xử lý xong' }
}

// ---- GVHD 24/11: bảng hướng đề xuất xử lý với NCC ---------------------------------------------------------------

/** Một dòng của bảng hướng xử lý đang sửa; replacement chưa sửa thì dùng số chuẩn = thiếu + trả sai + trả hỏng. */
export type DecisionDraft = {
  type: DecisionType
  wrong: string
  damaged: string
  replacement?: string
}

/** Hướng (3) chỉ có khi dòng có hàng giao sai hoặc hàng hỏng. */
export function decisionOptions(row: Case): DecisionType[] {
  const options: DecisionType[] = ['RETURN_NO_REPLACEMENT', 'RETURN_AND_REPLACE']
  if (row.wrongItemQty + row.damagedQty > 0) options.push('ACCEPT_NO_REPLACEMENT')
  return options
}

/** Số trả tối đa của một loại: phần đang trả + phần còn giữ chưa quyết định. */
export function decisionReturnMax(row: Case, kind: ReturnKind) {
  return returnLimits(row, kind).max
}

/** PM Q2: số giao bù BM được tự lưu = thiếu + trả sai + trả hỏng, không quá hạn mức; phiếu giao bù thì 0. */
export function standardReplacement(row: Case, wrong: number, damaged: number) {
  if (row.replacementDelivery) return 0
  return Math.min(row.shortQty + wrong + damaged, row.replacementLimitQty)
}

/** Bản nháp ban đầu của một dòng: hướng đang đề nghị, đang chốt, hoặc mặc định "trả hết, giao bù đủ". */
export function decisionDraft(row: Case): DecisionDraft {
  if (row.decisionStatus === 'AWAITING_OWNER' && row.decisionType)
    return {
      type: row.decisionType,
      wrong: String(row.proposedWrongReturnQty ?? 0),
      damaged: String(row.proposedDamagedReturnQty ?? 0),
      replacement: String(row.proposedReplacementQty ?? 0),
    }
  if (row.decisionStatus === 'DECIDED' && row.decisionType)
    return {
      type: row.decisionType,
      wrong: String(row.wrongReturnRequiredQty),
      damaged: String(row.damagedReturnRequiredQty),
      replacement:
        row.decisionType === 'RETURN_AND_REPLACE' ? String(row.replacementRequiredQty) : '0',
    }
  return {
    type: 'RETURN_AND_REPLACE',
    wrong: String(decisionReturnMax(row, 'WRONG_ITEM')),
    damaged: String(decisionReturnMax(row, 'DAMAGED')),
  }
}

/** Số đang hiển thị của từng ô theo hướng đã chọn: (3) không trả gì, (1) và (3) không giao bù. */
export function decisionNumbers(row: Case, draft: DecisionDraft) {
  const keep = draft.type === 'ACCEPT_NO_REPLACEMENT'
  const wrong = keep ? 0 : count(draft.wrong)
  const damaged = keep ? 0 : count(draft.damaged)
  const replacement =
    draft.type !== 'RETURN_AND_REPLACE'
      ? 0
      : draft.replacement !== undefined
        ? count(draft.replacement)
        : standardReplacement(row, wrong, damaged)
  return { wrong, damaged, replacement }
}

/** Câu lỗi của một dòng (rỗng nếu hợp lệ), cùng các điều kiện MSG35, MSG193, MSG354 của BE. */
export function decisionDraftError(row: Case, draft: DecisionDraft) {
  const notInt = 'Nhập số nguyên ≥ 0.'
  if (draft.type !== 'ACCEPT_NO_REPLACEMENT') {
    if (row.wrongItemQty > 0 && !digits.test(draft.wrong.trim())) return notInt
    if (row.damagedQty > 0 && !digits.test(draft.damaged.trim())) return notInt
  }
  if (
    draft.type === 'RETURN_AND_REPLACE' &&
    draft.replacement !== undefined &&
    !digits.test(draft.replacement.trim())
  )
    return notInt
  const { wrong, damaged, replacement } = decisionNumbers(row, draft)
  if (wrong > decisionReturnMax(row, 'WRONG_ITEM'))
    return `Trả hàng sai tối đa ${decisionReturnMax(row, 'WRONG_ITEM')}.`
  if (damaged > decisionReturnMax(row, 'DAMAGED'))
    return `Trả hàng hỏng tối đa ${decisionReturnMax(row, 'DAMAGED')}.`
  if (draft.type === 'RETURN_AND_REPLACE') {
    if (replacement > row.replacementLimitQty)
      return `Giao bù tối đa ${row.replacementLimitQty}.`
    if (replacement < replacementMin(row))
      return `Giao bù tối thiểu ${replacementMin(row)} (hoặc chọn "Trả hàng, không giao bù").`
    if (wrong + damaged + replacement === 0 && row.shortQty === 0)
      return 'Chọn "Nhận hàng lỗi, không giao bù" nếu không trả và không giao bù.'
  }
  if (draft.type === 'RETURN_NO_REPLACEMENT' && wrong + damaged + row.shortQty === 0)
    return 'Chưa có hàng trả — vui lòng chọn hướng khác.'
  return ''
}

/** PM Q2: BM tự lưu chỉ hướng (2) với giao bù chuẩn; còn lại phải Owner duyệt. Owner lưu là chốt luôn. */
export function decisionNeedsOwner(row: Case, draft: DecisionDraft, owner: boolean) {
  if (owner) return false
  if (draft.type !== 'RETURN_AND_REPLACE') return true
  const { wrong, damaged, replacement } = decisionNumbers(row, draft)
  return replacement !== standardReplacement(row, wrong, damaged)
}

/** Dòng gửi PUT /goods-receipt-notes/{id}/discrepancies. */
export function decisionLine(row: Case, draft: DecisionDraft) {
  const { wrong, damaged, replacement } = decisionNumbers(row, draft)
  return {
    caseId: row.id,
    decisionType: draft.type,
    wrongReturnQty: wrong,
    damagedReturnQty: damaged,
    replacementRequiredQty: replacement,
  }
}

/**
 * Review 25/11 (R-06): hai nút cố định. BM: "Lưu hướng xử lý" bị khóa khi có dòng cần Owner,
 * "Đề nghị Owner duyệt" bị khóa khi số khớp chuẩn. Owner lưu là chốt luôn nên chỉ có 1 nút.
 */
export function decisionSaveButtons(needsOwner: boolean, owner: boolean) {
  return {
    save: {
      label: 'Lưu hướng xử lý',
      blocked: needsOwner ? 'Có dòng cần Owner duyệt — bấm "Đề nghị Owner duyệt".' : '',
    },
    propose: owner
      ? null
      : {
          label: 'Đề nghị Owner duyệt',
          blocked: needsOwner ? '' : 'Số khớp chuẩn — bấm "Lưu hướng xử lý".',
        },
  }
}

// ---- Tiến độ từng dòng trong bảng gộp --------------------------------------------------------------------------

export type CaseProgress = {
  /** Nhãn chính của cột Tiến độ. */
  label: string
  tone: 'warning' | 'info' | 'success' | 'muted'
  /** Việc còn dở, mỗi dòng một ý ngắn; số 0 không hiện. */
  lines: string[]
}

/** Cột "Tiến độ & thao tác" của bảng: trạng thái hướng xử lý và việc còn lại theo từng loại hàng. */
export function caseProgress(row: Case): CaseProgress {
  if (row.status !== 'OPEN') return { label: 'Đã đóng', tone: 'muted', lines: [] }
  const lines: string[] = []
  const status = row.decisionStatus ?? 'UNDECIDED'
  if (status !== 'UNDECIDED' && row.heldUndecidedQty > 0) {
    const heldParts = [
      row.wrongUndecidedQty > 0 ? `${row.wrongUndecidedQty} sai` : '',
      row.damagedUndecidedQty > 0 ? `${row.damagedUndecidedQty} hỏng` : '',
    ].filter(Boolean)
    lines.push(
      heldParts.length
        ? `Đang giữ: ${heldParts.join(', ')}`
        : `Đang giữ: ${row.heldUndecidedQty}`,
    )
  }
  if (row.outstandingReturnQty > 0) lines.push(`Còn trả NCC: ${row.outstandingReturnQty}`)
  const replacement = Math.max(row.outstandingReplacementQty, row.openReplacementQty)
  if (status !== 'UNDECIDED' && replacement > 0) lines.push(`Chờ giao bù: ${replacement}`)
  row.pendingRequests?.forEach((request) =>
    lines.push(
      (request.type === 'DAMAGED' ? 'Nhận hàng lỗi ' : 'Nhận hàng sai ') +
        request.quantity +
        ' (chờ duyệt)',
    ),
  )
  if (status === 'UNDECIDED') return { label: 'Chưa chốt', tone: 'warning', lines }
  if (status === 'AWAITING_OWNER') return { label: 'Chờ Owner duyệt', tone: 'info', lines }
  if (lines.length === 0) return { label: 'Đã xử lý đủ', tone: 'success', lines }
  return { label: 'Đã chốt', tone: 'info', lines }
}
