import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import ts from 'typescript'

const source = readFileSync(
  new URL('../src/modules/suppliers/discrepancyRules.ts', import.meta.url),
  'utf8',
)
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
})
const {
  returnedOf,
  returnLimits,
  replacementMax,
  replacementMin,
  returnKindOptions,
  acceptanceOpenTypes,
  summaryBoxes,
  caseStatusLabel,
  caseDraft,
  caseDraftError,
  caseDraftFieldErrors,
  caseDraftChanged,
  caseLine,
  shownReplacement,
  receiptHandlingStatus,
  decisionOptions,
  decisionDraft,
  decisionDraftError,
  decisionNeedsOwner,
  decisionLine,
  decisionSaveButtons,
  standardReplacement,
  decisionNumbers,
  caseProgress,
} = await import(
  'data:text/javascript;base64,' + Buffer.from(outputText).toString('base64')
)

// Hồ sơ mới: thiếu 0, giao sai 3, hỏng 3, chưa trả, chưa giữ, chưa giao bù.
function fresh(overrides = {}) {
  return {
    id: 1,
    status: 'OPEN',
    replacementDelivery: false,
    shortQty: 0,
    wrongItemQty: 3,
    damagedQty: 3,
    rejectedExcessQty: 0,
    returnRequiredQty: 0,
    wrongReturnRequiredQty: 0,
    damagedReturnRequiredQty: 0,
    returnedQty: 0,
    outstandingReturnQty: 0,
    wrongOutstandingReturnQty: 0,
    damagedOutstandingReturnQty: 0,
    excessOutstandingReturnQty: 0,
    heldUndecidedQty: 0,
    wrongUndecidedQty: 0,
    damagedUndecidedQty: 0,
    replacementRequiredQty: 0,
    replacementLimitQty: 10,
    replacedQty: 0,
    waivedQty: 0,
    pendingReplacementQty: 0,
    outstandingReplacementQty: 0,
    openReplacementQty: 0,
    pendingRequests: [],
    ...overrides,
  }
}

// Hồ sơ anh-12: thiếu 5, giao sai 2, hỏng 1; đã giao bù 8; đã trả 2 giao sai; 1 hỏng đang giữ.
const anh12 = fresh({
  shortQty: 5,
  wrongItemQty: 2,
  damagedQty: 1,
  wrongReturnRequiredQty: 2,
  wrongOutstandingReturnQty: 0,
  damagedUndecidedQty: 1,
  heldUndecidedQty: 1,
  replacementRequiredQty: 8,
  replacementLimitQty: 8,
})

test('anh-12 with a damaged item still held is not shown as settled', () => {
  assert.equal(caseStatusLabel(anh12), 'Đang giữ 1, chờ quyết định')
  assert.deepEqual(summaryBoxes(anh12)[1].parts, [
    ['Giao sai', 0],
    ['Hỏng', 1],
  ])
  assert.equal(summaryBoxes(anh12)[1].warn, true)
  assert.equal(
    caseStatusLabel({ ...anh12, heldUndecidedQty: 0, damagedUndecidedQty: 0 }),
    'Đã xử lý đủ',
  )
})

test('outstanding return and held items are both listed in the status', () => {
  const row = fresh({
    wrongItemQty: 2,
    damagedQty: 1,
    wrongUndecidedQty: 2,
    heldUndecidedQty: 2,
    outstandingReturnQty: 1,
    damagedOutstandingReturnQty: 1,
    damagedReturnRequiredQty: 1,
  })
  assert.equal(
    caseStatusLabel(row),
    'Đang giữ 2, chờ quyết định · Còn phải trả 1',
  )
  assert.equal(caseStatusLabel({ ...row, status: 'CLOSED' }), 'Đã đóng')
})

