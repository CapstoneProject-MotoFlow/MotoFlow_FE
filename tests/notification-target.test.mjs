import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import ts from 'typescript'
const { outputText } = ts.transpileModule(
  readFileSync(
    new URL(
      '../src/modules/notifications/notificationModel.ts',
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
const { noticeTarget } = await import(
  'data:text/javascript;base64,' + Buffer.from(outputText).toString('base64')
)
test('inventory notices only open lot and product screens allowed by the current role', () => {
  assert.deepEqual(noticeTarget({ refType: 'LOT', refId: 17 }, 'OWNER'), {
    path: '/inventory/lots/17',
  })
  assert.deepEqual(
    noticeTarget({ refType: 'LOT', refId: 17 }, 'BRANCH_MANAGER'),
    { path: '/inventory/lots/17' },
  )
  assert.equal(noticeTarget({ refType: 'LOT', refId: 17 }, 'STAFF'), undefined)
  assert.deepEqual(noticeTarget({ refType: 'PRODUCT', refId: 17 }, 'STAFF'), {
    path: '/staff/products/17',
  })
  assert.deepEqual(noticeTarget({ refType: 'PRODUCT', refId: 17 }, 'OWNER'), {
    path: '/owner/products/17',
  })
})
test('count references open the count screen and receipt references open the real receipt dialog', () => {
  assert.deepEqual(
    noticeTarget({ refType: 'STOCK_COUNT', refId: 4 }, 'STAFF'),
    { path: '/stock-counts/4' },
  )
  assert.deepEqual(
    noticeTarget(
      { refType: 'STOCK_COUNT_REQUEST', refId: 2 },
      'BRANCH_MANAGER',
    ),
    { path: '/stock-counts' },
  )
  assert.equal(
    noticeTarget({ refType: 'STOCK_COUNT_REQUEST', refId: 2 }, 'STAFF'),
    undefined,
  )
  assert.deepEqual(
    noticeTarget({ refType: 'GOODS_RECEIPT_NOTE', refId: 3 }, 'OWNER'),
    { receiptId: 3 },
  )
})
test('unknown references, invalid IDs and Admin never create invented or external document links', () => {
  for (const id of [null, 0, -1, Infinity, 1.5, '17'])
    assert.equal(
      noticeTarget({ refType: 'LOT', refId: id }, 'OWNER'),
      undefined,
    )
  for (const refType of [
    'https://example.com',
    'SALES_ORDER',
    'TRANSFER_ORDER',
    null,
  ])
    assert.equal(noticeTarget({ refType, refId: 1 }, 'OWNER'), undefined)
  assert.equal(
    noticeTarget({ refType: 'PRODUCT', refId: 1 }, 'ADMIN'),
    undefined,
  )
})
