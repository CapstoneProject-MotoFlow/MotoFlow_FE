/**
 * File: modules/sales/SalesTabBar.tsx
 * Loại: THÀNH PHẦN — thanh tab "Đơn 1, Đơn 2, ..." trên màn tạo đơn POS.
 * Công dụng: chọn, thêm (tối đa 10 đơn) và đóng đơn. Đơn có dữ liệu chưa gửi phải xác nhận trước khi đóng.
 */
import { useState } from 'react'
import ConfirmDialog from '../../shared/ui/ConfirmDialog'
import {
  isTabDirty,
  MAX_TABS,
  tabLabel,
  type SalesTab,
  type SalesTabsState,
} from './salesTabsStore'

export default function SalesTabBar({
  state,
  onSelect,
  onOpen,
  onClose,
}: {
  state: SalesTabsState
  onSelect(id: string): void
  onOpen(): void
  onClose(id: string): void
}) {
  const [confirming, setConfirming] = useState<SalesTab | null>(null)
  const full = state.tabs.length >= MAX_TABS

  const requestClose = (tab: SalesTab) => {
    if (isTabDirty(tab)) setConfirming(tab)
    else onClose(tab.id)
  }

  return (
    <>
      <div className="pos-tabs" role="group" aria-label="Các đơn đang bán">
        {state.tabs.map((tab) => {
          const active = tab.id === state.activeId
          const label = tabLabel(tab)
          return (
            <span key={tab.id} className="pos-tab-item">
              <button
                type="button"
                aria-pressed={active}
                className={'pos-tab' + (active ? ' pos-tab--active' : '')}
                onClick={() => onSelect(tab.id)}
              >
                {label}
              </button>
              <button
                type="button"
                className="pos-tab-close"
                aria-label={'Đóng ' + label}
                onClick={() => requestClose(tab)}
              >
                ×
              </button>
            </span>
          )
        })}
        <button
          type="button"
          className="pos-tab-add"
          aria-label="Thêm đơn"
          disabled={full}
          title={full ? 'Tối đa ' + MAX_TABS + ' đơn' : 'Thêm đơn mới'}
          onClick={onOpen}
        >
          +
        </button>
      </div>
      {confirming && (
        <ConfirmDialog
          title="Đóng đơn?"
          message={
            tabLabel(confirming) +
            ' đang có dữ liệu chưa gửi. Đóng sẽ mất dữ liệu này.'
          }
          confirmLabel="Đóng đơn"
          cancelLabel="Không"
          danger
          onCancel={() => setConfirming(null)}
          onConfirm={async () => {
            onClose(confirming.id)
            setConfirming(null)
          }}
        />
      )}
    </>
  )
}
