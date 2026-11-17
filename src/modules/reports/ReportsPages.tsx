import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import axiosClient from '../../shared/api/axiosClient'
import { useInventoryScope } from '../inventory/api'
import type { Movement, Page, StockRow } from '../inventory/types'
import type { OrderDto, SummaryDto } from '../sales/salesApi'
import type { DocumentRow } from '../documents/types'
import type { Debtor } from '../receivables/types'
import type { DashboardProduct } from '../dashboard/types/dashboardTypes'
import PageHeader from '../../shared/ui/PageHeader'
import { formatMoney, formatDateTime } from '../../shared/utils/format'
import { inventoryError } from '../inventory/api'
import { movementLink } from '../inventory/presentation'
import './reports.css'

const day = (date: Date) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(
    date,
  )
const defaultTo = () => day(new Date())
const monthStart = () =>
  day(new Date(new Date().getFullYear(), new Date().getMonth(), 1))
const amount = (n: number | null | undefined) =>
  n == null ? '—' : formatMoney(n)

function useLoad<T>(key: string, load: (signal: AbortSignal) => Promise<T>) {
  const [state, setState] = useState<{ key: string; data?: T; error?: string }>(
    { key: '' },
  )
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    load(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setState({ key: key + retry, data })
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setState({ key: key + retry, error: inventoryError(error) })
      })
    return () => controller.abort()
  }, [key, retry, load])
  return {
    data: state.key === key + retry ? state.data : undefined,
    error: state.key === key + retry ? state.error : undefined,
    loading: state.key !== key + retry,
    reload: () => setRetry((v) => v + 1),
  }
}

async function allPages<T>(
  path: string,
  params: Record<string, string | number | undefined>,
  signal: AbortSignal,
) {
  const all: T[] = []
  for (let page = 0; ; page++) {
    const { data } = await axiosClient.get<Page<T>>(path, {
      params: { ...params, page, size: 100 },
      signal,
    })
    all.push(...data.items)
    if (!data.items.length || all.length >= data.totalItems) return all
  }
}

function ReportFrame({
  title,
  children,
  subtitle,
}: {
  title: string
  children: React.ReactNode
  subtitle?: string
}) {
  return (
    <main className="reports-page">
      <PageHeader
        title={title}
        subtitle={subtitle}
        breadcrumb={[{ label: 'Báo cáo' }, { label: title }]}
      />
      {children}
    </main>
  )
}
function Panel({
  title,
  children,
  actions,
}: {
  title: string
  children: React.ReactNode
  actions?: React.ReactNode
}) {
  return (
    <section className="report-panel">
      <header>
        <h2>{title}</h2>
        {actions}
      </header>
      {children}
    </section>
  )
}
function SalesMetric({
  icon,
  label,
  value,
  details,
  tone,
  linked,
}: {
  icon: 'sales' | 'cash' | 'debt' | 'people'
  label: string
  value: number | null
  details: string[]
  tone: 'blue' | 'green' | 'orange' | 'slate'
  linked?: boolean
}) {
  return (
    <article className="sales-metric-card">
      <span
        className={`sales-metric-icon sales-metric-icon--${tone}`}
        aria-hidden="true"
      >
        {icon === 'sales' && (
          <svg viewBox="0 0 24 24">
            <path d="M4 19V5m0 14h17M7 15l4-4 3 2 6-7" />
          </svg>
        )}
        {icon === 'cash' && (
          <svg viewBox="0 0 24 24">
            <rect x="3" y="6" width="18" height="12" rx="2" />
            <circle cx="12" cy="12" r="3" />
            <path d="M6 9h.01M18 15h.01" />
          </svg>
        )}
        {icon === 'debt' && (
          <svg viewBox="0 0 24 24">
            <path d="M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6M9 16h3" />
          </svg>
        )}
        {icon === 'people' && (
          <svg viewBox="0 0 24 24">
            <circle cx="9" cy="8" r="3" />
            <path d="M3 20v-1a6 6 0 0 1 12 0v1M16 5a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 5v1" />
          </svg>
        )}
      </span>
      <span className="sales-metric-label">{label}</span>
      {linked ? (
        <Link className="sales-metric-link" to="/receivables">
          Công nợ →
        </Link>
      ) : null}
      <strong className="sales-metric-value">
        {value == null
          ? '—'
          : (value / 1_000_000).toLocaleString('vi-VN', {
              maximumFractionDigits: 1,
            })}
        {value != null && <small>triệu</small>}
      </strong>
      <span className="sales-metric-detail">{details[0]}</span>
      <span className="sales-metric-detail">{details[1]}</span>
    </article>
  )
}

function PeriodTabs({
  value,
  onChange,
}: {
  value: 'month' | 'week'
  onChange: (v: 'month' | 'week') => void
}) {
  return (
    <div className="report-period-tabs" aria-label="Kỳ báo cáo">
      <button
        type="button"
        aria-pressed={value === 'month'}
        onClick={() => onChange('month')}
      >
        Tháng này
      </button>
      <button
        type="button"
        aria-pressed={value === 'week'}
        onClick={() => onChange('week')}
      >
        7 ngày gần nhất
      </button>
    </div>
  )
}

function SalesChart({
  orders,
  from,
  to,
  stores,
}: {
  orders: SummaryDto[]
  from: string
  to: string
  stores: ReturnType<typeof useInventoryScope>['stores']
}) {
  const daily = new Map<
    string,
    Map<number, { revenue: number; orders: number }>
  >()
  for (const order of orders) {
    const date = order.createdAt.slice(0, 10)
    const stores =
      daily.get(date) ?? new Map<number, { revenue: number; orders: number }>()
    const item = stores.get(order.storeId) ?? { revenue: 0, orders: 0 }
    item.revenue += order.total ?? 0
    item.orders++
    stores.set(order.storeId, item)
    daily.set(date, stores)
  }
  const storeNames = new Map(stores.map((store) => [store.id, store.storeName]))
  for (const order of orders) storeNames.set(order.storeId, order.storeName)
  const storeIds = [...storeNames.keys()].filter((id) =>
    [...daily.values()].some((items) => items.has(id)),
  )
  const totals = new Map<number, number>()
  for (const items of daily.values())
    for (const [storeId, item] of items)
      totals.set(storeId, (totals.get(storeId) ?? 0) + item.revenue)
  const start = new Date(`${from}T12:00:00`)
  const end = new Date(`${to}T12:00:00`)
  const dates: string[] = []
  for (
    const date = new Date(start);
    date <= end;
    date.setDate(date.getDate() + 1)
  )
    dates.push(day(date))
  const values = dates.map((date) =>
    [...(daily.get(date)?.values() ?? [])].reduce(
      (sum, item) => sum + item.revenue,
      0,
    ),
  )
  const top = Math.max(
    20_000_000,
    Math.ceil(Math.max(0, ...values) / 20_000_000) * 20_000_000,
  )
  const colors = ['#2a78d6', '#f06b36', '#19a974', '#8b5cf6', '#e8a317']
  return (
    <>
      <div className="report-chart-legend">
        {storeIds.map((storeId, index) => (
          <span key={storeId}>
            <i style={{ background: colors[index % colors.length] }} />
            {storeNames.get(storeId)}
            <strong>
              {((totals.get(storeId) ?? 0) / 1_000_000).toLocaleString(
                'vi-VN',
                { maximumFractionDigits: 1 },
              )}{' '}
              tr
            </strong>
          </span>
        ))}
      </div>
      <div className="report-chart-unit">Triệu đồng</div>
      <div
        className="report-chart"
        role="img"
        aria-label="Biểu đồ doanh số bán hàng theo ngày"
      >
        <div className="report-chart-axis">
          {[4, 3, 2, 1, 0].map((step) => (
            <span key={step}>
              {((top / 1_000_000 / 4) * step).toLocaleString('vi-VN')}
            </span>
          ))}
        </div>
        <div className="report-chart-plot">
          <div className="report-chart-bars">
            {dates.map((date) => {
              const items =
                daily.get(date) ??
                new Map<number, { revenue: number; orders: number }>()
              const total = [...items.values()].reduce(
                (sum, item) => sum + item.revenue,
                0,
              )
              return (
                <div
                  className="report-chart-column"
                  key={date}
                  title={`${date}: ${amount(total)}`}
                >
                  <div className="report-chart-stack">
                    {storeIds.map((storeId, index) => (
                      <div
                        key={storeId}
                        className="report-chart-bar"
                        style={{
                          height: `${((items.get(storeId)?.revenue ?? 0) / top) * 100}%`,
                          background: colors[index % colors.length],
                        }}
                      />
                    ))}
                  </div>
                  <small>
                    {date.slice(8, 10)}/{date.slice(5, 7)}
                  </small>
                </div>
              )
            })}
          </div>
          {!storeIds.length && (
            <span className="report-state">Chưa có doanh số theo ngày.</span>
          )}
        </div>
      </div>
    </>
  )
}
function LoadState({
  loading,
  error,
  reload,
  empty = 'Không có dữ liệu trong khoảng đã chọn.',
}: {
  loading: boolean
  error?: string
  reload: () => void
  empty?: string
}) {
  if (loading) return <div className="report-state">Đang tải dữ liệu…</div>
  if (error)
    return (
      <div className="report-error" role="alert">
        {error}
        <button type="button" onClick={reload}>
          Thử lại
        </button>
      </div>
    )
  return <div className="report-state">{empty}</div>
}

