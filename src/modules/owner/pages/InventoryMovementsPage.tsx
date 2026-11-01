import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import axiosClient from '../../../shared/api/axiosClient'
import './inventory.css'
type Movement = {
  id: number
  lotId: number | null
  type: string
  stockStatus: string
  quantityChange: number
  occurredAt: string
  reason: string | null
}
type History = {
  openingAvailable: number
  closingAvailable: number
  incoming: number
  outgoing: number
  items: Movement[]
}
const names: Record<string, string> = {
  SALE_ISSUE: 'Xuất bán',
  RECEIPT_CONFIRMED: 'Nhập hàng',
  EXCESS_ACCEPTED: 'Nhận hàng thừa',
  EXCESS_REJECTED: 'Từ chối hàng thừa',
  RETURN_HOLD: 'Giữ hàng trả',
  SUPPLIER_RETURN: 'Trả nhà cung cấp',
  TRANSFER_DISPATCH: 'Xuất điều chuyển',
  TRANSFER_EXTRA_DISPATCH: 'Xuất bổ sung điều chuyển',
  TRANSFER_RECEIPT: 'Nhận điều chuyển',
  ADJUSTMENT: 'Điều chỉnh',
  COUNT_ADJUSTMENT: 'Điều chỉnh kiểm kê',
  OPENING_BALANCE: 'Tồn đầu kỳ',
}
const dateLabel = (value: string) => value.split('-').reverse().join('/')
const dateKey = (d: Date) =>
  new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' }).format(d)
