import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import { MemoryRouter } from 'react-router-dom'
import { fileURLToPath } from 'node:url'

function deposit(overrides = {}) {
  return {
    total: 1500000,
    unverified: 0,
    applied: 0,
    refunded: 0,
    remaining: 1500000,
    expiresOn: '2026-12-31',
    status: 'ACTIVE',
    forfeitedAmount: null,
    forfeitedAt: null,
    forfeitedById: null,
    forfeitedBy: null,
    expiryChanges: [],
    ...overrides,
  }
}

function order(depositOverrides, actions = {}, extra = {}) {
  return {
    id: 21,
    code: 'SO-21',
    version: 3,
    status: 'AWAITING_STOCK',
    storeName: 'Kho',
    customerName: 'Khách',
    customerId: 4,
    priceType: 'RETAIL',
    discount: 0,
    createdAt: '2026-11-20',
    assigneeName: null,
    netPaid: 0,
    credit: 0,
    depositApplied: 0,
    deposit: depositOverrides === null ? null : deposit(depositOverrides),
    actions: {
      canUpdate: false,
      canAssignPicker: false,
      canRecordPicking: false,
      canConfirm: false,
      canRecordPayment: false,
      canRefund: false,
      canRecordCredit: false,
      canComplete: false,
      canCancel: true,
      ...actions,
    },
    lines: [],
    versions: [],
    events: [],
    payments: [],
    ...extra,
  }
}

async function withPanel(run) {
  const server = await createServer({
    configFile: false,
    server: { middlewareMode: true, hmr: false, watch: null },
    appType: 'custom',
  })
  try {
    const { default: SalesDepositPanel } = await server.ssrLoadModule(
      '/src/modules/sales/SalesDepositPanel.tsx',
    )
    const render = (props) =>
      renderToStaticMarkup(
        createElement(SalesDepositPanel, {
          onChanged: () => {},
          ...props,
        }),
      )
    await run(render)
  } finally {
    await server.close()
  }
}

test('an active deposit with no deposit permissions shows amounts and no buttons', async () => {
  await withPanel((render) => {
    const html = render({ order: order({ status: 'ACTIVE' }) })
    assert.match(html, /aria-label="Tiền cọc"/)
    assert.match(html, /Còn giữ/)
    assert.match(html, /1\.500\.000/)
    assert.match(html, /31\/12\/2026/)
    assert.doesNotMatch(html, /<button/)
  })
})

test('an active deposit with record and expiry permissions shows those buttons only', async () => {
  await withPanel((render) => {
    const html = render({
      order: order(
        { status: 'ACTIVE' },
        { canRecordDeposit: true, canChangeDepositExpiry: true },
      ),
    })
    assert.match(html, /Thu thêm cọc/)
    assert.match(html, /Sửa hạn cọc/)
    assert.doesNotMatch(html, /Xác nhận mất cọc/)
  })
})

test('an expired deposit shows the red chip and the forfeit button', async () => {
  await withPanel((render) => {
    const html = render({
      order: order(
        { status: 'EXPIRED', expiresOn: '2026-11-01' },
        { canForfeitDeposit: true },
      ),
    })
    assert.match(html, /sales-deposit-chip is-danger/)
    assert.match(html, /Quá hạn cọc/)
    assert.match(html, /Xác nhận mất cọc/)
    assert.doesNotMatch(html, /Thu thêm cọc/)
  })
})

test('a forfeited deposit shows the forfeited amount and who forfeited it', async () => {
  await withPanel((render) => {
    const html = render({
      order: order({
        status: 'FORFEITED',
        remaining: 0,
        forfeitedAmount: 500000,
        forfeitedAt: '2026-11-21T09:30:00',
        forfeitedBy: 'Chủ cửa hàng',
      }),
    })
    assert.match(html, /Mất cọc/)
    assert.match(html, /500\.000/)
    assert.match(html, /bởi Chủ cửa hàng/)
    assert.match(html, /21\/11\/2026/)
    assert.match(html, /sales-deposit-chip is-muted/)
  })
})

