import { useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import axiosClient from '../../shared/api/axiosClient'
import { uploadAttachment } from '../../shared/api/upload'
import { stockStatusLabels } from '../../shared/labels/status'
import { formatDateTime } from '../../shared/utils/format'
import LocalizedFileInput from '../../shared/ui/LocalizedFileInput'
import PageHeader from '../../shared/ui/PageHeader'
import {
  inventoryError,
  useInventoryData,
  useInventoryScope,
} from '../inventory/api'
import type { StockDetail } from '../inventory/types'
import ProductPicker, { type ProductOption } from '../receiving/ProductPicker'
import AdjustmentEffects from './AdjustmentEffects'
import { Card, Facts } from './DocumentUi'
import { adjustmentPath } from './model'
import type { AdjustmentDetail, AdjustmentEffects as Effects } from './types'

const eligible = ['AVAILABLE', 'DAMAGED', 'WRONG_ITEM']
const formats = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
const stockLossPath = '/adjustment-requests/stock-loss'

export default function StockLossPage() {
  const { owner, stores, storesError, user } = useInventoryScope()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [warehouse, setWarehouse] = useState(() => params.get('storeId') ?? '')
  const storeId = owner ? Number(warehouse) : user?.storeId
  const [incident, setIncident] = useState('LOSS')
  const [part, setPart] = useState<ProductOption>()
  const [selected, selectLot] = useState('')
  const [quantity, setQuantity] = useState('')
  const [reason, setReason] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const uploaded = useRef(
    new Map<File, Awaited<ReturnType<typeof uploadAttachment>>>(),
  )
  const [preview, setPreview] = useState<Effects>()
  const [busy, setBusy] = useState<'preview' | 'send'>()
  const [error, setError] = useState('')
  const stock = useInventoryData<StockDetail>(
    '/inventory/stock/' + storeId + '/' + part?.id,
    {},
    0,
    !!storeId && !!part,
  )
  const lotKey = (row: StockDetail['lots'][number]) =>
    row.lotId + ':' + row.stockStatus
  const allLots = stock.data?.lots ?? []
  // Mục 7 (PM 19/11): phụ tùng có hạn sử dụng (hoặc báo hàng hết hạn) phải ghi giảm theo lô.
  // Phụ tùng không có hạn chỉ chọn trạng thái tồn; lotId để trống, BE lấy lô FIFO khi áp dụng.
  const byLot =
    incident === 'EXPIRED' || allLots.some((row) => !!row.expiryDate)
  const lots = allLots
    .filter(
      (row) =>
        row.quantity > 0 &&
        eligible.includes(row.stockStatus) &&
        (incident === 'EXPIRED'
          ? row.expiryState === 'EXPIRED'
          : row.expiryState !== 'EXPIRED'),
    )
    .sort(
      (a, b) =>
        (a.expiryDate || '9999').localeCompare(b.expiryDate || '9999') ||
        a.receivedDate.localeCompare(b.receivedDate) ||
        a.lotId - b.lotId,
    )
  const choices: {
    key: string
    lotId: number | null
    stockStatus: string
    quantity: number
    lot?: StockDetail['lots'][number]
  }[] = byLot
    ? lots.map((row) => ({
        key: lotKey(row),
        lotId: row.lotId,
        stockStatus: row.stockStatus,
        quantity: row.quantity,
        lot: row,
      }))
    : eligible
        .map((status) => ({
          key: 'status:' + status,
          lotId: null,
          stockStatus: status,
          quantity: lots
            .filter((row) => row.stockStatus === status)
            .reduce((sum, row) => sum + row.quantity, 0),
        }))
        .filter((choice) => choice.quantity > 0)
  const lot = choices.find((row) => row.key === selected) ?? choices[0]
  const units = Number(quantity)
  const exceeds = !!lot && units > lot.quantity
  const storeName = owner
    ? stores.find((store) => store.id === storeId)?.storeName
    : user?.storeName

  function clearPreview() {
    setPreview(undefined)
    setError('')
  }

  async function execute(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy || !lot || !part || !storeId || exceeds) return
    if (!Number.isSafeInteger(units) || units <= 0 || !reason.trim()) {
      setError('Nhập số lượng và mô tả sự việc.')
      return
    }
    if (
      files.length === 0 ||
      files.length > 10 ||
      files.some(
        (file) =>
          !formats.includes(file.type) ||
          !file.size ||
          file.size > 10 * 1024 * 1024 ||
          file.name.length > 255,
      )
    ) {
      setError(
        'Chọn từ 1 đến 10 tệp JPG, PNG, WebP hoặc PDF, tối đa 10 MB mỗi tệp.',
      )
      return
    }
    const body = {
      storeId: owner ? storeId : undefined,
      reason: reason.trim(),
      lines: [
        {
          productId: part.id,
          lotId: lot.lotId,
          stockStatus: lot.stockStatus,
          quantity: units,
        },
      ],
    }
    setError('')
    setBusy(preview ? 'send' : 'preview')
    try {
      if (!preview) {
        const { data } = await axiosClient.post<Effects>(
          stockLossPath + '/preview',
          body,
        )
        setPreview(data)
        return
      }
      const attachments = []
      for (const file of files) {
        let attachment = uploaded.current.get(file)
        if (!attachment) {
          attachment = await uploadAttachment(file)
          uploaded.current.set(file, attachment)
        }
        attachments.push(attachment)
      }
      const { data } = await axiosClient.post<AdjustmentDetail>(stockLossPath, {
        ...body,
        attachments,
      })
      navigate(adjustmentPath(data.id), { replace: true })
    } catch (failure) {
      setError(inventoryError(failure))
      setPreview(undefined)
    } finally {
      setBusy(undefined)
    }
  }

  return (
    <div className="docs-page">
      <PageHeader
        title="Báo mất, hỏng hàng"
        breadcrumb={[
          { label: 'Yêu cầu điều chỉnh', to: '/adjustments' },
          { label: 'Báo mất, hỏng hàng' },
        ]}
      />
      <form className="docs-stack" onSubmit={execute}>
        <div className="docs-split">
          <Card
            title={
              'Yêu cầu điều chỉnh mới' + (storeName ? ' · ' + storeName : '')
            }
          >
            <fieldset disabled={!!busy} className="docs-form">
              <legend className="docs-sr-only">Thông tin hàng ghi giảm</legend>
              {owner && (
                <label>
                  Cửa hàng
                  <select
                    required
                    value={warehouse}
                    onChange={(event) => {
                      setWarehouse(event.target.value)
                      selectLot('')
                      clearPreview()
                    }}
                  >
                    <option value="">Chọn cửa hàng</option>
                    {stores.map((store) => (
                      <option key={store.id} value={store.id}>
                        {store.storeName}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {storesError && (
                <p role="alert" className="docs-alert">
                  {storesError}
                </p>
              )}
              <div
                className="docs-incident"
                role="group"
                aria-label="Loại sự việc"
              >
                {[
                  ['LOSS', 'Mất hoặc hỏng tại kho'],
                  ['EXPIRED', 'Hàng hết hạn'],
                ].map(([value, label]) => (
                  <label key={value}>
                    <input
                      type="radio"
                      name="incident"
                      checked={incident === value}
                      onChange={() => {
                        setIncident(value)
                        selectLot('')
                        clearPreview()
                      }}
                    />
                    {label}
                  </label>
                ))}
                <label title="Báo mất trên đường tại màn xử lý sai lệch điều chuyển">
                  <input type="radio" name="incident" disabled />
                  Mất trên đường
                </label>
              </div>
              <div className="docs-form-grid">
                <ProductPicker
                  label="Phụ tùng"
                  selected={part}
                  excludedIds={[]}
                  disabled={!storeId || !!busy}
                  onSelect={(product) => {
                    setPart(product)
                    selectLot('')
                    clearPreview()
                  }}
                />
                <label>
                  {byLot ? 'Lô và trạng thái tồn' : 'Trạng thái tồn'}
                  <select
                    required
                    value={lot ? lot.key : ''}
                    disabled={!choices.length}
                    onChange={(event) => {
                      selectLot(event.target.value)
                      clearPreview()
                    }}
                  >
                    {!lot && (
                      <option value="">
                        {stock.loading
                          ? 'Đang tải tồn kho…'
                          : part
                            ? 'Không có tồn phù hợp'
                            : 'Chọn phụ tùng trước'}
                      </option>
                    )}
                    {choices.map((row) => (
                      <option key={row.key} value={row.key}>
                        {row.lot
                          ? (row.lot.manufacturerLotNo || '#' + row.lotId) +
                            ' · '
                          : ''}
                        {stockStatusLabels[row.stockStatus]} · còn{' '}
                        {row.quantity}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Số lượng ghi giảm
                  {stock.data?.stock.baseUnit
                    ? ' (' + stock.data.stock.baseUnit + ')'
                    : ''}
                  <input
                    type="number"
                    min="1"
                    max={lot?.quantity}
                    step="1"
                    required
                    disabled={!lot}
                    value={quantity}
                    onChange={(event) => {
                      setQuantity(event.target.value)
                      clearPreview()
                    }}
                    aria-invalid={exceeds || undefined}
                    aria-describedby={
                      exceeds ? 'docs-quantity-error' : undefined
                    }
                  />
                </label>
              </div>
              {stock.error && (
                <div className="docs-alert" role="alert">
                  {stock.error}
                  <button
                    type="button"
                    className="mf-btn mf-btn--secondary"
                    onClick={stock.retry}
                  >
                    Thử lại
                  </button>
                </div>
              )}
              {exceeds && (
                <div
                  className="docs-alert"
                  id="docs-quantity-error"
                  role="alert"
                >
                  {byLot
                    ? 'Số lượng vượt tồn của lô.'
                    : 'Số lượng vượt tồn kho.'}
                  <button
                    type="button"
                    className="mf-btn mf-btn--secondary"
                    onClick={() => {
                      setQuantity(String(lot.quantity))
                      clearPreview()
                    }}
                  >
                    Đặt về {lot.quantity}
                  </button>
                </div>
              )}
              <label>
                Mô tả sự việc
                <textarea
                  required
                  rows={4}
                  maxLength={500}
                  value={reason}
                  onChange={(event) => {
                    setReason(event.target.value)
                    clearPreview()
                  }}
                />
              </label>
              <div>
                <strong>Ảnh, biên bản</strong>
                <LocalizedFileInput
                  multiple
                  required
                  accept=".jpg,.jpeg,.png,.webp,.pdf"
                  aria-label="Ảnh, biên bản"
                  onChange={(event) => {
                    uploaded.current.clear()
                    setFiles(Array.from(event.currentTarget.files ?? []))
                    clearPreview()
                  }}
                />
              </div>
            </fieldset>
          </Card>
          <div>
            <Card
              title={
                (byLot ? 'Tồn của lô' : 'Tồn kho') +
                (storeName ? ' · ' + storeName : '')
              }
            >
              {lot?.lot ? (
                <Facts
                  items={[
                    ['Lô', lot.lot.manufacturerLotNo || '#' + lot.lot.lotId],
                    [
                      'Còn trong kho',
                      lot.quantity + ' ' + (stock.data?.stock.baseUnit ?? ''),
                    ],
                    ['Trạng thái tồn', stockStatusLabels[lot.stockStatus]],
                    [
                      'Hạn dùng',
                      lot.lot.expiryDate
                        ? formatDateTime(lot.lot.expiryDate)
                        : 'Không có',
                    ],
                    ['Ngày nhận', formatDateTime(lot.lot.receivedDate)],
                    ['Nhà cung cấp', lot.lot.supplierName],
                  ]}
                />
              ) : lot ? (
                <Facts
                  items={[
                    [
                      'Còn trong kho',
                      lot.quantity + ' ' + (stock.data?.stock.baseUnit ?? ''),
                    ],
                    ['Trạng thái tồn', stockStatusLabels[lot.stockStatus]],
                    ['Hạn dùng', 'Không có'],
                    ['Lô ghi giảm', 'Hệ thống lấy lô nhận trước (FIFO)'],
                  ]}
                />
              ) : (
                <p className="docs-muted">
                  Chọn phụ tùng để xem tồn còn trong kho.
                </p>
              )}
              <p className="docs-note">
                Tồn kho được ghi giảm khi Owner duyệt và áp dụng yêu cầu.
              </p>
            </Card>
          </div>
        </div>
        {preview && (
          <Card title="Xem trước ảnh hưởng">
            <AdjustmentEffects data={preview} />
          </Card>
        )}
        {error && (
          <p className="docs-alert" role="alert">
            {error}
          </p>
        )}
        <div className="docs-footer docs-actions">
          {!busy && (
            <Link className="mf-btn mf-btn--secondary" to="/adjustments">
              Hủy
            </Link>
          )}
          <button
            type="submit"
            className="mf-btn mf-btn--primary"
            disabled={!!busy || !lot || exceeds}
          >
            {busy === 'preview'
              ? 'Đang kiểm tra…'
              : busy === 'send'
                ? 'Đang gửi…'
                : preview
                  ? 'Gửi Owner duyệt'
                  : 'Xem trước ảnh hưởng'}
          </button>
        </div>
      </form>
    </div>
  )
}
