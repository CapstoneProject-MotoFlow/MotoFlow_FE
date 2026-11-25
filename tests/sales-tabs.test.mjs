import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
const { outputText } = ts.transpileModule(
  readFileSync(
    new URL('../src/modules/sales/salesTabsStore.ts', import.meta.url),
    'utf8',
  ),
  {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  },
)
const {
  MAX_TABS,
  activeTab,
  clearAllSalesTabs,
  closeTab,
  draftFromPrefill,
  lastStoreKey,
  createState,
  isTabDirty,
  loadTabs,
  openTab,
  parseTabs,
  saveTabs,
  selectTab,
  storageKey,
  tabLabel,
  updateDraft,
} = await import(
  'data:text/javascript;base64,' + Buffer.from(outputText).toString('base64')
)

class FakeStorage {
  constructor() {
    this.map = new Map()
  }
  get length() {
    return this.map.size
  }
  key(i) {
    return [...this.map.keys()][i] ?? null
  }
  getItem(k) {
    return this.map.has(k) ? this.map.get(k) : null
  }
  setItem(k, v) {
    this.map.set(k, String(v))
  }
  removeItem(k) {
    this.map.delete(k)
  }
}

const product = (id) => ({
  id,
  sku: 'SKU-' + id,
  partName: 'Phụ tùng ' + id,
  baseUnit: 'cái',
  retailPrice: 100000,
  status: 'ACTIVE',
})

const draftWithLine = (productId, quantity) => ({
  warehouse: '',
  type: 'RETAIL',
  discount: '0',
  note: '',
  lines: [{ product: product(productId), quantity }],
})

const stateWithTabs = (count) => {
  let state = createState()
  for (let i = 1; i < count; i++) {
    state = openTab(state).state
  }
  return state
}

const rawTab = (seq, draft = { lines: [] }) => ({
  id: 'tab-' + seq,
  seq,
  draft,
})

const rawState = (tabs, extra = {}) =>
  JSON.stringify({
    v: 1,
    activeId: 'tab-1',
    nextSeq: 2,
    tabs,
    ...extra,
  })

test('createState starts with one active tab labelled Đơn 1', () => {
  const state = createState()
  assert.equal(state.tabs.length, 1)
  assert.equal(state.activeId, state.tabs[0].id)
  assert.equal(tabLabel(activeTab(state)), 'Đơn 1')
})

test('openTab twice gives three tabs labelled Đơn 1..3 with the last one active', () => {
  const first = openTab(createState())
  assert.equal(first.ok, true)
  const second = openTab(first.state)
  assert.equal(second.ok, true)
  const state = second.state
  assert.deepEqual(
    state.tabs.map((tab) => tabLabel(tab)),
    ['Đơn 1', 'Đơn 2', 'Đơn 3'],
  )
  assert.equal(tabLabel(activeTab(state)), 'Đơn 3')
})

test('opening an eleventh tab is refused with reason MAX and leaves the state unchanged', () => {
  const state = stateWithTabs(MAX_TABS)
  assert.equal(state.tabs.length, 10)
  const result = openTab(state)
  assert.equal(result.ok, false)
  assert.equal(result.reason, 'MAX')
  assert.equal(result.state, state)
  assert.equal(result.state.tabs.length, 10)
})

test('closing the active middle tab activates its right neighbour, closing the active rightmost tab activates the left one', () => {
  const state = stateWithTabs(3)
  const middle = selectTab(state, 'tab-2')
  const afterMiddle = closeTab(middle, 'tab-2')
  assert.deepEqual(
    afterMiddle.tabs.map((tab) => tab.id),
    ['tab-1', 'tab-3'],
  )
  assert.equal(afterMiddle.activeId, 'tab-3')

  const rightmost = selectTab(afterMiddle, 'tab-3')
  const afterRightmost = closeTab(rightmost, 'tab-3')
  assert.deepEqual(
    afterRightmost.tabs.map((tab) => tab.id),
    ['tab-1'],
  )
  assert.equal(afterRightmost.activeId, 'tab-1')
})

