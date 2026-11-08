import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import ts from 'typescript'
const { outputText } = ts.transpileModule(
  readFileSync(
    new URL('../src/modules/inventory/stockGrouping.ts', import.meta.url),
    'utf8',
  ),
  {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  },
)
const { readAllStock, groupStock, stockTotals, sortStock } = await import(
  'data:text/javascript;base64,' + Buffer.from(outputText).toString('base64')
)
const row = (productId, storeId, qty, value, extra = {}) => ({
  productId,
  storeId,
  partName: productId === 1 ? 'Ắc quy' : 'Bugi',
  sku: 'P' + productId,
  baseUnit: 'Cái',
  availableQty: qty,
  awaitingInspectionQty: 0,
  wrongItemQty: 0,
  damagedQty: 0,
  awaitingSupplierReturnQty: 0,
  inTransitQty: 0,
  onHandQty: qty,
  nearExpiryQty: 0,
  expiredQty: 0,
  lowStock: false,
  stockValue: value,
  ...extra,
})
test('Owner groups the same part across every API page before summing and paginating products', async () => {
  const data = [row(1, 1, 10, 100), row(2, 1, 4, 40), row(1, 2, 5, 50)],
    calls = []
  const rows = await readAllStock(async (page) => {
    calls.push(page)
    return {
      items: page === 0 ? data.slice(0, 2) : data.slice(2),
      totalItems: 3,
      page,
      size: 2,
    }
  }, new AbortController().signal)
  const groups = groupStock(rows, rows, false, '')
  assert.deepEqual(calls, [0, 1])
  assert.equal(groups.length, 2)
  assert.equal(groups[0].rows.length, 2)
  assert.equal(groups[0].totals.availableQty, 15)
  assert.equal(groups[0].totals.stockValue, 150)
})
test('low-stock matching selects a product without dropping its other warehouse from chain totals', () => {
  const rows = [
    row(1, 1, 10, 100),
    row(1, 2, 5, 50, { lowStock: true }),
    row(2, 1, 4, 40),
  ]
  const groups = groupStock(rows, [rows[1]], false, 'lowStock')
  assert.equal(groups.length, 1)
  assert.equal(groups[0].lowStores, 1)
  assert.equal(groups[0].totals.availableQty, 15)
  assert.equal(groups[0].rows.length, 2)
})
test('unknown cost marks the known subtotal as incomplete and in-transit does not inflate physical stock', () => {
  const rows = [row(1, 1, 10, 100, { inTransitQty: 3 }), row(1, 2, 5, null)]
  assert.equal(stockTotals(rows).stockValue, 100)
  assert.equal(stockTotals(rows).incompleteCost, true)
  assert.equal(stockTotals(rows).onHandQty, 15)
  assert.equal(stockTotals(rows).inTransitQty, 3)
})
test('incomplete, duplicate or changing pagination never produces partial totals', async () => {
  await assert.rejects(
    readAllStock(
      async (page) =>
        page === 0
          ? { items: [row(1, 1, 1, 1)], totalItems: 2 }
          : { items: [], totalItems: 2 },
      new AbortController().signal,
    ),
  )
  await assert.rejects(
    readAllStock(
      async () => ({ items: [row(1, 1, 1, 1)], totalItems: 2 }),
      new AbortController().signal,
    ),
  )
  await assert.rejects(
    readAllStock(
      async (page) => ({
        items: [row(page + 1, 1, 1, 1)],
        totalItems: page === 0 ? 2 : 3,
      }),
      new AbortController().signal,
    ),
  )
  const controller = new AbortController()
  controller.abort()
  await assert.rejects(
    readAllStock(async () => ({ items: [], totalItems: 0 }), controller.signal),
  )
})
test('zero-stock display and value sorting preserve zero, unknown values and source order', () => {
  const rows = [row(1, 1, 0, 0), row(2, 1, 4, 40), row(3, 1, 2, null)]
  assert.equal(groupStock(rows, rows, false, '').length, 2)
  assert.equal(groupStock(rows, rows, true, '').length, 3)
  assert.deepEqual(
    sortStock(
      rows,
      (r) => r,
      (r) => r.stockValue,
      'value',
    ).map((r) => r.productId),
    [2, 1, 3],
  )
  assert.deepEqual(
    rows.map((r) => r.productId),
    [1, 2, 3],
  )
})

test('unpriced empty stock contributes zero without marking known totals incomplete', () => {
  const total = stockTotals([row(1, 1, 0, null), row(2, 1, 5, 50)])
  assert.equal(total.stockValue, 50)
  assert.equal(total.incompleteCost, false)
  assert.equal(
    stockTotals([row(1, 1, 0, null, { inTransitQty: 1 })]).incompleteCost,
    true,
  )
})
