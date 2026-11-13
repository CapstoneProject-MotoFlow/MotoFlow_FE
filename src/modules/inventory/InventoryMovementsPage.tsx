import { useState } from 'react'
import SearchableFilter from '../../shared/ui/SearchableFilter'
import { useCompleteLots, useInventoryData, useInventoryScope } from './api'
import {
  InventoryHeader,
  InventoryNotice,
  InventoryPanel,
  Pagination,
  WarehouseFilter,
} from './components'
import { MovementTable } from './MovementTable'
import { movementNames } from './presentation'
import type { Movement, Page } from './types'

import { documentCode } from '../../shared/utils/documentCode'
import './inventory-screens.css'

type Product = { id: number; sku: string; partName: string }
export default function InventoryMovementsPage() {
  const scope = useInventoryScope()
  const p = scope.params
  const [search, setSearch] = useState('')
  const products = useInventoryData<Page<Product>>('/products', {
    q: search,
    size: 20,
  })
  const product = useInventoryData<Product>(
    '/products/' + p.get('productId'),
    {},
    0,
    !!p.get('productId'),
  )
  const lotCollection = useCompleteLots(
    {
      tab: 'IN_STOCK',
      q: product.data?.sku,
      storeId: scope.storeId,
      size: 100,
    },
    !!product.data,
  )
  const depletedLots = useCompleteLots(
    { tab: 'DEPLETED', q: product.data?.sku, storeId: scope.storeId },
    !!product.data,
  )
  const lotOptions = Array.from(
    new Map(
      [
        ...(lotCollection.data?.page.items ?? []),
        ...(depletedLots.data?.page.items ?? []),
      ]
        .filter((row) => row.productId === product.data?.id)
        .map((row) => [row.lotId, row]),
    ).values(),
  )
  const page = Math.max(0, Number(p.get('page')) || 0)
  const from = p.get('from') ?? '',
    to = p.get('to') ?? ''
  const invalid = !!from && !!to && from > to
  const movements = useInventoryData<Page<Movement>>(
    '/inventory/movements',
    {
      storeId: scope.storeId,
      productId: p.get('productId') ?? '',
      lotId: p.get('lotId') ?? '',
      movementType: p.get('movementType') ?? '',
      from,
      to,
      page,
      size: 50,
    },
    0,
    !invalid,
  )
  // Khi đang gõ tìm chỉ hiện kết quả tìm; khi đóng danh sách giữ phụ tùng đang chọn ở đầu để ô lọc hiện đúng tên.
  const searching = !!search.trim()
  const choices = [
    ...(product.data && !searching ? [product.data] : []),
    ...(products.data?.items ?? []).filter(
      (item) => searching || item.id !== product.data?.id,
    ),
  ]
  return (
    <main className="inventory-workspace inventory-screen">
      <InventoryHeader title="Lịch sử xuất nhập" />
      <section className="stock-panel stock-movement-filters">
        <div className="stock-filters">
          <WarehouseFilter
            owner={scope.owner}
            stores={scope.stores}
            value={scope.storeId}
            onChange={(storeId) => scope.filter({ storeId })}
          />
          <div className="stock-filter stock-movement-product">
            <span>Phụ tùng</span>
            <SearchableFilter
              label="Phụ tùng"
              searchPlaceholder="Tên hoặc SKU…"
              value={p.get('productId') ?? ''}
              options={[
                ...(!searching ? [{ value: '', label: 'Mọi phụ tùng' }] : []),
                ...choices.map((item) => ({
                  value: String(item.id),
                  label: item.sku + ' · ' + item.partName,
                })),
              ]}
              loading={products.loading}
              error={products.error}
              onSearch={(query) => setSearch(query ?? '')}
              onChange={(productId) => scope.filter({ productId, lotId: '' })}
            />
          </div>
        </div>
        <div className="stock-filters">
          <label className="stock-filter">
            <span>Loại biến động</span>
            <select
              value={p.get('movementType') ?? ''}
              onChange={(e) => scope.filter({ movementType: e.target.value })}
            >
              <option value="">Mọi loại biến động</option>
              {Object.entries(movementNames).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="stock-filter">
            <span>Mã lô</span>
            <select
              value={p.get('lotId') ?? ''}
              disabled={lotCollection.loading || depletedLots.loading}
              onChange={(e) => scope.filter({ lotId: e.target.value })}
            >
              <option value="">Mọi lô</option>
              {p.get('lotId') &&
                !lotOptions.some(
                  (row) => String(row.lotId) === p.get('lotId'),
                ) && (
                  <option value={p.get('lotId')!}>
                    {documentCode('L', p.get('lotId'))}
                  </option>
                )}
              {lotOptions.map((row) => (
                <option key={row.lotId} value={row.lotId}>
                  {documentCode('L', row.lotId)} · {row.sku}
                </option>
              ))}
            </select>
          </label>
          <label className="stock-filter">
            <span>Từ ngày</span>
            <input
              type="date"
              max={to || undefined}
              value={from}
              onChange={(e) => scope.filter({ from: e.target.value })}
            />
          </label>
          <label className="stock-filter">
            <span>Đến ngày</span>
            <input
              type="date"
              min={from || undefined}
              value={to}
              onChange={(e) => scope.filter({ to: e.target.value })}
            />
          </label>
        </div>
      </section>
      <InventoryNotice
        loading={movements.loading}
        error={
          invalid
            ? 'Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.'
            : (movements.error ??
              scope.storesError ??
              products.error ??
              product.error ??
              lotCollection.error ??
              depletedLots.error)
        }
      />
      <InventoryPanel
        title="Biến động theo ngày"
        action={
          <button type="button" disabled title="Chưa thể xuất tệp lúc này">
            Xuất Excel
          </button>
        }
      >
        {movements.data && <MovementTable rows={movements.data.items} />}
        <Pagination
          total={movements.data?.totalItems ?? 0}
          page={page}
          size={50}
          loading={movements.loading}
          onPage={(next) =>
            scope.setParams((previous) => {
              const p = new URLSearchParams(previous)
              p.set('page', String(next))
              return p
            })
          }
        />
      </InventoryPanel>
    </main>
  )
}