test('a deposit with no money yet shows the first-deposit button when allowed', async () => {
  await withPanel((render) => {
    const html = render({
      order: order(
        { status: 'NONE', total: 0, remaining: 0, expiresOn: null },
        { canRecordDeposit: true },
      ),
    })
    assert.match(html, /Nhận cọc/)
    assert.doesNotMatch(html, /Thu thêm cọc/)
  })
})

test('a deposit with no money and no permission renders nothing', async () => {
  await withPanel((render) => {
    const html = render({
      order: order({ status: 'NONE', total: 0, remaining: 0, expiresOn: null }),
    })
    assert.equal(html, '')
  })
})

test('a missing deposit (staff or draft) renders nothing', async () => {
  await withPanel((render) => {
    assert.equal(render({ order: order(null, { canRecordDeposit: true }) }), '')
  })
})

test('expiry changes render as a history table', async () => {
  await withPanel((render) => {
    const html = render({
      order: order({
        expiryChanges: [
          {
            oldDate: '2026-12-01',
            newDate: '2026-12-31',
            changedById: 1,
            changedBy: 'Chủ cửa hàng',
            changedAt: '2026-11-22T10:00:00',
          },
        ],
      }),
    })
    assert.match(html, /Lịch sử sửa hạn/)
    assert.match(html, /Ngày cũ/)
    assert.match(html, /Ngày mới/)
    assert.match(html, /01\/12\/2026/)
    assert.match(html, /Chủ cửa hàng/)
  })
})

// FormDialog dùng createPortal lên document.body, nhưng server renderer không hỗ trợ portal.
// Test này thay 'react-dom' bằng helper trả về nội dung tại chỗ, chỉ trong server SSR của test này.
const noPortal = fileURLToPath(
  new URL('./helpers/react-dom-no-portal.mjs', import.meta.url),
)

test('cancelling a waiting order with a deposit warns that the customer forfeits it', async () => {
  const prevDocument = globalThis.document
  const server = await createServer({
    configFile: false,
    resolve: { alias: [{ find: /^react-dom$/, replacement: noPortal }] },
    server: { middlewareMode: true, hmr: false, watch: null },
    appType: 'custom',
  })
  try {
    const { default: SalesSettlementDialog } = await server.ssrLoadModule(
      '/src/modules/sales/SalesSettlementDialog.tsx',
    )
    const waiting = order(
      { status: 'ACTIVE', remaining: 500000 },
      { canCancel: true, cancelForfeitsDeposit: true },
    )
    // FormDialog đọc document.body khi render; SSR chỉ cần một đối tượng giữ chỗ.
    globalThis.document = { body: {} }
    const html = renderToStaticMarkup(
      createElement(SalesSettlementDialog, {
        action: 'cancel',
        order: waiting,
        onClose: () => {},
      }),
    )
    assert.match(html, /Khách sẽ mất cọc/)
    assert.match(html, /500\.000/)
  } finally {
    if (prevDocument === undefined) delete globalThis.document
    else globalThis.document = prevDocument
    await server.close()
  }
})

async function withSalesPages(run) {
  const server = await createServer({
    configFile: false,
    server: { middlewareMode: true, hmr: false, watch: null },
    appType: 'custom',
  })
  try {
    const pages = await server.ssrLoadModule(
      '/src/modules/sales/SalesPages.tsx',
    )
    const { AuthContext } = await server.ssrLoadModule(
      '/src/shared/hooks/useAuth.tsx',
    )
    const renderList = (role, url, orders) =>
      renderToStaticMarkup(
        createElement(
          AuthContext.Provider,
          {
            value: {
              user: { role, storeId: 1, storeName: 'Kho' },
              signIn: () => {},
              signOut: async () => {},
              finishPasswordChange: () => {},
            },
          },
          createElement(
            MemoryRouter,
            { initialEntries: [url] },
            createElement(pages.SalesOrderListPage, { orders }),
          ),
        ),
      )
    const renderDetail = (order) =>
      renderToStaticMarkup(
        createElement(
          MemoryRouter,
          null,
          createElement(pages.SalesOrderDetailView, {
            order,
            id: String(order.id),
            role: 'OWNER',
          }),
        ),
      )
    await run({ renderList, renderDetail })
  } finally {
    await server.close()
  }
}

