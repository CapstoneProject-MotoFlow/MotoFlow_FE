import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

const { outputText } = ts.transpileModule(
  readFileSync(
    new URL('../src/modules/sales/salesDeposit.ts', import.meta.url),
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
  todayIso,
  addDaysIso,
  parseMoney,
  validateDeposit,
  depositBadge,
  depositStatusLabels,
  depositPayload,
  depositTarget,
  afterDepositRoute,
} = await import(
  'data:text/javascript;base64,' + Buffer.from(outputText).toString('base64')
)

const base = {
  amount: '500000',
  method: 'CASH',
  reference: '',
  expiresOn: '2026-12-01',
}
const TODAY = '2026-11-22'

test('todayIso uses the Vietnam calendar day, not the machine zone', () => {
  // 18:30 UTC on 21/11 is 01:30 on 22/11 in Ho Chi Minh City.
  assert.equal(todayIso(new Date('2026-11-21T18:30:00Z')), '2026-11-22')
  // 16:30 UTC on 21/11 is still 23:30 on 21/11 in Ho Chi Minh City.
  assert.equal(todayIso(new Date('2026-11-21T16:30:00Z')), '2026-11-21')
})

test('addDaysIso does pure calendar math across month and year ends', () => {
  assert.equal(addDaysIso('2026-11-22', 8), '2026-11-30')
  assert.equal(addDaysIso('2026-11-22', 9), '2026-12-01')
  assert.equal(addDaysIso('2026-12-31', 1), '2027-01-01')
  assert.equal(addDaysIso('2028-02-28', 1), '2028-02-29')
  assert.equal(addDaysIso('2027-02-28', 1), '2027-03-01')
  assert.equal(addDaysIso('2026-11-22', 0), '2026-11-22')
  assert.equal(addDaysIso('2026-03-01', -1), '2026-02-28')
})

test('parseMoney accepts grouped Vietnamese money and rejects anything else', () => {
  assert.equal(parseMoney('1.500.000'), 1500000)
  assert.equal(parseMoney('1,500,000'), 1500000)
  assert.equal(parseMoney(' 2 000 000 ₫'), 2000000)
  assert.equal(parseMoney('300đ'), 300)
  assert.equal(parseMoney('0'), 0)
  for (const value of [
    '',
    '   ',
    'abc',
    '12a',
    '-5',
    '1.5.5x',
    '9999999999999999999999',
  ])
    assert.equal(parseMoney(value), null, value)
})

test('validateDeposit requires a positive amount', () => {
  const message = 'Vui lòng nhập số tiền cọc lớn hơn 0.'
  for (const amount of ['', '0', '-100', 'abc', '.'])
    assert.equal(
      validateDeposit({ ...base, amount }, TODAY, { requireExpiry: false }),
      message,
      amount,
    )
  assert.equal(validateDeposit(base, TODAY, { requireExpiry: false }), null)
})

test('validateDeposit caps the amount at 100 billion VND', () => {
  assert.equal(
    validateDeposit({ ...base, amount: '100000000000' }, TODAY, {
      requireExpiry: false,
    }),
    null,
  )
  assert.match(
    validateDeposit({ ...base, amount: '100000000001' }, TODAY, {
      requireExpiry: false,
    }),
    /100\.000\.000\.000/,
  )
})

test('validateDeposit requires an expiry after today only when asked to', () => {
  const required = { requireExpiry: true }
  assert.equal(
    validateDeposit({ ...base, expiresOn: '' }, TODAY, required),
    'Vui lòng chọn hạn cọc.',
  )
  assert.equal(
    validateDeposit({ ...base, expiresOn: TODAY }, TODAY, required),
    'Hạn cọc phải sau hôm nay.',
  )
  assert.equal(
    validateDeposit({ ...base, expiresOn: '2026-11-21' }, TODAY, required),
    'Hạn cọc phải sau hôm nay.',
  )
  assert.equal(
    validateDeposit({ ...base, expiresOn: '2026-11-23' }, TODAY, required),
    null,
  )
  // Changing an existing expiry follows the same rule; an empty expiry is not checked when not required.
  assert.equal(
    validateDeposit({ ...base, expiresOn: '' }, TODAY, {
      requireExpiry: false,
    }),
    null,
  )
})

test('validateDeposit requires a transfer reference for bank transfers', () => {
  const transfer = { ...base, method: 'BANK_TRANSFER' }
  const message = 'Vui lòng nhập mã giao dịch chuyển khoản.'
  assert.equal(
    validateDeposit({ ...transfer, reference: '' }, TODAY, {
      requireExpiry: false,
    }),
    message,
  )
  assert.equal(
    validateDeposit({ ...transfer, reference: '   ' }, TODAY, {
      requireExpiry: false,
    }),
    message,
  )
  assert.equal(
    validateDeposit({ ...transfer, reference: 'FT123' }, TODAY, {
      requireExpiry: false,
    }),
    null,
  )
  // Cash does not need a reference.
  assert.equal(
    validateDeposit({ ...base, reference: '' }, TODAY, {
      requireExpiry: false,
    }),
    null,
  )
})

test('validateDeposit checks cash tendered only when it is given', () => {
  const message = 'Tiền khách đưa phải đủ số tiền cọc.'
  assert.equal(
    validateDeposit({ ...base, tendered: '499999' }, TODAY, {
      requireExpiry: false,
    }),
    message,
  )
  assert.equal(
    validateDeposit({ ...base, tendered: 'abc' }, TODAY, {
      requireExpiry: false,
    }),
    message,
  )
  assert.equal(
    validateDeposit({ ...base, tendered: '500000' }, TODAY, {
      requireExpiry: false,
    }),
    null,
  )
  assert.equal(
    validateDeposit({ ...base, tendered: '' }, TODAY, { requireExpiry: false }),
    null,
  )
  assert.equal(
    validateDeposit({ ...base, tendered: '1.000.000' }, TODAY, {
      requireExpiry: false,
    }),
    null,
  )
})

test('depositBadge shows remaining deposit, expiry and forfeiture only when there is something to say', () => {
  assert.deepEqual(
    depositBadge({
      status: 'AWAITING_STOCK',
      depositStatus: 'ACTIVE',
      depositRemaining: 1500000,
    }),
    { text: 'Đã cọc 1.500.000 đ', tone: 'info' },
  )
  assert.equal(
    depositBadge({
      status: 'AWAITING_STOCK',
      depositStatus: 'ACTIVE',
      depositRemaining: 0,
    }),
    null,
  )
  assert.deepEqual(
    depositBadge({
      status: 'AWAITING_STOCK',
      depositStatus: 'EXPIRED',
      depositRemaining: 500000,
    }),
    { text: 'Quá hạn cọc', tone: 'danger' },
  )
  assert.deepEqual(
    depositBadge({
      status: 'CANCELLED',
      depositStatus: 'FORFEITED',
      depositRemaining: null,
    }),
    { text: 'Mất cọc', tone: 'muted' },
  )
  for (const depositStatus of ['SETTLED', 'NONE', null, undefined])
    assert.equal(
      depositBadge({ status: 'COMPLETED', depositStatus, depositRemaining: 0 }),
      null,
    )
})

test('deposit status labels cover every BE status in Vietnamese', () => {
  assert.deepEqual(depositStatusLabels, {
    NONE: 'Không có cọc',
    ACTIVE: 'Đang giữ cọc',
    EXPIRED: 'Quá hạn cọc',
    FORFEITED: 'Đã mất cọc',
    SETTLED: 'Đã dùng hết cọc',
  })
})

test('depositPayload builds the create-deposit body for cash with tendered money', () => {
  const body = depositPayload(
    {
      amount: '1.500.000',
      method: 'CASH',
      reference: '  ignored ',
      expiresOn: '2026-12-01',
      tendered: '2,000,000',
      verified: true,
    },
    0,
    { withExpiry: true },
  )
  assert.deepEqual(body, {
    amount: 1500000,
    tenderedAmount: 2000000,
    paymentMethod: 'CASH',
    transactionReference: null,
    verified: true,
    depositExpiresOn: '2026-12-01',
    expectedDepositRecorded: 0,
    evidence: [],
  })
})

test('depositPayload sends the trimmed reference for bank transfer and no tendered amount', () => {
  const body = depositPayload(
    {
      amount: '300000',
      method: 'BANK_TRANSFER',
      reference: '  FT-123  ',
      expiresOn: '2026-12-01',
      tendered: '400000',
      verified: false,
    },
    0,
    { withExpiry: true },
  )
  assert.equal(body.amount, 300000)
  assert.equal(body.tenderedAmount, null)
  assert.equal(body.paymentMethod, 'BANK_TRANSFER')
  assert.equal(body.transactionReference, 'FT-123')
  assert.equal(body.verified, false)
})

test('depositPayload defaults verified to true, leaves tendered null when blank and omits the expiry key when asked', () => {
  const body = depositPayload({ ...base, tendered: '   ' }, 150000, {
    withExpiry: false,
  })
  assert.equal(body.verified, true)
  assert.equal(body.tenderedAmount, null)
  assert.equal(body.expectedDepositRecorded, 150000)
  assert.equal('depositExpiresOn' in body, false)
  assert.deepEqual(body.evidence, [])

  const withoutFlag = depositPayload({ ...base, verified: undefined }, 0, {
    withExpiry: true,
  })
  assert.equal(withoutFlag.verified, true)
})

test('depositTarget takes the waiting order from split, or the order itself when it is waiting', () => {
  assert.equal(
    depositTarget({
      id: 5,
      status: 'AWAITING_STOCK',
      split: { waitingOrderId: 9 },
    }),
    9,
  )
  assert.equal(
    depositTarget({ id: 5, status: 'AWAITING_STOCK', split: null }),
    5,
  )
  assert.equal(
    depositTarget({
      id: 5,
      status: 'CONFIRMED',
      split: { waitingOrderId: null },
    }),
    null,
  )
})

test('afterDepositRoute opens the receipt for a verified deposit', () => {
  assert.deepEqual(
    afterDepositRoute({ ok: true, paymentId: 42, verified: true }, 9),
    { to: '/documents/PAYMENT/42/print' },
  )
})

test('afterDepositRoute opens the waiting order with a notice for an unverified deposit', () => {
  assert.deepEqual(
    afterDepositRoute({ ok: true, paymentId: 42, verified: false }, 9),
    {
      to: '/sales-orders/9',
      notice:
        'Đã ghi nhận cọc, chờ xác minh. In phiếu thu tiền cọc sau khi xác minh.',
    },
  )
})

test('afterDepositRoute opens the waiting order with the failure reason when the deposit request fails', () => {
  assert.deepEqual(
    afterDepositRoute({ ok: false, message: 'Hết hạn phiên' }, 9),
    {
      to: '/sales-orders/9',
      notice:
        'Đơn đã tạo nhưng chưa ghi nhận được cọc: Hết hạn phiên. Vui lòng thu cọc ở chi tiết đơn.',
    },
  )
})
