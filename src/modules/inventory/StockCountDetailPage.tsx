import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../../shared/hooks/useAuth'
import { InventoryHeader, InventoryPanel } from './components'
import { CountBackLink } from './StockCountListPage'
import {
  countDifference,
  countStateNames,
  countTypeNames,
  type StockCount,
} from './stockCountModel'
import { date, dateTime, money } from './presentation'
import './stock-count.css'

export default function StockCountDetailPage() {
  const { id } = useParams()
  const { user } = useAuth()
  return <StockCountDetailView id={id} role={user?.role ?? ''} />
}
export function StockCountDetailView({
  count,
  id,
  role,
}: {
  count?: StockCount
  id?: string
  role: string
}) {
  const staff = role === 'STAFF',
    owner = role === 'OWNER'
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
          <InventoryPanel title={staff ? 'Dòng cần đếm' : 'Dòng kiểm kê'}>
            <div className="stock-table-scroll">
              <table className="stock-table">
                <thead>
                  <tr>
                    <th>Phụ tùng / lô / hạn dùng</th>
                    {staff ? <th>Vị trí</th> : <th>Sổ sách</th>}
                    <th>Số đếm</th>
                    {!staff && <th>Chênh lệch</th>}
                    {owner && <th>Giá trị chênh lệch</th>}
                  </tr>
                </thead>
                <tbody>
                  {count?.lines.map((line) => {
                    const difference =
                      count.status === 'DRAFT' ? null : countDifference(line)
                    return (
                      <tr key={line.id}>
                        <td>
                          {line.partName}
                          <small>{line.sku}</small>
                          {line.lotCode && (
                            <strong className="count-lot">
                              Lô {line.lotCode} · HSD {date(line.expiryDate)}
                            </strong>
                          )}
                          {!staff && (line.reason || line.note) && (
                            <small>
                              {line.reason
                                ? 'Nguyên nhân: ' + line.reason
                                : 'Staff ghi: ' + line.note}
                            </small>
                          )}
                        </td>
                        <td>
                          {staff
                            ? (line.binLocation ?? '—')
                            : count.status === 'DRAFT'
                              ? '—'
                              : (line.bookQty ?? '—')}
                        </td>
                        <td>
                          {line.countedQty ??
                            (line.recount ? 'Cần đếm lại' : 'Chưa đếm')}
                        </td>
                        {!staff && (
                          <td>
                            {difference == null
                              ? '—'
                              : (difference > 0 ? '+' : '') + difference}
                          </td>
                        )}
                        {owner && (
                          <td>
                            {difference == null || line.unitCost == null
                              ? '—'
                              : money.format(difference * line.unitCost)}
                          </td>
                        )}
                      </tr>
                    )
                  })}
                  {!count?.lines.length && (
                    <tr>
                      <td
                        colSpan={staff ? 3 : owner ? 5 : 4}
                        className="stock-empty"
                      >
                        Chưa có dòng kiểm kê để hiển thị.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
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
            <button disabled>Hủy phiếu</button>
            {owner ? (
              <button className="count-primary" disabled>
                Duyệt chênh lệch
              </button>
            ) : (
              <>
                <button disabled>Giao việc</button>
                <button className="count-primary" disabled>
                  Xác minh chênh lệch
                </button>
              </>
            )}
          </div>
        )}
      </footer>
    </main>
  )
}
