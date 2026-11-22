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
const {
  salesTotal,
  discountedPrice,
  mayCancel,
  pickedReady,
  suggestedPickingQty,
  splitLine,
  walkInShortLeft,
  walkInShortageText,
  orderLinesWithNowQty,
} = await import(
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

test('picking suggestion is limited by sellable quantity and defaults to requested quantity when stock is unknown', () => {
  assert.equal(suggestedPickingQty(10, 5), 5)
  assert.equal(suggestedPickingQty(10, 0), 0)
  assert.equal(suggestedPickingQty(10, 12), 10)
  assert.equal(suggestedPickingQty(10, null), 10)
})
test('split line: take now defaults to the BE suggestion, never exceeds sellable, and the rest waits', () => {
  // GVHD: bán 10 đèn khi tồn 5 → lấy ngay 5, phần còn lại chờ hàng.
  assert.deepEqual(splitLine({ requested: 10, sellable: 5, suggestedNow: 5 }), {
    takeNow: 5,
    later: 5,
  })
  // Không có gợi ý thì lấy min(cần, còn bán được).
  assert.equal(splitLine({ requested: 3, sellable: 5 }).takeNow, 3)
  // Người bán nhập vượt số còn bán được: chặn ở số còn bán được.
  assert.equal(splitLine({ requested: 10, sellable: 5, nowQty: 8 }).takeNow, 5)
  // Lấy ngay 0: cả dòng chờ hàng.
  assert.deepEqual(splitLine({ requested: 4, sellable: 0, nowQty: 0 }), {
    takeNow: 0,
    later: 4,
  })
  // Chưa biết tồn: lấy đủ.
  assert.equal(splitLine({ requested: 7, sellable: null }).later, 0)
  // Khách lẻ (sellable null, không gợi ý, không nhập lấy ngay): lấy đủ số lượng, không tách.
  assert.deepEqual(splitLine({ requested: 6, sellable: null, suggestedNow: null, nowQty: null }), {
    takeNow: 6,
    later: 0,
  })
})

test('walk-in over-stock: blocked only for a new order, against the preview sellable, and never while unknown', () => {
  const base = { walkIn: true, editing: false, quantity: 3, previewSellable: 2 }
  // Xin 3, preview còn 2: chặn, báo còn 2.
  assert.equal(walkInShortLeft(base), 2)
  // Đủ số: không chặn.
  assert.equal(walkInShortLeft({ ...base, quantity: 2 }), null)
  // Chưa có preview: không chặn (không đoán theo tồn cũ).
  assert.equal(walkInShortLeft({ ...base, previewSellable: undefined }), null)
  assert.equal(walkInShortLeft({ ...base, previewSellable: null }), null)
  // Sửa đơn đã có: BE không kiểm MSG332, không chặn.
  assert.equal(walkInShortLeft({ ...base, editing: true }), null)
  // Khách có hồ sơ: không áp dụng (BE tự tách đơn).
  assert.equal(walkInShortLeft({ ...base, walkIn: false }), null)
  assert.equal(
    walkInShortageText(2),
    'Khách lẻ chỉ mua được số đang có: còn 2. Tạo hồ sơ khách để chờ hàng.',
  )
})

test('order lines sent to the BE carry nowQty and never waitForRest', () => {
  const body = orderLinesWithNowQty(
    [
      { productId: 1, quantity: 5 },
      { productId: 2, quantity: 3 },
    ],
    new Map([[1, 2]]),
  )
  assert.deepEqual(body, [
    { productId: 1, quantity: 5, nowQty: 2 },
    { productId: 2, quantity: 3, nowQty: 3 },
  ])
  for (const line of body) assert.equal('waitForRest' in line, false)
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
    assert.doesNotMatch(html, /aria-label="Tên khách lẻ"/)
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
    // SKU, kệ và lô gợi ý nằm trong cửa sổ chi tiết (mở khi bấm tên phụ tùng), không hiện trên dòng.
    assert.match(picking, /product-quick-view-trigger/)
    assert.doesNotMatch(picking, /Lô hạn sớm nhất/)
    assert.doesNotMatch(picking, /555\.555|987\.654|123\.456|Giá bán/)
  } finally {
    await server.close()
  }
})

