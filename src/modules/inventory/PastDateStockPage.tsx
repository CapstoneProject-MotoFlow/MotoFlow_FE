import { Link } from 'react-router-dom'
import { useInventoryData, useInventoryScope } from './api'
import { InventoryNotice, Pagination, WarehouseFilter } from './components'
import { today } from './presentation'
import type { Page, StockRow } from './types'
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
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-')
}
export default function PastDateStockPage() {
  const categories = useInventoryData<Category[]>('/part-categories')
  const scope = useInventoryScope(),
    date = scope.params.get('date') ?? yesterday(),
    page = Math.max(0, Number(scope.params.get('page')) || 0),
    valid =
      /^\d{4}-\d{2}-\d{2}$/.test(date) &&
      date < today() &&
      (!scope.owner || !!scope.storeId),
    r = useInventoryData<History>(
      '/inventory/past-date-stock',
      {
        date,
        storeId: scope.storeId,
        q: scope.params.get('q') ?? '',
        categoryId: scope.params.get('categoryId') ?? '',
        includeZero: scope.params.get('includeZero') === 'true',
        page,
        size: 20,
      },
      0,
      valid,
    )
  return (
    <main className="dashboard-content tf-page past-stock-page">
      <header>
        <h1>Tồn theo ngày</h1>
        <nav>
          <Link to="/dashboard">Trang chủ</Link> › Kho hàng › Tồn theo ngày
        </nav>
      </header>
      <section>
        <h2>
          Tồn cuối ngày {date.split('-').reverse().join('/')} ·{' '}
          {scope.warehouse}
        </h2>
        <div className="tf-filters">
          <div className="past-stock-quick" aria-label="Chọn nhanh ngày">
            {[
              [1, 'Hôm qua'],
              [7, '7 ngày trước'],
              [30, '30 ngày trước'],
            ].map(([days, label]) => (
              <button
                type="button"
                key={days}
                onClick={() => {
                  const day = new Date()
                  day.setDate(day.getDate() - Number(days))
                  scope.filter({
                    date: [
                      day.getFullYear(),
                      String(day.getMonth() + 1).padStart(2, '0'),
                      String(day.getDate()).padStart(2, '0'),
                    ].join('-'),
                  })
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <label>
            Nhóm phụ tùng
            <select
              value={scope.params.get('categoryId') ?? ''}
              onChange={(e) => scope.filter({ categoryId: e.target.value })}
            >
              <option value="">Tất cả</option>
              {categoryOptions(categories.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <WarehouseFilter
            owner={scope.owner}
            stores={scope.stores}
            value={scope.storeId}
            onChange={(value) => scope.filter({ storeId: value })}
          />
          <label>
            Ngày tra cứu
            <input
              type="date"
              required
              max={yesterday()}
              value={date}
              onChange={(e) => scope.filter({ date: e.target.value })}
            />
          </label>
          <label>
            Tìm phụ tùng
            <input
              value={scope.params.get('q') ?? ''}
              placeholder="SKU hoặc tên"
              onChange={(e) => scope.filter({ q: e.target.value }, true)}
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={scope.params.get('includeZero') === 'true'}
              onChange={(e) => scope.filter({ includeZero: e.target.checked })}
            />{' '}
            Bao gồm tồn bằng 0
          </label>
        </div>
        {!valid && (
          <p className="tf-note">
            Chọn kho và một ngày trong quá khứ để tra cứu.
          </p>
        )}
        <InventoryNotice
          loading={r.loading}
          error={r.error || scope.storesError || categories.error}
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
                    <th>Tồn hiện tại</th>
                    <th>Thay đổi tới nay</th>
                  </tr>
                </thead>
                <tbody>
                  {r.data.page.items.map((l) => (
                    <PastStockLine
                      key={l.productId}
                      line={l}
                      storeId={r.data!.storeId}
                    />
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
function PastStockLine({
  line,
  storeId,
}: {
  line: History['page']['items'][number]
  storeId: number
}) {
  const stock = useInventoryData<Page<StockRow>>('/inventory/stock', {
      storeId,
      productId: line.productId,
      includeZero: true,
      page: 0,
      size: 1,
    }),
    current = stock.data?.items[0]?.onHandQty
  return (
    <tr>
      <td>
        {line.partName}
        <small>{line.sku}</small>
      </td>
      <td>
        {line.closingQty} {line.baseUnit}
      </td>
      <td title={stock.error}>
        {current == null ? '—' : current + ' ' + line.baseUnit}
      </td>
      <td>
        {current == null
          ? '—'
          : (current - line.closingQty > 0 ? '+' : '') +
            (current - line.closingQty)}
      </td>
    </tr>
  )
}
