import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../../../shared/hooks/useAuth'
import axiosClient from '../../../shared/api/axiosClient'
import { apiMessage } from '../../suppliers/supplierService'
import './product-detail.css'
type Stock = {
  lowStockThreshold: number | null
  availableQty: number
  awaitingInspectionQty: number
  wrongItemQty: number
  damagedQty: number
  awaitingSupplierReturnQty: number
  inTransitQty: number
  storageArea: string | null
  binLocation: string | null
}
type Product = {
  id: number
  sku: string
  partName: string
  categoryName: string
  brand: string
  countryOfOrigin: string | null
  baseUnit: string
  specifications: string | null
  status: string
  oemCodes: string[]
  barcodes: string[]
  imageUrls: string[]
  vehicleModels: {
    id: number
    manufacturer: string
    modelName: string
    yearFrom: number | null
    yearTo: number | null
  }[]
  retailPrice: number | null
  stock: Stock | null
}
type Store = { id: number; storeName: string; central: boolean }
const stockStates = [
  ['awaitingInspectionQty', 'Chờ kiểm nhận'],
  ['wrongItemQty', 'Sai hàng'],
  ['damagedQty', 'Hàng hỏng'],
  ['awaitingSupplierReturnQty', 'Chờ trả nhà cung cấp'],
  ['inTransitQty', 'Đang điều chuyển'],
] as const