test('damaged goods returned while wrong items are still held', () => {
  const row = fresh({
    wrongItemQty: 2,
    damagedQty: 1,
    wrongUndecidedQty: 2,
    heldUndecidedQty: 2,
    damagedReturnRequiredQty: 1,
    damagedOutstandingReturnQty: 0,
  })
  assert.equal(returnedOf(row, 'DAMAGED'), 1)
  assert.equal(returnedOf(row, 'WRONG_ITEM'), 0)
  assert.deepEqual(returnLimits(row, 'WRONG_ITEM'), { max: 2, floor: 0 })
  assert.deepEqual(returnLimits(row, 'DAMAGED'), { max: 1, floor: 1 })
  assert.equal(caseStatusLabel(row), 'Đang giữ 2, chờ quyết định')
  assert.deepEqual(summaryBoxes(row)[1].parts, [
    ['Giao sai', 2],
    ['Hỏng', 0],
  ])
  assert.equal(
    caseDraftError(row, { wrong: '0', damaged: '0', note: '' }),
    'Đã trả nhà cung cấp 1 hàng hỏng, không nhập thấp hơn.',
  )
  assert.equal(caseDraftError(row, { wrong: '2', damaged: '1', note: '' }), '')
})

test('returns are split per kind: returned, outstanding and the limits', () => {
  const row = fresh({
    rejectedExcessQty: 2,
    wrongItemQty: 3,
    damagedQty: 3,
    wrongReturnRequiredQty: 3,
    damagedReturnRequiredQty: 2,
    wrongOutstandingReturnQty: 1,
    damagedOutstandingReturnQty: 0,
    excessOutstandingReturnQty: 2,
    outstandingReturnQty: 3,
    wrongUndecidedQty: 0,
    damagedUndecidedQty: 1,
    heldUndecidedQty: 1,
  })
  assert.equal(returnedOf(row, 'WRONG_ITEM'), 2)
  assert.equal(returnedOf(row, 'DAMAGED'), 2)
  assert.deepEqual(returnKindOptions(row), [
    { kind: 'WRONG_ITEM', outstanding: 1 },
    { kind: 'REJECTED_EXCESS', outstanding: 2 },
  ])
  assert.deepEqual(returnLimits(row, 'DAMAGED'), { max: 3, floor: 2 })
  assert.deepEqual(summaryBoxes(row)[2].parts, [
    ['Giao sai', 1],
    ['Hỏng', 0],
    ['Thừa từ chối', 2],
  ])
  assert.equal(caseStatusLabel(row), 'Đang giữ 1, chờ quyết định · Còn phải trả 3')
})

test('the first box shows short and excess only when they are above zero', () => {
  assert.deepEqual(summaryBoxes(anh12)[0].parts, [
    ['Giao sai', 2],
    ['Hỏng', 1],
    ['Thiếu', 5],
  ])
  assert.deepEqual(summaryBoxes(fresh())[0].parts, [
    ['Giao sai', 3],
    ['Hỏng', 3],
  ])
})

test('draft limits: each kind is capped by required plus held, and never below returned', () => {
  const row = fresh({
    rejectedExcessQty: 1,
    wrongReturnRequiredQty: 3,
    damagedReturnRequiredQty: 2,
    wrongOutstandingReturnQty: 0,
    damagedOutstandingReturnQty: 1,
    wrongUndecidedQty: 0,
    damagedUndecidedQty: 1,
    heldUndecidedQty: 1,
  })
  assert.deepEqual(returnLimits(row, 'WRONG_ITEM'), { max: 3, floor: 3 })
  assert.deepEqual(returnLimits(row, 'DAMAGED'), { max: 3, floor: 1 })
  assert.equal(
    caseDraftError(row, { wrong: '2', damaged: '2', note: '' }),
    'Đã trả nhà cung cấp 3 hàng giao sai, không nhập thấp hơn.',
  )
  assert.equal(
    caseDraftError(row, { wrong: '3', damaged: '4', note: '' }),
    'Hàng hỏng trả tối đa 3.',
  )
  assert.equal(caseDraftError(row, { wrong: '3', damaged: '', note: '' }), 'Nhập số nguyên từ 0 trở lên.')
})

test('the request line sends wrong and damaged return quantities separately', () => {
  const row = fresh({
    wrongReturnRequiredQty: 1,
    damagedReturnRequiredQty: 2,
    replacementRequiredQty: 0,
    shortQty: 1,
    wrongItemQty: 1,
    damagedQty: 2,
  })
  const saved = { ...row, replacementRequiredQty: 4 }
  const draft = caseDraft(saved)
  assert.deepEqual(caseLine(saved, { ...draft, wrong: '0', damaged: '2' }), {
    caseId: 1,
    wrongReturnQty: 0,
    damagedReturnQty: 2,
    replacementRequiredQty: 4,
  })
  assert.equal(caseDraftChanged(saved, draft), false)
  // Chỉ ghi chú không phải thay đổi; ghi chú đi kèm một thay đổi số lượng.
  assert.equal(caseDraftChanged(saved, { ...draft, note: 'Ghi chú' }), false)
  assert.equal(caseDraftChanged(saved, { ...draft, damaged: '1' }), true)
  assert.equal(
    caseDraftChanged(saved, { ...draft, damaged: '1', note: 'Ghi chú' }),
    true,
  )
  assert.equal(caseLine(saved, { ...draft, note: 'Ghi chú' }).replacementRequiredQty, 4)
})

