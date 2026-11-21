import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import FormDialog from '../../shared/ui/FormDialog'
import SearchableFilter from '../../shared/ui/SearchableFilter'
import { useInventoryData, inventoryError } from './api'
import { InventoryNotice } from './components'
import type { CountRequest, CountDto } from './countApi'
import type { Page, StockRow } from './types'
import { today } from './presentation'
import axiosClient from '../../shared/api/axiosClient'
import { documentCode } from '../../shared/utils/documentCode'
import { categoryOptions, type Category } from '../catalog/api/searchProducts'
import './stock-count.css'
type Product = { id: number; sku: string; partName: string }
function monthEnd() {
  const d = new Date(),
    end = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  return [
    end.getFullYear(),
    String(end.getMonth() + 1).padStart(2, '0'),
    String(end.getDate()).padStart(2, '0'),
  ].join('-')
}
export function StockCountFormDialog({
  owner,
  storeId,
  requestId,
  onSaved,
  onClose,
}: {
  owner: boolean
  storeId?: number | null
  requestId?: number
  onSaved?: () => void
  onClose: () => void
}) {
  const navigate = useNavigate(),
    [warehouse, setWarehouse] = useState(String(storeId ?? '')),
    [scope, setScope] = useState('WHOLE'),
    [area, setArea] = useState(''),
    [reason, setReason] = useState(''),
    [countType, setType] = useState('CYCLE'),
    [date, setDate] = useState(today()),
    [query, setQuery] = useState<string | null>(null),
    [picked, setPicked] = useState<Product[]>([]),
    [groupId, setGroupId] = useState(''),
    [groupProducts, setGroupProducts] = useState<Product[]>([]),
    [groupLoading, setGroupLoading] = useState(false),
    [groupError, setGroupError] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  const lock = useRef(false),
    stores = useInventoryData<{ id: number; storeName: string }[]>(
      '/stock-count-requests/stores',
      {},
      0,
      owner,
    ),
    prefill = useInventoryData<CountRequest>(
      '/stock-counts/prefill',
      { requestId },
      0,
      !!requestId && !owner,
    ),
    source = prefill.data
  const actualScope = source?.scopeType ?? scope,
    actualArea = source?.scopeNote ?? area,
    actualProducts = source
      ? source.products.map((p) => p.productId)
      : scope === 'GROUP'
        ? groupProducts.map((p) => p.id)
        : picked.map((p) => p.id),
    actualStore = source?.storeId ?? Number(warehouse)
  const areas = useInventoryData<string[]>(
      '/inventory/stock/storage-areas',
      { storeId: owner ? warehouse : undefined },
      0,
      actualScope === 'AREA' && !!actualStore,
    ),
    products = useInventoryData<Page<Product>>(
      '/products',
      { q: query?.trim(), status: 'ACTIVE', size: 20 },
      0,
      scope === 'PRODUCTS' && !source && query !== null,
    )
  const categories = useInventoryData<Category[]>('/part-categories')
  const productOptions =
    products.data?.items.filter((p) => !actualProducts.includes(p.id)) ?? []
  useEffect(() => {
    if (scope !== 'GROUP' || !groupId) {
      setGroupProducts([])
      setGroupLoading(false)
      setGroupError('')
      return
    }
    const controller = new AbortController()
    setGroupLoading(true)
    setGroupProducts([])
    setGroupError('')
    void (async () => {
      try {
        const params = {
          categoryId: groupId,
          storeId: owner ? actualStore : undefined,
          includeZero: true,
          size: 100,
        }
        const first = await axiosClient.get<Page<StockRow>>('/inventory/stock', {
          params: { ...params, page: 0 },
          signal: controller.signal,
        })
        const pages = Math.ceil(first.data.totalItems / 100)
        const remaining = await Promise.all(
          Array.from({ length: Math.max(0, pages - 1) }, (_, index) =>
            axiosClient.get<Page<StockRow>>('/inventory/stock', {
              params: { ...params, page: index + 1 },
              signal: controller.signal,
            }),
          ),
        )
        if (!controller.signal.aborted)
          setGroupProducts(
            [
              ...new Map(
                [...first.data.items, ...remaining.flatMap((response) => response.data.items)]
                  .filter((row) => row.onHandQty > 0)
                  .map((row) => [
                    row.productId,
                    {
                      id: row.productId,
                      sku: row.sku,
                      partName: row.partName,
                    },
                  ]),
              ).values(),
            ],
          )
      } catch (e) {
        if (!controller.signal.aborted) setGroupError(inventoryError(e))
      } finally {
        if (!controller.signal.aborted) setGroupLoading(false)
      }
    })()
    return () => controller.abort()
  }, [scope, groupId, owner, actualStore])
  const valid =
    !!actualStore &&
    (!requestId || !!source) &&
    (!owner || !!reason.trim()) &&
    new Set(actualProducts).size === actualProducts.length &&
    (actualScope !== 'AREA' || !!actualArea.trim()) &&
    ((scope !== 'PRODUCTS' && actualScope !== 'PRODUCTS') ||
      actualProducts.length > 0) &&
    (scope !== 'GROUP' || (!!groupId && groupProducts.length > 0 && !groupLoading)) &&
    !!date &&
    (owner || date <= monthEnd())
  async function save() {
    if (lock.current || !valid) return
    lock.current = true
    setBusy(true)
    setError('')
    try {
      const body = {
        scopeType: actualScope === 'GROUP' ? 'PRODUCTS' : actualScope,
        scopeNote: actualScope === 'AREA' ? actualArea : undefined,
        productIds:
          actualScope === 'PRODUCTS' || actualScope === 'GROUP'
            ? actualProducts
            : undefined,
      }
      const r = await axiosClient.post<CountDto>(
        owner ? '/stock-count-requests' : '/stock-counts',
        owner
          ? { ...body, storeId: actualStore, reason: reason.trim() }
          : {
              ...body,
              countType: requestId ? 'CYCLE' : countType,
              countDate: date,
              stockCountRequestId: requestId,
            },
      )
      onSaved?.()
      onClose()
      if (!owner) navigate('/stock-counts/' + r.data.id)
    } catch (e) {
      setError(inventoryError(e))
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  return (
    <FormDialog
      title={owner ? 'Yêu cầu kiểm kê' : 'Tạo phiếu kiểm kê'}
      formId="count-create"
      submitLabel={owner ? 'Gửi yêu cầu' : 'Tạo phiếu'}
      busy={busy}
      submitDisabled={!valid || prefill.loading || !!prefill.error}
      onClose={onClose}
    >
      <form
        id="count-create"
        className="count-form"
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        <InventoryNotice
          loading={stores.loading || prefill.loading}
          error={error || stores.error || prefill.error}
        />
        <fieldset disabled={busy}>
          {owner && (
            <label>
              Kho cần kiểm
              <select
                aria-label="Kho cần kiểm"
                required
                value={warehouse}
                onChange={(e) => {
                  setWarehouse(e.target.value)
                  setArea('')
                  setPicked([])
                }}
              >
                <option value="">Chọn kho</option>
                {stores.data?.map((s) => (
                  <option value={s.id} key={s.id}>
                    {s.storeName}
                  </option>
                ))}
              </select>
            </label>
          )}
          {!owner && (
            <>
              <label>
                Loại kiểm kê
                <select
                  disabled={!!requestId}
                  value={requestId ? 'CYCLE' : countType}
                  onChange={(e) => setType(e.target.value)}
                >
                  <option value="CYCLE">Định kỳ</option>
                  <option value="YEAR_END">Cuối năm</option>
                </select>
              </label>
              <label>
                Ngày kiểm
                <input
                  required
                  type="date"
                  max={monthEnd()}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </label>
            </>
          )}
          {source && (
            <p>
              Yêu cầu {documentCode('YCKK', source.id)} · {source.storeName} ·{' '}
              {source.reason}
            </p>
          )}
          <label>
            Phạm vi
            <select
              disabled={!!source}
              value={actualScope}
              onChange={(e) => setScope(e.target.value)}
            >
              <option value="WHOLE">Toàn kho</option>
              <option value="AREA">Khu vực</option>
              <option value="GROUP">Một nhóm phụ tùng</option>
              <option value="PRODUCTS">Một số phụ tùng</option>
            </select>
          </label>
          {actualScope === 'AREA' && (
            <label>
              Khu vực
              <select
                required
                disabled={!!source || areas.loading || !areas.data?.length}
                value={actualArea}
                onChange={(e) => setArea(e.target.value)}
              >
                <option value="">
                  {areas.loading ? 'Đang tải khu vực…' : 'Chọn khu vực trong kho'}
                </option>
                {areas.data?.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
              {areas.error ? (
                <small role="alert">{areas.error}</small>
              ) : areas.data && !areas.data.length ? (
                <small>Kho chưa có khu vực được khai báo cho hàng tồn.</small>
              ) : null}
            </label>
          )}
          {actualScope === 'PRODUCTS' &&
            (source ? (
              <ul>
                {source.products.map((p) => (
                  <li key={p.productId}>
                    {p.sku} · {p.partName}
                  </li>
                ))}
              </ul>
            ) : (
              <>
                <div className="count-product-picker">
                  <span>Tìm phụ tùng</span>
                  <SearchableFilter
                    label="Tìm phụ tùng"
                    searchPlaceholder="Tìm theo tên hoặc SKU…"
                    value=""
                    options={productOptions.map((p) => ({
                      value: String(p.id),
                      label: p.sku + ' · ' + p.partName,
                    }))}
                    onSearch={setQuery}
                    loading={products.loading}
                    error={products.error}
                    disabled={busy}
                    onChange={(value) => {
                      const product = productOptions.find(
                        (p) => String(p.id) === value,
                      )
                      if (product)
                        setPicked((v) =>
                          v.some((p) => p.id === product.id)
                            ? v
                            : [...v, product],
                        )
                    }}
                  />
                </div>
                <ul className="count-chips">
                  {picked.map((p) => (
                    <li key={p.id}>
                      {p.sku}
                      <button
                        type="button"
                        aria-label={'Bỏ ' + p.sku}
                        onClick={() =>
                          setPicked((v) => v.filter((x) => x.id !== p.id))
                        }
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            ))}
          {scope === 'GROUP' && !source && (
            <div className="count-product-picker">
              <span>Nhóm phụ tùng</span>
              <SearchableFilter
                label="Chọn nhóm phụ tùng"
                searchPlaceholder="Tìm nhóm phụ tùng…"
                value={groupId}
                disabled={busy || categories.loading}
                options={categoryOptions(categories.data ?? []).map(
                  (category) => ({
                    value: String(category.id),
                    label: category.label ?? category.categoryName,
                  }),
                )}
                onChange={setGroupId}
              />
              {(groupLoading || groupError || categories.error) && (
                <small role={groupError || categories.error ? 'alert' : 'status'}>
                  {groupError || categories.error || 'Đang tải phụ tùng trong nhóm…'}
                </small>
              )}
              {!groupLoading && groupId && !groupError && groupProducts.length > 0 && (
                <small>{groupProducts.length} phụ tùng trong nhóm và nhóm con</small>
              )}
              {!groupLoading && groupId && !groupError && groupProducts.length === 0 && (
                <small role="alert">Nhóm này chưa có phụ tùng đang kinh doanh.</small>
              )}
            </div>
          )}
          {owner && (
            <label>
              Lý do
              <textarea
                required
                maxLength={255}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
          )}
        </fieldset>
      </form>
    </FormDialog>
  )
}
