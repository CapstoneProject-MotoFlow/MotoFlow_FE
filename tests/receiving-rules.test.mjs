import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import ts from 'typescript'
const source = readFileSync(
  new URL('../src/modules/receiving/receivingRules.ts', import.meta.url),
  'utf8',
)
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
})
const {
  handlingDraft,
  replacementValue,
  receiptWork,
  inspectionQuantitiesValid,
  receiptDateLimits,
  receiptDatesInFuture,
} = await import(
  'data:text/javascript;base64,' + Buffer.from(outputText).toString('base64')
)
const row = {
  shortQty: 0,
  wrongItemQty: 0,
  damagedQty: 5,
  rejectedExcessQty: 0,
  returnRequiredQty: 0,
  replacementRequiredQty: 5,
  replacementLimitQty: 5,
  replacementDelivery: false,
}
test('saved replacement agreement survives reopening and changing only returned quantity', () => {
  const draft = handlingDraft(row)
  assert.equal(replacementValue(row, draft), '5')
  assert.equal(replacementValue(row, { ...draft, returned: '2' }), '5')
})
test('unagreed handling suggests replacement until manually changed, caps it and excludes rejected excess', () => {
  const unagreed = {
    ...row,
    shortQty: 2,
    rejectedExcessQty: 1,
    replacementRequiredQty: 0,
    replacementLimitQty: 6,
  }
  const draft = handlingDraft(unagreed)
  assert.equal(replacementValue(unagreed, { ...draft, returned: '4' }), '5')
  assert.equal(replacementValue(unagreed, { ...draft, returned: '20' }), '6')
  assert.equal(
    replacementValue(unagreed, { returned: '4', replacement: '3' }),
    '3',
  )
  assert.equal(
    replacementValue({ ...row, replacementDelivery: true }, draft),
    '0',
  )
})
test('quantity validation rejects nonintegers, negatives and defects exceeding delivered goods', () => {
  assert.ok(inspectionQuantitiesValid([10, 8, 2, 1]))
  for (const values of [
    [10, 8, 7, 2],
    [0, -1, 0, 0],
    [1, 1.5, 0, 0],
    [1, NaN, 0, 0],
  ]) {
    assert.equal(inspectionQuantitiesValid(values), false)
  }
})
test('receipt dates use the local day and reject a future date or arrival', () => {
  const now = new Date(2026, 10, 11, 0, 5, 30)
  assert.deepEqual(receiptDateLimits(now), {
    date: '2026-11-11',
    dateTime: '2026-11-11T00:05',
  })
  assert.equal(receiptDatesInFuture('2026-11-12', '', now), true)
  assert.equal(
    receiptDatesInFuture('2026-11-11', '2026-11-11T00:06', now),
    true,
  )
  assert.equal(
    receiptDatesInFuture('2026-11-11', '2026-11-11T00:05', now),
    false,
  )
  assert.equal(receiptDatesInFuture('2026-11-10', '', now), false)
})
test('BM action prefers confirmation, then unassigned inspection and stays within the PO', () => {
  const receipt = (id, purchaseOrderId, status, assigneeName = null) => ({
    id,
    purchaseOrderId,
    status,
    assigneeName,
    deliveryDocumentNo: String(id),
  })
  const receipts = [
    receipt(1, 4, 'AWAITING_INSPECTION'),
    receipt(2, 4, 'AWAITING_CONFIRMATION'),
    receipt(3, 7, 'AWAITING_CONFIRMATION'),
  ]
  assert.equal(receiptWork(receipts, 4).id, 2)
  assert.equal(receiptWork([receipts[0]], 4).id, 1)
  assert.equal(
    receiptWork([receipt(1, 4, 'AWAITING_INSPECTION', 'Lan')], 4),
    undefined,
  )
  assert.equal(receiptWork(receipts, 8), undefined)
})
