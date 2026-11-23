/**
 * File: modules/reports/SalesReportPage.tsx
 * Loại: MÀN HÌNH.
 * Công dụng: UC-87 Báo cáo bán hàng và thu tiền theo mẫu PM 19/11/2026: lọc kỳ, cửa hàng, xem theo ngày/tháng;
 * 4 thẻ so sánh với kỳ trước; biểu đồ cột (mỗi cửa hàng một cột); đối chiếu công nợ phải thu;
 * bảng theo cửa hàng và chi tiết theo ngày. Số liệu lấy từ BE GET /reports/sales-collection, FE chỉ cộng/chia để hiển thị.
 */
import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import axiosClient from '../../shared/api/axiosClient'
import Icon, { type IconName } from '../../shared/ui/Icon'
import PageHeader from '../../shared/ui/PageHeader'
import SearchableFilter from '../../shared/ui/SearchableFilter'
import { mapConcurrent } from '../../shared/utils/mapConcurrent'
import { createXlsx, downloadBlob } from '../../shared/utils/xlsx'
import { useInventoryScope } from '../inventory/api'
import { day, defaultTo, useLoad } from './reportData'
import './reports.css'
import './sales-report.css'

type Figures = {
  completedOrders: number
  revenue: number
  orderPayments: number
  refunds: number
  debtCollected: number
  totalCollected: number
  creditSales: number
  revenueCorrections: number
  collectionCorrections: number
  receivableCorrections: number
  receivableAtEnd: number | null
}
type PeriodRow = { from: string; to: string; figures: Figures }
type StoreRow = { storeId: number; storeName: string; figures: Figures }
type Grouping = 'DAY' | 'MONTH'
type SalesCollection = {
  from: string
  to: string
  groupBy: Grouping
  storeId: number | null
  total: Figures
  periods: PeriodRow[]
  stores: StoreRow[]
}
type ShownStore = StoreRow & { color: string }
type Series = ShownStore & { periods: PeriodRow[] }
type Preset = 'today' | 'week' | 'month' | 'lastMonth' | 'custom'

const storeColors = ['#2a78d6', '#f06b36', '#19a974', '#8b5cf6', '#e8a317']

/** "2026-11-05" cộng/trừ số ngày. */
function shift(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}
const daysBetween = (from: string, to: string) =>
  Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
      86_400_000,
  )
const lastDay = (month: string) => {
  const [year, value] = month.split('-').map(Number)
  return new Date(Date.UTC(year, value, 0)).getUTCDate()
}
const previousMonth = (month: string) => {
  const [year, value] = month.split('-').map(Number)
  return value === 1
    ? `${year - 1}-12`
    : `${year}-${String(value - 1).padStart(2, '0')}`
}

function presetRange(preset: Exclude<Preset, 'custom'>) {
  const today = defaultTo()
  if (preset === 'today') return { from: today, to: today }
  if (preset === 'week') return { from: shift(today, -6), to: today }
  if (preset === 'month') return { from: `${today.slice(0, 7)}-01`, to: today }
  const month = previousMonth(today.slice(0, 7))
  return { from: `${month}-01`, to: `${month}-${lastDay(month)}` }
}

/** Kỳ trong một tháng tính từ ngày 1: so với cùng kỳ tháng trước; kỳ khác: so với kỳ liền trước cùng số ngày. */
function comparisonOf(from: string, to: string) {
  if (from.endsWith('-01') && from.slice(0, 7) === to.slice(0, 7)) {
    const month = previousMonth(from.slice(0, 7))
    const end = Math.min(Number(to.slice(8, 10)), lastDay(month))
    return {
      from: `${month}-01`,
      to: `${month}-${String(end).padStart(2, '0')}`,
      label: 'cùng kỳ tháng trước',
    }
  }
  const end = shift(from, -1)
  return {
    from: shift(end, -daysBetween(from, to)),
    to: end,
    label: 'kỳ liền trước',
  }
}

const dmy = (date: string) => date.slice(0, 10).split('-').reverse().join('/')
const dm = (date: string) => `${date.slice(8, 10)}/${date.slice(5, 7)}`
const minus = (text: string) => text.replace('-', '−')
/** Số tiền/số lượng đủ chữ số, dấu trừ chuẩn: "−190.000". */
const num = (value: number | null | undefined) =>
  minus((value || 0).toLocaleString('vi-VN'))