export default function InventoryMovementsPage() {
  const [params, setParams] = useSearchParams(),
    productId = params.get('productId') || '',
    storeId = params.get('storeId') || ''
  const [products, setProducts] = useState<
      { id: number; partName: string; baseUnit: string }[]
    >([]),
    [stores, setStores] = useState<{ id: number; storeName: string }[]>([])
  const [productQuery, setProductQuery] = useState('')
  const [from, setFrom] = useState(() =>
      dateKey(new Date(Date.now() - 29 * 86400000)),
    ),
    [to, setTo] = useState(() => dateKey(new Date()))
  const [data, setData] = useState<History | null>(null),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(false),
    [revision, setRevision] = useState(0),
    [type, setType] = useState(''),
    [lot, setLot] = useState(''),
    [chart, setChart] = useState(false)
  useEffect(() => {
    const c = new AbortController()
    Promise.all([
      axiosClient.get<{
        items: { id: number; partName: string; baseUnit: string }[]
      }>('/products', {
        params: { q: productQuery, page: 0, size: 100 },
        signal: c.signal,
      }),
      axiosClient.get<{ id: number; storeName: string }[]>('/stores', {
        signal: c.signal,
      }),
    ])
      .then(async ([a, b]) => {
        let items = a.data.items
        if (productId && !items.some((p) => String(p.id) === productId)) {
          const detail = await axiosClient.get('/products/' + productId, {
            signal: c.signal,
          })
          items = [detail.data, ...items]
        }
        if (!c.signal.aborted) {
          setProducts(items)
          setStores(b.data)
        }
      })
      .catch(() => {
        if (!c.signal.aborted) setError('Không tải được danh sách bộ lọc.')
      })
    return () => c.abort()
  }, [productId, productQuery, revision])
  useEffect(() => {
    const c = new AbortController()
    const timer = window.setTimeout(() => {
      setData(null)
      setError('')
      if (!productId || !storeId) {
        setLoading(false)
        return
      }
      setLoading(true)
      axiosClient
        .get<History>(`/inventory/${storeId}/products/${productId}/movements`, {
          params: { from, to },
          signal: c.signal,
        })
        .then((response) => {
          if (!c.signal.aborted) setData(response.data)
        })
        .catch((error) => {
          if (!c.signal.aborted) {
            const message = (
              error as { response?: { data?: { message?: string } } }
            ).response?.data?.message
            setError(message || 'Không tải được lịch sử. Vui lòng thử lại.')
          }
        })
        .finally(() => {
          if (!c.signal.aborted) setLoading(false)
        })
    }, 200)
    return () => {
      clearTimeout(timer)
      c.abort()
    }
  }, [productId, storeId, from, to, revision])
  const product = products.find((p) => String(p.id) === productId),
    filtered =
      data?.items.filter(
        (m) => (!type || m.type === type) && (!lot || String(m.lotId) === lot),
      ) || []
  function select(key: string, value: string) {
    const next = new URLSearchParams(params)
    next.set(key, value)
    setParams(next)
    setLot('')
    setType('')
  }
  function exportCsv() {
    const lines = [
      [
        'Thời điểm',
        'Loại biến động',
        'Lô',
        'Trạng thái tồn',
        'Số lượng',
        'Lý do',
      ],
      ...filtered.map((m) => [
        m.occurredAt,
        names[m.type] || m.type,
        m.lotId ?? '',
        m.stockStatus,
        m.quantityChange,
        m.reason || '',
      ]),
    ]
    const text = lines
      .map((row) =>
        row
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
    a.download = 'lich-su-xuat-nhap.csv'
    a.click()
    URL.revokeObjectURL(url)
  }
  const days = new Map<
    string,
    { incoming: number; outgoing: number; closing: number }
  >()
  let running = data?.openingAvailable || 0
  for (const m of data?.items || []) {
    if (m.stockStatus !== 'AVAILABLE') continue
    const day = m.occurredAt.slice(0, 10)
    const item = days.get(day) || { incoming: 0, outgoing: 0, closing: running }
    running += m.quantityChange
    if (m.quantityChange > 0) item.incoming += m.quantityChange
    else item.outgoing -= m.quantityChange
    item.closing = running
    days.set(day, item)
  }
  const points = [
      data?.openingAvailable || 0,
      ...[...days.values()].map((d) => d.closing),
      data?.closingAvailable || 0,
    ],
    min = Math.min(...points),
    range = Math.max(...points) - min || 1
  return (
    <main className="dashboard-content inventory-page">
      <header className="inventory-heading">
        <h1>Lịch sử xuất nhập</h1>
        <span>
          <Link to="/owner/inventory">Tồn kho</Link> › Lịch sử xuất nhập
        </span>
      </header>
      <section className="inventory-summary inventory-history-filters">
        <input
          type="search"
          aria-label="Tìm phụ tùng trong bộ lọc lịch sử"
          placeholder="Tìm tên hoặc SKU phụ tùng"
          value={productQuery}
          onChange={(e) => setProductQuery(e.target.value)}
        />
        <select
          aria-label="Phụ tùng"
          value={productId}
          onChange={(e) => select('productId', e.target.value)}
        >
          <option value="">Chọn phụ tùng</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.partName}
            </option>
          ))}
        </select>
        <select
          aria-label="Kho"
          value={storeId}
          onChange={(e) => select('storeId', e.target.value)}
        >
          <option value="">Chọn kho</option>
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.storeName}
            </option>
          ))}
        </select>
        <select
          aria-label="Loại biến động"
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          <option value="">Tất cả loại biến động</option>
          {[...new Set(data?.items.map((m) => m.type))].map((t) => (
            <option key={t} value={t}>
              {names[t] || t}
            </option>
          ))}
        </select>
        <select
          aria-label="Lô"
          value={lot}
          onChange={(e) => setLot(e.target.value)}
        >
          <option value="">Tất cả lô</option>
          {[
            ...new Set(
              data?.items.map((m) => m.lotId).filter((id) => id != null),
            ),
          ].map((id) => (
            <option key={id} value={String(id)}>
              Lô #{id}
            </option>
          ))}
        </select>
        <input
          type="date"
          aria-label="Từ ngày"
          value={from}
          max={to}
          onChange={(e) => {
            setFrom(e.target.value)
            setLot('')
            setType('')
          }}
        />
        <span>đến</span>
        <input
          type="date"
          aria-label="Đến ngày"
          value={to}
          min={from}
          onChange={(e) => {
            setTo(e.target.value)
            setLot('')
            setType('')
          }}
        />
      </section>
      {error && (
        <p role="alert">
          {error}{' '}
          <button onClick={() => setRevision((v) => v + 1)}>Thử lại</button>
        </p>
      )}
      {loading && <p role="status">Đang tải lịch sử…</p>}
      {!productId || !storeId ? (
        <p>Chọn phụ tùng và kho để xem lịch sử xuất nhập.</p>
      ) : (
        data && (
          <>
            <section className="inventory-panel">
              <header>
                <h2>Tồn khả dụng · {product?.partName}</h2>
                <button onClick={() => setChart((v) => !v)}>
                  {chart ? 'Ẩn biểu đồ' : 'Xem biểu đồ'}
                </button>
              </header>
              <div className="inventory-history-summary">
                {[
                  ['+ Nhập vào kho', data.incoming],
                  ['− Xuất khỏi kho', data.outgoing],
                  ['Tồn đầu ngày ' + dateLabel(from), data.openingAvailable],
                  ['Tồn cuối ngày ' + dateLabel(to), data.closingAvailable],
                ].map(([label, value]) => (
                  <div key={label}>
                    <small>{label}</small>
                    <strong>
                      {Number(value).toLocaleString('vi')} {product?.baseUnit}
                    </strong>
                  </div>
                ))}
              </div>
              {chart && (
                <figure className="inventory-chart">
                  <svg
                    viewBox="0 0 600 160"
                    role="img"
                    aria-label={`Tồn khả dụng từ ${data.openingAvailable} đến ${data.closingAvailable}`}
                  >
                    <line x1="10" y1="145" x2="590" y2="145" stroke="#dfe5ed" />
                    <polyline
                      points={points
                        .map(
                          (v, i) =>
                            `${10 + (i * 580) / (points.length - 1)},${140 - ((v - min) * 120) / range}`,
                        )
                        .join(' ')}
                      fill="none"
                      stroke="#5260ff"
                      strokeWidth="3"
                    />
                  </svg>
                  <figcaption>
                    Tồn khả dụng đầu kỳ và cuối mỗi ngày có biến động · {from} →{' '}
                    {to}
                  </figcaption>
                </figure>
              )}
            </section>
            <section className="inventory-panel inventory-history-table">
              <header>
                <h2>Biến động theo ngày</h2>
                <button onClick={exportCsv}>↓ Xuất CSV</button>
              </header>
              {filtered.length ? (
                <div className="inventory-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Thời điểm</th>
                        <th>Loại biến động</th>
                        <th>Lô</th>
                        <th>Trạng thái tồn</th>
                        <th>Số lượng</th>
                        <th>Lý do</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((m) => (
                        <tr key={m.id}>
                          <td>
                            {new Date(m.occurredAt).toLocaleString('vi-VN')}
                          </td>
                          <td>{names[m.type] || m.type}</td>
                          <td>{m.lotId ?? '—'}</td>
                          <td>{m.stockStatus}</td>
                          <td>
                            {m.quantityChange > 0 ? '+' : ''}
                            {m.quantityChange}
                          </td>
                          <td>{m.reason || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="inventory-message">
                  Chưa có biến động phù hợp trong khoảng ngày này.
                </p>
              )}
            </section>
          </>
        )
      )}
    </main>
  )
}