export function SalesReportPage() {
  const scope = useInventoryScope()
  const [from, setFrom] = useState(monthStart),
    [to, setTo] = useState(defaultTo)
  const [period, setPeriod] = useState<'month' | 'week'>('month')
  const [showDays, setShowDays] = useState(false)
  const key = `sales:${from}:${to}:${scope.storeId}`
  const loadSales = useCallback(
    async (signal: AbortSignal) => {
      const [orders, debtors] = await Promise.all([
        allPages<SummaryDto>(
          '/sales-orders',
          {
            view: 'COMPLETED',
            createdFrom: from,
            createdTo: to,
            storeId: scope.storeId || undefined,
          },
          signal,
        ),
        allPages<Debtor>(
          '/receivables/customers',
          { storeId: scope.storeId || undefined },
          signal,
        ),
      ])
      const receivables = debtors.reduce((sum, debtor) => sum + debtor.debt, 0)
      const overdueReceivables = debtors.reduce(
        (sum, debtor) => sum + debtor.overdueDebt,
        0,
      )
      const debtorCount = debtors.filter((debtor) => debtor.debt > 0).length
      const stores = new Map<
        number,
        {
          name: string
          revenue: number
          orders: number
          collected: number
          debt: number
        }
      >()
      let revenue = 0,
        collected = 0,
        debt = 0
      if (orders.length > 150) {
        for (const order of orders) {
          const row = stores.get(order.storeId) ?? {
            name: order.storeName,
            revenue: 0,
            orders: 0,
            collected: 0,
            debt: 0,
          }
          row.revenue += order.total ?? 0
          row.orders++
          stores.set(order.storeId, row)
        }
        return {
          orders,
          stores,
          revenue: orders.reduce((s, o) => s + (o.total ?? 0), 0),
          collected: null as number | null,
          debt: null as number | null,
          receivables,
          overdueReceivables,
          debtorCount,
        }
      }
      for (let i = 0; i < orders.length; i += 4) {
        const details = await Promise.all(
          orders
            .slice(i, i + 4)
            .map((order) =>
              axiosClient
                .get<OrderDto>(`/sales-orders/${order.id}`, { signal })
                .then((r) => r.data),
            ),
        )
        for (const order of details) {
          const row = stores.get(order.storeId) ?? {
            name: order.storeName,
            revenue: 0,
            orders: 0,
            collected: 0,
            debt: 0,
          }
          const sale = order.total ?? 0,
            paid = order.money?.netCollected ?? 0,
            credit = order.money?.credit?.amount ?? 0
          row.revenue += sale
          row.orders++
          row.collected += paid
          row.debt += credit
          stores.set(order.storeId, row)
          revenue += sale
          collected += paid
          debt += credit
        }
      }
      return {
        orders,
        stores,
        revenue,
        collected,
        debt,
        receivables,
        overdueReceivables,
        debtorCount,
      }
    },
    [from, to, scope.storeId],
  )
  const report = useLoad(key, loadSales)
  const rows = [...(report.data?.stores.values() ?? [])]
  const daily = new Map<string, SummaryDto[]>()
  for (const order of report.data?.orders ?? []) {
    const date = order.createdAt.slice(0, 10)
    daily.set(date, [...(daily.get(date) ?? []), order])
  }
  const setPeriodRange = (value: 'month' | 'week') => {
    setPeriod(value)
    setFrom(
      value === 'month'
        ? monthStart()
        : day(new Date(Date.now() - 6 * 86400000)),
    )
    setTo(defaultTo())
  }
  return (
    <ReportFrame title="Báo cáo bán hàng">
      <div className="sales-report-filters">
        <div className="sales-report-period">
          <PeriodTabs value={period} onChange={setPeriodRange} />
        </div>
        {scope.owner ? (
          <label className="sales-store-filter">
            <select
              value={scope.storeId}
              onChange={(event) =>
                scope.filter({ storeId: event.target.value })
              }
            >
              <option value="">Mọi cửa hàng</option>
              {scope.stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.storeName}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <span className="sales-current-store">{scope.warehouse}</span>
        )}
        <span className="sales-report-range">
          {scope.owner && !scope.storeId ? 'Toàn chuỗi' : scope.warehouse} ·{' '}
          {from.slice(8, 10)}/{from.slice(5, 7)} – {to.slice(8, 10)}/
          {to.slice(5, 7)}/{to.slice(0, 4)}
        </span>
      </div>
      {report.data ? (
        <>
          <section className="sales-report-cards">
            <SalesMetric
              icon="sales"
              tone="blue"
              label="Doanh số"
              value={report.data.revenue}
              details={[
                `${report.data.orders.length} đơn hoàn tất`,
                `Trong kỳ ${from.slice(8, 10)}/${from.slice(5, 7)} – ${to.slice(8, 10)}/${to.slice(5, 7)}`,
              ]}
            />
            <SalesMetric
              icon="cash"
              tone="green"
              label="Tiền thu đã xác minh"
              value={report.data.collected}
              details={[
                report.data.collected == null
                  ? 'Không tải được chi tiết thu tiền'
                  : 'Tổng thu từ đơn hoàn tất',
                'Theo kỳ đang chọn',
              ]}
            />
            <SalesMetric
              icon="debt"
              tone="orange"
              label="Nợ mới phát sinh"
              value={report.data.debt}
              details={[
                `Phát sinh trong kỳ ${from.slice(8, 10)}/${from.slice(5, 7)} – ${to.slice(8, 10)}/${to.slice(5, 7)}`,
                'Từ đơn bán hoàn tất',
              ]}
              linked
            />
            <SalesMetric
              icon="people"
              tone="slate"
              label="Phải thu hiện tại"
              value={report.data.receivables}
              details={[
                `Quá hạn ${(report.data.overdueReceivables / 1_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} triệu`,
                `${report.data.debtorCount} khách hàng đang nợ`,
              ]}
              linked
            />
          </section>
          <Panel
            title={`Doanh số theo ngày · ${scope.owner && !scope.storeId ? 'Toàn chuỗi' : scope.warehouse}`}
          >
            <section className="report-chart-card">
              <SalesChart
                orders={report.data.orders}
                from={from}
                to={to}
                stores={scope.stores}
              />
            </section>
            <div className="report-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Cửa hàng</th>
                    <th>Doanh thu</th>
                    <th>Đơn hoàn tất</th>
                    <th>Đã thu</th>
                    <th>Nợ mới</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.name}>
                      <td>{row.name}</td>
                      <td>{amount(row.revenue)}</td>
                      <td>{row.orders}</td>
                      <td>
                        {amount(
                          report.data?.collected == null ? null : row.collected,
                        )}
                      </td>
                      <td>
                        {amount(report.data?.debt == null ? null : row.debt)}
                      </td>
                    </tr>
                  ))}
                  {!rows.length && (
                    <tr>
                      <td colSpan={5} className="report-state">
                        Không có đơn hoàn tất trong khoảng đã chọn.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <section className="report-day-table">
              <header>
                <h3>Số liệu theo ngày</h3>
                <div>
                  <button
                    type="button"
                    onClick={() => setShowDays((value) => !value)}
                  >
                    {showDays ? 'Ẩn bảng' : 'Xem bảng'}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      downloadCsv(`BaoCaoBanHang_${from}_${to}.csv`, [
                        ['Ngày', 'Số đơn', 'Doanh số'],
                        ...[...daily]
                          .sort(([a], [b]) => a.localeCompare(b))
                          .map(([date, orders]) => [
                            date,
                            orders.length,
                            orders.reduce(
                              (sum, order) => sum + (order.total ?? 0),
                              0,
                            ),
                          ]),
                      ])
                    }
                  >
                    Xuất CSV
                  </button>
                </div>
              </header>
              {showDays && (
                <div className="report-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Ngày</th>
                        <th>Số đơn</th>
                        <th>Doanh số</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...daily]
                        .sort(([a], [b]) => b.localeCompare(a))
                        .map(([date, orders]) => (
                          <tr key={date}>
                            <td>{date}</td>
                            <td>{orders.length}</td>
                            <td>
                              {amount(
                                orders.reduce(
                                  (sum, order) => sum + (order.total ?? 0),
                                  0,
                                ),
                              )}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </Panel>
        </>
      ) : (
        <LoadState
          loading={report.loading}
          error={report.error}
          reload={report.reload}
        />
      )}
    </ReportFrame>
  )
}

