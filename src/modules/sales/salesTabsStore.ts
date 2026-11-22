/**
 * File: modules/sales/salesTabsStore.ts
 * Loại: LOGIC THUẦN — không React, không truy cập window/localStorage trực tiếp.
 * Công dụng: quản lý các tab đơn bán (Đơn 1, Đơn 2, ...) trên màn tạo đơn POS.
 * Mỗi tab giữ một nháp đơn riêng; trạng thái được lưu theo user + cửa hàng
 * và tự khôi phục khi tải lại trang. Bộ nhớ (storage) được truyền vào từ ngoài.
 */
import type { SalesProduct } from './SalesOrderForm'
import type { Customer } from '../customers/types'

export const MAX_TABS = 10
export const TABS_VERSION = 1
export const TABS_KEY_PREFIX = 'mf.sales.tabs.'

export type TabCustomer = Pick<
  Customer,
  'id' | 'customerName' | 'phone' | 'creditStatus' | 'totalDebt'
>
export type TabLine = {
  product: SalesProduct
  quantity: number
  nowQty?: number
  waitForRest?: boolean
}
export type TabDeposit = {
  amount: string
  method: 'CASH' | 'BANK_TRANSFER'
  reference: string
  expiresOn: string
  /** Tiền khách đưa (chỉ tiền mặt, không bắt buộc). */
  tendered: string
  /** Đã nhận đủ số tiền cọc; mặc định true như màn thu tiền. */
  verified: boolean
}
export type TabDraft = {
  customer?: TabCustomer
  walkin: string
  walkPhone: string
  warehouse: string
  type: 'RETAIL' | 'WHOLESALE'
  discount: string
  note: string
  lines: TabLine[]
  deposit?: TabDeposit
  /** Khách đặt trước: cả đơn đi thành đơn chờ hàng, không lấy ngay (chỉ lưu khi bật). */
  preorder?: boolean
}
export type SalesTab = { id: string; seq: number; draft: TabDraft }
export type SalesTabsState = {
  v: 1
  activeId: string
  nextSeq: number
  tabs: SalesTab[]
}
export type StorageLike = {
  getItem(k: string): string | null
  setItem(k: string, v: string): void
  removeItem(k: string): void
  readonly length: number
  key(i: number): string | null
}
export type OpenTabResult =
  | { ok: true; state: SalesTabsState }
  | { ok: false; reason: 'MAX'; state: SalesTabsState }

function tabId(seq: number): string {
  return 'tab-' + seq
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
}

function textOr(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback
}

export function emptyDraft(warehouse = ''): TabDraft {
  return {
    walkin: '',
    walkPhone: '',
    warehouse,
    type: 'RETAIL',
    discount: '0',
    note: '',
    lines: [],
  }
}

export function createState(warehouse = ''): SalesTabsState {
  return {
    v: TABS_VERSION,
    activeId: tabId(1),
    nextSeq: 2,
    tabs: [{ id: tabId(1), seq: 1, draft: emptyDraft(warehouse) }],
  }
}

export function tabLabel(tab: SalesTab): string {
  return 'Đơn ' + tab.seq
}

export function activeTab(state: SalesTabsState): SalesTab {
  return state.tabs.find((tab) => tab.id === state.activeId) ?? state.tabs[0]
}

export function openTab(
  state: SalesTabsState,
  draft?: TabDraft,
): OpenTabResult {
  if (state.tabs.length >= MAX_TABS) {
    return { ok: false, reason: 'MAX', state }
  }
  const seq = state.nextSeq
  const id = tabId(seq)
  const base = draft ?? emptyDraft(activeTab(state).draft.warehouse)
  return {
    ok: true,
    state: {
      ...state,
      activeId: id,
      nextSeq: seq + 1,
      tabs: [...state.tabs, { id, seq, draft: base }],
    },
  }
}

