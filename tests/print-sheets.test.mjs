import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'

const store = {
  name: 'Chi nhánh Quận 1',
  address: '1 Lê Lợi, Quận 1',
  phone: '0900000000',
  taxCode: null,
}

const retailSmall = {
  documentType: 'SALES_ORDER',
  form: 'SALES_INVOICE',
  id: 1,
  number: 'DH-0001',
  status: 'COMPLETED',
  documentDate: '2026-11-20T10:30:00',
  printedAt: '2026-11-20T10:31:00',
  printedBy: 'Nguyễn Văn A',
  store,
  counterpart: null,
  lines: [
    {
      no: 1,
      productId: 1,
      sku: 'BUG-1',
      partName: 'Bugi NGK',
      baseUnit: 'cái',
      lotId: null,
      manufacturerLotNo: null,
      quantity: 2,
      unitPrice: 450000,
      amount: 900000,
    },
    {
      no: 2,
      productId: 2,
      sku: 'OIL-1',
      partName: 'Dầu nhớt',
      baseUnit: 'chai',
      lotId: null,
      manufacturerLotNo: null,
      quantity: 3,
      unitPrice: 300000,
      amount: 900000,
    },
  ],
  totals: {
    referenceTotal: 1800000,
    discountAmount: 0,
    discountRate: 0,
    total: 1800000,
    paid: 1800000,
    credit: 0,
    deposit: null,
    amountDue: 1800000,
  },
  payment: null,
  note: 'PAID',
  title: 'Phiếu bán hàng',
  layout: 'SMALL',
}

const wholesaleLarge = {
  ...retailSmall,
  number: 'DH-0002',
  store: { ...store, name: 'Công ty ABC', taxCode: '0101234567' },
  counterpart: {
    name: 'Nguyễn Thị B',
    address: '2 Trần Hưng Đạo',
    phone: null,
    taxCode: '0109876543',
  },
  lines: [
    {
      no: 1,
      productId: 1,
      sku: 'BUG-1',
      partName: 'Bugi NGK',
      baseUnit: 'cái',
      lotId: null,
      manufacturerLotNo: null,
      quantity: 20,
      unitPrice: 95000,
      amount: 1900000,
    },
  ],
  totals: {
    referenceTotal: 2000000,
    discountAmount: 100000,
    discountRate: 5,
    total: 1900000,
    paid: 0,
    credit: 1800000,
    deposit: 100000,
    amountDue: 1800000,
  },
  note: 'CREDIT',
  layout: 'LARGE',
}

const depositReceipt = {
  documentType: 'PAYMENT',
  form: 'PAYMENT_RECEIPT',
  id: 9,
  number: 'PT-0009',
  status: 'CONFIRMED',
  documentDate: '2026-11-22T09:00:00',
  printedAt: '2026-11-22T09:01:00',
  printedBy: 'Trần C',
  store,
  counterpart: { name: 'Lê D', address: null, phone: null, taxCode: null },
  lines: [],
  totals: null,
  payment: {
    paymentType: 'DEPOSIT',
    paymentMethod: 'CASH',
    amount: 500000,
    tenderedAmount: null,
    changeGiven: null,
    transactionReference: null,
    allocations: [],
    depositExpiresOn: '2026-11-30',
  },
  note: null,
  title: 'Phiếu thu tiền cọc',
  layout: null,
}

let server

before(async () => {
  server = await createServer({
    configFile: false,
    server: { middlewareMode: true, hmr: false, watch: null },
    appType: 'custom',
  })
})

after(async () => {
  await server?.close()
})

async function render(file, props) {
  const { default: Sheet } = await server.ssrLoadModule(file)
  return renderToStaticMarkup(createElement(Sheet, props))
}

test('retail slip shows only the store name, totals and no logo', async () => {
  const html = await render(
    '/src/modules/documents/print/PrintSheetSmall.tsx',
    { data: retailSmall },
  )
  assert.match(html, /Chi nhánh Quận 1/)
  assert.doesNotMatch(html, /<img/)
  assert.doesNotMatch(html, /MotoFlow/)
  assert.match(html, /Khách cần thanh toán/)
  assert.doesNotMatch(html, /Khách đưa/)
  assert.doesNotMatch(html, /Chiết khấu|Đã cọc/)
})