test('sales order detail links to print the sales slip and payment receipts for managers only', async () => {
  const server = await createServer({
    configFile: false,
    server: { middlewareMode: true, hmr: false, watch: null },
    appType: 'custom',
  })
  try {
    const { SalesOrderDetailView } = await server.ssrLoadModule(
      '/src/modules/sales/SalesPages.tsx',
    )
    const payment = (id, type, status) => ({
      id,
      type,
      method: 'CASH',
      amount: 100000,
      status,
      recordedAt: '2026-11-20T10:00:00',
      recordedBy: 'Thu ngân',
    })
    const order = (status, payments) => ({
      id: 8,
      code: 'SO-8',
      version: 1,
      storeName: 'Kho',
      customerName: 'Khách',
      priceType: 'RETAIL',
      discount: 0,
      status,
      createdAt: '2026-11-08',
      actions: {
        canRecordPayment: false,
        canRecordCredit: false,
        canCancel: false,
        canRefund: true,
      },
      netPaid: 0,
      credit: 0,
      lines: [],
      payments,
      versions: [],
      events: [],
    })
    const render = (Component, props) =>
      renderToStaticMarkup(
        createElement(MemoryRouter, null, createElement(Component, props)),
      )
    const payments = [
      payment(31, 'DEPOSIT', 'VERIFIED'),
      payment(32, 'ORDER_PAYMENT', 'UNVERIFIED'),
      payment(33, 'ORDER_PAYMENT', 'VERIFIED'),
    ]
    const completed = order('COMPLETED', payments)
    const bm = render(SalesOrderDetailView, {
      order: completed,
      role: 'BRANCH_MANAGER',
    })
    assert.match(
      bm,
      /href="\/documents\/SALES_ORDER\/8\/print\?form=SALES_INVOICE"[^>]*>In phiếu bán hàng</,
    )
    assert.match(bm, /href="\/documents\/PAYMENT\/31\/print"[^>]*>In phiếu cọc</)
    assert.match(bm, /Tiền cọc/)
    assert.match(bm, /href="\/documents\/PAYMENT\/33\/print"[^>]*>In phiếu</)
    assert.doesNotMatch(bm, /documents\/PAYMENT\/32\/print/)
    const owner = render(SalesOrderDetailView, {
      order: completed,
      role: 'OWNER',
    })
    assert.match(owner, /In phiếu bán hàng/)
    assert.match(owner, /In phiếu cọc/)

    const confirmed = render(SalesOrderDetailView, {
      order: order('CONFIRMED', payments),
      role: 'BRANCH_MANAGER',
    })
    assert.doesNotMatch(confirmed, /SALES_INVOICE/)
    assert.match(confirmed, /documents\/PAYMENT\/31\/print/)

    const staff = render(SalesOrderDetailView, {
      order: completed,
      role: 'STAFF',
    })
    assert.doesNotMatch(staff, /\/documents\//)
    assert.doesNotMatch(staff, /In phiếu/)
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

test('the waiting-stock tab and deposit filter appear for managers only', async () => {
  const server = await createServer({
    configFile: false,
    server: { middlewareMode: true, hmr: false, watch: null },
    appType: 'custom',
  })
  try {
    const { SalesOrderListPage } = await server.ssrLoadModule(
      '/src/modules/sales/SalesPages.tsx',
    )
    const { AuthContext } = await server.ssrLoadModule(
      '/src/shared/hooks/useAuth.tsx',
    )
    const render = (role, url) =>
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
            createElement(SalesOrderListPage),
          ),
        ),
      )
    const manager = render('BRANCH_MANAGER', '/sales-orders')
    assert.match(manager, /Chờ hàng/)
    assert.doesNotMatch(render('STAFF', '/sales-orders'), /Chờ hàng/)
    const waiting = render('BRANCH_MANAGER', '/sales-orders?tab=AWAITING_STOCK')
    assert.match(waiting, /aria-pressed="true"[^>]*>Chờ hàng</)
    assert.match(waiting, /Đang giữ cọc/)
    assert.match(waiting, /Quá hạn cọc/)
    assert.doesNotMatch(manager, /Đang giữ cọc/)
  } finally {
    await server.close()
  }
})