export function closeTab(state: SalesTabsState, id: string): SalesTabsState {
  const index = state.tabs.findIndex((tab) => tab.id === id)
  if (index < 0) return state
  const closed = state.tabs[index]

  if (state.tabs.length === 1) {
    const seq = state.nextSeq
    const freshId = tabId(seq)
    return {
      ...state,
      activeId: freshId,
      nextSeq: seq + 1,
      tabs: [{ id: freshId, seq, draft: emptyDraft(closed.draft.warehouse) }],
    }
  }

  const tabs = state.tabs.filter((tab) => tab.id !== id)
  if (state.activeId !== id) return { ...state, tabs }

  // Active tab closed: right neighbour (now at the same index), else left one.
  const next = index < tabs.length ? tabs[index] : tabs[index - 1]
  return { ...state, activeId: next.id, tabs }
}

export function selectTab(state: SalesTabsState, id: string): SalesTabsState {
  if (!state.tabs.some((tab) => tab.id === id)) return state
  return { ...state, activeId: id }
}

export function updateDraft(
  state: SalesTabsState,
  id: string,
  draft: TabDraft,
): SalesTabsState {
  if (!state.tabs.some((tab) => tab.id === id)) return state
  return {
    ...state,
    tabs: state.tabs.map((tab) => (tab.id === id ? { ...tab, draft } : tab)),
  }
}

export function isTabDirty(tab: SalesTab): boolean {
  const draft = tab.draft
  return (
    draft.lines.length > 0 ||
    draft.customer !== undefined ||
    draft.walkin.trim() !== '' ||
    draft.walkPhone.trim() !== '' ||
    draft.note.trim() !== '' ||
    (draft.deposit?.amount ?? '').trim() !== ''
  )
}

export function storageKey(userId: number, storeId: number | string): string {
  return `${TABS_KEY_PREFIX}v1:${userId}:${storeId}`
}

function sanitizeCustomer(value: unknown): TabCustomer | null {
  if (!isObject(value)) return null
  if (typeof value.id !== 'number' || typeof value.customerName !== 'string') {
    return null
  }
  return {
    id: value.id,
    customerName: value.customerName,
    phone: typeof value.phone === 'string' ? value.phone : null,
    creditStatus: textOr(value.creditStatus, ''),
    totalDebt:
      typeof value.totalDebt === 'number' && Number.isFinite(value.totalDebt)
        ? value.totalDebt
        : 0,
  }
}

function sanitizeDeposit(value: unknown): TabDeposit | null {
  if (!isObject(value)) return null
  return {
    amount: textOr(value.amount, ''),
    method: value.method === 'BANK_TRANSFER' ? 'BANK_TRANSFER' : 'CASH',
    reference: textOr(value.reference, ''),
    expiresOn: textOr(value.expiresOn, ''),
    tendered: textOr(value.tendered, ''),
    verified: typeof value.verified === 'boolean' ? value.verified : true,
  }
}

function sanitizeLine(value: unknown): TabLine | null {
  if (!isObject(value)) return null
  const product = value.product
  if (
    !isObject(product) ||
    typeof product.id !== 'number' ||
    typeof product.sku !== 'string' ||
    typeof product.partName !== 'string'
  )
    return null
  if (!isPositiveInteger(value.quantity)) return null
  const line: TabLine = {
    product: product as unknown as SalesProduct,
    quantity: value.quantity,
  }
  if (isNonNegativeInteger(value.nowQty)) line.nowQty = value.nowQty
  if (typeof value.waitForRest === 'boolean') {
    line.waitForRest = value.waitForRest
  }
  return line
}

function sanitizeDraft(
  raw: Record<string, unknown>,
  warehouse: string,
): TabDraft {
  const base = emptyDraft(warehouse)
  const lines = (raw.lines as unknown[]).flatMap((line) => {
    const clean = sanitizeLine(line)
    return clean ? [clean] : []
  })
  const customer = sanitizeCustomer(raw.customer)
  const deposit = sanitizeDeposit(raw.deposit)
  const preorder = raw.preorder === true
  return {
    ...(customer ? { customer } : {}),
    walkin: textOr(raw.walkin, base.walkin),
    walkPhone: textOr(raw.walkPhone, base.walkPhone),
    warehouse: textOr(raw.warehouse, base.warehouse),
    type: raw.type === 'WHOLESALE' ? 'WHOLESALE' : 'RETAIL',
    discount: textOr(raw.discount, base.discount),
    note: textOr(raw.note, base.note),
    lines,
    ...(deposit ? { deposit } : {}),
    ...(preorder ? { preorder: true } : {}),
  }
}

