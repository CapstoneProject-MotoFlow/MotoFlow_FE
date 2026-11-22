import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'

test('the tab bar lists open orders and disables adding past the limit', async () => {
  const server = await createServer({
    configFile: false,
    server: { middlewareMode: true, hmr: false, watch: null },
    appType: 'custom',
  })
  try {
    const { default: SalesTabBar } = await server.ssrLoadModule(
      '/src/modules/sales/SalesTabBar.tsx',
    )
    const store = await server.ssrLoadModule(
      '/src/modules/sales/salesTabsStore.ts',
    )
    const render = (state) =>
      renderToStaticMarkup(
        createElement(SalesTabBar, {
          state,
          onSelect() {},
          onOpen() {},
          onClose() {},
        }),
      )
    const addButton = (html) =>
      html.match(/<button[^>]*aria-label="Thêm đơn"[^>]*>/)[0]

    let state = store.createState('1')
    state = store.openTab(state).state
    state = store.openTab(state).state
    const html = render(state)

    assert.equal(html.match(/aria-pressed=/g).length, 3)
    for (const label of ['Đơn 1', 'Đơn 2', 'Đơn 3'])
      assert.match(
        html,
        new RegExp('aria-pressed="(true|false)"[^>]*>' + label + '<'),
      )
    assert.equal(html.match(/aria-pressed="true"/g).length, 1)
    assert.match(html, /aria-pressed="true"[^>]*>Đơn 3</)
    assert.doesNotMatch(addButton(html), / disabled=""/)

    while (state.tabs.length < store.MAX_TABS)
      state = store.openTab(state).state
    const full = render(state)
    assert.equal(full.match(/aria-pressed=/g).length, 10)
    const add = addButton(full)
    assert.match(add, / disabled=""/)
    assert.match(add, /title="Tối đa 10 đơn"/)
  } finally {
    await server.close()
  }
})
