import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createServer } from 'vite'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

test('live count screens hide book quantities and values from Staff during blind counting', async () => {
  const server = await createServer({
    configFile: false,
    server: { middlewareMode: true, hmr: false, watch: null },
    appType: 'custom',
    plugins: [
      {
        name: 'count-api-fixture',
        enforce: 'pre',
        transform(_source, id) {
          if (!id.replaceAll('\\', '/').endsWith('/inventory/api.ts')) return
          return `
          let role, data;
          export function fixture(nextRole, nextData) { role = nextRole; data = nextData }
          export function useInventoryScope() {
            return { user: { id: 9, role, storeId: 2 }, owner: role === 'OWNER' }
          }
          export function useInventoryData(path, params, revision, enabled = true) {
            return { loading: false, data: enabled && path.startsWith('/stock-counts/') ? data : undefined }
          }
          export function inventoryError(e) { return String(e) }
        `
        },
      },
    ],
  })
  try {
    const { fixture } = await server.ssrLoadModule(
      '/src/modules/inventory/api.ts',
    )
    const { default: Record } = await server.ssrLoadModule(
      '/src/modules/inventory/CountLiveRecord.tsx',
    )
    const { default: Detail } = await server.ssrLoadModule(
      '/src/modules/inventory/CountLiveDetail.tsx',
    )
    const data = {
      id: 1,
      storeId: 2,
      storeName: 'Kho',
      countType: 'CYCLE',
      countDate: '2026-11-09',
      createdAt: '2026-11-09T09:00:00',
      scopeType: 'WHOLE',
      status: 'COUNTING',
      createdByName: 'BM',
      awaitingBookQuantities: false,
      lines: [
        {
          id: 1,
          productId: 1,
          partName: 'Phụ tùng A',
          sku: 'SKU-A',
          lotId: null,
          binLocation: 'A1',
          bookQty: 98765,
          countedQty: 0,
          difference: -98765,
          differenceValue: -123456789,
          recountRequested: false,
          recountReason: null,
        },
      ],
    }
    function render(Component, role, dto = data) {
      fixture(role, dto)
      return renderToStaticMarkup(
        createElement(
          MemoryRouter,
          { initialEntries: ['/stock-counts/1'] },
          createElement(
            Routes,
            null,
            createElement(Route, {
              path: '/stock-counts/:id',
              element: createElement(Component),
            }),
          ),
        ),
      )
    }
    for (const dto of [
      data,
      {
        ...data,
        lines: [
          {
            ...data.lines[0],
            recountRequested: true,
            recountReason: 'Đếm lại kệ A',
          },
        ],
      },
    ]) {
      const record = render(Record, 'STAFF', dto)
      assert.match(record, /Phụ tùng A/)
      assert.match(record, /value="0"/)
      assert.doesNotMatch(
        record,
        /Sổ sách|Chênh lệch|Giá trị|98765|98[.,]765|123[.,]?456[.,]?789/,
      )
      const detail = render(Detail, 'STAFF', dto)
      assert.match(detail, /<td>0<\/td>/)
      assert.doesNotMatch(
        detail,
        /Sổ sách|Chênh lệch|Giá trị|98765|98[.,]765|123[.,]?456[.,]?789/,
      )
    }
    const manager = render(Detail, 'BRANCH_MANAGER')
    assert.match(manager, /Sổ sách/)
    assert.match(manager, /98765/)
    assert.doesNotMatch(manager, /Giá trị chênh lệch|123[.,]?456[.,]?789/)
    const owner = render(Detail, 'OWNER')
    assert.match(owner, /Giá trị chênh lệch/)
    assert.match(owner, /123[.,]456[.,]789/)
  } finally {
    await server.close()
  }
})