export function InventoryReportPage() {
  const scope = useInventoryScope()
  const [from, setFrom] = useState(monthStart),
    [to, setTo] = useState(defaultTo)
  const [query, setQuery] = useState('')
  const [onlyChanged, setOnlyChanged] = useState(true)
  const [display, setDisplay] = useState<'quantity' | 'value'>('quantity')
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
  const [tab, setTab] = useState<'stock' | 'receipts' | 'transfers' | 'counts'>(
    'stock',
  )
  const key = `inventory:${from}:${to}:${scope.storeId}`
  const loadInventory = useCallback(
    async (signal: AbortSignal) => {
      const [stock, movements, catalog] = await Promise.all([
        allPages<StockRow>(
          '/inventory/stock',
          { storeId: scope.storeId || undefined },
          signal,
        ),
        allPages<Movement>(
          '/inventory/movements',
          { storeId: scope.storeId || undefined, from, to },
          signal,
        ),
        allPages<DashboardProduct>('/products', {}, signal),
      ])
      return { stock, movements, catalog }
    },
    [from, to, scope.storeId],
  )
  const report = useLoad(key, loadInventory)
  const items = useMemo(() => {
    const products = new Map(
      (report.data?.stock ?? []).map((row) => [
        `${row.storeId}:${row.productId}`,
        row,
      ]),
    )
    const by = new Map<
      string,
      {
        storeId: number
        productId: number
        store: string
        sku: string
        name: string
        unit: string
        category: string
        incoming: number
        outgoing: number
        current: number
        value: number
      }
    >()
    const selectedMovements = (report.data?.movements ?? []).filter((row) => {
      const source = `${row.sourceType} ${row.movementType}`.toUpperCase()
      if (tab === 'receipts')
        return row.quantityChange > 0 && !source.includes('TRANSFER')
      if (tab === 'transfers') return source.includes('TRANSFER')
      if (tab === 'counts')
        return source.includes('COUNT') || source.includes('ADJUST')
      return true
    })
    const catalog = new Map((report.data?.catalog ?? []).map((p) => [p.id, p]))
    for (const stock of report.data?.stock ?? []) {
      const product = catalog.get(stock.productId)
      by.set(`${stock.storeId}:${stock.productId}`, {
        storeId: stock.storeId,
        productId: stock.productId,
        store: stock.storeName,
        sku: stock.sku,
        name: stock.partName,
        unit: stock.baseUnit,
        category: product?.categoryName ?? 'Khác',
        incoming: 0,
        outgoing: 0,
        current: stock.onHandQty,
        value: stock.stockValue ?? 0,
      })
    }
    for (const m of selectedMovements) {
      const stock = products.get(`${m.storeId}:${m.productId}`)
      const key = `${m.storeId}:${m.productId}`
      const product = catalog.get(m.productId)
      const row = by.get(key) ?? {
        storeId: m.storeId,
        productId: m.productId,
        store: stock?.storeName ?? `Kho ${m.storeId}`,
        sku: stock?.sku ?? m.sku,
        name: stock?.partName ?? m.sku,
        unit: stock?.baseUnit ?? '',
        category: product?.categoryName ?? 'Khác',
        incoming: 0,
        outgoing: 0,
        current: stock?.onHandQty ?? 0,
        value: stock?.stockValue ?? 0,
      }
      if (m.quantityChange > 0) row.incoming += m.quantityChange
      else row.outgoing += Math.abs(m.quantityChange)
      by.set(key, row)
    }
    return [...by.values()]
      .filter((row) => !onlyChanged || row.incoming > 0 || row.outgoing > 0)
      .filter((row) =>
        `${row.name} ${row.sku}`
          .toLocaleLowerCase('vi')
          .includes(query.trim().toLocaleLowerCase('vi')),
      )
      .sort(
        (a, b) =>
          a.category.localeCompare(b.category, 'vi') ||
          a.name.localeCompare(b.name, 'vi'),
      )
  }, [report.data, tab, onlyChanged, query])
  const tabRows = (report.data?.movements ?? []).filter((row) => {
    const source = `${row.sourceType} ${row.movementType}`.toUpperCase()
    if (tab === 'receipts')
      return row.quantityChange > 0 && !source.includes('TRANSFER')
    if (tab === 'transfers') return source.includes('TRANSFER')
    if (tab === 'counts')
      return source.includes('COUNT') || source.includes('ADJUST')
    return false
  })
  const groups = [...new Set(items.map((row) => row.category))].map(
    (category) => ({
      category,
      rows: items.filter((row) => row.category === category),
    }),
  )
  const periodLabel = `Kỳ ${Number(from.slice(5, 7))}/${from.slice(0, 4)}${from.slice(0, 7) === monthStart().slice(0, 7) ? ' · đang ghi' : ''}`
  const formatRange = `${from.slice(8, 10)}/${from.slice(5, 7)} – ${to.slice(8, 10)}/${to.slice(5, 7)}/${to.slice(0, 4)}`
  const tabCounts = {
    receipts: new Set(
      (report.data?.movements ?? [])
        .filter(
          (r) =>
            r.quantityChange > 0 &&
            !`${r.sourceType} ${r.movementType}`
              .toUpperCase()
              .includes('TRANSFER'),
        )
        .map((r) => `${r.sourceType}:${r.sourceId}`),
    ).size,
    transfers: new Set(
      (report.data?.movements ?? [])
        .filter((r) =>
          `${r.sourceType} ${r.movementType}`
            .toUpperCase()
            .includes('TRANSFER'),
        )
        .map((r) => `${r.sourceType}:${r.sourceId}`),
    ).size,
    counts: new Set(
      (report.data?.movements ?? [])
        .filter((r) =>
          /COUNT|ADJUST/i.test(`${r.sourceType} ${r.movementType}`),
        )
        .map((r) => `${r.sourceType}:${r.sourceId}`),
    ).size,
  }
  const inventoryValue = (report.data?.stock ?? []).reduce(
    (sum, row) => sum + (row.stockValue ?? 0),
    0,
  )
  return (
    <ReportFrame
      title="Báo cáo kho"
      subtitle="Tổng hợp nhập, xuất và tồn kho theo kỳ."
    >
      <div className="inventory-report-controls">
        <label className="inventory-period-select">
          <span>Kỳ báo cáo</span>
          <select
            value={from.slice(0, 7)}
            onChange={(event) => {
              const [year, month] = event.target.value.split('-').map(Number)
              const start = `${year}-${String(month).padStart(2, '0')}-01`
              const lastDay = new Date(year, month, 0).getDate()
              setFrom(start)
              setTo(
                event.target.value === monthStart().slice(0, 7)
                  ? defaultTo()
                  : `${year}-${String(month).padStart(2, '0')}-${lastDay}`,
              )
            }}
          >
            {Array.from({ length: 12 }, (_, index) => {
              const date = new Date()
              date.setDate(1)
              date.setMonth(date.getMonth() - index)
              const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
              return (
                <option key={value} value={value}>
                  Kỳ {date.getMonth() + 1}/{date.getFullYear()}
                  {index === 0 ? ' · đang ghi' : ''}
                </option>
              )
            })}
          </select>
        </label>
        {scope.owner && (
          <label className="inventory-store-select">
            <span>Cửa hàng</span>
            <select
              value={scope.storeId}
              onChange={(e) => scope.filter({ storeId: e.target.value })}
            >
              <option value="">Mọi cửa hàng</option>
              {scope.stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.storeName}
                </option>
              ))}
            </select>
          </label>
        )}
        {!scope.owner && (
          <div className="inventory-store-select">
            <span>Cửa hàng</span>
            <strong>{scope.warehouse}</strong>
          </div>
        )}
        <span className="inventory-period-range">
          {scope.owner && !scope.storeId ? 'Mọi cửa hàng' : scope.warehouse} ·{' '}
          {formatRange}
        </span>
        <span
          className="inventory-provisional"
          title="Số liệu tồn cuối kỳ và giá trị tồn lấy từ tồn hiện tại; tồn đầu kỳ được ước tính bằng tồn hiện tại trừ biến động trong kỳ."
        >
          Tạm tính
        </span>
        <span
          className="inventory-period-help"
          title="Tồn kho và giá trị tồn lấy theo dữ liệu hiện tại; hệ thống chưa cung cấp số dư lịch sử theo kỳ."
        >
          ⓘ
        </span>
      </div>
      {scope.owner && (
        <section className="inventory-value-card">
          <span className="inventory-value-icon">◇</span>
          <div>
            <small>Giá trị tồn hiện tại</small>
            <strong>
              {(inventoryValue / 1_000_000).toLocaleString('vi-VN', {
                maximumFractionDigits: 1,
              })}{' '}
              <small>triệu</small>
            </strong>
          </div>
          <span className="inventory-value-detail">
            Dữ liệu tồn hiện tại · {periodLabel}
          </span>
        </section>
      )}
      <Panel
        title={`${tab === 'stock' ? 'Nhập, xuất, tồn' : tab === 'receipts' ? 'Nhập hàng' : tab === 'transfers' ? 'Điều chuyển' : 'Kiểm kê'} · ${scope.owner && !scope.storeId ? 'Mọi cửa hàng' : scope.warehouse} · ${periodLabel}`}
        actions={
          report.data ? (
            <button
              className="report-panel-action"
              type="button"
              onClick={() =>
                downloadCsv(`BaoCaoKho_${from}_${to}.csv`, [
                  [
                    'Nhóm phụ tùng',
                    'Phụ tùng',
                    'SKU',
                    'Tồn đầu kỳ (ước tính)',
                    'Nhập trong kỳ',
                    'Xuất trong kỳ',
                    'Tồn hiện tại',
                    'Giá trị tồn hiện tại',
                  ],
                  ...items.map((row) => [
                    row.category,
                    row.name,
                    row.sku,
                    row.current - row.incoming + row.outgoing,
                    row.incoming,
                    row.outgoing,
                    row.current,
                    row.value,
                  ]),
                ])
              }
            >
              Xuất CSV
            </button>
          ) : undefined
        }
      >
        <div
          className="report-inventory-tabs"
          role="tablist"
          aria-label="Nhóm báo cáo kho"
        >
          {(
            [
              ['stock', 'Nhập, xuất, tồn'],
              ['receipts', `Nhập hàng (${tabCounts.receipts})`],
              ['transfers', `Điều chuyển (${tabCounts.transfers})`],
              ['counts', `Kiểm kê (${tabCounts.counts})`],
            ] as const
          ).map(([value, label]) => (
            <button
              type="button"
              role="tab"
              aria-selected={tab === value}
              key={value}
              onClick={() => setTab(value)}
            >
              {label}
            </button>
          ))}
        </div>
        {report.data ? (
          <>
            {tab === 'stock' ? (
              <div className="inventory-report-table-area">
                <div className="inventory-report-table-tools">
                  <label className="inventory-search">
                    <span>⌕</span>
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Tìm tên hoặc SKU"
                    />
                  </label>
                  <label className="inventory-changed-filter">
                    <input
                      type="checkbox"
                      checked={onlyChanged}
                      onChange={(e) => setOnlyChanged(e.target.checked)}
                    />
                    Chỉ mã có nhập hoặc xuất trong kỳ
                  </label>
                  <div
                    className="inventory-view-toggle"
                    role="group"
                    aria-label="Kiểu hiển thị"
                  >
                    <button
                      type="button"
                      aria-pressed={display === 'quantity'}
                      onClick={() => setDisplay('quantity')}
                    >
                      Số lượng
                    </button>
                    <button
                      type="button"
                      aria-pressed={display === 'value'}
                      onClick={() => setDisplay('value')}
                    >
                      Giá trị
                    </button>
                  </div>
                </div>
                <div className="report-table-wrap inventory-report-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Phụ tùng</th>
                        <th>Tồn đầu kỳ</th>
                        <th>Nhập trong kỳ</th>
                        <th>Xuất trong kỳ</th>
                        <th>Tồn cuối kỳ</th>
                        <th>Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groups.map(({ category, rows }) => {
                        const key = category
                        const isOpen = expanded.has(key)
                        const units = [
                          ...new Set(rows.map((r) => r.unit).filter(Boolean)),
                        ]
                        const sum = (
                          field:
                            'incoming' | 'outgoing' | 'current' | 'opening',
                        ) =>
                          rows.reduce(
                            (total, row) =>
                              total +
                              (field === 'opening'
                                ? row.current - row.incoming + row.outgoing
                                : row[field]),
                            0,
                          )
                        const aggregate = (
                          field:
                            'incoming' | 'outgoing' | 'current' | 'opening',
                        ) =>
                          units.length <= 1
                            ? `${sum(field).toLocaleString('vi-VN')}${units[0] ? ` ${units[0]}` : ''}`
                            : `${units.length} đơn vị`
                        return (
                          <Fragment key={key}>
                            <tr className="inventory-category-row">
                              <td>
                                <div className="inventory-category-heading">
                                  <button
                                    type="button"
                                    aria-label={`${isOpen ? 'Thu gọn' : 'Mở rộng'} ${category}`}
                                    onClick={() =>
                                      setExpanded((current) => {
                                        const next = new Set(current)
                                        isOpen
                                          ? next.delete(key)
                                          : next.add(key)
                                        return next
                                      })
                                    }
                                  >
                                    <span
                                      aria-hidden="true"
                                      className={`inventory-category-chevron${isOpen ? ' inventory-category-chevron--open' : ''}`}
                                    />
                                  </button>
                                  <strong>
                                    {category.replace(/\s*[-–—]\s*/g, ' và ')}
                                  </strong>
                                  <small>
                                    · {new Set(rows.map((row) => row.sku)).size}{' '}
                                    mã
                                  </small>
                                </div>
                              </td>
                              {display === 'quantity' ? (
                                <>
                                  <td>{aggregate('opening')}</td>
                                  <td>{aggregate('incoming')}</td>
                                  <td>{aggregate('outgoing')}</td>
                                  <td>{aggregate('current')}</td>
                                </>
                              ) : (
                                <>
                                  <td>—</td>
                                  <td>
                                    {amount(
                                      rows.reduce(
                                        (n, row) =>
                                          n +
                                          row.incoming *
                                            (row.value && row.current
                                              ? row.value / row.current
                                              : 0),
                                        0,
                                      ),
                                    )}
                                  </td>
                                  <td>
                                    {amount(
                                      rows.reduce(
                                        (n, row) =>
                                          n +
                                          row.outgoing *
                                            (row.value && row.current
                                              ? row.value / row.current
                                              : 0),
                                        0,
                                      ),
                                    )}
                                  </td>
                                  <td>
                                    {amount(
                                      rows.reduce((n, row) => n + row.value, 0),
                                    )}
                                  </td>
                                </>
                              )}
                              <td />
                            </tr>
                            {isOpen &&
                              rows.map((row) => (
                                <tr
                                  key={`${row.store}:${row.sku}`}
                                  className="inventory-product-row"
                                >
                                  <td>
                                    <strong>{row.name}</strong>
                                    <small>
                                      {row.sku}
                                      {scope.owner && !scope.storeId
                                        ? ` · ${row.store}`
                                        : ''}
                                    </small>
                                  </td>
                                  {display === 'quantity' ? (
                                    <>
                                      <td>
                                        {(
                                          row.current -
                                          row.incoming +
                                          row.outgoing
                                        ).toLocaleString('vi-VN')}{' '}
                                        {row.unit}
                                      </td>
                                      <td>
                                        {row.incoming.toLocaleString('vi-VN')}{' '}
                                        {row.unit}
                                      </td>
                                      <td>
                                        {row.outgoing.toLocaleString('vi-VN')}{' '}
                                        {row.unit}
                                      </td>
                                      <td>
                                        {row.current.toLocaleString('vi-VN')}{' '}
                                        {row.unit}
                                      </td>
                                    </>
                                  ) : (
                                    <>
                                      <td>—</td>
                                      <td>—</td>
                                      <td>—</td>
                                      <td>{amount(row.value)}</td>
                                    </>
                                  )}
                                  <td>
                                    <Link
                                      className="inventory-row-history"
                                      to={movementLink(
                                        row.productId,
                                        row.storeId,
                                      )}
                                    >
                                      Lịch sử
                                    </Link>
                                  </td>
                                </tr>
                              ))}
                          </Fragment>
                        )
                      })}
                      {!items.length && (
                        <tr>
                          <td colSpan={6} className="report-state">
                            Không có dữ liệu kho phù hợp với bộ lọc.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="report-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Ngày</th>
                      <th>Phụ tùng</th>
                      <th>Loại biến động</th>
                      <th>Số lượng</th>
                      <th>Chứng từ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tabRows.map((row) => (
                      <tr key={row.id}>
                        <td>{formatDateTime(row.occurredAt)}</td>
                        <td>{row.sku}</td>
                        <td>{row.movementType}</td>
                        <td>{row.quantityChange}</td>
                        <td>
                          {row.sourceType} · #{row.sourceId}
                        </td>
                      </tr>
                    ))}
                    {!tabRows.length && (
                      <tr>
                        <td colSpan={5} className="report-state">
                          Không có dữ liệu cho mục này trong kỳ đã chọn.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : (
          <LoadState
            loading={report.loading}
            error={report.error}
            reload={report.reload}
          />
        )}
      </Panel>
    </ReportFrame>
  )
}

export function GrossMarginReportPage() {
  const scope = useInventoryScope()
  const [from, setFrom] = useState(monthStart),
    [to, setTo] = useState(defaultTo)
  const [anchorMonth] = useState(monthStart().slice(0, 7))
  const [activePeriod, setActivePeriod] = useState<'current' | 'previous'>(
    'current',
  )
  const [categoryFilter, setCategoryFilter] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
  const [showChart, setShowChart] = useState(false)
  const previousMonth = useMemo(() => {
    const date = new Date(`${anchorMonth}-01T12:00:00`)
    date.setMonth(date.getMonth() - 1)
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
  }, [anchorMonth])
  const previousRange = useMemo(() => {
    const [year, month] = previousMonth.split('-').map(Number)
    return {
      from: `${previousMonth}-01`,
      to: day(new Date(year, month, 0)),
    }
  }, [previousMonth])
  const key = `margin:${from}:${to}:${scope.storeId}`
  const loadMargin = useCallback(
    async (signal: AbortSignal) => {
      const params = { view: 'COMPLETED', storeId: scope.storeId || undefined }
      const [orders, previousOrders, catalog] = await Promise.all([
        allPages<SummaryDto>(
          '/sales-orders',
          { ...params, createdFrom: from, createdTo: to },
          signal,
        ),
        allPages<SummaryDto>(
          '/sales-orders',
          {
            ...params,
            createdFrom: previousRange.from,
            createdTo: previousRange.to,
          },
          signal,
        ),
        allPages<DashboardProduct>('/products', {}, signal),
      ])
      const loadLines = async (rows: SummaryDto[]) => {
        if (rows.length > 150)
          return [] as (OrderDto['lines'][number] & {
            storeName: string
            storeId: number
          })[]
        const details: OrderDto[] = []
        for (let index = 0; index < rows.length; index += 4) {
          details.push(
            ...(await Promise.all(
              rows
                .slice(index, index + 4)
                .map((order) =>
                  axiosClient
                    .get<OrderDto>(`/sales-orders/${order.id}`, { signal })
                    .then((response) => response.data),
                ),
            )),
          )
        }
        return details.flatMap((order) =>
          order.lines.map((line) => ({
            ...line,
            storeName: order.storeName,
            storeId: order.storeId,
          })),
        )
      }
      const [lines, previousLines] = await Promise.all([
        loadLines(orders),
        loadLines(previousOrders),
      ])
      return {
        orders,
        previousOrders,
        lines,
        previousLines,
        catalog,
      }
    },
    [from, to, previousRange, scope.storeId],
  )
  const report = useLoad(key, loadMargin)
  const productRows = useMemo(() => {
    const grouped = new Map<
      number,
      {
        productId: number
        sku: string
        name: string
        category: string
        revenue: number
        previousRevenue: number
        quantity: number
      }
    >()
    const categories = new Map(
      (report.data?.catalog ?? []).map((product) => [
        product.id,
        product.categoryName,
      ]),
    )
    for (const line of report.data?.lines ?? []) {
      const key = line.productId
      const row = grouped.get(key) ?? {
        productId: line.productId,
        sku: line.sku,
        name: line.partName,
        category: categories.get(line.productId) ?? 'Khác',
        revenue: 0,
        previousRevenue: 0,
        quantity: 0,
      }
      row.revenue +=
        (line.deliveredQty ?? line.requestedQty) * (line.actualUnitPrice ?? 0)
      row.quantity += line.deliveredQty ?? line.requestedQty
      grouped.set(key, row)
    }
    for (const line of report.data?.previousLines ?? []) {
      const row = grouped.get(line.productId)
      if (row)
        row.previousRevenue +=
          (line.deliveredQty ?? line.requestedQty) * (line.actualUnitPrice ?? 0)
    }
    return [...grouped.values()].sort((a, b) => b.revenue - a.revenue)
  }, [report.data])
  const categoryRows = useMemo(() => {
    const grouped = new Map<
      string,
      {
        category: string
        revenue: number
        previousRevenue: number
        products: typeof productRows
      }
    >()
    for (const row of productRows) {
      if (categoryFilter && row.category !== categoryFilter) continue
      const group = grouped.get(row.category) ?? {
        category: row.category,
        revenue: 0,
        previousRevenue: 0,
        products: [],
      }
      group.revenue += row.revenue
      group.previousRevenue += row.previousRevenue
      group.products.push(row)
      grouped.set(row.category, group)
    }
    return [...grouped.values()].sort((a, b) => b.revenue - a.revenue)
  }, [productRows, categoryFilter])
  const monthLabel = (value: string) => {
    const [year, month] = value.split('-')
    return `Kỳ ${Number(month)}/${year}`
  }
  const currentMonth = anchorMonth
  const previousMonthLabel = monthLabel(previousMonth)
  const currentMonthLabel = monthLabel(currentMonth)
  const categories = [...new Set(productRows.map((row) => row.category))].sort(
    (a, b) => a.localeCompare(b, 'vi'),
  )
  const revenue =
    report.data?.orders.reduce((sum, order) => sum + (order.total ?? 0), 0) ?? 0
  const previousRevenue =
    report.data?.previousOrders.reduce(
      (sum, order) => sum + (order.total ?? 0),
      0,
    ) ?? 0
  const formatMillions = (value: number) =>
    `${(value / 1_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} triệu`
  return (
    <ReportFrame title="Lãi gộp">
      <div className="margin-report-filters">
        <div
          className="margin-period-tabs"
          role="group"
          aria-label="Chọn kỳ báo cáo"
        >
          <button
            className={activePeriod === 'current' ? 'is-active' : ''}
            type="button"
            onClick={() => {
              setActivePeriod('current')
              const [year, month] = currentMonth.split('-').map(Number)
              setFrom(`${currentMonth}-01`)
              setTo(
                currentMonth === monthStart().slice(0, 7)
                  ? defaultTo()
                  : day(new Date(year, month, 0)),
              )
            }}
          >
            {currentMonthLabel}
          </button>
          <button
            className={activePeriod === 'previous' ? 'is-active' : ''}
            type="button"
            onClick={() => {
              setActivePeriod('previous')
              setFrom(previousRange.from)
              setTo(previousRange.to)
            }}
          >
            {previousMonthLabel}
          </button>
        </div>
        {scope.owner ? (
          <label className="margin-store-filter">
            <select
              value={scope.storeId}
              onChange={(event) =>
                scope.filter({ storeId: event.target.value })
              }
            >
              <option value="">Mọi cửa hàng</option>
              {scope.stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.storeName}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <span className="margin-current-store">{scope.warehouse}</span>
        )}
        <label className="margin-category-filter">
          <select
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
          >
            <option value="">Mọi nhóm phụ tùng</option>
            {categories.map((category) => (
              <option key={category}>{category}</option>
            ))}
          </select>
        </label>
        <span className="margin-period-range">
          {scope.owner && !scope.storeId ? 'Toàn chuỗi' : scope.warehouse} ·{' '}
          {from.slice(8, 10)}/{from.slice(5, 7)} – {to.slice(8, 10)}/
          {to.slice(5, 7)}/{to.slice(0, 4)}
        </span>
        <span
          className="inventory-provisional"
          title="Giá vốn chưa được API đơn bán cung cấp nên chưa thể tính lãi gộp và tỷ lệ chính xác."
        >
          Tạm tính
        </span>
        <span
          className="inventory-period-help"
          title="Giá vốn được lưu ở tồn kho nhưng API chưa trả giá vốn theo từng dòng đơn bán."
        >
          ⓘ
        </span>
      </div>
      {report.data ? (
        <>
          <section className="margin-report-cards">
            <article>
              <span className="margin-card-icon margin-icon-blue">▥</span>
              <span>Doanh thu</span>
              <strong>{formatMillions(revenue)}</strong>
              <small>Kỳ trước: {formatMillions(previousRevenue)}</small>
            </article>
            <article>
              <span className="margin-card-icon margin-icon-slate">▤</span>
              <span>Giá vốn</span>
              <strong>Chưa có dữ liệu</strong>
              <small>Chưa có giá vốn theo dòng đơn</small>
            </article>
            <article>
              <span className="margin-card-icon margin-icon-green">▣</span>
              <span>Lãi gộp</span>
              <strong>Chưa thể tính</strong>
              <small>Cần dữ liệu giá vốn đã ghi nhận</small>
            </article>
            <article>
              <span className="margin-card-icon margin-icon-cyan">％</span>
              <span>Tỷ lệ lãi gộp</span>
              <strong>—</strong>
              <small>Chưa thể đối chiếu với {previousMonthLabel}</small>
            </article>
          </section>
          <Panel title="Theo cửa hàng">
            <div className="report-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Cửa hàng</th>
                    <th>Doanh thu</th>
                    <th>Giá vốn</th>
                    <th>Lãi gộp</th>
                    <th>Tỷ lệ</th>
                    <th>So kỳ trước</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ...report.data.orders
                      .reduce((map, order) => {
                        const entry = map.get(order.storeId) ?? {
                          name: order.storeName,
                          revenue: 0,
                        }
                        entry.revenue += order.total ?? 0
                        map.set(order.storeId, entry)
                        return map
                      }, new Map<number, { name: string; revenue: number }>())
                      .values(),
                  ].map((store, index) => (
                    <tr key={store.name}>
                      <td>
                        <span
                          className={`margin-store-dot margin-store-dot-${index % 2}`}
                        />
                        {store.name}
                      </td>
                      <td>{amount(store.revenue)}</td>
                      <td>—</td>
                      <td>—</td>
                      <td>—</td>
                      <td>Chưa có giá vốn</td>
                      <td>
                        <button
                          className="report-panel-action"
                          type="button"
                          onClick={() =>
                            scope.owner &&
                            scope.stores.find(
                              (item) => item.storeName === store.name,
                            ) &&
                            scope.filter({
                              storeId: String(
                                scope.stores.find(
                                  (item) => item.storeName === store.name,
                                )?.id ?? '',
                              ),
                            })
                          }
                        >
                          Xem riêng
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!report.data.orders.length && (
                    <tr>
                      <td colSpan={7} className="report-state">
                        Không có đơn hoàn tất trong kỳ.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Panel>
          <Panel
            title="Số liệu theo nhóm phụ tùng"
            actions={
              <div className="margin-panel-actions">
                <button
                  className="report-panel-action"
                  type="button"
                  onClick={() => setShowChart((value) => !value)}
                >
                  {showChart ? 'Ẩn biểu đồ' : 'Xem biểu đồ'}
                </button>
                <button
                  className="report-panel-action"
                  type="button"
                  onClick={() =>
                    downloadCsv(`BaoCaoLaiGop_${from}_${to}.csv`, [
                      ['Nhóm phụ tùng', 'Doanh thu', 'Giá vốn', 'Lãi gộp'],
                      ...categoryRows.map((row) => [
                        row.category,
                        row.revenue,
                        '',
                        '',
                      ]),
                    ])
                  }
                >
                  Xuất CSV
                </button>
              </div>
            }
          >
            <div className="report-note report-note--warning">
              <strong>Chưa thể tính lãi gộp chính xác.</strong> API hiện chưa
              cung cấp giá vốn đã ghi nhận theo dòng đơn bán; màn hình vẫn hiển
              thị doanh thu thật.
            </div>
            {showChart && (
              <div className="margin-category-chart">
                {categoryRows.map((row, index) => (
                  <div className="margin-category-bar-row" key={row.category}>
                    <span>{row.category}</span>
                    <div>
                      <i
                        style={{
                          width: `${Math.max(2, revenue ? (row.revenue / revenue) * 100 : 0)}%`,
                          background: [
                            '#2a78d6',
                            '#f06b36',
                            '#16a36a',
                            '#8b5cf6',
                          ][index % 4],
                        }}
                      />
                    </div>
                    <strong>{amount(row.revenue)}</strong>
                  </div>
                ))}
              </div>
            )}
            <div className="report-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Nhóm phụ tùng</th>
                    <th>Doanh thu</th>
                    <th>Giá vốn</th>
                    <th>Lãi gộp</th>
                    <th>Tỷ lệ</th>
                    <th>So kỳ trước</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {categoryRows.map((row) => {
                    const isOpen = expanded.has(row.category)
                    return (
                      <Fragment key={row.category}>
                        <tr>
                          <td>
                            <strong>{row.category}</strong>
                          </td>
                          <td>{amount(row.revenue)}</td>
                          <td>—</td>
                          <td>—</td>
                          <td>—</td>
                          <td>—</td>
                          <td>
                            <button
                              className="report-panel-action"
                              type="button"
                              onClick={() =>
                                setExpanded((current) => {
                                  const next = new Set(current)
                                  isOpen
                                    ? next.delete(row.category)
                                    : next.add(row.category)
                                  return next
                                })
                              }
                            >
                              {isOpen ? 'Thu gọn' : 'Xem phụ tùng'}
                            </button>
                          </td>
                        </tr>
                        {isOpen &&
                          row.products.map((product) => (
                            <tr
                              className="margin-product-row"
                              key={product.productId}
                            >
                              <td>
                                <strong>{product.name}</strong>
                                <small>
                                  {product.sku} · {product.quantity} sản phẩm
                                </small>
                              </td>
                              <td>{amount(product.revenue)}</td>
                              <td>—</td>
                              <td>—</td>
                              <td>—</td>
                              <td>
                                {product.previousRevenue
                                  ? amount(product.previousRevenue)
                                  : '—'}
                              </td>
                              <td />
                            </tr>
                          ))}
                      </Fragment>
                    )
                  })}
                  {!categoryRows.length && (
                    <tr>
                      <td colSpan={7} className="report-state">
                        {report.data.orders.length > 150
                          ? 'Có trên 150 đơn trong kỳ; chưa tải chi tiết mặt hàng để tránh tạo quá nhiều request.'
                          : 'Không có chi tiết phụ tùng trong khoảng đã chọn.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      ) : (
        <LoadState
          loading={report.loading}
          error={report.error}
          reload={report.reload}
        />
      )}
    </ReportFrame>
  )
}

function csvCell(value: unknown) {
  return '"' + String(value ?? '').replaceAll('"', '""') + '"'
}
function downloadCsv(name: string, rows: unknown[][]) {
  const content =
    '\ufeff' + rows.map((row) => row.map(csvCell).join(',')).join('\r\n')
  const url = URL.createObjectURL(
    new Blob([content], { type: 'text/csv;charset=utf-8' }),
  )
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function xmlEscape(value: unknown) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function columnName(index: number) {
  let value = index + 1
  let name = ''
  while (value) {
    value--
    name = String.fromCharCode(65 + (value % 26)) + name
    value = Math.floor(value / 26)
  }
  return name
}

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++)
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function createXlsx(sheets: { name: string; rows: unknown[][] }[]) {
  const encoder = new TextEncoder()
  const xmlFiles = [
    {
      name: '[Content_Types].xml',
      text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`,
    },
    {
      name: '_rels/.rels',
      text: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    },
    {
      name: 'xl/workbook.xml',
      text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((sheet, i) => `<sheet name="${xmlEscape(sheet.name.slice(0, 31))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`,
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}</Relationships>`,
    },
    ...sheets.map((sheet, i) => ({
      name: `xl/worksheets/sheet${i + 1}.xml`,
      text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheet.rows
        .map(
          (row, rowIndex) =>
            `<row r="${rowIndex + 1}">${row
              .map((cell, columnIndex) => {
                const ref = `${columnName(columnIndex)}${rowIndex + 1}`
                return typeof cell === 'number' && Number.isFinite(cell)
                  ? `<c r="${ref}"><v>${cell}</v></c>`
                  : `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(cell)}</t></is></c>`
              })
              .join('')}</row>`,
        )
        .join('')}</sheetData></worksheet>`,
    })),
  ].map((file) => ({
    name: encoder.encode(file.name),
    bytes: encoder.encode(file.text),
  }))
  const now = new Date()
  const time =
    (now.getHours() << 11) |
    (now.getMinutes() << 5) |
    Math.floor(now.getSeconds() / 2)
  const date =
    ((now.getFullYear() - 1980) << 9) |
    ((now.getMonth() + 1) << 5) |
    now.getDate()
  const localParts: Uint8Array[] = []
  const centralParts: Uint8Array[] = []
  let offset = 0
  const u16 = (view: DataView, at: number, value: number) =>
    view.setUint16(at, value, true)
  const u32 = (view: DataView, at: number, value: number) =>
    view.setUint32(at, value, true)
  for (const file of xmlFiles) {
    const crc = crc32(file.bytes)
    const local = new Uint8Array(30 + file.name.length)
    const localView = new DataView(local.buffer)
    u32(localView, 0, 0x04034b50)
    u16(localView, 4, 20)
    u16(localView, 6, 0x0800)
    u16(localView, 8, 0)
    u16(localView, 10, time)
    u16(localView, 12, date)
    u32(localView, 14, crc)
    u32(localView, 18, file.bytes.length)
    u32(localView, 22, file.bytes.length)
    u16(localView, 26, file.name.length)
    u16(localView, 28, 0)
    local.set(file.name, 30)
    localParts.push(local, file.bytes)
    const central = new Uint8Array(46 + file.name.length)
    const centralView = new DataView(central.buffer)
    u32(centralView, 0, 0x02014b50)
    u16(centralView, 4, 20)
    u16(centralView, 6, 20)
    u16(centralView, 8, 0x0800)
    u16(centralView, 10, 0)
    u16(centralView, 12, time)
    u16(centralView, 14, date)
    u32(centralView, 16, crc)
    u32(centralView, 20, file.bytes.length)
    u32(centralView, 24, file.bytes.length)
    u16(centralView, 28, file.name.length)
    u16(centralView, 30, 0)
    u16(centralView, 32, 0)
    u16(centralView, 34, 0)
    u16(centralView, 36, 0)
    u32(centralView, 38, 0)
    u32(centralView, 42, offset)
    central.set(file.name, 46)
    centralParts.push(central)
    offset += local.length + file.bytes.length
  }
  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0)
  const end = new Uint8Array(22)
  const endView = new DataView(end.buffer)
  u32(endView, 0, 0x06054b50)
  u16(endView, 4, 0)
  u16(endView, 6, 0)
  u16(endView, 8, xmlFiles.length)
  u16(endView, 10, xmlFiles.length)
  u32(endView, 12, centralSize)
  u32(endView, 16, offset)
  u16(endView, 20, 0)
  const parts = [...localParts, ...centralParts, end]
  const archive = new Uint8Array(
    parts.reduce((sum, part) => sum + part.length, 0),
  )
  let archiveOffset = 0
  for (const part of parts) {
    archive.set(part, archiveOffset)
    archiveOffset += part.length
  }
  return new Blob([archive.buffer as ArrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

function downloadBlob(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
export function AccountingExportPage() {
  const scope = useInventoryScope()
  const [from, setFrom] = useState(monthStart),
    [to, setTo] = useState(defaultTo),
    [selected, setSelected] = useState(true),
    [exported, setExported] = useState(''),
    [history, setHistory] = useState<
      { filename: string; createdAt: string; rows: number; blob: Blob }[]
    >([])
  const key = `accounting:${from}:${to}:${scope.storeId}`
  const loadDocuments = useCallback(
    (signal: AbortSignal) =>
      allPages<DocumentRow>(
        '/documents',
        { from, to, storeId: scope.storeId || undefined },
        signal,
      ),
    [from, to, scope.storeId],
  )
  const report = useLoad(key, loadDocuments)
  const toggle = () => setSelected((value) => !value)
  const periodChoices = Array.from({ length: 12 }, (_, index) => {
    const date = new Date()
    date.setDate(1)
    date.setMonth(date.getMonth() - index)
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
  })
  const exportDocuments = () => {
    if (!report.data?.length) return
    const rows: unknown[][] = [
      [
        'Số chứng từ',
        'Loại',
        'Ngày',
        'Cửa hàng',
        'Đối tượng',
        'Trạng thái',
        'Giá trị',
      ],
      ...report.data.map((row) => [
        row.number,
        row.type,
        row.documentDate,
        row.storeName,
        row.partnerName,
        row.status,
        row.value,
      ]),
    ]
    const filename = `MotoFlow_ke_toan_${from.slice(0, 7)}.xlsx`
    const blob = createXlsx([{ name: 'Danh sach chung tu', rows }])
    downloadBlob(filename, blob)
    setExported(filename)
    setHistory((previous) =>
      [
        {
          filename,
          createdAt: new Date().toISOString(),
          rows: report.data!.length,
          blob,
        },
        ...previous.filter((item) => item.filename !== filename),
      ].slice(0, 5),
    )
  }
  return (
    <ReportFrame
      title="Xuất dữ liệu kế toán"
      subtitle="Xuất các bộ dữ liệu phục vụ đối chiếu kế toán."
    >
      <Panel title="Chọn dữ liệu">
        <div className="accounting-export-filters">
          <label>
            <span>
              Kỳ kho <b>*</b>
            </span>
            <select
              value={from.slice(0, 7)}
              onChange={(event) => {
                const [year, month] = event.target.value.split('-').map(Number)
                setFrom(`${event.target.value}-01`)
                setTo(
                  event.target.value === monthStart().slice(0, 7)
                    ? defaultTo()
                    : day(new Date(year, month, 0)),
                )
              }}
            >
              {periodChoices.map((period, index) => {
                const [year, month] = period.split('-')
                return (
                  <option key={period} value={period}>
                    Kỳ {Number(month)}/{year}
                    {index === 0 ? ' · đang ghi' : ' · đã đóng'}
                  </option>
                )
              })}
            </select>
          </label>
          {scope.owner && (
            <label>
              <span>Cửa hàng</span>
              <select
                value={scope.storeId}
                onChange={(event) =>
                  scope.filter({ storeId: event.target.value })
                }
              >
                <option value="">Mọi cửa hàng</option>
                {scope.stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.storeName}
                  </option>
                ))}
              </select>
            </label>
          )}
          {!scope.owner && (
            <label>
              <span>Cửa hàng</span>
              <strong>{scope.warehouse}</strong>
            </label>
          )}
        </div>
        <section className="report-export-sets">
          <header>
            <strong>
              Bộ dữ liệu <b>*</b>
            </strong>
            <button type="button" onClick={toggle}>
              {selected ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
            </button>
          </header>
          {[
            [
              'Doanh thu theo ngày',
              'Doanh số đơn hoàn tất, tiền thu đã xác minh và nợ mới.',
            ],
            [
              'Đơn bán và dòng đơn',
              'Số đơn, khách hàng, phụ tùng, số lượng, đơn giá và chiết khấu.',
            ],
            [
              'Nhập hàng và giá nhập',
              'Phiếu nhập, lượt nhận, nhà cung cấp, phụ tùng và giá nhập.',
            ],
            [
              'Thu tiền và công nợ',
              'Phiếu thu, hoàn tiền và số dư nợ cuối kỳ.',
            ],
            [
              'Nhập, xuất, tồn kỳ',
              'Số lượng, giá trị và giá vốn bình quân theo phụ tùng.',
            ],
            [
              'Danh sách chứng từ',
              'Số, loại, ngày, cửa hàng, đối tượng, trạng thái và giá trị.',
            ],
          ].map(([label, description], index) => (
            <label className="report-export-set" key={label}>
              <span>
                <input
                  type="checkbox"
                  checked={index === 5 && selected}
                  disabled={index !== 5}
                  onChange={toggle}
                />
                <strong>{label}</strong>
                <small>
                  {index === 5
                    ? description
                    : `${description} · Chưa được API BE hỗ trợ`}
                </small>
              </span>
              <small
                className={
                  index === 5 && report.error ? 'accounting-status--error' : ''
                }
              >
                {index === 5
                  ? report.data
                    ? `${report.data.length} dòng`
                    : report.error
                      ? 'Không tải được'
                      : 'Đang tải…'
                  : 'Chưa khả dụng'}
              </small>
            </label>
          ))}
        </section>
        <div className="report-export-footer">
          <span>
            {exported
              ? `Đã xuất ${exported}`
              : report.data
                ? `Xuất 1 bộ dữ liệu · ${report.data.length.toLocaleString('vi-VN')} dòng`
                : 'Tệp Excel (.xlsx)'}
          </span>
          <button
            className="report-primary"
            type="button"
            disabled={!selected || !report.data?.length}
            onClick={exportDocuments}
          >
            Xuất Excel
          </button>
        </div>
        {report.error && (
          <div className="accounting-load-error" role="status">
            Không tải được danh sách chứng từ. {report.error}
            <button type="button" onClick={report.reload}>
              Thử lại
            </button>
          </div>
        )}
        <div className="report-note">
          Hiện chỉ bộ danh sách chứng từ có API để xuất. Các bộ còn lại sẽ được
          bật khi API kế toán tương ứng khả dụng.
        </div>
      </Panel>
      <Panel title="Lần xuất trên thiết bị này">
        <div className="report-export-history">
          {history.length ? (
            <>
              <div className="report-export-history-head">
                <span>Tệp</span>
                <span>Người xuất</span>
                <span>Thao tác</span>
              </div>
              {history.map((item) => (
                <div key={item.filename}>
                  <span>
                    {item.filename}
                    <small>
                      Kỳ{' '}
                      {Number(
                        item.filename.match(/_(\d{4})-(\d{2})/)?.[2] ?? 0,
                      )}
                      /{item.filename.match(/_(\d{4})-(\d{2})/)?.[1]} ·{' '}
                      {item.rows.toLocaleString('vi-VN')} dòng
                    </small>
                  </span>
                  <small>Bạn · {formatDateTime(item.createdAt)}</small>
                  <button
                    type="button"
                    onClick={() => downloadBlob(item.filename, item.blob)}
                  >
                    Tải lại
                  </button>
                </div>
              ))}
            </>
          ) : (
            <p>Chưa có lần xuất nào trong phiên này.</p>
          )}
        </div>
      </Panel>
    </ReportFrame>
  )
}
