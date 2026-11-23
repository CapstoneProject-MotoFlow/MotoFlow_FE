import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
const { outputText } = ts.transpileModule(
  readFileSync(
    new URL('../src/modules/sales/splitPayment.ts', import.meta.url),
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
  splitPaymentFigures,
  parseSplitAmount,
  splitPaymentCheck,
  splitPaymentErrorField,
  splitPaymentBody,
  fullPaymentFigures,
  fullPaymentState,
  creditPrepaymentFigures,
  creditPrepaymentBody,
  MAX_SPLIT_AMOUNT,
} = await import(
  'data:text/javascript;base64,' + Buffer.from(outputText).toString('base64')
)

const base = {
  cash: 0,
  tendered: null,
  transfer: 0,
  transactionReference: '',
  payable: 140000,
}
const check = (over) => splitPaymentCheck({ ...base, ...over })

test('only cash: records the cash, change is tendered minus cash', () => {
  const r = check({ cash: 140000, tendered: 200000 })
  assert.equal(r.valid, true)
  assert.equal(r.total, 140000)
  assert.equal(r.change, 60000)
  assert.deepEqual(r.errors, {})
})

test('only transfer: needs a reference, no change', () => {
  const ok = check({ transfer: 100000, transactionReference: ' FT123 ' })
  assert.equal(ok.valid, true)
  assert.equal(ok.total, 100000)
  assert.equal(ok.change, 0)
  const missing = check({ transfer: 100000 })
  assert.equal(missing.valid, false)
  assert.ok(missing.errors.reference)
  assert.equal(missing.errors.total, undefined)
})

test('both parts: cash plus transfer sums to the total and may pay the order exactly', () => {
  const r = check({
    cash: 40000,
    tendered: 50000,
    transfer: 100000,
    transactionReference: 'FT9',
  })
  assert.equal(r.valid, true)
  assert.equal(r.total, 140000)
  assert.equal(r.change, 10000)
})

test('transfer without reference is rejected even when cash is also given', () => {
  const r = check({ cash: 10000, transfer: 5000 })
  assert.equal(r.valid, false)
  assert.ok(r.errors.reference)
  assert.equal(r.errors.total, undefined)
})

test('total above the payable is rejected and names the payable', () => {
  const r = check({ cash: 100000, transfer: 50000, transactionReference: 'X' })
  assert.equal(r.valid, false)
  assert.match(r.errors.total, /140\.000/)
})

test('khách đưa below the cash is rejected', () => {
  const r = check({ cash: 140000, tendered: 100000 })
  assert.equal(r.valid, false)
  assert.ok(r.errors.tendered)
  assert.equal(r.change, 0)
})

test('khách đưa given without any cash is rejected (BE MSG182)', () => {
  const r = check({
    cash: 0,
    tendered: 50000,
    transfer: 10000,
    transactionReference: 'X',
  })
  assert.equal(r.valid, false)
  assert.ok(r.errors.tendered)
})

test('zero total is rejected', () => {
  const r = check({ cash: 0, transfer: 0 })
  assert.equal(r.valid, false)
  assert.match(r.errors.total, /lớn hơn 0/)
})

test('an amount above the system limit is rejected on its field', () => {
  const r = check({ cash: MAX_SPLIT_AMOUNT + 1, payable: MAX_SPLIT_AMOUNT * 2 })
  assert.ok(r.errors.cash)
})

test('empty and non-digit input parse to null, digits parse to numbers', () => {
  assert.equal(parseSplitAmount(''), null)
  assert.equal(parseSplitAmount('  '), null)
  assert.equal(parseSplitAmount('140.000'), 140000)
  assert.equal(parseSplitAmount('0'), 0)
})

test('BE field errors and codes map to the matching dialog field', () => {
  assert.equal(
    splitPaymentErrorField({ fieldErrors: { transactionReference: 'x' } }),
    'reference',
  )
  assert.equal(splitPaymentErrorField({ code: 'MSG154' }), 'reference')
  assert.equal(splitPaymentErrorField({ code: 'MSG181' }), 'total')
  assert.equal(splitPaymentErrorField({ code: 'MSG333' }), 'total')
  assert.equal(splitPaymentErrorField({ code: 'MSG182' }), 'tendered')
  assert.equal(splitPaymentErrorField({ code: 'MSG151' }), 'reference')
  assert.equal(splitPaymentErrorField({ code: 'MSG194' }), null)
  assert.equal(splitPaymentErrorField({}), null)
})

const state = (over) => ({
  cashText: '',
  tenderedText: '',
  transferText: '',
  reference: '',
  ...over,
})

test('body, cash only: no khách đưa typed means tenderedAmount null', () => {
  assert.deepEqual(splitPaymentBody(state({ cashText: '140000' }), 140000), {
    cashAmount: 140000,
    tenderedAmount: null,
    transferAmount: 0,
    transactionReference: null,
    expectedPayable: 140000,
    evidence: [],
  })
})

test('body, cash 40k + transfer 100k with khách đưa untouched: tendered null, change 0', () => {
  const s = state({
    cashText: '40000',
    transferText: '100000',
    reference: ' FT1 ',
  })
  const body = splitPaymentBody(s, 140000)
  assert.equal(body.cashAmount, 40000)
  assert.equal(body.tenderedAmount, null)
  assert.equal(body.transferAmount, 100000)
  assert.equal(body.transactionReference, 'FT1')
  assert.equal(splitPaymentFigures(s, 140000).check.change, 0)
  assert.equal(splitPaymentFigures(s, 140000).check.valid, true)
})

test('body, transfer only: cash and khách đưa are zero or null', () => {
  assert.deepEqual(
    splitPaymentBody(
      state({ transferText: '100000', reference: 'FT2' }),
      140000,
    ),
    {
      cashAmount: 0,
      tenderedAmount: null,
      transferAmount: 100000,
      transactionReference: 'FT2',
      expectedPayable: 140000,
      evidence: [],
    },
  )
})

test('body, both with khách đưa typed: tenderedAmount is the typed value', () => {
  const body = splitPaymentBody(
    state({
      cashText: '40000',
      tenderedText: '50000',
      transferText: '100000',
      reference: 'FT3',
    }),
    140000,
  )
  assert.equal(body.tenderedAmount, 50000)
  assert.equal(
    splitPaymentFigures(
      state({ cashText: '40000', tenderedText: '50000' }),
      140000,
    ).check.change,
    10000,
  )
})

test('body, typed khách đưa without cash is not sent', () => {
  const body = splitPaymentBody(
    state({ tenderedText: '50000', transferText: '10000', reference: 'X' }),
    140000,
  )
  assert.equal(body.cashAmount, 0)
  assert.equal(body.tenderedAmount, null)
})

const typed = (over = {}) => ({
  cashText: '',
  tenderedText: '',
  transferText: '',
  reference: '',
  ...over,
})

test('full payment: cash is what the transfer leaves of payableNow', () => {
  const none = fullPaymentFigures(typed(), 140000)
  assert.equal(none.cash, 140000)
  assert.equal(none.check.valid, true)
  const part = fullPaymentFigures(
    typed({ transferText: '100000', reference: 'FT1', tenderedText: '50000' }),
    140000,
  )
  assert.equal(part.cash, 40000)
  assert.equal(part.check.change, 10000)
  assert.equal(part.check.total, 140000)
  const body = splitPaymentBody(
    fullPaymentState(typed({ transferText: '100000', reference: 'FT1' }), 140000),
    140000,
  )
  assert.equal(body.cashAmount, 40000)
  assert.equal(body.transferAmount, 100000)
  assert.equal(body.expectedPayable, 140000)
})

test('full payment: a transfer covering it all leaves no cash, more than payable is refused on the transfer', () => {
  const all = fullPaymentFigures(
    typed({ transferText: '140000', reference: 'FT1' }),
    140000,
  )
  assert.equal(all.cash, 0)
  assert.equal(all.check.valid, true)
  const over = fullPaymentFigures(
    typed({ transferText: '150000', reference: 'FT1' }),
    140000,
  )
  assert.equal(over.check.valid, false)
  assert.match(over.check.errors.transfer, /140\.000/)
  assert.equal(over.check.errors.total, undefined)
  const short = fullPaymentFigures(typed({ tenderedText: '100000' }), 140000)
  assert.equal(short.check.valid, false)
  assert.ok(short.check.errors.tendered)
})

test('credit prepayment: nothing paid now puts it all on credit', () => {
  const r = creditPrepaymentFigures(typed(), 285000)
  assert.equal(r.check.valid, true)
  assert.equal(r.credit, 285000)
  assert.deepEqual(creditPrepaymentBody(typed(), 285000), {
    creditAmount: 285000,
    cashAmount: 0,
    tenderedAmount: null,
    transferAmount: 0,
    transactionReference: null,
  })
})

test('credit prepayment: cash and transfer paid now leave the rest on credit', () => {
  const state = typed({
    cashText: '200000',
    tenderedText: '250000',
    transferText: '50000',
    reference: ' FT7 ',
  })
  const r = creditPrepaymentFigures(state, 285000)
  assert.equal(r.check.valid, true)
  assert.equal(r.credit, 35000)
  assert.equal(r.check.change, 50000)
  assert.deepEqual(creditPrepaymentBody(state, 285000), {
    creditAmount: 35000,
    cashAmount: 200000,
    tenderedAmount: 250000,
    transferAmount: 50000,
    transactionReference: 'FT7',
  })
})

test('credit prepayment: paying it all or more is a payment, not credit', () => {
  const all = creditPrepaymentFigures(typed({ cashText: '285000' }), 285000)
  assert.equal(all.check.valid, false)
  assert.match(all.check.errors.total, /Thanh toán/)
  const transferNoRef = creditPrepaymentFigures(
    typed({ transferText: '1000' }),
    285000,
  )
  assert.ok(transferNoRef.check.errors.reference)
  assert.equal(splitPaymentErrorField({ code: 'MSG347' }), 'total')
})
