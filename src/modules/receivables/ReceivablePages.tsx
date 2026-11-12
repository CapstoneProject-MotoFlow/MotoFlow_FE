import PageBackLink from '../../shared/ui/PageBackLink'
import DebtEvidence from './DebtEvidence'
import OpeningDebtPicker from './OpeningDebtPicker'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useInventoryData, useInventoryScope } from '../inventory/api'
import {
  InventoryNotice,
  Pagination,
  WarehouseFilter,
} from '../inventory/components'
import { money, dateTime, today } from '../inventory/presentation'
import type { Page } from '../inventory/types'
import type { Debtor, DebtDetail } from './types'
import DebtDialog from './DebtDialog'
import PageHeader from '../../shared/ui/PageHeader'
import Icon from '../../shared/ui/Icon'
import EmptyState from '../../shared/ui/EmptyState'
import { formatMoney } from '../../shared/utils/format'
import { useOwnerDebtTotals } from '../operations/ownerMetrics'
import './receivables.css'
const credit: Record<string, string> = {
  ELIGIBLE: 'Được mua chịu',
  NOT_GRANTED: 'Chưa cấp mua chịu',
  REVOKED: 'Đã thu hồi mua chịu',
}
const day = (s: string | null) => (s ? s.split('-').reverse().join('/') : '—')
export function ReceivableListPage() {
  const [opening, setOpening] = useState(false),
    [revision, setRevision] = useState(0)
  const scope = useInventoryScope(),
    page = Math.max(0, Number(scope.params.get('page')) || 0)
  const q = scope.params.get('q') ?? '',
    overdue = scope.params.get('overdueOnly') === 'true'
  const resource = useInventoryData<Page<Debtor>>(
    '/receivables/customers',
    {
      storeId: scope.storeId,
      q,
      overdueOnly: overdue,
      page,
      size: 20,
    },
    revision,
  )
  // Review C3 + góp ý cô Hoài ("Phải thu" -> "Tổng nợ"): số tổng lấy cùng nguồn với Tổng quan.
  const totals = useOwnerDebtTotals(scope.storeId)
  const shown = (value: number | undefined) =>
    totals.loading ? 'Đang tải…' : totals.error ? '—' : formatMoney(value ?? 0)
  return (
    <main className="dashboard-content rv-page rv-list-page">
      <PageHeader
        title="Công nợ khách hàng"
        breadcrumb={[{ label: 'Công nợ' }, { label: 'Công nợ khách hàng' }]}
        actions={
          scope.owner && (
            <button
              type="button"
              className="mf-btn mf-btn--secondary"
              onClick={() => setOpening(true)}
            >
              <Icon name="plus" />
              Ghi nợ đầu kỳ
            </button>
          )
        }
      />
      <div className="rv-overview" aria-label="Tổng quan công nợ">
        <article title={totals.error}>
          <span className="rv-stat-icon">
            <Icon name="wallet" />
          </span>
          <span>Tổng nợ</span>
          <strong>{shown(totals.data?.debt)}</strong>
          <small>Khách đang nợ · {scope.warehouse}</small>
        </article>
        <button
          type="button"
          onClick={() => scope.filter({ overdueOnly: !overdue })}
          aria-pressed={overdue}
          title={totals.error}
        >
          <span className="rv-stat-icon rv-icon-error">
            <Icon name="alert" />
          </span>
          <span>Nợ quá hạn</span>
          <strong className={totals.data?.overdueDebt ? 'rv-overdue' : ''}>
            {shown(totals.data?.overdueDebt)}
          </strong>
          <small>
            {overdue
              ? 'Bấm để xem lại tất cả khách'
              : 'Bấm để chỉ xem khách có nợ quá hạn'}
          </small>
        </button>
        <article title={totals.error}>
          <span className="rv-stat-icon rv-icon-warning">
            <Icon name="calendar" />
          </span>
          <span>Đến hạn 7 ngày tới</span>
          <strong>
            {totals.loading
              ? 'Đang tải…'
              : totals.error
                ? '—'
                : (totals.data?.dueSoonCustomers ?? 0) + ' khách'}
          </strong>
          <small>Khách có khoản nợ gần nhất đến hạn trong 7 ngày</small>
        </article>
      </div>
      <section className="stock-panel">
        <h2>Khách đang nợ · {scope.warehouse}</h2>
        <div className="rv-filters">
          <label>
            <input
              aria-label="Tìm khách hàng"
              value={q}
              placeholder="Tìm tên hoặc số điện thoại khách"
              onChange={(e) => scope.filter({ q: e.target.value }, true)}
            />
          </label>
          <WarehouseFilter
            owner={scope.owner}
            stores={scope.stores}
            value={scope.storeId}
            onChange={(v) => scope.filter({ storeId: v })}
          />
          <label>
            <input
              type="checkbox"
              checked={overdue}
              onChange={(e) => scope.filter({ overdueOnly: e.target.checked })}
            />{' '}
            Chỉ có nợ quá hạn
          </label>
        </div>
        <InventoryNotice
          loading={resource.loading}
          error={resource.error || scope.storesError}
        />
        <div className="rv-table">
          <table>
            <thead>
              <tr>
                {/* Review C1: quyền mua chịu thành dòng phụ dưới tên khách để bảng vừa khung 1366px. */}
                <th>Khách hàng</th>
                {(!scope.owner || !!scope.storeId) && (
                  <th className="mf-num">Tổng nợ toàn chuỗi</th>
                )}
                <th className="mf-num">
                  {!scope.owner || scope.storeId
                    ? 'Nợ tại cửa hàng'
                    : 'Tổng nợ toàn chuỗi'}
                </th>
                <th className="mf-num">Nợ quá hạn</th>
                <th className="mf-num">Số khoản nợ</th>
                <th>Hạn gần nhất</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {resource.data?.items.map((r) => (
                <tr key={r.customerId}>
                  <td>
                    <Link
                      to={`/receivables/customers/${r.customerId}${scope.storeId ? '?storeId=' + scope.storeId : ''}`}
                    >
                      {r.customerName}
                    </Link>
                    <small>
                      {r.phone || '—'} · {credit[r.creditStatus]}
                    </small>
                  </td>
                  {(!scope.owner || !!scope.storeId) && (
                    <td className="mf-num">{money.format(r.totalDebt)}</td>
                  )}
                  <td className="mf-num">{money.format(r.debt)}</td>
                  <td
                    className={'mf-num' + (r.overdueDebt ? ' rv-overdue' : '')}
                  >
                    {money.format(r.overdueDebt)}
                  </td>
                  <td className="mf-num">{r.openDebtCount}</td>
                  <td className="mf-nowrap">{day(r.earliestDueDate)}</td>
                  <td>
                    <Link
                      className={
                        'rv-pay-link' + (r.overdueDebt ? ' rv-pay-overdue' : '')
                      }
                      to={`/receivables/customers/${r.customerId}?action=payment${scope.storeId ? '&storeId=' + scope.storeId : ''}`}
                    >
                      Thu nợ
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {resource.data && !resource.data.items.length && (
          <EmptyState
            icon="wallet"
            message="Không có khách hàng còn nợ phù hợp bộ lọc."
          />
        )}
        <Pagination
          total={resource.data?.totalItems ?? 0}
          page={page}
          loading={resource.loading}
          onPage={(n) =>
            scope.setParams((p) => {
              const next = new URLSearchParams(p)
              next.set('page', String(n))
              return next
            })
          }
        />
      </section>
      {opening && (
        <OpeningDebtPicker
          onClose={() => setOpening(false)}
          onSaved={() => {
            setOpening(false)
            setRevision((n) => n + 1)
          }}
        />
      )}
    </main>
  )
}
export function ReceivableDetailPage() {
  const { id } = useParams(),
    scope = useInventoryScope()
  const [revision, setRevision] = useState(0),
    [action, setAction] = useState(() =>
      scope.params.get('action') === 'payment' ? 'payment' : '',
    ),
    [tab, setTab] = useState('open'),
    [allPayments, setAllPayments] = useState(false),
    [notice, setNotice] = useState('')
  const resource = useInventoryData<DebtDetail>(
    `/customers/${id}/debts`,
    { storeId: scope.storeId },
    revision,
    !!id && /^[1-9]\d*$/.test(id),
  )
  const { params, setParams } = scope
  useEffect(() => {
    if (!params.has('action')) return
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous)
        next.delete('action')
        return next
      },
      { replace: true },
    )
  }, [params, setParams])
  const d = resource.data,
    rows =
      d?.debts.filter(
        (r) =>
          tab === 'all' ||
          (tab === 'overdue' ? r.overdue : r.remainingAmount > 0),
      ) ?? []
  return (
    <main className="dashboard-content rv-page rv-detail">
      <PageBackLink to="/receivables" />
      <header className="stock-heading">
        <div>
          <h1>{d ? 'Công nợ của ' + d.customerName : 'Chi tiết công nợ'}</h1>
        </div>
      </header>
      {notice && (
        <p role="status" className="stock-notice">
          {notice}
        </p>
      )}
      <InventoryNotice
        loading={resource.loading}
        error={resource.error || scope.storesError}
      />
      {d && (
        <>
          <section className="rv-customer-card">
            <div className="rv-customer-top">
              <div className="rv-customer-title">
                <h2>{d.customerName}</h2>
                <span className={'rv-badge rv-credit-' + d.creditStatus}>
                  {credit[d.creditStatus]}
                </span>
              </div>
              <div className="rv-actions">
                {d && (
                  <>
                    <Link
                      to={`${scope.owner ? '/owner' : '/branch-manager'}/customers/${id}`}
                    >
                      Hồ sơ khách hàng
                    </Link>
                    <button
                      disabled={d.debt <= 0}
                      onClick={() => setAction('payment')}
                    >
                      Thu nợ
                    </button>
                  </>
                )}
              </div>
            </div>
            <details className="rv-scope-control">
              <summary>{scope.warehouse} · Đổi phạm vi</summary>{' '}
              <WarehouseFilter
                owner={scope.owner}
                stores={scope.stores}
                value={scope.storeId}
                onChange={(v) => {
                  setAction('')
                  scope.filter({ storeId: v })
                }}
              />
            </details>
            <dl>
              <div>
                <dt>Điện thoại</dt>
                <dd>{d.phone || '—'}</dd>
              </div>
              <div>
                <dt>Còn nợ toàn chuỗi</dt>
                <dd>{money.format(d.totalDebt)}</dd>
              </div>
              {d.storeId != null && (
                <div>
                  <dt>Còn nợ tại {d.storeName}</dt>
                  <dd>{money.format(d.debt)}</dd>
                </div>
              )}
              <div>
                <dt>
                  Nợ quá hạn{' '}
                  {d.storeId != null ? 'tại ' + d.storeName : 'toàn chuỗi'}
                </dt>
                <dd className={d.overdueDebt ? 'rv-overdue' : ''}>
                  {money.format(d.overdueDebt)}
                </dd>
              </div>
              <div>
                <dt>Hạn trả gần nhất</dt>
                <dd>
                  {day(
                    d.debts
                      .filter((r) => r.remainingAmount > 0 && r.dueDate)
                      .map((r) => r.dueDate)
                      .sort()[0] ?? null,
                  )}
                </dd>
              </div>
            </dl>
          </section>
          <section className="stock-panel">
            <h2>Các khoản nợ</h2>
            <div className="rv-tabs">
              {[
                ['open', 'Còn nợ'],
                ['overdue', 'Quá hạn'],
                ['all', 'Tất cả'],
              ].map(([key, label]) => (
                <button
                  key={key}
                  aria-pressed={tab === key}
                  onClick={() => setTab(key)}
                >
                  {label}{' '}
                  <span>
                    {
                      d.debts.filter(
                        (r) =>
                          key === 'all' ||
                          (key === 'overdue'
                            ? r.overdue
                            : r.remainingAmount > 0),
                      ).length
                    }
                  </span>
                </button>
              ))}
            </div>
            <div className="rv-table">
              <table>
                <thead>
                  <tr>
                    <th>Khoản nợ</th>
                    <th>Nguồn</th>
                    <th>Ngày ghi nợ</th>
                    <th>Hạn trả</th>
                    <th>Số nợ</th>
                    <th>Đã thu</th>
                    <th>Còn lại</th>
                    <th>Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td>
                        #{r.id}
                        <small>{r.storeName}</small>
                      </td>
                      <td>
                        {r.salesOrderId ? (
                          <Link to={'/sales-orders/' + r.salesOrderId}>
                            Đơn #{r.salesOrderId}
                          </Link>
                        ) : (
                          'Nợ đầu kỳ'
                        )}
                        {r.note && <small>{r.note}</small>}
                        <DebtEvidence files={r.evidence} />
                      </td>
                      <td>
                        {day(r.recognizedAt.slice(0, 10))}
                        <small>{r.recognizedBy}</small>
                      </td>
                      <td className={r.overdue ? 'rv-overdue' : ''}>
                        {day(r.dueDate)}
                        {r.overdue && (
                          <small>
                            <span className="rv-badge rv-late">
                              Quá hạn{' '}
                              {Math.max(
                                1,
                                Math.floor(
                                  (Date.parse(today()) -
                                    Date.parse(r.dueDate)) /
                                    86400000,
                                ),
                              )}{' '}
                              ngày
                            </span>
                          </small>
                        )}
                      </td>
                      <td
                        title={
                          r.correctionAmount
                            ? 'Gồm điều chỉnh ' +
                              money.format(r.correctionAmount)
                            : undefined
                        }
                      >
                        {money.format(r.originalAmount + r.correctionAmount)}
                      </td>
                      <td>{money.format(r.collectedAmount)}</td>
                      <td>{money.format(r.remainingAmount)}</td>
                      <td>
                        <span className={'rv-badge rv-debt-' + r.status}>
                          {(
                            {
                              OUTSTANDING: 'Chưa thu',
                              PARTIALLY_PAID: 'Đã thu một phần',
                              SETTLED: 'Đã tất toán',
                            } as Record<string, string>
                          )[r.status] ?? r.status}
                        </span>
                        {r.settledAt && (
                          <small>Tất toán {dateTime(r.settledAt)}</small>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!rows.length && (
              <p className="rv-empty">Không có khoản nợ trong mục này.</p>
            )}
          </section>
          <section className="stock-panel">
            <h2>Lịch sử thu nợ</h2>
            <p className="rv-ledger-note">
              Số còn nợ trong phân bổ là số dư hiện tại, sau tất cả các lần thu.
            </p>
            <div className="rv-table">
              <table>
                <thead>
                  <tr>
                    <th>Phiếu thu</th>
                    <th>Lúc</th>
                    <th>Hình thức</th>
                    <th>Số tiền</th>
                    <th>Trừ vào</th>
                    <th>Xác minh</th>
                  </tr>
                </thead>
                <tbody>
                  {(allPayments ? d.payments : d.payments.slice(0, 10)).map(
                    (p) => (
                      <tr key={p.id}>
                        <td>#{p.id}</td>
                        <td>
                          {dateTime(p.recordedAt)}
                          <small>{p.recordedBy}</small>
                        </td>

                        <td>
                          {p.paymentMethod === 'CASH'
                            ? 'Tiền mặt'
                            : 'Chuyển khoản'}
                          <small>{p.transactionReference}</small>
                          <DebtEvidence files={p.evidence} />
                        </td>
                        <td
                          title={
                            p.tenderedAmount == null
                              ? undefined
                              : 'Khách đưa: ' +
                                money.format(p.tenderedAmount) +
                                '; tiền thối: ' +
                                money.format(p.changeAmount ?? 0)
                          }
                        >
                          {money.format(p.amount)}
                          <small>{p.storeName}</small>
                          {p.tenderedAmount != null && (
                            <small>
                              Khách đưa: {money.format(p.tenderedAmount)}
                              <br />
                              Tiền thối: {money.format(p.changeAmount ?? 0)}
                            </small>
                          )}
                        </td>
                        <td>
                          {p.allocations.map((a) => (
                            <small key={a.receivableId}>
                              #{a.receivableId}:{' '}
                              {money.format(a.allocatedAmount)}
                              <span className="rv-balance-note">
                                Còn nợ hiện tại:{' '}
                                {money.format(a.remainingAmount)}
                              </span>
                            </small>
                          ))}
                        </td>
                        <td>
                          <span className="rv-badge">
                            {p.status === 'VERIFIED'
                              ? 'Đã xác minh'
                              : p.status === 'REJECTED'
                                ? 'Đã từ chối'
                                : 'Chưa xác minh'}
                          </span>
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
            {d.payments.length > 10 && (
              <button
                className="rv-more"
                onClick={() => setAllPayments((v) => !v)}
              >
                {allPayments
                  ? 'Thu gọn'
                  : 'Xem tất cả ' + d.payments.length + ' lần thu'}
              </button>
            )}
            {!d.payments.length && (
              <p className="rv-empty">Chưa có khoản thu nợ.</p>
            )}
          </section>
          {action && (
            <DebtDialog
              key={action}
              action={action}
              data={d}
              owner={scope.owner}
              stores={scope.stores}
              onClose={() => setAction('')}
              onSaved={() => {
                setAction('')
                setNotice('Đã lưu thành công.')
                setRevision((n) => n + 1)
              }}
            />
          )}
        </>
      )}
    </main>
  )
}
