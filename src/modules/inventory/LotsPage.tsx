import { useState } from 'react'
import { Link } from 'react-router-dom'
import SearchableFilter from '../../shared/ui/SearchableFilter'
import Hint from '../../shared/ui/Hint'
import { useInventoryData, useInventoryScope } from './api'
import {
  InventoryHeader,
  InventoryNotice,
  InventoryPanel,
  Pagination,
} from './components'
import { ExpiryWarningDialog } from './SettingsDialogs'
import { date, lotLink, money, sourceNames } from './presentation'
import type { LotDetail, LotList, Page } from './types'
import { documentCode } from '../../shared/utils/documentCode'
import './inventory-screens.css'
const pageSize = 10

function LotCost({ id, storeId }: { id: number; storeId: number }) {
  const [revision, setRevision] = useState(0)
  const result = useInventoryData<LotDetail>(
    '/inventory/lots/' + id,
    { storeId },
    revision,
  )
  if (result.loading) return <span role="status">Đang tải…</span>
  if (result.error)
    return (
      <span role="alert">
        {result.error}{' '}
        <button type="button" onClick={() => setRevision((value) => value + 1)}>
          Thử lại
        </button>
      </span>
    )
  return (
    <span>
      {result.data?.purchaseUnitPrice == null
        ? 'Chưa có giá vốn'
        : money.format(result.data.purchaseUnitPrice)}
    </span>
  )
}
export default function LotsPage() {
  const scope = useInventoryScope(),
    p = scope.params
  const [expiry, setExpiry] = useState(false),
    [revision, setRevision] = useState(0),
    [lotSearch, setLotSearch] = useState<string | null>(null),
    [supplierSearch, setSupplierSearch] = useState<string | null>(null)
  const tab = p.get('tab') ?? 'NEAR_EXPIRY',
    page = Math.max(0, Math.floor(Number(p.get('page')) || 0))
  const from = p.get('receivedFrom') ?? '',
    to = p.get('receivedTo') ?? ''
  const invalid = tab === 'DEPLETED' && !!from && !!to && from > to
  const q = p.get('q') ?? ''
  const supplierId = p.get('supplierId') ?? ''
  const filters = {
    storeId: scope.storeId,
    tab,
    supplierId,
    source: p.get('source') ?? '',
    receivedFrom: tab === 'DEPLETED' ? from : '',
    receivedTo: tab === 'DEPLETED' ? to : '',
  }
  const lots = useInventoryData<LotList>(
    '/inventory/lots',
    { ...filters, q, page, size: pageSize },
    revision,
    !invalid,
  )
  const typedLot = lotSearch?.trim() ?? ''
  const lotQuery = typedLot.replace(/^L-0*(?=\d+$)/i, '')
  const lotSuggestions = useInventoryData<LotList>(
    '/inventory/lots',
    { ...filters, q: lotQuery, page: 0, size: pageSize },
    revision,
    !invalid && lotSearch !== null,
  )
  const lotOptions = new Map<string, string>()
  if (typedLot) lotOptions.set(lotQuery, 'Tìm “' + typedLot + '”')
  else lotOptions.set('', 'Mọi lô hàng')
  if (lotSearch === null && q) lotOptions.set(q, q)
  for (const row of lotSuggestions.data?.page.items ?? []) {
    const id = String(row.lotId)
    if (!lotOptions.has(id))
      lotOptions.set(id, documentCode('L', id) + ' · ' + row.partName)
  }
  const suppliers = useInventoryData<
    Page<{ id: number; supplierName: string }>
  >(
    '/suppliers',
    { q: supplierSearch?.trim(), size: 20 },
    0,
    scope.owner && supplierSearch !== null,
  )
  const selected = useInventoryData<{
    supplier: { id: number; supplierName: string }
  }>('/suppliers/' + supplierId, {}, 0, scope.owner && !!supplierId)
  const options = [
    ...(selected.data && !supplierSearch ? [selected.data.supplier] : []),
    ...(suppliers.data?.items ?? []).filter(
      (row) => !!supplierSearch || row.id !== selected.data?.supplier.id,
    ),
  ]
  return (
    <main className="inventory-workspace inventory-screen inventory-lots-screen">
      <InventoryHeader title="Lô hàng" />
      {/* Góp ý cô Hoài: nói rõ lô chỉ phục vụ tính giá vốn. */}
      <Hint>
        Lô dùng để tính giá vốn và theo dõi hạn dùng. Khi xuất, hệ thống trừ lô
        gần hết hạn trước, rồi tới lô cũ nhất. Hệ thống không quản lý vị trí kệ
        theo lô.
      </Hint>
      <InventoryPanel
        title={'Lô hàng · ' + scope.warehouse}
        action={
          scope.owner && (
            <button onClick={() => setExpiry(true)}>Cảnh báo hạn dùng</button>
          )
        }
      >
        <div className="stock-tabs" role="tablist" aria-label="Trạng thái lô">
          {Object.entries({
            NEAR_EXPIRY: 'Sắp hết hạn',
            EXPIRED: 'Đã hết hạn',
            IN_STOCK: 'Còn hàng',
            DEPLETED: 'Đã hết hàng',
          }).map(([key, label]) => (
            <button
              key={key}
              role="tab"
              aria-selected={tab === key}
              onClick={() => scope.filter({ tab: key })}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="stock-filters">
          <div className="stock-filter stock-search">
            <span>Tìm kiếm</span>
            <SearchableFilter
              label="Tìm lô hàng"
              searchPlaceholder="Tên phụ tùng, SKU, số lô…"
              value={q}
              options={Array.from(lotOptions, ([value, label]) => ({
                value,
                label,
              }))}
              loading={lotSuggestions.loading}
              onSearch={setLotSearch}
              onChange={(value) => scope.filter({ q: value })}
            />
          </div>
          {scope.owner && (
            <>
              <div className="stock-filter">
                <span>Kho</span>
                <SearchableFilter
                  label="Kho"
                  value={scope.storeId}
                  options={[
                    { value: '', label: 'Mọi kho' },
                    ...scope.stores.map((store) => ({
                      value: String(store.id),
                      label: store.storeName,
                    })),
                  ]}
                  onChange={(storeId) => scope.filter({ storeId })}
                />
              </div>
              <div className="stock-filter stock-lot-supplier-filter">
                <span>Nhà cung cấp</span>
                <SearchableFilter
                  label="Nhà cung cấp"
                  value={supplierId}
                  options={[
                    ...(!supplierSearch?.trim()
                      ? [{ value: '', label: 'Mọi nhà cung cấp' }]
                      : []),
                    ...options.map((supplier) => ({
                      value: String(supplier.id),
                      label: supplier.supplierName,
                    })),
                  ]}
                  loading={suppliers.loading}
                  onSearch={setSupplierSearch}
                  onChange={(value) => scope.filter({ supplierId: value })}
                />
              </div>
            </>
          )}
          <div className="stock-filter">
            <span>Nguồn lô</span>
            <SearchableFilter
              label="Nguồn lô"
              value={filters.source}
              options={[
                { value: '', label: 'Mọi nguồn' },
                ...['RECEIPT', 'OPENING', 'COUNT_SURPLUS'].map((value) => ({
                  value,
                  label: sourceNames[value],
                })),
              ]}
              onChange={(value) => scope.filter({ source: value })}
            />
          </div>
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
        </div>
        <InventoryNotice
          loading={lots.loading}
          error={
            invalid
              ? 'Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.'
              : (lots.error ??
                scope.storesError ??
                lotSuggestions.error ??
                suppliers.error ??
                selected.error)
          }
        />
        <div className="stock-table-scroll">
          <table className="stock-table">
            <thead>
              <tr>
                <th>Lô</th>
                <th>Phụ tùng</th>
                {scope.owner && <th>Kho</th>}
                <th>Nguồn / nhà cung cấp</th>
                <th>Ngày nhận</th>
                <th>Lô nhà sản xuất</th>
                <th>Hạn dùng</th>
                {scope.owner && <th>Giá vốn lô</th>}
                {tab !== 'DEPLETED' && <th>Còn lại</th>}
              </tr>
            </thead>
            <tbody>
              {lots.data?.page.items.map((row) => (
                <tr key={row.lotId + '-' + row.storeId}>
                  <td>
                    <Link to={lotLink(row.lotId, row.storeId)}>
                      {documentCode('L', row.lotId)}
                    </Link>
                  </td>
                  <td>
                    {row.partName}
                    <small>{row.sku}</small>
                  </td>
                  {scope.owner && <td>{row.storeName}</td>}
                  <td>{row.supplierName ?? sourceNames[row.sourceType]}</td>
                  <td>{date(row.receivedDate)}</td>
                  <td>
                    {row.manufacturerLotNo ?? '—'}
                    {row.manufactureDate && (
                      <small>{date(row.manufactureDate)}</small>
                    )}
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
                          : 'Còn ' + row.daysToExpiry + ' ngày'}
                      </small>
                    )}
                  </td>
                  {scope.owner && (
                    <td>
                      <LotCost
                        key={row.lotId + '-' + row.storeId}
                        id={row.lotId}
                        storeId={row.storeId}
                      />
                    </td>
                  )}
                  {tab !== 'DEPLETED' && (
                    <td>
                      {row.remainingQty} {row.baseUnit}
                    </td>
                  )}
                </tr>
              ))}
              {lots.data && !lots.data.page.items.length && (
                <tr>
                  <td
                    colSpan={
                      6 + (scope.owner ? 2 : 0) + (tab !== 'DEPLETED' ? 1 : 0)
                    }
                    className="stock-empty"
                  >
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
          size={pageSize}
          loading={lots.loading}
          onPage={(next) =>
            scope.setParams((previous) => {
              const value = new URLSearchParams(previous)
              value.set('page', String(next))
              return value
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
