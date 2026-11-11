import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createServer } from 'vite'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'

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
        new RegExp('colspan="' + (balance ? 8 : 7) + '" scope="rowgroup"', 'i'),
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
