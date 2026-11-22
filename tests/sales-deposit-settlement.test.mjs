import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import { MemoryRouter } from 'react-router-dom'
import { fileURLToPath } from 'node:url'

// FormDialog dùng createPortal lên document.body; server renderer không hỗ trợ portal,
// nên test này thay 'react-dom' bằng helper trả về nội dung tại chỗ (chỉ trong server SSR của test này).
const noPortal = fileURLToPath(
  new URL('./helpers/react-dom-no-portal.mjs', import.meta.url),
)

function order(overrides = {}) {
  return {
    id: 31,
    code: 'SO-31',
    version: 1,
    status: 'AWAITING_STOCK',
    storeName: 'Kho',
    customerName: 'Khách',
    customerId: 4,
    priceType: 'RETAIL',
    discount: 0,
    createdAt: '2026-11-20',
    assigneeName: null,
    total: 10000000,
    netPaid: 0,
    credit: 0,
    depositApplied: 0,
    remainingPayable: 10000000,
    payableNow: 10000000,
    refundable: 0,
    deposit: null,
    actions: {
      canUpdate: false,
      canAssignPicker: false,
      canRecordPicking: false,
      canConfirm: true,
      canRecordPayment: true,
      canRefund: false,
      canRecordCredit: true,
      canComplete: false,
      canCancel: false,
    },
    lines: [],
    versions: [],
    events: [],
    payments: [],
    ...overrides,
  }
}

// Đơn 10tr đã cọc 3tr khi nhả đơn chờ: netCollected (netPaid) gồm cọc, còn phải thu 7tr.
const withDeposit = () =>
  order({
    netPaid: 3000000,
    depositApplied: 3000000,
    remainingPayable: 7000000,
    payableNow: 7000000,
  })

// Lấy <dt>…</dt><dd>…</dd> của một hàng trong bảng tổng.
function row(html, label) {
  const marker = `<dt>${label}</dt><dd>`
  const start = html.indexOf(marker)
  if (start < 0) return null
  const from = start + marker.length
  const value = html.slice(from, html.indexOf('</dd>', from))
  // Node in số tiền vi-VN dùng khoảng trắng không ngắt (U+00A0) trước ký hiệu ₫.
  return value.replace(/\u00a0/g, ' ')
}

async function withServer(run) {
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
    const pages = await server.ssrLoadModule('/src/modules/sales/SalesPages.tsx')
    const renderDialog = (props) => {
      globalThis.document = { body: {} }
      try {
        return renderToStaticMarkup(
          createElement(SalesSettlementDialog, { onClose: () => {}, ...props }),
        )
      } finally {
        delete globalThis.document
      }
    }
    const renderDetail = (o) =>
      renderToStaticMarkup(
        createElement(
          MemoryRouter,
          null,
          createElement(pages.SalesOrderDetailView, {
            order: o,
            id: String(o.id),
            role: 'OWNER',
          }),
        ),
      )
    await run({ renderDialog, renderDetail })
  } finally {
    await server.close()
  }
}

test('settlement payment mode with deposit shows Đã cọc, Đã thu net of deposit, and asks for 7tr', async () => {
  await withServer(({ renderDialog }) => {
    const html = renderDialog({ action: 'payment', order: withDeposit() })
    assert.equal(row(html, 'Đã cọc'), '3.000.000 ₫')
    assert.equal(row(html, 'Đã thu'), '0 ₫')
    assert.equal(row(html, 'Còn phải trả'), '7.000.000 ₫')
    assert.doesNotMatch(html, /Còn phải thu/)
    // Góp ý review 1: cả tiền mặt và chuyển khoản bắt đầu trống, người bán tự gõ.
    assert.match(html, /aria-label="Số tiền mặt thu"[^>]*value=""/)
    assert.match(html, /<legend>Chuyển khoản<\/legend>/)
    assert.match(html, /Tổng thu: <strong>0\s₫<\/strong>/)
  })
})

test('settlement payment mode without deposit keeps the old labels', async () => {
  await withServer(({ renderDialog }) => {
    const html = renderDialog({
      action: 'payment',
      order: order({ netPaid: 2000000, remainingPayable: 8000000, payableNow: 8000000 }),
    })
    assert.doesNotMatch(html, /Đã cọc/)
    assert.equal(row(html, 'Đã thu'), '2.000.000 ₫')
    assert.equal(row(html, 'Còn phải thu'), '8.000.000 ₫')
    assert.doesNotMatch(html, /Còn phải trả/)
  })
})

test('settlement confirm mode shows Đã cọc separately and Đã thu trước without it', async () => {
  await withServer(({ renderDialog }) => {
    const html = renderDialog({
      action: 'confirm',
      order: withDeposit(),
    })
    assert.equal(row(html, 'Đã cọc'), '3.000.000 ₫')
    assert.equal(row(html, 'Đã thu trước'), '0 ₫')
  })
})

test('detail totals with deposit show Đã cọc, Đã thu 0 and Còn phải trả 7tr', async () => {
  await withServer(({ renderDetail }) => {
    const html = renderDetail(withDeposit())
    assert.equal(row(html, 'Đã cọc'), '3.000.000 ₫')
    assert.equal(row(html, 'Đã thu'), '0 ₫')
    assert.equal(row(html, 'Còn phải trả'), '7.000.000 ₫')
    assert.doesNotMatch(html, /Còn phải thu/)
  })
})

test('detail totals without deposit keep the old labels and no Đã cọc', async () => {
  await withServer(({ renderDetail }) => {
    const html = renderDetail(
      order({ netPaid: 4000000, remainingPayable: 6000000, payableNow: 6000000 }),
    )
    assert.doesNotMatch(html, /Đã cọc/)
    assert.doesNotMatch(html, /Còn phải trả/)
    assert.equal(row(html, 'Đã thu'), '4.000.000 ₫')
    assert.equal(row(html, 'Còn phải thu'), '6.000.000 ₫')
  })
})
