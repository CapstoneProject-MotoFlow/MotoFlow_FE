import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { createServer } from 'vite'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
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

test('the replenishment purchase URL renders through the app router without suspending', async () => {
  const server = await createServer({
    configFile: false,
    server: { middlewareMode: true, ws: false, watch: null },
    appType: 'custom',
  })
  try {
    const { default: AppRoutes } = await server.ssrLoadModule(
      '/src/app/routes/AppRoutes.tsx',
    )
    const { AuthContext } = await server.ssrLoadModule(
      '/src/shared/hooks/useAuth.tsx',
    )
    const html = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        { initialEntries: ['/replenishment-requests/4?action=purchase'] },
        createElement(
          AuthContext.Provider,
          { value: { user: { username: 'owner', role: 'OWNER' } } },
          createElement(AppRoutes),
        ),
      ),
    )
    assert.match(html, /Yêu cầu bổ sung YBS-0004/)
    assert.doesNotMatch(html, /Không mở được trang|Đang tải trang/)
  } finally {
    await server.close()
  }
})

test('central managers default to coordination before any replenishments are loaded', async () => {
  const server = await createServer({
    configFile: false,
    server: { middlewareMode: true, hmr: false, watch: null },
    appType: 'custom',
  })
  try {
    const { default: ReplenishmentListPage } = await server.ssrLoadModule(
      '/src/modules/transfers/ReplenishmentListPage.tsx',
    )
    const { default: ManagerTransferListPage } = await server.ssrLoadModule(
      '/src/modules/transfers/ManagerTransferListPage.tsx',
    )
    const { AuthContext } = await server.ssrLoadModule(
      '/src/shared/hooks/useAuth.tsx',
    )
    const render = (role, central, Page = ReplenishmentListPage) =>
      renderToStaticMarkup(
        createElement(
          AuthContext.Provider,
          { value: { user: { username: 'test', role, central } } },
          createElement(MemoryRouter, null, createElement(Page)),
        ),
      )
    assert.match(
      render('BRANCH_MANAGER', true),
      /aria-pressed="true">Chờ điều phối/,
    )
    assert.match(
      render('BRANCH_MANAGER', false),
      /aria-pressed="true">Chưa đóng/,
    )
    assert.match(render('OWNER', false), /aria-pressed="true">Chờ điều phối/)
    assert.doesNotMatch(
      render('BRANCH_MANAGER', false, ManagerTransferListPage),
      /href="\/transfer-orders\/new"/,
    )
    assert.match(
      render('BRANCH_MANAGER', true, ManagerTransferListPage),
      /href="\/transfer-orders\/new"/,
    )
    assert.match(
      render('OWNER', false, ManagerTransferListPage),
      /href="\/transfer-orders\/new"/,
    )
  } finally {
    await server.close()
  }
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
