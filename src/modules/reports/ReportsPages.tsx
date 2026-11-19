import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { Link } from 'react-router-dom'
import axiosClient from '../../shared/api/axiosClient'
import { useInventoryData, useInventoryScope } from '../inventory/api'
import type { Page } from '../inventory/types'
import type { DocumentRow } from '../documents/types'
import PageHeader from '../../shared/ui/PageHeader'
import { formatMoney, formatDateTime } from '../../shared/utils/format'
import SearchableFilter from '../../shared/ui/SearchableFilter'
import { inventoryError } from '../inventory/api'
import { movementLink } from '../inventory/presentation'
import { createXlsx, downloadBlob } from '../../shared/utils/xlsx'
import readXlsxFile from 'read-excel-file/browser'
import {
  categoryOptions,
  type Category,
} from '../catalog/api/searchProducts'
import { defaultTo, monthStart, useLoad } from './reportData'
import './reports.css'

const amount = (n: number | null | undefined) =>
  n == null ? '—' : formatMoney(n)

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

function ReportFrame({
  title,
  children,
  subtitle,
  className,
}: {
  title: string
  children: React.ReactNode
  subtitle?: string
  className?: string
}) {
  return (
    <main className={`reports-page ${className ?? ''}`}>
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

/** "2026-11" → "Kỳ 11/2026". */
const monthName = (month: string) =>
  `Kỳ ${Number(month.slice(5, 7))}/${month.slice(0, 4)}`
/** Tháng liền trước, "2026-01" → "2025-12". */
function previousMonthOf(month: string) {
  const [year, value] = month.split('-').map(Number)
  return value === 1
    ? `${year - 1}-12`
    : `${year}-${String(value - 1).padStart(2, '0')}`
}
/** count tháng gần nhất, mới nhất trước. */
function monthChoices(count = 12) {
  const months = [monthStart().slice(0, 7)]
  while (months.length < count) months.push(previousMonthOf(months.at(-1)!))
  return months
}
/** Từ ngày 1 tới cuối tháng; tháng đang chạy thì tới hôm nay. */
function monthRange(month: string) {
  const [year, value] = month.split('-').map(Number)
  const last = `${month}-${String(new Date(year, value, 0).getDate()).padStart(2, '0')}`
  const today = defaultTo()
  return { from: `${month}-01`, to: last < today ? last : today }
}
/** "2026-11-05" → "05/11/2026". */
const dmy = (date: string) => date.slice(0, 10).split('-').reverse().join('/')
const millions = (value: number) =>
  `${(value / 1_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} triệu`
const percent = (value: number | null | undefined) =>
  value == null
    ? '—'
    : `${value.toLocaleString('vi-VN', { maximumFractionDigits: 2 })}%`
/** Mức thay đổi so với kỳ trước, ví dụ "+12,5%". */
function change(current: number, previous: number | null | undefined) {
  if (previous == null) return 'Mới trong kỳ'
  if (previous === 0) return current === 0 ? '0%' : '—'
  const value = ((current - previous) / Math.abs(previous)) * 100
  return `${value > 0 ? '+' : ''}${value.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%`
}

type StockSource =
  | 'PURCHASE_RECEIPT'
  | 'SUPPLIER_RETURN'
  | 'SALE'
  | 'TRANSFER'
  | 'ADJUSTMENT'
  | 'STOCK_COUNT'
  | 'OPENING_BALANCE'
type SourceFlow = {
  source: StockSource
  inQty: number
  inValue: number | null
  outQty: number
  outValue: number | null
}
type InventoryOperationsRow = {
  storeId: number
  storeName: string
  productId: number
  sku: string
  partName: string
  baseUnit: string
  openingQty: number
  openingValue: number | null
  inQty: number
  inValue: number | null
  outQty: number
  outValue: number | null
  closingQty: number
  closingValue: number | null
  inTransitQty: number
  inTransitValue: number | null
  bySource: SourceFlow[]
}
/** GET /reports/inventory-operations (BE #63, UC-88). totals là null với BM (chỉ xem số lượng, BR-72). */
type InventoryOperations = {
  month: string | null
  from: string
  to: string
  periodStatus: 'OPEN' | 'CLOSED' | null
  provisional: boolean
  withValues: boolean
  totals: {
    openingValue: number
    inValue: number
    outValue: number
    closingValue: number
    inTransitValue: number
    bySource: { source: StockSource; inValue: number; outValue: number }[]
  } | null
  page: Page<InventoryOperationsRow>
}
const stockSources: [StockSource, string][] = [
  ['PURCHASE_RECEIPT', 'Nhập từ nhà cung cấp'],
  ['SUPPLIER_RETURN', 'Trả nhà cung cấp'],
  ['SALE', 'Bán hàng'],
  ['TRANSFER', 'Điều chuyển'],
  ['ADJUSTMENT', 'Điều chỉnh'],
  ['STOCK_COUNT', 'Kiểm kê'],
  ['OPENING_BALANCE', 'Số dư đầu kỳ'],
]
const inventoryPageSize = 50

/**
 * UC-88 Báo cáo kho (PM chốt 18/11): số liệu lấy từ BE #63 `GET /reports/inventory-operations`, FE không tự tính.
 * Lọc theo kỳ (tháng), cửa hàng (Owner), nhóm phụ tùng, SKU/tên; xem nhập, xuất theo từng nguồn.
 * Owner xem thêm giá trị; BM chỉ xem số lượng.
 */
export function InventoryReportPage() {
  const scope = useInventoryScope()
  const [month, setMonth] = useState(() => monthStart().slice(0, 7))
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [source, setSource] = useState<StockSource | ''>('')
  const [display, setDisplay] = useState<'quantity' | 'value'>('quantity')
  const [page, setPage] = useState(0)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(query.trim())
      setPage(0)
    }, 300)
    return () => window.clearTimeout(timer)
  }, [query])
  const categories = useInventoryData<Category[]>('/part-categories')
  const storeId = scope.storeId
  const params = useMemo(
    () => ({
      month,
      storeId: storeId || undefined,
      q: search || undefined,
      categoryId: categoryId || undefined,
    }),
    [month, storeId, search, categoryId],
  )
  const loadReport = useCallback(
    (signal: AbortSignal) =>
      axiosClient
        .get<InventoryOperations>('/reports/inventory-operations', {
          params: { ...params, page, size: inventoryPageSize },
          signal,
        })
        .then((response) => response.data),
    [params, page],
  )
  const report = useLoad(
    `inventory-operations:${JSON.stringify(params)}:${page}`,
    loadReport,
  )
  const data = report.data
  const rows = data?.page.items ?? []
  const total = data?.page.totalItems ?? 0
  const valueMode = !!data?.withValues && display === 'value'
  const sourceLabel = stockSources.find(([value]) => value === source)?.[1]
  const flowOf = (row: InventoryOperationsRow) => {
    if (!source)
      return {
        inQty: row.inQty,
        inValue: row.inValue,
        outQty: row.outQty,
        outValue: row.outValue,
      }
    const flow = row.bySource.find((item) => item.source === source)
    return {
      inQty: flow?.inQty ?? 0,
      inValue: flow?.inValue ?? 0,
      outQty: flow?.outQty ?? 0,
      outValue: flow?.outValue ?? 0,
    }
  }
  const quantity = (value: number, unit: string) =>
    `${value.toLocaleString('vi-VN')}${unit ? ' ' + unit : ''}`
  const sourceTotals = source
    ? data?.totals?.bySource.find((item) => item.source === source)
    : undefined
  const scopeLabel =
    scope.owner && !scope.storeId ? 'Mọi cửa hàng' : scope.warehouse

  async function exportCsv() {
    setExporting(true)
    setExportError('')
    try {
      const all: InventoryOperationsRow[] = []
      let withValues = false
      for (let next = 0; ; next++) {
        const { data: chunk } = await axiosClient.get<InventoryOperations>(
          '/reports/inventory-operations',
          { params: { ...params, page: next, size: 100 } },
        )
        withValues = chunk.withValues
        all.push(...chunk.page.items)
        if (!chunk.page.items.length || all.length >= chunk.page.totalItems)
          break
      }
      downloadExcel(`BaoCaoKho_${month}.xlsx`, 'Bao cao kho', [
        [
          'Cửa hàng',
          'SKU',
          'Phụ tùng',
          'Đơn vị',
          'Tồn đầu kỳ',
          'Nhập trong kỳ',
          'Xuất trong kỳ',
          'Tồn cuối kỳ',
          'Đang đi đường',
          ...stockSources.flatMap(([, label]) => [
            `Nhập · ${label}`,
            `Xuất · ${label}`,
          ]),
          ...(withValues
            ? [
                'Giá trị tồn đầu',
                'Giá trị nhập',
                'Giá trị xuất',
                'Giá trị tồn cuối',
                'Giá trị đang đi đường',
              ]
            : []),
        ],
        ...all.map((row) => [
          row.storeName,
          row.sku,
          row.partName,
          row.baseUnit,
          row.openingQty,
          row.inQty,
          row.outQty,
          row.closingQty,
          row.inTransitQty,
          ...stockSources.flatMap(([value]) => {
            const flow = row.bySource.find((item) => item.source === value)
            return [flow?.inQty ?? 0, flow?.outQty ?? 0]
          }),
          ...(withValues
            ? [
                row.openingValue,
                row.inValue,
                row.outValue,
                row.closingValue,
                row.inTransitValue,
              ]
            : []),
        ]),
      ])
    } catch (error) {
      setExportError(inventoryError(error))
    } finally {
      setExporting(false)
    }
  }

  return (
    <ReportFrame
      title="Báo cáo kho"
      subtitle="Tồn đầu kỳ, nhập, xuất và tồn cuối kỳ theo từng phụ tùng."
    >
      <div className="inventory-report-controls">
        <label className="inventory-period-select">
          <span>Kỳ báo cáo</span>
          <SearchableFilter
            label="Kỳ báo cáo"
            value={month}
            options={monthChoices().map((value) => ({ value, label: monthName(value) }))}
            searchPlaceholder="Tìm kỳ báo cáo..."
            onChange={(value) => {
              setMonth(value)
              setPage(0)
            }}
          />
        </label>
        {scope.owner ? (
          <label className="inventory-store-select">
            <span>Cửa hàng</span>
            <SearchableFilter
              label="Cửa hàng"
              value={scope.storeId}
              options={[
                { value: '', label: 'Mọi cửa hàng' },
                ...scope.stores.map((store) => ({ value: String(store.id), label: store.storeName })),
              ]}
              searchPlaceholder="Tìm cửa hàng..."
              onChange={(storeId) => {
                scope.filter({ storeId })
                setPage(0)
              }}
            />
          </label>
        ) : (
          <div className="inventory-store-select">
            <span>Cửa hàng</span>
            <strong>{scope.warehouse}</strong>
          </div>
        )}
        {data && (
          <span className="inventory-period-range">
            {scopeLabel} · {dmy(data.from)} – {dmy(data.to)}
            {data.periodStatus === 'CLOSED'
              ? ' · kỳ đã khóa'
              : data.periodStatus === 'OPEN'
                ? ' · kỳ đang mở'
                : ''}
          </span>
        )}
        {data?.provisional && (
          <span
            className="inventory-provisional"
            title="Kỳ chưa khóa nên số liệu có thể còn thay đổi."
          >
            Tạm tính
          </span>
        )}
      </div>
      {data?.withValues && data.totals && (
        <section className="margin-report-cards">
          <article>
            <span className="margin-card-icon margin-icon-slate">▤</span>
            <span>Giá trị tồn đầu kỳ</span>
            <strong>{millions(data.totals.openingValue)}</strong>
            <small>{amount(data.totals.openingValue)}</small>
          </article>
          <article>
            <span className="margin-card-icon margin-icon-blue">▥</span>
            <span>Giá trị nhập{sourceLabel ? ` · ${sourceLabel}` : ''}</span>
            <strong>
              {millions(sourceTotals?.inValue ?? (source ? 0 : data.totals.inValue))}
            </strong>
            <small>Toàn kỳ: {amount(data.totals.inValue)}</small>
          </article>
          <article>
            <span className="margin-card-icon margin-icon-cyan">▧</span>
            <span>Giá trị xuất{sourceLabel ? ` · ${sourceLabel}` : ''}</span>
            <strong>
              {millions(sourceTotals?.outValue ?? (source ? 0 : data.totals.outValue))}
            </strong>
            <small>Toàn kỳ: {amount(data.totals.outValue)}</small>
          </article>
          <article>
            <span className="margin-card-icon margin-icon-green">▣</span>
            <span>Giá trị tồn cuối kỳ</span>
            <strong>{millions(data.totals.closingValue)}</strong>
            <small>Đang đi đường: {amount(data.totals.inTransitValue)}</small>
          </article>
        </section>
      )}
      <Panel
        title={`Nhập, xuất, tồn · ${scopeLabel} · ${monthName(month)}`}
        actions={
          <button
            className="report-panel-action"
            type="button"
            disabled={exporting || !total}
            onClick={() => void exportCsv()}
          >
            {exporting ? 'Đang xuất…' : 'Xuất Excel'}
          </button>
        }
      >
        <div className="inventory-report-table-area">
          <div className="inventory-report-table-tools">
            <label className="inventory-search">
              <span>⌕</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Tìm tên hoặc SKU"
              />
            </label>
            <SearchableFilter
              label="Nhóm phụ tùng"
              value={categoryId}
              options={[
                { value: '', label: 'Mọi nhóm phụ tùng' },
                ...categoryOptions(categories.data ?? []).map((category) => ({ value: String(category.id), label: category.label ?? category.categoryName })),
              ]}
              searchPlaceholder="Tìm nhóm phụ tùng..."
              onChange={(value) => {
                setCategoryId(value)
                setPage(0)
              }}
            />
            <SearchableFilter
              label="Nguồn nhập, xuất"
              value={source}
              options={[
                { value: '', label: 'Mọi nguồn nhập, xuất' },
                ...stockSources.map(([value, label]) => ({ value, label })),
              ]}
              searchPlaceholder="Tìm nguồn..."
              onChange={(value) => setSource(value as StockSource | '')}
            />
            {data?.withValues && (
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
            )}
          </div>
          {exportError && (
            <div className="report-error" role="alert">
              Không xuất được Excel. {exportError}
            </div>
          )}
          {data ? (
            <>
              <div className="report-table-wrap inventory-report-table">
                <table>
                  <thead>
                    <tr>
                      <th>Phụ tùng</th>
                      <th>Tồn đầu kỳ</th>
                      <th>{sourceLabel ? `Nhập · ${sourceLabel}` : 'Nhập trong kỳ'}</th>
                      <th>{sourceLabel ? `Xuất · ${sourceLabel}` : 'Xuất trong kỳ'}</th>
                      <th>Tồn cuối kỳ</th>
                      <th>Đang đi đường</th>
                      <th>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const flow = flowOf(row)
                      return (
                        <tr key={`${row.storeId}:${row.productId}`}>
                          <td>
                            <strong>{row.partName}</strong>
                            <small>
                              {row.sku}
                              {scope.owner && !scope.storeId
                                ? ` · ${row.storeName}`
                                : ''}
                            </small>
                          </td>
                          {valueMode ? (
                            <>
                              <td>{amount(row.openingValue)}</td>
                              <td>{amount(flow.inValue)}</td>
                              <td>{amount(flow.outValue)}</td>
                              <td>{amount(row.closingValue)}</td>
                              <td>{amount(row.inTransitValue)}</td>
                            </>
                          ) : (
                            <>
                              <td>{quantity(row.openingQty, row.baseUnit)}</td>
                              <td>{quantity(flow.inQty, row.baseUnit)}</td>
                              <td>{quantity(flow.outQty, row.baseUnit)}</td>
                              <td>{quantity(row.closingQty, row.baseUnit)}</td>
                              <td>{quantity(row.inTransitQty, row.baseUnit)}</td>
                            </>
                          )}
                          <td>
                            <Link
                              className="inventory-row-history"
                              to={movementLink(row.productId, row.storeId)}
                            >
                              Lịch sử
                            </Link>
                          </td>
                        </tr>
                      )
                    })}
                    {!rows.length && (
                      <tr>
                        <td colSpan={7} className="report-state">
                          Không có dữ liệu kho phù hợp với bộ lọc.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {total > inventoryPageSize && (
                <footer className="report-pagination">
                  <span>
                    {`Hiển thị ${page * inventoryPageSize + 1}–${Math.min((page + 1) * inventoryPageSize, total)} trên ${total} dòng`}
                  </span>
                  <button
                    type="button"
                    aria-label="Trang trước"
                    disabled={page === 0}
                    onClick={() => setPage(page - 1)}
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    aria-label="Trang sau"
                    disabled={(page + 1) * inventoryPageSize >= total}
                    onClick={() => setPage(page + 1)}
                  >
                    ›
                  </button>
                </footer>
              )}
            </>
          ) : (
            <LoadState
              loading={report.loading}
              error={report.error}
              reload={report.reload}
            />
          )}
        </div>
      </Panel>
    </ReportFrame>
  )
}

