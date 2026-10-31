import { useAuth } from '../../../shared/hooks/useAuth'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import axiosClient from '../../../shared/api/axiosClient'
import HeaderSearch from '../../../shared/ui/HeaderSearch'
import Icon from '../../../shared/ui/Icon'
import type { DashboardProduct } from '../../dashboard/types/dashboardTypes'
import './parts-search.css'
type Category = { id: number; categoryName: string; children: Category[] }
type Model = { id: number; manufacturer: string; modelName: string }
const flatten = (nodes: Category[]): Category[] =>
  nodes.flatMap((node) => [node, ...flatten(node.children || [])])
export default function PartsSearchPage() {
  const { user } = useAuth()
  const canCreate =
    user?.role === 'BRANCH_MANAGER' &&
    user.permissions?.some((permission) =>
      ['CATALOG_EDIT', 'PERM_CATALOG_EDIT'].includes(permission),
    )
  const base =
    user?.role === 'STAFF' ? '/staff/products' : '/branch-manager/products'
  const [q, setQ] = useState('')
  const [filters, setFilters] = useState({
    vehicleType: '',
    categoryId: '',
    vehicleModelId: '',
    brand: '',
    status: 'ACTIVE',
    inStockOnly: true,
  })
  const [expanded, setExpanded] = useState(true)
  const [page, setPage] = useState(0)
  const [data, setData] = useState<{
    items: DashboardProduct[]
    totalItems: number
  }>({ items: [], totalItems: 0 })
  const [categories, setCategories] = useState<Category[]>([])
  const [models, setModels] = useState<Model[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filterError, setFilterError] = useState('')
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    let active = true
    Promise.all([
      axiosClient.get<Category[]>('/part-categories'),
      axiosClient.get<Model[]>('/vehicle-models'),
    ])
      .then(([a, b]) => {
        if (active) {
          setCategories(flatten(a.data))
          setModels(b.data)
        }
      })
      .catch(() => {
        if (active)
          setFilterError(
            'Không tải được danh mục bộ lọc. Vui lòng tải lại trang.',
          )
      })
    return () => {
      active = false
    }
  }, [])
  useEffect(() => {
    let active = true
    const timer = setTimeout(() => {
      setLoading(true)
      setError('')
      axiosClient
        .get('/products', {
          params: {
            ...Object.fromEntries(
              Object.entries(filters).filter(([, value]) => value !== ''),
            ),
            q,
            page,
            size: 20,
          },
        })
        .then((response) => {
          if (active) setData(response.data)
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
      clearTimeout(timer)
    }
  }, [q, filters, page, revision])
  function filter(key: string, value: string | boolean) {
    setFilters((old) => ({ ...old, [key]: value }))
    setPage(0)
  }
  function search(value: string) {
    setQ(value)
    setPage(0)
  }
  return (
    <>
      <HeaderSearch
        placeholder="Tìm phụ tùng theo SKU, tên, mã OEM…"
        loading={loading}
        items={data.items.map((item) => ({
          id: item.id,
          label: item.partName,
          meta: item.sku,
          select: () => search(item.sku),
        }))}
        onClear={() => search('')}
      />
      <main className="dashboard-content bm-products">
        <div className="bm-products-heading">
          <h1>Phụ tùng</h1>
          <span>
            <Link to="/dashboard">Trang chủ</Link> › Phụ tùng
          </span>
        </div>
        <section className="bm-products-panel">
          <div className="bm-products-panel-heading">
            <h2>Tìm phụ tùng</h2>
            {canCreate && (
              <Link className="bm-product-create" to={`${base}/new`}>
                + Thêm phụ tùng
              </Link>
            )}
          </div>
          <div className="bm-products-search">
            <label className="bm-product-query">
              <Icon name="search" />
              <input
                type="search"
                aria-label="Tìm phụ tùng"
                placeholder="Tìm theo tên, SKU, mã OEM hoặc mã vạch"
                value={q}
                onChange={(e) => search(e.target.value)}
              />
            </label>
            <button
              className="bm-filter-toggle"
              aria-expanded={expanded}
              aria-controls="bm-product-filters"
              onClick={() => setExpanded((value) => !value)}
            >
              <Icon name="sliders" />
              {expanded ? 'Thu gọn bộ lọc' : 'Mở bộ lọc'}
            </button>
            <label className="bm-stock-checkbox">
              <input
                type="checkbox"
                checked={filters.inStockOnly}
                onChange={(e) => filter('inStockOnly', e.target.checked)}
              />
              Chỉ hiện hàng còn bán được
            </label>
            <span className="bm-product-count" aria-live="polite">
              {loading
                ? 'Đang tìm…'
                : error
                  ? 'Chưa tải được số lượng'
                  : `Tìm thấy ${data.totalItems.toLocaleString('vi-VN')} phụ tùng`}
            </span>
          </div>
          {expanded && (
            <div id="bm-product-filters" className="bm-product-filters">
              <select
                aria-label="Loại xe"
                value={filters.vehicleType}
                onChange={(e) => filter('vehicleType', e.target.value)}
              >
                <option value="">Mọi loại xe</option>
                <option value="MOTORCYCLE">Xe máy</option>
                <option value="BICYCLE">Xe đạp</option>
                <option value="E_MOTORCYCLE">Xe máy điện</option>
                <option value="E_BICYCLE">Xe đạp điện</option>
              </select>
              <select
                aria-label="Nhóm phụ tùng"
                value={filters.categoryId}
                onChange={(e) => filter('categoryId', e.target.value)}
              >
                <option value="">Nhóm phụ tùng</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.categoryName}
                  </option>
                ))}
              </select>
              <select
                aria-label="Dòng xe"
                value={filters.vehicleModelId}
                onChange={(e) => filter('vehicleModelId', e.target.value)}
              >
                <option value="">Dòng xe</option>
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.manufacturer} {m.modelName}
                  </option>
                ))}
              </select>
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
                <option value="">Mọi trạng thái</option>
                <option value="ACTIVE">Đang kinh doanh</option>
                <option value="DISCONTINUED">Ngừng kinh doanh</option>
              </select>
            </div>
          )}
          {filterError && (
            <p className="bm-products-message" role="alert">
              {filterError}
            </p>
          )}
          {error ? (
            <p className="bm-products-message" role="alert">
              {error}{' '}
              <button onClick={() => setRevision((x) => x + 1)}>Thử lại</button>
            </p>
          ) : loading ? (
            <p className="bm-products-message" role="status">
              Đang tải phụ tùng…
            </p>
          ) : (
            <>
              <div className="bm-products-table">
                <table>
                  <thead>
                    <tr>
                      <th>Phụ tùng</th>
                      <th>Nhóm</th>
                      <th>Nhà sản xuất</th>
                      <th>Giá lẻ chuẩn</th>
                      <th>Khả dụng</th>
                      <th>Vị trí</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <Link to={`${base}/${item.id}`}>{item.partName}</Link>
                          <small>{item.sku}</small>
                        </td>
                        <td>{item.categoryName || '—'}</td>
                        <td>{item.brand || '—'}</td>
                        <td>
                          {item.retailPrice == null
                            ? '—'
                            : item.retailPrice.toLocaleString('vi-VN') + ' ₫'}
                        </td>
                        <td>
                          {item.availableQty == null
                            ? '—'
                            : `${item.availableQty.toLocaleString('vi-VN')} ${item.baseUnit}`}
                        </td>
                        <td>
                          {[item.storageArea, item.binLocation]
                            .filter(Boolean)
                            .join(' · ') || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!data.items.length && (
                <p className="bm-products-message">
                  Không tìm thấy phụ tùng phù hợp.
                  {filters.inStockOnly &&
                    ' Thử bỏ chọn “Chỉ hiện hàng còn bán được” để xem cả phụ tùng hết hàng.'}
                </p>
              )}
              <footer>
                <button
                  disabled={page === 0}
                  onClick={() => setPage((x) => x - 1)}
                >
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
    </>
  )
}
