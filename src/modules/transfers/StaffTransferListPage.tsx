import { Link } from 'react-router-dom'
import { useInventoryData, useInventoryScope } from '../inventory/api'
import { InventoryNotice, Pagination } from '../inventory/components'
import type { Page } from '../inventory/types'
import { states, type Transfer, type Preparation, type Receipt } from './types'
import './transfers.css'
export default function StaffTransferListPage() {
  const scope = useInventoryScope(),
    page = Math.max(0, Number(scope.params.get('page')) || 0),
    done = scope.params.get('status') === 'CLOSED',
    r = useInventoryData<Page<Transfer>>('/transfer-orders', {
      page,
      size: 20,
      status: done ? 'CLOSED' : undefined,
    })
  return (
    <main className="dashboard-content tf-page tf-staff-list">
      <header>
        <h1>Lệnh điều chuyển</h1>
        <nav>
          <Link to="/dashboard">Trang chủ</Link> › Điều chuyển › Lệnh điều
          chuyển
        </nav>
      </header>
      <section>
        <h2>Việc điều chuyển của tôi</h2>
        <div className="tf-list-controls">
          <div className="tf-status-tabs">
            <button
              aria-pressed={!done}
              onClick={() => scope.filter({ status: '' })}
            >
              Việc của tôi
            </button>
            <button
              aria-pressed={done}
              onClick={() => scope.filter({ status: 'CLOSED' })}
            >
              Đã đóng
            </button>
          </div>
        </div>
        <InventoryNotice loading={r.loading} error={r.error} />
        <div className="tf-table">
          <table>
            <thead>
              <tr>
                <th>Lệnh</th>
                <th>Việc của tôi</th>
                <th>Từ kho</th>
                <th>Tới kho</th>
                <th>Hàng</th>
                <th>Kết quả của tôi</th>
                <th>Cần làm</th>
              </tr>
            </thead>
            <tbody>
              {r.data?.items.map((row) => (
                <StaffRow key={row.id} row={row} />
              ))}
            </tbody>
          </table>
        </div>
        {r.data && !r.data.items.length && (
          <p className="tf-empty">
            Chưa có việc điều chuyển được giao trong mục này.
          </p>
        )}
        <Pagination
          total={r.data?.totalItems ?? 0}
          page={page}
          loading={r.loading}
          onPage={(n) =>
            scope.setParams((p) => {
              const next = new URLSearchParams(p)
              next.set('page', String(n))
              return next
            })
          }
        />
      </section>
    </main>
  )
}
function StaffRow({ row }: { row: Transfer }) {
  const { user } = useInventoryScope(),
    source = user?.storeId === row.sourceStoreId,
    detail = useInventoryData<Transfer>('/transfer-orders/' + row.id),
    prep = useInventoryData<Preparation>(
      '/transfer-orders/' + row.id + '/preparation',
      {},
      0,
      source,
    ),
    mine = prep.data?.preparer?.id === user?.id,
    closed = row.status === 'CLOSED'
  return (
    <tr>
      <td>
        <Link to={'/transfer-orders/' + row.id}>
          DC-{String(row.id).padStart(4, '0')}
        </Link>
      </td>
      <td>
        {prep.loading
          ? 'Đang tải…'
          : mine
            ? 'Chuẩn bị hàng'
            : source
              ? 'Xem công việc'
              : 'Nhận hàng'}
      </td>
      <td>{row.sourceStoreName}</td>
      <td>{row.destStoreName}</td>
      <td>
        {row.lineCount} mã · {row.totalPlannedQty} sản phẩm
      </td>
      <td>
        <span className="tf-badge">
          {closed
            ? 'Lệnh đã đóng'
            : mine
              ? prep.data?.preparer?.taskStatus === 'RESULT_SUBMITTED'
                ? 'Đã gửi, chờ xác nhận xuất'
                : 'Chưa gửi kết quả'
              : (states[row.status] ?? row.status)}
        </span>
      </td>
      <td>
        {mine && prep.data?.canRecord ? (
          <Link
            className="tf-row-action"
            to={'/transfer-orders/' + row.id + '/prepare'}
          >
            {prep.data.preparer?.taskStatus === 'RESULT_SUBMITTED'
              ? 'Sửa số đã chuẩn bị'
              : 'Ghi số đã chuẩn bị'}
          </Link>
        ) : !closed && detail.data?.receipts.length ? (
          <div>
            {detail.data.receipts
              .filter((r) => r.status !== 'CONFIRMED')
              .map((r) => (
                <StaffReceipt key={r.id} orderId={row.id} receiptId={r.id} />
              ))}
          </div>
        ) : (
          <Link to={'/transfer-orders/' + row.id}>Xem chi tiết →</Link>
        )}
      </td>
    </tr>
  )
}

function StaffReceipt({
  orderId,
  receiptId,
}: {
  orderId: number
  receiptId: number
}) {
  const r = useInventoryData<Receipt>(
    '/transfer-orders/' + orderId + '/receipts/' + receiptId,
  )
  if (!r.data) return null
  const editable = ['AWAITING_INSPECTION', 'AWAITING_RECOUNT'].includes(
    r.data.status,
  )
  return (
    <Link
      className="tf-transfer-ref"
      to={'/transfer-orders/' + orderId + '/receipts/' + receiptId}
    >
      {editable ? 'Ghi kết quả nhận' : 'Xem kết quả nhận'} #{receiptId}
      <small>{states[r.data.status] ?? r.data.status}</small>
    </Link>
  )
}
