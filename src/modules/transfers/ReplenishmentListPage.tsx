import { useOpenReplenishments } from './useOpenReplenishments'
import { Link } from 'react-router-dom'
import SearchableFilter from '../../shared/ui/SearchableFilter'
import { canCoordinateTransfers } from '../../shared/utils/roles'
import { useInventoryData, useInventoryScope } from '../inventory/api'
import { InventoryNotice, Pagination } from '../inventory/components'
import { date } from '../inventory/presentation'
import type { Page } from '../inventory/types'
import { states, type Replenishment, type ReplenishmentRow } from './types'
import { documentCode as code } from '../../shared/utils/documentCode'
import { formatDateTime } from '../../shared/utils/format'
import ServerDraftList from '../../shared/ui/ServerDraftList'
import { useSearchBox } from '../../shared/hooks/useSearchBox'
import './transfers.css'

/**
 * GET /replenishment-requests/drafts (BE #61, D2): nháp của chính người dùng, mới nhất trước.
 * Cùng dạng ReplenishmentRowResponse của danh sách yêu cầu (PM 18/11: FE theo tên của BE).
 */
type ReplenishmentDraftRow = {
  id: number
  storeName: string | null
  lineCount: number | null
  totalRequestedQty: number | null
  createdAt: string
  updatedAt?: string | null
}
export default function ReplenishmentListPage() {
  const scope = useInventoryScope(),
    search = scope.params.get('q') ?? '',
    page = Math.max(0, Number(scope.params.get('page')) || 0)
  const manager = scope.user?.role === 'BRANCH_MANAGER'
  const coordinator = canCoordinateTransfers(scope.user)
  const branch = manager && !coordinator
  const activeStatus =
    scope.params.get('status') || (branch ? 'OPEN' : 'AWAITING_COORDINATION')
  // PM 17/11: tab "Nháp" ngoài cùng bên phải; nháp lưu trên server, chỉ người tạo thấy.
  const drafts = activeStatus === 'DRAFT'
  const filters = { storeId: scope.storeId, q: search.trim() }
  const searchBox = useSearchBox(search, (value) =>
    scope.filter({ q: value }, true),
  )
  const base = useInventoryData<Page<ReplenishmentRow>>(
    '/replenishment-requests',
    {
      ...filters,
      page,
      size: 20,
      status: activeStatus === 'ALL' ? undefined : activeStatus,
    },
    0,
    activeStatus !== 'OPEN' && !drafts,
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
      <section>
        <div className="tf-list-heading">
          <h2>
            {coordinator
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
                  ['DRAFT', 'Nháp'],
                ]
              : [
                  ['AWAITING_COORDINATION', 'Chờ điều phối'],
                  ['IN_PROGRESS', 'Đang thực hiện'],
                  ['CLOSED', 'Đã đóng'],
                  ['ALL', 'Tất cả'],
                  ['DRAFT', 'Nháp'],
                ]
            ).map(([value, label]) => (
              <button
                key={value}
                aria-pressed={activeStatus === value}
                onClick={() => scope.filter({ status: value })}
              >
                {label}{' '}
                {branch && !drafts && activeStatus === value && r.data && (
                  <span className="tf-tab-count">{r.data.totalItems}</span>
                )}
              </button>
            ))}
          </div>
          <div className="tf-list-search" hidden={drafts}>
            <input
              aria-label="Tìm yêu cầu"
              placeholder="Tìm mã yêu cầu hoặc cửa hàng"
              {...searchBox}
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
        {drafts && (
          <ServerDraftList<ReplenishmentDraftRow>
            path="/replenishment-requests/drafts"
            code={(id) => code('YBS', id)}
            openPath={(id) => '/replenishment-requests/drafts/' + id}
            searchLabel="Tìm nháp"
            emptyText='Chưa có nháp. Khi tạo yêu cầu bổ sung, bấm "Lưu nháp" để lưu lại làm tiếp sau.'
            tableClassName="tf-table"
            columns={[
              { header: 'Cửa hàng', cell: (row) => row.storeName ?? '—' },
              { header: 'Số dòng', cell: (row) => row.lineCount ?? '—' },
              {
                header: 'Tổng số lượng',
                cell: (row) => row.totalRequestedQty ?? '—',
              },
              {
                header: 'Lưu lúc',
                cell: (row) => formatDateTime(row.updatedAt ?? row.createdAt),
              },
            ]}
          />
        )}
        <div hidden={drafts}>
          <InventoryNotice
            loading={!drafts && r.loading}
            error={drafts ? undefined : r.error || scope.storesError}
          />
          <div className="tf-table">
            <table>
              <thead>
                <tr>
                  <th>Yêu cầu</th>
                  <th>Cửa hàng</th>
                  <th>Hàng yêu cầu</th>
                  <th>Trạng thái</th>
                  <th>Thao tác</th>
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
          {!r.loading && r.data && !r.data.items.length && (
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
        </div>
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
      <td>
        <strong className="tf-store-name">{row.storeName}</strong>
      </td>
      <td className="tf-requested-parts">
        <RequestedParts id={row.id} />
        <small>
          {row.totalRequestedQty} phụ tùng · {row.lineCount} mã
        </small>
      </td>
      <td>
        <span className={'tf-badge tf-status-' + row.status}>
          {states[row.status] ?? row.status}
        </span>
      </td>
      <td>
        <div className="mf-row-actions">
          {row.status === 'AWAITING_COORDINATION' && canCoordinate ? (
            <Link
              className="mf-btn mf-btn--sm mf-btn--primary"
              to={'/replenishment-requests/' + row.id + '/coordinate'}
              title="Chọn kho gửi hàng cho yêu cầu bổ sung"
            >
              Điều phối
            </Link>
          ) : (
            <Link
              className="mf-btn mf-btn--sm mf-btn--secondary"
              to={'/replenishment-requests/' + row.id}
            >
              {row.status !== 'CLOSED' ? 'Theo dõi' : 'Xem chi tiết'}
            </Link>
          )}
        </div>
      </td>
    </tr>
  )
}

/**
 * RequestedParts: danh sách phụ tùng của yêu cầu ngay trên dòng (góp ý cô Hoài 12/11: sau khi tạo yêu cầu bổ sung
 * phải thấy tên cửa hàng và các phụ tùng yêu cầu). API danh sách chỉ trả số dòng, nên đọc chi tiết từng yêu cầu.
 */
function RequestedParts({ id }: { id: number }) {
  const detail = useInventoryData<Replenishment>(
    '/replenishment-requests/' + id,
  )
  const lines = detail.data?.lines ?? []
  if (!lines.length) return null
  const shown = lines.slice(0, 3)
  return (
    <ul className="tf-part-list">
      {shown.map((line) => (
        <li key={line.productId}>
          {line.partName} <b>× {line.requestedQty}</b>
        </li>
      ))}
      {lines.length > shown.length && (
        <li className="tf-part-more">
          và {lines.length - shown.length} phụ tùng khác
        </li>
      )}
    </ul>
  )
}
