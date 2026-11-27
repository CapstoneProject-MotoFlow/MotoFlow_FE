import { useId, useState } from 'react'
import axiosClient from '../../../shared/api/axiosClient'
import FormDialog from '../../../shared/ui/FormDialog'
import MoneyInput from '../../../shared/ui/MoneyInput'
import { formatDateTime } from '../../../shared/utils/format'
import ProductPicker, { type ProductOption } from '../../receiving/ProductPicker'
import { acceptanceOpenTypes } from '../discrepancyRules'
import ChoiceToggle from './ChoiceToggle'
import {
  acceptanceLabels,
  errorMessage,
  type AcceptanceType,
  type Case,
} from './types'

export type AcceptanceMode = 'request' | 'damaged' | 'wrong'

/**
 * NH7a/NH7b (GVHD 20/11, BE #80). request: BM đề nghị Owner xử lý (hàng giao sai phải chọn phụ tùng thực nhận);
 * damaged: Owner nhận hàng lỗi thành mã "<SKU>-M"; wrong: Owner nhận hàng giao sai thành phụ tùng thực nhận.
 * Owner từ chối đề nghị đang chờ ngay trong hộp này.
 */
export default function AcceptanceDialog({
  row,
  mode,
  onClose,
  onSaved,
}: {
  row: Case
  mode: AcceptanceMode
  onClose: () => void
  onSaved: (row: Case, message: string) => void
}) {
  const openTypes = acceptanceOpenTypes(row)
  const [type, setType] = useState<AcceptanceType>(
    mode === 'damaged'
      ? 'DAMAGED'
      : mode === 'wrong'
        ? 'WRONG_ITEM'
        : (openTypes[0] ?? 'DAMAGED'),
  )
  const pending = row.pendingRequests?.find((item) => item.type === type)
  const heldOf = (value: AcceptanceType) =>
    value === 'DAMAGED' ? row.damagedUndecidedQty : row.wrongUndecidedQty
  const held = heldOf(type)
  const [quantity, setQuantity] = useState(String(pending?.quantity ?? held))
  const [note, setNote] = useState('')
  const [unitCost, setUnitCost] = useState('')
  const [salePrice, setSalePrice] = useState('')
  const [product, setProduct] = useState<ProductOption | undefined>(
    pending?.productId && pending.sku
      ? { id: pending.productId, sku: pending.sku, partName: pending.partName ?? '' }
      : undefined,
  )
  const [replacementNeeded, setReplacementNeeded] = useState(row.openReplacementQty > 0)
  const [manufactureDate, setManufactureDate] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const requesting = mode === 'request'
  const productId = useId()

  async function post(path: string, body: object, message: string) {
    setSaving(true)
    setError('')
    try {
      const { data } = await axiosClient.post<Case>(
        '/discrepancy-cases/' + row.id + path,
        body,
      )
      onSaved(data, message)
    } catch (failure) {
      setError(errorMessage(failure))
    } finally {
      setSaving(false)
    }
  }

  function submit() {
    if (saving) return
    const value = Number(quantity)
    if (!Number.isInteger(value) || value < 1 || value > held) {
      setError(`Số lượng phải là số nguyên từ 1 đến ${held}.`)
      return
    }
    if (requesting) {
      if (type === 'WRONG_ITEM' && !product) {
        setError('Vui lòng chọn phụ tùng thực nhận của hàng giao sai.')
        return
      }
      void post(
        '/acceptance-requests',
        {
          type,
          productId: type === 'WRONG_ITEM' && product ? product.id : null,
          quantity: value,
          note: note.trim() || null,
        },
        'Đã gửi đề nghị. Owner sẽ được báo để duyệt.',
      )
      return
    }
    if (unitCost === '') {
      setError('Vui lòng nhập giá vốn.')
      return
    }
    if (mode === 'damaged') {
      if (!salePrice || Number(salePrice) <= 0) {
        setError('Vui lòng nhập giá bán hàng lỗi lớn hơn 0.')
        return
      }
      void post(
        '/damaged/accept-as-variant',
        { quantity: value, unitCost: Number(unitCost), salePrice: Number(salePrice) },
        `Đã nhận ${value} hàng lỗi vào mã ${row.sku}-M.`,
      )
      return
    }
    if (!product) {
      setError('Vui lòng chọn phụ tùng thực nhận.')
      return
    }
    if (manufactureDate && expiryDate && manufactureDate > expiryDate) {
      setError('Hạn sử dụng phải sau ngày sản xuất.')
      return
    }
    // Số lô do hệ thống sinh, không nhập tay.
    void post(
      '/wrong-items/receive',
      {
        productId: product.id,
        quantity: value,
        unitCost: Number(unitCost),
        replacementNeeded,
        manufactureDate: manufactureDate || null,
        expiryDate: expiryDate || null,
      },
      `Đã nhận ${value} hàng giao sai thành ${product.sku}.`,
    )
  }

  const title = requesting
    ? 'Đề nghị Owner xử lý hàng đang giữ'
    : mode === 'damaged'
      ? 'Nhận hàng lỗi vào kho'
      : 'Nhận hàng giao sai vào kho'
  return (
    <FormDialog
      title={title}
      formId="acceptance-action"
      submitLabel={requesting ? 'Gửi đề nghị' : 'Nhận vào kho'}
      busy={saving}
      className="sd-dialog"
      onClose={onClose}
    >
      <form
        id="acceptance-action"
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
      >
        <p className="sd-dialog-subtitle">
          {row.sku} · {row.partName}
        </p>
        <div className="sd-form">
          {requesting && (
            <ChoiceToggle<AcceptanceType>
              label="Loại hàng"
              value={type}
              disabled={saving}
              onChange={(value) => {
                setType(value)
                setQuantity(String(heldOf(value)))
              }}
              options={(['DAMAGED', 'WRONG_ITEM'] as const).map((value) => {
                const isPending = row.pendingRequests?.some((item) => item.type === value)
                return {
                  value,
                  label: acceptanceLabels[value],
                  hint: isPending ? 'Đang chờ Owner duyệt' : 'Đang giữ ' + heldOf(value),
                  disabled: !openTypes.includes(value),
                }
              })}
            />
          )}
          {!requesting && pending && (
            <section className="sd-request-block">
              <h3>Đề nghị của BM</h3>
              <p>
                {acceptanceLabels[pending.type]} · {pending.quantity}
                {pending.sku && ' · thực nhận ' + pending.sku}
                {pending.requestedByName && ' · ' + pending.requestedByName}
                {' · '}
                {formatDateTime(pending.requestedAt)}
              </p>
              {pending.note && <p>Ghi chú: {pending.note}</p>}
              <label className="sd-field">
                <span>Lý do từ chối</span>
                <textarea
                  value={rejectReason}
                  rows={2}
                  maxLength={255}
                  disabled={saving}
                  onChange={(event) => setRejectReason(event.target.value)}
                />
              </label>
              <button
                type="button"
                className="mf-btn mf-btn--sm mf-btn--danger"
                disabled={saving || !rejectReason.trim()}
                onClick={() =>
                  void post(
                    '/acceptance-requests/reject',
                    { type, reason: rejectReason.trim() },
                    'Đã từ chối đề nghị. BM sẽ được báo.',
                  )
                }
              >
                Từ chối đề nghị
              </button>
            </section>
          )}
          <div className="sd-form-grid">
            <label className="sd-field">
              <span>Số lượng (đang giữ {held})</span>
              <input
                type="number"
                min={1}
                max={held}
                required
                value={quantity}
                disabled={saving}
                onChange={(event) => setQuantity(event.target.value)}
              />
            </label>
            {!requesting && (
              <label className="sd-field">
                <span>Giá vốn</span>
                <MoneyInput
                  value={unitCost}
                  required
                  disabled={saving}
                  onValueChange={setUnitCost}
                />
              </label>
            )}
            {mode === 'damaged' && (
              <label className="sd-field">
                <span>Giá bán</span>
                <MoneyInput
                  value={salePrice}
                  required
                  disabled={saving}
                  onValueChange={setSalePrice}
                />
              </label>
            )}
          </div>
          {type === 'WRONG_ITEM' && (
            <div className="sd-field">
              <label htmlFor={productId} className="sd-field-label">
                Phụ tùng thực nhận *
              </label>
              <ProductPicker
                id={productId}
                label="Phụ tùng thực nhận"
                selected={product}
                excludedIds={[row.productId]}
                excludeDamagedVariants
                disabled={saving}
                onSelect={setProduct}
              />
            </div>
          )}
          {mode === 'damaged' && (
            <p className="sd-callout">
              Sẽ tạo hoặc dùng mã <strong>{row.sku}-M</strong> (hàng lỗi), để ở Khu hàng lỗi.
            </p>
          )}
          {mode === 'wrong' && (
            <>
              <div className="sd-form-grid">
                <label className="sd-field">
                  <span>Ngày sản xuất</span>
                  <input
                    type="date"
                    value={manufactureDate}
                    max={expiryDate || undefined}
                    disabled={saving}
                    onChange={(event) => setManufactureDate(event.target.value)}
                  />
                </label>
                <label className="sd-field">
                  <span>Hạn sử dụng</span>
                  <input
                    type="date"
                    value={expiryDate}
                    min={manufactureDate || undefined}
                    disabled={saving}
                    onChange={(event) => setExpiryDate(event.target.value)}
                  />
                </label>
              </div>
              {row.openReplacementQty > 0 && (
                <label className="sd-check">
                  <input
                    type="checkbox"
                    checked={replacementNeeded}
                    disabled={saving}
                    onChange={(event) => setReplacementNeeded(event.target.checked)}
                  />
                  Vẫn cần nhà cung cấp giao bù phụ tùng đã đặt
                </label>
              )}
            </>
          )}
          {requesting && (
            <label className="sd-field">
              <span>Ghi chú</span>
              <textarea
                value={note}
                rows={2}
                maxLength={255}
                placeholder="Không bắt buộc"
                disabled={saving}
                onChange={(event) => setNote(event.target.value)}
              />
            </label>
          )}
        </div>
        {error && <p role="alert" className="sd-error">{error}</p>}
      </form>
    </FormDialog>
  )
}
