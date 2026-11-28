import { useOpenTransfers } from './useOpenTransfers'
import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { useInventoryData, useInventoryScope } from '../inventory/api'
import { InventoryNotice, Pagination } from '../inventory/components'
import type { Page } from '../inventory/types'
import { canCoordinateTransfers } from '../../shared/utils/roles'
import { states, type TransferRow } from './types'
import ReceivingAssignment from '../operations/ReceivingAssignment'
import TransferWrongItemPendingSection from './TransferWrongItemPendingSection'
import { documentCode as code } from '../../shared/utils/documentCode'
import './transfers.css'
import { matchesSearch } from '../../shared/utils/searchText'
export default function ManagerTransferListPage() {
  const scope = useInventoryScope(),
    [search, setSearch] = useState(''),
    [success, setSuccess] = useState(''),
    [receivingAssigned, setReceivingAssigned] = useState<Record<number, boolean>>({}),
    page = Math.max(0, Number(scope.params.get('page')) || 0),
    status = scope.params.get('status') ?? 'OPEN',
    base = useInventoryData<Page<TransferRow>>(
      '/transfer-orders',
      {
        status: status === 'OPEN' ? undefined : status,
        page,
        size: 20,
        sourceStoreId: scope.params.get('sourceStoreId') ?? '',
        destStoreId: scope.params.get('destStoreId') ?? '',
      },
      0,
      status !== 'OPEN',
    )
  const open = useOpenTransfers(
    {
      sourceStoreId: scope.params.get('sourceStoreId') ?? '',
      destStoreId: scope.params.get('destStoreId') ?? '',
    },
    page,
    status === 'OPEN',
  )
  const r = status === 'OPEN' ? open : base
  const coordinator = canCoordinateTransfers(scope.user)
  const handleAssignmentChange = useCallback(
    (documentId: number, assigned: boolean) =>
      setReceivingAssigned((current) =>
        current[documentId] === assigned
          ? current
          : { ...current, [documentId]: assigned },
      ),
    [],
  )
  const rows =
    r.data?.items.filter((row) =>
      matchesSearch(
        search,
        code('DC', row.id),
        row.replenishmentRequestId
          ? code('YBS', row.replenishmentRequestId)
          : '',
      ),
    ) ?? []
  return (
    <main className="dashboard-content tf-page tf-manager-list">
      {/* GVHD 24/11: BM kho gửi xác nhận hoặc từ chối phiếu nhận hàng giao sai của lệnh kho mình gửi. */}
      {/* Review 25/11: BM chưa gán kho thì BE trả 403, nên không hiện. */}
      {scope.user?.role === 'BRANCH_MANAGER' && scope.user.storeId != null && (
        <TransferWrongItemPendingSection canAct />
      )}
      <section>
        <div className="tf-list-heading">
          <h2>Lệnh điều chuyển giữa các kho</h2>
          {coordinator && (
            <Link className="tf-primary" to="/transfer-orders/new">
              ＋ Tạo lệnh điều chuyển
            </Link>
          )}
        </div>
        <div className="tf-list-controls">
          <div className="tf-status-tabs">
            {[
              ['OPEN', 'Đang mở'],
              ['CLOSED', 'Đã đóng'],
              ['', 'Tất cả'],
            ].map(([value, label]) => (
              <button
                key={value}
                aria-pressed={status === value}
                onClick={() => {
                  setSearch('')
                  scope.setParams((previous) => {
                    const next = new URLSearchParams(previous)
                    next.set('status', value)
                    next.delete('page')
                    return next
                  })
                }}
              >
                {label}
                {status === value && r.data && (
                  <span className="tf-tab-count">{r.data.totalItems}</span>
                )}
              </button>
            ))}
          </div>
          <div className="tf-list-search">
            <input
              aria-label="Tìm trong trang"
              value={search}
              placeholder="Tìm mã lệnh, mã yêu cầu trong trang"
              onChange={(e) => setSearch(e.target.value)}
            />
            {scope.owner && (
              <>
                <select
                  aria-label="Kho nguồn"
                  value={scope.params.get('sourceStoreId') ?? ''}
                  onChange={(e) =>
                    scope.filter({ sourceStoreId: e.target.value })
                  }
                >
                  <option value="">Mọi kho nguồn</option>
                  {scope.stores.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.storeName}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Kho đích"
                  value={scope.params.get('destStoreId') ?? ''}
                  onChange={(e) =>
                    scope.filter({ destStoreId: e.target.value })
                  }
                >
                  <option value="">Mọi kho đích</option>
                  {scope.stores.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.storeName}
                    </option>
                  ))}
                </select>
              </>
            )}
          </div>
        </div>
        <InventoryNotice
          loading={r.loading}
          error={r.error || scope.storesError}
        />
        {success && (
          <p className="tf-success-notice" role="status">
            {success}
          </p>
        )}
        <div className="tf-table">
          <table>
            <thead>
              <tr>
                <th>Lệnh</th>
                <th>Theo yêu cầu</th>
                <th>Từ kho</th>
                <th>Tới kho</th>
                <th>Ngày tạo</th>
                <th>Hàng</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <Link to={'/transfer-orders/' + row.id}>
                      {code('DC', row.id)}
                    </Link>
                  </td>
                  <td>
                    {row.replenishmentRequestId &&
                    (coordinator || scope.user?.storeId === row.destStoreId) ? (
                      <Link
                        to={
                          '/replenishment-requests/' +
                          row.replenishmentRequestId
                        }
                      >
                        {code('YBS', row.replenishmentRequestId)}
                      </Link>
                    ) : row.replenishmentRequestId ? (
                      code('YBS', row.replenishmentRequestId)
                    ) : (
                      'Lập trực tiếp'
                    )}
                  </td>
                  <td>{row.sourceStoreName}</td>
                  <td>{row.destStoreName}</td>
                  <td>
                    {row.createdAt.slice(0, 10).split('-').reverse().join('/')}
                  </td>
                  <td>
                    {row.lineCount} mã · {row.totalPlannedQty} phụ tùng
                  </td>
                  <td>
                    <span
                      className={'tf-badge tf-status-' + row.status}
                      title={
                        row.awaitingReceiptConfirmation
                          ? 'Nhân viên đã gửi kết quả kiểm nhận; đang chờ quản lý xác nhận.'
                          : receivingAssigned[row.id]
                          ? 'Hàng đang điều chuyển; nhân viên nhận hàng đã được phân công.'
                          : undefined
                      }
                    >
                      {row.awaitingReceiptConfirmation
                        ? 'Chờ xác nhận'
                        : row.status === 'IN_TRANSIT' && receivingAssigned[row.id]
                          ? 'Chờ nhân viên nhận hàng'
                          : row.status === 'RECONCILING' && !row.hasDiscrepancy
                            ? 'Chờ đóng lệnh'
                            : states[row.status]}
                    </span>
                  </td>
                  <td>
                    <div className="mf-row-actions">
                      <RowAction
                        row={row}
                        coordinator={coordinator}
                        onAssignmentChange={handleAssignmentChange}
                        onAssigned={(name) =>
                          setSuccess(
                            'Đã giao việc nhận hàng ' +
                              code('DC', row.id) +
                              ' cho ' +
                              name +
                              '.',
                          )
                        }
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!r.loading && r.data && !rows.length && (
          <p className="tf-empty">
            Không có lệnh phù hợp{search ? ' trong trang này' : ''}.
          </p>
        )}
        <Pagination
          total={r.data?.totalItems ?? 0}
          page={page}
          loading={r.loading}
          onPage={(n) => {
            setSearch('')
            scope.setParams((p) => {
              const next = new URLSearchParams(p)
              next.set('page', String(n))
              return next
            })
          }}
        />
      </section>
    </main>
  )
}
/**
 * Cột Thao tác: việc của cửa hàng mình hiện nút chính, còn lại chỉ là nút xem.
 * Lệnh đang chuyển tới kho mình: "Nhận hàng" mở ngay hộp giao việc nhận hàng (TRANSFER_RECEIVING) cho nhân viên.
 */
