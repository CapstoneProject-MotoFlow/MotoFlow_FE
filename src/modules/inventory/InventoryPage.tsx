import { Fragment, useContext, useState } from 'react'
import { createPortal } from 'react-dom'
import { HeaderSearchTarget } from '../../shared/ui/HeaderSearchTarget'
import { Link } from 'react-router-dom'
import Icon from '../../shared/ui/Icon'
import { useInventoryData, useInventoryScope } from './api'
import {
  InventoryHeader,
  InventoryNotice,
  InventoryPanel,
  Pagination,
} from './components'
import { categoryOptions, type Category } from '../catalog/api/searchProducts'
import { StockLots } from './StockDetails'
import { StockSettingsDialog } from './SettingsDialogs'
import { money, movementLink, number } from './presentation'
import {
  groupStock,
  matchesStockView,
  sortStock,
  stockKey,
  stockTotals,
} from './stockGrouping'
import { useCompleteStock } from './useCompleteStock'
import type { StockRow, StockSummary, Page } from './types'
import './stock-screen.css'

export default function InventoryPage() {
  const scope = useInventoryScope(),
    p = scope.params
  const [lotRow, setLotRow] = useState<StockRow>()
  const [revision, setRevision] = useState(0)
  const [completeRevision, setCompleteRevision] = useState(0)
  const [summaryRevision, setSummaryRevision] = useState(0)
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [settings, setSettings] = useState<{
    row: StockRow
    mode: 'location' | 'threshold'
  }>()
  const dataScope = [
    scope.user?.id,
    scope.user?.username,
    scope.user?.role,
    scope.user?.storeId,
  ].join(':')
  const grouped = scope.owner && !scope.storeId
  const requestedPage = Math.max(0, Math.floor(Number(p.get('page')) || 0))
  const includeZero = p.get('includeZero') === 'true',
    view = p.get('view') ?? '',
    sort = p.get('sort') ?? 'name'
  const complete = useCompleteStock({}, completeRevision, grouped, dataScope)
  const filters = {
    q: p.get('q') ?? '',
    categoryId: p.get('categoryId') ?? '',
    storageArea: p.get('storageArea') ?? '',
  }
  const remoteFilter = !!(
    filters.q ||
    filters.categoryId ||
    filters.storageArea
  )
  const filtered = useCompleteStock(
    { ...filters, storeId: scope.storeId },
    revision,
    grouped && remoteFilter,
    dataScope,
  )
  const categories = useInventoryData<Category[]>('/part-categories')
  const paged = useInventoryData<Page<StockRow>>(
    '/inventory/stock',
    {
      ...filters,
      storeId: scope.storeId,
      page: requestedPage,
      size: 20,
      includeZero,
      lowStockOnly: view === 'lowStock',
      unavailableOnly: view === 'unavailable',
      expiryAlertOnly: view === 'expiryAlert',
    },
    revision,
    !grouped,
  )
  const summary = useInventoryData<StockSummary>(
    '/inventory/stock/summary',
    { ...filters, storeId: scope.storeId },
    summaryRevision,
  )
  const areaResource = useInventoryData<string[]>(
    '/inventory/stock/storage-areas',
    { storeId: scope.storeId },
    summaryRevision,
  )
  const base = grouped ? complete : { ...paged, data: paged.data?.items }
  const scoped =
    base.data?.filter(
      (row) => !scope.storeId || String(row.storeId) === scope.storeId,
    ) ?? []
  const matching = remoteFilter ? (filtered.data ?? []) : scoped
  const keys = new Set(matching.map(stockKey))
  const groups = sortStock(
    groupStock(scoped, matching, includeZero, view),
    (group) => group.product,
    (group) => group.totals.stockValue,
    sort,
  )
  const sortedFlat = sortStock(
    scoped.filter(
      (row) =>
        keys.has(stockKey(row)) &&
        (includeZero || row.onHandQty + row.inTransitQty > 0) &&
        matchesStockView(row, view),
    ),
    (row) => row,
    (row) => row.stockValue,
    sort,
  )
  const flat = grouped ? sortedFlat : (paged.data?.items ?? [])
  const loading = base.loading || filtered.loading
  const error =
    base.error ??
    filtered.error ??
    summary.error ??
    areaResource.error ??
    scope.storesError ??
    categories.error
  const ready = !!base.data && (!grouped || !remoteFilter || !!filtered.data)
  const total = grouped ? groups.length : (paged.data?.totalItems ?? 0)
  const boundedPage = Math.min(
    Math.max(0, Math.floor(requestedPage)),
    Math.max(0, Math.ceil(total / 20) - 1),
  )
  const page = grouped ? boundedPage : requestedPage
  const metrics = [
    ['', 'Mã có hàng tồn', summary.data?.withStock, 'box'],
    ['lowStock', 'Dưới ngưỡng', summary.data?.lowStock, 'sliders'],
    [
      'unavailable',
      'Có hàng chưa bán được',
      summary.data?.unavailable,
      'clock',
    ],
    [
      'expiryAlert',
      'Có lô sắp hết, hết hạn',
      summary.data?.expiryAlert,
      'hourglass',
    ],
  ] as const
  const weights = [
    28,
    ...(grouped ? [] : [8]),
    7,
    8,
    8,
    10,
    ...(scope.owner ? [12] : []),
    14,
    23,
  ]
  const weightTotal = weights.reduce((a, b) => a + b, 0)
  const columns = grouped ? 8 : scope.owner ? 9 : 8
  const areas = areaResource.data ?? []
  function saved(row: StockRow) {
    const replace = (rows: StockRow[]) =>
      rows.map((item) => (stockKey(item) === stockKey(row) ? row : item))
    complete.updateData(replace)
    filtered.updateData(replace)
    paged.updateData((data) => ({ ...data, items: replace(data.items) }))
    setSettings(undefined)
    if (lotRow && stockKey(lotRow) === stockKey(row)) setLotRow(row)
    setSummaryRevision((value) => value + 1)
    if (filters.q || filters.storageArea || view)
      setRevision((value) => value + 1)
  }
  function toggle(id: number) {
    setExpanded((previous) => {
      const next = new Set(previous)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  function actions(row: StockRow) {
    return (
      <div className="stock-row-actions">
        <button
          aria-expanded={
            lotRow?.storeId === row.storeId &&
            lotRow?.productId === row.productId
          }
          onClick={() =>
            setLotRow((previous) =>
              previous && stockKey(previous) === stockKey(row)
                ? undefined
                : row,
            )
          }
        >
          Lô
        </button>
        <Link to={movementLink(row.productId, row.storeId)}>Lịch sử</Link>
        <button onClick={() => setSettings({ row, mode: 'location' })}>
          Vị trí
        </button>
        <button onClick={() => setSettings({ row, mode: 'threshold' })}>
          Ngưỡng
        </button>
      </div>
    )
  }
  function quantities(rows: StockRow[], group = false) {
    const totals = stockTotals(rows),
      product = rows[0]
    const lows = rows.filter((row) => row.lowStock).length
    return (
      <>
        <td className="stock-numeric stock-available">
          {number.format(totals.availableQty)}
        </td>
        <td
          className={
            'stock-numeric' + (!totals.unavailableQty ? ' stock-zero' : '')
          }
        >
          {number.format(totals.unavailableQty)}
        </td>
        <td
          className={
            'stock-numeric' + (!totals.inTransitQty ? ' stock-zero' : '')
          }
        >
          {number.format(totals.inTransitQty)}
        </td>
        <td className="stock-numeric">
          <strong>{number.format(totals.onHandQty)}</strong> {product.baseUnit}
        </td>
        {scope.owner && (
          <td className="stock-numeric stock-cost">
            {money.format(totals.stockValue)}
            {totals.incompleteCost && <small>Chưa đủ giá vốn</small>}
          </td>
        )}
        <td>
          <div className="stock-condition">
            <span
              className={
                'stock-badge ' +
                (lows
                  ? 'stock-badge--near_expiry'
                  : totals.availableQty
                    ? 'stock-badge--ok'
                    : '')
              }
            >
              {lows
                ? group
                  ? 'Thiếu ở ' + lows + ' kho'
                  : 'Dưới ngưỡng'
                : totals.availableQty
                  ? 'Đủ hàng'
                  : 'Hết hàng'}
            </span>
            {rows.some((row) => row.expiredQty > 0) ? (
              <span className="stock-badge stock-badge--expired">
                Lô hết hạn
              </span>
            ) : rows.some((row) => row.nearExpiryQty > 0) ? (
              <span className="stock-badge stock-badge--near_expiry">
                Lô sắp hết hạn
              </span>
            ) : null}
            {!group && product.productStatus !== 'ACTIVE' && (
              <span className="stock-badge">Ngừng kinh doanh</span>
            )}
          </div>
        </td>
      </>
    )
  }
  return (
    <main className="inventory-workspace stock-screen">
      <StockHeaderSearch
        value={filters.q}
        onChange={(value) => scope.filter({ q: value }, true)}
      />
      <InventoryHeader title="Tồn kho" />
      <section className="stock-summary-card" aria-label="Tổng quan tồn kho">
        <div className="stock-metrics">
          {metrics.map(([key, label, value, icon]) => (
            <button
              key={key}
              aria-pressed={view === key}
              className={view === key ? 'selected' : ''}
              onClick={() => scope.filter({ view: key })}
            >
              <Icon name={icon} />
              <span>{label}</span>
              <strong>{value == null ? '—' : number.format(value)}</strong>
            </button>
          ))}
        </div>
        {grouped && (
          <nav className="stock-value-tiles" aria-label="Giá trị tồn theo kho">
            {[
              { id: '', storeName: 'Toàn chuỗi' },
              ...scope.stores
                .filter((store) => store.status !== 'PLANNED')
                .map((store) => ({
                  id: String(store.id),
                  storeName: store.storeName,
                })),
            ].map((store) => {
              const valueTotals = base.data
                ? stockTotals(
                    base.data.filter(
                      (row) => !store.id || String(row.storeId) === store.id,
                    ),
                  )
                : null
              return (
                <button
                  key={store.id}
                  aria-pressed={scope.storeId === store.id}
                  onClick={() =>
                    scope.filter({ storeId: store.id, storageArea: '' })
                  }
                >
                  <span>{store.storeName}</span>
                  <strong>
                    {valueTotals == null
                      ? '—'
                      : money.format(valueTotals.stockValue)}
                  </strong>
                  {valueTotals?.incompleteCost && (
                    <small>Chưa đủ giá vốn</small>
                  )}
                </button>
              )
            })}
          </nav>
        )}
      </section>
      <InventoryPanel
        title={
          'Tồn theo phụ tùng' +
          (scope.owner
            ? ' · ' + (scope.storeId ? scope.warehouse : 'toàn chuỗi')
            : '')
        }
        action={
          <button disabled title="Chưa thể xuất tệp lúc này">
            <Icon name="download" />
            Xuất Excel
          </button>
        }
      >
        <div className="stock-filters">
          <label className="stock-inline-search">
            <Icon name="search" />
            <input
              type="search"
              aria-label="Tìm tên, SKU, mã OEM hoặc ô kệ"
              placeholder="Tìm tên, SKU, mã OEM hoặc ô kệ"
              value={filters.q}
              onChange={(e) => scope.filter({ q: e.target.value }, true)}
            />
          </label>
          {scope.owner && (
            <select
              aria-label="Kho"
              value={scope.storeId}
              onChange={(e) =>
                scope.filter({ storeId: e.target.value, storageArea: '' })
              }
            >
              <option value="">Mọi kho</option>
              {scope.stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.storeName}
                </option>
              ))}
            </select>
          )}
          <select
            aria-label="Nhóm phụ tùng"
            value={filters.categoryId}
            onChange={(e) => scope.filter({ categoryId: e.target.value })}
          >
            <option value="">Mọi nhóm phụ tùng</option>
            {categoryOptions(categories.data ?? []).map((category) => (
              <option key={category.id} value={category.id}>
                {category.label}
              </option>
            ))}
          </select>
          <select
            aria-label="Khu vực"
            value={filters.storageArea}
            onChange={(e) => scope.filter({ storageArea: e.target.value })}
          >
            <option value="">Mọi khu vực</option>
            {areas.map((area) => (
              <option key={area}>{area}</option>
            ))}
          </select>
          {grouped && (
            <select
              aria-label="Sắp xếp"
              value={sort}
              onChange={(e) => scope.filter({ sort: e.target.value })}
            >
              <option value="name">Theo tên phụ tùng</option>
              <option value="value">Giá trị tồn cao nhất</option>
            </select>
          )}
          <label className="stock-check">
            <input
              type="checkbox"
              checked={includeZero}
              onChange={(e) => scope.filter({ includeZero: e.target.checked })}
            />
            Hiện cả mã tồn bằng 0
          </label>
        </div>
        <InventoryNotice loading={loading} error={error} />
        {(base.error || filtered.error) && (
          <button
            className="stock-reload"
            onClick={() => {
              setRevision((value) => value + 1)
              setCompleteRevision((value) => value + 1)
            }}
          >
            Thử lại
          </button>
        )}
        <div className="stock-table-scroll">
          <table className="stock-table stock-overview-table">
            <colgroup>
              {weights.map((weight, index) => (
                <col
                  key={index}
                  style={{ width: (weight / weightTotal) * 100 + '%' }}
                />
              ))}
            </colgroup>
            <thead>
              <tr>
                <th>Phụ tùng</th>
                {!grouped && <th>Ô kệ</th>}
                <th className="stock-numeric">Khả dụng</th>
                <th
                  className="stock-numeric"
                  title="Chờ kiểm, giao sai, hư hỏng, chờ trả nhà cung cấp"
                >
                  Không
                  <br />
                  khả dụng ⓘ
                </th>
                <th className="stock-numeric">
                  Đang
                  <br />
                  điều chuyển
                </th>
                <th
                  className="stock-numeric"
                  title="Khả dụng cộng không khả dụng; không tính hàng đang điều chuyển"
                >
                  Tồn
                  <br />
                  thực tế ⓘ
                </th>
                {scope.owner && <th className="stock-numeric">Giá trị tồn</th>}
                <th>Tình trạng</th>
                <th className="stock-actions-heading">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {ready &&
                grouped &&
                groups.slice(page * 20, (page + 1) * 20).map((group) => (
                  <Fragment key={group.product.productId}>
                    <tr className="stock-product-row">
                      <td>
                        <div className="stock-product-name">
                          <button
                            className="stock-tree-toggle"
                            aria-label={
                              (expanded.has(group.product.productId)
                                ? 'Đóng'
                                : 'Mở') +
                              ' tồn từng kho của ' +
                              group.product.partName
                            }
                            aria-expanded={expanded.has(
                              group.product.productId,
                            )}
                            onClick={() => toggle(group.product.productId)}
                          >
                            <svg
                              viewBox="0 0 16 16"
                              aria-hidden="true"
                              className={
                                expanded.has(group.product.productId)
                                  ? 'is-open'
                                  : ''
                              }
                            >
                              <path
                                d="m6 4 4 4-4 4"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.2"
                              />
                            </svg>
                          </button>
                          <div>
                            <Link
                              to={'/owner/products/' + group.product.productId}
                            >
                              {group.product.partName}
                            </Link>
                            <small>{group.product.sku}</small>
                          </div>
                        </div>
                      </td>
                      {quantities(group.rows, true)}
                      <td />
                    </tr>
                    {expanded.has(group.product.productId) &&
                      group.rows.map((row) => (
                        <Fragment key={stockKey(row)}>
                          <tr className="stock-warehouse-row">
                            <td>
                              <span
                                className="stock-tree-branch"
                                aria-hidden="true"
                              >
                                └
                              </span>
                              {row.storeName}
                            </td>
                            {quantities([row])}
                            <td>{actions(row)}</td>
                          </tr>
                          {lotRow && stockKey(lotRow) === stockKey(row) && (
                            <tr>
                              <td colSpan={columns}>
                                <StockLots row={row} owner={scope.owner} />
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      ))}
                  </Fragment>
                ))}
              {ready &&
                !grouped &&
                flat.map((row) => (
                  <Fragment key={stockKey(row)}>
                    <tr>
                      <td>
                        <Link
                          className="stock-product-link"
                          to={
                            (scope.owner ? '/owner' : '/branch-manager') +
                            '/products/' +
                            row.productId
                          }
                        >
                          {row.partName}
                        </Link>
                        <small>{row.sku}</small>
                      </td>
                      <td>{row.binLocation ?? '—'}</td>
                      {quantities([row])}
                      <td>{actions(row)}</td>
                    </tr>
                    {lotRow && stockKey(lotRow) === stockKey(row) && (
                      <tr>
                        <td colSpan={columns}>
                          <StockLots row={row} owner={scope.owner} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              {ready && !total && (
                <tr>
                  <td colSpan={columns} className="stock-empty">
                    Không có phụ tùng phù hợp.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          total={ready ? total : 0}
          page={page}
          loading={loading}
          onPage={(next) =>
            scope.setParams((previous) => {
              const params = new URLSearchParams(previous)
              params.set('page', String(next))
              return params
            })
          }
        />
      </InventoryPanel>
      {settings && (
        <StockSettingsDialog
          {...settings}
          areas={areas}
          stockRows={base.data}
          onClose={() => setSettings(undefined)}
          onSaved={saved}
        />
      )}
    </main>
  )
}

function StockHeaderSearch({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const target = useContext(HeaderSearchTarget)
  return target
    ? createPortal(
        <div className="account-search">
          <Icon name="search" />
          <input
            type="search"
            aria-label="Tìm phụ tùng theo SKU, tên, mã OEM"
            placeholder="Tìm phụ tùng theo SKU, tên, mã OEM…"
            value={value}
            onChange={(event) => onChange(event.target.value)}
          />
        </div>,
        target,
      )
    : null
}
