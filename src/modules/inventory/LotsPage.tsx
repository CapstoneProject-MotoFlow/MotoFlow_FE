import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useInventoryScope } from './api'
import {
  InventoryHeader,
  InventoryNotice,
  InventoryPanel,
  Pagination,
  WarehouseFilter,
} from './components'
import { ExpiryWarningDialog } from './SettingsDialogs'
import { date, lotLink, sourceNames } from './presentation'
import type { LotRow } from './types'
import { useLotCollection } from './useLotCollection'
import './inventory-screens.css'

export default function LotsPage() {
  const scope = useInventoryScope()
  const p = scope.params
  const [expiry, setExpiry] = useState(false)
  const [revision, setRevision] = useState(0)

  const tab = p.get('tab') ?? 'NEAR_EXPIRY'
  const page = Math.max(0, Number(p.get('page')) || 0)
  const from = p.get('receivedFrom') ?? '',
    to = p.get('receivedTo') ?? ''
  const invalid = !!from && !!to && from > to
  const collection = useLotCollection(
    scope.storeId,
    String(scope.user?.id) + ':' + scope.user?.role,
    revision,
  )
  const grouped = new Map<number, LotRow>()
  for (const row of collection.rows ?? []) {
    const prior = grouped.get(row.lotId)
    grouped.set(
      row.lotId,
      prior
        ? { ...prior, remainingQty: prior.remainingQty + row.remainingQty }
        : { ...row },
    )
  }
  const rows = [...grouped.values()]
  const inTab = (row: LotRow, value: string) =>
    value === 'DEPLETED'
      ? row.remainingQty === 0
      : row.remainingQty > 0 &&
        (value === 'IN_STOCK' ||
          (value === 'EXPIRED'
            ? row.daysToExpiry != null && row.daysToExpiry < 0
            : collection.days != null &&
              row.daysToExpiry != null &&
              row.daysToExpiry >= 0 &&
              row.daysToExpiry <= collection.days))
  const query = (p.get('q') ?? '').toLocaleLowerCase()
  const filtered = rows.filter(
    (row) =>
      inTab(row, tab) &&
      (!query ||
        [
          row.partName,
          row.sku,
          row.manufacturerLotNo,
          'L-' + String(row.lotId).padStart(4, '0'),
          String(row.lotId),
        ].some((value) => value?.toLocaleLowerCase().includes(query))) &&
      (!p.get('supplierId') ||
        String(row.supplierId) === p.get('supplierId')) &&
      (!p.get('source') || row.sourceType === p.get('source')) &&
      (tab !== 'DEPLETED' ||
        ((!from || row.receivedDate >= from) &&
          (!to || row.receivedDate <= to))),
  )
  filtered.sort((a, b) =>
    p.get('sort') === 'received' || tab === 'DEPLETED'
      ? b.receivedDate.localeCompare(a.receivedDate)
      : (a.expiryDate ?? '9999').localeCompare(b.expiryDate ?? '9999') ||
        a.receivedDate.localeCompare(b.receivedDate),
  )
  const lots = {
    loading: collection.loading,
    error: collection.error,
    data: collection.rows
      ? {
          expiryWarningDays: collection.days,
          page: {
            items: filtered.slice(page * 20, page * 20 + 20),
            totalItems: filtered.length,
          },
        }
      : undefined,
  }
  const supplierOptions = [
    ...new Map(
      (collection.rows ?? [])
        .filter((row) => row.supplierId != null)
        .map((row) => [
          row.supplierId,
          { id: row.supplierId!, supplierName: row.supplierName ?? '—' },
        ]),
    ).values(),
  ]
  return (
    <main className="inventory-workspace inventory-screen">
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
              {key !== 'DEPLETED' && collection.rows && (
                <span className="stock-badge">
                  {rows.filter((row) => inTab(row, key)).length}
                </span>
              )}
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
          <>
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
          {tab === 'DEPLETED' && (
            <>
              <label className="stock-filter">
                <span>Nhận từ ngày</span>
                <input
                  type="date"
                  max={to || undefined}
                  value={from}
                  onChange={(e) =>
                    scope.filter({ receivedFrom: e.target.value })
                  }
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
            </>
          )}
          {tab === 'IN_STOCK' && (
            <label className="stock-filter">
              <span>Sắp xếp</span>
              <select
                value={p.get('sort') ?? 'expiry'}
                onChange={(e) => scope.filter({ sort: e.target.value })}
              >
                <option value="expiry">Hạn dùng sớm nhất trước</option>
                <option value="received">Nhận mới nhất trước</option>
              </select>
            </label>
          )}
        </div>
        <InventoryNotice
          loading={lots.loading}
          error={
            invalid
              ? 'Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.'
              : (lots.error ?? scope.storesError)
          }
        />
        <div className="stock-table-scroll">
          <table className="stock-table">
            <thead>
              <tr>
                <th>Lô</th>
                <th>Phụ tùng</th>
                <th>Nguồn / nhà cung cấp</th>
                {['IN_STOCK', 'DEPLETED'].includes(tab) && <th>Ngày nhập</th>}
                <th>Lô nhà sản xuất / ngày SX</th>
                <th>Hạn dùng</th>
                {['NEAR_EXPIRY', 'EXPIRED'].includes(tab) && (
                  <th>{tab === 'EXPIRED' ? 'Quá hạn' : 'Còn tới hạn'}</th>
                )}
                <th>{tab === 'DEPLETED' ? 'Đã nhận' : 'Còn lại'}</th>
                {scope.owner && <th>Giá vốn lô</th>}
                {!scope.owner && tab === 'EXPIRED' && <th>Cần làm</th>}
              </tr>
            </thead>
            <tbody>
              {lots.data?.page.items.map((row) => (
                <tr key={row.lotId + '-' + row.storeId}>
                  <td>
                    <Link to={lotLink(row.lotId, row.storeId)}>
                      L-{String(row.lotId).padStart(4, '0')}
                    </Link>
                  </td>
                  <td>
                    {row.partName}
                    <small>{row.sku}</small>
                  </td>
                  <td>{row.supplierName ?? sourceNames[row.sourceType]}</td>
                  {['IN_STOCK', 'DEPLETED'].includes(tab) && (
                    <td>{date(row.receivedDate)}</td>
                  )}
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
                  {['NEAR_EXPIRY', 'EXPIRED'].includes(tab) && (
                    <td>
                      {row.daysToExpiry == null
                        ? '—'
                        : Math.abs(row.daysToExpiry) + ' ngày'}
                    </td>
                  )}
                  <td>
                    {tab === 'DEPLETED' ? '—' : row.remainingQty} {row.baseUnit}
                  </td>
                  {scope.owner && <td>—</td>}
                  {!scope.owner && tab === 'EXPIRED' && (
                    <td>
                      <button
                        disabled
                        title="Chưa thể gửi yêu cầu hủy hàng lúc này"
                      >
                        Báo hủy hàng hết hạn
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {lots.data && !lots.data.page.items.length && (
                <tr>
                  <td colSpan={10} className="stock-empty">
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
