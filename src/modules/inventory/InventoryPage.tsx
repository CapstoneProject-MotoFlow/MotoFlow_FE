import { Fragment, useContext, useState } from 'react'
import { createPortal } from 'react-dom'
import { HeaderSearchTarget } from '../../shared/ui/HeaderSearchTarget'
import { Link, useNavigate } from 'react-router-dom'
import Hint from '../../shared/ui/Hint'
import Icon from '../../shared/ui/Icon'
import SearchableFilter from '../../shared/ui/SearchableFilter'
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

/** Mức "sắp hết" theo ví dụ của cô Hoài (còn dưới 20-30 sản phẩm); người dùng vẫn tự nhập khoảng khác. */
const NEAR_OUT_LEVEL = 30
/** Số lượng gợi ý giống nút "Thêm phụ tùng dưới ngưỡng" của BE: đủ lại ngưỡng, ít nhất 1. */
const suggestedQty = (row: StockRow) =>
  Math.max((row.lowStockThreshold ?? 0) - row.availableQty, 1)
const parseQty = (value: string) =>
  value !== '' && Number.isFinite(Number(value)) && Number(value) >= 0
    ? Math.floor(Number(value))
    : undefined

export default function InventoryPage() {
  const scope = useInventoryScope(),
    p = scope.params
  const navigate = useNavigate()
  const [picked, setPicked] = useState<Map<string, StockRow>>(new Map())
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
  // Góp ý cô Hoài: tìm tồn kho theo khoảng tồn (tính trên số khả dụng).
  const minQty = parseQty(p.get('minQty') ?? ''),
    maxQty = parseQty(p.get('maxQty') ?? '')
  const rangeActive = minQty !== undefined || maxQty !== undefined
  const inRange = (qty: number) =>
    (minQty === undefined || qty >= minQty) &&
    (maxQty === undefined || qty <= maxQty)
  const complete = useCompleteStock(
    {},
    completeRevision,
    scope.owner,
    dataScope,
  )
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
  // BE chưa có tham số lọc theo khoảng tồn: khi có khoảng, đọc đủ tồn của kho rồi lọc trên máy.
  const ranged = useCompleteStock(
    { ...filters, storeId: scope.storeId },
    revision,
    !grouped && rangeActive,
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
    !grouped && !rangeActive,
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
    groupStock(scoped, matching, includeZero, view).filter(
      (group) => !rangeActive || inRange(group.totals.availableQty),
    ),
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
  const rangedFlat = sortStock(
    (ranged.data ?? []).filter(
      (row) =>
        (!scope.storeId || String(row.storeId) === scope.storeId) &&
        (includeZero || row.onHandQty + row.inTransitQty > 0) &&
        matchesStockView(row, view) &&
        inRange(row.availableQty),
    ),
    (row) => row,
    (row) => row.stockValue,
    'name',
  )
  const clientPaged = !grouped && rangeActive
  const loading = base.loading || filtered.loading || ranged.loading
  const error =
    ranged.error ??
    base.error ??
    filtered.error ??
    summary.error ??
    areaResource.error ??
    scope.storesError ??
    categories.error
  const ready = clientPaged
    ? !!ranged.data
    : !!base.data && (!grouped || !remoteFilter || !!filtered.data)
  const total = grouped
    ? groups.length
    : clientPaged
      ? rangedFlat.length
      : (paged.data?.totalItems ?? 0)
  const boundedPage = Math.min(
    Math.max(0, Math.floor(requestedPage)),
    Math.max(0, Math.ceil(total / 20) - 1),
  )
  const page = grouped || clientPaged ? boundedPage : requestedPage
  const flat = grouped
    ? sortedFlat
    : clientPaged
      ? rangedFlat.slice(page * 20, (page + 1) * 20)
      : (paged.data?.items ?? [])
  // Góp ý cô Hoài: tích chọn phụ tùng sắp hết (kể cả chưa chạm ngưỡng) rồi tạo nhanh yêu cầu.
  // Chỉ chọn khi đang xem một kho, vì yêu cầu bổ sung / nhập hàng luôn gắn với một cửa hàng.
  const selectable = !grouped
  const pickedRows = [...picked.values()].filter(
    (row) => !scope.storeId || String(row.storeId) === scope.storeId,
  )
  const pageKeys = flat.map(stockKey)
  const pageAllPicked =
    flat.length > 0 && pageKeys.every((key) => picked.has(key))
  function pick(row: StockRow, on: boolean) {
    setPicked((previous) => {
      const next = new Map(previous)
      if (on) next.set(stockKey(row), row)
      else next.delete(stockKey(row))
      return next
    })
  }
  function pickPage(on: boolean) {
    setPicked((previous) => {
      const next = new Map(previous)
      for (const row of flat) {
        if (on) next.set(stockKey(row), row)
        else next.delete(stockKey(row))
      }
      return next
    })
  }
  function createFromPicked(target: 'replenishment' | 'purchase') {
    const storeId = pickedRows[0]?.storeId
    const prefill = {
      storeId,
      lines: pickedRows.slice(0, 200).map((row) => ({
        productId: row.productId,
        sku: row.sku,
        partName: row.partName,
        qty: suggestedQty(row),
      })),
    }
    navigate(
      target === 'replenishment'
        ? '/replenishment-requests/new'
        : '/purchase-orders/new',
      { state: { prefill } },
    )
  }
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
  // Review C1: bảng vừa khung 1366px (cột thao tác 2x2, bỏ bớt khoảng đệm).
  const weights = [
    ...(selectable ? [4] : []),
    27,
    ...(grouped ? [] : [8]),
    8,
    8,
    9,
    9,
    ...(scope.owner ? [11] : []),
    12,
    15,
  ]
  const weightTotal = weights.reduce((a, b) => a + b, 0)
  const columns = (grouped ? 8 : scope.owner ? 9 : 8) + (selectable ? 1 : 0)
  const areas = areaResource.data ?? []
  function saved(row: StockRow) {
    const replace = (rows: StockRow[]) =>
      rows.map((item) => (stockKey(item) === stockKey(row) ? row : item))
    complete.updateData(replace)
    filtered.updateData(replace)
    ranged.updateData(replace)
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
      <div className="mf-row-actions stock-row-actions">
        <button
          type="button"
          className="mf-btn mf-btn--sm mf-btn--secondary"
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
        <Link
          className="mf-btn mf-btn--sm mf-btn--secondary"
          to={movementLink(row.productId, row.storeId)}
        >
          Lịch sử
        </Link>
        <button
          type="button"
          className="mf-btn mf-btn--sm mf-btn--secondary"
          onClick={() => setSettings({ row, mode: 'location' })}
        >
          Vị trí
        </button>
        <button
          type="button"
          className="mf-btn mf-btn--sm mf-btn--secondary"
          onClick={() => setSettings({ row, mode: 'threshold' })}
        >
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
        {scope.owner && (
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
              const valueTotals = complete.data
                ? stockTotals(
                    complete.data.filter(
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
            <SearchableFilter
              label="Kho"
              maxOptions={5}
              value={scope.storeId}
              onChange={(value) =>
                scope.filter({ storeId: value, storageArea: '' })
              }
              options={[
                { value: '', label: 'Mọi kho' },
                ...scope.stores.map((store) => ({
                  value: String(store.id),
                  label: store.storeName,
                })),
              ]}
            />
          )}
          <SearchableFilter
            label="Nhóm phụ tùng"
            maxOptions={5}
            value={filters.categoryId}
            onChange={(value) => scope.filter({ categoryId: value })}
            options={[
              { value: '', label: 'Mọi nhóm phụ tùng' },
              ...categoryOptions(categories.data ?? []).map((category) => ({
                value: String(category.id),
                label: category.label ?? category.categoryName,
              })),
            ]}
          />
          <SearchableFilter
            label="Khu vực"
            maxOptions={5}
            value={filters.storageArea}
            onChange={(value) => scope.filter({ storageArea: value })}
            options={[
              { value: '', label: 'Mọi khu vực' },
              ...areas.map((area) => ({ value: area, label: area })),
            ]}
          />
          {grouped && (
            <SearchableFilter
              label="Sắp xếp"
              maxOptions={5}
              value={sort}
              onChange={(value) => scope.filter({ sort: value })}
              options={[
                { value: 'name', label: 'Theo tên phụ tùng' },
                { value: 'value', label: 'Giá trị tồn cao nhất' },
              ]}
            />
          )}
          <label className="stock-check">
            <input
              type="checkbox"
              checked={includeZero}
              onChange={(e) => scope.filter({ includeZero: e.target.checked })}
            />
            Hiện cả mã tồn bằng 0
          </label>
          <fieldset className="stock-range" aria-label="Khoảng tồn có thể bán">
            <legend>Tồn có thể bán</legend>
            <input
              type="number"
              min={0}
              inputMode="numeric"
              aria-label="Tồn có thể bán từ"
              placeholder="Từ"
              value={p.get('minQty') ?? ''}
              onChange={(e) => scope.filter({ minQty: e.target.value }, true)}
            />
            <span aria-hidden="true">–</span>
            <input
              type="number"
              min={0}
              inputMode="numeric"
              aria-label="Tồn có thể bán đến"
              placeholder="Đến"
              value={p.get('maxQty') ?? ''}
              onChange={(e) => scope.filter({ maxQty: e.target.value }, true)}
            />
            <button
              type="button"
              className="stock-range-preset"
              aria-pressed={minQty === undefined && maxQty === NEAR_OUT_LEVEL}
              onClick={() =>
                scope.filter({ minQty: '', maxQty: NEAR_OUT_LEVEL, view: '' })
              }
            >
              Sắp hết (≤ {NEAR_OUT_LEVEL})
            </button>
            {rangeActive && (
              <button
                type="button"
                className="mf-btn mf-btn--link"
                onClick={() => scope.filter({ minQty: '', maxQty: '' })}
              >
                Bỏ khoảng
              </button>
            )}
          </fieldset>
        </div>
        {grouped && <Hint>Chọn một kho để tạo nhanh yêu cầu nhập.</Hint>}
        {selectable && pickedRows.length > 0 && (
          <div
            className="stock-pick-bar"
            role="region"
            aria-label="Phụ tùng đã chọn"
          >
            <span>
              Đã chọn <strong>{pickedRows.length}</strong> phụ tùng ·{' '}
              {pickedRows[0].storeName}
              <small>Số lượng gợi ý theo ngưỡng tồn, sửa lại ở bước sau.</small>
            </span>
            <button
              type="button"
              className="mf-btn mf-btn--link"
              onClick={() => setPicked(new Map())}
            >
              Bỏ chọn
            </button>
            <button
              type="button"
              className={
                'mf-btn ' +
                (scope.owner ? 'mf-btn--secondary' : 'mf-btn--primary')
              }
              onClick={() => createFromPicked('replenishment')}
            >
              Tạo yêu cầu bổ sung
            </button>
            {scope.owner && (
              <button
                type="button"
                className="mf-btn mf-btn--primary"
                onClick={() => createFromPicked('purchase')}
              >
                Tạo yêu cầu nhập hàng
              </button>
            )}
          </div>
        )}
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
        <Hint>
          Có thể bán: hàng bán ngay được. Chưa bán được: hàng hỏng, giao sai,
          chờ kiểm, chờ trả nhà cung cấp. Tồn thực tế = có thể bán + chưa bán
          được, không tính hàng đang chuyển.
        </Hint>
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
                {selectable && (
                  <th className="stock-pick-cell">
                    <input
                      type="checkbox"
                      aria-label="Chọn tất cả phụ tùng trên trang này"
                      checked={pageAllPicked}
                      disabled={!flat.length}
                      onChange={(e) => pickPage(e.target.checked)}
                    />
                  </th>
                )}
                <th>Phụ tùng</th>
                {!grouped && <th>Vị trí (khu – kệ)</th>}
                <th className="stock-numeric">Có thể bán</th>
                <th
                  className="stock-numeric"
                  title="Gồm hàng hỏng, giao sai, chờ kiểm, chờ trả nhà cung cấp"
                >
                  Chưa
                  <br />
                  bán được ⓘ
                </th>
                <th className="stock-numeric">
                  Đang
                  <br />
                  chuyển
                </th>
                <th
                  className="stock-numeric"
                  title="Có thể bán cộng chưa bán được; không tính hàng đang chuyển"
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
                    <tr
                      className={picked.has(stockKey(row)) ? 'is-picked' : ''}
                    >
                      <td className="stock-pick-cell">
                        <input
                          type="checkbox"
                          aria-label={'Chọn ' + row.partName}
                          checked={picked.has(stockKey(row))}
                          onChange={(e) => pick(row, e.target.checked)}
                        />
                      </td>
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
