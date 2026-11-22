import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { createServer } from 'vite'

const product = {
  id: 7,
  sku: 'LG-X-1',
  partName: 'Lọc gió X',
  baseUnit: 'cái',
  retailPrice: 50000,
  status: 'ACTIVE',
  sellableQty: 10,
}

test('the sales form starts from a tab draft and hides the store picker when the store is locked', async () => {
  const server = await createServer({
    configFile: false,
    server: { middlewareMode: true, hmr: false, watch: null },
    appType: 'custom',
  })
  try {
    const { SalesOrderFormView } = await server.ssrLoadModule(
      '/src/modules/sales/SalesOrderForm.tsx',
    )
    const { AuthContext } = await server.ssrLoadModule(
      '/src/shared/hooks/useAuth.tsx',
    )
    const draft = {
      walkin: 'Anh Tư',
      walkPhone: '',
      warehouse: '1',
      type: 'RETAIL',
      discount: '0',
      note: '',
      lines: [{ product, quantity: 2 }],
    }
    const render = (props, role) =>
      renderToStaticMarkup(
        createElement(
          MemoryRouter,
          { initialEntries: ['/sales-orders/new'] },
          createElement(
            AuthContext.Provider,
            { value: { user: { id: 1, role } } },
            createElement(SalesOrderFormView, props),
          ),
        ),
      )

    const html = render({ initialDraft: draft }, 'SELLER')
    assert.match(html, /Lọc gió X/)
    assert.match(html, /value="Anh Tư"/)

    const owner = render({ initialDraft: draft, storeLocked: true }, 'OWNER')
    assert.doesNotMatch(owner, /aria-label="Cửa hàng bán"/)

    const ownerFree = render({ initialDraft: draft }, 'OWNER')
    assert.match(ownerFree, /aria-label="Cửa hàng bán"/)
  } finally {
    await server.close()
  }
})
