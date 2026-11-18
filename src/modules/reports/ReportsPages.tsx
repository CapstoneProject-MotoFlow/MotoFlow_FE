import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import axiosClient from '../../shared/api/axiosClient'
import { useInventoryScope } from '../inventory/api'
import type { Movement, Page, StockRow } from '../inventory/types'
import type { OrderDto, SummaryDto } from '../sales/salesApi'
import type { DocumentRow } from '../documents/types'
import type { Debtor } from '../receivables/types'
import type { Customer } from '../customers/types'
import type { DashboardProduct } from '../dashboard/types/dashboardTypes'
import PageHeader from '../../shared/ui/PageHeader'
import { formatMoney, formatDateTime } from '../../shared/utils/format'
import { inventoryError } from '../inventory/api'
import { movementLink } from '../inventory/presentation'
import { createXlsx, downloadBlob } from '../../shared/utils/xlsx'
import { documentStatus, documentTypes } from '../documents/model'
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
  params: Record<string, string | number | boolean | undefined>,
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

function effectiveMovements(rows: Movement[]) {
  const visible = rows.filter((row) => row.stockStatus !== 'IN_TRANSIT')
  const totals = new Map<string, number>()
  for (const row of visible) {
    const key = `${row.storeId}:${row.productId}:${row.sourceType}:${row.sourceId}`
    totals.set(key, (totals.get(key) ?? 0) + row.quantityChange)
  }
  return visible.filter((row) => {
    const key = `${row.storeId}:${row.productId}:${row.sourceType}:${row.sourceId}`
    return totals.get(key) !== 0
  })
}

