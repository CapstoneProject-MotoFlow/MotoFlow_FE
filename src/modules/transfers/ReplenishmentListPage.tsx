import { useOpenReplenishments } from './useOpenReplenishments'
import { useCoordinationAccess } from './useCoordinationAccess'
import { Link } from 'react-router-dom'
import SearchableFilter from '../../shared/ui/SearchableFilter'
import { useInventoryData, useInventoryScope } from '../inventory/api'
import { InventoryNotice, Pagination } from '../inventory/components'
import { date } from '../inventory/presentation'
import type { Page } from '../inventory/types'
import { states, type Replenishment, type ReplenishmentRow } from './types'
import './transfers.css'
const code = (prefix: string, id: number) =>
  prefix + '-' + String(id).padStart(4, '0')
export default function ReplenishmentListPage() {
  const scope = useInventoryScope(),
    search = scope.params.get('q') ?? '',
    page = Math.max(0, Number(scope.params.get('page')) || 0),
    manager = scope.user?.role === 'BRANCH_MANAGER',
    firstPage = useInventoryData<Page<ReplenishmentRow>>(
      '/replenishment-requests',
      { size: 1 },
      0,
      manager,
    )
  const firstDetail = useInventoryData<Replenishment>(
    '/replenishment-requests/' + firstPage.data?.items[0]?.id,
    {},
    0,
    manager && !!firstPage.data?.items.length,
  )
  const coordinator = useCoordinationAccess(
    firstDetail.data?.lines[0]?.productId,
  )
  const branch = manager && !coordinator
  const activeStatus =
    scope.params.get('status') || (branch ? 'OPEN' : 'AWAITING_COORDINATION')
  const filters = { storeId: scope.storeId, q: search.trim() }
  const base = useInventoryData<Page<ReplenishmentRow>>(
    '/replenishment-requests',
    {
      ...filters,
      page,
      size: 20,
      status: activeStatus === 'ALL' ? undefined : activeStatus,
    },
    0,
    activeStatus !== 'OPEN',
  )
  const open = useOpenReplenishments(filters, page, activeStatus === 'OPEN')
  const r = activeStatus === 'OPEN' ? open : base
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
                  ['ALL', 'Tất cả'],
                ]
              : [
                  ['AWAITING_COORDINATION', 'Chờ điều phối'],
                  ['IN_PROGRESS', 'Đang thực hiện'],
                  ['CLOSED', 'Đã đóng'],
                  ['ALL', 'Tất cả'],
                ]
            ).map(([value, label]) => (
              <button
                key={value}
                aria-pressed={activeStatus === value}
                onClick={() => scope.filter({ status: value })}
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
              aria-label="Tìm yêu cầu"
              placeholder="Tìm mã yêu cầu hoặc cửa hàng"
              value={search}
              onChange={(e) => scope.filter({ q: e.target.value }, true)}
            />
            {scope.owner && (
              <SearchableFilter
                label="Cửa hàng"
                value={scope.storeId}
                options={[
                  { value: '', label: 'Mọi cửa hàng' },
                  ...scope.stores.map((s) => ({
                    value: String(s.id),
                    label: s.storeName,
                  })),
                ]}
                onChange={(storeId) => scope.filter({ storeId })}
              />
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
                <th>Yêu cầu</th>
                <th>Cửa hàng</th>
                <th>Hàng yêu cầu</th>
                <th>Trạng thái</th>
                <th>Cần làm</th>
              </tr>
            </thead>
            <tbody>
              {r.data?.items.map((row) => (
                <ReplenishmentRow
                  key={row.id}
                  row={row}
                  canCoordinate={coordinator}
                />
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
  canCoordinate,
}: {
  row: ReplenishmentRow
  canCoordinate: boolean
}) {
  return (
    <tr>
      <td>
        <Link to={'/replenishment-requests/' + row.id}>
          {code('YBS', row.id)}
        </Link>
        <small>{date(row.createdAt)}</small>
      </td>
      <td>{row.storeName}</td>
      <td className="tf-requested-parts">
        <small>
          {row.totalRequestedQty} sản phẩm · {row.lineCount} mã
        </small>
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
          <Link to={'/replenishment-requests/' + row.id}>Theo dõi</Link>
        ) : (
          <Link to={'/replenishment-requests/' + row.id}>Xem</Link>
        )}
      </td>
    </tr>
  )
}