const oneDecimal = (value: number) =>
  minus(
    (value || 0).toLocaleString('vi-VN', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }),
  )
const millions = (value: number) => oneDecimal(value / 1_000_000)
const clock = (date: Date) =>
  new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
const hasFigures = (f: Figures) =>
  [
    f.completedOrders,
    f.revenue,
    f.totalCollected,
    f.refunds,
    f.creditSales,
    f.revenueCorrections,
    f.collectionCorrections,
    f.receivableCorrections,
    f.receivableAtEnd ?? 0,
  ].some((value) => value !== 0)

/** Phần trăm thay đổi; null khi kỳ so sánh bằng 0 mà kỳ này có số. */
function changeOf(current: number, previous: number | undefined) {
  if (previous == null) return null
  if (previous === 0) return current === 0 ? 0 : null
  return ((current - previous) / Math.abs(previous)) * 100
}

function Change({
  current,
  previous,
  inverse,
}: {
  current: number
  previous: number | undefined
  inverse?: boolean
}) {
  const value = changeOf(current, previous)
  if (value == null) return <span className="sr-change">mới phát sinh</span>
  if (Math.abs(value) < 0.05)
    return <span className="sr-change">không đổi</span>
  const up = value > 0
  return (
    <span
      className={
        'sr-change ' + (up !== Boolean(inverse) ? 'is-good' : 'is-bad')
      }
    >
      {up ? 'tăng' : 'giảm'} {oneDecimal(Math.abs(value))}%
    </span>
  )
}

function Info({ text }: { text: string }) {
  return (
    <span className="sr-info" title={text} aria-label={text} role="img">
      <Icon name="info" />
    </span>
  )
}

function KpiCard({
  icon,
  tone,
  label,
  info,
  current,
  previous,
  format,
  unit,
  inverse,
}: {
  icon: IconName
  tone: 'blue' | 'green' | 'orange' | 'slate'
  label: string
  info?: string
  current: number
  previous: number | undefined
  format: (value: number) => string
  unit: string
  inverse?: boolean
}) {
  return (
    <article className="sr-kpi">
      <header>
        <span className={`sr-kpi-icon sr-kpi-icon--${tone}`} aria-hidden="true">
          <Icon name={icon} />
        </span>
        <span className="sr-kpi-label">{label}</span>
        {info && <Info text={info} />}
      </header>
      <strong className="sr-kpi-value">
        {format(current)}
        <small>{unit}</small>
      </strong>
      <p className="sr-kpi-compare">
        <Change current={current} previous={previous} inverse={inverse} /> · kỳ
        so sánh {format(previous ?? 0)} {unit}
      </p>
    </article>
  )
}

/** Trục dọc 4 khoảng đều, đỉnh là bội số tròn của 1, 2, 2,5 hoặc 5. */
function niceTop(max: number) {
  if (max <= 0) return 4_000_000
  const raw = max / 4
  const power = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10]
    .map((factor) => factor * power)
    .find((value) => value >= raw)!
  return step * 4
}

