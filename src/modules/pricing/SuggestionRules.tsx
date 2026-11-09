import { useEffect, useRef, useState } from 'react'
import axiosClient from '../../shared/api/axiosClient'
import { inventoryError } from '../inventory/api'
import { InventoryNotice } from '../inventory/components'
import { useChoicePages } from '../sales/useSalesList'
import {
  date,
  money,
  today,
  percentValid,
  roundingNames,
  flattenCategories,
  type Config,
  type Category,
  type Preview,
  type RoundingRule,
} from './model'

type ProductRate = { key: number; id: number; name: string; rate: string }
const vehicleNames: Record<string, string> = {
  MOTORCYCLE: 'Xe máy',
  BICYCLE: 'Xe đạp',
  E_MOTORCYCLE: 'Xe máy điện',
  E_BICYCLE: 'Xe đạp điện',
}
export default function SuggestionRules({
  config,
  scheduled,
  categories,
  onSaved,
}: {
  config: Config | null
  scheduled?: Config | null
  categories: Category[]
  onSaved: () => void
}) {
  const flat = flattenCategories(categories),
    categoryRows = [
      ...flat,
      ...(config?.categories ?? [])
        .filter((c) => !flat.some((x) => x.id === c.categoryId))
        .map((c) => ({
          id: c.categoryId,
          categoryName: c.categoryName,
          vehicleType: c.vehicleType,
        })),
    ]
  const [rates, setRates] = useState<Record<number, string>>(() =>
      Object.fromEntries(
        config?.categories.map((c) => [c.categoryId, String(c.markupRate)]) ??
          [],
      ),
    ),
    [products, setProducts] = useState<ProductRate[]>(
      () =>
        config?.products.map((p, i) => ({
          key: i,
          id: p.productId,
          name: p.partName + ' · ' + p.sku,
          rate: String(p.markupRate),
        })) ?? [],
    ),
    [rounding, setRounding] = useState(config?.roundingRule ?? 'UP_1000'),
    [effective, setEffective] = useState(
      config && config.effectiveFrom.slice(0, 10) > today()
        ? config.effectiveFrom.slice(0, 10)
        : today(),
    ),
    [search, setSearch] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    lock = useRef(false),
    counter = useRef(10000)
  const valid =
    (Object.values(rates).some((v) => v !== '') || products.length > 0) &&
    Object.values(rates).every((v) => v === '' || percentValid(v, 999.99)) &&
    new Set(products.map((p) => p.id)).size === products.length &&
    products.every((p) => p.id > 0 && percentValid(p.rate, 999.99))
  const payload = {
      roundingRule: rounding,
      categories: Object.entries(rates)
        .filter(([, v]) => v !== '')
        .map(([id, v]) => ({ categoryId: Number(id), markupRate: Number(v) })),
      products: products.map((p) => ({
        productId: p.id,
        markupRate: Number(p.rate),
      })),
    },
    key = JSON.stringify(payload)
  const [preview, setPreview] = useState<{
    key: string
    rows?: Preview[]
    error?: string
  }>()
  useEffect(() => {
    if (!valid) return
    const controller = new AbortController(),
      timer = setTimeout(() => {
        void axiosClient
          .post<Preview[]>('/pricing/markup-rules/preview', JSON.parse(key), {
            signal: controller.signal,
          })
          .then(({ data }) => {
            if (!controller.signal.aborted) setPreview({ key, rows: data })
          })
          .catch((e) => {
            if (!controller.signal.aborted)
              setPreview({ key, error: inventoryError(e) })
          })
      }, 400)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [key, valid])
  const shown = valid && preview?.key === key ? preview : undefined
  async function save() {
    if (!valid || !effective || effective < today() || lock.current) return
    lock.current = true
    setBusy(true)
    setError('')
    try {
      await axiosClient.post('/pricing/markup-rules', {
        ...payload,
        effectiveDate: effective,
      })
      onSaved()
    } catch (e) {
      setError(inventoryError(e))
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  return (
    <form
      className="pricing-suggestion-grid"
      onSubmit={(e) => {
        e.preventDefault()
        void save()
      }}
    >
      <fieldset className="pricing-suggestion-left" disabled={busy}>
        <section className="pricing-card">
          <div className="pricing-heading">
            <h2>Tỷ lệ cộng thêm theo nhóm hàng</h2>
            <span
              title="Phụ tùng ưu tiên tỷ lệ riêng, sau đó đến nhóm và nhóm cha gần nhất có tỷ lệ."
              className="pricing-help"
            >
              ⓘ
            </span>
          </div>
          <div className="pricing-table">
            <table>
              <thead>
                <tr>
                  <th>Nhóm hàng</th>
                  <th>Loại xe</th>
                  <th>Tỷ lệ cộng thêm</th>
                </tr>
              </thead>
              <tbody>
                {categoryRows.map((c) => (
                  <tr key={c.id}>
                    <td>{c.categoryName}</td>
                    <td>{vehicleNames[c.vehicleType ?? ''] ?? '—'}</td>
                    <td>
                      <div className="pricing-inline-percent">
                        <input
                          aria-label={
                            'Tỷ lệ ' +
                            c.categoryName +
                            (c.vehicleType
                              ? ' · ' + vehicleNames[c.vehicleType]
                              : '')
                          }
                          type="number"
                          min="0"
                          max="999.99"
                          step="0.01"
                          placeholder="—"
                          value={rates[c.id] ?? ''}
                          onChange={(e) =>
                            setRates((p) => ({ ...p, [c.id]: e.target.value }))
                          }
                        />
                        <span>%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!categoryRows.length && (
              <p className="pricing-empty">Chưa có nhóm hàng.</p>
            )}
          </div>
        </section>
        <section className="pricing-card">
          <div className="pricing-heading">
            <h2>Riêng từng phụ tùng</h2>
          </div>
          <div className="pricing-product-filter">
            <input
              placeholder="Tìm phụ tùng có tỷ lệ riêng"
              aria-label="Tìm phụ tùng có tỷ lệ riêng"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {products.map((p) => (
            <div
              key={p.key}
              className="pricing-override-row"
              hidden={
                !!search &&
                !p.name
                  .toLocaleLowerCase('vi')
                  .includes(search.toLocaleLowerCase('vi'))
              }
            >
              <ProductChoice
                row={p}
                onChange={(id, name) =>
                  setProducts((rows) =>
                    rows.map((x) => (x.key === p.key ? { ...x, id, name } : x)),
                  )
                }
              />
              <div className="pricing-inline-percent">
                <input
                  aria-label={'Tỷ lệ riêng ' + (p.name || 'phụ tùng mới')}
                  required
                  type="number"
                  min="0"
                  max="999.99"
                  step="0.01"
                  value={p.rate}
                  onChange={(e) =>
                    setProducts((rows) =>
                      rows.map((x) =>
                        x.key === p.key ? { ...x, rate: e.target.value } : x,
                      ),
                    )
                  }
                />
                <span>%</span>
              </div>
              <button
                type="button"
                onClick={() =>
                  setProducts((rows) => rows.filter((x) => x.key !== p.key))
                }
              >
                Bỏ
              </button>
            </div>
          ))}
          <div className="pricing-add-product">
            <button
              type="button"
              onClick={() => {
                setSearch('')
                setProducts((rows) => [
                  ...rows,
                  { key: ++counter.current, id: 0, name: '', rate: '' },
                ])
              }}
            >
              ＋ Thêm phụ tùng
            </button>
          </div>
        </section>
      </fieldset>
      <div className="pricing-suggestion-right">
        <section className="pricing-card">
          <div className="pricing-heading">
            <h2>Làm tròn và ngày áp dụng</h2>
          </div>
          <div className="pricing-rounding-body">
            <div className="pricing-grid">
              <label>
                Làm tròn lên tới
                <select
                  disabled={busy}
                  value={rounding}
                  onChange={(e) => setRounding(e.target.value as RoundingRule)}
                >
                  {Object.entries(roundingNames).map(([v, n]) => (
                    <option key={v} value={v}>
                      {n.replace('Làm tròn lên ', '')}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Áp dụng từ *
                <input
                  disabled={busy}
                  required
                  type="date"
                  min={today()}
                  value={effective}
                  onChange={(e) => setEffective(e.target.value)}
                />
              </label>
            </div>
            <button
              className="pricing-primary"
              disabled={!valid || !effective || effective < today() || busy}
            >
              {busy ? 'Đang lưu…' : 'Lưu quy tắc'}
            </button>
            {error && (
              <p role="alert" className="pricing-negative">
                {error}
              </p>
            )}
            {!valid && (
              <p className="pricing-negative">
                Nhập tỷ lệ 0–999,99% và chọn phụ tùng không trùng nhau.
              </p>
            )}
            {scheduled && effective < scheduled.effectiveFrom.slice(0, 10) && (
              <p className="pricing-notice">
                Bản đã hẹn từ {date(scheduled.effectiveFrom)} vẫn sẽ áp dụng vào
                ngày đó, thay thế cấu hình bạn đang lưu.
              </p>
            )}
            <p className="pricing-subtle">
              Lưu thay thế toàn bộ cấu hình từ ngày áp dụng. Để trống tỷ lệ nhóm
              sẽ bỏ mức riêng của nhóm đó. Giá bán không tự thay đổi.
            </p>
            {config && (
              <small className="pricing-subtle">
                Cấu hình từ {date(config.effectiveFrom)} · {config.setByName}
              </small>
            )}
          </div>
        </section>
        <section className="pricing-card">
          <div className="pricing-heading">
            <h2>Xem trước giá gợi ý</h2>
          </div>
          <InventoryNotice loading={valid && !shown} error={shown?.error} />
          {!valid && (
            <p className="pricing-empty">Hoàn tất tỷ lệ để xem trước.</p>
          )}
          {shown?.rows && (
            <div className="pricing-table">
              <table>
                <thead>
                  <tr>
                    <th>Phụ tùng</th>
                    <th>
                      Giá nhập
                      <br />
                      gần nhất
                    </th>
                    <th>Gợi ý</th>
                    <th>Hiện hành</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.rows.map((p) => {
                    const diff =
                      p.suggestedPrice != null && p.currentPrice != null
                        ? p.suggestedPrice - p.currentPrice
                        : null
                    return (
                      <tr key={p.productId}>
                        <td>{p.partName}</td>
                        <td>{money(p.latestPurchasePrice)}</td>
                        <td>
                          <strong>{money(p.suggestedPrice)}</strong>
                          {diff != null && diff !== 0 && (
                            <small
                              className={
                                diff > 0
                                  ? 'pricing-positive'
                                  : 'pricing-negative'
                              }
                            >
                              {diff > 0 ? '+' : ''}
                              {money(diff)}
                              {p.currentPrice
                                ? ' (' +
                                  (diff > 0 ? '+' : '') +
                                  (
                                    (diff / p.currentPrice) *
                                    100
                                  ).toLocaleString('vi-VN', {
                                    maximumFractionDigits: 2,
                                  }) +
                                  '%)'
                                : ''}
                            </small>
                          )}
                        </td>
                        <td>{money(p.currentPrice)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {!shown.rows.length && (
                <p className="pricing-empty">
                  Chưa có phụ tùng để tính giá gợi ý.
                </p>
              )}
            </div>
          )}
        </section>
      </div>
    </form>
  )
}
function ProductChoice({
  row,
  onChange,
}: {
  row: ProductRate
  onChange: (id: number, name: string) => void
}) {
  const [open, setOpen] = useState(false),
    [q, setQ] = useState(''),
    r = useChoicePages<{ id: number; sku: string; partName: string }>(
      '/products',
      q,
      open,
    )
  return (
    <div className="pricing-product-choice">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {row.name || 'Chọn phụ tùng'} ▾
      </button>
      {open && (
        <div className="pricing-options">
          <input
            aria-label="Tìm phụ tùng theo SKU hoặc tên"
            placeholder="SKU hoặc tên phụ tùng"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <InventoryNotice loading={r.loading} error={r.error} />
          {r.data?.items.map((p) => (
            <button
              type="button"
              key={p.id}
              onClick={() => {
                onChange(p.id, p.partName + ' · ' + p.sku)
                setOpen(false)
              }}
            >
              {p.partName}
              <small>{p.sku}</small>
            </button>
          ))}
          {r.data && !r.data.items.length && <p>Không có phụ tùng phù hợp.</p>}
          {r.hasMore && (
            <button type="button" disabled={r.loading} onClick={r.loadMore}>
              Tải thêm
            </button>
          )}
        </div>
      )}
    </div>
  )
}
