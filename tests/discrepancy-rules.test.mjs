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
  replacementMin,
  returnKindOptions,
  acceptanceOpenTypes,
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
})

test('replacement floor: short, or delivered + waived + pending, whichever is higher', () => {
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
  assert.equal(replacementMin({ ...row, replacementDelivery: true }), 0)
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
  assert.equal(
    receiptHandlingStatus({ openCases: 0, waitingExcess: 0, handlingComplete: null }).done,
    false,
  )
  assert.deepEqual(
    receiptHandlingStatus({ openCases: 0, waitingExcess: 0, handlingComplete: true }),
    { done: true, text: 'Đã xử lý xong' },
  )
  assert.deepEqual(
    receiptHandlingStatus({ openCases: 1, waitingExcess: 2, handlingComplete: false }),
    { done: false, text: 'Còn 1 hồ sơ mở · 2 hàng thừa chờ Owner' },
  )
  assert.deepEqual(
    receiptHandlingStatus({ openCases: 0, waitingExcess: 0, handlingComplete: false }),
    { done: false, text: 'Chưa xử lý xong' },
  )
})

// ---- GVHD 24/11: bảng hướng đề xuất xử lý, quy tắc PM Q2 ----------------------------------------------------------

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
  assert.match(decisionSaveButtons(false, false).propose.blocked, /Lưu hướng xử lý/)
  assert.equal(standardReplacement(undecided, 3, 0), 5)
})

test("(2') giao bù khác chuẩn thì BM phải đề nghị Owner; Owner lưu là chốt", () => {
  const draft = { ...decisionDraft(undecided), damaged: '0', replacement: '6' }
  assert.equal(decisionNeedsOwner(undecided, draft, false), true)
  assert.equal(decisionNeedsOwner(undecided, draft, true), false)
  assert.match(decisionSaveButtons(true, false).save.blocked, /Owner duyệt/)
  assert.equal(decisionSaveButtons(true, false).propose.label, 'Đề nghị Owner duyệt')
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

test('caseProgress splits held goods by kind and only lists open work', () => {
  const row = fresh({
    wrongItemQty: 2,
    damagedQty: 1,
    wrongUndecidedQty: 2,
    damagedUndecidedQty: 1,
    heldUndecidedQty: 3,
    decisionStatus: 'UNDECIDED',
  })
  assert.deepEqual(caseProgress(row), { label: 'Chưa chốt', tone: 'warning', lines: [] })

  const decidedHeld = {
    ...row,
    decisionStatus: 'DECIDED',
    outstandingReturnQty: 1,
    outstandingReplacementQty: 2,
    openReplacementQty: 2,
  }
  assert.deepEqual(caseProgress(decidedHeld), {
    label: 'Đã chốt',
    tone: 'info',
    lines: ['Đang giữ: 2 sai, 1 hỏng', 'Còn trả NCC: 1', 'Chờ giao bù: 2'],
  })
  assert.equal(caseProgress({ ...row, decisionStatus: 'AWAITING_OWNER' }).label, 'Chờ Owner duyệt')
  assert.equal(caseProgress({ ...row, status: 'CLOSED' }).label, 'Đã đóng')
})
