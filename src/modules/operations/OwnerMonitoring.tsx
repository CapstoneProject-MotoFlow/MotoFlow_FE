/**
 * File: modules/operations/OwnerMonitoring.tsx
 * Loại: THÀNH PHẦN MÀN HÌNH — phần thân Tổng quan của Owner.
 * Công dụng: Kết quả bán hàng theo kỳ (doanh thu, số đơn bán được, tiền đã thu, bán chịu), việc cần xử lý,
 * công nợ và kho cần chú ý, so sánh các cửa hàng. Theo góp ý của cô Hoài ngày 12/11.
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useInventoryData } from '../inventory/api'
import { InventoryNotice } from '../inventory/components'
import type { Page, StockSummary } from '../inventory/types'
import type { CountList } from '../inventory/countApi'
import type { ReplenishmentRow } from '../transfers/types'
import { dateTime, number, today } from '../inventory/presentation'
import { formatMoney } from '../../shared/utils/format'
import Icon, { type IconName } from '../../shared/ui/Icon'
import EmptyState from '../../shared/ui/EmptyState'
import {
  COLLECTED_DETAIL_LIMIT,
  useOwnerDebtTotals,
  useOwnerSalesPeriod,
} from './ownerMetrics'
import './operations.css'
type Store = { id: number; storeName: string; status: string }
type Pending = {
  id: number
  createdAt?: string
  arrivedAt?: string
  storeName?: string
}
type Period = 'TODAY' | 'WEEK' | 'MONTH'
const periods: { value: Period; label: string }[] = [
  { value: 'TODAY', label: 'Hôm nay' },
  { value: 'WEEK', label: '7 ngày qua' },
  { value: 'MONTH', label: 'Tháng này' },
]
const count = (value: number | undefined, unit: string) =>
  value === undefined ? '—' : number.format(value) + ' ' + unit

function periodRange(period: Period) {
  const to = today()
  const day = new Date(to + 'T00:00:00Z')
  if (period === 'WEEK') day.setUTCDate(day.getUTCDate() - 6)
  if (period === 'MONTH') day.setUTCDate(1)
  return { from: period === 'TODAY' ? to : day.toISOString().slice(0, 10), to }
}

function Kpi({
  icon,
  tone,
  label,
  value,
  note,
  href,
}: {
  icon: IconName
  tone: 'blue' | 'green' | 'amber' | 'red' | 'slate'
  label: string
  value: string
  note?: string
  href?: string
}) {
  const body = (
    <>
      <span className={'owner-kpi-icon owner-kpi-icon--' + tone}>
        <Icon name={icon} />
      </span>
      <span className="owner-kpi-text">
        <span className="owner-kpi-label">{label}</span>
        <strong className="owner-kpi-value">{value}</strong>
        {note && <small className="owner-kpi-note">{note}</small>}
      </span>
    </>
  )
  return href ? (
    <Link className="owner-kpi" to={href}>
      {body}
    </Link>
  ) : (
    <div className="owner-kpi">{body}</div>
  )
}

export default function OwnerMonitoring() {
  const [period, setPeriod] = useState<Period>('TODAY')
  const range = periodRange(period)
  const sales = useOwnerSalesPeriod(range.from, range.to)
  const debt = useOwnerDebtTotals()
  const counts = useInventoryData<CountList>('/stock-counts', {
      status: 'AWAITING_APPROVAL',
      page: 0,
      size: 5,
    }),
    excess = useInventoryData<Page<Pending>>('/goods-receipt-notes', {
      excessAwaiting: true,
      page: 0,
      size: 5,
    }),
    replenishments = useInventoryData<Page<ReplenishmentRow>>(
      '/replenishment-requests',
      { status: 'AWAITING_COORDINATION', page: 0, size: 5 },
    ),
    summary = useInventoryData<StockSummary>('/inventory/stock/summary'),
    lots = useInventoryData<{ page: Page<unknown> }>('/inventory/lots', {
      tab: 'NEAR_EXPIRY',
      page: 0,
      size: 1,
    }),
    stores = useInventoryData<Store[]>('/stores')
  const work = [
    ...(counts.data?.counts.items ?? []).map((r) => ({
      key: 'k' + r.id,
      code: 'KK-' + String(r.id).padStart(4, '0'),
      at: r.createdAt,
      store: r.storeName,
      task: 'Duyệt chênh lệch kiểm kê',
      href: '/stock-counts/' + r.id,
    })),
    ...(excess.data?.items ?? []).map((r) => ({
      key: 'g' + r.id,
      code: 'PN-' + String(r.id).padStart(4, '0'),
      at: r.arrivedAt ?? '',
      store: r.storeName,
      task: 'Quyết định hàng thừa',
      href: '/goods-receipt-notes/' + r.id,
    })),
    ...(replenishments.data?.items ?? []).map((r) => ({
      key: 'y' + r.id,
      code: 'YBS-' + String(r.id).padStart(4, '0'),
      at: r.createdAt ?? '',
      store: r.storeName,
      task: 'Điều phối bổ sung hàng',
      href: '/replenishment-requests/' + r.id + '/coordinate',
    })),
  ]
    .sort((a, b) => a.at.localeCompare(b.at))
    .slice(0, 5)
  const loading = counts.loading || excess.loading || replenishments.loading,
    error = counts.error || excess.error || replenishments.error
  const salesLink = `/sales-orders?tab=COMPLETED&from=${range.from}&to=${range.to}`
  const periodLabel = periods.find((p) => p.value === period)!.label
  return (
    <div className="owner-monitoring">
      <section className="owner-card owner-sales">
        <header className="owner-card-head">
          <div>
            <h2>Kết quả bán hàng</h2>
            <p>Tính theo đơn bán đã hoàn tất, tạo trong kỳ đang chọn.</p>
          </div>
          <div className="owner-period" role="group" aria-label="Chọn kỳ">
            {periods.map((p) => (
              <button
                key={p.value}
                type="button"
                className={p.value === period ? 'is-active' : ''}
                aria-pressed={p.value === period}
                onClick={() => setPeriod(p.value)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </header>
        <InventoryNotice
          loading={sales.loading}
          error={sales.error}
          onRetry={sales.retry}
        />
        <div className="owner-kpi-grid">
          <Kpi
            icon="trend"
            tone="blue"
            label="Doanh thu"
            value={sales.data ? formatMoney(sales.data.revenue) : '—'}
            note={periodLabel}
            href={salesLink}
          />
          <Kpi
            icon="receipt"
            tone="slate"
            label="Số đơn bán được"
            value={count(sales.data?.orders, 'đơn')}
            note={periodLabel}
            href={salesLink}
          />
          <Kpi
            icon="cash"
            tone="green"
            label="Tiền đã thu"
            value={
              sales.data
                ? sales.data.collected == null
                  ? '—'
                  : formatMoney(sales.data.collected)
                : '—'
            }
            note={
              sales.data && sales.data.collected == null
                ? `Kỳ có hơn ${COLLECTED_DETAIL_LIMIT} đơn, chọn kỳ ngắn hơn`
                : 'Khách đã trả khi mua'
            }
          />
          <Kpi
            icon="wallet"
            tone="amber"
            label="Bán chịu (ghi nợ)"
            value={
              sales.data
                ? sales.data.credit == null
                  ? '—'
                  : formatMoney(sales.data.credit)
                : '—'
            }
            note="Phần chưa thu, đã vào công nợ"
            href="/receivables"
          />
        </div>
      </section>

      <div className="owner-two-columns">
        <section className="owner-card">
          <header className="owner-card-head">
            <h2>Việc cần xử lý</h2>
          </header>
          <InventoryNotice
            loading={loading}
            error={error}
            onRetry={() =>
              [counts, excess, replenishments].forEach((source) =>
                source.retry(),
              )
            }
          />
          {work.length > 0 && (
            <div className="stock-table-scroll">
              <table className="stock-table owner-work-table">
                <thead>
                  <tr>
                    <th>Chứng từ</th>
                    <th>Việc</th>
                    <th>Ngày tạo / nhận</th>
                    <th aria-label="Thao tác" />
                  </tr>
                </thead>
                <tbody>
                  {work.map((w) => (
                    <tr key={w.key}>
                      <td>
                        <Link to={w.href}>{w.code}</Link>
                        <small>{w.store}</small>
                      </td>
                      <td>{w.task}</td>
                      <td className="mf-num">{dateTime(w.at)}</td>
                      <td>
                        <div className="mf-row-actions">
                          <Link
                            className="mf-btn mf-btn--primary mf-btn--sm"
                            to={w.href}
                          >
                            Xử lý
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!loading && !error && !work.length && (
            <EmptyState
              icon="check"
              message="Không có việc nào đang chờ bạn."
            />
          )}
        </section>
        <section className="owner-card">
          <header className="owner-card-head">
            <h2>Công nợ và kho cần chú ý</h2>
          </header>
          <InventoryNotice
            loading={debt.loading || summary.loading || lots.loading}
            error={debt.error || summary.error || lots.error}
            onRetry={() =>
              [debt, summary, lots].forEach((source) => source.retry())
            }
          />
          <div className="owner-attention">
            <Link to="/receivables">
              <span>Tổng nợ</span>
              <strong>{debt.data ? formatMoney(debt.data.debt) : '—'}</strong>
            </Link>
            <Link to="/receivables?overdueOnly=true" className="is-danger">
              <span>Nợ quá hạn</span>
              <strong>
                {debt.data ? formatMoney(debt.data.overdueDebt) : '—'}
              </strong>
            </Link>
            <Link
              to="/inventory?view=lowStock"
              title="Đếm theo từng cửa hàng: một phụ tùng dưới ngưỡng ở hai cửa hàng tính là hai."
            >
              <span>Dưới ngưỡng tồn</span>
              <strong>{count(summary.data?.lowStock, 'sản phẩm')}</strong>
            </Link>
            <Link to="/inventory/lots?tab=NEAR_EXPIRY">
              <span>Lô sắp hết hạn</span>
              <strong>{count(lots.data?.page.totalItems, 'lô')}</strong>
            </Link>
          </div>
        </section>
      </div>

      <section className="owner-card">
        <header className="owner-card-head">
          <h2>So sánh cửa hàng · {periodLabel.toLocaleLowerCase('vi')}</h2>
        </header>
        <InventoryNotice
          loading={stores.loading || sales.loading}
          error={stores.error || sales.error}
          onRetry={() => [stores, sales].forEach((source) => source.retry())}
        />
        <div className="stock-table-scroll">
          <table className="stock-table owner-store-table">
            <thead>
              <tr>
                <th>Cửa hàng</th>
                <th className="mf-num">Doanh thu</th>
                <th className="mf-num">Số đơn</th>
                <th className="mf-num">Tổng nợ</th>
                <th className="mf-num">Nợ quá hạn</th>
                <th className="mf-num">Dưới ngưỡng</th>
              </tr>
            </thead>
            <tbody>
              {stores.data
                ?.filter((s) => s.status === 'ACTIVE')
                .map((s) => (
                  <StoreLine
                    key={s.id}
                    store={s}
                    sales={sales.data?.stores.get(s.id)}
                    salesLoaded={!!sales.data}
                  />
                ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
function StoreLine({
  store,
  sales,
  salesLoaded,
}: {
  store: Store
  sales?: { revenue: number; orders: number }
  salesLoaded: boolean
}) {
  const debt = useOwnerDebtTotals(store.id)
  const stock = useInventoryData<StockSummary>('/inventory/stock/summary', {
    storeId: store.id,
  })
  const debtCell = (value: number | undefined) =>
    debt.loading ? 'Đang tải…' : formatMoney(value)
  return (
    <tr>
      <td>{store.storeName}</td>
      <td className="mf-num">
        {salesLoaded ? formatMoney(sales?.revenue ?? 0) : '—'}
      </td>
      <td className="mf-num">
        {salesLoaded ? number.format(sales?.orders ?? 0) : '—'}
      </td>
      <td className="mf-num" title={debt.error}>
        {debtCell(debt.data?.debt)}
      </td>
      <td className="mf-num" title={debt.error}>
        {debtCell(debt.data?.overdueDebt)}
      </td>
      <td className="mf-num" title={stock.error}>
        {stock.loading ? (
          'Đang tải…'
        ) : (
          <Link to={'/inventory?view=lowStock&storeId=' + store.id}>
            {count(stock.data?.lowStock, 'sản phẩm')}
          </Link>
        )}
      </td>
    </tr>
  )
}