test('closing a non-active tab removes only that tab and keeps the active one', () => {
  const state = stateWithTabs(3)
  const after = closeTab(state, 'tab-1')
  assert.deepEqual(
    after.tabs.map((tab) => tab.id),
    ['tab-2', 'tab-3'],
  )
  assert.equal(after.activeId, 'tab-3')

  const selected = selectTab(state, 'tab-2')
  const afterSelected = closeTab(selected, 'tab-3')
  assert.equal(afterSelected.activeId, 'tab-2')
  assert.deepEqual(
    afterSelected.tabs.map((tab) => tab.id),
    ['tab-1', 'tab-2'],
  )
})

test('closing an unknown id returns the same state object', () => {
  const state = stateWithTabs(2)
  assert.equal(closeTab(state, 'tab-99'), state)
})

test('closing the only tab leaves one empty tab with a new seq and never reuses 1', () => {
  const state = createState()
  const after = closeTab(state, 'tab-1')
  assert.equal(after.tabs.length, 1)
  assert.equal(tabLabel(activeTab(after)), 'Đơn 2')
  assert.equal(after.tabs[0].id, 'tab-2')
  assert.equal(after.nextSeq, 3)
  assert.deepEqual(after.tabs[0].draft.lines, [])
  assert.equal(after.tabs[0].draft.customer, undefined)

  const again = closeTab(after, 'tab-2')
  assert.equal(tabLabel(activeTab(again)), 'Đơn 3')
})

test('openTab uses the supplied draft when given', () => {
  const state = stateWithTabs(2)
  const draft = draftWithLine(4, 1)
  const result = openTab(state, draft)
  assert.equal(result.ok, true)
  const created = result.state.tabs[result.state.tabs.length - 1]
  assert.deepEqual(created.draft, draft)
  assert.equal(result.state.activeId, created.id)
})

test('openTab without a draft inherits the active tab warehouse', () => {
  const state = createState('WH-A')
  const result = openTab(state)
  assert.equal(result.state.tabs[1].draft.warehouse, 'WH-A')
  assert.equal(result.state.tabs[1].draft.lines.length, 0)
})

test('openTab does not mutate its input state', () => {
  const state = stateWithTabs(3)
  const snapshot = JSON.stringify(state)
  openTab(state, draftWithLine(1, 1))
  assert.equal(JSON.stringify(state), snapshot)
})

test('closeTab of a non-active tab does not mutate its input state', () => {
  const state = stateWithTabs(3)
  assert.notEqual(state.activeId, 'tab-2')
  const snapshot = JSON.stringify(state)
  closeTab(state, 'tab-2')
  assert.equal(JSON.stringify(state), snapshot)
})

test('closeTab of the active tab does not mutate its input state', () => {
  const state = stateWithTabs(3)
  assert.equal(state.activeId, 'tab-3')
  const snapshot = JSON.stringify(state)
  closeTab(state, 'tab-3')
  assert.equal(JSON.stringify(state), snapshot)
})

test('closeTab of the only tab does not mutate its input state', () => {
  const state = createState()
  const snapshot = JSON.stringify(state)
  closeTab(state, 'tab-1')
  assert.equal(JSON.stringify(state), snapshot)
})

test('updateDraft changes only the target tab and does not mutate the input state', () => {
  const state = stateWithTabs(3)
  const before = JSON.parse(JSON.stringify(state))
  const updated = updateDraft(state, 'tab-2', draftWithLine(7, 2))

  assert.deepEqual(state, before)
  assert.deepEqual(updated.tabs[0], state.tabs[0])
  assert.deepEqual(updated.tabs[2], state.tabs[2])
  assert.equal(updated.tabs[1].draft.lines.length, 1)
  assert.equal(updated.tabs[1].draft.lines[0].quantity, 2)
  assert.equal(updateDraft(state, 'missing', draftWithLine(7, 2)), state)
})

test('isTabDirty is false for an empty tab and true with a line or a customer', () => {
  const empty = createState().tabs[0]
  assert.equal(isTabDirty(empty), false)

  const withLine = { ...empty, draft: draftWithLine(3, 1) }
  assert.equal(isTabDirty(withLine), true)

  const withCustomer = {
    ...empty,
    draft: {
      ...empty.draft,
      customer: {
        id: 9,
        customerName: 'Nguyễn Văn A',
        phone: null,
        creditStatus: 'NONE',
        totalDebt: 0,
      },
    },
  }
  assert.equal(isTabDirty(withCustomer), true)
})

