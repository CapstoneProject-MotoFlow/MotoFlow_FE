import { useEffect, useRef, useState } from 'react'
import { isAxiosError } from 'axios'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../shared/hooks/useAuth'
import axiosClient from '../../shared/api/axiosClient'
import FormDialog from '../../shared/ui/FormDialog'
import SearchableFilter from '../../shared/ui/SearchableFilter'
import { inventoryError, useInventoryData } from '../inventory/api'
import { InventoryNotice, Pagination } from '../inventory/components'
import type { Page } from '../inventory/types'
import { LimitEditor } from './PricingRulesPage'
import {
  canEditPrice,
  today,
  money,
  date,
  priceValid,
  flattenCategories,
  stateNames,
  roundingNames,
  type Price,
  type Version,
  type Category,
} from './model'
import './pricing.css'
export default function PriceListPage() {
  const { user } = useAuth(),
    edit = canEditPrice(user),
    owner = user?.role === 'OWNER'
  const [params, setParams] = useSearchParams(),
    [revision, setRevision] = useState(0),
    [selected, setSelected] = useState<{
      row: Price
      mode: 'edit' | 'history'
    }>(),
    [notice, setNotice] = useState(''),
    [limit, setLimit] = useState<'DISCOUNT_THRESHOLD' | 'MINIMUM_MARGIN'>()
  const page = Math.max(0, Number(params.get('page')) || 0),
    diff = edit && params.get('diff') !== '0'
  const prices = useInventoryData<Page<Price>>(
    '/pricing/retail-prices',
    {
      q: params.get('q') ?? '',
      categoryId: params.get('categoryId') ?? '',
      status: params.get('status') ?? 'ACTIVE',
      suggestionDiffers: diff ? true : undefined,
      page,
      size: 20,
    },
    revision,
  )
  const cats = useInventoryData<Category[]>('/part-categories')
  useEffect(() => {
    if (prices.error) window.dispatchEvent(new Event('auth-user-refresh'))
  }, [prices.error])
  function filter(key: string, value: string) {
    setParams(
      (p) => {
        const n = new URLSearchParams(p)
        n.set(key, value)
        n.delete('page')
        return n
      },
      { replace: true },
    )
  }
  return (
    <main className="dashboard-content pricing-page">
      <header>
        <h1>Bảng giá bán lẻ</h1>
        <nav>
          <Link to="/dashboard">Trang chủ</Link> › Giá bán › Bảng giá
        </nav>
      </header>
      {notice && (
        <p className="pricing-notice" role="status">
          {notice}
        </p>
      )}
      <section className="pricing-card pricing-retail-list">
        <div className="pricing-heading">
          <h2>Giá bán lẻ toàn chuỗi</h2>
          {owner && (
            <div className="pricing-actions">
              <button onClick={() => setLimit('DISCOUNT_THRESHOLD')}>
                Ngưỡng chiết khấu
              </button>
              <button onClick={() => setLimit('MINIMUM_MARGIN')}>
                Biên lợi nhuận
              </button>
            </div>
          )}
        </div>
        <div className="pricing-filters">
          <label>
            Tìm phụ tùng
            <input
              placeholder="Tên phụ tùng hoặc SKU"
              value={params.get('q') ?? ''}
              onChange={(e) => filter('q', e.target.value)}
            />
          </label>
          <div className="pricing-filter-choice">
            <span>Nhóm hàng</span>
            <SearchableFilter
              label="Nhóm hàng"
              value={params.get('categoryId') ?? ''}
              options={[
                { value: '', label: 'Mọi nhóm' },
                ...flattenCategories(cats.data ?? []).map((category) => ({
                  value: String(category.id),
                  label: category.categoryName,
                })),
              ]}
              onChange={(value) => filter('categoryId', value)}
            />
          </div>
          <div className="pricing-filter-choice">
            <span>Trạng thái</span>
            <SearchableFilter
              label="Trạng thái"
              value={params.get('status') ?? 'ACTIVE'}
              options={[
                { value: 'ACTIVE', label: 'Đang kinh doanh' },
                { value: 'DISCONTINUED', label: 'Ngừng kinh doanh' },
                { value: '', label: 'Tất cả' },
              ]}
              onChange={(value) => filter('status', value)}
            />
          </div>
          {edit && (
            <label className="pricing-check">
              <input
                type="checkbox"
                checked={diff}
                onChange={(e) => filter('diff', e.target.checked ? '1' : '0')}
              />
              Chỉ mã có giá gợi ý khác giá hiện hành
            </label>
          )}
        </div>
        <InventoryNotice
          loading={prices.loading}
          error={prices.error || cats.error}
        />
        {diff && (
          <p className="pricing-note">
            Đang lọc phụ tùng có giá gợi ý khác giá hiện hành.{' '}
            <button onClick={() => filter('diff', '0')}>Xem cả bảng giá</button>
          </p>
        )}
        <div className="pricing-table">
          <table>
            <thead>
              <tr>
                <th>Phụ tùng</th>
                <th>Nhóm</th>
                <th>Giá bán lẻ</th>
                {owner && <th>Giá nhập gần nhất</th>}
                {edit && (
                  <>
                    <th>Giá gợi ý</th>
                    <th>Chênh lệch</th>
                  </>
                )}
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {prices.data?.items.map((r) => {
                const suggested =
                  r.suggestedPrice != null &&
                  r.suggestedPrice !== r.currentPrice
                    ? r.suggestedPrice
                    : null
                return (
                  <tr key={r.productId}>
                    <td>
                      <strong>{r.partName}</strong>
                      <small>
                        {r.sku} · {r.baseUnit}
                      </small>
                    </td>
                    <td>{r.categoryName ?? '—'}</td>
                    <td>
                      <strong>{money(r.currentPrice)}</strong>
                      {r.scheduledPrice != null && (
                        <small className="pricing-badge">
                          Sắp đổi {money(r.scheduledPrice)} từ{' '}
                          {date(r.scheduledFrom)}
                        </small>
                      )}
                    </td>
                    {owner && (
                      <td>
                        {money(r.purchaseBasis?.latestPurchasePrice)}
                        {r.purchaseBasis && (
                          <small>
                            {date(r.purchaseBasis.receivedDate)} · cộng{' '}
                            {r.purchaseBasis.markupRate}%
                          </small>
                        )}
                      </td>
                    )}
                    {edit && (
                      <>
                        <td>
                          {r.suggestedPrice == null
                            ? 'Chưa có gợi ý'
                            : suggested == null
                              ? 'Bằng giá hiện hành'
                              : money(suggested)}
                        </td>
                        <td>
                          {suggested != null && r.currentPrice ? (
                            <span
                              className={
                                suggested > r.currentPrice
                                  ? 'pricing-positive'
                                  : 'pricing-negative'
                              }
                            >
                              {suggested > r.currentPrice ? '+' : ''}
                              {(
                                ((suggested - r.currentPrice) /
                                  r.currentPrice) *
                                100
                              ).toLocaleString('vi-VN', {
                                maximumFractionDigits: 2,
                              })}
                              %
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                      </>
                    )}
                    <td>
                      <div className="mf-row-actions pricing-actions">
                        <button
                          type="button"
                          className="mf-btn mf-btn--sm mf-btn--secondary"
                          onClick={() =>
                            setSelected({ row: r, mode: 'history' })
                          }
                        >
                          Lịch sử
                        </button>
                        {edit && (
                          <button
                            type="button"
                            className="mf-btn mf-btn--sm mf-btn--primary"
                            onClick={() =>
                              setSelected({ row: r, mode: 'edit' })
                            }
                          >
                            Sửa giá
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {prices.data && !prices.data.items.length && (
          <div className="pricing-empty">
            {diff
              ? 'Không có phụ tùng có giá gợi ý khác giá hiện hành.'
              : 'Không có phụ tùng phù hợp.'}
            {diff && (
              <button onClick={() => filter('diff', '0')}>
                Xem cả bảng giá
              </button>
            )}
          </div>
        )}
        <Pagination
          total={prices.data?.totalItems ?? 0}
          page={page}
          loading={prices.loading}
          onPage={(n) =>
            setParams((p) => {
              const x = new URLSearchParams(p)
              x.set('page', String(n))
              return x
            })
          }
        />
      </section>
      {selected?.mode === 'history' && (
        <PriceHistory
          row={selected.row}
          onClose={() => setSelected(undefined)}
        />
      )}
      {selected?.mode === 'edit' && edit && (
        <PriceEditor
          row={selected.row}
          owner={owner}
          onClose={() => setSelected(undefined)}
          onSaved={() => {
            setSelected(undefined)
            setRevision((n) => n + 1)
            setNotice('Đã lưu giá bán lẻ.')
          }}
        />
      )}
      {limit && owner && (
        <LimitEditor
          type={limit}
          onClose={() => setLimit(undefined)}
          onSaved={() => {
            setLimit(undefined)
            setNotice('Đã lưu ngưỡng bán hàng.')
          }}
        />
      )}
    </main>
  )
}
function PriceHistory({ row, onClose }: { row: Price; onClose: () => void }) {
  const h = useInventoryData<Version[]>(
      `/pricing/retail-prices/${row.productId}/history`,
    ),
    [all, setAll] = useState(false)
  return (
    <FormDialog
      title={'Lịch sử giá · ' + row.partName}
      formId="price-history"
      submitLabel=""
      hideSubmit
      onClose={onClose}
    >
      <div className="pricing-dialog">
        <InventoryNotice loading={h.loading} error={h.error} />
        <div className="pricing-table">
          <table>
            <thead>
              <tr>
                <th>Áp dụng từ</th>
                <th>Giá</th>
                <th>Thay đổi</th>
                <th>Trạng thái</th>
                <th>Lý do</th>
                <th>Người đổi</th>
              </tr>
            </thead>
            <tbody>
              {(all ? h.data : h.data?.slice(0, 10))?.map((v) => (
                <tr key={v.id}>
                  <td>
                    {date(v.effectiveFrom)}
                    <small>Đến {date(v.effectiveTo)}</small>
                  </td>
                  <td>{money(v.unitPrice)}</td>
                  <td>
                    {v.change == null
                      ? 'Giá ban đầu'
                      : (v.change > 0 ? '+' : '') + money(v.change)}
                  </td>
                  <td>{stateNames[v.state] ?? v.state}</td>
                  <td>
                    {[v.fromSuggestion ? 'Áp dụng giá gợi ý' : '', v.reason]
                      .filter(Boolean)
                      .join(' · ') || '—'}
                  </td>
                  <td>
                    {v.setByName}
                    <small>{date(v.setAt)}</small>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {h.data && !h.data.length && (
          <p className="pricing-empty">Chưa có lịch sử giá.</p>
        )}
        {!all && (h.data?.length ?? 0) > 10 && (
          <button onClick={() => setAll(true)}>Xem tất cả</button>
        )}
      </div>
    </FormDialog>
  )
}
function PriceEditor({
  row: initialRow,
  owner,
  onClose,
  onSaved,
}: {
  row: Price
  owner: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const [row, setRow] = useState(initialRow)
  const [value, setValue] = useState(''),
    [effective, setEffective] = useState(today()),
    [reason, setReason] = useState(''),
    [suggested, setSuggested] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    lock = useRef(false)
  const valid =
    priceValid(value) && effective >= today() && reason.length <= 500
  async function save() {
    if (!valid || lock.current) return
    lock.current = true
    setBusy(true)
    setError('')
    try {
      await axiosClient.post('/pricing/retail-prices', {
        productId: row.productId,
        unitPrice: Number(value),
        effectiveDate: effective,
        reason: reason.trim() || null,
        fromSuggestion: suggested,
      })
      onSaved()
    } catch (e) {
      setError(inventoryError(e))
      if (
        isAxiosError(e) &&
        e.response?.status === 409 &&
        e.response.data?.code === 'MSG126'
      ) {
        setValue('')
        setSuggested(false)
        try {
          const { data } = await axiosClient.get<Price>(
            '/pricing/retail-prices/' + row.productId,
          )
          setRow(data)
          setError(
            'Giá gợi ý đã thay đổi. Dữ liệu mới đã được tải, vui lòng kiểm tra và chọn lại giá.',
          )
        } catch (loadError) {
          setError(inventoryError(loadError))
        }
      }
      if (isAxiosError(e) && e.response?.status === 403)
        window.dispatchEvent(new Event('auth-user-refresh'))
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  return (
    <FormDialog
      title={'Sửa giá bán lẻ · ' + row.partName}
      formId="price-edit"
      submitLabel="Lưu giá mới"
      submitDisabled={!valid}
      busy={busy}
      onClose={onClose}
    >
      <form
        className="pricing-dialog"
        id="price-edit"
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        <div className="pricing-recap">
          Giá hiện hành <strong>{money(row.currentPrice)}</strong> · từ{' '}
          {date(row.currentFrom)}
          {row.suggestedPrice != null && (
            <p>
              Giá gợi ý <strong>{money(row.suggestedPrice)}</strong>
            </p>
          )}
          {owner && row.purchaseBasis && (
            <small>
              {money(row.purchaseBasis.latestPurchasePrice)} × (1 +{' '}
              {row.purchaseBasis.markupRate}%) ·{' '}
              {roundingNames[row.purchaseBasis.roundingRule]}
            </small>
          )}
        </div>
        {row.scheduledPrice != null && (
          <p className="pricing-notice">
            Đã hẹn giá {money(row.scheduledPrice)} từ {date(row.scheduledFrom)}.
            Giá mới có thể thay thế lịch giá đã hẹn từ ngày áp dụng.
          </p>
        )}
        {error && (
          <p role="alert" className="pricing-negative">
            {error}
          </p>
        )}
        <div className="pricing-grid">
          <label>
            Giá bán lẻ mới (₫) *
            <input
              required
              inputMode="numeric"
              value={value}
              disabled={busy}
              onChange={(e) => {
                setValue(e.target.value)
                setSuggested(false)
              }}
            />
            {row.suggestedPrice != null && (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setValue(String(row.suggestedPrice))
                  setSuggested(true)
                }}
              >
                Dùng giá gợi ý {money(row.suggestedPrice)}
              </button>
            )}
          </label>
          <label>
            Áp dụng từ *
            <input
              required
              type="date"
              min={today()}
              value={effective}
              disabled={busy}
              onChange={(e) => setEffective(e.target.value)}
            />
          </label>
        </div>
        <label>
          Lý do
          <textarea
            maxLength={500}
            value={reason}
            disabled={busy}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
        {valid && (
          <p className="pricing-recap">
            Sẽ áp dụng giá <strong>{money(Number(value))}</strong> toàn chuỗi từ{' '}
            <strong>{date(effective)}</strong>. Đơn đã xác nhận giữ giá cũ.
          </p>
        )}
      </form>
    </FormDialog>
  )
}
