import { StockCountLines } from './StockCountLines'
import { useState } from 'react'
import { CountActionDialog, type CountAction } from './CountActionDialog'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../shared/hooks/useAuth'
import { InventoryHeader, InventoryPanel } from './components'
import { CountBackLink } from './StockCountListPage'
import {
  countDifference,
  countStateNames,
  countTypeNames,
  type StockCount,
} from './stockCountModel'
import { date, dateTime } from './presentation'
import './stock-count.css'

export default function StockCountDetailPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const [params] = useSearchParams()
  return (
    <StockCountDetailView
      key={id + ':' + params.toString()}
      id={id}
      role={user?.role ?? ''}
      initialAction={params.get('action') as CountAction | null}
    />
  )
}
export function StockCountDetailView({
  count,
  id,
  role,
  initialAction,
}: {
  count?: StockCount
  id?: string
  role: string
  initialAction?: CountAction | null
}) {
  const staff = role === 'STAFF',
    owner = role === 'OWNER'
  const allowed = owner
    ? ['approve', 'opening']
    : role === 'BRANCH_MANAGER'
      ? ['assign', 'verify', 'cancel']
      : []
  const [action, setAction] = useState<CountAction | undefined>(() =>
    initialAction && allowed.includes(initialAction)
      ? initialAction
      : undefined,
  )
  const [allLines, setAllLines] = useState(false)
  const manage = !count || ['DRAFT', 'COUNTING'].includes(count.status)
  const approval = !count || count.status === 'AWAITING_APPROVAL'
  const relevant = (count?.lines ?? []).filter((line) =>
    count?.type === 'OPENING'
      ? line.unitCost == null
      : line.countedQty == null || countDifference(line) !== 0,
  )
  const visibleLines =
    staff || allLines || !count?.submittedAt || !relevant.length
      ? count?.lines
      : relevant
  return (
    <main className="inventory-workspace count-workspace">
      <InventoryHeader
        title={'Phiếu kiểm kê' + (count ? ' ' + count.code : '')}
      >
        <CountBackLink />
      </InventoryHeader>
      {!count && (
        <p role="status" className="count-unavailable">
          Chưa tải được thông tin phiếu kiểm kê. Vui lòng quay lại sau.
        </p>
      )}
      <div className={staff ? '' : 'count-detail-grid'}>
        <div>
          <InventoryPanel
            title={count?.code ?? 'Thông tin phiếu'}
            action={
              <span className="stock-badge">
                {count ? countStateNames[count.status] : '—'}
              </span>
            }
          >
            {!staff && (
              <ol className="count-progress" aria-label="Tiến độ kiểm kê">
                {[
                  ['Tạo phiếu', count?.createdByName, count?.createdAt],
                  ['Đếm', count?.assigneeName, count?.submittedAt],
                  ['BM xác minh', count?.confirmedByName, count?.confirmedAt],
                  ['Owner duyệt', count?.approvedByName, count?.approvedAt],
                ].map(([label, by, at]) => (
                  <li key={label} className={at ? 'done' : ''}>
                    <strong>{label}</strong>
                    <span>{by ?? '—'}</span>
                    <small>{at ? dateTime(at) : '—'}</small>
                  </li>
                ))}
              </ol>
            )}
            <dl className="stock-facts">
              <div>
                <dt>Kho</dt>
                <dd>{count?.storeName ?? '—'}</dd>
              </div>
              <div>
                <dt>Phạm vi</dt>
                <dd>{count?.scopeLabel ?? '—'}</dd>
              </div>
              <div>
                <dt>Ngày kiểm kê</dt>
                <dd>{date(count?.countDate)}</dd>
              </div>
              <div>
                <dt>{staff ? 'Số dòng cần đếm' : 'Loại kiểm kê'}</dt>
                <dd>
                  {count
                    ? staff
                      ? count.lines.length
                      : countTypeNames[count.type]
                    : '—'}
                </dd>
              </div>
              {!staff && (
                <div>
                  <dt>Nguồn tạo</dt>
                  <dd>{count?.sourceLabel ?? '—'}</dd>
                </div>
              )}
            </dl>
          </InventoryPanel>
          <InventoryPanel
            title={staff ? 'Dòng cần đếm' : 'Dòng kiểm kê'}
            action={
              !staff && count?.submittedAt && relevant.length > 0 ? (
                <div className="stock-tabs">
                  <button
                    aria-pressed={!allLines}
                    onClick={() => setAllLines(false)}
                  >
                    {count?.type === 'OPENING'
                      ? 'Thiếu giá vốn'
                      : 'Chênh lệch, chưa đếm'}
                  </button>
                  <button
                    aria-pressed={allLines}
                    onClick={() => setAllLines(true)}
                  >
                    Tất cả dòng
                  </button>
                </div>
              ) : undefined
            }
          >
            <StockCountLines count={count} role={role} lines={visibleLines} />
          </InventoryPanel>
        </div>
        {!staff && (
          <InventoryPanel title="Lịch sử">
            <ol className="count-events">
              {count?.events.map((event) => (
                <li key={event.id}>
                  <strong>{event.text}</strong>
                  <span>{event.by}</span>
                  <small>{dateTime(event.at)}</small>
                </li>
              ))}
              {!count?.events.length && <li>Chưa có lịch sử để hiển thị.</li>}
            </ol>
          </InventoryPanel>
        )}
      </div>
      <footer className="count-sticky">
        <CountBackLink />
        {staff ? (
          <Link
            className="count-disabled-link"
            aria-disabled="true"
            tabIndex={-1}
            onClick={(e) => e.preventDefault()}
            to={'/stock-counts/' + (count?.id ?? id ?? '') + '/record'}
          >
            Ghi số đếm
          </Link>
        ) : (
          <div className="count-buttons">
            {!owner && manage && (
              <button onClick={() => setAction('cancel')}>Hủy phiếu</button>
            )}
            {owner ? (
              approval && (
                <button
                  className="count-primary"
                  onClick={() =>
                    setAction(count?.type === 'OPENING' ? 'opening' : 'approve')
                  }
                >
                  {count?.type === 'OPENING'
                    ? 'Nhập giá vốn và duyệt'
                    : 'Duyệt chênh lệch'}
                </button>
              )
            ) : (
              <>
                {manage && !count?.submittedAt && (
                  <button onClick={() => setAction('assign')}>Giao việc</button>
                )}
                {manage && (!count || !!count.submittedAt) && (
                  <button
                    className="count-primary"
                    onClick={() => setAction('verify')}
                  >
                    Xác minh chênh lệch
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </footer>
      {action && allowed.includes(action) && (
        <CountActionDialog
          action={action}
          count={count}
          documentId={id}
          onClose={() => setAction(undefined)}
        />
      )}
    </main>
  )
}
