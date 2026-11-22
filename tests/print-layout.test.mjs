import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
const { outputText } = ts.transpileModule(
  readFileSync(
    new URL('../src/modules/documents/print/printLayout.ts', import.meta.url),
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
  printLayouts,
  pageCss,
  parseLayout,
  paymentTitle,
  printParams,
  amountAfterDeposit,
} = await import(
  'data:text/javascript;base64,' + Buffer.from(outputText).toString('base64')
)

test('exposes Vietnamese labels for each layout', () => {
  assert.deepEqual(printLayouts, {
    SMALL: 'Phiếu nhỏ (80mm)',
    LARGE: 'Phiếu A5',
  })
})

test('builds print page css for each layout', () => {
  assert.equal(
    pageCss('SMALL'),
    '@media print { @page { size: 80mm 297mm; margin: 3mm } }',
  )
  assert.equal(
    pageCss('LARGE'),
    '@media print { @page { size: A5; margin: 8mm } }',
  )
  assert.equal(pageCss(null), '')
})

test('sizes the 80 mm page to the measured height plus margins', () => {
  assert.equal(
    pageCss('SMALL', 120.4),
    '@media print { @page { size: 80mm 127mm; margin: 3mm } }',
  )
  assert.equal(
    pageCss('SMALL', 0),
    '@media print { @page { size: 80mm 297mm; margin: 3mm } }',
  )
  assert.equal(
    pageCss('SMALL', NaN),
    '@media print { @page { size: 80mm 297mm; margin: 3mm } }',
  )
  assert.equal(
    pageCss('SMALL', -5),
    '@media print { @page { size: 80mm 297mm; margin: 3mm } }',
  )
  assert.equal(
    pageCss('LARGE', 120),
    '@media print { @page { size: A5; margin: 8mm } }',
  )
})

test('sends a layout only for the sales invoice form', () => {
  assert.deepEqual(printParams('SALES_INVOICE', null), {
    form: 'SALES_INVOICE',
    layout: undefined,
  })
  assert.deepEqual(printParams('SALES_INVOICE', 'SMALL'), {
    form: 'SALES_INVOICE',
    layout: 'SMALL',
  })
  assert.deepEqual(printParams('PAYMENT_RECEIPT', 'LARGE'), {
    form: 'PAYMENT_RECEIPT',
    layout: undefined,
  })
  assert.deepEqual(printParams(undefined, 'LARGE'), {
    form: undefined,
    layout: undefined,
  })
})

test('shows the order amount after the deposit, not the unpaid balance', () => {
  assert.equal(amountAfterDeposit({ total: 950000, deposit: 300000 }), 650000)
  assert.equal(amountAfterDeposit({ total: 500000, deposit: null }), 500000)
  assert.equal(amountAfterDeposit({ total: null, deposit: 300000 }), 0)
  assert.equal(amountAfterDeposit({ total: 200000, deposit: 300000 }), 0)
  assert.equal(amountAfterDeposit(null), 0)
})

test('parses only known layouts', () => {
  assert.equal(parseLayout('SMALL'), 'SMALL')
  assert.equal(parseLayout('LARGE'), 'LARGE')
  assert.equal(parseLayout('small'), null)
  assert.equal(parseLayout(''), null)
  assert.equal(parseLayout(null), null)
})

test('prefers a non-empty backend title', () => {
  assert.equal(
    paymentTitle({ paymentType: 'REFUND' }, 'Fallback', 'Phiếu tùy chỉnh'),
    'Phiếu tùy chỉnh',
  )
  assert.equal(
    paymentTitle(null, 'Fallback', 'Phiếu tùy chỉnh'),
    'Phiếu tùy chỉnh',
  )
})

test('derives the title from the payment type when no title is sent', () => {
  assert.equal(paymentTitle({ paymentType: 'REFUND' }, 'Fallback'), 'Phiếu chi')
  assert.equal(
    paymentTitle({ paymentType: 'DEPOSIT_REFUND' }, 'Fallback', ''),
    'Phiếu chi',
  )
  assert.equal(
    paymentTitle({ paymentType: 'DEPOSIT' }, 'Fallback', null),
    'Phiếu thu tiền cọc',
  )
  assert.equal(
    paymentTitle({ paymentType: 'ORDER_PAYMENT' }, 'Fallback'),
    'Phiếu thu',
  )
  assert.equal(
    paymentTitle({ paymentType: 'DEBT_PAYMENT' }, 'Fallback'),
    'Phiếu thu',
  )
})

test('falls back when there is no payment and no title', () => {
  assert.equal(paymentTitle(null, 'Phiếu bán hàng'), 'Phiếu bán hàng')
  assert.equal(
    paymentTitle(null, 'Phiếu bán hàng', undefined),
    'Phiếu bán hàng',
  )
})