type MarginFigures = {
  quantity: number
  revenue: number
  cost: number
  grossMargin: number
  /** Phần trăm, hai chữ số thập phân; null khi không có doanh thu. */
  marginRate: number | null
  correctionRevenue: number
  correctionCost: number
  adjustedMargin: number
  writeOffValue: number
}
type MarginGrouping = 'STORE' | 'CATEGORY' | 'PRODUCT'
type MarginRow = {
  id: number
  code: string | null
  name: string
  figures: MarginFigures
}
/** GET /reports/gross-margin (BE #62, UC-102, chỉ Owner): một kỳ, gom theo cửa hàng, nhóm hoặc phụ tùng. */
type GrossMargin = {
  from: string
  to: string
  groupBy: MarginGrouping
  total: MarginFigures
  rows: MarginRow[]
}
type MarginCompareRow = {
  id: number
  code: string | null
  name: string
  current: MarginFigures | null
  previous: MarginFigures | null
}

/**
 * Ghép kỳ đang xem với kỳ trước theo id. Lấy hợp hai danh sách, nên dòng chỉ có ở kỳ trước vẫn hiện
 * (doanh thu kỳ này bằng 0). Graphify review 18/11: bản cũ bỏ sót các dòng này.
 */
function mergePeriods(current: MarginRow[], previous: MarginRow[]) {
  const rows = new Map<number, MarginCompareRow>()
  for (const row of current)
    rows.set(row.id, {
      id: row.id,
      code: row.code,
      name: row.name,
      current: row.figures,
      previous: null,
    })
  for (const row of previous) {
    const found = rows.get(row.id)
    if (found) found.previous = row.figures
    else
      rows.set(row.id, {
        id: row.id,
        code: row.code,
        name: row.name,
        current: null,
        previous: row.figures,
      })
  }
  return [...rows.values()].sort(
    (a, b) =>
      (b.current?.revenue ?? 0) - (a.current?.revenue ?? 0) ||
      (b.previous?.revenue ?? 0) - (a.previous?.revenue ?? 0),
  )
}