test('isTabDirty counts note and deposit amount but not whitespace-only text', () => {
  const empty = createState().tabs[0]
  const with_ = (patch) => ({ ...empty, draft: { ...empty.draft, ...patch } })

  assert.equal(isTabDirty(with_({ note: 'Giao sớm' })), true)
  assert.equal(isTabDirty(with_({ note: ' \n\t ' })), false)

  const deposit = (amount) => ({
    amount,
    method: 'CASH',
    reference: '',
    expiresOn: '',
    tendered: '',
    verified: true,
  })
  assert.equal(isTabDirty(with_({ deposit: deposit('50000') })), true)
  assert.equal(isTabDirty(with_({ deposit: deposit('  ') })), false)
  assert.equal(isTabDirty(with_({ deposit: deposit('') })), false)
})

test('isTabDirty is true for a wholesale-only tab', () => {
  const empty = createState().tabs[0]
  const wholesale = { ...empty, draft: { ...empty.draft, type: 'WHOLESALE' } }
  assert.equal(isTabDirty(wholesale), true)
})

test('isTabDirty is true for a preorder-only tab', () => {
  const empty = createState().tabs[0]
  const preorder = { ...empty, draft: { ...empty.draft, preorder: true } }
  assert.equal(isTabDirty(preorder), true)
})

test('isTabDirty is true for a tab with only a discount typed in', () => {
  const empty = createState().tabs[0]
  const withDiscount = (discount) => ({
    ...empty,
    draft: { ...empty.draft, discount },
  })
  assert.equal(isTabDirty(withDiscount('5')), true)
  assert.equal(isTabDirty(withDiscount('0.5')), true)
  assert.equal(isTabDirty(withDiscount('0')), false)
  assert.equal(isTabDirty(withDiscount(' 0 ')), false)
  assert.equal(isTabDirty(withDiscount('')), false)
  assert.equal(isTabDirty(withDiscount('   ')), false)
})

test('save then load with the same key restores the exact state (F5)', () => {
  const storage = new FakeStorage()
  const key = storageKey(7, 3)
  let state = stateWithTabs(2)
  state = updateDraft(state, 'tab-2', {
    ...draftWithLine(5, 4),
    customer: {
      id: 11,
      customerName: 'Trần Thị B',
      phone: '0900000000',
      creditStatus: 'OK',
      totalDebt: 150000,
    },
    note: 'Giao buổi sáng',
    deposit: {
      amount: '50000',
      method: 'BANK_TRANSFER',
      reference: 'REF-1',
      expiresOn: '2026-12-01',
      tendered: '',
      verified: false,
    },
    lines: [
      {
        product: product(5),
        quantity: 4,
        nowQty: 1,
      },
    ],
  })
  saveTabs(storage, key, state)
  assert.deepEqual(loadTabs(storage, key), state)
})

test('a different userId or storeId loads a fresh state', () => {
  const storage = new FakeStorage()
  const state = stateWithTabs(3)
  saveTabs(storage, storageKey(7, 3), state)

  assert.deepEqual(loadTabs(storage, storageKey(8, 3)), createState())
  assert.deepEqual(loadTabs(storage, storageKey(7, 4)), createState())
  assert.deepEqual(loadTabs(storage, storageKey(7, 3)), state)
})

test('parseTabs repairs or rejects invalid stored values', () => {
  const fresh = createState()

  assert.deepEqual(parseTabs('not json'), fresh)
  assert.deepEqual(parseTabs('[]'), fresh)
  assert.deepEqual(
    parseTabs(
      '{"v":2,"activeId":"tab-1","nextSeq":2,"tabs":[{"id":"tab-1","seq":1,"draft":{"lines":[]}}]}',
    ),
    fresh,
  )
  assert.deepEqual(parseTabs('{"v":1,"tabs":[]}'), fresh)
  assert.deepEqual(parseTabs(null), fresh)
  assert.deepEqual(parseTabs(undefined), fresh)

  const many = {
    v: 1,
    activeId: 'tab-1',
    nextSeq: 13,
    tabs: Array.from({ length: 12 }, (_, i) => rawTab(i + 1)),
  }
  const cut = parseTabs(JSON.stringify(many))
  assert.equal(cut.tabs.length, MAX_TABS)
  assert.equal(cut.activeId, 'tab-1')
  assert.equal(cut.nextSeq, 13)

  const badActive = parseTabs(
    rawState([rawTab(1), rawTab(2)], { activeId: 'nope', nextSeq: 1 }),
  )
  assert.equal(badActive.activeId, 'tab-1')
  assert.equal(badActive.nextSeq, 3)

  const badLine = parseTabs(
    rawState([
      rawTab(1, {
        lines: [
          { quantity: 1 },
          { product: { id: 5, sku: 'A', partName: 'Phụ tùng A' }, quantity: 2 },
        ],
      }),
    ]),
  )
  assert.equal(badLine.tabs[0].draft.lines.length, 1)
  assert.equal(badLine.tabs[0].draft.lines[0].product.id, 5)
  assert.equal(badLine.tabs[0].draft.warehouse, '')
  assert.equal(badLine.tabs[0].draft.type, 'RETAIL')
})

