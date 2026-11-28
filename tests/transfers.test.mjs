import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PassThrough } from 'node:stream'
import ts from 'typescript'
import { createServer } from 'vite'
import { createElement } from 'react'
import { renderToPipeableStream, renderToStaticMarkup } from 'react-dom/server'
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
  remainingToPurchase,
  remainingToBuy,
  pendingExcess,
  canConfirmExcess,
  returnableQuantities,
  hasExistingPurchase,
  receiptShortage,
  receiptExcess,
  reconciliationTimeline,
  openWrongItems,
  wrongParts,
} = await import(
  'data:text/javascript;base64,' + Buffer.from(outputText).toString('base64')
)

test('a submitted transfer receipt keeps wrong items out of the shortage (test 23/11 T-11)', () => {
  // Xuất 20, đạt 18, giao sai 1, hỏng 1: BE deliveredQty = 20 nhưng vẫn thiếu 1.
  assert.equal(
    receiptShortage({ documentQty: 20, passedQty: 18, damagedQty: 1 }),
    1,
  )
  assert.equal(
    receiptShortage({ documentQty: 5, passedQty: 6, damagedQty: 0 }),
    0,
  )
})

test('damaged above the dispatch is not excess (PM 23/11)', () => {
  // Xuất 5, hỏng 20, đạt 0: không thừa, 15 hỏng vượt chỉ ghi trên phiếu.
  assert.equal(
    receiptExcess({ documentQty: 5, passedQty: 0, damagedQty: 20 }),
    0,
  )
  // Xuất 5, đạt 3, hỏng 20: hỏng lấp đủ 5, 3 đạt là thừa (khớp BE).
  assert.equal(
    receiptExcess({ documentQty: 5, passedQty: 3, damagedQty: 20 }),
    3,
  )
  // Xuất 20, đạt 10, hỏng 20 (ảnh PM): thừa 10.
  assert.equal(
    receiptExcess({ documentQty: 20, passedQty: 10, damagedQty: 20 }),
    10,
  )
  assert.equal(
    receiptExcess({ documentQty: 5, passedQty: 6, damagedQty: 0 }),
    1,
  )
})

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
  assert.equal(
    remainingToPurchase({ ...demand, orderedQty: 1 }),
    2,
  )
  assert.equal(
    remainingToBuy({ requestedQty: 10, plannedQty: 2, toPurchaseQty: 5, orderedQty: 3 }),
    5,
  )
})