function fetchMargin(
  params: {
    storeId?: string
    categoryId?: string
    groupBy: MarginGrouping
    from: string
    to: string
  },
  signal: AbortSignal,
) {
  return axiosClient
    .get<GrossMargin>('/reports/gross-margin', {
      params: {
        ...params,
        storeId: params.storeId || undefined,
        categoryId: params.categoryId || undefined,
      },
      signal,
    })
    .then((response) => response.data)
}

/** Ô "So kỳ trước" của một dòng: thay đổi lợi nhuận, hoặc ghi rõ dòng chỉ có ở một kỳ. */
function MarginChange({ row }: { row: MarginCompareRow }) {
  if (!row.current) return <>Kỳ này không bán</>
  return (
    <>
      {change(row.current.grossMargin, row.previous?.grossMargin)}
      {row.previous && <small>Kỳ trước: {amount(row.previous.grossMargin)}</small>}
    </>
  )
}

function MarginCells({ figures }: { figures: MarginFigures | null }) {
  return (
    <>
      <td>{amount(figures?.revenue ?? 0)}</td>
      <td>{amount(figures?.cost ?? 0)}</td>
      <td>{amount(figures?.grossMargin ?? 0)}</td>
      <td>{percent(figures?.marginRate)}</td>
    </>
  )
}

