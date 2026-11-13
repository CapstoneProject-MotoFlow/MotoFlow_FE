import { useState } from 'react'
import { Link } from 'react-router-dom'
import SearchableFilter from '../../shared/ui/SearchableFilter'
import { useInventoryData, useInventoryScope } from './api'
import { InventoryNotice, Pagination } from './components'
import { today } from './presentation'
import type { Page } from './types'
import { categoryOptions, type Category } from '../catalog/api/searchProducts'
import './inventory.css'
import '../transfers/transfers.css'
type History = {
  date: string
  storeId: number
  storeName: string
  basedOnPeriod: string | null
  page: Page<{
    productId: number
    sku: string
    partName: string
    baseUnit: string
    closingQty: number
  }>
}
function yesterday() {
  const day = new Date(today() + 'T00:00:00Z')
  day.setUTCDate(day.getUTCDate() - 1)
  return day.toISOString().slice(0, 10)
}
export default function PastDateStockPage() {
  const [productSearch, setProductSearch] = useState<string | null>(null)
  const categories = useInventoryData<Category[]>('/part-categories')
  const scope = useInventoryScope()
  const defaultStore =
    scope.stores.find((store) => store.central && store.status === 'ACTIVE') ??
    scope.stores.find((store) => store.status === 'ACTIVE') ??
    scope.stores[0]
  const warehouse =
    scope.stores.find((store) => String(store.id) === scope.storeId) ??
    defaultStore
  const storeId = warehouse ? String(warehouse.id) : ''
  const warehouseName = scope.owner ? warehouse?.storeName : scope.warehouse
  const date = scope.params.get('date') ?? yesterday()
  const page = Math.max(0, Number(scope.params.get('page')) || 0)
  const q = scope.params.get('q') ?? ''
  const categoryId = scope.params.get('categoryId') ?? ''
  const valid =
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    date < today() &&
    (!scope.owner || !!storeId)
  const filters = { date, storeId, categoryId }
  const r = useInventoryData<History>(
    '/inventory/past-date-stock',
    { ...filters, q, page, size: 20 },
    0,
    valid,
  )
  const typed = productSearch?.trim() ?? ''
  const suggestions = useInventoryData<History>(
    '/inventory/past-date-stock',
    { ...filters, q: typed, page: 0, size: 10 },
    0,
    valid && productSearch !== null,
  )
  const products = new Map<string, string>()
  if (typed) products.set(typed, 'Tìm “' + typed + '”')
  else products.set('', 'Mọi phụ tùng')
  if (productSearch === null && q) products.set(q, q)
  for (const part of suggestions.data?.page.items ?? []) {
    if (!products.has(part.sku))
      products.set(part.sku, part.sku + ' · ' + part.partName)
  }
  return (
    <main className="dashboard-content tf-page past-stock-page">
      <header>
        <h1>Tồn kho theo ngày</h1>
        <nav>
          <Link to="/dashboard">Trang chủ</Link> › Kho hàng › Tồn kho theo ngày
        </nav>
      </header>
      <section>
        <h2>
          Tồn cuối ngày {date.split('-').reverse().join('/')}
          {warehouseName && ' · ' + warehouseName}
        </h2>
        <div className="tf-filters">
          {scope.owner && (
            <div className="past-stock-filter">
              <span>Kho</span>
              <SearchableFilter
                label="Kho"
                value={storeId}
                disabled={!scope.stores.length}
                options={scope.stores.map((store) => ({
                  value: String(store.id),
                  label: store.storeName,
                }))}
                onChange={(value) => scope.filter({ storeId: value })}
              />
            </div>
          )}
          <div className="past-stock-filter">
            <span>Nhóm phụ tùng</span>
            <SearchableFilter
              label="Nhóm phụ tùng"
              value={categoryId}
              options={[
                { value: '', label: 'Tất cả' },
                ...categoryOptions(categories.data ?? []).map((category) => ({
                  value: String(category.id),
                  label: category.label ?? category.categoryName,
                })),
              ]}
              onChange={(value) => scope.filter({ categoryId: value })}
            />
          </div>
          <label className="past-stock-date">
            Ngày tra cứu
            <input
              type="date"
              required
              max={yesterday()}
              value={date}
              onChange={(e) => scope.filter({ date: e.target.value })}
            />
          </label>
          <div className="past-stock-filter">
            <span>Tìm phụ tùng</span>
            <SearchableFilter
              label="Tìm phụ tùng"
              searchPlaceholder="SKU hoặc tên…"
              value={q}
              options={Array.from(products, ([value, label]) => ({
                value,
                label,
              }))}
              disabled={!valid}
              loading={suggestions.loading}
              onSearch={setProductSearch}
              onChange={(value) => scope.filter({ q: value })}
            />
          </div>
        </div>
        {!valid && (
          <p className="tf-note">
            Chọn kho và một ngày trong quá khứ để tra cứu.
          </p>
        )}
        <InventoryNotice
          loading={r.loading}
          error={
            r.error ||
            scope.storesError ||
            categories.error ||
            suggestions.error
          }
        />
        {r.data && (
          <>
            <p className="tf-note">
              {r.data.storeName} · Cuối ngày{' '}
              {r.data.date.split('-').reverse().join('/')} ·{' '}
              {r.data.basedOnPeriod
                ? 'Dựa trên kỳ ' + r.data.basedOnPeriod
                : 'Tính từ lịch sử biến động'}
            </p>
            <div className="tf-table">
              <table>
                <thead>
                  <tr>
                    <th>Phụ tùng</th>
                    <th>Tồn cuối ngày</th>
                  </tr>
                </thead>
                <tbody>
                  {r.data.page.items.map((l) => (
                    <PastStockLine key={l.productId} line={l} />
                  ))}
                </tbody>
              </table>
            </div>
            {!r.data.page.items.length && (
              <p className="tf-empty">Không có dữ liệu phù hợp.</p>
            )}
            <Pagination
              total={r.data.page.totalItems}
              page={page}
              loading={r.loading}
              onPage={(n) =>
                scope.setParams((p) => {
                  const next = new URLSearchParams(p)
                  next.set('page', String(n))
                  return next
                })
              }
            />
          </>
        )}
      </section>
    </main>
  )
}
function PastStockLine({ line }: { line: History['page']['items'][number] }) {
  return (
    <tr>
      <td>
        {line.partName}
        <small>{line.sku}</small>
      </td>
      <td>
        {line.closingQty} {line.baseUnit}
      </td>
    </tr>
  )
}
