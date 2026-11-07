import { Fragment, useState } from 'react'
import Icon from '../../shared/ui/Icon'
import { Link } from 'react-router-dom'
import { useInventoryData, useInventoryScope } from './api'
import {
  InventoryHeader,
  InventoryNotice,
  InventoryPanel,
  Pagination,
  WarehouseFilter,
} from './components'
import { categoryOptions, type Category } from '../catalog/api/searchProducts'
import { StockLots } from './StockDetails'
import { ExpiryWarningDialog, StockSettingsDialog } from './SettingsDialogs'
import { money, movementLink, number } from './presentation'
import type { Page, StockRow, StockSummary } from './types'

export default function InventoryPage() {
  const scope = useInventoryScope()
  const [revision, setRevision] = useState(0)
  const [expanded, setExpanded] = useState('')
  const [settings, setSettings] = useState<{
    row: StockRow
    mode: 'location' | 'threshold'
  }>()
  const [expiry, setExpiry] = useState(false)
  const p = scope.params
  const page = Math.max(0, Number(p.get('page')) || 0)
  const filters = {
    storeId: scope.storeId,
    q: p.get('q') ?? '',
    categoryId: p.get('categoryId') ?? '',
    storageArea: p.get('storageArea') ?? '',
  }
  const stock = useInventoryData<Page<StockRow>>(
    '/inventory/stock',
    {
      ...filters,
      page,
      size: 20,
      includeZero: p.get('includeZero') === 'true',
      lowStockOnly: p.get('view') === 'lowStock',
      unavailableOnly: p.get('view') === 'unavailable',
      expiryAlertOnly: p.get('view') === 'expiryAlert',
    },
    revision,
  )
  const summary = useInventoryData<StockSummary>(
    '/inventory/stock/summary',
    filters,
    revision,
  )
  const areas = useInventoryData<string[]>(
    '/inventory/stock/storage-areas',
    { storeId: scope.storeId },
    revision,
  )
  const categories = useInventoryData<Category[]>('/part-categories')
  function saved() {
    setSettings(undefined)
    setExpiry(false)
    setRevision((value) => value + 1)
  }
  return (
    <main className="inventory-workspace">
      <InventoryHeader title="Tồn kho">
        {scope.owner && (
          <button onClick={() => setExpiry(true)}>Cảnh báo hạn dùng</button>
        )}
      </InventoryHeader>
      <div className="stock-metrics" aria-label="Lọc theo tình trạng tồn">
        {(
          [
            ['', 'withStock', 'Phụ tùng có tồn'],
            ['lowStock', 'lowStock', 'Dưới ngưỡng tồn'],
            ['unavailable', 'unavailable', 'Có tồn không khả dụng'],
            ['expiryAlert', 'expiryAlert', 'Cảnh báo hạn dùng'],
          ] as const
        ).map(([view, key, label]) => (
          <button
            key={key}
            className={
              p.get('view') === view || (!p.get('view') && !view)
                ? 'selected'
                : ''
            }
            onClick={() => scope.filter({ view })}
          >
            <Icon
              name={
                key === 'withStock'
                  ? 'box'
                  : key === 'lowStock'
                    ? 'sliders'
                    : key === 'unavailable'
                      ? 'clock'
                      : 'hourglass'
              }
            />
            <span>{label}</span>
            <strong>
              {summary.data ? number.format(summary.data[key]) : '—'}
            </strong>
          </button>
        ))}
      </div>
      <InventoryPanel title={'Tồn kho · ' + scope.warehouse}>
        <div className="stock-filters">
          <WarehouseFilter
            owner={scope.owner}
            stores={scope.stores}
            value={scope.storeId}
            onChange={(storeId) => scope.filter({ storeId, storageArea: '' })}
          />
          <label className="stock-filter stock-search">
            <span>Tìm kiếm</span>
            <input
              placeholder="Tìm tên, SKU, mã OEM, vị trí…"
              value={filters.q}
              onChange={(e) => scope.filter({ q: e.target.value })}
            />
          </label>
          <label className="stock-filter">
            <span>Nhóm phụ tùng</span>
            <select
              value={filters.categoryId}
              onChange={(e) => scope.filter({ categoryId: e.target.value })}
            >
              <option value="">Mọi nhóm</option>
              {categoryOptions(categories.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label className="stock-filter">
            <span>Khu vực</span>
            <select
              value={filters.storageArea}
              onChange={(e) => scope.filter({ storageArea: e.target.value })}
            >
              <option value="">Mọi khu vực</option>
              {areas.data?.map((area) => (
                <option key={area}>{area}</option>
              ))}
            </select>
          </label>
          <label className="stock-check">
            <input
              type="checkbox"
              checked={p.get('includeZero') === 'true'}
              onChange={(e) => scope.filter({ includeZero: e.target.checked })}
            />{' '}
            Hiện cả hết hàng
          </label>
        </div>
        <InventoryNotice
          loading={stock.loading}
          error={
            stock.error ??
            scope.storesError ??
            summary.error ??
            areas.error ??
            categories.error
          }
        />
        <div className="stock-table-scroll">
          <table className="stock-table">
            <thead>
              <tr>
                <th>Phụ tùng / vị trí</th>
                {scope.owner && !scope.storeId && <th>Kho</th>}
                <th>Khả dụng</th>
                <th title="Chờ kiểm, giao sai, hư hỏng, chờ trả nhà cung cấp">
                  Không khả dụng ⓘ
                </th>
                <th>Đang chuyển</th>
                <th title="Khả dụng cộng không khả dụng, không gồm hàng đang điều chuyển">
                  Tồn thực tế ⓘ
                </th>
                {scope.owner && <th>Giá trị tồn</th>}
                <th>Tình trạng</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {stock.data?.items.map((row) => {
                const key = row.storeId + '-' + row.productId
                return (
                  <Fragment key={key}>
                    <tr>
                      <td>
                        <button
                          className="stock-text"
                          aria-expanded={expanded === key}
                          onClick={() =>
                            setExpanded(expanded === key ? '' : key)
                          }
                        >
                          {expanded === key ? '▾' : '▸'} {row.partName}
                        </button>
                        <small>
                          {row.sku} ·{' '}
                          {[row.storageArea, row.binLocation]
                            .filter(Boolean)
                            .join(' / ') || 'Chưa đặt vị trí'}
                        </small>
                        {row.productStatus !== 'ACTIVE' && (
                          <small>Ngừng kinh doanh</small>
                        )}
                      </td>
                      {scope.owner && !scope.storeId && (
                        <td>{row.storeName}</td>
                      )}
                      <td className={row.lowStock ? 'stock-danger' : ''}>
                        {number.format(row.availableQty)}
                        <small>Ngưỡng: {row.lowStockThreshold ?? '—'}</small>
                      </td>
                      <td
                        title={`Chờ kiểm: ${row.awaitingInspectionQty} · Sai: ${row.wrongItemQty} · Hỏng: ${row.damagedQty} · Chờ trả: ${row.awaitingSupplierReturnQty}`}
                      >
                        {number.format(
                          row.awaitingInspectionQty +
                            row.wrongItemQty +
                            row.damagedQty +
                            row.awaitingSupplierReturnQty,
                        )}
                      </td>
                      <td>{number.format(row.inTransitQty)}</td>
                      <td>
                        {number.format(row.onHandQty)} {row.baseUnit}
                        {(row.nearExpiryQty > 0 || row.expiredQty > 0) && (
                          <small className="stock-danger">
                            Sắp hết hạn: {row.nearExpiryQty} · Hết hạn:{' '}
                            {row.expiredQty}
                          </small>
                        )}
                      </td>
                      {scope.owner && (
                        <td>
                          {row.stockValue == null
                            ? '—'
                            : money.format(row.stockValue)}
                        </td>
                      )}
                      <td>
                        <div className="stock-condition">
                          <span
                            className={
                              'stock-badge ' +
                              (row.lowStock
                                ? 'stock-badge--near_expiry'
                                : 'stock-badge--ok')
                            }
                          >
                            {row.lowStock
                              ? 'Dưới ngưỡng'
                              : row.availableQty === 0
                                ? 'Hết khả dụng'
                                : 'Đủ hàng'}
                          </span>
                          {row.expiredQty > 0 ? (
                            <span className="stock-badge stock-badge--expired">
                              Lô hết hạn
                            </span>
                          ) : row.nearExpiryQty > 0 ? (
                            <span className="stock-badge stock-badge--near_expiry">
                              Lô sắp hết hạn
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td>
                        <div className="stock-actions">
                          <Link to={movementLink(row.productId, row.storeId)}>
                            Lịch sử
                          </Link>
                          <button
                            onClick={() =>
                              setSettings({ row, mode: 'location' })
                            }
                          >
                            Vị trí
                          </button>
                          <button
                            onClick={() =>
                              setSettings({ row, mode: 'threshold' })
                            }
                          >
                            Ngưỡng tồn
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expanded === key && (
                      <tr>
                        <td colSpan={scope.owner ? (scope.storeId ? 8 : 9) : 7}>
                          <StockLots
                            key={revision}
                            row={row}
                            owner={scope.owner}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
              {stock.data && !stock.data.items.length && (
                <tr>
                  <td
                    colSpan={scope.owner ? (scope.storeId ? 8 : 9) : 7}
                    className="stock-empty"
                  >
                    Không có phụ tùng phù hợp.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          total={stock.data?.totalItems ?? 0}
          page={page}
          loading={stock.loading}
          onPage={(next) =>
            scope.setParams((previous) => {
              const p = new URLSearchParams(previous)
              p.set('page', String(next))
              return p
            })
          }
        />
      </InventoryPanel>
      {settings && (
        <StockSettingsDialog
          {...settings}
          areas={areas.data ?? []}
          onClose={() => setSettings(undefined)}
          onSaved={saved}
        />
      )}
      {expiry && scope.owner && (
        <ExpiryWarningDialog onClose={() => setExpiry(false)} onSaved={saved} />
      )}
    </main>
  )
}