/** Biểu đồ cột nhóm: mỗi ngày (tháng) một nhóm, mỗi cửa hàng một cột đứng cạnh nhau. */
function SalesChart({
  series,
  periods,
  grouping,
}: {
  series: Series[]
  periods: PeriodRow[]
  grouping: Grouping
}) {
  const values = new Map<string, number>()
  for (const store of series)
    for (const period of store.periods)
      values.set(`${store.storeId}|${period.from}`, period.figures.revenue)
  const top = niceTop(Math.max(0, ...values.values()))
  const sameMonth =
    periods.length > 0 &&
    periods[0].from.slice(0, 7) === periods[periods.length - 1].from.slice(0, 7)
  const tick = (period: PeriodRow) =>
    grouping === 'MONTH'
      ? `${period.from.slice(5, 7)}/${period.from.slice(0, 4)}`
      : sameMonth
        ? period.from.slice(8, 10)
        : dm(period.from)
  const every = periods.length <= 12 ? 1 : Math.ceil(periods.length / 10)
  if (!series.length)
    return <p className="sr-empty">Chưa có doanh số trong kỳ đã chọn.</p>
  return (
    <>
      <div className="sr-legend">
        {series.map((store) => (
          <span key={store.storeId}>
            <i style={{ background: store.color }} />
            {store.storeName}
            <strong>{millions(store.figures.revenue)} tr</strong>
          </span>
        ))}
      </div>
      <div className="sr-chart-unit">Triệu đồng</div>
      <div
        className="sr-chart"
        role="img"
        aria-label={`Biểu đồ cột doanh số theo ${grouping === 'DAY' ? 'ngày' : 'tháng'}, mỗi cửa hàng một cột`}
      >
        <div className="sr-chart-axis">
          {[4, 3, 2, 1, 0].map((step) => (
            <span key={step}>
              {(((top / 4) * step) / 1_000_000).toLocaleString('vi-VN', {
                maximumFractionDigits: 1,
              })}
            </span>
          ))}
        </div>
        <div className="sr-chart-plot">
          <div className="sr-chart-groups">
            {periods.map((period, index) => (
              <div className="sr-chart-group" key={period.from}>
                <div className="sr-chart-bars">
                  {series.map((store) => {
                    const value =
                      values.get(`${store.storeId}|${period.from}`) ?? 0
                    return (
                      <span
                        key={store.storeId}
                        className="sr-chart-bar"
                        style={{
                          height: `${(Math.max(0, value) / top) * 100}%`,
                          background: store.color,
                        }}
                        title={`${grouping === 'DAY' ? dmy(period.from) : tick(period)} · ${store.storeName}: ${num(value)} đ`}
                      />
                    )
                  })}
                </div>
                {index % every === 0 && <small>{tick(period)}</small>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}

export function SalesReportPage() {
  const scope = useInventoryScope()
  const today = defaultTo()
  const [preset, setPreset] = useState<Preset>('month')
  const [range, setRange] = useState(() => presetRange('month'))
  const [grouping, setGrouping] = useState<Grouping>('DAY')
  const { from, to } = range
  const invalid =
    !from || !to
      ? 'Chọn đủ từ ngày và đến ngày.'
      : from > to
        ? 'Từ ngày phải trước hoặc bằng đến ngày.'
        : daysBetween(from, to) >= 366
          ? 'Mỗi lần xem tối đa 366 ngày.'
          : ''
  const scopeLabel =
    scope.owner && !scope.storeId ? 'Toàn chuỗi' : scope.warehouse
  const load = useCallback(
    async (signal: AbortSignal) => {
      if (!from || !to || from > to || daysBetween(from, to) >= 366) return null
      const compare = comparisonOf(from, to)
      const get = (params: Record<string, string | number>) =>
        axiosClient
          .get<SalesCollection>('/reports/sales-collection', {
            params: { storeId: scope.storeId || undefined, ...params },
            signal,
          })
          .then((response) => response.data)
      const opening = shift(from, -1)
      const [report, previous, before] = await Promise.all([
        get({ from, to, groupBy: grouping }),
        get({ from: compare.from, to: compare.to, groupBy: 'MONTH' }),
        get({ from: opening, to: opening, groupBy: 'DAY' }),
      ])
      const stores: ShownStore[] = report.stores
        .filter((store) => scope.storeId || hasFigures(store.figures))
        .map((store, index) => ({
          ...store,
          color: storeColors[index % storeColors.length],
        }))
      const series: Series[] =
        stores.length <= 1
          ? stores.map((store) => ({ ...store, periods: report.periods }))
          : await mapConcurrent(
              stores,
              5,
              async (store) => ({
                ...store,
                periods: (
                  await get({
                    storeId: store.storeId,
                    from,
                    to,
                    groupBy: grouping,
                  })
                ).periods,
              }),
              () => !signal.aborted,
            )
      return {
        report,
        previous,
        compare,
        opening: before.total.receivableAtEnd ?? 0,
        stores,
        series,
        loadedAt: new Date(),
      }
    },
    [from, to, grouping, scope.storeId],
  )
  const state = useLoad(
    `sales:${from}:${to}:${grouping}:${scope.storeId}`,
    load,
  )
  const data = state.data ?? null
  const compare = invalid ? null : comparisonOf(from, to)
  const provisional = to >= today
  const loadedAt = data?.loadedAt
  const periodWord = grouping === 'DAY' ? 'ngày' : 'tháng'

  function choosePreset(value: Preset) {
    setPreset(value)
    if (value !== 'custom') setRange(presetRange(value))
  }
  function changeDate(field: 'from' | 'to', value: string) {
    setPreset('custom')
    setRange((current) => ({ ...current, [field]: value }))
  }
  const periodLabel = (period: PeriodRow) => {
    if (grouping === 'DAY') return dmy(period.from)
    const month = `Tháng ${period.from.slice(5, 7)}/${period.from.slice(0, 4)}`
    const full =
      period.from.endsWith('-01') &&
      Number(period.to.slice(8, 10)) === lastDay(period.from.slice(0, 7))
    return full ? month : `${month} (${dm(period.from)} – ${dm(period.to)})`
  }
  const running = (period: PeriodRow) =>
    loadedAt && period.from <= today && period.to >= today
      ? ` · đến ${clock(loadedAt)}`
      : ''

  function exportExcel() {
    if (!data) return
    const { report, previous } = data
    const t = report.total
    const p = previous.total
    const detail = [
      [
        grouping === 'DAY' ? 'Ngày' : 'Tháng',
        'Số đơn',
        'Doanh số',
        'Bán chịu',
        'Thu tiền đơn',
        'Hoàn tiền',
        'Thu nợ',
        'Tổng thu',
        'Điều chỉnh doanh số',
        'Điều chỉnh tiền thu',
      ],
      ...[...report.periods, { from: '', to: '', figures: t }].map((row) => [
        row.from ? periodLabel(row) : 'Tổng cộng',
        row.figures.completedOrders,
        row.figures.revenue,
        row.figures.creditSales,
        row.figures.orderPayments,
        -row.figures.refunds,
        row.figures.debtCollected,
        row.figures.totalCollected,
        row.figures.revenueCorrections,
        row.figures.collectionCorrections,
      ]),
    ]
    const byStore = [
      [
        'Cửa hàng',
        'Số đơn',
        'Doanh số',
        'Tỷ trọng (%)',
        'Bán chịu',
        'Tổng thu',
        'Phải thu cuối kỳ',
        'Doanh số kỳ so sánh',
      ],
      ...data.stores.map((store) => [
        store.storeName,
        store.figures.completedOrders,
        store.figures.revenue,
        t.revenue
          ? Math.round((store.figures.revenue / t.revenue) * 1000) / 10
          : 0,
        store.figures.creditSales,
        store.figures.totalCollected,
        store.figures.receivableAtEnd ?? 0,
        previous.stores.find((row) => row.storeId === store.storeId)?.figures
          .revenue ?? 0,
      ]),
    ]
    const summary = [
      ['Báo cáo bán hàng và thu tiền'],
      ['Kỳ', `${dmy(from)} – ${dmy(to)}`],
      [
        'So sánh với',
        `${dmy(data.compare.from)} – ${dmy(data.compare.to)} (${data.compare.label})`,
      ],
      ['Phạm vi', scopeLabel],
      ['Đơn vị tính', 'đồng'],
      ['Số liệu đến', `${clock(data.loadedAt)} ${dmy(day(data.loadedAt))}`],
      [],
      ['Chỉ tiêu', 'Kỳ này', 'Kỳ so sánh'],
      ['Doanh số', t.revenue, p.revenue],
      ['Số đơn hoàn tất', t.completedOrders, p.completedOrders],
      ['Tổng thu', t.totalCollected, p.totalCollected],
      ['Bán chịu (nợ mới)', t.creditSales, p.creditSales],
      [],
      ['Đối chiếu công nợ phải thu'],
      [`Phải thu đầu kỳ (cuối ngày ${dmy(shift(from, -1))})`, data.opening],
      ['Cộng: bán chịu trong kỳ', t.creditSales],
      ['Trừ: thu nợ trong kỳ', -t.debtCollected],
      ['Điều chỉnh công nợ', t.receivableCorrections],
      [`Phải thu cuối kỳ (cuối ngày ${dmy(to)})`, t.receivableAtEnd ?? 0],
    ]
    downloadBlob(
      `BaoCaoBanHang_${from}_${to}.xlsx`,
      createXlsx([
        { name: 'Tong hop', rows: summary },
        ...(data.stores.length > 1
          ? [{ name: 'Theo cua hang', rows: byStore }]
          : []),
        {
          name: `Chi tiet theo ${grouping === 'DAY' ? 'ngay' : 'thang'}`,
          rows: detail,
        },
      ]),
    )
  }

  const total = data?.report.total
  const prev = data?.previous.total
  const closing = total?.receivableAtEnd ?? 0
  const other =
    data && total
      ? closing -
        (data.opening +
          total.creditSales -
          total.debtCollected +
          total.receivableCorrections)
      : 0
  const showStores = Boolean(
    data && scope.owner && !scope.storeId && data.stores.length > 1,
  )

  return (
    <main className="reports-page sales-report-page">
      <PageHeader
        title="Báo cáo bán hàng và thu tiền"
        actions={
          <>
            <button
              type="button"
              className="mf-btn mf-btn--secondary"
              disabled={!data}
              onClick={() => window.print()}
            >
              <Icon name="document" />
              In báo cáo
            </button>
            <button
              type="button"
              className="mf-btn mf-btn--secondary"
              disabled={!data}
              onClick={exportExcel}
            >
              <Icon name="download" />
              Xuất Excel
            </button>
          </>
        }
      />
      <section className="sr-filters" aria-label="Bộ lọc báo cáo">
        <label className="sr-field">
          <span>Kỳ báo cáo</span>
          <select
            value={preset}
            onChange={(event) => choosePreset(event.target.value as Preset)}
          >
            <option value="today">Hôm nay</option>
            <option value="week">7 ngày gần nhất</option>
            <option value="month">Tháng này</option>
            <option value="lastMonth">Tháng trước</option>
            <option value="custom">Tùy chọn</option>
          </select>
        </label>
        <div className="sr-field">
          <span>Từ ngày – đến ngày</span>
          <div className="sr-range">
            <input
              type="date"
              aria-label="Từ ngày"
              value={from}
              max={to || today}
              onChange={(event) => changeDate('from', event.target.value)}
            />
            <span aria-hidden="true">–</span>
            <input
              type="date"
              aria-label="Đến ngày"
              value={to}
              min={from}
              max={today}
              onChange={(event) => changeDate('to', event.target.value)}
            />
          </div>
        </div>
        <div className="sr-field sr-store-field">
          <span>Cửa hàng</span>
          {scope.owner ? (
            <SearchableFilter
              label="Cửa hàng"
              value={scope.storeId}
              options={[
                { value: '', label: 'Mọi cửa hàng' },
                ...scope.stores.map((store) => ({
                  value: String(store.id),
                  label: store.storeName,
                })),
              ]}
              searchPlaceholder="Tìm cửa hàng..."
              onChange={(storeId) => scope.filter({ storeId })}
            />
          ) : (
            <strong className="sr-store-name">{scope.warehouse}</strong>
          )}
        </div>
        <div className="sr-field">
          <span>Xem theo</span>
          <div className="sr-toggle" role="group" aria-label="Xem theo">
            <button
              type="button"
              aria-pressed={grouping === 'DAY'}
              onClick={() => setGrouping('DAY')}
            >
              Ngày
            </button>
            <button
              type="button"
              aria-pressed={grouping === 'MONTH'}
              onClick={() => setGrouping('MONTH')}
            >
              Tháng
            </button>
          </div>
        </div>
      </section>
      {invalid ? (
        <div className="report-error" role="alert">
          {invalid}
        </div>
      ) : (
        <p className="sr-summary">
          <span>
            Kỳ{' '}
            <strong>
              {from.slice(0, 4) === to.slice(0, 4) ? dm(from) : dmy(from)} –{' '}
              {dmy(to)}
            </strong>
          </span>
          {compare && (
            <span>
              So sánh với{' '}
              {compare.from.slice(0, 4) === compare.to.slice(0, 4)
                ? dm(compare.from)
                : dmy(compare.from)}{' '}
              – {dmy(compare.to)} ({compare.label})
            </span>
          )}
          <span>Phạm vi: {scopeLabel}</span>
          <span>Đơn vị tính: đồng</span>
          {loadedAt && (
            <span>
              Số liệu đến {clock(loadedAt)} {dmy(day(loadedAt))}
            </span>
          )}
          {provisional && (
            <span className="sr-provisional">
              <span className="sr-badge">Tạm tính</span>
              <Info text="Kỳ chưa kết thúc nên số liệu còn thay đổi." />
            </span>
          )}
        </p>
      )}
      {data && total && prev ? (
        <>
          <section className="sr-kpis" aria-label="Chỉ số chính">
            <KpiCard
              icon="chart"
              tone="blue"
              label="Doanh số"
              info="Tiền hàng của đơn hoàn tất trong kỳ: số lượng giao × giá bán thực tế. Điều chỉnh đơn bán hiện riêng ở bảng chi tiết."
              current={total.revenue}
              previous={prev.revenue}
              format={millions}
              unit="triệu"
            />
            <KpiCard
              icon="receipt"
              tone="slate"
              label="Số đơn hoàn tất"
              current={total.completedOrders}
              previous={prev.completedOrders}
              format={num}
              unit="đơn"
            />
            <KpiCard
              icon="cash"
              tone="green"
              label="Tổng thu"
              info="Thu tiền đơn − hoàn tiền + thu nợ, đã xác minh trong kỳ."
              current={total.totalCollected}
              previous={prev.totalCollected}
              format={millions}
              unit="triệu"
            />
            <KpiCard
              icon="wallet"
              tone="orange"
              label="Bán chịu (nợ mới)"
              current={total.creditSales}
              previous={prev.creditSales}
              format={millions}
              unit="triệu"
              inverse
            />
          </section>
          <div className="sr-main-row">
            <section className="sr-panel">
              <header>
                <h2>
                  Doanh số theo {periodWord} · {scopeLabel}
                </h2>
              </header>
              <div className="sr-panel-body">
                <SalesChart
                  series={data.series}
                  periods={data.report.periods}
                  grouping={grouping}
                />
                {provisional && (
                  <p className="sr-footnote">
                    {grouping === 'DAY'
                      ? `${dmy(today)} chưa hết ngày`
                      : `Tháng ${today.slice(5, 7)}/${today.slice(0, 4)} chưa hết`}
                    , số tính đến {clock(data.loadedAt)}.
                  </p>
                )}
              </div>
            </section>
            <section className="sr-panel sr-recon">
              <header>
                <h2>Đối chiếu công nợ phải thu</h2>
                <Info text="Phải thu cuối kỳ = phải thu đầu kỳ + bán chịu − thu nợ ± điều chỉnh công nợ. Đầu kỳ và cuối kỳ lấy theo sổ công nợ ở cuối ngày." />
              </header>
              <dl>
                <div>
                  <dt>Phải thu đầu kỳ (cuối ngày {dmy(shift(from, -1))})</dt>
                  <dd>{num(data.opening)}</dd>
                </div>
                <div>
                  <dt>Cộng: bán chịu trong kỳ</dt>
                  <dd>{num(total.creditSales)}</dd>
                </div>
                <div>
                  <dt>Trừ: thu nợ trong kỳ</dt>
                  <dd>{num(-total.debtCollected)}</dd>
                </div>
                <div>
                  <dt>Điều chỉnh công nợ</dt>
                  <dd>{num(total.receivableCorrections)}</dd>
                </div>
                {other !== 0 && (
                  <div>
                    <dt>
                      Khoản khác{' '}
                      <Info text="Phần chênh còn lại giữa đầu kỳ và cuối kỳ, ví dụ nợ đầu kỳ ghi thêm trong kỳ." />
                    </dt>
                    <dd>{num(other)}</dd>
                  </div>
                )}
                <div className="is-total">
                  <dt>Phải thu cuối kỳ (cuối ngày {dmy(to)})</dt>
                  <dd>{num(closing)}</dd>
                </div>
              </dl>
              <Link className="sr-link" to="/receivables">
                Mở công nợ →
              </Link>
            </section>
          </div>
          {showStores && (
            <section className="sr-panel">
              <header>
                <h2>Theo cửa hàng</h2>
              </header>
              <div className="sr-table-wrap">
                <table className="sr-table">
                  <thead>
                    <tr>
                      <th>Cửa hàng</th>
                      <th>Số đơn</th>
                      <th>Doanh số</th>
                      <th>Tỷ trọng</th>
                      <th>Bán chịu</th>
                      <th>Tổng thu</th>
                      <th>Phải thu cuối kỳ</th>
                      <th>So kỳ trước</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.stores.map((store) => (
                      <tr key={store.storeId}>
                        <td>
                          <button
                            type="button"
                            className="sr-store-link"
                            title={`Chỉ xem ${store.storeName}`}
                            onClick={() =>
                              scope.filter({ storeId: String(store.storeId) })
                            }
                          >
                            <i style={{ background: store.color }} />
                            {store.storeName}
                            <span aria-hidden="true">›</span>
                          </button>
                        </td>
                        <td>{num(store.figures.completedOrders)}</td>
                        <td>{num(store.figures.revenue)}</td>
                        <td>
                          {total.revenue
                            ? `${oneDecimal((store.figures.revenue / total.revenue) * 100)}%`
                            : '—'}
                        </td>
                        <td>{num(store.figures.creditSales)}</td>
                        <td>{num(store.figures.totalCollected)}</td>
                        <td>{num(store.figures.receivableAtEnd)}</td>
                        <td>
                          <Change
                            current={store.figures.revenue}
                            previous={
                              data.previous.stores.find(
                                (row) => row.storeId === store.storeId,
                              )?.figures.revenue ?? 0
                            }
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <th>Tổng cộng</th>
                      <td>{num(total.completedOrders)}</td>
                      <td>{num(total.revenue)}</td>
                      <td>{total.revenue ? '100,0%' : '—'}</td>
                      <td>{num(total.creditSales)}</td>
                      <td>{num(total.totalCollected)}</td>
                      <td>{num(closing)}</td>
                      <td>
                        <Change
                          current={total.revenue}
                          previous={prev.revenue}
                        />
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>
          )}
          <section className="sr-panel">
            <header>
              <h2>
                Chi tiết theo {periodWord} · {scopeLabel}
              </h2>
              <Info text="Số gốc của đơn và phiếu thu giữ nguyên; điều chỉnh áp dụng trong kỳ hiện riêng ở nhóm Điều chỉnh trong kỳ, vào ngày áp dụng." />
            </header>
            <div className="sr-table-wrap">
              <table className="sr-table sr-detail-table">
                <thead>
                  <tr>
                    <th rowSpan={2}>{grouping === 'DAY' ? 'Ngày' : 'Tháng'}</th>
                    <th colSpan={3} className="sr-group">
                      Bán hàng
                    </th>
                    <th colSpan={4} className="sr-group">
                      Thu tiền
                    </th>
                    <th colSpan={2} className="sr-group">
                      Điều chỉnh trong kỳ
                    </th>
                  </tr>
                  <tr>
                    <th>Số đơn</th>
                    <th>Doanh số</th>
                    <th>Bán chịu</th>
                    <th>Thu tiền đơn</th>
                    <th>Hoàn tiền</th>
                    <th>Thu nợ</th>
                    <th>
                      Tổng thu{' '}
                      <Info text="Thu tiền đơn − hoàn tiền + thu nợ." />
                    </th>
                    <th>Doanh số</th>
                    <th>Tiền thu</th>
                  </tr>
                </thead>
                <tbody>
                  {data.report.periods.map((period) => {
                    const f = period.figures
                    return (
                      <tr key={period.from}>
                        <td>
                          {periodLabel(period)}
                          {running(period) && <small>{running(period)}</small>}
                        </td>
                        <Cell value={f.completedOrders} />
                        <Cell value={f.revenue} strong />
                        <Cell value={f.creditSales} />
                        <Cell value={f.orderPayments} />
                        <Cell value={-f.refunds} />
                        <Cell value={f.debtCollected} />
                        <Cell value={f.totalCollected} strong />
                        <Cell value={f.revenueCorrections} />
                        <Cell value={f.collectionCorrections} />
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <th>Tổng cộng</th>
                    <td>{num(total.completedOrders)}</td>
                    <td>{num(total.revenue)}</td>
                    <td>{num(total.creditSales)}</td>
                    <td>{num(total.orderPayments)}</td>
                    <td>{num(-total.refunds)}</td>
                    <td>{num(total.debtCollected)}</td>
                    <td>{num(total.totalCollected)}</td>
                    <td>{num(total.revenueCorrections)}</td>
                    <td>{num(total.collectionCorrections)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
        </>
      ) : invalid ? null : state.error ? (
        <div className="report-error" role="alert">
          {state.error}
          <button type="button" onClick={state.reload}>
            Thử lại
          </button>
        </div>
      ) : (
        <div className="report-state">Đang tải dữ liệu…</div>
      )}
    </main>
  )
}

function Cell({ value, strong }: { value: number; strong?: boolean }) {
  return (
    <td className={value ? undefined : 'is-zero'}>
      {strong && value ? <strong>{num(value)}</strong> : num(value)}
    </td>
  )
}
