import { Link } from 'react-router-dom'
import { useInventoryData, type Query } from '../inventory/api'
import { InventoryNotice } from '../inventory/components'
import type { Page, StockSummary } from '../inventory/types'
import { dateTime } from '../inventory/presentation'
import {
  purchaseOrderStatusLabels,
  goodsReceiptStatusLabels,
  salesOrderStatusLabels,
  stockCountStatusLabels,
  transferStatusLabels,
} from '../../shared/labels/status'
import { useReceivingTasks } from './useReceivingTasks'
import { receivingWork } from './receivingTaskModel'
import { documentCode } from '../../shared/utils/documentCode'
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
/** Nhãn trạng thái theo loại chứng từ của từng hàng đợi (CONFIRMED của đơn bán khác của phiếu nhập). */
function statesFor(path: string, counts?: boolean): Record<string, string> {
  if (counts || path.startsWith('/stock-counts')) return stockCountStatusLabels
  if (path.startsWith('/goods-receipt-notes')) return goodsReceiptStatusLabels
  if (path.startsWith('/purchase-orders')) return purchaseOrderStatusLabels
  if (path.startsWith('/transfer-orders')) return transferStatusLabels
  return salesOrderStatusLabels
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
        <Link to={href}>Xem tất cả</Link>
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
                          {documentCode(
                            counts || path.startsWith('/stock-counts')
                              ? 'KK'
                              : path.startsWith('/goods-receipt-notes')
                                ? 'PN'
                                : path.startsWith('/purchase-orders')
                                  ? 'YCN'
                                  : path.startsWith('/transfer-orders')
                                    ? 'DC'
                                    : 'SO',
                            id,
                          )}
                        </Link>
                      </td>
                      <td>
                        {row.supplierName ??
                          row.customerName ??
                          row.storeName ??
                          [row.sourceStoreName, row.destStoreName]
                            .filter(Boolean)
                            .join(' đến ')}
                        <small>
                          {dateTime(
                            row.createdAt ??
                              row.arrivedAt ??
                              row.countDate ??
                              '',
                          )}
                        </small>
                      </td>
                      <td>
                        {statesFor(path, counts)[row.status] ?? row.status}
                      </td>
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
/** Việc nhận hàng BM giao cho nhân viên: nhân viên lập phiếu nhập/phiếu nhận khi hàng tới. */
function ReceivingQueue() {
  const r = useReceivingTasks()
  return (
    <section className="operation-work-panel">
      <header>
        <h2>Việc nhận hàng được giao</h2>
        <Link to="/purchase-orders">Xem tất cả</Link>
      </header>
      <InventoryNotice loading={r.loading} />
      {!r.loading && (
        <>
          <div className="stock-table-scroll">
            <table className="stock-table">
              <thead>
                <tr>
                  <th>Việc</th>
                  <th>Chứng từ</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {r.tasks.map((task) => {
                  const row = receivingWork(task)
                  return (
                    <tr key={row.key}>
                      <td>{row.task}</td>
                      <td>
                        {row.code}
                        {row.description && <small>{row.description}</small>}
                      </td>
                      <td>
                        <div className="mf-row-actions">
                          <Link
                            className="mf-btn mf-btn--sm mf-btn--primary"
                            to={row.href}
                          >
                            {row.action}
                          </Link>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {!r.tasks.length && (
            <p className="stock-empty">Chưa có việc nhận hàng được giao.</p>
          )}
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
        <Link to="/inventory">Mở tồn kho</Link>
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
          Dòng tồn chưa bán được{' '}
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
            title="Yêu cầu nhập hàng đang mở"
            path="/purchase-orders"
            href="/purchase-orders"
            params={{ view: 'OPEN' }}
          />
          <Queue
            title="Phiếu nhập gần đây"
            path="/goods-receipt-notes"
            href="/purchase-orders"
          />
          <InventoryAttention />
        </>
      ) : (
        <>
          {role === 'STAFF' && <ReceivingQueue />}
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