function StockBreakdown({ stock, unit }: { stock: Stock; unit: string }) {
  return (
    <details className="product-stock-breakdown">
      <summary>Chi tiết không khả dụng</summary>
      <dl>
        {stockStates.map(([key, label]) => (
          <div key={key}>
            <dt>{label}</dt>
            <dd>
              {stock[key].toLocaleString('vi-VN')} {unit}
            </dd>
          </div>
        ))}
      </dl>
    </details>
  )
}
export default function ProductDetailPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const owner = user?.role === 'OWNER'
  const canEdit =
    owner ||
    !!user?.permissions?.some(
      (p) => p === 'CATALOG_EDIT' || p === 'PERM_CATALOG_EDIT',
    )
  const base = owner
    ? '/owner/products'
    : user?.role === 'BRANCH_MANAGER'
      ? '/branch-manager/products'
      : '/staff/products'
  const [data, setData] = useState<Product | null>(null)
  const [stocks, setStocks] = useState<{ store: Store; stock: Stock | null }[]>(
    [],
  )
  const [stockError, setStockError] = useState('')
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const [busy, setBusy] = useState(false)
  const [image, setImage] = useState(0)
  useEffect(() => {
    let active = true
    setData(null)
    setError('')
    setStockError('')
    setStocks([])
    setImage(0)
    axiosClient
      .get<Product>(`/products/${id}`)
      .then((r) => {
        if (active) setData(r.data)
      })
      .catch((e) => {
        if (active) setError(apiMessage(e))
      })
    if (owner)
      axiosClient
        .get<Store[]>('/stores')
        .then(async (r) => {
          const result = await Promise.all(
            r.data.map(async (store) => ({
              store,
              stock: (
                await axiosClient.get<Product>(`/products/${id}`, {
                  params: { storeId: store.id },
                })
              ).data.stock,
            })),
          )
          if (active) setStocks(result)
        })
        .catch((e) => {
          if (active) setStockError(apiMessage(e))
        })
    return () => {
      active = false
    }
  }, [id, revision, owner])
  async function toggle() {
    if (!data || busy || !canEdit) return
    setBusy(true)
    try {
      await axiosClient.post(
        `/products/${id}/${data.status === 'ACTIVE' ? 'discontinue' : 'reactivate'}`,
      )
      setRevision((x) => x + 1)
    } catch (e) {
      setError(apiMessage(e))
    } finally {
      setBusy(false)
    }
  }
  const unavailable = (s: Stock) =>
    s.awaitingInspectionQty +
    s.wrongItemQty +
    s.damagedQty +
    s.awaitingSupplierReturnQty +
    s.inTransitQty
  return (
    <main className="dashboard-content product-detail">
      <header>
        <h1>{data?.partName || 'Chi tiết phụ tùng'}</h1>
        <nav>
          <Link to="/dashboard">Trang chủ</Link> ›{' '}
          <Link to={base}>Phụ tùng</Link> › {data?.sku}
        </nav>
      </header>
      {error && <p role="alert">{error}</p>}
      {!data ? (
        <p>Đang tải…</p>
      ) : (
        <div className="product-detail-grid">
          <div className="product-detail-left">
            <section className="product-detail-panel product-gallery">
              <h2>Ảnh</h2>
              <div className="product-gallery-body">
                <div className="product-main-image">
                  {data.imageUrls[image] ? (
                    <img src={data.imageUrls[image]} alt={data.partName} />
                  ) : (
                    <span>Chưa có ảnh</span>
                  )}
                </div>
                <div className="product-thumbnails">
                  {data.imageUrls.map((url, i) => (
                    <button
                      key={url}
                      aria-label={`Xem ảnh ${i + 1}`}
                      aria-pressed={image === i}
                      onClick={() => setImage(i)}
                    >
                      <img src={url} alt={`Ảnh ${i + 1}`} />
                    </button>
                  ))}
                </div>
              </div>
            </section>
            {!owner && (
              <section className="product-detail-panel branch-product-stock">
                <h2>Tồn tại {user?.storeName || 'chi nhánh của bạn'}</h2>
                {data.stock ? (
                  <div className="branch-product-stock-body">
                    <small>Khả dụng</small>
                    <div className="branch-stock-quantity">
                      <strong>
                        {data.stock.availableQty.toLocaleString('vi-VN')}
                      </strong>{' '}
                      {data.baseUnit}
                      {data.stock.lowStockThreshold != null && (
                        <span
                          className={
                            data.stock.availableQty >=
                            data.stock.lowStockThreshold
                              ? 'enough'
                              : 'low'
                          }
                        >
                          {data.stock.availableQty >=
                          data.stock.lowStockThreshold
                            ? 'Đủ hàng'
                            : 'Dưới ngưỡng'}
                        </span>
                      )}
                    </div>
                    <dl>
                      <div>
                        <dt>Không khả dụng</dt>
                        <dd>{unavailable(data.stock)}</dd>
                      </div>
                      <div>
                        <dt>Vị trí</dt>
                        <dd>
                          {[data.stock.storageArea, data.stock.binLocation]
                            .filter(Boolean)
                            .join(' · ') || '—'}
                        </dd>
                      </div>
                      <div>
                        <dt>Ngưỡng tối thiểu</dt>
                        <dd>{data.stock.lowStockThreshold ?? 'Chưa đặt'}</dd>
                      </div>
                    </dl>
                    <StockBreakdown stock={data.stock} unit={data.baseUnit} />
                    <div className="branch-stock-tools">
                      <button disabled title="Chưa có API lịch sử xuất nhập">
                        Lịch sử xuất nhập
                      </button>
                      <button disabled title="Chưa có API cập nhật vị trí">
                        Đổi vị trí
                      </button>
                      <button disabled title="Chưa có API cập nhật ngưỡng">
                        Đặt ngưỡng
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="product-section-body">
                    Chưa có dữ liệu tồn tại cửa hàng của tài khoản.
                  </p>
                )}
              </section>
            )}
          </div>
          <div className="product-detail-sections">
            <section className="product-detail-panel">
              <div className="product-info-heading">
                <div>
                  <span
                    className={
                      'product-state ' +
                      (data.status === 'ACTIVE' ? 'active' : '')
                    }
                  >
                    {data.status === 'ACTIVE'
                      ? 'Đang kinh doanh'
                      : 'Ngừng kinh doanh'}
                  </span>
                  <h2>Thông tin phụ tùng</h2>
                </div>
                {canEdit && (
                  <Link className="product-outline" to={`${base}/${id}/edit`}>
                    ✎ Sửa
                  </Link>
                )}
              </div>
              <dl className="product-info-grid">
                {[
                  ['SKU', data.sku],
                  ['Tên phụ tùng', data.partName],
                  ['Nhóm phụ tùng', data.categoryName],
                  ['Nhà sản xuất', data.brand],
                  ['Xuất xứ', data.countryOfOrigin],
                  ['Đơn vị tính', data.baseUnit],
                  ['Mã OEM', data.oemCodes.join(' · ')],
                  ['Mã vạch', data.barcodes.join(' · ')],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value || '—'}</dd>
                  </div>
                ))}
              </dl>
              {owner && (
                <footer>
                  <button
                    className="product-danger"
                    disabled={busy}
                    onClick={() => void toggle()}
                  >
                    {data.status === 'ACTIVE'
                      ? '⊘ Ngừng kinh doanh'
                      : 'Mở lại kinh doanh'}
                  </button>
                </footer>
              )}
            </section>
            <section className="product-detail-panel">
              <h2>Giá bán</h2>
              <dl className="product-info-grid">
                <div>
                  <dt>Giá bán lẻ (toàn chuỗi)</dt>
                  <dd>
                    {data.retailPrice == null
                      ? 'Chưa có giá'
                      : data.retailPrice.toLocaleString('vi-VN') + ' ₫'}
                  </dd>
                </div>
              </dl>
            </section>
            <section className="product-detail-panel">
              <h2>Thông số kỹ thuật</h2>
              <p className="product-section-body">
                {data.specifications || 'Chưa có thông số kỹ thuật.'}
              </p>
            </section>
            <section className="product-detail-panel">
              <h2>Dòng xe tương thích</h2>
              <div className="product-models">
                {data.vehicleModels.map((m) => (
                  <div key={m.id}>
                    {m.manufacturer} {m.modelName}
                    <small>
                      {m.yearFrom ? `Từ ${m.yearFrom}` : ''}
                      {m.yearTo ? ` – ${m.yearTo}` : ''}
                    </small>
                  </div>
                ))}
                {!data.vehicleModels.length && (
                  <p>Chưa có dòng xe tương thích.</p>
                )}
              </div>
            </section>
            {owner && (
              <section className="product-detail-panel">
                <div className="product-stock-heading">
                  <h2>Tồn theo kho</h2>
                  {owner && !stockError && stocks.length > 0 && (
                    <span>
                      Tổng khả dụng toàn chuỗi:{' '}
                      {stocks
                        .reduce(
                          (sum, row) => sum + (row.stock?.availableQty ?? 0),
                          0,
                        )
                        .toLocaleString('vi-VN')}{' '}
                      {data.baseUnit}
                    </span>
                  )}
                </div>
                {stockError ? (
                  <p role="alert">{stockError}</p>
                ) : (
                  <div className="product-stock-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Kho</th>
                          <th>Khả dụng</th>
                          <th>Không khả dụng</th>
                          <th>Vị trí</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(owner
                          ? stocks
                          : [
                              {
                                store: {
                                  id: user?.storeId ?? 0,
                                  storeName:
                                    user?.storeName || 'Cửa hàng của bạn',
                                  central: false,
                                },
                                stock: data.stock,
                              },
                            ]
                        ).map(({ store, stock }) => (
                          <tr key={store.id}>
                            <td>
                              {store.storeName}
                              {store.central && <small>Kho tổng</small>}
                            </td>
                            <td>{stock?.availableQty ?? '—'}</td>
                            <td>
                              {stock ? (
                                <>
                                  {unavailable(stock).toLocaleString('vi-VN')}
                                  <StockBreakdown
                                    stock={stock}
                                    unit={data.baseUnit}
                                  />
                                </>
                              ) : (
                                '—'
                              )}
                            </td>
                            <td>
                              {[stock?.storageArea, stock?.binLocation]
                                .filter(Boolean)
                                .join(' · ') || '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {owner && !stocks.length && <p>Đang tải tồn theo kho…</p>}
                  </div>
                )}
              </section>
            )}
          </div>
        </div>
      )}
    </main>
  )
}
