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

test('count detail distinguishes cancelled, returned and opening states without leaking cost to Staff or BM', async () => {
  const server = await createServer({
    configFile: false,
    server: { middlewareMode: true, hmr: false, watch: null },
    appType: 'custom',
  })
  try {
    const { StockCountDetailView } = await server.ssrLoadModule(
      '/src/modules/inventory/StockCountDetailPage.tsx',
    )
    const count = {
      id: 1,
      code: 'K-TEST',
      storeId: 1,
      storeName: 'Kho',
      type: 'OPENING',
      status: 'CANCELLED',
      countDate: '2026-11-07',
      scopeLabel: 'Toàn kho',
      sourceLabel: 'BM',
      assigneeName: null,
      submittedAt: null,
      createdByName: 'BM',
      createdAt: '2026-11-07T09:00:00',
      confirmedByName: null,
      confirmedAt: null,
      approvedByName: null,
      approvedAt: null,
      events: [],
      cancellationReason: 'Hủy theo yêu cầu',
      recountReason: 'Đếm lại ô kệ',
      lines: [
        {
          id: 1,
          productId: 1,
          partName: 'A',
          sku: 'A',
          baseUnit: 'Cái',
          binLocation: null,
          lotCode: null,
          expiryDate: null,
          bookQty: 10,
          countedQty: 2,
          note: null,
          reason: null,
          recount: false,
          unitCost: 123456,
        },
      ],
    }
    const render = (role, data = count) =>
      renderToStaticMarkup(
        createElement(
          MemoryRouter,
          null,
          createElement(StockCountDetailView, { role, count: data }),
        ),
      )
    const owner = render('OWNER')
    assert.match(owner, /Hủy theo yêu cầu/)
    assert.match(owner, /Đếm lại ô kệ/)
    assert.match(owner, /Giá trị tồn đầu kỳ/)
    assert.doesNotMatch(owner, /Duyệt chênh lệch<\/button>/)
    for (const role of ['STAFF', 'BRANCH_MANAGER'])
      assert.doesNotMatch(
        render(role),
        /Giá trị tồn đầu kỳ|246[.,]912|123[.,]456/,
      )
    assert.match(
      render('OWNER', {
        ...count,
        lines: [{ ...count.lines[0], unitCost: null }],
      }),
      /Giá trị tồn đầu kỳ<\/dt><dd>—<\/dd>/,
    )
  } finally {
    await server.close()
  }
})

test('movement date header spans all enabled columns and inventory errors retain BE field messages', async () => {
  const server = await createServer({
    configFile: false,
    server: { middlewareMode: true, hmr: false, watch: null },
    appType: 'custom',
  })
  try {
    const { MovementTable } = await server.ssrLoadModule(
      '/src/modules/inventory/MovementTable.tsx',
    )
    const movement = {
      id: 1,
      occurredAt: '2026-11-07T09:00:00',
      sku: 'A',
      movementType: 'OPENING',
      stockStatus: 'AVAILABLE',
      quantityChange: 1,
      lotId: null,
      sourceType: 'STOCK_COUNT',
      sourceId: 1,
      performedByName: null,
      reason: null,
    }
    for (const balance of [false, true]) {
      const html = renderToStaticMarkup(
        createElement(
          MemoryRouter,
          null,
          createElement(MovementTable, {
            rows: [movement],
            showBalance: balance,
          }),
        ),
      )
      assert.match(
        html,
        new RegExp('colspan="' + (balance ? 9 : 8) + '" scope="rowgroup"', 'i'),
      )
    }
    const { inventoryError } = await server.ssrLoadModule(
      '/src/modules/inventory/api.ts',
    )
    assert.equal(
      inventoryError({
        isAxiosError: true,
        response: {
          data: {
            message: 'Dữ liệu không hợp lệ',
            fieldErrors: { days: 'Số ngày không hợp lệ.' },
          },
        },
      }),
      'Số ngày không hợp lệ.',
    )
  } finally {
    await server.close()
  }
})
