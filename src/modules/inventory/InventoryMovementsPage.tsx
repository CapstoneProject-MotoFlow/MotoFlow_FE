import { useState } from 'react'
import { useInventoryData, useInventoryScope } from './api'
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
import { useLotCollection } from './useLotCollection'
import './inventory-screens.css'

type Product = { id: number; sku: string; partName: string }
export default function InventoryMovementsPage() {
  const scope = useInventoryScope()
  const p = scope.params
  const lotCollection = useLotCollection(
    scope.storeId,
    String(scope.user?.id) + ':' + scope.user?.role,
  )
  const lotOptions = [
    ...new Map(
      (lotCollection.rows ?? [])
        .filter(
          (row) =>
            !p.get('productId') || row.productId === Number(p.get('productId')),
        )
        .map((row) => [row.lotId, row]),
    ).values(),
  ]
  const [search, setSearch] = useState('')
  const [chartOpen, setChartOpen] = useState(false)
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
  const choices = [
    ...(product.data ? [product.data] : []),
    ...(products.data?.items ?? []).filter(
      (item) => item.id !== product.data?.id,
    ),
  ]
  return (
    <main className="inventory-workspace inventory-screen">
      <InventoryHeader title="Lịch sử xuất nhập" />
      <section className="stock-panel">
        <div className="stock-filters">
          <WarehouseFilter
            owner={scope.owner}
            stores={scope.stores}
            value={scope.storeId}
            onChange={(storeId) => scope.filter({ storeId })}
          />
          <label className="stock-filter">
            <span>Tìm phụ tùng</span>
            <input
              placeholder="Tên hoặc SKU…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <label className="stock-filter">
            <span>Phụ tùng</span>
            <select
              value={p.get('productId') ?? ''}
              onChange={(e) =>
                scope.filter({ productId: e.target.value, lotId: '' })
              }
            >
              <option value="">Mọi phụ tùng</option>
              {choices.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.sku} · {item.partName}
                </option>
              ))}
            </select>
          </label>
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
              disabled={lotCollection.loading}
              onChange={(e) => scope.filter({ lotId: e.target.value })}
            >
              <option value="">Mọi lô</option>
              {p.get('lotId') &&
                !lotOptions.some(
                  (row) => String(row.lotId) === p.get('lotId'),
                ) && (
                  <option value={p.get('lotId')!}>
                    L-{String(p.get('lotId')).padStart(4, '0')}
                  </option>
                )}
              {lotOptions.map((row) => (
                <option key={row.lotId} value={row.lotId}>
                  L-{String(row.lotId).padStart(4, '0')} · {row.sku}
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
              lotCollection.error)
        }
      />
      <InventoryPanel
        title={
          product.data
            ? 'Tồn khả dụng cuối ngày · ' + product.data.partName
            : 'Nhập, xuất trong kỳ'
        }
        action={
          <button
            type="button"
            aria-expanded={chartOpen}
            onClick={() => setChartOpen(!chartOpen)}
          >
            {chartOpen ? 'Ẩn biểu đồ' : 'Xem biểu đồ'}
          </button>
        }
      >
        <dl className="stock-facts">
          <div>
            <dt>Nhập vào kho</dt>
            <dd>—</dd>
          </div>
          <div>
            <dt>Xuất khỏi kho</dt>
            <dd>—</dd>
          </div>
          {product.data && (
            <>
              <div>
                <dt>Tồn khả dụng đầu kỳ</dt>
                <dd>—</dd>
              </div>
              <div>
                <dt>Tồn khả dụng cuối kỳ</dt>
                <dd>—</dd>
              </div>
            </>
          )}
        </dl>
        {chartOpen && (
          <div className="stock-chart-empty" role="status">
            {product.data
              ? 'Chưa có dữ liệu tồn cuối ngày cho khoảng thời gian này.'
              : 'Chọn một phụ tùng để xem tồn khả dụng theo ngày.'}
          </div>
        )}
      </InventoryPanel>
      <InventoryPanel
        title="Biến động theo ngày"
        action={
          <button type="button" disabled title="Chưa thể xuất tệp lúc này">
            Xuất Excel
          </button>
        }
      >
        {movements.data && (
          <MovementTable rows={movements.data.items} showBalance />
        )}
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