test('a handled case with replacement 0 shows 0, is not dirty and sends no suggestion', () => {
  // Đã thỏa thuận trả 1 giao sai + 2 hỏng, chưa có thiếu nên giao bù 0.
  const row = fresh({
    wrongItemQty: 1,
    damagedQty: 2,
    wrongReturnRequiredQty: 1,
    damagedReturnRequiredQty: 2,
    replacementRequiredQty: 0,
  })
  const draft = caseDraft(row)
  assert.equal(draft.replacement, '0')
  assert.equal(shownReplacement(row, draft), '0')
  assert.equal(caseDraftChanged(row, draft), false)
  assert.equal(caseLine(row, draft).replacementRequiredQty, 0)
})

test('a fresh case without any agreed return still suggests the replacement', () => {
  const row = fresh({ shortQty: 2 })
  const draft = caseDraft(row)
  assert.equal(draft.replacement, undefined)
  assert.equal(shownReplacement(row, draft), '2')
})

test('the replacement floor: short, or delivered + waived + pending, whichever is higher', () => {
  const row = fresh({
    shortQty: 2,
    replacedQty: 1,
    waivedQty: 0,
    pendingReplacementQty: 2,
    replacementLimitQty: 10,
    wrongItemQty: 3,
    damagedQty: 3,
  })
  assert.equal(replacementMin(row), 3)
  assert.equal(
    caseDraftError(row, { wrong: '0', damaged: '0', replacement: '2', note: '' }),
    'NCC giao bù tối thiểu 3.',
  )
  assert.equal(
    caseDraftError(row, { wrong: '0', damaged: '0', replacement: '3', note: '' }),
    '',
  )
  // Gợi ý không xuống dưới sàn.
  assert.equal(shownReplacement(row, { wrong: '0', damaged: '0', note: '' }), '3')
  assert.equal(replacementMin({ ...row, replacementDelivery: true }), 0)
})

test('replacement is suggested from short plus returned until the user edits it', () => {
  const row = fresh({ shortQty: 2, replacementLimitQty: 4 })
  assert.equal(shownReplacement(row, { wrong: '1', damaged: '3', note: '' }), '4')
  assert.equal(
    shownReplacement(row, { wrong: '1', damaged: '0', replacement: '1', note: '' }),
    '1',
  )
  assert.equal(replacementMax({ ...row, replacementDelivery: true }), 0)
  assert.equal(
    caseDraftError(row, { wrong: '0', damaged: '0', replacement: '5', note: '' }),
    'NCC giao bù tối đa 4.',
  )
})

test('a bad quantity is reported on its own field only', () => {
  const row = fresh()
  // Giao sai chỉ được trả tối đa 0 (chưa có gì phải trả, không giữ); hỏng và giao bù hợp lệ.
  assert.deepEqual(
    caseDraftFieldErrors(row, { wrong: '9', damaged: '0', note: '' }),
    { wrong: 'Hàng giao sai trả tối đa 0.', damaged: '', replacement: '' },
  )
  assert.deepEqual(
    caseDraftFieldErrors(row, { wrong: '0', damaged: '', note: '' }),
    { wrong: '', damaged: 'Nhập số nguyên từ 0 trở lên.', replacement: '' },
  )
  assert.equal(caseDraftError(row, { wrong: '0', damaged: '0', note: '' }), '')
})

test('acceptance types are locked per kind while a request is pending', () => {
  const row = fresh({
    wrongUndecidedQty: 2,
    damagedUndecidedQty: 1,
    pendingRequests: [{ type: 'WRONG_ITEM', quantity: 2 }],
  })
  assert.deepEqual(acceptanceOpenTypes(row), ['DAMAGED'])
})

