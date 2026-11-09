import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
const source = ts.transpileModule(
  readFileSync(
    new URL('../src/modules/inventory/countApi.ts', import.meta.url),
    'utf8',
  ),
  {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  },
).outputText
const { countFromDto, countScope } = await import(
  'data:text/javascript;base64,' + Buffer.from(source).toString('base64')
)
test('count DTO maps scope, zero, recount and null private values without inventing unit costs or submission state', () => {
  const dto = {
    id: 8,
    storeId: 2,
    storeName: 'Kho',
    countType: 'CYCLE',
    countDate: '2026-11-09',
    scopeType: 'AREA',
    scopeNote: 'A',
    status: 'COUNTING',
    createdByName: 'BM',
    createdAt: '2026-11-09',
    request: { id: 3, reason: 'Kiểm lại' },
    confirmedBy: null,
    confirmedAt: null,
    approvedBy: 9,
    approvedAt: '2026-11-09',
    lines: [
      {
        id: 1,
        productId: 2,
        sku: 'P',
        partName: 'P',
        baseUnit: 'cái',
        lotId: 6,
        bookQty: null,
        countedQty: 0,
        recountRequested: true,
        recountReason: 'Đếm lại kệ',
        differenceValue: null,
      },
    ],
  }
  const count = countFromDto(dto)
  assert.equal(count.scopeLabel, 'Khu vực A')
  assert.equal(count.type, 'CYCLE')
  assert.equal(count.lines[0].countedQty, 0)
  assert.equal(count.lines[0].bookQty, null)
  assert.equal(count.lines[0].unitCost, null)
  assert.equal(count.lines[0].lotCode, '#6')
  assert.equal(count.lines[0].recount, true)
  assert.equal(count.submittedAt, null)
  assert.equal(count.sourceReason, 'Kiểm lại')
  assert.equal(count.approvedByName, '#9')
})
test('count scopes preserve warehouse and product scopes', () => {
  assert.equal(countScope('WHOLE', null), 'Toàn kho')
  assert.equal(countScope('PRODUCTS', null), 'Theo phụ tùng')
})
