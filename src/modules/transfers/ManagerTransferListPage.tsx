import { useOpenTransfers } from './useOpenTransfers'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useInventoryData, useInventoryScope } from '../inventory/api'
import { InventoryNotice, Pagination } from '../inventory/components'
import type { Page } from '../inventory/types'
import { canCoordinateTransfers } from '../../shared/utils/roles'
import { states, type TransferRow } from './types'
import './transfers.css'
const code = (prefix: string, id: number) =>
  prefix + '-' + String(id).padStart(4, '0')
export default function ManagerTransferListPage() {
  const scope = useInventoryScope(),
    [search, setSearch] = useState(''),
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
  const rows =
    r.data?.items.filter((row) =>
      [
        code('DC', row.id),
        row.replenishmentRequestId
          ? code('YBS', row.replenishmentRequestId)
          : '',
      ]
        .join(' ')
        .toLowerCase()
        .includes(search.toLowerCase()),
    ) ?? []
  return (
    <main className="dashboard-content tf-page tf-manager-list">
      <header>
        <h1>Lệnh điều chuyển</h1>
        <nav>
          <Link to="/dashboard">Trang chủ</Link> › Điều chuyển › Lệnh điều
          chuyển
        </nav>
      </header>
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
                <th>Xem chi tiết</th>
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
                    {row.lineCount} mã · {row.totalPlannedQty} sản phẩm
                  </td>
                  <td>
                    <span className={'tf-badge tf-status-' + row.status}>
                      {states[row.status]}
                    </span>
                  </td>
                  <td>
                    {row.status === 'RECONCILING' && coordinator ? (
                      <Link
                        className="tf-row-action"
                        to={'/transfer-orders/' + row.id}
                      >
                        Xác nhận
                      </Link>
                    ) : row.status === 'AWAITING_DISPATCH' &&
                      scope.user?.storeId === row.sourceStoreId ? (
                      <Link to={'/transfer-orders/' + row.id}>
                        Xem xuất hàng
                      </Link>
                    ) : row.status === 'IN_TRANSIT' &&
                      scope.user?.storeId === row.destStoreId ? (
                      <Link
                        className="tf-row-action"
                        to={'/transfer-orders/' + row.id}
                      >
                        Nhận hàng
                      </Link>
                    ) : (
                      <Link to={'/transfer-orders/' + row.id}>
                        Xem chi tiết
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {r.data && !rows.length && (
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
