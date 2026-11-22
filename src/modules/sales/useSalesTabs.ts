/**
 * File: modules/sales/useSalesTabs.ts
 * Loại: HOOK — nối logic thuần salesTabsStore với React và localStorage.
 * Công dụng: giữ các tab đơn bán của người dùng theo từng cửa hàng; mỗi thay đổi được lưu ngay.
 * Khi đổi cửa hàng hoặc người dùng, tab được nạp lại từ khóa tương ứng nên không hiện tab của cửa hàng cũ.
 */
import { useMemo, useState } from 'react'
import {
  activeTab,
  closeTab,
  loadTabs,
  MAX_TABS,
  openTab,
  saveTabs,
  selectTab,
  storageKey,
  updateDraft,
  type SalesTab,
  type SalesTabsState,
  type StorageLike,
  type TabDraft,
} from './salesTabsStore'

function browserStorage(): StorageLike | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

type Loaded = { key: string | null; state: SalesTabsState }

export function useSalesTabs(
  userId: number | undefined,
  storeId: number | string | null | undefined,
): {
  state: SalesTabsState
  active: SalesTab
  storeReady: boolean
  open(draft?: TabDraft): boolean
  close(id: string): void
  select(id: string): void
  update(id: string, draft: TabDraft): void
} {
  const warehouse =
    storeId === null || storeId === undefined ? '' : String(storeId)
  const storeReady = warehouse !== ''
  const key =
    userId !== undefined && storeReady ? storageKey(userId, warehouse) : null

  const storage = useMemo(() => browserStorage(), [])
  const [loaded, setLoaded] = useState<Loaded>(() => ({
    key,
    state: loadTabs(storage, key, warehouse),
  }))

  // Đổi người dùng hoặc cửa hàng: nạp lại ngay trong lần render này,
  // để không bao giờ hiện một frame tab của khóa cũ.
  let current = loaded
  if (loaded.key !== key) {
    current = { key, state: loadTabs(storage, key, warehouse) }
    setLoaded(current)
  }
  const state = current.state

  // Hàm cập nhật phải thuần và lưu phải idempotent: StrictMode có thể chạy updater 2 lần,
  // hai lần cho cùng next nên ghi trùng không đổi gì.
  const apply = (transform: (prev: SalesTabsState) => SalesTabsState) =>
    setLoaded((prev) => {
      if (prev.key !== key) return prev
      const next = transform(prev.state)
      if (next === prev.state) return prev
      saveTabs(storage, key, next)
      return { key, state: next }
    })

  const open = (draft?: TabDraft): boolean => {
    if (state.tabs.length >= MAX_TABS) return false
    apply((prev) => openTab(prev, draft).state)
    return true
  }

  const close = (id: string) => apply((prev) => closeTab(prev, id))

  const select = (id: string) =>
    apply((prev) => (prev.activeId === id ? prev : selectTab(prev, id)))

  const update = (id: string, draft: TabDraft) =>
    apply((prev) => {
      const tab = prev.tabs.find((item) => item.id === id)
      if (!tab || tab.draft === draft) return prev
      return updateDraft(prev, id, draft)
    })

  return {
    state,
    active: activeTab(state),
    storeReady,
    open,
    close,
    select,
    update,
  }
}
