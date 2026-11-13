import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { createServer } from 'vite'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
const { outputText } = ts.transpileModule(
  readFileSync(
    new URL('../src/modules/sales/salesModel.ts', import.meta.url),
    'utf8',
  ),
  {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  },
)
const { salesTotal, discountedPrice, mayCancel, pickedReady } = await import(
  'data:text/javascript;base64,' + Buffer.from(outputText).toString('base64')
)
test('sales pricing rounds each discounted unit before multiplying quantity', () => {
  assert.equal(discountedPrice(101, 50), 51)
  assert.equal(salesTotal([{ quantity: 3, price: 101 }], 50), 153)
  assert.equal(salesTotal([{ quantity: 2, price: 0 }], 0), 0)
  for (const discount of [-1, 100, NaN, Infinity])
    assert.equal(salesTotal([{ quantity: 1, price: 100 }], discount), null)
  assert.equal(salesTotal([{ quantity: 1, price: null }], 0), null)
  assert.equal(salesTotal([{ quantity: 1.5, price: 100 }], 0), null)
  assert.equal(
    salesTotal([{ quantity: 2147483647, price: Number.MAX_SAFE_INTEGER }], 0),
    null,
  )
})
test('cancellation requires zero net receipts and an unfinished order', () => {
  assert.equal(mayCancel({ status: 'CONFIRMED', netPaid: 0 }), true)
  for (const status of ['COMPLETED', 'CANCELLED'])
    assert.equal(mayCancel({ status, netPaid: 0 }), false)
  assert.equal(mayCancel({ status: 'CONFIRMED', netPaid: 1 }), false)
})
test('picking requires a quantity for every line and explicit shortage marks', () => {
  assert.equal(pickedReady([]), false)
  for (const picked of [null, -1, 1.5, 11])
    assert.equal(pickedReady([{ requested: 10, picked, short: true }]), false)
  assert.equal(pickedReady([{ requested: 10, picked: 0, short: true }]), true)
  assert.equal(pickedReady([{ requested: 10, picked: 9 }]), false)
  assert.equal(pickedReady([{ requested: 10, picked: 10 }]), true)
})
test('the sales form shows chain prices before a warehouse is selected', async () => {
  const server = await createServer({
    configFile: false,
    server: { middlewareMode: true, hmr: false, watch: null },
    appType: 'custom',
  })
  try {
    const { SalesOrderFormView } = await server.ssrLoadModule(
      '/src/modules/sales/SalesPages.tsx',
    )
    const { AuthContext } = await server.ssrLoadModule(
      '/src/shared/hooks/useAuth.tsx',
    )
    const product = {
      id: 7,
      sku: 'BUG-TEST',
      partName: 'Bugi',
      retailPrice: 45000,
      status: 'ACTIVE',
    }
    const html = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        { initialEntries: ['/sales-orders/new?productId=7'] },
        createElement(
          AuthContext.Provider,
          { value: { user: { id: 1, role: 'OWNER' } } },
          createElement(SalesOrderFormView, {
            initialProduct: product,
            initialQuantity: 2,
          }),
        ),
      ),
    )
    assert.match(html, /45\.000/)
    assert.match(
      html,
      /role="combobox"[^>]*aria-label="Tìm phụ tùng để thêm vào đơn"/,
    )
    assert.match(html, /pos-line-total">90\.000/)
    assert.match(html, /Khách cần trả<\/dt><dd>90\.000/)
    assert.doesNotMatch(html, /pos-discount-row|Chiết khấu cho cả đơn/)
    assert.match(html, /<button[^>]*type="submit"[^>]*disabled=""[^>]*>Tạo đơn/)
    assert.match(html, />Lưu nháp<\/button>/)
    assert.doesNotMatch(html, /trên máy này|Xóa nháp/)
  } finally {
    await server.close()
  }
})
test('a server draft reopens in the sales form with save, submit and delete', async () => {
  const server = await createServer({
    configFile: false,
    server: { middlewareMode: true, hmr: false, watch: null },
    appType: 'custom',
  })
  try {
    const { SalesOrderFormView } = await server.ssrLoadModule(
      '/src/modules/sales/SalesPages.tsx',
    )
    const { AuthContext } = await server.ssrLoadModule(
      '/src/shared/hooks/useAuth.tsx',
    )
    const draft = {
      id: 5,
      code: 'SO-5',
      version: 1,
      status: 'DRAFT',
      storeId: 2,
      storeName: 'Cửa hàng 2',
      customerId: null,
      customerName: 'Anh Nam',
      customerPhone: '0900000000',
      note: 'Khách hẹn chiều lấy',
      priceType: 'RETAIL',
      discount: 0,
      createdAt: '2026-11-13T09:00:00',
      assigneeName: null,
      netPaid: 0,
      credit: 0,
      versions: [],
      events: [],
      lines: [
        {
          productId: 7,
          sku: 'BUG-TEST',
          partName: 'Bugi',
          baseUnit: 'cái',
          requested: 3,
          picked: null,
          delivered: null,
          retailPrice: 45000,
        },
      ],
    }
    const html = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        { initialEntries: ['/sales-drafts/5'] },
        createElement(
          AuthContext.Provider,
          { value: { user: { id: 1, role: 'BRANCH_MANAGER', storeId: 2 } } },
          createElement(SalesOrderFormView, { order: draft }),
        ),
      ),
    )
    assert.match(html, /Đơn nháp SO-5/)
    assert.match(html, /Khách hẹn chiều lấy/)
    assert.match(html, /value="Anh Nam"/)
    assert.match(html, />Tạo đơn<\/button>/)
    assert.match(html, />Lưu nháp<\/button>/)
    assert.match(html, />Xóa nháp<\/button>/)
    assert.match(html, />Quay lại danh sách nháp<\/button>/)
    assert.doesNotMatch(html, /Lưu phiên bản mới|Xem chi tiết đơn/)
  } finally {
    await server.close()
  }
})
test('Staff order and picking views omit financial data and manager actions', async () => {
  const server = await createServer({
    configFile: false,
    server: { middlewareMode: true, hmr: false, watch: null },
    appType: 'custom',
  })
  try {
    const { SalesOrderDetailView, RecordPickedView } =
      await server.ssrLoadModule('/src/modules/sales/SalesPages.tsx')
    const order = {
      id: 8,
      code: 'SO-8',
      version: 1,
      storeName: 'Kho',
      customerName: 'Khách',
      priceType: 'WHOLESALE',
      discount: 3,
      status: 'CONFIRMED',
      createdAt: '2026-11-08',
      assigneeName: 'Staff',
      actions: {
        canRecordPayment: true,
        canRecordCredit: true,
        canCancel: false,
      },
      netPaid: 987654,
      credit: 123456,
      lines: [
        {
          productId: 1,
          sku: 'A',
          partName: 'Phụ tùng',
          baseUnit: 'cái',
          requested: 3,
          picked: 2,
          delivered: 2,
          retailPrice: 555555,
          binLocation: 'A-1',
          lotHint: 'Lô hạn sớm nhất',
        },
      ],
      versions: [],
      events: [],
    }
    const render = (Component, props) =>
      renderToStaticMarkup(
        createElement(MemoryRouter, null, createElement(Component, props)),
      )
    const staff = render(SalesOrderDetailView, { order, role: 'STAFF' })
    assert.doesNotMatch(
      staff,
      /555\.555|987\.654|123\.456|Bán chịu|Ghi nhận thanh toán|Giá bán/,
    )
    const bm = render(SalesOrderDetailView, { order, role: 'BRANCH_MANAGER' })
    assert.match(bm, /Ghi nhận thanh toán/)
    assert.match(bm, /Ghi nhận bán chịu/)
    assert.doesNotMatch(bm, />Hủy đơn</)
    const picking = render(RecordPickedView, {
      order: { ...order, status: 'AWAITING_PICKING' },
    })
    assert.match(picking, /Lô hạn sớm nhất/)
    assert.doesNotMatch(picking, /555\.555|987\.654|123\.456|Giá bán/)
  } finally {
    await server.close()
  }
})

