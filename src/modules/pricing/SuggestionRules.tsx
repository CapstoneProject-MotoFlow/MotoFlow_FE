import { useEffect, useRef, useState } from 'react'
import axiosClient from '../../shared/api/axiosClient'
import SearchableFilter from '../../shared/ui/SearchableFilter'
import { inventoryError, useInventoryData } from '../inventory/api'
import { InventoryNotice } from '../inventory/components'
import type { Page } from '../inventory/types'
import {
  date,
  money,
  today,
  percentValid,
  flattenCategories,
  type Config,
  type Category,
  type Preview,
} from './model'

type ProductOption = { id: number; sku: string; partName: string }
type ProductRate = ProductOption & { rate: string }
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
        config?.products.map((p) => ({
          id: p.productId,
          sku: p.sku,
          partName: p.partName,
          rate: String(p.markupRate),
        })) ?? [],
    ),
    [search, setSearch] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    lock = useRef(false)
  const catalog = useInventoryData<Page<ProductOption>>(
    '/products',
    { q: search?.trim(), size: 10 },
    0,
    search !== null && !busy,
  )
  const productOptions = catalog.data?.items ?? []
  function chooseProduct(value: string) {
    const product = productOptions.find((part) => String(part.id) === value)
    if (!product) return
    setProducts((rows) =>
      rows.some((row) => row.id === product.id)
        ? rows
        : [...rows, { ...product, rate: '' }],
    )
    requestAnimationFrame(() =>
      document.getElementById('markup-rate-' + product.id)?.focus(),
    )
  }
  const valid =
    (Object.values(rates).some((v) => v !== '') || products.length > 0) &&
    Object.values(rates).every((v) => v === '' || percentValid(v, 999.99)) &&
    products.every((p) => percentValid(p.rate, 999.99))
  const payload = {
      roundingRule: 'NONE',
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
    if (!valid || lock.current) return
    lock.current = true
    setBusy(true)
    setError('')
    try {
      await axiosClient.post('/pricing/markup-rules', {
        ...payload,
        effectiveDate: today(),
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
            <SearchableFilter
              label="Tìm và thêm phụ tùng"
              searchPlaceholder="Tìm theo tên phụ tùng hoặc SKU…"
              value=""
              options={productOptions.map((part) => ({
                value: String(part.id),
                label: part.partName + ' · ' + part.sku,
              }))}
              disabled={busy}
              loading={catalog.loading}
              onSearch={setSearch}
              onChange={chooseProduct}
            />
            {catalog.error && <InventoryNotice error={catalog.error} />}
          </div>
          {products.map((p) => (
            <div key={p.id} className="pricing-override-row">
              <div className="pricing-override-part">
                <span>{p.partName}</span>
                <small>{p.sku}</small>
              </div>
              <div className="pricing-inline-percent">
                <input
                  id={'markup-rate-' + p.id}
                  aria-label={'Tỷ lệ riêng ' + p.partName}
                  required
                  type="number"
                  min="0"
                  max="999.99"
                  step="0.01"
                  value={p.rate}
                  onChange={(e) =>
                    setProducts((rows) =>
                      rows.map((x) =>
                        x.id === p.id ? { ...x, rate: e.target.value } : x,
                      ),
                    )
                  }
                />
                <span>%</span>
              </div>
              <button
                type="button"
                onClick={() =>
                  setProducts((rows) => rows.filter((x) => x.id !== p.id))
                }
              >
                Bỏ
              </button>
            </div>
          ))}
        </section>
      </fieldset>
      <div className="pricing-suggestion-right">
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
        <section className="pricing-card">
          <div className="pricing-rule-save">
            <button className="pricing-primary" disabled={!valid || busy}>
              {busy ? 'Đang lưu…' : 'Lưu quy tắc'}
            </button>
            {error && (
              <p role="alert" className="pricing-negative">
                {error}
              </p>
            )}
            {!valid && (
              <p className="pricing-negative">
                Nhập tỷ lệ cộng thêm từ 0 đến 999,99%.
              </p>
            )}
            {scheduled && (
              <p className="pricing-notice">
                Bản đã hẹn từ {date(scheduled.effectiveFrom)} vẫn sẽ áp dụng vào
                ngày đó, thay thế cấu hình bạn đang lưu.
              </p>
            )}
            <p className="pricing-subtle">
              Quy tắc mới áp dụng ngay cho giá gợi ý.
            </p>
          </div>
        </section>
      </div>
    </form>
  )
}
