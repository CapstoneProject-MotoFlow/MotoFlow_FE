import { useOpenTransfers } from './useOpenTransfers'
import { Link } from 'react-router-dom'
import { useInventoryData, useInventoryScope } from '../inventory/api'
import { InventoryNotice, Pagination } from '../inventory/components'
import type { Page } from '../inventory/types'
import { states, type Transfer, type TransferRow } from './types'
import { useReceivingTasks } from '../operations/useReceivingTasks'
import { receivingCreatePath } from '../operations/receivingTaskModel'
import { documentCode } from '../../shared/utils/documentCode'
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
    r = done ? base : open,
    receiving = useReceivingTasks(['TRANSFER_RECEIVING'], !done)
  const receivingIds = new Set(receiving.tasks.map((task) => task.documentId))
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
            <colgroup>
              <col className="tf-staff-order-col" />
              <col className="tf-staff-store-col" span={2} />
              <col />
              <col />
              <col className="tf-staff-actions-col" />
            </colgroup>
            <thead>
              <tr>
                <th>Lệnh</th>
                <th>Từ kho</th>
                <th>Tới kho</th>
                <th>Hàng</th>
                <th>Kết quả của tôi</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {r.data?.items.map((row) => (
                <StaffRow
                  key={row.id}
                  row={row}
                  receiving={receivingIds.has(row.id)}
                />
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
function StaffRow({
  row,
  receiving,
}: {
  row: TransferRow
  receiving: boolean
}) {
  return (
    <tr>
      <td>
        <Link to={'/transfer-orders/' + row.id}>
          {documentCode('DC', row.id)}
        </Link>
      </td>
      <td>{row.sourceStoreName}</td>
      <td>{row.destStoreName}</td>
      <td>
        {row.lineCount} mã · {row.totalPlannedQty} phụ tùng
      </td>
      <td>
        <span className="tf-badge">{states[row.status] ?? row.status}</span>
      </td>
      <td>
        <div className="mf-row-actions">
          <StaffRowAction row={row} receiving={receiving} />
        </div>
      </td>
    </tr>
  )
}
/**
 * Nút trên dòng dẫn thẳng vào phiếu của nhân viên: kho xuất vào phiếu soạn hàng, kho nhận (hoặc kho xuất khi hàng
 * bị trả về) vào phiếu nhận đang mở. Được BM giao việc nhận hàng mà chưa có phiếu thì lập phiếu nhận.
 * Không có việc đang mở thì chỉ xem chi tiết lệnh.
 */
function StaffRowAction({
  row,
  receiving,
}: {
  row: TransferRow
  receiving: boolean
}) {
  const { user } = useInventoryScope(),
    source = user?.storeId === row.sourceStoreId,
    open = row.status !== 'CLOSED',
    preparing = source && row.status === 'AWAITING_DISPATCH',
    detail = useInventoryData<Transfer>(
      '/transfer-orders/' + row.id,
      {},
      0,
      open && !preparing && !receiving,
    ),
    receipt = detail.data?.receipts.find(
      (r) =>
        r.status !== 'CONFIRMED' &&
        r.receiptType === (source ? 'RETURN_TO_SOURCE' : 'TRANSFER_IN'),
    )
  if (preparing)
    return (
      <Link
        className="mf-btn mf-btn--sm mf-btn--primary"
        to={'/transfer-orders/' + row.id + '/prepare'}
      >
        Soạn hàng
      </Link>
    )
  if (receiving)
    return (
      <Link
        className="mf-btn mf-btn--sm mf-btn--primary"
        to={receivingCreatePath('TRANSFER_RECEIVING', row.id)}
      >
        Lập phiếu nhập
      </Link>
    )
  if (receipt)
    return (
      <Link
        className="mf-btn mf-btn--sm mf-btn--primary"
        to={'/transfer-orders/' + row.id + '/receipts/' + receipt.id}
      >
        Kiểm nhận hàng
      </Link>
    )
  return (
    <Link
      className="mf-btn mf-btn--sm mf-btn--secondary"
      to={'/transfer-orders/' + row.id + (source && open ? '/prepare' : '')}
    >
      {source && open ? 'Xem kết quả soạn' : 'Xem chi tiết'}
    </Link>
  )
}