test('the expired banner shows the expiry date, and no date when expiresOn is missing', async () => {
  await withSalesPages(({ renderDetail }) => {
    const withDate = renderDetail(
      order({ status: 'EXPIRED', expiresOn: '2026-11-01' }),
    )
    assert.match(
      withDate,
      /Quá hạn cọc từ 01\/11\/2026\. Đơn không chuyển sang soạn được\./,
    )
    const withoutDate = renderDetail(
      order({ status: 'EXPIRED', expiresOn: null }),
    )
    assert.match(withoutDate, /Quá hạn cọc\. Đơn không chuyển sang soạn được\./)
    assert.doesNotMatch(withoutDate, /undefined|Quá hạn cọc từ/)
  })
})

test('the waiting-stock list shows a deposit badge on rows with an active deposit', async () => {
  await withSalesPages(({ renderList }) => {
    const html = renderList(
      'BRANCH_MANAGER',
      '/sales-orders?tab=AWAITING_STOCK',
      [
        {
          id: 21,
          code: 'SO-21',
          status: 'AWAITING_STOCK',
          storeName: 'Kho',
          customerName: 'Khách',
          createdAt: '2026-11-20',
          total: 1500000,
          assigneeName: null,
          depositStatus: 'ACTIVE',
          depositRemaining: 500000,
          lines: [],
          events: [],
          payments: [],
          actions: {},
        },
      ],
    )
    assert.match(html, /Đã cọc 500\.000 đ/)
  })
})

test('staff opening the waiting-stock tab by URL does not get the waiting filter', async () => {
  await withSalesPages(({ renderList }) => {
    const rows = [
      {
        id: 21,
        code: 'SO-21',
        status: 'AWAITING_STOCK',
        storeName: 'Kho',
        customerName: 'Khách',
        createdAt: '2026-11-20',
        total: 1500000,
        assigneeName: null,
        depositStatus: 'ACTIVE',
        depositRemaining: 500000,
        lines: [],
        events: [],
        payments: [],
        actions: {},
      },
    ]
    const staff = renderList('STAFF', '/sales-orders?tab=AWAITING_STOCK', rows)
    assert.match(staff, /SO-21/)
    assert.doesNotMatch(staff, /Đang giữ cọc/)
    assert.doesNotMatch(staff, /aria-pressed="true"[^>]*>Chờ hàng</)
    assert.doesNotMatch(staff, /Đã cọc/)
    // Đối chứng: cùng URL và cùng dòng với quản lý thì bộ lọc và huy hiệu cọc hiện ra.
    const manager = renderList(
      'BRANCH_MANAGER',
      '/sales-orders?tab=AWAITING_STOCK',
      rows,
    )
    assert.match(manager, /Đang giữ cọc/)
    assert.match(manager, /Đã cọc 500\.000 đ/)
  })
})

test('a deposit refund row is labelled "Trả lại cọc" and cannot be refunded again', async () => {
  await withSalesPages(({ renderDetail }) => {
    const payment = (type) => ({
      id: 7,
      type,
      amount: 200000,
      method: 'CASH',
      status: 'VERIFIED',
      recordedAt: '2026-11-21T10:00:00',
      recordedBy: 'Chủ cửa hàng',
    })
    const refund = renderDetail(
      order(null, { canRefund: true }, { payments: [payment('DEPOSIT_REFUND')] }),
    )
    assert.match(refund, /Trả lại cọc/)
    assert.doesNotMatch(refund, /Hoàn khoản này/)
    assert.doesNotMatch(refund, /Thu tiền/)

    // Đối chứng: khoản cọc đã xác minh vẫn được phép hoàn.
    const deposit = renderDetail(
      order(null, { canRefund: true }, { payments: [payment('DEPOSIT')] }),
    )
    assert.match(deposit, /Tiền cọc/)
    assert.match(deposit, /Hoàn khoản này/)
  })
})