test('receiptHandlingStatus never reports done when the excess lines could not be loaded', () => {
  assert.deepEqual(
    receiptHandlingStatus({ openCases: 0, waitingExcess: 0, handlingComplete: null }),
    { done: false, text: 'Chưa tải được hàng thừa của phiếu, chưa xác định được' },
  )
  assert.equal(
    receiptHandlingStatus({ openCases: 0, waitingExcess: 0, handlingComplete: true }).done,
    true,
  )
  assert.deepEqual(
    receiptHandlingStatus({ openCases: 1, waitingExcess: 2, handlingComplete: false }),
    { done: false, text: '1 hồ sơ sai lệch đang mở · 2 dòng hàng thừa chờ Owner' },
  )
  assert.deepEqual(
    receiptHandlingStatus({ openCases: 0, waitingExcess: 0, handlingComplete: false }),
    { done: false, text: 'Chưa xử lý xong' },
  )
})

// ---- GVHD 24/11: bảng hướng xử lý, quy tắc PM Q2 -------------------------------------------------------------------

// Chưa chốt: thiếu 2, giao sai 3, hỏng 1, cả 4 hàng đang giữ, hạn mức 6.
const undecided = fresh({
  shortQty: 2,
  wrongItemQty: 3,
  damagedQty: 1,
  wrongUndecidedQty: 3,
  damagedUndecidedQty: 1,
  heldUndecidedQty: 4,
  replacementRequiredQty: 2,
  replacementLimitQty: 6,
  decisionStatus: 'UNDECIDED',
  decisionType: null,
})

test('mặc định chưa chốt: trả hết, giao bù = thiếu + trả sai + trả hỏng, BM tự lưu', () => {
  const draft = decisionDraft(undecided)
  assert.equal(draft.type, 'RETURN_AND_REPLACE')
  assert.deepEqual(decisionLine(undecided, draft), {
    caseId: 1,
    decisionType: 'RETURN_AND_REPLACE',
    wrongReturnQty: 3,
    damagedReturnQty: 1,
    replacementRequiredQty: 6,
  })
  assert.equal(decisionDraftError(undecided, draft), '')
  assert.equal(decisionNeedsOwner(undecided, draft, false), false)
  assert.equal(decisionSaveButtons(false, false).save.blocked, '')
  assert.match(decisionSaveButtons(false, false).propose.blocked, /không cần Owner/)
  assert.equal(standardReplacement(undecided, 3, 0), 5)
})

test("(2') giao bù khác chuẩn thì BM phải đề nghị Owner; Owner lưu là chốt", () => {
  const draft = { ...decisionDraft(undecided), damaged: '0', replacement: '6' }
  assert.equal(decisionNeedsOwner(undecided, draft, false), true)
  assert.equal(decisionNeedsOwner(undecided, draft, true), false)
  assert.match(decisionSaveButtons(true, false).save.blocked, /phải qua Owner/)
  assert.equal(decisionSaveButtons(true, false).propose.label, 'Đề nghị Owner xử lý')
  assert.equal(decisionSaveButtons(true, false).propose.blocked, '')
  assert.equal(decisionSaveButtons(false, true).propose, null)
  assert.match(decisionDraftError(undecided, { ...draft, replacement: '1' }), /tối thiểu 2/)
  assert.match(decisionDraftError(undecided, { ...draft, replacement: '7' }), /tối đa 6/)
})

test('(1) và (3) luôn cần Owner, không giao bù; (3) không trả gì', () => {
  const back = { type: 'RETURN_NO_REPLACEMENT', wrong: '3', damaged: '1' }
  assert.equal(decisionNeedsOwner(undecided, back, false), true)
  assert.equal(decisionLine(undecided, back).replacementRequiredQty, 0)
  const keep = { type: 'ACCEPT_NO_REPLACEMENT', wrong: '3', damaged: '1' }
  assert.deepEqual(decisionLine(undecided, keep), {
    caseId: 1,
    decisionType: 'ACCEPT_NO_REPLACEMENT',
    wrongReturnQty: 0,
    damagedReturnQty: 0,
    replacementRequiredQty: 0,
  })
  assert.equal(decisionNeedsOwner(undecided, keep, false), true)
  assert.match(decisionDraftError(undecided, { ...back, wrong: '4' }), /tối đa 3/)
})