test('cash records only the payable amount, supports partial payments and returns excess', async () => {
  const { cashCollection } = await import(
    'data:text/javascript;base64,' + Buffer.from(outputText).toString('base64')
  )
  assert.deepEqual(cashCollection('200000', 140000), {
    amount: 140000,
    tenderedAmount: 200000,
    changeGiven: 60000,
  })
  assert.deepEqual(cashCollection('50000', 140000), {
    amount: 50000,
    tenderedAmount: 50000,
    changeGiven: 0,
  })
  for (const value of ['', '0', '-1', '1.5', 'abc', '100000000001'])
    assert.equal(cashCollection(value, 140000), null)
  assert.equal(cashCollection('100', 0), null)
})

test('sales list renders the BE total without inferring zero unpaid balance from absent lines', async () => {
  const server = await createServer({
    configFile: false,
    server: { middlewareMode: true, hmr: false, watch: null },
    appType: 'custom',
  })
  try {
    const { SalesListTotal } = await server.ssrLoadModule(
      '/src/modules/sales/SalesPages.tsx',
    )
    const html = renderToStaticMarkup(
      createElement(SalesListTotal, { total: 420000 }),
    )
    assert.match(html, /420.000/)
    assert.doesNotMatch(html, /Xem thanh toán/)
    const missing = renderToStaticMarkup(
      createElement(SalesListTotal, { total: null }),
    )
    assert.match(missing, /Chưa có dữ liệu/)
    assert.doesNotMatch(missing, />0/)
  } finally {
    await server.close()
  }
})
