import { Link } from 'react-router-dom'
import { useInventoryData } from '../inventory/api'
import { InventoryNotice } from '../inventory/components'
import type { Page, StockSummary } from '../inventory/types'
import type { CountList } from '../inventory/countApi'
import { dateTime } from '../inventory/presentation'
import './operations.css'
type Store = { id: number; storeName: string; status: string }
type Pending = {
  id: number
  createdAt?: string
  arrivedAt?: string
  requestingStoreName?: string
  storeName?: string
}
export default function OwnerMonitoring() {
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
    replenishments = useInventoryData<Page<Pending>>(
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
      store: r.requestingStoreName,
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
                      Xử lý →
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
          loading={summary.loading || lots.loading}
          error={summary.error || lots.error}
        />
        <div className="owner-chain-metrics">
          {[
            ['Doanh số hôm nay', '—', ''],
            ['Phải thu', '—', '/receivables'],
            ['Nợ quá hạn', '—', '/receivables?overdueOnly=true'],
            [
              'Tồn dưới ngưỡng',
              summary.data?.lowStock == null
                ? '—'
                : summary.data.lowStock + ' dòng',
              '/inventory?view=lowStock',
            ],
            [
              'Lô sắp hết hạn',
              lots.data?.page.totalItems == null
                ? '—'
                : lots.data.page.totalItems + ' lô',
              '/inventory/lots?tab=NEAR_EXPIRY',
            ],
          ].map(([label, value, href]) => (
            <div key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
              {href && <Link to={href}>Xem chi tiết →</Link>}
            </div>
          ))}
        </div>
      </section>
      <section className="operation-work-panel">
        <header>
          <h2>So sánh cửa hàng</h2>
        </header>
        <InventoryNotice loading={stores.loading} error={stores.error} />
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
                  <StoreLine key={s.id} store={s} />
                ))}
            </tbody>
          </table>
        </div>
        <p className="operation-work-note">
          Các chỉ số chưa có dữ liệu được hiển thị bằng dấu —.
        </p>
      </section>
    </div>
  )
}
function StoreLine({ store }: { store: Store }) {
  const r = useInventoryData<StockSummary>('/inventory/stock/summary', {
    storeId: store.id,
  })
  return (
    <tr>
      <td>{store.storeName}</td>
      <td>—</td>
      <td>—</td>
      <td>
        <Link to={'/receivables?storeId=' + store.id}>Xem công nợ</Link>
      </td>
      <td>—</td>
      <td title={r.error}>
        <Link to={'/inventory?view=lowStock&storeId=' + store.id}>
          {r.data?.lowStock ?? '—'}
        </Link>
      </td>
    </tr>
  )
}