async function pastDateStock(date: string, storeId: number, signal: AbortSignal) {
  const rows: { productId: number; sku: string; partName: string; baseUnit: string; closingQty: number; storeId: number }[] = []
  for (let page = 0; ; page++) {
    const { data } = await axiosClient.get<{
      page: Page<Omit<(typeof rows)[number], 'storeId'>>
    }>('/inventory/past-date-stock', {
      params: { date, storeId, includeZero: true, page, size: 100 },
      signal,
    })
    rows.push(...data.page.items.map((row) => ({ ...row, storeId })))
    if (!data.page.items.length || rows.length >= data.page.totalItems) return rows
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
  const ownerStoreIds = scope.stores.map((store) => store.id).join(',')
  const userStoreId = scope.user?.storeId
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
  const historicalPeriod = to < defaultTo()
  const loadInventory = useCallback(
    async (signal: AbortSignal) => {
      const [stock, movements, catalog] = await Promise.all([
        allPages<StockRow>(
          '/inventory/stock',
          { storeId: scope.storeId || undefined, includeZero: true },
          signal,
        ),
        allPages<Movement>(
          '/inventory/movements',
          { storeId: scope.storeId || undefined, from, to },
          signal,
        ),
        allPages<DashboardProduct>('/products', {}, signal),
      ])
      let opening: Awaited<ReturnType<typeof pastDateStock>> = []
      let closing: Awaited<ReturnType<typeof pastDateStock>> = []
      if (historicalPeriod) {
        const storeIds = scope.storeId
          ? [Number(scope.storeId)]
          : scope.owner
            ? [...new Set([...ownerStoreIds.split(',').filter(Boolean).map(Number), ...stock.map((row) => row.storeId)])]
            : userStoreId
              ? [userStoreId]
              : []
        const beforeFrom = new Date(`${from}T12:00:00`)
        beforeFrom.setDate(beforeFrom.getDate() - 1)
        const openingDate = day(beforeFrom)
        const [openingByStore, closingByStore] = await Promise.all([
          Promise.all(storeIds.map((id) => pastDateStock(openingDate, id, signal))),
          Promise.all(storeIds.map((id) => pastDateStock(to, id, signal))),
        ])
        opening = openingByStore.flat()
        closing = closingByStore.flat()
      }
      return { stock, movements, catalog, opening, closing }
    },
    [from, to, scope.storeId, scope.owner, ownerStoreIds, userStoreId, historicalPeriod],
  )
  const report = useLoad(key, loadInventory)
  const items = useMemo(() => {
    const closing = new Map(
      (report.data?.closing ?? []).map((row) => [`${row.storeId}:${row.productId}`, row]),
    )
    const opening = new Map(
      (report.data?.opening ?? []).map((row) => [`${row.storeId}:${row.productId}`, row.closingQty]),
    )
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
        opening: number
      }
    >()
    const selectedMovements = effectiveMovements(report.data?.movements ?? []).filter((row) => {
      const source = `${row.sourceType} ${row.movementType}`.toUpperCase()
      if (tab === 'receipts')
        return ['RECEIPT_CONFIRMED', 'EXCESS_ACCEPTED'].includes(row.movementType)
      if (tab === 'transfers') return source.includes('TRANSFER')
      if (tab === 'counts')
        return source.includes('COUNT') || source.includes('ADJUST')
      return true
    })
    const catalog = new Map((report.data?.catalog ?? []).map((p) => [p.id, p]))
    const reportStock = (report.data?.stock ?? []).map((stock) => {
      const historic = closing.get(`${stock.storeId}:${stock.productId}`)
      return historicalPeriod
        ? { ...stock, onHandQty: historic?.closingQty ?? 0 }
        : stock
    })
    for (const stock of reportStock) {
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
        opening: opening.get(`${stock.storeId}:${stock.productId}`) ?? (historicalPeriod ? 0 : stock.onHandQty),
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
        opening: opening.get(`${m.storeId}:${m.productId}`) ?? (historicalPeriod ? 0 : (stock?.onHandQty ?? 0)),
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
  }, [report.data, tab, onlyChanged, query, historicalPeriod])
  const tabRows = effectiveMovements(report.data?.movements ?? []).filter((row) => {
    const source = `${row.sourceType} ${row.movementType}`.toUpperCase()
    if (tab === 'receipts')
      return ['RECEIPT_CONFIRMED', 'EXCESS_ACCEPTED'].includes(row.movementType)
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
      effectiveMovements(report.data?.movements ?? [])
        .filter(
          (r) =>
          ['RECEIPT_CONFIRMED', 'EXCESS_ACCEPTED'].includes(r.movementType),
        )
        .map((r) => `${r.sourceType}:${r.sourceId}`),
    ).size,
    transfers: new Set(
        effectiveMovements(report.data?.movements ?? [])
        .filter((r) =>
          `${r.sourceType} ${r.movementType}`
            .toUpperCase()
            .includes('TRANSFER'),
        )
        .map((r) => `${r.sourceType}:${r.sourceId}`),
    ).size,
    counts: new Set(
        effectiveMovements(report.data?.movements ?? [])
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
  const openingQty = (row: (typeof items)[number]) =>
    historicalPeriod ? row.opening : row.current - row.incoming + row.outgoing
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
        {to >= defaultTo() && (
          <span
            className="inventory-provisional"
            title="Kỳ đang diễn ra, số liệu có thể thay đổi."
          >
            Tạm tính
          </span>
        )}
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
                    openingQty(row),
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
                  {scope.owner && <div
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
                  </div>}
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
                              field === 'opening' ? openingQty(row) : row[field],
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
                                        if (isOpen) next.delete(key)
                                        else next.add(key)
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
                                          openingQty(row)
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
  const comparisonRange = useMemo(() => {
    const date = new Date(`${from.slice(0, 7)}-01T12:00:00`)
    date.setMonth(date.getMonth() - 1)
    const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    return {
      from: `${month}-01`,
      to: day(new Date(date.getFullYear(), date.getMonth() + 1, 0)),
    }
  }, [from])
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
            createdFrom: comparisonRange.from,
            createdTo: comparisonRange.to,
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
    [from, to, comparisonRange, scope.storeId],
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
                                  if (isOpen) next.delete(row.category)
                                  else next.add(row.category)
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

export function AccountingExportPage() {
  const scope = useInventoryScope()
  const [from, setFrom] = useState(monthStart),
    [to, setTo] = useState(defaultTo),
    [selected, setSelected] = useState<Set<string>>(() => new Set(['documents'])),
    [exported, setExported] = useState(''),
    [exportError, setExportError] = useState(''),
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
  const availableSets = ['receipts', 'payments', 'inventory', 'documents']
  const toggle = (key: string) =>
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  const toggleAvailable = () =>
    setSelected((current) =>
      availableSets.every((key) => current.has(key))
        ? new Set()
        : new Set(availableSets),
    )
  const periodChoices = Array.from({ length: 12 }, (_, index) => {
    const date = new Date()
    date.setDate(1)
    date.setMonth(date.getMonth() - index)
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
  })
  const exportSelected = async () => {
    if (!selected.size) return
    setExportError('')
    const sheets: { name: string; rows: unknown[][] }[] = []
    const signal = new AbortController().signal
    let totalRows = 0
    try {
      if (selected.has('documents') && report.data) {
        const rows: unknown[][] = [
          ['Số chứng từ', 'Loại', 'Ngày', 'Cửa hàng', 'Đối tượng', 'Trạng thái', 'Giá trị'],
          ...report.data.map((row) => [
            row.number,
            documentTypes[row.type],
            row.documentDate.slice(0, 10).split('-').reverse().join('/'),
            row.storeName,
            row.partnerName ?? row.otherStoreName,
            documentStatus(row.type, row.status),
            row.value,
          ]),
        ]
        sheets.push({ name: 'Danh sach chung tu', rows })
        totalRows += report.data.length
      }
      if (selected.has('receipts')) {
        type ReceiptSummary = { id: number; status: string; supplierName: string; storeId: number; storeName: string; deliveryDocumentNo: string | null; arrivedAt: string; confirmedAt: string | null }
        type ReceiptDetail = ReceiptSummary & { lines: { sku: string; partName: string; baseUnit: string; deliveredQty: number; passedQty: number; unitPrice: number | null; excessDecision: string | null }[] }
        const receipts = await allPages<ReceiptSummary>(
          '/goods-receipt-notes',
          { storeId: scope.storeId || undefined },
          signal,
        )
        const periodReceipts = receipts.filter((receipt) => {
          const date = receipt.arrivedAt.slice(0, 10)
          return date >= from && date <= to
        })
        const details: ReceiptDetail[] = []
        for (let index = 0; index < periodReceipts.length; index += 8) {
          details.push(...await Promise.all(periodReceipts.slice(index, index + 8).map(async (receipt) => {
            const { data } = await axiosClient.get<ReceiptDetail>(`/goods-receipt-notes/${receipt.id}`)
            return data
          })))
        }
        const rows: unknown[][] = [['Phiếu nhập', 'Ngày nhận', 'Nhà cung cấp', 'Cửa hàng', 'SKU', 'Phụ tùng', 'Số lượng nhận', 'Số lượng vào kho', 'Đơn giá nhập', 'Thành tiền']]
        for (const receipt of details) for (const line of receipt.lines) {
          const qty = line.passedQty
          rows.push([`PN-${receipt.id}`, receipt.arrivedAt.slice(0, 10).split('-').reverse().join('/'), receipt.supplierName, receipt.storeName, line.sku, line.partName, line.deliveredQty, qty, line.unitPrice, line.unitPrice == null ? null : line.unitPrice * qty])
        }
        sheets.push({ name: 'Nhap hang', rows })
        totalRows += rows.length - 1
      }
      if (selected.has('payments')) {
        type CustomerDebtData = { customerId: number; customerName: string; storeId: number | null; storeName: string | null; debts: { id: number; originType: string; salesOrderId: number | null; originalAmount: number; correctionAmount: number; collectedAmount: number; remainingAmount: number; status: string; dueDate: string; recognizedAt: string; note: string | null }[]; payments: { id: number; amount: number; tenderedAmount: number | null; changeAmount: number | null; paymentMethod: string; transactionReference: string | null; status: string; recordedAt: string; recordedBy: string; storeName: string; allocations: { receivableId: number; allocatedAmount: number }[] }[] }
        const customers = await allPages<Customer>('/customers', {}, signal)
        const records: CustomerDebtData[] = []
        for (let index = 0; index < customers.length; index += 8) {
          records.push(...await Promise.all(customers.slice(index, index + 8).map(async (customer) => {
            const { data } = await axiosClient.get<CustomerDebtData>(`/customers/${customer.id}/debts`, {
              params: { storeId: scope.storeId || undefined },
            })
            return data
          })))
        }
        const payments = records.flatMap((record) => record.payments.filter((payment) => payment.recordedAt.slice(0, 10) >= from && payment.recordedAt.slice(0, 10) <= to).map((payment) => ({ record, payment })))
        const debts = records.flatMap((record) => record.debts.filter((debt) => debt.recognizedAt.slice(0, 10) >= from && debt.recognizedAt.slice(0, 10) <= to).map((debt) => ({ record, debt })))
        const paymentRows: unknown[][] = [['Mã phiếu thu', 'Ngày thu', 'Khách hàng', 'Cửa hàng', 'Phương thức', 'Mã giao dịch', 'Người ghi nhận', 'Số tiền', 'Tiền khách đưa', 'Tiền thối lại', 'Trạng thái']]
        for (const { record, payment } of payments) paymentRows.push([`PT-${payment.id}`, payment.recordedAt.slice(0, 10).split('-').reverse().join('/'), record.customerName, payment.storeName, payment.paymentMethod, payment.transactionReference, payment.recordedBy, payment.amount, payment.tenderedAmount, payment.changeAmount, payment.status])
        const debtRows: unknown[][] = [['Mã khoản nợ', 'Ngày ghi nhận', 'Khách hàng', 'Cửa hàng', 'Nguồn', 'Đơn bán', 'Nợ ban đầu', 'Điều chỉnh', 'Đã thu', 'Còn nợ', 'Đến hạn', 'Trạng thái']]
        for (const { record, debt } of debts) debtRows.push([`NO-${debt.id}`, debt.recognizedAt.slice(0, 10).split('-').reverse().join('/'), record.customerName, record.storeName, debt.originType, debt.salesOrderId ? `SO-${debt.salesOrderId}` : null, debt.originalAmount, debt.correctionAmount, debt.collectedAmount, debt.remainingAmount, debt.dueDate.split('-').reverse().join('/'), debt.status])
        sheets.push({ name: 'Thu tien', rows: paymentRows }, { name: 'Cong no', rows: debtRows })
        totalRows += paymentRows.length + debtRows.length - 2
      }
      if (selected.has('inventory')) {
        const [stock, movements] = await Promise.all([
          allPages<StockRow>('/inventory/stock', { storeId: scope.storeId || undefined, includeZero: true }, signal),
          allPages<Movement>('/inventory/movements', { storeId: scope.storeId || undefined, from, to }, signal),
        ])
        const stores = scope.storeId ? [Number(scope.storeId)] : scope.owner ? [...new Set([...scope.stores.map((store) => store.id), ...stock.map((row) => row.storeId)])] : scope.user?.storeId ? [scope.user.storeId] : []
        const historical = to < defaultTo()
        const [openingLists, closingLists] = historical ? await Promise.all([
          Promise.all(stores.map((storeId) => { const date = new Date(`${from}T12:00:00`); date.setDate(date.getDate() - 1); return pastDateStock(day(date), storeId, signal) })),
          Promise.all(stores.map((storeId) => pastDateStock(to, storeId, signal))),
        ]) : [[], []]
        const openingMap = new Map(openingLists.flat().map((row) => [`${row.storeId}:${row.productId}`, row.closingQty]))
        const closingMap = new Map(closingLists.flat().map((row) => [`${row.storeId}:${row.productId}`, row.closingQty]))
        const netMovements = effectiveMovements(movements)
        const rows: unknown[][] = [['Cửa hàng', 'Mã phụ tùng', 'SKU', 'Phụ tùng', 'Tồn đầu kỳ', 'Nhập trong kỳ', 'Xuất trong kỳ', 'Tồn cuối kỳ', 'Giá trị tồn hiện tại']]
        for (const item of stock) {
          const changes = netMovements.filter((movement) => movement.storeId === item.storeId && movement.productId === item.productId)
          const incoming = changes.filter((movement) => movement.quantityChange > 0).reduce((sum, movement) => sum + movement.quantityChange, 0)
          const outgoing = changes.filter((movement) => movement.quantityChange < 0).reduce((sum, movement) => sum + Math.abs(movement.quantityChange), 0)
          rows.push([item.storeName, item.productId, item.sku, item.partName, historical ? (openingMap.get(`${item.storeId}:${item.productId}`) ?? 0) : item.onHandQty - incoming + outgoing, incoming, outgoing, historical ? (closingMap.get(`${item.storeId}:${item.productId}`) ?? 0) : item.onHandQty, item.stockValue])
        }
        sheets.push({ name: 'Nhap xuat ton', rows })
        totalRows += rows.length - 1
      }
      if (!sheets.length) return
    } catch (error) {
      setExportError(inventoryError(error))
      return
    }
    const filename = `MotoFlow_ke_toan_${from.slice(0, 7)}.xlsx`
    const blob = createXlsx(sheets)
    downloadBlob(filename, blob)
    setExported(filename)
    setHistory((previous) =>
      [
        {
          filename,
          createdAt: new Date().toISOString(),
          rows: totalRows,
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
                    {index === 0 ? ' · đang ghi' : ''}
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
            <button type="button" onClick={toggleAvailable}>
              {availableSets.every((key) => selected.has(key))
                ? 'Bỏ chọn bộ khả dụng'
                : 'Chọn bộ khả dụng'}
            </button>
          </header>
          {[
            ['sales-daily',
              'Doanh thu theo ngày',
              'Doanh số đơn hoàn tất, tiền thu đã xác minh và nợ mới.',
            ],
            ['sales-lines',
              'Đơn bán và dòng đơn',
              'Số đơn, khách hàng, phụ tùng, số lượng, đơn giá và chiết khấu.',
            ],
            ['receipts',
              'Nhập hàng và giá nhập',
              'Phiếu nhập, lượt nhận, nhà cung cấp, phụ tùng và giá nhập.',
            ],
            ['payments',
              'Thu tiền và công nợ',
              'Phiếu thu, hoàn tiền và số dư nợ cuối kỳ.',
            ],
            ['inventory',
              'Nhập, xuất, tồn kỳ',
              'Số lượng, giá trị và giá vốn bình quân theo phụ tùng.',
            ],
            ['documents',
              'Danh sách chứng từ',
              'Số, loại, ngày, cửa hàng, đối tượng, trạng thái và giá trị.',
            ],
          ].map(([key, label, description]) => (
            <label className="report-export-set" key={label}>
              <span>
                <input
                  type="checkbox"
                  checked={selected.has(key)}
                  disabled={key === 'sales-daily' || key === 'sales-lines'}
                  onChange={() => toggle(key)}
                />
                <strong>{label}</strong>
                <small>
                  {key === 'sales-daily' || key === 'sales-lines'
                    ? `${description} · Đang chờ API báo cáo bán hàng từ BE`
                    : description}
                </small>
              </span>
              <small
                className={
                  key === 'documents' && report.error ? 'accounting-status--error' : ''
                }
              >
                {key === 'documents'
                  ? report.data
                    ? `${report.data.length} dòng`
                    : report.error
                      ? 'Không tải được'
                      : 'Đang tải…'
                  : key === 'sales-daily' || key === 'sales-lines'
                    ? 'Chưa khả dụng'
                    : 'Có thể xuất'}
              </small>
            </label>
          ))}
        </section>
        <div className="report-export-footer">
          <span>
            {exported
              ? `Đã xuất ${exported}`
              : `Xuất ${selected.size} bộ dữ liệu · Tệp Excel (.xlsx)`}
          </span>
          <button
            className="report-primary"
            type="button"
            disabled={!selected.size || (selected.has('documents') && (!report.data?.length || report.loading))}
            onClick={() => void exportSelected()}
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
        {exportError && (
          <div className="accounting-load-error" role="alert">
            Không xuất được dữ liệu. {exportError}
          </div>
        )}
        <div className="report-note">
          Các bộ nhập hàng, thu tiền/công nợ, nhập xuất tồn và danh sách chứng từ
          được ghép từ API nghiệp vụ. Dữ liệu bán hàng đang chờ API báo cáo của BE.
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
