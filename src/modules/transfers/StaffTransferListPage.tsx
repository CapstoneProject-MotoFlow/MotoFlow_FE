import { Fragment, useState } from 'react'
import { useOpenTransfers } from './useOpenTransfers'
import { Link } from 'react-router-dom'
import { useInventoryData, useInventoryScope } from '../inventory/api'
import { InventoryNotice, Pagination } from '../inventory/components'
import type { Page } from '../inventory/types'
import { states, type Transfer, type TransferRow, type Preparation } from './types'
import './transfers.css'
export default function StaffTransferListPage() {
  const scope = useInventoryScope(),
    page = Math.max(0, Number(scope.params.get('page')) || 0),
    done = scope.params.get('status') === 'CLOSED',
    base = useInventoryData<Page<TransferRow>>(
      '/transfer-orders',
      {
        page,
        size: 20,
        status: 'CLOSED',
      },
      0,
      done,
    ),
    open = useOpenTransfers({}, page, !done),
    r = done ? base : open
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
function StaffRow({ row }: { row: TransferRow }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <Fragment>
      <tr>
        <td>
          <Link to={'/transfer-orders/' + row.id}>
            DC-{String(row.id).padStart(4, '0')}
          </Link>
        </td>
        <td>
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? 'Thu gọn' : 'Xem việc của tôi'}
          </button>
        </td>
        <td>{row.sourceStoreName}</td>
        <td>{row.destStoreName}</td>
        <td>
          {row.lineCount} mã · {row.totalPlannedQty} sản phẩm
        </td>
        <td>
          <span className="tf-badge">{states[row.status] ?? row.status}</span>
        </td>
        <td>
          <Link to={'/transfer-orders/' + row.id}>Xem chi tiết</Link>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={7}>
            <StaffAssignedDetails row={row} />
          </td>
        </tr>
      )}
    </Fragment>
  )
}
function StaffAssignedDetails({ row }: { row: TransferRow }) {
  const { user } = useInventoryScope(),
    source = user?.storeId === row.sourceStoreId,
    detail = useInventoryData<Transfer>('/transfer-orders/' + row.id),
    prep = useInventoryData<Preparation>(
      '/transfer-orders/' + row.id + '/preparation',
      {},
      0,
      source && row.status !== 'CLOSED',
    )
  return (
    <div className="tf-note">
      <InventoryNotice
        loading={detail.loading || prep.loading}
        error={detail.error || prep.error}
      />
      {prep.data?.preparer && prep.data.preparer.id === user?.id && (
        <p>
          {states[prep.data.preparer.taskStatus] ??
            prep.data.preparer.taskStatus}{' '}
          ·{' '}
          <Link
            className="tf-transfer-ref"
            to={'/transfer-orders/' + row.id + '/prepare'}
          >
            {prep.data.canRecord
              ? 'Ghi số đã chuẩn bị'
              : 'Xem kết quả chuẩn bị'}
          </Link>
        </p>
      )}
      {detail.data?.receipts.map((r) => (
        <Link
          className="tf-transfer-ref"
          key={r.id}
          to={`/transfer-orders/${row.id}/receipts/${r.id}`}
        >
          Mở phiếu nhận #{r.id} · {states[r.status] ?? r.status}
        </Link>
      ))}
      {detail.data && !detail.data.receipts.length && (
        <p>Chưa có lượt nhận hàng.</p>
      )}
    </div>
  )
}