test('retail slip prints total minus deposit as the amount due when nothing is paid yet', async () => {
  const unpaid = {
    ...retailSmall,
    totals: {
      ...retailSmall.totals,
      total: 950000,
      discountAmount: 50000,
      deposit: 300000,
      paid: 0,
      amountDue: 700000,
    },
  }
  const html = await render(
    '/src/modules/documents/print/PrintSheetSmall.tsx',
    { data: unpaid },
  )
  assert.match(html, /Chiết khấu/)
  assert.match(html, /Đã cọc/)
  assert.match(html, /Khách cần thanh toán<\/span><span>650\.000(?!\d)/)
})

test('retail slip prints total minus deposit as the amount due when the backend sends amountDue 0', async () => {
  const paid = {
    ...retailSmall,
    totals: {
      ...retailSmall.totals,
      total: 950000,
      discountAmount: 50000,
      deposit: 300000,
      paid: 650000,
      amountDue: 0,
    },
  }
  const html = await render(
    '/src/modules/documents/print/PrintSheetSmall.tsx',
    { data: paid },
  )
  assert.match(html, /Chiết khấu/)
  assert.match(html, /Đã cọc/)
  assert.match(html, /Khách cần thanh toán<\/span><span>650\.000(?!\d)/)
})

test('wholesale A5 sheet shows both tax codes, amount in words and signatures', async () => {
  const html = await render(
    '/src/modules/documents/print/PrintSheetLarge.tsx',
    { data: wholesaleLarge },
  )
  assert.match(html, /0101234567/)
  assert.match(html, /0109876543/)
  assert.match(html, /Một triệu tám trăm nghìn đồng chẵn/)
  assert.match(html, /Người mua hàng/)
  assert.match(html, /Người bán hàng/)
  assert.match(html, /Tên đơn vị/)
  for (const header of [
    'STT',
    'Tên hàng',
    'ĐVT',
    'SL',
    'Đơn giá',
    'Thành tiền',
  ])
    assert.match(html, new RegExp(`<th[^>]*>${header}</th>`))
  assert.match(html, /Ghi nợ/)
  assert.match(html, /\(5%\)/)
})

test('wholesale A5 sheet shows total minus deposit even when amountDue is 0', async () => {
  const paid = {
    ...wholesaleLarge,
    totals: {
      ...wholesaleLarge.totals,
      total: 1900000,
      deposit: 100000,
      paid: 500000,
      credit: 0,
      amountDue: 1300000,
    },
  }
  const html = await render(
    '/src/modules/documents/print/PrintSheetLarge.tsx',
    { data: paid },
  )
  assert.match(html, /Còn phải trả<\/span><span>1\.800\.000(?!\d)/)
  assert.match(html, /Số tiền bằng chữ: Một triệu tám trăm nghìn đồng chẵn/)
})

test('deposit receipt renders its title, type and expiry date', async () => {
  const html = await render(
    '/src/modules/documents/print/PrintSheetStandard.tsx',
    { data: depositReceipt },
  )
  assert.match(html, /Phiếu thu tiền cọc/)
  assert.match(html, /Thu tiền cọc/)
  assert.match(html, /30\/11\/2026/)
})

test('deposit receipt has no signature boxes, other payment receipts keep them', async () => {
  const file = '/src/modules/documents/print/PrintSheetStandard.tsx'
  const deposit = await render(file, { data: depositReceipt })
  assert.doesNotMatch(deposit, /docs-signatures/)
  const orderPayment = await render(file, {
    data: {
      ...depositReceipt,
      title: 'Phiếu thu',
      payment: { ...depositReceipt.payment, paymentType: 'ORDER_PAYMENT' },
    },
  })
  assert.match(orderPayment, /docs-signatures/)
  assert.match(orderPayment, /Người lập/)
})
