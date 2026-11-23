/**
 * File: modules/sales/SalesTabsWorkspace.tsx
 * Loại: THÀNH PHẦN — màn tạo đơn bán nhiều tab (route /sales-orders/new).
 * Công dụng: giữ thanh "Đơn 1 | Đơn 2 | +" phía trên form; mỗi tab là một nháp riêng.
 * Owner chọn cửa hàng trước; nháp mở từ URL (?productId, ?customerId, ?quantity) thành một tab mới,
 * sau đó URL được thay bằng /sales-orders/new để F5 không tạo thêm tab.
 */
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../shared/hooks/useAuth'
import PageHeader from '../../shared/ui/PageHeader'
import type { Customer } from '../customers/types'
import { useInventoryScope } from '../inventory/api'
import { SalesOrderFormView, type SalesProduct } from './SalesOrderForm'
import SalesTabBar from './SalesTabBar'
import { draftFromPrefill, lastStoreKey, MAX_TABS } from './salesTabsStore'
import { useSalesTabs } from './useSalesTabs'

const FULL_NOTICE = `Đã đủ ${MAX_TABS} đơn. Đóng bớt một đơn để mở đơn mới.`

export type TabsPrefill = {
  product?: SalesProduct
  quantity?: number
  customer?: Customer
}

function readLastStore(userId: number | undefined): string {
  if (userId === undefined) return ''
  try {
    return window.localStorage.getItem(lastStoreKey(userId)) ?? ''
  } catch {
    return ''
  }
}

function writeLastStore(userId: number | undefined, value: string) {
  if (userId === undefined) return
  try {
    window.localStorage.setItem(lastStoreKey(userId), value)
  } catch {
    /* Storage unavailable: the choice lasts for this page only. */
  }
}

export default function SalesTabsWorkspace({
  prefill,
}: {
  prefill?: TabsPrefill
}) {
  const { user } = useAuth()
  const scope = useInventoryScope()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const seeded = useRef(false)
  const [ownerStore, setOwnerStore] = useState(
    () => params.get('storeId') || readLastStore(user?.id),
  )

  const storeId = scope.owner ? ownerStore : (user?.storeId ?? '')
  const tabs = useSalesTabs(user?.id, storeId)

  // Nút "+" khóa khi đủ 10 đơn, nên thông báo đầy được suy ra từ số tab (không cần state).
  const full = tabs.state.tabs.length >= MAX_TABS

  // Nháp từ URL: mở đúng một lần khi dữ liệu đã sẵn sàng và đã có cửa hàng; rồi bỏ tham số khỏi URL.
  useEffect(() => {
    if (!prefill || seeded.current || !tabs.storeReady) return
    seeded.current = true
    // Nếu đã đủ 10 đơn thì tab không mở được; thông báo đầy hiện ở thanh tab.
    tabs.open(draftFromPrefill({ warehouse: String(storeId), ...prefill }))
    // Cửa hàng đến từ ?storeId=: ghi nhớ luôn để F5 sau khi bỏ tham số vẫn mở đúng cửa hàng.
    if (scope.owner) writeLastStore(user?.id, String(storeId))
    navigate('/sales-orders/new', { replace: true })
  }, [prefill, storeId, tabs, navigate, scope.owner, user?.id])

  const storeSelect = scope.owner ? (
    <label className="pos-store-select">
      <span className="sr-only">Cửa hàng bán</span>
      <select
        aria-label="Cửa hàng bán"
        value={ownerStore}
        onChange={(event) => {
          setOwnerStore(event.target.value)
          writeLastStore(user?.id, event.target.value)
        }}
      >
        <option value="">Chọn cửa hàng bán *</option>
        {scope.stores.map((store) => (
          <option key={store.id} value={store.id}>
            {store.storeName}
          </option>
        ))}
      </select>
    </label>
  ) : null

  if (!tabs.storeReady)
    return (
      <main className="inventory-workspace sales-workspace pos-page">
        <PageHeader
          title="Tạo đơn bán"
        />
        {storeSelect}
        <p role="status">Chọn cửa hàng để bắt đầu bán.</p>
      </main>
    )

  const activeId = tabs.active.id
  // Kho của nháp luôn lấy theo cửa hàng của bộ tab (storeId), không theo kho lưu trong tab cũ:
  // tab khôi phục sau F5 hay đổi cửa hàng vẫn bán đúng kho đang chọn.
  const warehouse = String(storeId)
  return (
    <SalesOrderFormView
      key={storeId + ':' + activeId}
      initialDraft={{ ...tabs.active.draft, warehouse }}
      onDraftChange={(draft) => tabs.update(activeId, { ...draft, warehouse })}
      onSubmitted={() => tabs.close(activeId)}
      onDiscard={() => tabs.close(activeId)}
      storeLocked={scope.owner}
      tabBar={
        <>
          {storeSelect}
          <SalesTabBar
            state={tabs.state}
            onSelect={tabs.select}
            onOpen={() => {
              tabs.open()
            }}
            onClose={tabs.close}
          />
          {full && (
            <p className="pos-blocker" role="status">
              {FULL_NOTICE}
            </p>
          )}
        </>
      }
    />
  )
}
