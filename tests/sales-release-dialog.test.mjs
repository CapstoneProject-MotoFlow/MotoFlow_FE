import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'

// FormDialog dùng createPortal lên document.body, nhưng server renderer không hỗ trợ portal.
// Test này thay 'react-dom' bằng helper trả về nội dung tại chỗ, chỉ trong server SSR của test này.
const noPortal = fileURLToPath(
  new URL('./helpers/react-dom-no-portal.mjs', import.meta.url),
)

function line(overrides = {}) {
  return {
    lineId: 1,
    productId: 11,
    sku: 'SKU-1',
    partName: 'Bugi',
    baseUnit: 'cái',
    requested: 1,
    sellableQty: 1,
    heldByOthersQty: null,
    picked: null,
    delivered: null,
    retailPrice: 1_200_000,
    actualUnitPrice: null,
    ...overrides,
  }
}

function deposit(overrides = {}) {
  return {
    total: 5_000_000,
    unverified: 0,
    applied: 0,
    refunded: 0,
    remaining: 5_000_000,
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

function order({ lines, depositOverrides, hasDeposit = true, discount = 0 }) {
  return {
    id: 21,
    code: 'SO-21',
    version: 3,
    status: 'AWAITING_STOCK',
    storeName: 'Kho',
    customerName: 'Khách',
    customerId: 4,
    priceType: 'RETAIL',
    discount,
    createdAt: '2026-11-20',
    assigneeName: null,
    netPaid: 0,
    credit: 0,
    depositApplied: 0,
    deposit: hasDeposit ? deposit(depositOverrides) : null,
    actions: { canRelease: true },
    lines,
    versions: [],
    events: [],
    payments: [],
  }
}

async function withDialog(run) {
  const server = await createServer({
    configFile: false,
    resolve: { alias: [{ find: /^react-dom$/, replacement: noPortal }] },
    server: { middlewareMode: true, hmr: false, watch: null },
    appType: 'custom',
  })
  try {
    const { default: SalesPendingReleaseDialog } = await server.ssrLoadModule(
      '/src/modules/sales/SalesPendingReleaseDialog.tsx',
    )
    // FormDialog đọc document.body khi render; SSR chỉ cần một đối tượng giữ chỗ.
    globalThis.document = { body: {} }
    const render = (props) =>
      renderToStaticMarkup(
        createElement(SalesPendingReleaseDialog, {
          onClose: () => {},
          onSaved: () => {},
          ...props,
        }),
      )
    await run(render)
  } finally {
    delete globalThis.document
    await server.close()
  }
}

test('partial release with a deposit suggests the estimated deposit amount', async () => {
  await withDialog((render) => {
    // Khách đặt 2, còn bán được 1: mặc định lấy ngay 1 → chưa phải lần cuối.
    const html = render({
      order: order({
        lines: [line({ requested: 2, sellableQty: 1, retailPrice: 1_200_000 })],
        depositOverrides: { remaining: 3_000_000 },
      }),
    })
    assert.match(html, /Trừ cọc vào đơn này/)
    assert.match(html, /value="1\.200\.000"/)
    assert.match(html, /Cọc còn giữ: 3\.000\.000/)
    assert.doesNotMatch(html, /Đã trả tiền cho khách/)
  })
})

test('last release with more deposit than the total shows the refund and its confirmation', async () => {
  await withDialog((render) => {
    const html = render({
      order: order({
        lines: [line({ requested: 1, sellableQty: 1, retailPrice: 4_000_000 })],
        depositOverrides: { remaining: 5_000_000 },
      }),
    })
    assert.match(html, /Trừ hết cọc vào đơn này/)
    assert.match(html, /Hoàn lại khách/)
    assert.match(html, /1\.000\.000/)
    assert.match(html, /Đã trả tiền cho khách/)
    assert.doesNotMatch(html, /Trừ cọc vào đơn này/)
  })
})

test('last release with unverified deposit shows the unverified block', async () => {
  await withDialog((render) => {
    const html = render({
      order: order({
        lines: [line({ requested: 1, sellableQty: 1, retailPrice: 2_500_000 })],
        depositOverrides: { remaining: 2_000_000, unverified: 500_000 },
      }),
    })
    assert.match(html, /Còn 500\.000/)
    assert.match(html, /chưa xác minh/)
    assert.match(html, /Xác minh hết trước khi chuyển lần cuối/)
  })
})

test('an order without a deposit shows no deposit section', async () => {
  await withDialog((render) => {
    const html = render({
      order: order({
        lines: [line({ requested: 2, sellableQty: 1 })],
        hasDeposit: false,
      }),
    })
    assert.doesNotMatch(html, /Cọc còn giữ/)
    assert.doesNotMatch(html, /Trừ cọc vào đơn này/)
    assert.doesNotMatch(html, /Tiền cọc khi chuyển đơn/)
  })
})

test('a line that requests 5 with only 2 sellable starts clamped to 2 and is not short', async () => {
  await withDialog((render) => {
    const html = render({
      order: order({
        lines: [line({ requested: 5, sellableQty: 2 })],
        hasDeposit: false,
      }),
    })
    assert.match(html, /Khách đặt \/ Còn bán được/)
    // Ô "Lấy ngay" phải hiện đúng số đã kẹp (2), không chỉ là không có cảnh báo.
    const nowInput = html.match(/<input[^>]*aria-label="Lấy ngay SKU-1"[^>]*>/)
    assert.ok(nowInput, 'ô Lấy ngay phải được render')
    assert.match(nowInput[0], /value="2"/)
    assert.doesNotMatch(html, /is-short/)
    assert.doesNotMatch(html, /Thiếu/)
    assert.doesNotMatch(html, /vượt số còn bán được/)
  })
})

test('an expired deposit blocks the release with the expiry message', async () => {
  await withDialog((render) => {
    const html = render({
      order: order({
        lines: [line({ requested: 1, sellableQty: 1, retailPrice: 1_000_000 })],
        depositOverrides: { status: 'EXPIRED', remaining: 1_000_000 },
      }),
    })
    assert.match(html, /Cọc đã quá hạn, đơn không chuyển sang soạn được\./)
  })
})

test('a last release with an estimated refund labels the estimate', async () => {
  await withDialog((render) => {
    const html = render({
      order: order({
        lines: [line({ requested: 1, sellableQty: 1, retailPrice: 4_000_000 })],
        depositOverrides: { remaining: 5_000_000 },
      }),
    })
    assert.match(html, /\(ước tính\)/)
  })
})