test('hướng (3) chỉ có khi dòng có hàng sai hoặc hỏng; dòng chỉ thiếu thì (1) hoặc (2)', () => {
  assert.deepEqual(decisionOptions(undecided), [
    'RETURN_NO_REPLACEMENT',
    'RETURN_AND_REPLACE',
    'ACCEPT_NO_REPLACEMENT',
  ])
  const onlyShort = fresh({ shortQty: 2, wrongItemQty: 0, damagedQty: 0, replacementLimitQty: 2 })
  assert.deepEqual(decisionOptions(onlyShort), ['RETURN_NO_REPLACEMENT', 'RETURN_AND_REPLACE'])
  assert.equal(decisionDraftError(onlyShort, decisionDraft(onlyShort)), '')
})

test('dòng chờ Owner mở lại đúng số đề nghị; dòng đã chốt mở lại số đang lưu', () => {
  const awaiting = fresh({
    ...undecided,
    decisionStatus: 'AWAITING_OWNER',
    decisionType: 'RETURN_NO_REPLACEMENT',
    proposedWrongReturnQty: 2,
    proposedDamagedReturnQty: 1,
    proposedReplacementQty: 0,
  })
  assert.deepEqual(decisionDraft(awaiting), {
    type: 'RETURN_NO_REPLACEMENT',
    wrong: '2',
    damaged: '1',
    replacement: '0',
  })
  const decided = fresh({
    ...undecided,
    decisionStatus: 'DECIDED',
    decisionType: 'RETURN_AND_REPLACE',
    wrongReturnRequiredQty: 3,
    replacementRequiredQty: 5,
  })
  assert.equal(decisionDraft(decided).replacement, '5')
})

test('an open case with no direction yet only says it is undecided (review 25/11, R-05)', () => {
  const row = fresh({
    shortQty: 2,
    damagedQty: 1,
    damagedUndecidedQty: 1,
    heldUndecidedQty: 1,
    replacementRequiredQty: 2,
    openReplacementQty: 2,
    decisionStatus: 'UNDECIDED',
  })
  assert.equal(caseStatusLabel(row), 'Chưa quyết định')
  assert.deepEqual(
    summaryBoxes(row).map((box) => box.title),
    ['Sai lệch khi nhận', 'Đang giữ tại kho, chưa quyết định'],
  )
  const owing = { ...row, outstandingReturnQty: 2, excessOutstandingReturnQty: 2 }
  assert.equal(caseStatusLabel(owing), 'Chưa quyết định · Còn phải trả 2')
  assert.equal(summaryBoxes(owing).length, 3)
  const decided = { ...row, decisionStatus: 'DECIDED' }
  assert.match(caseStatusLabel(decided), /Chờ NCC giao bù 2/)
  assert.equal(summaryBoxes(decided).length, 3)
})

test('a replacement delivery never asks for another replacement by default', () => {
  const row = fresh({
    replacementDelivery: true,
    shortQty: 1,
    damagedQty: 1,
    replacementLimitQty: 2,
    decisionStatus: 'UNDECIDED',
  })
  assert.equal(standardReplacement(row, 0, 1), 0)
  assert.equal(decisionNumbers(row, decisionDraft(row)).replacement, 0)
})

test('caseProgress names the stage and only the work still open', () => {
  const row = fresh({ damagedQty: 2, heldUndecidedQty: 2, decisionStatus: 'UNDECIDED' })
  assert.deepEqual(caseProgress(row), { label: 'Chưa chốt', tone: 'warning', lines: [] })
  const decided = {
    ...row,
    heldUndecidedQty: 0,
    decisionStatus: 'DECIDED',
    outstandingReturnQty: 2,
    outstandingReplacementQty: 2,
    openReplacementQty: 2,
  }
  assert.deepEqual(caseProgress(decided).lines, ['Còn phải trả NCC 2', 'Chờ NCC giao bù 2'])
  assert.equal(caseProgress(decided).label, 'Đã chốt, đang xử lý')
  assert.equal(caseProgress({ ...row, decisionStatus: 'AWAITING_OWNER' }).label, 'Chờ Owner duyệt')
  assert.equal(caseProgress({ ...row, status: 'CLOSED' }).label, 'Đã đóng')
})