function RowAction({
  row,
  coordinator,
  onAssignmentChange,
  onAssigned,
}: {
  row: TransferRow
  coordinator: boolean
  onAssignmentChange: (documentId: number, assigned: boolean) => void
  onAssigned: (name: string) => void
}) {
  const { user } = useInventoryScope(),
    to = '/transfer-orders/' + row.id,
    view = (
      <Link className="mf-btn mf-btn--sm mf-btn--secondary" to={to}>
        Xem chi tiết
      </Link>
    ),
    label =
      row.status === 'RECONCILING' && coordinator
        ? 'Xác nhận'
        : row.status === 'AWAITING_DISPATCH' &&
            user?.storeId === row.sourceStoreId
          ? 'Xuất hàng'
          : ''
  if (
    row.status === 'IN_TRANSIT' &&
    user?.role === 'BRANCH_MANAGER' &&
    user.storeId === row.destStoreId
  )
    return (
      <ReceivingAssignment
        variant="row"
        taskType="TRANSFER_RECEIVING"
        documentId={row.id}
        fallback={view}
        onCurrentChange={onAssignmentChange}
        onSaved={onAssigned}
      />
    )
  if (!label) return view
  return (
    <Link className="mf-btn mf-btn--sm mf-btn--primary" to={to}>
      {label}
    </Link>
  )
}