/** Các phụ tùng của một nhóm, tải khi mở nhóm (groupBy=PRODUCT, categoryId của nhóm). */
function MarginProducts({
  categoryId,
  storeId,
  range,
  comparison,
}: {
  categoryId: number
  storeId: string
  range: { from: string; to: string }
  comparison: { from: string; to: string }
}) {
  const load = useCallback(
    async (signal: AbortSignal) => {
      const base = {
        storeId,
        categoryId: String(categoryId),
        groupBy: 'PRODUCT' as const,
      }
      const [current, previous] = await Promise.all([
        fetchMargin({ ...base, ...range }, signal),
        fetchMargin({ ...base, ...comparison }, signal),
      ])
      return mergePeriods(current.rows, previous.rows)
    },
    [categoryId, storeId, range, comparison],
  )
  const products = useLoad(
    `margin-products:${categoryId}:${storeId}:${range.from}:${range.to}`,
    load,
  )
  if (!products.data)
    return (
      <tr className="margin-product-row">
        <td colSpan={7}>
          <LoadState
            loading={products.loading}
            error={products.error}
            reload={products.reload}
          />
        </td>
      </tr>
    )
  if (!products.data.length)
    return (
      <tr className="margin-product-row">
        <td colSpan={7} className="report-state">
          Nhóm này không có phụ tùng bán trong hai kỳ.
        </td>
      </tr>
    )
  return (
    <>
      {products.data.map((product) => (
        <tr className="margin-product-row" key={product.id}>
          <td>
            <strong>{product.name}</strong>
            <small>
              {product.code ? `${product.code} · ` : ''}
              {(product.current?.quantity ?? 0).toLocaleString('vi-VN')} phụ
              tùng
            </small>
          </td>
          <MarginCells figures={product.current} />
          <td>
            <MarginChange row={product} />
          </td>
          <td />
        </tr>
      ))}
    </>
  )
}

/**
 * UC-102 Lợi nhuận (Owner): số liệu từ BE #62 `GET /reports/gross-margin` (doanh thu, giá vốn theo bình quân gia
 * quyền lúc xuất bán, điều chỉnh đơn bán, hàng xuất bỏ). Kỳ so sánh là tháng ngay trước kỳ đang xem.
 */
