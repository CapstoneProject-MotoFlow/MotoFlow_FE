import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
const { outputText } = ts.transpileModule(
  readFileSync(
    new URL(
      '../src/modules/branch-manager/pages/branchSaleWork.ts',
      import.meta.url,
    ),
    'utf8',
  ),
  {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  },
)
const { saleWork, saleActions, sortNewestFirst } = await import(
  'data:text/javascript;base64,' + Buffer.from(outputText).toString('base64')
)
const formatCode = (id) => 'DB-' + String(id).padStart(4, '0')
const row = (id, nextAction) => ({
  id,
  customerName: null,
  createdAt: '2026-11-20T08:00:00',
  nextAction,
})

test('RELEASE row shows as waiting-stock work with a soạn action', () => {
  const [work] = saleWork([row(7, 'RELEASE')], formatCode)
  assert.equal(work.title, 'Đơn chờ hàng')
  assert.equal(work.action, 'Chuyển sang soạn')
  assert.equal(work.key, 's7')
  assert.equal(work.code, 'DB-0007')
  assert.equal(work.href, '/sales-orders/7')
  assert.equal(work.description, 'Khách lẻ')
})

test('unknown nextAction key is skipped without throwing', () => {
  const items = [row(1, 'SOMETHING_NEW'), row(2, 'CONFIRM')]
  let result
  assert.doesNotThrow(() => {
    result = saleWork(items, formatCode)
  })
  assert.deepEqual(
    result.map((w) => w.key),
    ['s2'],
  )
})

test('null nextAction is skipped', () => {
  assert.deepEqual(saleWork([row(3, null)], formatCode), [])
})

test('the four existing sale actions are unchanged', () => {
  assert.deepEqual(saleActions.ASSIGN_PICKER, {
    title: 'Chưa giao việc lấy hàng',
    action: 'Giao việc',
  })
  assert.deepEqual(saleActions.RECORD_PICKING, {
    title: 'Đang chờ kết quả lấy hàng',
    action: 'Xem đơn',
  })
  assert.deepEqual(saleActions.CONFIRM, {
    title: 'Đơn lấy hàng chờ xác nhận',
    action: 'Xác nhận',
  })
  assert.deepEqual(saleActions.COLLECT_PAYMENT, {
    title: 'Đơn chờ thanh toán',
    action: 'Thu tiền',
  })
  const actions = ['ASSIGN_PICKER', 'RECORD_PICKING', 'CONFIRM', 'COLLECT_PAYMENT']
  const work = saleWork(
    actions.map((a, i) => row(i + 1, a)),
    formatCode,
  )
  assert.deepEqual(
    work.map((w) => [w.title, w.action]),
    [
      ['Chưa giao việc lấy hàng', 'Giao việc'],
      ['Đang chờ kết quả lấy hàng', 'Xem đơn'],
      ['Đơn lấy hàng chờ xác nhận', 'Xác nhận'],
      ['Đơn chờ thanh toán', 'Thu tiền'],
    ],
  )
})

test('prototype keys such as toString are not treated as actions', () => {
  assert.deepEqual(saleWork([row(4, 'toString')], formatCode), [])
})

test('sortNewestFirst puts the latest work first and keeps ties stable', () => {
  const rows = [
    { key: 'c1', at: '2026-11-18T09:00:00' },
    { key: 's9', at: '2026-11-21T14:30:00' },
    { key: 'r2', at: '2026-11-20T08:00:00' },
    { key: 'b3', at: '2026-11-21T14:30:00' },
  ]
  assert.deepEqual(
    sortNewestFirst(rows).map((r) => r.key),
    ['b3', 's9', 'r2', 'c1'],
  )
  assert.deepEqual(
    rows.map((r) => r.key),
    ['c1', 's9', 'r2', 'b3'],
    'input array must not be mutated',
  )
})
