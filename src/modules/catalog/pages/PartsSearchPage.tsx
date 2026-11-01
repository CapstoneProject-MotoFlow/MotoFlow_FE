import { searchProducts } from '../api/searchProducts'
/**
 * File: modules/catalog/pages/PartsSearchPage.tsx
 * Loại: THÀNH PHẦN MÀN HÌNH — nội dung được các trang dùng lại, không có route riêng.
 * Công dụng: Tìm phụ tùng cho BM/Staff; lọc loại xe, nhóm, dòng xe, thương hiệu và hàng còn tồn; mở chi tiết; hiện nút tạo nếu được phép.
 */
import { canEditCatalog } from '../../../shared/utils/roles'
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
/** PartsSearchPage: Tìm phụ tùng cho BM/Staff; lọc loại xe, nhóm, dòng xe, thương hiệu và hàng còn tồn; mở chi tiết; hiện nút tạo nếu được phép. */
export default function PartsSearchPage() {
  const { user } = useAuth()
  const canCreate = canEditCatalog(user)
  const base =
    user?.role === 'STAFF' ? '/staff/products' : '/branch-manager/products'
  const [vehicleText, setVehicleText] = useState('')
  const [modelText, setModelText] = useState('')
  const [categoryText, setCategoryText] = useState('')
  const [q, setQ] = useState('')
  const [filters, setFilters] = useState({
    vehicleType: '',
    categoryId: '',
    vehicleModelId: '',
    brand: '',
    status: 'ACTIVE',
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
              <datalist id="vehicle-options">
                {['Xe máy', 'Xe đạp', 'Xe máy điện', 'Xe đạp điện'].map(
                  (label) => (
                    <option key={label} value={label} />
                  ),
                )}
              </datalist>
              <datalist id="category-options">
                {categories.map((category) => (
                  <option key={category.id} value={category.categoryName} />
                ))}
              </datalist>
              <datalist id="model-options">
                {models.map((model) => (
                  <option
                    key={model.id}
                    value={model.manufacturer + ' ' + model.modelName}
                  />
                ))}
              </datalist>
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
              <input
                aria-label="Tìm loại xe"
                className="text-search-filter"
                list="vehicle-options"
                placeholder="Loại xe"
                value={vehicleText}
                onChange={(event) => {
                  setVehicleText(event.target.value)
                  setPage(0)
                }}
              />
              <input
                aria-label="Tìm nhóm phụ tùng"
                className="text-search-filter"
                list="category-options"
                placeholder="Nhóm phụ tùng"
                value={categoryText}
                onChange={(event) => {
                  setCategoryText(event.target.value)
                  setPage(0)
                }}
              />
              <input
                aria-label="Tìm dòng xe"
                className="text-search-filter"
                list="model-options"
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