export function GrossMarginReportPage() {
  const scope = useInventoryScope()
  const thisMonth = monthStart().slice(0, 7)
  const lastMonth = previousMonthOf(thisMonth)
  const [month, setMonth] = useState(thisMonth)
  const [categoryId, setCategoryId] = useState('')
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set())
  const [showChart, setShowChart] = useState(false)
  const categories = useInventoryData<Category[]>('/part-categories')
  const range = useMemo(() => monthRange(month), [month])
  const comparisonMonth = previousMonthOf(month)
  const comparison = useMemo(
    () => monthRange(comparisonMonth),
    [comparisonMonth],
  )
  const storeId = scope.storeId
  const loadMargin = useCallback(
    async (signal: AbortSignal) => {
      const base = { storeId, categoryId }
      const [stores, previousStores, groups, previousGroups] =
        await Promise.all([
          fetchMargin({ ...base, groupBy: 'STORE', ...range }, signal),
          fetchMargin({ ...base, groupBy: 'STORE', ...comparison }, signal),
          fetchMargin({ ...base, groupBy: 'CATEGORY', ...range }, signal),
          fetchMargin({ ...base, groupBy: 'CATEGORY', ...comparison }, signal),
        ])
      return {
        total: stores.total,
        previousTotal: previousStores.total,
        stores: mergePeriods(stores.rows, previousStores.rows),
        categories: mergePeriods(groups.rows, previousGroups.rows),
      }
    },
    [storeId, categoryId, range, comparison],
  )
  const report = useLoad(
    `margin:${month}:${storeId}:${categoryId}`,
    loadMargin,
  )
  const data = report.data
  const total = data?.total
  const previousTotal = data?.previousTotal
  const scopeLabel = scope.owner && !scope.storeId ? 'Toàn chuỗi' : scope.warehouse
  const corrected =
    !!total &&
    (total.correctionRevenue !== 0 ||
      total.correctionCost !== 0 ||
      total.writeOffValue !== 0)

  return (
    <ReportFrame title="Lợi nhuận">
      <div className="margin-report-filters">
        <div
          className="margin-period-tabs"
          role="group"
          aria-label="Chọn kỳ báo cáo"
        >
          {[thisMonth, lastMonth].map((value) => (
            <button
              key={value}
              className={month === value ? 'is-active' : ''}
              type="button"
              onClick={() => {
                setMonth(value)
                setExpanded(new Set())
              }}
            >
              {monthName(value)}
            </button>
          ))}
        </div>
        {scope.owner ? (
          <label className="margin-store-filter">
            <SearchableFilter
              label="Cửa hàng"
              value={scope.storeId}
              options={[
                { value: '', label: 'Mọi cửa hàng' },
                ...scope.stores.map((store) => ({ value: String(store.id), label: store.storeName })),
              ]}
              searchPlaceholder="Tìm cửa hàng..."
              onChange={(storeId) => {
                scope.filter({ storeId })
                setExpanded(new Set())
              }}
            />
          </label>
        ) : (
          <span className="margin-current-store">{scope.warehouse}</span>
        )}
        <label className="margin-category-filter">
          <SearchableFilter
            label="Nhóm phụ tùng"
            value={categoryId}
            options={[
              { value: '', label: 'Mọi nhóm phụ tùng' },
              ...categoryOptions(categories.data ?? []).map((category) => ({ value: String(category.id), label: category.label ?? category.categoryName })),
            ]}
            searchPlaceholder="Tìm nhóm phụ tùng..."
            onChange={(value) => {
              setCategoryId(value)
              setExpanded(new Set())
            }}
          />
        </label>
        <span className="margin-period-range">
          {scopeLabel} · {dmy(range.from)} – {dmy(range.to)} · so với{' '}
          {monthName(comparisonMonth)}
        </span>
        {month === thisMonth && (
          <span
            className="inventory-provisional"
            title="Tháng đang chạy nên số liệu còn thay đổi."
          >
            Tạm tính
          </span>
        )}
      </div>
      {data && total ? (
        <>
          <section className="margin-report-cards">
            <article>
              <span className="margin-card-icon margin-icon-blue">▥</span>
              <span>Doanh thu</span>
              <strong>{millions(total.revenue)}</strong>
              <small>
                Kỳ trước: {millions(previousTotal?.revenue ?? 0)} ·{' '}
                {change(total.revenue, previousTotal?.revenue)}
              </small>
            </article>
            <article>
              <span className="margin-card-icon margin-icon-slate">▤</span>
              <span>Giá vốn</span>
              <strong>{millions(total.cost)}</strong>
              <small>Kỳ trước: {millions(previousTotal?.cost ?? 0)}</small>
            </article>
            <article>
              <span className="margin-card-icon margin-icon-green">▣</span>
              <span>Lợi nhuận</span>
              <strong>{millions(total.grossMargin)}</strong>
              <small>
                Kỳ trước: {millions(previousTotal?.grossMargin ?? 0)} ·{' '}
                {change(total.grossMargin, previousTotal?.grossMargin)}
              </small>
            </article>
            <article>
              <span className="margin-card-icon margin-icon-cyan">％</span>
              <span>Tỷ lệ lợi nhuận</span>
              <strong>{percent(total.marginRate)}</strong>
              <small>Kỳ trước: {percent(previousTotal?.marginRate)}</small>
            </article>
          </section>
          {corrected && (
            <div className="report-note">
              Trong kỳ có điều chỉnh đơn bán: doanh thu{' '}
              {amount(total.correctionRevenue)}, giá vốn{' '}
              {amount(total.correctionCost)}, nên lợi nhuận sau điều chỉnh là{' '}
              <strong>{amount(total.adjustedMargin)}</strong>. Hàng mất, hỏng
              đã xuất bỏ trong kỳ: {amount(total.writeOffValue)} (không trừ vào
              lợi nhuận).
            </div>
          )}
          {scope.owner && !scope.storeId && (
            <Panel title="Theo cửa hàng">
              <div className="report-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Cửa hàng</th>
                      <th>Doanh thu</th>
                      <th>Giá vốn</th>
                      <th>Lợi nhuận</th>
                      <th>Tỷ lệ</th>
                      <th>So kỳ trước</th>
                      <th>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.stores.map((store, index) => (
                      <tr key={store.id}>
                        <td>
                          <span
                            className={`margin-store-dot margin-store-dot-${index % 2}`}
                          />
                          {store.name}
                        </td>
                        <MarginCells figures={store.current} />
                        <td>
                          <MarginChange row={store} />
                        </td>
                        <td>
                          <button
                            className="report-panel-action"
                            type="button"
                            onClick={() =>
                              scope.filter({ storeId: String(store.id) })
                            }
                          >
                            Xem riêng
                          </button>
                        </td>
                      </tr>
                    ))}
                    {!data.stores.length && (
                      <tr>
                        <td colSpan={7} className="report-state">
                          Không có đơn hoàn tất trong hai kỳ.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}
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
                    downloadExcel(`BaoCaoLoiNhuan_${range.from}_${range.to}.xlsx`, 'Loi nhuan', [
                      [
                        'Nhóm phụ tùng',
                        'Doanh thu',
                        'Giá vốn',
                        'Lợi nhuận',
                        'Tỷ lệ (%)',
                        'Lợi nhuận kỳ trước',
                      ],
                      ...data.categories.map((row) => [
                        row.name,
                        row.current?.revenue ?? 0,
                        row.current?.cost ?? 0,
                        row.current?.grossMargin ?? 0,
                        row.current?.marginRate ?? '',
                        row.previous?.grossMargin ?? '',
                      ]),
                    ])
                  }
                >
                  Xuất Excel
                </button>
              </div>
            }
          >
            {showChart && (
              <div className="margin-category-chart">
                {data.categories
                  .filter((row) => row.current)
                  .map((row, index) => (
                    <div className="margin-category-bar-row" key={row.id}>
                      <span>{row.name}</span>
                      <div>
                        <i
                          style={{
                            width: `${Math.max(2, total.revenue ? ((row.current?.revenue ?? 0) / total.revenue) * 100 : 0)}%`,
                            background: [
                              '#2a78d6',
                              '#f06b36',
                              '#16a36a',
                              '#8b5cf6',
                            ][index % 4],
                          }}
                        />
                      </div>
                      <strong>{amount(row.current?.revenue ?? 0)}</strong>
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
                    <th>Lợi nhuận</th>
                    <th>Tỷ lệ</th>
                    <th>So kỳ trước</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {data.categories.map((row) => {
                    const isOpen = expanded.has(row.id)
                    return (
                      <Fragment key={row.id}>
                        <tr>
                          <td>
                            <strong>{row.name}</strong>
                          </td>
                          <MarginCells figures={row.current} />
                          <td>
                            <MarginChange row={row} />
                          </td>
                          <td>
                            <button
                              className="report-panel-action"
                              type="button"
                              onClick={() =>
                                setExpanded((current) => {
                                  const next = new Set(current)
                                  if (isOpen) next.delete(row.id)
                                  else next.add(row.id)
                                  return next
                                })
                              }
                            >
                              {isOpen ? 'Thu gọn' : 'Xem phụ tùng'}
                            </button>
                          </td>
                        </tr>
                        {isOpen && (
                          <MarginProducts
                            categoryId={row.id}
                            storeId={storeId}
                            range={range}
                            comparison={comparison}
                          />
                        )}
                      </Fragment>
                    )
                  })}
                  {!data.categories.length && (
                    <tr>
                      <td colSpan={7} className="report-state">
                        Không có phụ tùng bán trong hai kỳ.
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

/** Mục B (PM 19/11): mọi nút xuất tải tệp Excel (.xlsx) một sheet, thay cho CSV. */
function downloadExcel(name: string, sheet: string, rows: unknown[][]) {
  downloadBlob(name, createXlsx([{ name: sheet, rows }]))
}

/** Lỗi của request tải tệp: BE trả JSON nhưng axios đọc thành Blob. */
async function downloadError(error: unknown) {
  const data = (error as { response?: { data?: unknown } }).response?.data
  if (data instanceof Blob) {
    try {
      const body = JSON.parse(await data.text()) as { message?: string }
      if (body.message) return body.message
    } catch {
      // Không phải JSON: dùng câu báo chung bên dưới.
    }
  }
  return inventoryError(error)
}

const accountingDataSets = [
  { key: 'daily-sales', label: 'Doanh thu theo ngày', description: 'Doanh số đơn hoàn tất, tiền thu và nợ mới.' },
  { key: 'sales-orders', label: 'Đơn bán và sản phẩm', description: 'Số đơn, khách hàng, phụ tùng, số lượng và giá trị.' },
  { key: 'purchase-orders', label: 'Nhập hàng: phiếu nhập, lượt nhận, giá nhập', description: 'Phiếu nhập, nhà cung cấp, phụ tùng, số lượng và giá nhập.' },
  { key: 'collections', label: 'Thu tiền và công nợ', description: 'Phiếu thu, hoàn tiền và thu nợ đã xác nhận.' },
  { key: 'inventory-period', label: 'Nhập, xuất, tồn kỳ và giá bình quân kỳ (sổ S2d-HKD)', description: 'Số lượng, giá trị và giá vốn bình quân theo phụ tùng.' },
  { key: 'documents', label: 'Danh sách chứng từ', description: 'Số, loại, ngày, cửa hàng, đối tượng, trạng thái và giá trị.' },
] as const

type AccountingDataSet = (typeof accountingDataSets)[number]['key']
type AccountingRows = unknown[][]
type AccountingPeriod = { id: number; month: string; status: 'OPEN' | 'CLOSED' }
type AccountingBalanceRow = {
  storeName: string; sku: string; partName: string; baseUnit: string
  openingQty: number; openingValue: number; inQty: number; inValue: number
  outQty: number; outValue: number; closingQty: number; closingValue: number
  periodAvgUnitCost: number | null
}
type AccountingExportData = {
  rows: Partial<Record<AccountingDataSet, AccountingRows>>
  adjustments: AccountingRows
  periods: AccountingPeriod[]
}

function accountingRowsCount(rows: AccountingRows, includesWorkbookTitle = false) {
  return Math.max(0, rows.length - (includesWorkbookTitle ? 3 : 1))
}

/**
 * Mục D (PM 19/11): ô ngày của workbook BE được read-excel-file đọc thành Date (giờ UTC); ghi lại bằng String(Date)
 * sẽ ra "... GMT+0700". Đổi về chữ "dd/mm/yyyy" hoặc "dd/mm/yyyy HH:mm", không kèm múi giờ.
 */
function excelDateText(value: unknown) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return value
  const pad = (n: number) => String(n).padStart(2, '0')
  const date = `${pad(value.getUTCDate())}/${pad(value.getUTCMonth() + 1)}/${value.getUTCFullYear()}`
  return value.getUTCHours() || value.getUTCMinutes()
    ? `${date} ${pad(value.getUTCHours())}:${pad(value.getUTCMinutes())}`
    : date
}

async function loadAccountingExportData(
  range: { from: string; to: string }, storeId: string, month: string, signal: AbortSignal,
): Promise<AccountingExportData> {
  const [workbookResponse, documents, periodsResponse] = await Promise.all([
    axiosClient.get<Blob>('/reports/accounting-export', {
      params: { storeId: storeId || undefined, from: range.from, to: range.to },
      responseType: 'blob', signal,
    }),
    allPages<DocumentRow>('/documents', { storeId: storeId || undefined, from: range.from, to: range.to }, signal),
    axiosClient.get<AccountingPeriod[]>('/inventory-periods', { signal }),
  ])
  const workbook = await readXlsxFile(workbookResponse.data)
  const sheets = new Map(
    workbook.map(({ sheet, data }) => [sheet, data.map((row) => row.map(excelDateText)) as AccountingRows]),
  )
  const rows: AccountingExportData['rows'] = {
    'daily-sales': sheets.get('Doanh thu'),
    'sales-orders': sheets.get('Bán hàng'),
    'purchase-orders': sheets.get('Mua hàng'),
    collections: sheets.get('Thu tiền'),
    documents: [
      ['Loại chứng từ', 'Số chứng từ', 'Ngày', 'Cửa hàng', 'Đối tượng', 'Trạng thái', 'Giá trị'],
      ...documents.map((item) => [item.type, item.number, formatDateTime(item.documentDate), item.storeName, item.partnerName ?? '', item.status, item.value ?? '']),
    ],
  }
  const period = periodsResponse.data.find((item) => item.month === month)
  if (period) {
    const balances: AccountingBalanceRow[] = []
    for (let page = 0; ; page++) {
      const response = await axiosClient.get<{ page: Page<AccountingBalanceRow> }>(
        `/inventory-periods/${period.id}/balances`,
        { params: { storeId: storeId || undefined, page, size: 100 }, signal },
      )
      balances.push(...response.data.page.items)
      if (!response.data.page.items.length || balances.length >= response.data.page.totalItems) break
    }
    rows['inventory-period'] = [
      ['Cửa hàng', 'SKU', 'Phụ tùng', 'Đơn vị', 'Tồn đầu kỳ', 'Giá trị đầu kỳ', 'Nhập trong kỳ', 'Giá trị nhập', 'Xuất trong kỳ', 'Giá trị xuất', 'Tồn cuối kỳ', 'Giá trị cuối kỳ', 'Giá vốn bình quân kỳ'],
      ...balances.map((item) => [item.storeName, item.sku, item.partName, item.baseUnit, item.openingQty, item.openingValue, item.inQty, item.inValue, item.outQty, item.outValue, item.closingQty, item.closingValue, item.periodAvgUnitCost ?? '']),
    ]
  }
  return { rows, adjustments: sheets.get('Chứng từ điều chỉnh') ?? [], periods: periodsResponse.data }
}

/** UC-89 Xuất các bộ dữ liệu kế toán từ workbook và API theo kỳ đã chọn. */
export function AccountingExportPage() {
  const scope = useInventoryScope()
  const [month, setMonth] = useState(() => monthStart().slice(0, 7))
  const [selected, setSelected] = useState<AccountingDataSet[]>(() => accountingDataSets.map(({ key }) => key))
  const [exportData, setExportData] = useState<AccountingExportData | null>(null)
  const [loadingData, setLoadingData] = useState(true)
  const [dataRevision, setDataRevision] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [history, setHistory] = useState<
    { filename: string; store: string; createdAt: string; blob: Blob }[]
  >([])
  const range = monthRange(month)
  const store = scope.owner
    ? (scope.stores.find((item) => String(item.id) === scope.storeId)
        ?.storeName ?? 'Mọi cửa hàng')
    : scope.warehouse
  const availableSelected = selected.filter((key) => !!exportData?.rows[key])

  useEffect(() => {
    const controller = new AbortController()
    setLoadingData(true)
    setError('')
    loadAccountingExportData(range, scope.storeId, month, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setExportData(data)
      })
      .catch(async (failure) => {
        if (!controller.signal.aborted) {
          setExportData(null)
          setError(await downloadError(failure))
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingData(false)
      })
    return () => controller.abort()
  }, [month, range.from, range.to, scope.storeId, dataRevision])

  async function download() {
    if (busy || loadingData || !exportData || !availableSelected.length) return
    setBusy(true)
    setError('')
    try {
      const selectedSheets = availableSelected.flatMap((key) => {
        const definition = accountingDataSets.find((item) => item.key === key)
        const rows = exportData.rows[key]
        if (!definition || !rows) return []
        const sheets: { name: string; rows: unknown[][] }[] = [
          { name: definition.label.replaceAll(':', ' -'), rows },
        ]
        if (key === 'documents' && exportData.adjustments.length) {
          sheets.push({ name: 'Chứng từ điều chỉnh', rows: exportData.adjustments })
        }
        return sheets
      })
      if (!selectedSheets.length) {
        setError('Không có bộ dữ liệu khả dụng để xuất trong kỳ đã chọn.')
        return
      }
      const filename = `MotoFlow_KeToan_${range.from}_${range.to}.xlsx`
      const blob = createXlsx(selectedSheets)
      downloadBlob(filename, blob)
      setHistory((previous) =>
        [
          {
            filename,
            store,
            createdAt: new Date().toISOString(),
            blob,
          },
          ...previous.filter(
            (item) => item.filename !== filename || item.store !== store,
          ),
        ].slice(0, 5),
      )
    } catch (failure) {
      setError(await downloadError(failure))
    } finally {
      setBusy(false)
    }
  }

  return (
    <ReportFrame
      title="Xuất dữ liệu kế toán"
      subtitle="Tải các bộ dữ liệu kế toán trong kỳ đã chọn."
      className="accounting-export-page"
    >
      <Panel title="Chọn dữ liệu">
        <div className="accounting-export-filters">
          <label>
            <span>
              Kỳ kho <b>*</b>
            </span>
            <SearchableFilter
              label="Kỳ kho"
              value={month}
              options={monthChoices().map((value) => {
                const period = exportData?.periods.find((item) => item.month === value)
                return {
                  value,
                  label: `${monthName(value)}${period ? ` · ${period.status === 'CLOSED' ? 'đã đóng' : 'đang ghi'}` : ''}`,
                }
              })}
              searchPlaceholder="Tìm kỳ kho..."
              onChange={setMonth}
            />
          </label>
          {scope.owner ? (
            <label>
              <span>Cửa hàng</span>
              <SearchableFilter
                label="Cửa hàng"
                value={scope.storeId}
                options={[
                  { value: '', label: 'Mọi cửa hàng' },
                  ...scope.stores.map((item) => ({ value: String(item.id), label: item.storeName })),
                ]}
                searchPlaceholder="Tìm cửa hàng..."
                onChange={(storeId) => scope.filter({ storeId })}
              />
            </label>
          ) : (
            <label>
              <span>Cửa hàng</span>
              <strong>{scope.warehouse}</strong>
            </label>
          )}
        </div>
        <section className="report-export-sets">
          <header>
            <strong>Bộ dữ liệu</strong>
            <button type="button" onClick={() => setSelected([])} disabled={!selected.length}>Bỏ chọn tất cả</button>
          </header>
          <div className="report-export-list">
            {accountingDataSets.map(({ key, label, description }) => {
              const rows = exportData?.rows[key]
              const count = rows ? accountingRowsCount(rows, key !== 'documents' && key !== 'inventory-period') + (key === 'documents' ? accountingRowsCount(exportData?.adjustments ?? [], true) : 0) : null
              return (
                <label className="report-export-set" key={key}>
                  <input type="checkbox" checked={selected.includes(key) && (loadingData || !!rows)} disabled={!loadingData && !rows} onChange={() => setSelected((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key])} />
                  <span>
                    <strong>{label}<span className="report-export-info" title={description} aria-label={description}>i</span></strong>
                  </span>
                  <small className="report-export-count">{loadingData ? 'Đang tải…' : count === null ? 'Chưa có dữ liệu' : `${count.toLocaleString('vi-VN')} dòng`}</small>
                </label>
              )
            })}
          </div>
        </section>
        <div className="report-export-footer">
          <span>
            Sẽ xuất {availableSelected.length} bộ dữ liệu, {availableSelected.reduce((total, key) => {
              const rows = exportData?.rows[key]
              return total + (rows ? accountingRowsCount(rows, key !== 'documents' && key !== 'inventory-period') + (key === 'documents' ? accountingRowsCount(exportData?.adjustments ?? [], true) : 0) : 0)
            }, 0).toLocaleString('vi-VN')} dòng
          </span>
          <button
            className="report-primary"
            type="button"
            disabled={busy || loadingData || !availableSelected.length || !exportData}
            onClick={() => void download()}
          >
            {busy ? 'Đang tạo tệp…' : '↓  Xuất Excel'}
          </button>
        </div>
        {error && (
          <div className="accounting-load-error" role="alert">
            <span>{loadingData ? 'Không tải được dữ liệu. ' : ''}{error}</span>
            <button type="button" onClick={() => setDataRevision((value) => value + 1)}>Thử lại</button>
          </div>
        )}
      </Panel>
      <Panel title="Lần xuất trước">
        <div className="report-export-history">
          {history.length ? (
            <>
              <div className="report-export-history-head">
                <span>Tệp</span>
                <span>Thời điểm</span>
                <span>Thao tác</span>
              </div>
              {history.map((item) => (
                <div key={item.filename + item.store}>
                  <span>
                    {item.filename}
                    <small>{item.store}</small>
                  </span>
                  <small>{formatDateTime(item.createdAt)}</small>
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
            <p>Chưa có lần tải nào trong phiên này.</p>
          )}
        </div>
      </Panel>
    </ReportFrame>
  )
}
