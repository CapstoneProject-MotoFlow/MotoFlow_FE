import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

const { outputText } = ts.transpileModule(
  readFileSync(
    new URL('../src/modules/sales/salesRelease.ts', import.meta.url),
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
  estimateLineTotal,
  estimateReleaseTotal,
  isLastRelease,
  shortLines,
  releaseDeposit,
  buildReleaseBody,
  releaseBlockers,
  parseSurplusFromMessage,
} = await import(
  'data:text/javascript;base64,' + Buffer.from(outputText).toString('base64')
)

const lineA = {
  lineId: 1,
  requested: 5,
  sellableQty: 5,
  actualUnitPrice: null,
  retailPrice: 100_000,
}
const lineB = {
  lineId: 2,
  requested: 2,
  sellableQty: 2,
  actualUnitPrice: 80_000,
  retailPrice: 100_000,
}

test('estimateLineTotal uses retail price minus discount when no actual price', () => {
  // 100.000 với giảm 10% = 90.000 mỗi cái.
  assert.equal(estimateLineTotal(3, lineA, 10), 270_000)
  // Làm tròn như BE: 99.999 × 0.85 = 84.999,15 → 84.999.
  assert.equal(
    estimateLineTotal(1, { actualUnitPrice: null, retailPrice: 99_999 }, 15),
    84_999,
  )
  assert.equal(
    estimateLineTotal(1, { actualUnitPrice: null, retailPrice: 100_000 }, 0),
    100_000,
  )
})

test('estimateLineTotal returns null when there is no price at all', () => {
  assert.equal(
    estimateLineTotal(1, { actualUnitPrice: null, retailPrice: null }, 0),
    null,
  )
})

test('estimateReleaseTotal sums released lines and skips zero quantities', () => {
  assert.equal(
    estimateReleaseTotal([lineA, lineB], { 1: 2, 2: 0 }, 10),
    180_000,
  )
})

test('estimateReleaseTotal is null when a released line has no price, but ignores unreleased ones', () => {
  const noPrice = {
    lineId: 3,
    requested: 1,
    sellableQty: 1,
    actualUnitPrice: null,
    retailPrice: null,
  }
  assert.equal(estimateReleaseTotal([lineA, noPrice], { 1: 1, 3: 1 }, 0), null)
  assert.equal(
    estimateReleaseTotal([lineA, noPrice], { 1: 1, 3: 0 }, 0),
    100_000,
  )
})

test('isLastRelease is true only when every line releases its full requested quantity', () => {
  assert.equal(isLastRelease([lineA, lineB], { 1: 5, 2: 2 }), true)
  assert.equal(isLastRelease([lineA, lineB], { 1: 5, 2: 1 }), false)
  assert.equal(isLastRelease([lineA, lineB], { 1: 5 }), false)
  assert.equal(isLastRelease([], {}), false)
})

test('shortLines lists line ids whose now quantity exceeds the sellable quantity', () => {
  const tight = { lineId: 9, requested: 5, sellableQty: 2 }
  const unknown = { lineId: 10, requested: 5, sellableQty: undefined }
  assert.deepEqual(
    shortLines([tight, lineA, unknown], { 9: 3, 1: 5, 10: 5 }),
    [9],
  )
  assert.deepEqual(shortLines([tight], { 9: 2 }), [])
})

test('releaseDeposit partial: suggests the max and clamps the typed amount', () => {
  const base = {
    remaining: 3_000_000,
    estimatedTotal: 1_200_000,
    isLast: false,
  }
  assert.deepEqual(releaseDeposit({ ...base, typed: null }), {
    suggested: 1_200_000,
    max: 1_200_000,
    locked: false,
    send: 1_200_000,
    refund: 0,
  })
  assert.equal(releaseDeposit({ ...base, typed: 500_000 }).send, 500_000)
  assert.equal(releaseDeposit({ ...base, typed: 5_000_000 }).send, 1_200_000)
  assert.equal(releaseDeposit({ ...base, typed: -10 }).send, 0)
})

test('releaseDeposit partial with unknown total is capped by remaining', () => {
  const result = releaseDeposit({
    remaining: 3_000_000,
    estimatedTotal: null,
    isLast: false,
    typed: null,
  })
  assert.equal(result.max, 3_000_000)
  assert.equal(result.send, 3_000_000)
})

test('releaseDeposit last release locks the amount and sends nothing', () => {
  assert.deepEqual(
    releaseDeposit({
      remaining: 2_000_000,
      estimatedTotal: 2_500_000,
      isLast: true,
      typed: 1,
    }),
    {
      suggested: 2_000_000,
      max: 2_000_000,
      locked: true,
      send: null,
      refund: 0,
    },
  )
})

test('releaseDeposit last release refunds the surplus when remaining exceeds the total', () => {
  assert.deepEqual(
    releaseDeposit({
      remaining: 5_000_000,
      estimatedTotal: 4_000_000,
      isLast: true,
      typed: null,
    }),
    {
      suggested: 4_000_000,
      max: 4_000_000,
      locked: true,
      send: null,
      refund: 1_000_000,
    },
  )
})

test('releaseDeposit with no remaining deposit is all zero or null', () => {
  const empty = { suggested: 0, max: 0, locked: false, send: null, refund: 0 }
  assert.deepEqual(
    releaseDeposit({
      remaining: 0,
      estimatedTotal: 500_000,
      isLast: false,
      typed: 100,
    }),
    empty,
  )
  assert.deepEqual(
    releaseDeposit({
      remaining: 0,
      estimatedTotal: 500_000,
      isLast: true,
      typed: null,
    }),
    empty,
  )
})

test('estimateLineTotal uses the retail price first and the actual price only without retail', () => {
  // Giá bán lẻ 100.000 giảm 50% = 50.000 mỗi cái, dù giá thực tế là 80.000.
  assert.equal(estimateLineTotal(2, lineB, 50), 100_000)
  assert.equal(
    estimateLineTotal(2, { actualUnitPrice: 70_000, retailPrice: null }, 50),
    140_000,
  )
})

test('buildReleaseBody sends only lines when there is no deposit', () => {
  assert.deepEqual(
    buildReleaseBody({
      lines: [{ lineId: 1, nowQty: 2 }],
      deposit: null,
      refund: { needed: false, method: 'CASH', reference: '', paid: false },
    }),
    { lines: [{ lineId: 1, nowQty: 2 }] },
  )
})

test('buildReleaseBody sends depositAmount for a partial release even when the user typed less than requested', () => {
  assert.deepEqual(
    buildReleaseBody({
      lines: [{ lineId: 1, nowQty: 1 }],
      deposit: { remaining: 3_000_000, isLast: false, send: 500_000 },
      refund: { needed: false, method: 'CASH', reference: '', paid: false },
    }),
    { lines: [{ lineId: 1, nowQty: 1 }], depositAmount: 500_000 },
  )
})

test('buildReleaseBody omits depositAmount on the last release and sends the refund when needed', () => {
  assert.deepEqual(
    buildReleaseBody({
      lines: [{ lineId: 1, nowQty: 1 }],
      deposit: { remaining: 2_000_000, isLast: true, send: null },
      refund: { needed: false, method: 'CASH', reference: '', paid: false },
    }),
    { lines: [{ lineId: 1, nowQty: 1 }] },
  )
  assert.deepEqual(
    buildReleaseBody({
      lines: [{ lineId: 1, nowQty: 1 }],
      deposit: { remaining: 5_000_000, isLast: true, send: null },
      refund: {
        needed: true,
        method: 'BANK_TRANSFER',
        reference: ' TX-9 ',
        paid: true,
      },
    }),
    {
      lines: [{ lineId: 1, nowQty: 1 }],
      depositRefund: {
        paymentMethod: 'BANK_TRANSFER',
        transactionReference: 'TX-9',
        paidToCustomer: true,
      },
    },
  )
})

const noRefund = { needed: false, method: 'CASH', reference: '', paid: false }
const lastDeposit = (unverified = 0) => ({
  remaining: 2_000_000,
  unverified,
  status: 'ACTIVE',
})

test('releaseBlockers: a partial deposit above the max is blocked with the max amount', () => {
  assert.deepEqual(
    releaseBlockers({
      shortCount: 0,
      isLast: false,
      deposit: lastDeposit(),
      typed: 1_500_000,
      max: 1_200_000,
      estimatedTotal: 1_200_000,
      refund: noRefund,
    }),
    ['Tối đa 1.200.000 ₫ (cọc còn lại và tổng đơn tách).'],
  )
  assert.deepEqual(
    releaseBlockers({
      shortCount: 0,
      isLast: false,
      deposit: lastDeposit(),
      typed: 1_500_000,
      max: 2_000_000,
      estimatedTotal: null,
      refund: noRefund,
    }).length,
    0,
  )
  assert.match(
    releaseBlockers({
      shortCount: 0,
      isLast: false,
      deposit: lastDeposit(),
      typed: 2_500_000,
      max: 2_000_000,
      estimatedTotal: null,
      refund: noRefund,
    })[0],
    /^Tối đa 2\.000\.000\s₫ \(cọc còn lại; chưa ước tính được tổng đơn, hệ thống sẽ kiểm tra lại\)\.$/,
  )
})

test('releaseBlockers: the last release with unverified deposit is blocked', () => {
  const messages = releaseBlockers({
    shortCount: 0,
    isLast: true,
    deposit: lastDeposit(500_000),
    typed: null,
    max: 2_000_000,
    estimatedTotal: 2_500_000,
    refund: noRefund,
  })
  assert.deepEqual(messages, [
    'Còn 500.000 ₫ tiền cọc chưa xác minh. Xác minh hết trước khi chuyển lần cuối.',
  ])
})

test('releaseBlockers: a transfer refund without a reference is blocked', () => {
  const messages = releaseBlockers({
    shortCount: 0,
    isLast: true,
    deposit: lastDeposit(),
    typed: null,
    max: 2_000_000,
    estimatedTotal: 1_000_000,
    refund: {
      needed: true,
      method: 'BANK_TRANSFER',
      reference: '  ',
      paid: true,
    },
  })
  assert.deepEqual(messages, ['Nhập mã giao dịch chuyển khoản hoàn tiền.'])
})

test('releaseBlockers: a refund without the paid checkbox is blocked, a cash refund with it is not', () => {
  const unpaid = releaseBlockers({
    shortCount: 0,
    isLast: true,
    deposit: lastDeposit(),
    typed: null,
    max: 2_000_000,
    estimatedTotal: 1_000_000,
    refund: { needed: true, method: 'CASH', reference: '', paid: false },
  })
  assert.deepEqual(unpaid, ['Xác nhận đã trả tiền cho khách.'])
  const paid = releaseBlockers({
    shortCount: 0,
    isLast: true,
    deposit: lastDeposit(),
    typed: null,
    max: 2_000_000,
    estimatedTotal: 1_000_000,
    refund: { needed: true, method: 'CASH', reference: '', paid: true },
  })
  assert.deepEqual(paid, [])
})

test('releaseBlockers: expired deposit and short lines are reported', () => {
  const messages = releaseBlockers({
    shortCount: 2,
    isLast: false,
    deposit: { remaining: 1_000_000, unverified: 0, status: 'EXPIRED' },
    typed: null,
    max: 1_000_000,
    estimatedTotal: 1_000_000,
    refund: noRefund,
  })
  assert.deepEqual(messages, [
    'Có dòng vượt số còn bán được. Giảm số lấy ngay hoặc để chờ tiếp.',
    'Cọc đã quá hạn, đơn không chuyển sang soạn được.',
  ])
})

test('parseSurplusFromMessage reads the amount from an MSG328 message or returns null', () => {
  assert.equal(
    parseSurplusFromMessage('Cọc thừa 1.000.000 đ cần hoàn lại khách.'),
    1_000_000,
  )
  assert.equal(parseSurplusFromMessage('Cần hoàn lại khách.'), null)
})

test('parseSurplusFromMessage reads the real BE MSG328 text', () => {
  assert.equal(
    parseSurplusFromMessage(
      'Tiền cọc còn lại vượt tổng tiền đơn 680.000 đ. Vui lòng chọn cách trả lại khách phần thừa này.',
    ),
    680_000,
  )
})

test('parseSurplusFromMessage never joins digits across whitespace or newlines', () => {
  assert.equal(parseSurplusFromMessage('12\n345 đ'), 345)
  assert.equal(parseSurplusFromMessage('12 345 đ'), 345)
  assert.equal(parseSurplusFromMessage('Mã 12 345 ₫'), 345)
  assert.equal(parseSurplusFromMessage('Số 500 000 cần trả'), null)
})

test('parseSurplusFromMessage returns null when no currency follows the number', () => {
  assert.equal(parseSurplusFromMessage('Cọc thừa 500000 đ cần trả.'), 500_000)
  assert.equal(parseSurplusFromMessage('Cọc thừa 500000 cần trả.'), null)
  assert.equal(parseSurplusFromMessage('Còn 500.000 chưa rõ'), null)
})

test('buildReleaseBody omits depositRefund when the refund is needed but not confirmed as paid', () => {
  const body = buildReleaseBody({
    lines: [{ lineId: 1, nowQty: 1 }],
    deposit: { remaining: 5_000_000, isLast: true, send: null },
    refund: { needed: true, method: 'CASH', reference: '', paid: false },
  })
  assert.deepEqual(body, { lines: [{ lineId: 1, nowQty: 1 }] })
  assert.equal('depositRefund' in body, false)
})
