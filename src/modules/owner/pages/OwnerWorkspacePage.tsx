import { searchProducts } from '../../catalog/api/searchProducts'
/**
 * File: modules/owner/pages/OwnerWorkspacePage.tsx
 * Loại: MÀN HÌNH — Tìm kiếm phụ tùng của Owner.
 * Đường dẫn: /owner/products.
 * Công dụng: Tìm phụ tùng toàn danh mục cho Owner; bộ lọc cửa hàng để xem tồn; mở tạo/chi tiết phụ tùng.
 */
import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import axiosClient from '../../../shared/api/axiosClient'

import type { DashboardProduct } from '../../dashboard/types/dashboardTypes'
import '../owner.css'
import './products.css'

type Category = {
  id: number
  categoryName: string
  children: Category[]
  status: string
}
type Model = { id: number; manufacturer: string; modelName: string }
const flatten = (nodes: Category[]): Category[] =>
  nodes.flatMap((node) => [node, ...flatten(node.children || [])])
/** OwnerWorkspacePage: Tìm phụ tùng toàn danh mục cho Owner; bộ lọc cửa hàng để xem tồn; mở tạo/chi tiết phụ tùng. */
export default function OwnerWorkspacePage({
  inventory = false,
}: {
  inventory?: boolean
}) {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [vehicleText, setVehicleText] = useState('')
  const [modelText, setModelText] = useState('')
  const [categoryText, setCategoryText] = useState('')
  const [q, setQ] = useState(params.get('sku') || '')
  const [filters, setFilters] = useState({
    storeId: inventory ? params.get('storeId') || '' : '',
    vehicleType: '',
    categoryId: '',
    vehicleModelId: '',
    brand: '',
    status: 'ACTIVE',
    inStockOnly: inventory && params.get('inStockOnly') === 'true',
  })
  const [page, setPage] = useState(0)
  const [data, setData] = useState<{
    items: DashboardProduct[]
    totalItems: number
  }>({ items: [], totalItems: 0 })
  const [categories, setCategories] = useState<Category[]>([])
  const [stores, setStores] = useState<{ id: number; storeName: string }[]>([])
  const [models, setModels] = useState<Model[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    let active = true
    Promise.all([
      axiosClient.get<Category[]>('/part-categories'),
      axiosClient.get<Model[]>('/vehicle-models'),
      axiosClient.get<{ id: number; storeName: string }[]>('/stores'),
    ])
      .then(([a, b, c]) => {
        if (active) {
          setCategories(flatten(a.data))
          setModels(b.data)
          setStores(c.data)
        }
      })
      .catch(() => {
        if (active)
          setError('Không tải được bộ lọc danh mục. Vui lòng tải lại trang.')
      })
    return () => {
      active = false
    }
  }, [])
  useEffect(() => {
    let active = true
    const controller = new AbortController()
    const timer = setTimeout(() => {
      setLoading(true)
      setError('')
      searchProducts(
        {
          ...Object.fromEntries(
            Object.entries(filters).filter(([, value]) => value !== ''),
          ),
          q,
          page,
          size: 20,
        },
        categoryText,
        categories,
        controller.signal,
        vehicleText,
        modelText,
        models,
      )
        .then((result) => {
          if (active) setData(result)
        })
        .catch(() => {
          if (active) setError('Không tải được phụ tùng. Vui lòng thử lại.')
        })
        .finally(() => {
          if (active) setLoading(false)
        })
    }, 250)
    return () => {
      active = false
      controller.abort()
      clearTimeout(timer)
    }
  }, [
    q,
    filters,
    page,
    revision,
    categoryText,
    categories,
    vehicleText,
    modelText,
    models,
  ])
  function filter(key: string, value: string | boolean) {
    setFilters((old) => ({ ...old, [key]: value }))
    setPage(0)
  }
  return (
    <main className="dashboard-content owner-content parts-page">
      <div className="parts-heading">
        <h1 className="dashboard-greeting">
          {inventory ? 'Tồn kho' : 'Phụ tùng'}
        </h1>
        <span>
          <Link to="/dashboard">Trang chủ</Link> ›{' '}
          {inventory ? 'Tồn kho' : 'Phụ tùng'}
        </span>
      </div>
      <section className="owner-panel">
        <header className="parts-panel-heading">
          <h2>{inventory ? 'Tra cứu tồn kho' : 'Tìm phụ tùng'}</h2>
          {!inventory && (
            <button
              className="ui-confirm-button"
              onClick={() => {
                navigate('/owner/products/new')
              }}
            >
              ＋ Thêm phụ tùng
            </button>
          )}
        </header>
        <div className="parts-filters">
          <input
            aria-label="Tìm phụ tùng"
            placeholder="Tìm theo tên, SKU, mã OEM hoặc mã vạch"
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setPage(0)
            }}
          />
          <div className="parts-filter-row">
            {inventory && (
              <select
                aria-label="Cửa hàng"
                value={filters.storeId}
                onChange={(e) => {
                  filter('storeId', e.target.value)
                  if (!e.target.value) filter('inStockOnly', false)
                }}
              >
                <option value="">Chọn cửa hàng</option>
                {stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.storeName}
                  </option>
                ))}
              </select>
            )}
            <input
              aria-label="Tìm loại xe"
              placeholder="Loại xe"
              value={vehicleText}
              onChange={(event) => {
                setVehicleText(event.target.value)
                setPage(0)
              }}
            />
            <input
              aria-label="Tìm nhóm phụ tùng"
              placeholder="Nhóm phụ tùng"
              value={categoryText}
              onChange={(event) => {
                setCategoryText(event.target.value)
                setPage(0)
              }}
            />
            <input
              aria-label="Tìm dòng xe"
              placeholder="Dòng xe"
              value={modelText}
              onChange={(event) => {
                setModelText(event.target.value)
                setPage(0)
              }}
            />
            <input
              aria-label="Nhà sản xuất"
              placeholder="Nhà sản xuất"
              value={filters.brand}
              onChange={(e) => filter('brand', e.target.value)}
            />
            <select
              aria-label="Trạng thái"
              value={filters.status}
              onChange={(e) => filter('status', e.target.value)}
            >
              <option value="">Tất cả trạng thái</option>
              <option value="ACTIVE">Đang kinh doanh</option>
              <option value="DISCONTINUED">Ngừng kinh doanh</option>
            </select>
            {inventory && (
              <label>
                <input
                  type="checkbox"
                  disabled={!filters.storeId}
                  checked={filters.inStockOnly}
                  onChange={(e) => filter('inStockOnly', e.target.checked)}
                />{' '}
                Chỉ hiện hàng còn bán được
              </label>
            )}
          </div>
          <p className="parts-count" aria-live="polite">
            {loading ? 'Đang tìm…' : `Tìm thấy ${data.totalItems} phụ tùng`}
          </p>
        </div>
        {error ? (
          <div className="empty-state" role="alert">
            {error}{' '}
            <button onClick={() => setRevision((x) => x + 1)}>Thử lại</button>
          </div>
        ) : loading ? (
          <p className="empty-state">Đang tải phụ tùng…</p>
        ) : (
          <>
            <div className="owner-table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Phụ tùng</th>
                    <th>Nhóm</th>
                    <th>Nhà sản xuất</th>
                    <th>Giá lẻ chuẩn</th>
                    {inventory && <th>Khả dụng</th>}
                    <th>Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <Link to={`/owner/products/${item.id}`}>
                          {item.partName}
                        </Link>
                        <small>{item.sku}</small>
                      </td>
                      <td>{item.categoryName}</td>
                      <td>{item.brand}</td>
                      <td className="parts-number">
                        {item.retailPrice == null
                          ? '—'
                          : item.retailPrice.toLocaleString('vi-VN') + ' ₫'}
                      </td>
                      {inventory && (
                        <td className="parts-number">
                          {item.availableQty == null
                            ? '—'
                            : `${item.availableQty.toLocaleString('vi-VN')} ${item.baseUnit}`}
                        </td>
                      )}
                      <td>
                        <span
                          className={
                            'parts-status ' +
                            (item.status === 'ACTIVE' ? '' : 'inactive')
                          }
                        >
                          {item.status === 'ACTIVE'
                            ? 'Đang kinh doanh'
                            : 'Ngừng kinh doanh'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!data.items.length && (
              <p className="empty-state">Không tìm thấy phụ tùng phù hợp.</p>
            )}
            <footer className="parts-pagination">
              <button disabled={!page} onClick={() => setPage((x) => x - 1)}>
                Trang trước
              </button>
              <span>
                Trang {page + 1} /{' '}
                {Math.max(1, Math.ceil(data.totalItems / 20))}
              </span>
              <button
                disabled={(page + 1) * 20 >= data.totalItems}
                onClick={() => setPage((x) => x + 1)}
              >
                Trang sau
              </button>
            </footer>
          </>
        )}
      </section>
    </main>
  )
}
