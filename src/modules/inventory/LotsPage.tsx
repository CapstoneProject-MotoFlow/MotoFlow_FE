import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useInventoryData, useInventoryScope } from './api'
import {
  InventoryHeader,
  InventoryNotice,
  InventoryPanel,
  Pagination,
  WarehouseFilter,
} from './components'
import { ExpiryWarningDialog } from './SettingsDialogs'
import { date, lotLink, sourceNames } from './presentation'
import type { LotList, Page } from './types'

export default function LotsPage() {
  const scope = useInventoryScope()
  const p = scope.params
  const [expiry, setExpiry] = useState(false)
  const [revision, setRevision] = useState(0)
  const [supplierSearch, setSupplierSearch] = useState('')
  const tab = p.get('tab') ?? 'NEAR_EXPIRY'
  const page = Math.max(0, Number(p.get('page')) || 0)
  const from = p.get('receivedFrom') ?? '',
    to = p.get('receivedTo') ?? ''
  const invalid = !!from && !!to && from > to
  const lots = useInventoryData<LotList>(
    '/inventory/lots',
    {
      storeId: scope.storeId,
      tab,
      q: p.get('q') ?? '',
      supplierId: p.get('supplierId') ?? '',
      source: p.get('source') ?? '',
      receivedFrom: from,
      receivedTo: to,
      page,
      size: 20,
    },
    revision,
    !invalid,
  )
  const suppliers = useInventoryData<
    Page<{ id: number; supplierName: string }>
  >('/suppliers', { q: supplierSearch, size: 20 }, 0, scope.owner)
  const selected = useInventoryData<{
    supplier: { id: number; supplierName: string }
  }>(
    '/suppliers/' + p.get('supplierId'),
    {},
    0,
    scope.owner && !!p.get('supplierId'),
  )
  const supplierOptions = [
    ...(selected.data ? [selected.data.supplier] : []),
    ...(suppliers.data?.items ?? []).filter(
      (item) => item.id !== selected.data?.supplier.id,
    ),
  ]
  return (
    <main className="inventory-workspace">
      <InventoryHeader title="Lô hàng">
        {scope.owner && (
          <button onClick={() => setExpiry(true)}>Cảnh báo hạn dùng</button>
        )}
      </InventoryHeader>
      <InventoryPanel title={'Lô hàng · ' + scope.warehouse}>
        <div className="stock-tabs" role="tablist" aria-label="Trạng thái lô">
          {Object.entries({
            NEAR_EXPIRY: 'Sắp hết hạn',
            EXPIRED: 'Đã hết hạn',
            IN_STOCK: 'Còn hàng',
            DEPLETED: 'Đã hết hàng',
          }).map(([key, label]) => (
            <button
              role="tab"
              aria-selected={tab === key}
              key={key}
              onClick={() => scope.filter({ tab: key })}
            >
              {label}
            </button>
          ))}
        </div>
        {tab === 'NEAR_EXPIRY' && lots.data && (
          <p className="stock-notice">
            {lots.data.expiryWarningDays == null
              ? 'Chưa thiết lập số ngày cảnh báo hạn dùng.'
              : 'Các lô còn hàng và hết hạn trong ' +
                lots.data.expiryWarningDays +
                ' ngày tới.'}
          </p>
        )}
        <div className="stock-filters">
          <label className="stock-filter stock-search">
            <span>Tìm kiếm</span>
            <input
              placeholder="Tên phụ tùng, SKU, mã lô…"
              value={p.get('q') ?? ''}
              onChange={(e) => scope.filter({ q: e.target.value })}
            />
          </label>
          <WarehouseFilter
            owner={scope.owner}
            stores={scope.stores}
            value={scope.storeId}
            onChange={(storeId) => scope.filter({ storeId })}
          />
          {scope.owner && (
            <>
              <label className="stock-filter">
                <span>Tìm nhà cung cấp</span>
                <input
                  value={supplierSearch}
                  placeholder="Tên nhà cung cấp…"
                  onChange={(e) => setSupplierSearch(e.target.value)}
                />
              </label>
              <label className="stock-filter">
                <span>Nhà cung cấp</span>
                <select
                  value={p.get('supplierId') ?? ''}
                  onChange={(e) => scope.filter({ supplierId: e.target.value })}
                >
                  <option value="">Mọi nhà cung cấp</option>
                  {supplierOptions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.supplierName}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
          <label className="stock-filter">
            <span>Nguồn lô</span>
            <select
              value={p.get('source') ?? ''}
              onChange={(e) => scope.filter({ source: e.target.value })}
            >
              <option value="">Mọi nguồn</option>
              {['RECEIPT', 'OPENING', 'COUNT_SURPLUS'].map((key) => (
                <option key={key} value={key}>
                  {sourceNames[key]}
                </option>
              ))}
            </select>
          </label>
          <label className="stock-filter">
            <span>Nhận từ ngày</span>
            <input
              type="date"
              max={to || undefined}
              value={from}
              onChange={(e) => scope.filter({ receivedFrom: e.target.value })}
            />
          </label>
          <label className="stock-filter">
            <span>Đến ngày</span>
            <input
              type="date"
              min={from || undefined}
              value={to}
              onChange={(e) => scope.filter({ receivedTo: e.target.value })}
            />
          </label>
        </div>
        <InventoryNotice
          loading={lots.loading}
          error={
            invalid
              ? 'Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.'
              : (lots.error ??
                scope.storesError ??
                suppliers.error ??
                selected.error)
          }
        />
        <div className="stock-table-scroll">
          <table className="stock-table">
            <thead>
              <tr>
                <th>Lô / phụ tùng</th>
                {scope.owner && <th>Kho</th>}
                <th>Nguồn / nhà cung cấp</th>
                <th>Ngày nhập</th>
                <th>Lô nhà sản xuất / ngày SX</th>
                <th>Hạn dùng</th>
                <th>Còn lại</th>
              </tr>
            </thead>
            <tbody>
              {lots.data?.page.items.map((row) => (
                <tr key={row.lotId + '-' + row.storeId}>
                  <td>
                    <Link to={lotLink(row.lotId, row.storeId)}>
                      L-{String(row.lotId).padStart(4, '0')}
                    </Link>
                    <small>
                      {row.partName} · {row.sku}
                    </small>
                  </td>
                  {scope.owner && <td>{row.storeName}</td>}
                  <td>{row.supplierName ?? sourceNames[row.sourceType]}</td>
                  <td>{date(row.receivedDate)}</td>
                  <td>
                    {row.manufacturerLotNo ?? '—'}
                    <small>{date(row.manufactureDate)}</small>
                  </td>
                  <td
                    className={
                      row.daysToExpiry != null && row.daysToExpiry < 0
                        ? 'stock-danger'
                        : ''
                    }
                  >
                    {date(row.expiryDate)}
                    {row.daysToExpiry != null && (
                      <small>
                        {row.daysToExpiry < 0
                          ? 'Quá hạn ' + Math.abs(row.daysToExpiry) + ' ngày'
                          : row.daysToExpiry === 0
                            ? 'Hết hạn hôm nay'
                            : 'Còn ' + row.daysToExpiry + ' ngày'}
                      </small>
                    )}
                  </td>
                  <td>
                    {row.remainingQty} {row.baseUnit}
                  </td>
                </tr>
              ))}
              {lots.data && !lots.data.page.items.length && (
                <tr>
                  <td colSpan={scope.owner ? 7 : 6} className="stock-empty">
                    Không có lô hàng phù hợp.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          total={lots.data?.page.totalItems ?? 0}
          page={page}
          loading={lots.loading}
          onPage={(next) =>
            scope.setParams((previous) => {
              const p = new URLSearchParams(previous)
              p.set('page', String(next))
              return p
            })
          }
        />
      </InventoryPanel>
      {expiry && scope.owner && (
        <ExpiryWarningDialog
          onClose={() => setExpiry(false)}
          onSaved={() => {
            setExpiry(false)
            setRevision((value) => value + 1)
          }}
        />
      )}
    </main>
  )
}
