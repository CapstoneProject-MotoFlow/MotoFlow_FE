import { Link } from 'react-router-dom'
import { useInventoryData, type Query } from '../inventory/api'
import { InventoryNotice } from '../inventory/components'
import type { Page, StockSummary } from '../inventory/types'
import { dateTime } from '../inventory/presentation'
import { states as transferStates } from '../transfers/types'
import { salesStates } from '../sales/salesModel'
import { countStateNames } from '../inventory/stockCountModel'
import './operations.css'
type Row = {
  id: number
  status: string
  storeName?: string
  sourceStoreName?: string
  destStoreName?: string
  supplierName?: string
  customerName?: string
  countDate?: string
  createdAt?: string
  arrivedAt?: string
  assigneeName?: string
}
type AssignedReceiptRow = Omit<Row, 'id'> & { goodsReceiptNoteId: number }
const states: Record<string, string> = {
  ...transferStates,
  ...salesStates,
  ...countStateNames,
  AWAITING_INSPECTION: 'Chờ kiểm nhận',
  AWAITING_CONFIRMATION: 'Chờ xác nhận',
  AWAITING_RECOUNT: 'Chờ kiểm lại',
  CONFIRMED: 'Đã xác nhận',
  AWAITING_DELIVERY: 'Chờ giao hàng',
  RECEIVING: 'Đang nhận',
  FULLY_RECEIVED: 'Đã nhận đủ',
  CANCELLED: 'Đã hủy',
}
function Queue({
  title,
  path,
  href,
  params = {},
  counts = false,
}: {
  title: string
  path: string
  href: string
  params?: Query
  counts?: boolean
}) {
  const r = useInventoryData<
      Page<Row | AssignedReceiptRow> | { counts: Page<Row> }
    >(path, {
      ...params,
      page: 0,
      size: 5,
    }),
    page = r.data ? ('counts' in r.data ? r.data.counts : r.data) : undefined
  return (
    <section className="operation-work-panel">
      <header>
        <h2>{title}</h2>
        <Link to={href}>Xem tất cả →</Link>
      </header>
      <InventoryNotice loading={r.loading} error={r.error} />
      {page && (
        <>
          <div className="stock-table-scroll">
            <table className="stock-table">
              <thead>
                <tr>
                  <th>Chứng từ</th>
                  <th>Thông tin</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {page.items.map((row) => {
                  const id =
                    'goodsReceiptNoteId' in row
                      ? row.goodsReceiptNoteId
                      : row.id
                  return (
                    <tr key={id}>
                      <td>
                        <Link
                          to={
                            (counts
                              ? '/stock-counts'
                              : path === '/goods-receipt-notes/assigned-to-me'
                                ? '/goods-receipt-notes'
                                : path) +
                            '/' +
                            id
                          }
                        >
                          #{id}
                        </Link>
                      </td>
                      <td>
                        {row.supplierName ??
                          row.customerName ??
                          row.storeName ??
                          [row.sourceStoreName, row.destStoreName]
                            .filter(Boolean)
                            .join(' → ')}
                        <small>
                          {dateTime(
                            row.createdAt ??
                              row.arrivedAt ??
                              row.countDate ??
                              '',
                          )}
                        </small>
                      </td>
                      <td>{states[row.status] ?? row.status}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {!page.items.length && (
            <p className="stock-empty">Chưa có chứng từ phù hợp.</p>
          )}
          <p className="operation-work-note">
            Hiển thị tối đa 5 trên {page.totalItems} chứng từ trong phạm vi được
            xem.
          </p>
        </>
      )}
    </section>
  )
}
export function InventoryAttention() {
  const summary = useInventoryData<StockSummary>('/inventory/stock/summary'),
    lots = useInventoryData<{ page: Page<unknown> }>('/inventory/lots', {
      tab: 'NEAR_EXPIRY',
      page: 0,
      size: 1,
    })
  return (
    <section className="operation-work-panel">
      <header>
        <h2>Tồn cần chú ý</h2>
        <Link to="/inventory">Mở tồn kho →</Link>
      </header>
      <InventoryNotice
        loading={summary.loading || lots.loading}
        error={summary.error || lots.error}
      />
      <div className="operation-work-metrics">
        <Link to="/inventory?view=lowStock">
          Dòng tồn dưới ngưỡng <strong>{summary.data?.lowStock ?? '—'}</strong>
        </Link>
        <Link to="/inventory?view=unavailable">
          Dòng tồn chưa khả dụng{' '}
          <strong>{summary.data?.unavailable ?? '—'}</strong>
        </Link>
        <Link to="/inventory/lots?tab=NEAR_EXPIRY">
          Lô sắp hết hạn <strong>{lots.data?.page.totalItems ?? '—'}</strong>
        </Link>
      </div>
    </section>
  )
}
export default function DashboardWork({
  role,
}: {
  role: 'OWNER' | 'BRANCH_MANAGER' | 'STAFF'
}) {
  return (
    <div className="operation-work-grid">
      {role === 'OWNER' ? (
        <>
          <Queue
            title="Đơn mua đang mở"
            path="/purchase-orders"
            href="/purchase-orders"
            params={{ view: 'OPEN' }}
          />
          <Queue
            title="Lượt nhận hàng gần đây"
            path="/goods-receipt-notes"
            href="/purchase-orders"
          />
          <InventoryAttention />
        </>
      ) : (
        <>
          <Queue
            title="Đơn bán của tôi"
            path="/sales-orders"
            href="/sales-orders"
            params={{ view: 'OPEN' }}
          />
          <Queue
            title={
              role === 'STAFF'
                ? 'Phiếu nhận được giao'
                : 'Lượt nhận chờ xác nhận'
            }
            path={
              role === 'STAFF'
                ? '/goods-receipt-notes/assigned-to-me'
                : '/goods-receipt-notes'
            }
            href="/purchase-orders"
            params={role === 'STAFF' ? {} : { status: 'AWAITING_CONFIRMATION' }}
          />
          <Queue
            title="Điều chuyển trong phạm vi của tôi"
            path="/transfer-orders"
            href="/transfer-orders"
          />
          <Queue
            title="Phiếu kiểm kê của tôi"
            path="/stock-counts"
            href="/stock-counts"
            counts
          />
          {role === 'BRANCH_MANAGER' && <InventoryAttention />}
        </>
      )}
    </div>
  )
}
