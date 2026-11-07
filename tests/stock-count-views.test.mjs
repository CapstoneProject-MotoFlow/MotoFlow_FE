import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createServer } from 'vite'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'

test('stock-count rows keep book quantities and costs out of Staff markup, including an explicit zero count', async () => {
  const server = await createServer({
    configFile: false,
    server: { middlewareMode: true, hmr: false, watch: null },
    appType: 'custom',
  })
  try {
    const { StockCountLines } = await server.ssrLoadModule(
      '/src/modules/inventory/StockCountLines.tsx',
    )
    const line = {
      id: 1,
      productId: 1,
      partName: 'A',
      sku: 'A',
      baseUnit: 'Cái',
      binLocation: 'B',
      lotCode: null,
      expiryDate: null,
      bookQty: 97,
      countedQty: 0,
      note: null,
      reason: null,
      recount: false,
      unitCost: 123456,
    }
    const count = { type: 'CYCLE', status: 'COUNTING', storeId: 2 }
    const render = (role) =>
      renderToStaticMarkup(
        createElement(
          MemoryRouter,
          null,
          createElement(StockCountLines, { count, role, lines: [line] }),
        ),
      )
    const staff = render('STAFF')
    assert.doesNotMatch(staff, /Sổ sách|Chênh lệch|Giá trị|123456|123\.456|97/)
    assert.match(staff, /<td>0<\/td>/)
    const owner = render('OWNER')
    assert.match(owner, /Sổ sách/)
    assert.match(owner, /Giá trị chênh lệch/)
    assert.match(owner, /-97/)
    const bm = render('BRANCH_MANAGER')
    assert.match(bm, /Sổ sách/)
    assert.doesNotMatch(bm, /Giá trị chênh lệch|123456|123\.456/)
  } finally {
    await server.close()
  }
})
