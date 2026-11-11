import { Link } from 'react-router-dom'
import { useInventoryData } from '../inventory/api'
import { InventoryNotice } from '../inventory/components'
import type { Page, StockSummary } from '../inventory/types'
import type { CountList } from '../inventory/countApi'
import type { ReplenishmentRow } from '../transfers/types'
import { dateTime, money, number, today } from '../inventory/presentation'
import { useOwnerDebtTotals, useOwnerSalesTotals } from './ownerMetrics'
import './operations.css'
type Store = { id: number; storeName: string; status: string }
type Pending = {
  id: number
  createdAt?: string
  arrivedAt?: string
  storeName?: string
}
const currency = (value: number | undefined) =>
  value === undefined ? '—' : money.format(value).replace('₫', 'đ')
const quantity = (value: number | undefined, unit: string) =>
  value === undefined ? '—' : number.format(value) + ' ' + unit

export default function OwnerMonitoring() {
  const currentDay = today()
  const previousDay = new Date(currentDay + 'T00:00:00Z')
  previousDay.setUTCDate(previousDay.getUTCDate() - 1)
  const currentSales = useOwnerSalesTotals(currentDay)
  const previousSales = useOwnerSalesTotals(
    previousDay.toISOString().slice(0, 10),
  )
  const debt = useOwnerDebtTotals()
  const counts = useInventoryData<CountList>('/stock-counts', {
      status: 'AWAITING_APPROVAL',
      page: 0,
      size: 5,
    }),
    excess = useInventoryData<Page<Pending>>('/goods-receipt-notes', {
      excessAwaiting: true,
      page: 0,
      size: 5,
    }),
    replenishments = useInventoryData<Page<ReplenishmentRow>>(
      '/replenishment-requests',
      { status: 'AWAITING_COORDINATION', page: 0, size: 5 },
    ),
    summary = useInventoryData<StockSummary>('/inventory/stock/summary'),
    lots = useInventoryData<{ page: Page<unknown> }>('/inventory/lots', {
      tab: 'NEAR_EXPIRY',
      page: 0,
      size: 1,
    }),
    stores = useInventoryData<Store[]>('/stores')
  const work = [
    ...(counts.data?.counts.items ?? []).map((r) => ({
      key: 'k' + r.id,
      code: 'KK-' + String(r.id).padStart(4, '0'),
      at: r.createdAt,
      store: r.storeName,
      task: 'Duyệt chênh lệch kiểm kê',
      href: '/stock-counts/' + r.id,
    })),
    ...(excess.data?.items ?? []).map((r) => ({
      key: 'g' + r.id,
      code: 'PN-' + String(r.id).padStart(4, '0'),
      at: r.arrivedAt ?? '',
      store: r.storeName,
      task: 'Quyết định hàng thừa',
      href: '/goods-receipt-notes/' + r.id,
    })),
    ...(replenishments.data?.items ?? []).map((r) => ({
      key: 'y' + r.id,
      code: 'YBS-' + String(r.id).padStart(4, '0'),
      at: r.createdAt ?? '',
      store: r.storeName,
      task: 'Điều phối bổ sung hàng',
      href: '/replenishment-requests/' + r.id + '/coordinate',
    })),
  ]
    .sort((a, b) => a.at.localeCompare(b.at))
    .slice(0, 5)
  const loading = counts.loading || excess.loading || replenishments.loading,
    error = counts.error || excess.error || replenishments.error
  return (
    <div className="owner-monitoring">
      <section className="operation-work-panel">
        <header>
          <h2>Việc cần xử lý</h2>
        </header>
        <InventoryNotice loading={loading} error={error} />
        <div className="stock-table-scroll">
          <table className="stock-table">
            <thead>
              <tr>
                <th>Chứng từ</th>
                <th>Việc</th>
                <th>Ngày tạo / nhận</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {work.map((w) => (
                <tr key={w.key}>
                  <td>
                    <Link to={w.href}>{w.code}</Link>
                    <small>{w.store}</small>
                  </td>
                  <td>{w.task}</td>
                  <td>{dateTime(w.at)}</td>
                  <td>
                    <Link className="operation-action" to={w.href}>
                      Xử lý
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && !error && !work.length && (
          <p className="stock-empty">Không có việc nào đang chờ bạn.</p>
        )}
        <p className="operation-work-note">
          Mở danh sách nghiệp vụ để xem toàn bộ công việc.
        </p>
      </section>
      <section className="operation-work-panel">
        <header>
          <h2>Số liệu toàn chuỗi</h2>
        </header>
        <InventoryNotice
          loading={
            currentSales.loading ||
            debt.loading ||
            summary.loading ||
            lots.loading
          }
          error={
            currentSales.error || debt.error || summary.error || lots.error
          }
        />
        <div className="owner-chain-metrics">
          {[
            [
              'Doanh số hôm nay',
              currency(currentSales.data?.total),
              `/sales-orders?tab=COMPLETED&from=${currentDay}&to=${currentDay}`,
            ],
            ['Phải thu', currency(debt.data?.debt), '/receivables'],
            [
              'Nợ quá hạn',
              currency(debt.data?.overdueDebt),
              '/receivables?overdueOnly=true',
            ],
            [
              'Tồn dưới ngưỡng',
              quantity(summary.data?.lowStock, 'dòng'),
              '/inventory?view=lowStock',
            ],
            [
              'Lô sắp hết hạn',
              quantity(lots.data?.page.totalItems, 'lô'),
              '/inventory/lots?tab=NEAR_EXPIRY',
            ],
          ].map(([label, value, href]) => (
            <Link key={label} to={href}>
              <span>{label}</span>
              <strong>{value}</strong>
            </Link>
          ))}
        </div>
      </section>
      <section className="operation-work-panel">
        <header>
          <h2>So sánh cửa hàng</h2>
        </header>
        <InventoryNotice
          loading={
            stores.loading || currentSales.loading || previousSales.loading
          }
          error={stores.error || currentSales.error || previousSales.error}
        />
        <div className="stock-table-scroll">
          <table className="stock-table">
            <thead>
              <tr>
                <th>Cửa hàng</th>
                <th>Doanh số hôm nay</th>
                <th>Hôm qua</th>
                <th>Phải thu</th>
                <th>Quá hạn</th>
                <th>Tồn dưới ngưỡng</th>
              </tr>
            </thead>
            <tbody>
              {stores.data
                ?.filter((s) => s.status === 'ACTIVE')
                .map((s) => (
                  <StoreLine
                    key={s.id}
                    store={s}
                    currentSales={currentSales.data?.stores}
                    previousSales={previousSales.data?.stores}
                  />
                ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
function StoreLine({
  store,
  currentSales,
  previousSales,
}: {
  store: Store
  currentSales?: Map<number, number>
  previousSales?: Map<number, number>
}) {
  const debt = useOwnerDebtTotals(store.id)
  const stock = useInventoryData<StockSummary>('/inventory/stock/summary', {
    storeId: store.id,
  })
  const debtCell = (value: number | undefined) =>
    debt.loading ? 'Đang tải…' : currency(value)
  return (
    <tr>
      <td>{store.storeName}</td>
      <td>{currency(currentSales && (currentSales.get(store.id) ?? 0))}</td>
      <td>{currency(previousSales && (previousSales.get(store.id) ?? 0))}</td>
      <td title={debt.error}>{debtCell(debt.data?.debt)}</td>
      <td title={debt.error}>{debtCell(debt.data?.overdueDebt)}</td>
      <td title={stock.error}>
        {stock.loading ? 'Đang tải…' : quantity(stock.data?.lowStock, 'dòng')}
      </td>
    </tr>
  )
}
