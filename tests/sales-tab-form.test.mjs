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
    assert.doesNotMatch(html, /aria-label="Tên khách lẻ"/)
    assert.doesNotMatch(html, /aria-label="Số điện thoại khách lẻ"/)

    const owner = render({ initialDraft: draft, storeLocked: true }, 'OWNER')
    assert.doesNotMatch(owner, /aria-label="Cửa hàng bán"/)

    const ownerFree = render({ initialDraft: draft }, 'OWNER')
    assert.match(ownerFree, /aria-label="Cửa hàng bán"/)
  } finally {
    await server.close()
  }
})

test('a waiting-only wholesale order offers a deposit card, only for a customer with a profile', async () => {
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
    const render = (props) =>
      renderToStaticMarkup(
        createElement(
          MemoryRouter,
          { initialEntries: ['/sales-orders/new'] },
          createElement(
            AuthContext.Provider,
            { value: { user: { id: 1, role: 'SELLER' } } },
            createElement(SalesOrderFormView, props),
          ),
        ),
      )
    const customer = {
      id: 11,
      customerName: 'Trần Thị B',
      phone: '0900000000',
      creditStatus: 'OK',
      totalDebt: 0,
    }
    const outOfStock = { ...product, sellableQty: 0 }
    // PM 22/11: tiền cọc (và Đặt trước) chỉ có ở đơn bán buôn.
    const waiting = {
      warehouse: '1',
      type: 'WHOLESALE',
      discount: '0',
      note: '',
      lines: [{ product: outOfStock, quantity: 2, nowQty: 0 }],
    }

    const withCustomer = render({
      initialDraft: { ...waiting, customer },
    })
    assert.match(withCustomer, /Tiền cọc/)
    assert.match(withCustomer, /Hạn cọc/)
    // PM 22/11: bỏ "Tiền khách đưa", "(không bắt buộc)", ô "Đã nhận đủ" và dòng gợi ý đặt trước.
    assert.doesNotMatch(withCustomer, /Tiền khách đưa/)
    assert.doesNotMatch(withCustomer, /không bắt buộc\)/)
    assert.doesNotMatch(withCustomer, /Đã nhận đủ số tiền này/)
    assert.doesNotMatch(withCustomer, /Khách đặt trước dù cửa hàng còn hàng/)
    assert.match(withCustomer, /aria-pressed="false"[^>]*>Đặt trước</)

    const retail = render({
      initialDraft: { ...waiting, type: 'RETAIL', customer },
    })
    assert.doesNotMatch(retail, /Tiền cọc/)
    assert.doesNotMatch(retail, />Đặt trước</)

    // Khách lẻ không có đơn chờ hàng nên không có phần cọc.
    const walkIn = render({ initialDraft: waiting })
    // Chưa có preview (SSR) nên chưa chặn; việc chặn theo preview được kiểm ở walkInShortLeft.
    assert.doesNotMatch(walkIn, /Khách lẻ chỉ mua được số đang có/)
    assert.doesNotMatch(walkIn, /Tiền cọc/)
    assert.doesNotMatch(walkIn, /Hạn cọc/)

    const takenNow = render({
      initialDraft: {
        ...waiting,
        customer,
        lines: [
          {
            product,
            quantity: 2,
            nowQty: 2,
          },
        ],
      },
    })
    assert.doesNotMatch(takenNow, /Tiền cọc/)
  } finally {
    await server.close()
  }
})

test('a preorder draft sends the whole line to the waiting order even when stock is enough', async () => {
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
    const html = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        { initialEntries: ['/sales-orders/new'] },
        createElement(
          AuthContext.Provider,
          { value: { user: { id: 1, role: 'SELLER' } } },
          createElement(SalesOrderFormView, {
            initialDraft: {
              warehouse: '1',
              type: 'WHOLESALE',
              discount: '0',
              note: '',
              customer: {
                id: 11,
                customerName: 'Trần Thị B',
                phone: '0900000000',
                creditStatus: 'OK',
                totalDebt: 0,
              },
              preorder: true,
              lines: [{ product: { ...product, sellableQty: 10 }, quantity: 2 }],
            },
          }),
        ),
      ),
    )
    assert.match(html, /Tiền cọc/)
    assert.match(html, /Hạn cọc/)
    const tag = html.match(/<input[^>]*aria-label="Lấy ngay LG-X-1"[^>]*>/)
    assert.ok(tag, 'the Lấy ngay input is rendered')
    assert.match(tag[0], /disabled=""/)
    assert.match(tag[0], /value="0"/)
    // Không còn ô "Chờ hàng": phần lấy sau hiện như số, BE tự chờ hàng.
    assert.doesNotMatch(html, /aria-label="Chờ hàng LG-X-1"/)
    assert.doesNotMatch(html, /Chờ phần còn lại/)
  } finally {
    await server.close()
  }
})

