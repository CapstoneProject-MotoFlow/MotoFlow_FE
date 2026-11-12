import { Breadcrumb } from '../../shared/ui/PageHeader'
import type { ReactNode } from 'react'
import { lotStates } from './presentation'
import './inventory.css'

export function InventoryHeader({
  title,
  children,
}: {
  title: string
  children?: ReactNode
}) {
  return (
    <header className="stock-heading">
      <h1>{title}</h1>
      <div className="stock-heading-actions">
        {children}
        {/* Review T8: breadcrumb bấm được, cùng kiểu với các module khác. */}
        <Breadcrumb
          items={[{ label: 'Kho hàng', to: '/inventory' }, { label: title }]}
        />
      </div>
    </header>
  )
}
export function InventoryPanel({
  title,
  children,
  action,
}: {
  title: string
  children: ReactNode
  action?: ReactNode
}) {
  return (
    <section className="stock-panel">
      <header className="stock-panel-heading">
        <h2>{title}</h2>
        {action}
      </header>
      {children}
    </section>
  )
}
export function Pagination({
  total,
  page,
  size = 20,
  loading,
  onPage,
}: {
  total: number
  page: number
  size?: number
  loading: boolean
  onPage: (page: number) => void
}) {
  return (
    <footer className="stock-pagination">
      <span>
        {total
          ? page * size +
            1 +
            '–' +
            Math.min((page + 1) * size, total) +
            ' trên ' +
            total
          : 'Không có kết quả'}
      </span>
      <button
        type="button"
        aria-label="Trang trước"
        disabled={!page || loading}
        onClick={() => onPage(page - 1)}
      >
        ‹
      </button>
      <span>{page + 1}</span>
      <button
        type="button"
        aria-label="Trang sau"
        disabled={loading || (page + 1) * size >= total}
        onClick={() => onPage(page + 1)}
      >
        ›
      </button>
    </footer>
  )
}
export function LotState({ state }: { state: string }) {
  return (
    <span className={'stock-badge stock-badge--' + state.toLowerCase()}>
      {lotStates[state] ?? state}
    </span>
  )
}
export function InventoryNotice({
  loading,
  error,
  onRetry,
}: {
  loading?: boolean
  error?: string
  onRetry?: () => void
}) {
  return (
    <>
      {loading && (
        <p className="stock-notice" role="status">
          Đang tải dữ liệu…
        </p>
      )}
      {error && (
        <p className="stock-notice stock-error">
          <span role="alert">{error}</span>
          {onRetry && (
            <button
              className="stock-notice-retry"
              type="button"
              onClick={onRetry}
            >
              Thử lại
            </button>
          )}
        </p>
      )}
    </>
  )
}
export function WarehouseFilter({
  owner,
  stores,
  value,
  onChange,
}: {
  owner: boolean
  stores: { id: number; storeName: string }[]
  value: string
  onChange: (value: string) => void
}) {
  return owner ? (
    <label className="stock-filter">
      <span>Kho</span>
      <select
        aria-label="Kho"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Mọi kho</option>
        {stores.map((store) => (
          <option key={store.id} value={store.id}>
            {store.storeName}
          </option>
        ))}
      </select>
    </label>
  ) : null
}