test('parseTabs drops tabs with non-integer or zero seq', () => {
  const parsed = parseTabs(
    rawState([
      { id: 'x', seq: 1.5, draft: { lines: [] } },
      { id: 'y', seq: 0, draft: { lines: [] } },
      rawTab(2),
    ]),
  )
  assert.equal(parsed.tabs.length, 1)
  assert.equal(parsed.tabs[0].seq, 2)
})

test('parseTabs keeps the first tab when two tabs share a seq', () => {
  const parsed = parseTabs(
    rawState([
      rawTab(1, { lines: [], note: 'first' }),
      rawTab(1, { lines: [], note: 'second' }),
    ]),
  )
  assert.equal(parsed.tabs.length, 1)
  assert.equal(parsed.tabs[0].draft.note, 'first')
})

test('parseTabs replaces a stored id with tab-<seq>', () => {
  const parsed = parseTabs(
    rawState([{ id: 'weird', seq: 4, draft: { lines: [] } }], {
      activeId: 'weird',
    }),
  )
  assert.equal(parsed.tabs[0].id, 'tab-4')
  assert.equal(parsed.activeId, 'tab-4')
})

test('parseTabs raises nextSeq above the highest seq', () => {
  const parsed = parseTabs(
    rawState([rawTab(5)], { nextSeq: 2, activeId: 'tab-5' }),
  )
  assert.equal(parsed.nextSeq, 6)
  const next = openTab(parsed)
  assert.equal(next.state.tabs[1].seq, 6)
  assert.equal(next.state.tabs[1].id, 'tab-6')
})

test('parseTabs drops non-object tabs', () => {
  const parsed = parseTabs(rawState([null, 'x', 42, rawTab(1)]))
  assert.equal(parsed.tabs.length, 1)
  assert.equal(parsed.tabs[0].seq, 1)
})

test('parseTabs drops a customer without a numeric id or a string name', () => {
  const parsed = parseTabs(
    rawState([
      rawTab(1, {
        lines: [],
        customer: { id: 'abc', customerName: 'Anh A' },
      }),
    ]),
  )
  assert.equal('customer' in parsed.tabs[0].draft, false)
})

test('parseTabs keeps tendered cash and the verified flag of a deposit', () => {
  const parsed = parseTabs(
    rawState([
      rawTab(1, {
        lines: [],
        deposit: {
          amount: '200000',
          method: 'CASH',
          reference: '',
          expiresOn: '2026-12-01',
          tendered: '250000',
          verified: false,
        },
      }),
      rawTab(2, {
        lines: [],
        deposit: { amount: '1', tendered: 5, verified: 'yes' },
      }),
    ]),
  )
  assert.equal(parsed.tabs[0].draft.deposit.tendered, '250000')
  assert.equal(parsed.tabs[0].draft.deposit.verified, false)
  assert.equal(parsed.tabs[1].draft.deposit.tendered, '')
  assert.equal(parsed.tabs[1].draft.deposit.verified, true)
})

test('parseTabs keeps the bank-transfer part of a split deposit', () => {
  const parsed = parseTabs(
    rawState([
      rawTab(1, {
        lines: [],
        deposit: {
          amount: '300000',
          transfer: '700000',
          method: 'CASH',
          reference: 'FT123',
          expiresOn: '2026-12-01',
          tendered: '',
          verified: true,
        },
      }),
      rawTab(2, { lines: [], deposit: { amount: '1', transfer: 5 } }),
    ]),
  )
  assert.equal(parsed.tabs[0].draft.deposit.transfer, '700000')
  assert.equal(parsed.tabs[0].draft.deposit.reference, 'FT123')
  assert.equal(parsed.tabs[1].draft.deposit.transfer, undefined)
})

