import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useInventoryData, useInventoryScope, inventoryError } from './api'
import {
  InventoryPanel,
  WarehouseFilter,
  InventoryNotice,
  Pagination,
} from './components'
import { StockCountFormDialog } from './StockCountFormDialog'
import { countScope, type CountList, type CountRequest } from './countApi'
import { money } from './presentation'
import { countStateNames, countTypeNames } from './stockCountModel'
import axiosClient from '../../shared/api/axiosClient'
import { date, dateTime } from './presentation'
import './stock-count.css'
import { useCountList } from './useCountList'
import ConfirmDialog from '../../shared/ui/ConfirmDialog'
const countTabs = [
  ['OPEN', 'Đang mở'],
  ['COMPLETED', 'Hoàn tất'],
  ['CANCELLED', 'Đã hủy'],
  ['ALL', 'Tất cả'],
] as const

export default function StockCountListPage() {
  const scope = useInventoryScope(),
    staff = scope.user?.role === 'STAFF',
    p = scope.params
  const [dialog, setDialog] = useState(false),
    [requestId, setRequestId] = useState<number | undefined>(() => {
      const value = Number(p.get('requestId'))
      return Number.isSafeInteger(value) && value > 0 ? value : undefined
    }),
    [revision, setRevision] = useState(0),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [cancelId, setCancelId] = useState<number>()
  const lock = useRef(false),
    page = Math.max(0, Number(p.get('page')) || 0),
    requestedStatus = p.get('status'),
    status =
      countTabs.find(([value]) => value === requestedStatus)?.[0] ?? 'OPEN',
    invalid = !!p.get('from') && !!p.get('to') && p.get('from')! > p.get('to')!
  const filters = {
    storeId: scope.storeId,
    countType: p.get('countType') ?? '',
    from: p.get('from') ?? '',
    to: p.get('to') ?? '',
  }
  const r = useCountList(
    {
      ...filters,
      status: status === 'ALL' ? undefined : status,
      page,
      size: 20,
    },
    revision,
    !invalid,
  )
  const totalQuery = { ...filters, page: 0, size: 1 }
  const all = useInventoryData<CountList>(
    '/stock-counts',
    totalQuery,
    revision,
    !invalid,
  )
  const completed = useInventoryData<CountList>(
    '/stock-counts',
    { ...totalQuery, status: 'COMPLETED' },
    revision,
    !invalid,
  )
  const cancelled = useInventoryData<CountList>(
    '/stock-counts',
    { ...totalQuery, status: 'CANCELLED' },
    revision,
    !invalid,
  )
  const allTotal = all.data?.counts.totalItems
  const completedTotal = completed.data?.counts.totalItems
  const cancelledTotal = cancelled.data?.counts.totalItems
  const tabTotals = {
    OPEN:
      allTotal == null || completedTotal == null || cancelledTotal == null
        ? undefined
        : Math.max(0, allTotal - completedTotal - cancelledTotal),
    COMPLETED: completedTotal,
    CANCELLED: cancelledTotal,
    ALL: allTotal,
  }
  const ownerRequests = useInventoryData<CountRequest[]>(
    '/stock-count-requests',
    { storeId: scope.storeId },
    revision,
    scope.owner,
  )
  const requests = scope.owner
    ? ownerRequests
    : { data: r.data?.pendingRequests, error: r.error, loading: r.loading }
  async function cancel(id: number) {
    if (lock.current) return
    lock.current = true
    setBusy(true)
    setError('')
    try {
      await axiosClient.post(`/stock-count-requests/${id}/cancel`)
      setCancelId(undefined)
      setRevision((n) => n + 1)
    } catch (e) {
      setError(inventoryError(e))
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  return (
    <main className="inventory-workspace count-workspace">
      <InventoryPanel
        title={
          staff
            ? 'Việc kiểm kê của tôi'
            : scope.owner
              ? 'Phiếu kiểm kê các kho'
              : 'Phiếu kiểm kê · ' + scope.warehouse
        }
        action={
          !staff && (
            <button
              className="count-primary"
              onClick={() => {
                setRequestId(undefined)
                setDialog(true)
              }}
            >
              {scope.owner ? 'Yêu cầu kiểm kê' : 'Tạo phiếu kiểm kê'}
            </button>
          )
        }
      >
        <div className="stock-tabs">
          {countTabs.map(([value, label]) => (
            <button
              key={value}
              aria-pressed={status === value}
              className={status === value ? 'count-tab-active' : ''}
              onClick={() => scope.filter({ status: value })}
            >
              {label}
              <span className="count-tab-number">
                {tabTotals[value] ?? '—'}
              </span>
            </button>
          ))}
        </div>
        <div className="stock-filters">
          <WarehouseFilter
            owner={scope.owner}
            stores={scope.stores}
            value={scope.storeId}
            onChange={(storeId) => scope.filter({ storeId })}
          />
          <label>
            Loại kiểm kê
            <select
              value={p.get('countType') ?? ''}
              onChange={(e) => scope.filter({ countType: e.target.value })}
            >
              <option value="">Tất cả</option>
              {Object.entries(countTypeNames).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label>
            Từ ngày
            <input
              type="date"
              value={p.get('from') ?? ''}
              onChange={(e) => scope.filter({ from: e.target.value })}
            />
          </label>
          <label>
            Đến ngày
            <input
              type="date"
              value={p.get('to') ?? ''}
              onChange={(e) => scope.filter({ to: e.target.value })}
            />
          </label>
        </div>
        <InventoryNotice
          loading={r.loading}
          error={
            invalid
              ? 'Ngày bắt đầu phải trước ngày kết thúc.'
              : r.error ||
                scope.storesError ||
                all.error ||
                completed.error ||
                cancelled.error
          }
        />
        <div className="stock-table-scroll">
          <table className="stock-table">
            <thead>
              <tr>
                <th>Phiếu</th>
                {scope.owner && <th>Kho</th>}
                <th>Phạm vi, ngày</th>
                <th>{staff ? 'Số dòng' : 'Người đếm'}</th>
                {!staff && <th>Chênh lệch</th>}
                {scope.owner && <th>Giá trị chênh lệch</th>}
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {r.data?.counts.items.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link to={`/stock-counts/${c.id}`}>
                      KK-{String(c.id).padStart(4, '0')}
                    </Link>
                    <small>{countTypeNames[c.countType]}</small>
                  </td>
                  {scope.owner && <td>{c.storeName}</td>}
                  <td>
                    {countScope(c.scopeType, c.scopeNote)}
                    <small>{date(c.countDate)}</small>
                  </td>
                  <td>
                    {staff
                      ? (c.lineCount ?? '—')
                      : c.counterNames?.join(', ') || 'Chưa ghi nhận'}
                  </td>
                  {!staff && (
                    <td>
                      {c.differenceLineCount == null
                        ? '—'
                        : c.differenceLineCount === 0
                          ? 'Khớp'
                          : c.differenceLineCount + ' dòng'}
                    </td>
                  )}
                  {scope.owner && (
                    <td>
                      {c.differenceValue == null
                        ? '—'
                        : money.format(c.differenceValue)}
                    </td>
                  )}
                  <td>
                    <span className={'count-status count-status-' + c.status}>
                      {countStateNames[c.status]}
                    </span>
                  </td>
                  <td>
                    <Link to={`/stock-counts/${c.id}`}>Xem phiếu</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {r.data && !r.data.counts.items.length && (
          <p className="stock-empty">Không có phiếu phù hợp.</p>
        )}
        {r.data && (
          <Pagination
            total={r.data.counts.totalItems}
            page={page}
            loading={r.loading}
            onPage={(n) =>
              scope.setParams((previous) => {
                const next = new URLSearchParams(previous)
                next.set('page', String(n))
                return next
              })
            }
          />
        )}
      </InventoryPanel>
      {!staff && (
        <InventoryPanel
          title={
            scope.owner ? 'Yêu cầu kiểm kê đã gửi' : 'Yêu cầu kiểm kê của Owner'
          }
        >
          <InventoryNotice
            loading={requests.loading}
            error={error || requests.error}
          />
          <div className="stock-table-scroll">
            <table className="stock-table">
              <thead>
                <tr>
                  <th>Yêu cầu</th>
                  {scope.owner && <th>Kho</th>}
                  <th>Phạm vi</th>
                  <th>Lý do / Người yêu cầu</th>
                  <th>Trạng thái</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {requests.data?.map((q) => (
                  <tr key={q.id}>
                    <td>
                      YCKK-{String(q.id).padStart(4, '0')}
                      <small>{dateTime(q.requestedAt)}</small>
                    </td>
                    {scope.owner && <td>{q.storeName}</td>}
                    <td>{countScope(q.scopeType, q.scopeNote)}</td>
                    <td>
                      {q.reason}
                      <small>
                        {q.requestedByName} · {dateTime(q.requestedAt)}
                      </small>
                    </td>
                    <td>
                      {
                        {
                          PENDING: 'Chờ tạo phiếu',
                          DONE: 'Đã tạo phiếu',
                          CANCELLED: 'Đã hủy',
                        }[q.status]
                      }
                    </td>
                    <td>
                      {q.status === 'PENDING' &&
                        (scope.owner ? (
                          <button
                            disabled={busy}
                            onClick={() => setCancelId(q.id)}
                          >
                            Hủy yêu cầu
                          </button>
                        ) : (
                          <button
                            className="count-primary"
                            onClick={() => {
                              setRequestId(q.id)
                              setDialog(true)
                            }}
                          >
                            Tạo phiếu từ yêu cầu
                          </button>
                        ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {requests.data && !requests.data.length && (
            <p className="stock-empty">Chưa có yêu cầu.</p>
          )}
        </InventoryPanel>
      )}
      {(dialog || p.get('action') === (scope.owner ? 'request' : 'create')) &&
        !staff && (
          <StockCountFormDialog
            owner={scope.owner}
            storeId={scope.user?.storeId}
            requestId={requestId}
            onSaved={() => setRevision((n) => n + 1)}
            onClose={() => {
              setDialog(false)
              setRequestId(undefined)
              scope.filter({ action: '', requestId: '' })
            }}
          />
        )}
      {cancelId != null && (
        <ConfirmDialog
          title="Hủy yêu cầu kiểm kê"
          message="Bạn muốn hủy yêu cầu này? Thao tác không hoàn tác được và sẽ thông báo cho quản lý kho."
          confirmLabel="Hủy yêu cầu"
          danger
          onCancel={() => setCancelId(undefined)}
          onConfirm={() => cancel(cancelId)}
        />
      )}
    </main>
  )
}
export function CountBackLink() {
  return <Link to="/stock-counts">← Danh sách kiểm kê</Link>
}