test('the replenishment purchase URL renders after the lazy route loads', async () => {
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
    const app = createElement(
      MemoryRouter,
      { initialEntries: ['/replenishment-requests/4?action=purchase'] },
      createElement(
        AuthContext.Provider,
        { value: { user: { username: 'owner', role: 'OWNER' } } },
        createElement(AppRoutes),
      ),
    )
    const html = await new Promise((resolve, reject) => {
      const output = new PassThrough()
      let markup = ''
      output.setEncoding('utf8')
      output.on('data', (chunk) => {
        markup += chunk
      })
      output.on('end', () => resolve(markup))
      output.on('error', reject)
      const stream = renderToPipeableStream(app, {
        onAllReady: () => stream.pipe(output),
        onError: reject,
      })
    })
    assert.match(html.replaceAll('<!-- -->', ''), /Yêu cầu bổ sung YBS-0004/)
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
  // Post-23/11 transfer excess uses Owner's decision flow, so BE sends legacyExcessQty: 0.
  assert.equal(
    pendingExcess({
      extraReceivedQty: 3,
      extraDispatchedQty: 0,
      legacyExcessQty: 0,
    }),
    0,
  )
  assert.equal(
    canConfirmExcess('RECONCILING', [
      { extraReceivedQty: 3, extraDispatchedQty: 0, legacyExcessQty: 0 },
    ]),
    false,
  )
  // Pre-23/11 legacy excess remains confirmable when legacyExcessQty > extraDispatchedQty.
  assert.equal(
    pendingExcess({
      extraReceivedQty: 5,
      extraDispatchedQty: 1,
      legacyExcessQty: 3,
    }),
    2,
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

test('the reconciliation history lists who did what, oldest first (review 25/11, R-02)', () => {
  const entries = reconciliationTimeline({
    discrepancyAcknowledgedAt: '2026-11-25T10:00:00',
    discrepancyAcknowledgedBy: { fullName: 'BM nhận' },
    reconciliationNote: 'Thiếu 1, giao sai 2',
    reconciliationConfirmedAt: '2026-11-25T11:00:00',
    reconciliationConfirmedBy: { fullName: 'BM gửi' },
    closedAt: '2026-11-25T12:00:00',
    closedBy: { fullName: 'Owner' },
    lines: [{ productId: 7, sku: 'MA-PHANH' }],
    discrepancies: [
      {
        productId: 7,
        events: [
          {
            id: 1,
            resolutionType: 'WRONG_ITEM_RETURNED',
            quantity: 1,
            reason: null,
            occurredAt: '2026-11-25T09:00:00',
            confirmedAt: null,
            receivedSku: 'XICH',
            status: 'REJECTED',
            recordedBy: { fullName: 'BM nhận' },
            rejectedBy: { fullName: 'BM gửi' },
            rejectedAt: '2026-11-25T09:30:00',
            rejectionReason: 'Chưa nhận lại',
          },
          {
            id: 2,
            resolutionType: 'RECEIVED_AS_OTHER_PRODUCT',
            quantity: 2,
            reason: null,
            occurredAt: '2026-11-25T09:40:00',
            confirmedAt: '2026-11-25T09:50:00',
            receivedSku: 'XICH',
            status: 'CONFIRMED',
            recordedBy: { fullName: 'BM nhận' },
            confirmedBy: { fullName: 'BM gửi' },
          },
          {
            id: 3,
            resolutionType: 'NO_REPLACEMENT',
            quantity: 1,
            reason: null,
            occurredAt: '2026-11-25T09:45:00',
            confirmedAt: null,
          },
        ],
      },
    ],
  })
  assert.deepEqual(
    entries.map((entry) => [entry.title, entry.by]),
    [
      [
        'Kho nhận hoàn trả hàng giao sai: 1 × XICH (giao kèm MA-PHANH)',
        'BM nhận',
      ],
      ['Kho gửi từ chối việc hoàn trả: 1 × XICH (giao kèm MA-PHANH)', 'BM gửi'],
      [
        'Kho nhận lập phiếu nhận hàng giao sai: 2 × XICH (giao kèm MA-PHANH)',
        'BM nhận',
      ],
      [
        'Kho gửi xác nhận phiếu nhận hàng giao sai: 2 × XICH (giao kèm MA-PHANH)',
        'BM gửi',
      ],
      ['Kho nhận gửi yêu cầu đối soát', 'BM nhận'],
      ['Kho gửi xác nhận đối soát', 'BM gửi'],
      ['Owner đóng phiếu', 'Owner'],
    ],
  )
  assert.equal(entries[1].detail, 'Chưa nhận lại')
  assert.equal(entries[4].detail, 'Thiếu 1, giao sai 2')
  assert.deepEqual(
    reconciliationTimeline({
      closedAt: '2026-11-25T12:00:00',
      closedBy: { fullName: 'Owner' },
      lines: [],
      discrepancies: [],
    }),
    [],
  )
})

test('wrong items still blocking the close are counted beside the button (review 25/11, R-03)', () => {
  assert.deepEqual(
    openWrongItems([
      { sku: 'A', wrongPendingQty: 1, wrongAwaitingSourceQty: 2 },
      { sku: 'B', wrongPendingQty: 0, wrongAwaitingSourceQty: 0 },
      { sku: 'C', wrongPendingQty: null, wrongAwaitingSourceQty: 1 },
    ]),
    { pending: 1, awaiting: 3, total: 4, skus: ['A x3', 'C x1'] },
  )
})

test('wrongParts excludes rejected or cancelled wrong-item returns and receipts (T-03)', () => {
  const order = {
    discrepancies: [
      {
        productId: 10,
        events: [
          {
            resolutionType: 'WRONG_ITEM_RETURNED',
            quantity: 1,
            receivedSku: 'BUGI-A',
            status: 'REJECTED',
          },
          {
            resolutionType: 'WRONG_ITEM_RETURNED',
            quantity: 1,
            receivedSku: 'BUGI-A',
            status: 'AWAITING_SOURCE',
          },
          {
            resolutionType: 'RECEIVED_AS_OTHER_PRODUCT',
            quantity: 2,
            receivedSku: 'BUGI-B',
            status: 'CONFIRMED',
          },
          {
            resolutionType: 'RECEIVED_AS_OTHER_PRODUCT',
            quantity: 1,
            receivedSku: 'BUGI-C',
            status: 'CANCELLED',
          },
        ],
      },
    ],
  }
  assert.equal(
    wrongParts(order, 10),
    'BUGI-A x1 hoàn trả (chờ kho gửi), BUGI-B x2 nhập kho',
  )
})
