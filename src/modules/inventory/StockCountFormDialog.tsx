import { useState } from 'react'
import FormDialog from '../../shared/ui/FormDialog'
import { useInventoryData } from './api'
import { InventoryNotice } from './components'
import type { DashboardStore } from '../../shared/types/store'
import type { Page } from './types'
import { today } from './presentation'
import './stock-count.css'

type Product = { id: number; partName: string; sku: string }
export function StockCountFormDialog({
  owner,
  storeId,
  onClose,
}: {
  owner: boolean
  storeId?: number | null
  onClose: () => void
}) {
  const stores = useInventoryData<DashboardStore[]>('/stores', {}, 0, owner)
  const [warehouse, setWarehouse] = useState(storeId ? String(storeId) : '')
  const [scope, setScope] = useState('AREA')
  const [area, setArea] = useState('')
  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState<Product[]>([])
  const [selected, setSelected] = useState('')
  const areas = useInventoryData<string[]>(
    '/inventory/stock/storage-areas',
    { storeId: owner ? warehouse : undefined },
    0,
    !!warehouse,
  )
  const products = useInventoryData<Page<Product>>(
    '/products',
    { q: query, storeId: warehouse, size: 20 },
    0,
    !!warehouse && scope === 'SKUS',
  )
  const name = owner ? 'Yêu cầu kiểm kê' : 'Tạo phiếu kiểm kê'
  return (
    <FormDialog
      className="count-create-dialog"
      title={name}
      formId="count-create"
      submitLabel={owner ? 'Gửi yêu cầu' : 'Tạo phiếu'}
      submitDisabled
      onClose={onClose}
    >
      <form
        id="count-create"
        className="count-form"
        onSubmit={(e) => e.preventDefault()}
      >
        {owner && (
          <label>
            Kho cần kiểm *
            <select
              required
              value={warehouse}
              onChange={(e) => {
                setWarehouse(e.target.value)
                setArea('')
                setQuery('')
                setPicked([])
                setSelected('')
              }}
            >
              <option value="">Chọn kho</option>
              {stores.data
                ?.filter((store) => store.status === 'ACTIVE')
                .map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.storeName}
                  </option>
                ))}
            </select>
          </label>
        )}
        {!owner && (
          <fieldset>
            <legend>Loại kiểm kê</legend>
            <div className="count-radio-options">
              {[
                ['CYCLE', 'Định kỳ'],
                ['YEAR_END', 'Cuối năm'],
                ['OPENING', 'Đầu kỳ'],
              ].map(([value, label]) => (
                <label key={value}>
                  <input
                    type="radio"
                    name="type"
                    value={value}
                    defaultChecked={value === 'CYCLE'}
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        <fieldset>
          <legend>Phạm vi</legend>
          <div className="count-radio-options">
            {[
              ['ALL', 'Toàn kho'],
              ['AREA', 'Một khu vực'],
              ['SKUS', 'Một số phụ tùng'],
            ].map(([value, label]) => (
              <label key={value}>
                <input
                  type="radio"
                  name="scope"
                  value={value}
                  checked={scope === value}
                  onChange={() => setScope(value)}
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
        {scope === 'AREA' && (
          <label>
            Khu vực *
            <select
              required
              value={area}
              disabled={!warehouse || areas.loading}
              onChange={(e) => setArea(e.target.value)}
            >
              <option value="">Chọn khu vực</option>
              {areas.data?.map((area) => (
                <option key={area}>{area}</option>
              ))}
            </select>
          </label>
        )}
        {scope === 'SKUS' && (
          <div>
            <label>
              Tìm phụ tùng
              <input
                disabled={!warehouse}
                placeholder="Tên hoặc SKU…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <div className="count-pick">
              <label>
                Phụ tùng cần đếm
                <select
                  disabled={!warehouse || products.loading}
                  value={selected}
                  onChange={(e) => setSelected(e.target.value)}
                >
                  <option value="">Chọn phụ tùng</option>
                  {products.data?.items.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.partName} · {product.sku}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                disabled={!selected}
                onClick={() => {
                  const product = products.data?.items.find(
                    (item) => String(item.id) === selected,
                  )
                  if (product && !picked.some((item) => item.id === product.id))
                    setPicked([...picked, product])
                  setSelected('')
                }}
              >
                Thêm
              </button>
            </div>
            <ul className="count-chips">
              {picked.map((item) => (
                <li key={item.id}>
                  {item.partName}
                  <button
                    type="button"
                    aria-label={'Bỏ ' + item.partName}
                    onClick={() =>
                      setPicked(
                        picked.filter((product) => product.id !== item.id),
                      )
                    }
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {owner ? (
          <label>
            Lý do *
            <textarea
              rows={3}
              required
              maxLength={1000}
              placeholder="Nhập lý do cần kiểm kê…"
            />
          </label>
        ) : (
          <label>
            Ngày kiểm kê *
            <input type="date" required defaultValue={today()} />
          </label>
        )}
        {owner && warehouse && (
          <p className="stock-notice">
            Yêu cầu sẽ được gửi tới Branch Manager của{' '}
            {stores.data?.find((store) => String(store.id) === warehouse)
              ?.storeName ?? 'kho đã chọn'}{' '}
            để lập phiếu kiểm kê.
          </p>
        )}
        {!owner && (
          <p className="stock-notice">
            Ngày kiểm kê phải thuộc kỳ kho đang mở. Kiểm kê đầu kỳ chỉ ghi tồn
            sau khi Owner duyệt giá vốn.
          </p>
        )}
        <InventoryNotice
          loading={stores.loading || areas.loading || products.loading}
          error={stores.error ?? areas.error ?? products.error}
        />
        <p className="count-unavailable" role="status">
          {owner
            ? 'Chưa thể gửi yêu cầu kiểm kê lúc này.'
            : 'Chưa thể tạo phiếu kiểm kê lúc này.'}{' '}
          Các thông tin bạn nhập chưa được lưu.
        </p>
      </form>
    </FormDialog>
  )
}
