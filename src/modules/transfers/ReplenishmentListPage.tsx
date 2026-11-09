import { useOpenReplenishments } from './useOpenReplenishments'
import { useCoordinationAccess } from './useCoordinationAccess'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useInventoryData, useInventoryScope } from '../inventory/api'
import { InventoryNotice, Pagination } from '../inventory/components'
import type { Page } from '../inventory/types'
import { states, type Replenishment } from './types'
import './transfers.css'
const code = (prefix: string, id: number) =>
  prefix + '-' + String(id).padStart(4, '0')
export default function ReplenishmentListPage() {
  const scope = useInventoryScope(),
    [search, setSearch] = useState(''),
    page = Math.max(0, Number(scope.params.get('page')) || 0),
    status = scope.params.get('status') ?? '',
    base = useInventoryData<Page<Replenishment>>('/replenishment-requests', {
      page,
      size: 20,
      status: status === 'OPEN' ? undefined : status,
      storeId: scope.storeId,
      from: scope.params.get('from') ?? '',
      to: scope.params.get('to') ?? '',
    })
  const firstDetail = useInventoryData<Replenishment>(
    '/replenishment-requests/' + base.data?.items[0]?.id,
    {},
    0,
    scope.user?.role === 'BRANCH_MANAGER' && !!base.data?.items.length,
  )
  const coordinator = useCoordinationAccess(
    firstDetail.data?.lines[0]?.productId,
  )
  const branch = scope.user?.role === 'BRANCH_MANAGER' && !coordinator
  const activeStatus = branch
    ? scope.params.has('status')
      ? status
      : 'OPEN'
    : status
  const open = useOpenReplenishments(
    {
      storeId: scope.storeId,
      from: scope.params.get('from') ?? '',
      to: scope.params.get('to') ?? '',
    },
    page,
    branch && activeStatus === 'OPEN',
  )
  const r = branch && activeStatus === 'OPEN' ? open : base
  return (
    <main
      className={
        'dashboard-content tf-page tf-repl-list' +
        (branch ? ' tf-branch-list' : '')
      }
    >
      <header>
        <h1>Yêu cầu bổ sung</h1>
        <nav>
          <Link to="/dashboard">Trang chủ</Link> › Điều chuyển › Yêu cầu bổ sung
        </nav>
      </header>
      <section>
        <div className="tf-list-heading">
          <h2>
            {scope.owner
              ? 'Yêu cầu bổ sung của các cửa hàng'
              : 'Yêu cầu bổ sung của ' + (scope.user?.storeName ?? 'cửa hàng')}
          </h2>
          <Link className="tf-primary" to="/replenishment-requests/new">
            ＋ Tạo yêu cầu bổ sung
          </Link>
        </div>
        <div className="tf-list-controls">
          <div className="tf-status-tabs">
            {(branch
              ? [
                  ['OPEN', 'Chưa đóng'],
                  ['CLOSED', 'Đã đóng'],
                  ['', 'Tất cả'],
                ]
              : [
                  ['AWAITING_COORDINATION', 'Chờ điều phối'],
                  ['IN_PROGRESS', 'Đang thực hiện'],
                  ['CLOSED', 'Đã đóng'],
                  ['', 'Tất cả'],
                ]
            ).map(([value, label]) => (
              <button
                key={value}
                aria-pressed={activeStatus === value}
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
                {label}{' '}
                {branch && activeStatus === value && r.data && (
                  <span className="tf-tab-count">{r.data.totalItems}</span>
                )}
              </button>
            ))}
          </div>
          <div className="tf-list-search">
            <input
              aria-label="Tìm yêu cầu trong trang"
              placeholder="Tìm mã hoặc tên phụ tùng trong trang"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {scope.owner && (
              <select
                aria-label="Cửa hàng"
                value={scope.storeId}
                onChange={(e) => scope.filter({ storeId: e.target.value })}
              >
                <option value="">Mọi cửa hàng</option>
                {scope.stores.map((s) => (
                  <option value={s.id} key={s.id}>
                    {s.storeName}
                  </option>
                ))}
              </select>
            )}
            <details>
              <summary>Lọc ngày</summary>
              <label>
                Từ ngày
                <input
                  aria-label="Từ ngày"
                  type="date"
                  value={scope.params.get('from') ?? ''}
                  onChange={(e) => scope.filter({ from: e.target.value })}
                />
              </label>
              <label>
                Đến ngày
                <input
                  aria-label="Đến ngày"
                  type="date"
                  value={scope.params.get('to') ?? ''}
                  onChange={(e) => scope.filter({ to: e.target.value })}
                />
              </label>
            </details>
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
                <th>Yêu cầu</th>
                <th>Cửa hàng</th>
                <th>Người tạo</th>
                <th>Ngày tạo</th>
                <th>Hàng yêu cầu</th>
                <th>Lệnh điều chuyển</th>
                <th>Trạng thái</th>
                <th>Cần làm</th>
              </tr>
            </thead>
            <tbody>
              {r.data?.items.map((row) => (
                <ReplenishmentRow key={row.id} row={row} search={search} />
              ))}
            </tbody>
          </table>
        </div>
        {r.data && !r.data.items.length && (
          <p className="tf-empty">Không có yêu cầu phù hợp.</p>
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
function ReplenishmentRow({
  row,
  search,
}: {
  row: Replenishment
  search: string
}) {
  const detail = useInventoryData<Replenishment>(
      '/replenishment-requests/' + row.id,
    ),
    d = detail.data
  const canCoordinate = useCoordinationAccess(d?.lines[0]?.productId)
  const query = search.toLocaleLowerCase('vi-VN')
  if (
    query &&
    ![
      code('YBS', row.id),
      row.storeName,
      ...(d?.lines.map((l) => l.sku + ' ' + l.partName) ?? []),
    ]
      .join(' ')
      .toLocaleLowerCase('vi-VN')
      .includes(query) &&
    !detail.loading
  )
    return null
  return (
    <tr>
      <td>
        <Link to={'/replenishment-requests/' + row.id}>
          {code('YBS', row.id)}
        </Link>
      </td>
      <td>{row.storeName}</td>
      <td>{row.createdByName}</td>
      <td>{row.createdAt.slice(0, 10).split('-').reverse().join('/')}</td>
      <td className="tf-requested-parts">
        {d ? (
          <>
            {d.lines
              .slice(0, 2)
              .map((l) => l.partName)
              .join(', ')}
            {d.lines.length > 2
              ? ' và ' + (d.lines.length - 2) + ' mã khác'
              : ''}
          </>
        ) : detail.loading ? (
          'Đang tải…'
        ) : (
          <span title={detail.error}>Không tải được chi tiết</span>
        )}
        <small>
          {row.totalRequestedQty} sản phẩm · {row.lineCount} mã
        </small>
      </td>
      <td>
        {d
          ? d.transferOrders.length
            ? d.transferOrders.map((t) => (
                <Link
                  className="tf-transfer-ref"
                  key={t.id}
                  to={'/transfer-orders/' + t.id}
                >
                  {code('DC', t.id)}
                </Link>
              ))
            : '—'
          : detail.loading
            ? '…'
            : 'Không tải được'}
      </td>
      <td>
        <span className={'tf-badge tf-status-' + row.status}>
          {states[row.status] === 'Đang đáp ứng'
            ? 'Đang thực hiện'
            : (states[row.status] ?? row.status)}
        </span>
      </td>
      <td>
        {row.status === 'AWAITING_COORDINATION' && canCoordinate ? (
          <Link
            className="tf-row-action"
            to={'/replenishment-requests/' + row.id + '/coordinate'}
          >
            Điều phối
          </Link>
        ) : row.status !== 'CLOSED' ? (
          <Link to={'/replenishment-requests/' + row.id}>Xem tiến độ →</Link>
        ) : (
          <Link to={'/replenishment-requests/' + row.id}>Xem →</Link>
        )}
      </td>
    </tr>
  )
}
