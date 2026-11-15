import { formatMoney } from '../../shared/utils/format'
import { useInventoryData } from '../inventory/api'
import { InventoryNotice } from '../inventory/components'
import './today-collections.css'

type SalesSummary = {
  from: string
  to: string
  stores: {
    storeId: number
    storeName: string
    figures: { totalCollected: number }
  }[]
}

function localToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date())
}

export default function TodayCollections() {
  const today = localToday()
  const summary = useInventoryData<SalesSummary>('/sales-orders/summary', {
    from: today,
    to: today,
  })

  return (
    <section className="today-collections" aria-labelledby="today-collections-title">
      <header>
        <div>
          <h2 id="today-collections-title">Tiền thu hôm nay</h2>
          <p>
            Tổng tiền bán đã thu và thu nợ đã xác nhận. Chưa tách tiền mặt và
            chuyển khoản.
          </p>
        </div>
        <time dateTime={today}>{today.split('-').reverse().join('/')}</time>
      </header>
      <InventoryNotice
        loading={summary.loading}
        error={summary.error}
        onRetry={summary.retry}
      />
      {summary.data && (
        <div className="today-collections-list">
          {summary.data.stores.map((store) => (
            <div key={store.storeId}>
              <span>{store.storeName}</span>
              <strong>{formatMoney(store.figures.totalCollected)}</strong>
            </div>
          ))}
          {!summary.data.stores.length && <p>Chưa có số liệu cửa hàng hôm nay.</p>}
        </div>
      )}
    </section>
  )
}
