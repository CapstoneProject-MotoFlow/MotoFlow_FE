import Icon from '../../../shared/ui/Icon'
import HeaderSearch from '../../../shared/ui/HeaderSearch'
import { Fragment, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import axiosClient from '../../../shared/api/axiosClient'
import { mapConcurrent } from '../../../shared/utils/mapConcurrent'
import type { DashboardProduct } from '../../dashboard/types/dashboardTypes'
import {
  categoryOptions,
  type Category,
} from '../../catalog/api/searchProducts'
import './inventory.css'
type Store = { id: number; storeName: string }
type Stock = {
  availableQty: number
  awaitingInspectionQty: number
  wrongItemQty: number
  damagedQty: number
  awaitingSupplierReturnQty: number
  inTransitQty: number
  lowStockThreshold: number | null
  storageArea: string | null
  binLocation: string | null
}
type Row = DashboardProduct & { stocks: { store: Store; stock: Stock }[] }
const held = (s: Stock) =>
  s.awaitingInspectionQty +
  s.wrongItemQty +
  s.damagedQty +
  s.awaitingSupplierReturnQty
const sum = (r: Row, key: 'availableQty' | 'inTransitQty') =>
  r.stocks.reduce((n, s) => n + s.stock[key], 0)
const blocked = (r: Row) => r.stocks.reduce((n, s) => n + held(s.stock), 0)
const low = (r: Row) =>
  r.stocks.filter(
    (s) =>
      s.stock.lowStockThreshold != null &&
      s.stock.availableQty < s.stock.lowStockThreshold,
  ).length
export default function InventoryPage() {
  const dialog = useRef<HTMLDialogElement>(null)
  const [editor, setEditor] = useState<{
    row: Row
    store: Store
    stock: Stock
    mode: 'threshold' | 'location'
  } | null>(null)
  const [threshold, setThreshold] = useState('')
  const [area, setArea] = useState('')
  const [bin, setBin] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  useEffect(() => {
    if (editor) dialog.current?.showModal()
  }, [editor])
  function editStock(
    row: Row,
    store: Store,
    stock: Stock,
    mode: 'threshold' | 'location',
  ) {
    setThreshold(String(stock.lowStockThreshold ?? 0))
    setArea(stock.storageArea || '')
    setBin(stock.binLocation || '')
    setSaveError('')
    setEditor({ row, store, stock, mode })
  }
  async function saveSettings(event: React.FormEvent) {
    event.preventDefault()
    if (!editor || saving) return
    setSaving(true)
    setSaveError('')
    try {
      const update =
        editor.mode === 'threshold'
          ? { lowStockThreshold: Number(threshold) }
          : { storageArea: area.trim(), binLocation: bin.trim() }
      await axiosClient.put(
        '/inventory/' +
          editor.store.id +
          '/products/' +
          editor.row.id +
          '/' +
          editor.mode,
        update,
      )
      setRows((old) =>
        old.map((row) =>
          row.id !== editor.row.id
            ? row
            : {
                ...row,
                stocks: row.stocks.map((item) =>
                  item.store.id !== editor.store.id
                    ? item
                    : { ...item, stock: { ...item.stock, ...update } },
                ),
              },
        ),
      )
      setEditor(null)
    } catch (err) {
      const message = (err as { response?: { data?: { message?: string } } })
        .response?.data?.message
      setSaveError(message || 'Không lưu được cấu hình. Vui lòng thử lại.')
    } finally {
      setSaving(false)
    }
  }
  const [params, setParams] = useSearchParams(),
    storeId = params.get('storeId') || ''
  const [stores, setStores] = useState<Store[]>([]),
    [categories, setCategories] = useState<Category[]>([])
  const [q, setQ] = useState(''),
    [category, setCategory] = useState(''),
    [page, setPage] = useState(0)
  const [rows, setRows] = useState<Row[]>([]),
    [count, setCount] = useState(0),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [revision, setRevision] = useState(0)
  const [expanded, setExpanded] = useState<number[]>([]),
    [sort, setSort] = useState('name')
  const only = params.get('inStockOnly') === 'true'
  useEffect(() => {
    const c = new AbortController()
    Promise.all([
      axiosClient.get<Store[]>('/stores', { signal: c.signal }),
      axiosClient.get<Category[]>('/part-categories', { signal: c.signal }),
    ])
      .then(([a, b]) => {
        setStores(a.data)
        setCategories(categoryOptions(b.data))
        if (!a.data.length) setLoading(false)
      })
      .catch(() => {
        if (!c.signal.aborted) {
          setError('Không tải được bộ lọc tồn kho.')
          setLoading(false)
        }
      })
    return () => c.abort()
  }, [revision])
  useEffect(() => {
    if (!stores.length) return
    const c = new AbortController()
    const timer = window.setTimeout(async () => {
      setLoading(true)
      setError('')
      setExpanded([])
      try {
        const result = await axiosClient.get<{
          items: DashboardProduct[]
          totalItems: number
        }>('/products', {
          params: {
            q,
            categoryId: category || undefined,
            storeId: storeId || undefined,
            inStockOnly: storeId && only ? true : undefined,
            page,
            size: 20,
          },
          signal: c.signal,
        })
        const scope = storeId
          ? stores.filter((s) => String(s.id) === storeId)
          : stores
        const jobs = result.data.items.flatMap((product) =>
          scope.map((store) => ({ product, store })),
        )
        const details = await mapConcurrent(
          jobs,
          4,
          async ({ product, store }) => ({
            id: product.id,
            store,
            stock: (
              await axiosClient.get<{ stock: Stock }>(
                `/products/${product.id}`,
                { params: { storeId: store.id }, signal: c.signal },
              )
            ).data.stock,
          }),
          () => !c.signal.aborted,
        )
        if (!c.signal.aborted) {
          setRows(
            result.data.items.map((product) => ({
              ...product,
              stocks: details
                .filter((d) => d.id === product.id && d.stock)
                .map((d) => ({ store: d.store, stock: d.stock })),
            })),
          )
          setCount(result.data.totalItems)
        }
      } catch {
        if (!c.signal.aborted)
          setError('Không tải được tồn kho. Vui lòng thử lại.')
      } finally {
        if (!c.signal.aborted) setLoading(false)
      }
    }, 300)
    return () => {
      c.abort()
      clearTimeout(timer)
    }
  }, [q, category, page, storeId, only, stores, revision])
  const sorted = [...rows].sort((a, b) =>
    sort === 'qty'
      ? sum(b, 'availableQty') - sum(a, 'availableQty')
      : a.partName.localeCompare(b.partName, 'vi'),
  )
  const scope =
    stores.find((s) => String(s.id) === storeId)?.storeName || 'Toàn chuỗi'
  function selectStore(value: string) {
    setPage(0)
    const next = new URLSearchParams(params)
    if (value) next.set('storeId', value)
    else {
      next.delete('storeId')
      next.delete('inStockOnly')
    }
    setParams(next)
  }
  function exportCsv() {
    const text = [
      [
        'Phụ tùng',
        'SKU',
        'Khả dụng',
        'Không khả dụng',
        'Đang điều chuyển',
        'Tồn thực tế',
      ],
      ...sorted.map((r) => [
        r.partName,
        r.sku,
        sum(r, 'availableQty'),
        blocked(r),
        sum(r, 'inTransitQty'),
        sum(r, 'availableQty') + blocked(r),
      ]),
    ]
      .map((line) =>
        line
          .map(
            (v) =>
              '"' +
              String(v)
                .replace(/^[=+@-]/, "'$&")
                .replaceAll('"', '""') +
              '"',
          )
          .join(','),
      )
      .join('\r\n')
    const url = URL.createObjectURL(
      new Blob(['\uFEFF' + text], { type: 'text/csv;charset=utf-8;' }),
    )
    const a = document.createElement('a')
    a.href = url
    a.download = `ton-kho-trang-${page + 1}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }
  return (
    <main className="dashboard-content inventory-page">
      <HeaderSearch
        placeholder="Tìm phụ tùng theo SKU, tên, mã OEM…"
        loading={loading}
        items={rows.map((row) => ({
          id: row.id,
          label: row.partName,
          meta: row.sku,
          select: () => {
            setQ(row.sku)
            setPage(0)
          },
        }))}
        onClear={() => {
          setQ('')
          setPage(0)
        }}
      />
      <header className="inventory-heading">
        <h1>Tồn kho</h1>
        <span>
          <Link to="/dashboard">Trang chủ</Link> › Kho hàng › Tồn kho
        </span>
      </header>
      <section className="inventory-summary">
        <div className="inventory-metrics">
          {[
            [
              'Mã có hàng tồn',
              rows.filter((r) => sum(r, 'availableQty') + blocked(r) > 0)
                .length,
            ],
            ['Dưới ngưỡng', rows.filter((r) => low(r) > 0).length],
            [
              'Có hàng chưa bán được',
              rows.filter((r) => blocked(r) > 0).length,
            ],
            ['Có lô sắp hết, hết hạn', '—'],
          ].map(([label, value], i) => (
            <article key={label} className={i === 0 ? 'selected' : ''}>
              <span className={'inventory-symbol tone-' + i}>
                <Icon
                  name={(['box', 'sliders', 'clock', 'alert'] as const)[i]}
                />
              </span>
              <div>
                {label}
                <strong>{loading || error ? '—' : value}</strong>
              </div>
            </article>
          ))}
        </div>
        <p className="inventory-note">
          Tổng hợp số lượng trên trang hiện tại · {scope}.
        </p>
        <div className="inventory-tabs">
          <button
            className={!storeId ? 'selected' : ''}
            onClick={() => selectStore('')}
          >
            Toàn chuỗi<small>Giá trị tồn: —</small>
          </button>
          {stores.map((s) => (
            <button
              key={s.id}
              className={String(s.id) === storeId ? 'selected' : ''}
              onClick={() => selectStore(String(s.id))}
            >
              {s.storeName}
              <small>Giá trị tồn: —</small>
            </button>
          ))}
        </div>
      </section>
      <section className="inventory-panel">
        <header>
          <h2>Tồn theo phụ tùng · {scope.toLocaleLowerCase('vi')}</h2>
          <button
            onClick={exportCsv}
            disabled={loading || !!error || !rows.length}
          >
            ↓ Xuất CSV trang này
          </button>
        </header>
        <div className="inventory-filters">
          <input
            type="search"
            aria-label="Tìm phụ tùng tồn kho"
            placeholder="Tìm tên, SKU, mã OEM hoặc mã vạch"
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setPage(0)
            }}
          />
          <select
            aria-label="Kho"
            value={storeId}
            onChange={(e) => selectStore(e.target.value)}
          >
            <option value="">Tất cả kho</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.storeName}
              </option>
            ))}
          </select>
          <select
            aria-label="Nhóm phụ tùng"
            value={category}
            onChange={(e) => {
              setCategory(e.target.value)
              setPage(0)
            }}
          >
            <option value="">Tất cả nhóm phụ tùng</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          <select
            aria-label="Sắp xếp trang hiện tại"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="name">Theo tên · trang này</option>
            <option value="qty">Khả dụng giảm dần · trang này</option>
          </select>
          <label>
            <input
              type="checkbox"
              disabled={!storeId}
              checked={!only}
              onChange={(e) => {
                const next = new URLSearchParams(params)
                if (e.target.checked) next.delete('inStockOnly')
                else next.set('inStockOnly', 'true')
                setParams(next)
                setPage(0)
              }}
            />
            Hiện cả mã tồn bằng 0
          </label>
        </div>
        {error ? (
          <p role="alert" className="inventory-message">
            {error}{' '}
            <button onClick={() => setRevision((v) => v + 1)}>Thử lại</button>
          </p>
        ) : loading ? (
          <p role="status" className="inventory-message">
            Đang tải tồn kho…
          </p>
        ) : (
          <div className="inventory-scroll">
            <table>
              <thead>
                <tr>
                  {[
                    'Phụ tùng',
                    'Khả dụng',
                    'Không khả dụng',
                    'Đang điều chuyển',
                    'Tồn thực tế ⓘ',
                    'Giá trị tồn',
                    'Tình trạng',
                    'Thao tác',
                  ].map((t) => (
                    <th key={t}>{t}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((r) => (
                  <Fragment key={r.id}>
                    <tr>
                      <td>
                        <div className="inventory-part">
                          <button
                            aria-label={'Xem từng kho: ' + r.partName}
                            aria-expanded={expanded.includes(r.id)}
                            onClick={() =>
                              setExpanded((old) =>
                                old.includes(r.id)
                                  ? old.filter((id) => id !== r.id)
                                  : [...old, r.id],
                              )
                            }
                          >
                            <svg
                              className="inventory-chevron"
                              viewBox="0 0 20 20"
                              width="18"
                              height="18"
                              fill="none"
                              aria-hidden="true"
                            >
                              <path
                                d="m7 4 6 6-6 6"
                                stroke="currentColor"
                                strokeWidth="1.6"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </button>
                          <div>
                            <Link to={'/owner/products/' + r.id}>
                              {r.partName}
                            </Link>
                            <small>{r.sku}</small>
                          </div>
                        </div>
                      </td>
                      <td>
                        <strong>
                          {sum(r, 'availableQty').toLocaleString('vi')}
                        </strong>
                      </td>
                      <td>{blocked(r).toLocaleString('vi')}</td>
                      <td>{sum(r, 'inTransitQty').toLocaleString('vi')}</td>
                      <td title="Khả dụng + không khả dụng; không gồm hàng đang điều chuyển">
                        {(sum(r, 'availableQty') + blocked(r)).toLocaleString(
                          'vi',
                        )}{' '}
                        {r.baseUnit}
                      </td>
                      <td>—</td>
                      <td>
                        <span
                          className={
                            'inventory-badge ' + (low(r) ? 'warning' : '')
                          }
                        >
                          {low(r)
                            ? `Thiếu ở ${low(r)} kho`
                            : r.stocks.some(
                                  (s) => s.stock.lowStockThreshold != null,
                                )
                              ? 'Đủ hàng'
                              : 'Chưa đặt ngưỡng'}
                        </span>
                      </td>
                      <td>
                        <Link
                          className="inventory-detail-link"
                          to={'/owner/products/' + r.id}
                        >
                          Chi tiết
                        </Link>
                      </td>
                    </tr>
                    {expanded.includes(r.id) &&
                      r.stocks.map(({ store, stock }) => (
                        <tr className="inventory-store-row" key={store.id}>
                          <td>
                            {store.storeName}
                            <small>
                              {[stock.storageArea, stock.binLocation]
                                .filter(Boolean)
                                .join(' · ') || 'Chưa có vị trí'}
                            </small>
                          </td>
                          <td>{stock.availableQty}</td>
                          <td>{held(stock)}</td>
                          <td>{stock.inTransitQty}</td>
                          <td>
                            {stock.availableQty + held(stock)} {r.baseUnit}
                          </td>
                          <td>—</td>
                          <td>
                            <span
                              className={
                                'inventory-badge ' +
                                (stock.lowStockThreshold != null &&
                                stock.availableQty < stock.lowStockThreshold
                                  ? 'warning'
                                  : '')
                              }
                            >
                              {stock.lowStockThreshold == null
                                ? 'Chưa đặt ngưỡng'
                                : stock.availableQty < stock.lowStockThreshold
                                  ? 'Dưới ngưỡng'
                                  : 'Đủ hàng'}
                            </span>
                          </td>
                          <td>
                            <div className="inventory-row-actions">
                              <Link
                                to={`/owner/inventory/movements?productId=${r.id}&storeId=${store.id}`}
                              >
                                Lịch sử
                              </Link>
                              <button
                                onClick={() =>
                                  editStock(r, store, stock, 'location')
                                }
                              >
                                Vị trí
                              </button>
                              <button
                                onClick={() =>
                                  editStock(r, store, stock, 'threshold')
                                }
                              >
                                Ngưỡng
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
            {!rows.length && (
              <p className="inventory-message">
                Không tìm thấy phụ tùng phù hợp.
              </p>
            )}
          </div>
        )}
        <footer>
          <span>
            Tổng {count.toLocaleString('vi')} phụ tùng · Trang {page + 1}/
            {Math.max(1, Math.ceil(count / 20))}
          </span>
          <div>
            <button
              disabled={!page || loading}
              onClick={() => setPage((v) => v - 1)}
            >
              Trang trước
            </button>
            <button
              disabled={loading || (page + 1) * 20 >= count}
              onClick={() => setPage((v) => v + 1)}
            >
              Trang sau
            </button>
          </div>
        </footer>
      </section>
      {editor && (
        <dialog
          ref={dialog}
          className="inventory-dialog"
          onCancel={(e) => {
            if (saving) e.preventDefault()
            else setEditor(null)
          }}
          aria-labelledby="inventory-dialog-title"
        >
          <header>
            <h2 id="inventory-dialog-title">
              {editor.mode === 'threshold'
                ? 'Đặt ngưỡng tồn tối thiểu'
                : 'Đổi vị trí lưu kho'}
            </h2>
            <button
              aria-label="Đóng"
              disabled={saving}
              onClick={() => setEditor(null)}
            >
              ×
            </button>
          </header>
          <form onSubmit={saveSettings}>
            <div className="inventory-editor-product">
              <strong>{editor.row.partName}</strong>
              <small>
                {editor.row.sku} · {editor.store.storeName} · khả dụng{' '}
                {editor.stock.availableQty} {editor.row.baseUnit}
              </small>
            </div>
            {editor.mode === 'threshold' ? (
              <>
                <label>
                  Ngưỡng tồn tối thiểu
                  <input
                    aria-label="Ngưỡng tồn tối thiểu"
                    type="number"
                    min="0"
                    max="2147483647"
                    step="1"
                    required
                    value={threshold}
                    disabled={saving}
                    onChange={(e) => setThreshold(e.target.value)}
                  />
                </label>
                <p>
                  Với ngưỡng {threshold || '—'}, tồn hiện tại{' '}
                  {editor.stock.availableQty} sẽ là{' '}
                  <span
                    className={
                      'inventory-badge ' +
                      (editor.stock.availableQty < Number(threshold)
                        ? 'warning'
                        : '')
                    }
                  >
                    {editor.stock.availableQty < Number(threshold)
                      ? 'Dưới ngưỡng'
                      : 'Đủ hàng'}
                  </span>
                </p>
              </>
            ) : (
              <>
                <label>
                  Khu vực
                  <input
                    maxLength={50}
                    value={area}
                    disabled={saving}
                    onChange={(e) => setArea(e.target.value)}
                  />
                </label>
                <label>
                  Kệ / vị trí
                  <input
                    maxLength={50}
                    value={bin}
                    disabled={saving}
                    onChange={(e) => setBin(e.target.value)}
                  />
                </label>
              </>
            )}
            {saveError && <p role="alert">{saveError}</p>}
            <footer>
              <button
                type="button"
                disabled={saving}
                onClick={() => setEditor(null)}
              >
                Hủy
              </button>
              <button
                type="submit"
                className="inventory-primary"
                disabled={saving}
              >
                {saving
                  ? 'Đang lưu…'
                  : editor.mode === 'threshold'
                    ? 'Lưu ngưỡng'
                    : 'Lưu vị trí'}
              </button>
            </footer>
          </form>
        </dialog>
      )}
    </main>
  )
}
