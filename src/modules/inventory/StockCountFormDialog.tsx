import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import FormDialog from '../../shared/ui/FormDialog'
import SearchableFilter from '../../shared/ui/SearchableFilter'
import { useInventoryData, inventoryError } from './api'
import { InventoryNotice } from './components'
import type { CountRequest, CountDto } from './countApi'
import type { Page } from './types'
import { today } from './presentation'
import axiosClient from '../../shared/api/axiosClient'
import { documentCode } from '../../shared/utils/documentCode'
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
      actualScope === 'PRODUCTS' && !source && query !== null,
    )
  const productOptions =
    products.data?.items.filter((p) => !actualProducts.includes(p.id)) ?? []
  const valid =
    !!actualStore &&
    (!requestId || !!source) &&
    (!owner || !!reason.trim()) &&
    (actualScope !== 'AREA' || !!actualArea.trim()) &&
    (actualScope !== 'PRODUCTS' || actualProducts.length > 0) &&
    !!date &&
    (owner || date <= monthEnd())
  async function save() {
    if (lock.current || !valid) return
    lock.current = true
    setBusy(true)
    setError('')
    try {
      const body = {
        scopeType: actualScope,
        scopeNote: actualScope === 'AREA' ? actualArea : undefined,
        productIds: actualScope === 'PRODUCTS' ? actualProducts : undefined,
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
              <option value="PRODUCTS">Theo phụ tùng</option>
            </select>
          </label>
          {actualScope === 'AREA' && (
            <label>
              Khu vực
              <input
                required
                disabled={!!source}
                list="count-areas"
                value={actualArea}
                onChange={(e) => setArea(e.target.value)}
                maxLength={255}
              />
              <datalist id="count-areas">
                {areas.data?.map((a) => (
                  <option key={a} value={a} />
                ))}
              </datalist>
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