test('parseTabs keeps the preorder flag only when it is true', () => {
  const parsed = parseTabs(
    rawState([
      rawTab(1, { lines: [], preorder: true }),
      rawTab(2, { lines: [], preorder: 'yes' }),
      rawTab(3, { lines: [], preorder: false }),
    ]),
  )
  assert.equal(parsed.tabs[0].draft.preorder, true)
  assert.equal('preorder' in parsed.tabs[1].draft, false)
  assert.equal('preorder' in parsed.tabs[2].draft, false)
})

test('parseTabs keeps a well-formed expected ready date so switching tabs does not lose it', () => {
  const parsed = parseTabs(
    rawState([
      rawTab(1, { lines: [], expectedReady: '2026-12-01' }),
      rawTab(2, { lines: [], expectedReady: '01/12/2026' }),
    ]),
  )
  assert.equal(parsed.tabs[0].draft.expectedReady, '2026-12-01')
  assert.equal('expectedReady' in parsed.tabs[1].draft, false)
  assert.equal(isTabDirty(parsed.tabs[0]), true)
})

test('parseTabs drops a customer with a numeric id but no string customerName', () => {
  const missingName = parseTabs(
    rawState([rawTab(1, { lines: [], customer: { id: 7 } })]),
  )
  assert.equal('customer' in missingName.tabs[0].draft, false)

  const numericName = parseTabs(
    rawState([
      rawTab(1, { lines: [], customer: { id: 7, customerName: 123 } }),
    ]),
  )
  assert.equal('customer' in numericName.tabs[0].draft, false)
})

test('parseTabs normalises a bad deposit', () => {
  const parsed = parseTabs(
    rawState([
      rawTab(1, {
        lines: [],
        deposit: { amount: 100, method: 'CARD', reference: null },
      }),
    ]),
  )
  assert.deepEqual(parsed.tabs[0].draft.deposit, {
    amount: '',
    method: 'CASH',
    reference: '',
    expiresOn: '',
    tendered: '',
    verified: true,
  })
})

const p = (id) => ({ id, sku: 'S' + id, partName: 'P' + id })

test('parseTabs drops lines with a negative or fractional quantity and cleans optional fields', () => {
  const parsed = parseTabs(
    rawState([
      rawTab(1, {
        lines: [
          { product: p(1), quantity: -1 },
          { product: p(2), quantity: 1.5 },
          { product: p(3), quantity: 2 },
          { product: p(4), quantity: 1, nowQty: -1 },
          { product: { id: 5, partName: 'x' }, quantity: 1 },
        ],
      }),
    ]),
  )
  assert.deepEqual(
    parsed.tabs[0].draft.lines.map((line) => line.product.id),
    [3, 4],
  )
  assert.deepEqual(parsed.tabs[0].draft.lines[0], {
    product: p(3),
    quantity: 2,
  })
  assert.deepEqual(parsed.tabs[0].draft.lines[1], {
    product: p(4),
    quantity: 1,
  })
})

test('clearAllSalesTabs removes only keys with the sales tabs prefix', () => {
  const storage = new FakeStorage()
  saveTabs(storage, storageKey(1, 1), createState())
  saveTabs(storage, storageKey(2, 2), createState())
  storage.setItem('sales-pick-1-1', 'x')
  storage.setItem('other', 'y')

  clearAllSalesTabs(storage)

  assert.deepEqual([...storage.map.keys()].sort(), ['other', 'sales-pick-1-1'])
})

test('clearAllSalesTabs swallows storage errors from key() and removeItem()', () => {
  class KeyThrows extends FakeStorage {
    key() {
      throw new Error('SecurityError')
    }
  }
  class RemoveThrows extends FakeStorage {
    removeItem() {
      throw new Error('SecurityError')
    }
  }
  const keyThrows = new KeyThrows()
  keyThrows.setItem(storageKey(1, 1), 'x')
  assert.doesNotThrow(() => clearAllSalesTabs(keyThrows))

  const removeThrows = new RemoveThrows()
  removeThrows.setItem(storageKey(1, 1), 'x')
  assert.doesNotThrow(() => clearAllSalesTabs(removeThrows))
  assert.doesNotThrow(() => clearAllSalesTabs(null))
})

