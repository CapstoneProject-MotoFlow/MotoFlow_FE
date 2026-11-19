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
  inspectionResult,
  receiptDateLimits,
  receiptDatesInFuture,
  purchaseOrderFormError,
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
test('supplier inspection separates document shortages from excess against outstanding quantity', () => {
  assert.deepEqual(inspectionResult(['12', '10', '1', '2'], 5), {
    documentQty: 12,
    deliveredQty: 10,
    wrongItemQty: 1,
    damagedQty: 2,
    passedQty: 7,
    shortQty: 2,
    excessQty: 2,
  })
  assert.equal(inspectionResult(['', '0', '0', '0'], 5), null)
  assert.equal(inspectionResult(['12', '2', '1', '2'], 5), null)
  assert.equal(inspectionResult(['0', '0', '0', '0'], 5).shortQty, 0)
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

test('purchase order form names the missing field (mục 1)', () => {
  const line = { label: 'dòng 1', productId: 5, quantity: '2', price: '1000' }
  assert.equal(
    purchaseOrderFormError({ supplier: false, store: true, lines: [line] }),
    'Vui lòng chọn nhà cung cấp.',
  )
  assert.equal(
    purchaseOrderFormError({ supplier: true, store: false, lines: [line] }),
    'Vui lòng chọn kho nhận.',
  )
  assert.equal(
    purchaseOrderFormError({ supplier: true, store: true, lines: [] }),
    'Vui lòng thêm ít nhất một phụ tùng.',
  )
  assert.equal(
    purchaseOrderFormError({
      supplier: true,
      store: true,
      lines: [{ ...line, productId: 0 }],
    }),
    'Vui lòng chọn phụ tùng dòng 1.',
  )
  assert.equal(
    purchaseOrderFormError({
      supplier: true,
      store: true,
      lines: [{ ...line, price: '' }],
    }),
    'Vui lòng nhập giá nhập dòng 1.',
  )
  assert.equal(
    purchaseOrderFormError({
      supplier: true,
      store: true,
      lines: [{ ...line, quantity: '0' }],
    }),
    'Số lượng dòng 1 phải là số nguyên từ 1 đến 1.000.000.',
  )
  assert.equal(
    purchaseOrderFormError({ supplier: true, store: true, lines: [line] }),
    '',
  )
})

test('replenishment purchase popup skips zero lines but needs one', () => {
  const line = {
    label: 'của BUG-1',
    quantity: '0',
    price: '',
    allowZero: true,
    maxQuantity: 20,
  }
  assert.equal(
    purchaseOrderFormError({ supplier: true, store: true, lines: [line] }),
    'Vui lòng nhập số lượng mua cho ít nhất một phụ tùng.',
  )
  assert.equal(
    purchaseOrderFormError({
      supplier: true,
      store: true,
      lines: [{ ...line, quantity: '21' }],
    }),
    'Số lượng của BUG-1 phải là số nguyên từ 0 đến 20.',
  )
  assert.equal(
    purchaseOrderFormError({
      supplier: true,
      store: true,
      lines: [{ ...line, quantity: '3' }],
    }),
    'Vui lòng nhập giá nhập của BUG-1.',
  )
})
