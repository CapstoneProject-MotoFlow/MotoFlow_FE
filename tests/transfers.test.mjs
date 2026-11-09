import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
const { outputText } = ts.transpileModule(
  readFileSync(
    new URL('../src/modules/transfers/transferRules.ts', import.meta.url),
    'utf8',
  ),
  {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  },
)
const {
  transferQuantitiesValid,
  receiptAcceptsResult,
  unplannedQuantity,
  purchaseQuantityLimit,
  pendingExcess,
  canConfirmExcess,
  returnableQuantities,
  hasExistingPurchase,
} = await import(
  'data:text/javascript;base64,' + Buffer.from(outputText).toString('base64')
)

test('existing non-cancelled purchases prevent duplicate creation', () => {
  assert.equal(hasExistingPurchase([]), false)
  assert.equal(hasExistingPurchase([{ status: 'CANCELLED' }]), false)
  for (const status of ['AWAITING_DELIVERY', 'RECEIVING', 'FULLY_RECEIVED'])
    assert.equal(
      hasExistingPurchase([{ status: 'CANCELLED' }, { status }]),
      true,
    )
})

test('planning excludes quantities already planned and assigned to purchasing', () => {
  const demand = { requestedQty: 10, plannedQty: 6, toPurchaseQty: 3 }
  assert.equal(unplannedQuantity(demand), 1)
  // Purchasing replaces its previous total, so the limit includes that old total.
  assert.equal(purchaseQuantityLimit(demand), 4)
  assert.equal(unplannedQuantity({ ...demand, plannedQty: 12 }), 0)
})

test('extra dispatch is available only for outstanding excess during reconciliation', () => {
  const line = { extraReceivedQty: 5, extraDispatchedQty: 3 }
  assert.equal(pendingExcess(line), 2)
  assert.equal(canConfirmExcess('RECONCILING', [line]), true)
  assert.equal(canConfirmExcess('IN_TRANSIT', [line]), false)
  assert.equal(
    canConfirmExcess('RECONCILING', [{ ...line, extraDispatchedQty: 5 }]),
    false,
  )
  assert.equal(
    pendingExcess({ extraReceivedQty: null, extraDispatchedQty: null }),
    0,
  )
})

test('returns subtract open receipts and exclude settled or unrelated decisions', () => {
  const event = {
    resolutionType: 'RECEIVED_BACK_AT_SOURCE',
    quantity: 5,
    confirmedAt: null,
  }
  const order = {
    lines: [
      { productId: 1, sku: 'A' },
      { productId: 2, sku: 'B' },
    ],
    discrepancies: [
      {
        productId: 1,
        events: [
          event,
          { ...event, quantity: 8, confirmedAt: '2026-11-09' },
          { ...event, quantity: 9, resolutionType: 'APPROVED_LOSS' },
        ],
      },
    ],
  }
  assert.deepEqual(
    returnableQuantities(order, [
      { lines: [{ productId: 1, documentQty: 3 }] },
    ]),
    [{ productId: 1, sku: 'A', quantity: 2 }],
  )
  assert.deepEqual(
    returnableQuantities(order, [
      { lines: [{ productId: 1, documentQty: 7 }] },
    ]),
    [],
  )
})
test('transfer creation refuses duplicate parts, fractional and out-of-range quantities', () => {
  assert.equal(transferQuantitiesValid([{ productId: 1, quantity: 2 }]), true)
  for (const rows of [
    [],
    [
      { productId: 1, quantity: 1 },
      { productId: 1, quantity: 2 },
    ],
    [{ productId: 1, quantity: 0.5 }],
    [{ productId: 1, quantity: 2147483648 }],
  ])
    assert.equal(transferQuantitiesValid(rows), false)
})
test('zero quantities are accepted only for recording results', () => {
  assert.equal(transferQuantitiesValid([{ productId: 1, quantity: 0 }]), false)
  assert.equal(
    transferQuantitiesValid([{ productId: 1, quantity: 0 }], true),
    true,
  )
})

test('receipt results lock after submission and unlock only for recount', () => {
  assert.equal(receiptAcceptsResult('AWAITING_INSPECTION'), true)
  assert.equal(receiptAcceptsResult('AWAITING_RECOUNT'), true)
  assert.equal(receiptAcceptsResult('AWAITING_CONFIRMATION'), false)
  assert.equal(receiptAcceptsResult('CONFIRMED'), false)
})