/** The stored id is ignored: every tab id is derived from its seq. */
function sanitizeTab(value: unknown, warehouse: string): SalesTab | null {
  if (!isObject(value)) return null
  const draft = value.draft
  if (!isPositiveInteger(value.seq)) return null
  if (!isObject(draft) || !Array.isArray(draft.lines)) return null
  return {
    id: tabId(value.seq),
    seq: value.seq,
    draft: sanitizeDraft(draft, warehouse),
  }
}

/** Never throws: any unreadable or invalid stored value yields a fresh state. */
export function parseTabs(
  raw: string | null | undefined,
  warehouse = '',
): SalesTabsState {
  if (raw === null || raw === undefined) return createState(warehouse)

  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return createState(warehouse)
  }
  if (
    !isObject(data) ||
    data.v !== TABS_VERSION ||
    !Array.isArray(data.tabs) ||
    data.tabs.length === 0
  ) {
    return createState(warehouse)
  }

  // Seq numbers are unique per store; the first occurrence wins.
  const seenSeq = new Set<number>()
  const tabs: SalesTab[] = []
  for (const item of data.tabs) {
    if (tabs.length >= MAX_TABS) break
    const tab = sanitizeTab(item, warehouse)
    if (!tab || seenSeq.has(tab.seq)) continue
    seenSeq.add(tab.seq)
    tabs.push(tab)
  }
  if (tabs.length === 0) return createState(warehouse)

  const activeId =
    typeof data.activeId === 'string' &&
    tabs.some((tab) => tab.id === data.activeId)
      ? data.activeId
      : tabs[0].id
  const maxSeq = Math.max(...tabs.map((tab) => tab.seq))
  const storedNext = Number.isInteger(data.nextSeq)
    ? (data.nextSeq as number)
    : 0

  return {
    v: TABS_VERSION,
    activeId,
    nextSeq: Math.max(storedNext, maxSeq + 1),
    tabs,
  }
}

export function loadTabs(
  storage: StorageLike | null | undefined,
  key: string | null,
  warehouse = '',
): SalesTabsState {
  if (!storage || !key) return createState(warehouse)
  let raw: string | null
  try {
    raw = storage.getItem(key)
  } catch {
    return createState(warehouse)
  }
  return parseTabs(raw, warehouse)
}

export function saveTabs(
  storage: StorageLike | null | undefined,
  key: string | null,
  state: SalesTabsState,
): void {
  if (!storage || !key) return
  try {
    storage.setItem(key, JSON.stringify(state))
  } catch {
    // Quota or blocked storage: tabs stay in memory for this session.
  }
}

export function clearAllSalesTabs(
  storage: StorageLike | null | undefined,
): void {
  if (!storage) return
  try {
    const keys: string[] = []
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i)
      if (key !== null && key.startsWith(TABS_KEY_PREFIX)) keys.push(key)
    }
    for (const key of keys) storage.removeItem(key)
  } catch {
    // Storage unavailable: nothing to clear.
  }
}

/** Khóa nhớ cửa hàng Owner đã chọn lần cuối (cùng tiền tố nên clearAllSalesTabs cũng xóa). */
export function lastStoreKey(userId: number): string {
  return `${TABS_KEY_PREFIX}v1:${userId}:lastStore`
}

export function tabCustomerOf(customer: Customer): TabCustomer {
  return {
    id: customer.id,
    customerName: customer.customerName,
    phone: customer.phone,
    creditStatus: customer.creditStatus,
    totalDebt: customer.totalDebt,
  }
}

/** Nháp mở từ URL (?productId, ?customerId, ?quantity): số lượng kẹp trong 1..100.000 như trước. */
export function draftFromPrefill(input: {
  warehouse: string
  product?: SalesProduct
  quantity?: number
  customer?: Customer
}): TabDraft {
  const quantity = Math.min(100000, Math.max(1, input.quantity || 1))
  return {
    ...emptyDraft(input.warehouse),
    ...(input.customer ? { customer: tabCustomerOf(input.customer) } : {}),
    lines: input.product ? [{ product: input.product, quantity }] : [],
  }
}