test('null key or null storage does nothing and never throws', () => {
  const storage = new FakeStorage()
  const state = stateWithTabs(2)

  assert.doesNotThrow(() => saveTabs(storage, null, state))
  assert.equal(storage.length, 0)
  assert.deepEqual(loadTabs(storage, null), createState())
  assert.deepEqual(loadTabs(null, 'key'), createState())
  assert.doesNotThrow(() => saveTabs(null, 'key', state))

  class ThrowingStorage extends FakeStorage {
    setItem() {
      throw new Error('QuotaExceededError')
    }
    getItem() {
      throw new Error('SecurityError')
    }
  }
  const broken = new ThrowingStorage()
  assert.doesNotThrow(() => saveTabs(broken, storageKey(1, 1), state))
  assert.deepEqual(loadTabs(broken, storageKey(1, 1)), createState())
})

test('lastStoreKey is per user, sits under the sales tabs prefix and is removed with the tabs', () => {
  assert.equal(lastStoreKey(7), 'mf.sales.tabs.v1:7:lastStore')
  assert.notEqual(lastStoreKey(7), lastStoreKey(8))

  const storage = new FakeStorage()
  storage.setItem(lastStoreKey(7), '2')
  storage.setItem(storageKey(7, 2), 'x')
  storage.setItem('other', 'y')
  clearAllSalesTabs(storage)
  assert.deepEqual([...storage.map.keys()], ['other'])
})

test('draftFromPrefill seeds one line from product and quantity in the given warehouse', () => {
  const draft = draftFromPrefill({
    warehouse: '3',
    product: product(9),
    quantity: 4,
  })
  assert.equal(draft.warehouse, '3')
  assert.deepEqual(draft.lines, [{ product: product(9), quantity: 4 }])
  assert.equal(draft.customer, undefined)
  assert.equal(draft.type, 'RETAIL')
  assert.equal(draft.discount, '0')
  assert.equal(draft.note, '')
})

test('draftFromPrefill clamps the quantity to 1..100000 and treats a missing one as 1', () => {
  const quantityOf = (quantity) =>
    draftFromPrefill({ warehouse: '1', product: product(1), quantity }).lines[0]
      .quantity
  assert.equal(quantityOf(0), 1)
  assert.equal(quantityOf(undefined), 1)
  assert.equal(quantityOf(NaN), 1)
  assert.equal(quantityOf(1e9), 100000)
  assert.equal(quantityOf(100000), 100000)
  assert.equal(quantityOf(12), 12)
})

test('draftFromPrefill floors a fractional quantity so the line survives a reload', () => {
  const quantityOf = (quantity) =>
    draftFromPrefill({ warehouse: '1', product: product(1), quantity }).lines[0]
      .quantity
  assert.equal(quantityOf(2.7), 2)
  assert.equal(quantityOf('1.5'), 1)
  assert.equal(quantityOf(0.5), 1)
  const draft = draftFromPrefill({
    warehouse: '1',
    product: product(1),
    quantity: 2.7,
  })
  const reloaded = parseTabs(
    rawState([{ id: 'tab-1', seq: 1, draft }], { activeId: 'tab-1' }),
  )
  assert.equal(reloaded.tabs[0].draft.lines.length, 1)
  assert.equal(reloaded.tabs[0].draft.lines[0].quantity, 2)
})

test('draftFromPrefill without a product has no lines and keeps only five customer fields', () => {
  const customer = {
    id: 5,
    customerName: 'Anh Tư',
    phone: '0900',
    address: 'Quận 1',
    taxCode: '123',
    totalDebt: 50,
    debtAtOwnStore: 10,
    creditStatus: 'OK',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-02',
  }
  const draft = draftFromPrefill({ warehouse: '1', customer, quantity: 3 })
  assert.deepEqual(draft.lines, [])
  assert.deepEqual(draft.customer, {
    id: 5,
    customerName: 'Anh Tư',
    phone: '0900',
    creditStatus: 'OK',
    totalDebt: 50,
  })
  assert.equal(draftFromPrefill({ warehouse: '1' }).customer, undefined)
})
