import { useState, type FormEvent } from 'react'
import axiosClient from '../../shared/api/axiosClient'
import { uploadAttachment } from '../../shared/api/upload'
import FormDialog from '../../shared/ui/FormDialog'
import LocalizedFileInput from '../../shared/ui/LocalizedFileInput'
import { inventoryError } from '../inventory/api'
import AdjustmentEffects from '../documents/AdjustmentEffects'
import type { AdjustmentDetail, AdjustmentEffects as Effects } from '../documents/types'

type LossLine = { productId: number; sku: string; quantity: number }

export default function TransitLossAction({
  transferOrderId,
  storeId,
  lines,
  onSaved,
  onClose,
}: {
  transferOrderId: number
  storeId: number
  lines: LossLine[]
  onSaved: () => void
  onClose: () => void
}) {
  const [selected, setSelected] = useState(() => new Set(lines.map((line) => line.productId)))
  const [quantities, setQuantities] = useState<Record<number, string>>(
    () => Object.fromEntries(lines.map((line) => [line.productId, String(line.quantity)])),
  )
  const [reason, setReason] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [preview, setPreview] = useState<Effects>()
  const [created, setCreated] = useState<AdjustmentDetail>()
  const [linked, setLinked] = useState<Set<number>>(() => new Set())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const chosen = lines.filter((line) => selected.has(line.productId))
  const valid = chosen.length > 0 && !!reason.trim() && chosen.every((line) => {
    const quantity = Number(quantities[line.productId])
    return Number.isSafeInteger(quantity) && quantity > 0 && quantity <= line.quantity
  })

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy || !valid) return
    setBusy(true)
    setError('')
    const payload = {
      storeId,
      transferOrderId,
      reason: reason.trim(),
      lines: chosen.map((line) => ({
        productId: line.productId,
        stockStatus: 'IN_TRANSIT',
        quantity: Number(quantities[line.productId]),
      })),
    }
    let createdNow: AdjustmentDetail | undefined
    try {
      if (!preview) {
        const { data } = await axiosClient.post<Effects>(
          '/adjustment-requests/stock-loss/preview',
          payload,
        )
        setPreview(data)
        return
      }
      let adjustmentId = created?.id
      if (!adjustmentId) {
        if (
          files.length === 0 ||
          files.length > 10 ||
          files.some(
            (file) =>
              !['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.type) ||
              !file.size ||
              file.size > 10 * 1024 * 1024 ||
              file.name.length > 255,
          )
        ) {
          setError('Chọn từ 1 đến 10 tệp JPG, PNG, WebP hoặc PDF, tối đa 10 MB mỗi tệp.')
          return
        }
        const attachments = []
        for (const file of files) attachments.push(await uploadAttachment(file))
        const { data } = await axiosClient.post<AdjustmentDetail>(
          '/adjustment-requests/stock-loss',
          { ...payload, attachments },
        )
        setCreated(data)
        createdNow = data
        adjustmentId = data.id
      }
      if (!adjustmentId) throw new Error('Không nhận được mã yêu cầu điều chỉnh.')
      for (const line of chosen) {
        if (linked.has(line.productId)) continue
        await axiosClient.post(`/transfer-orders/${transferOrderId}/discrepancy/decisions`, {
          productId: line.productId,
          decision: 'LOSS',
          quantity: Number(quantities[line.productId]),
          reason: reason.trim(),
          adjustmentRequestId: adjustmentId,
        })
        setLinked((current) => new Set(current).add(line.productId))
      }
      onSaved()
    } catch (failure) {
      const saved = created ?? createdNow
      setError(
        saved
          ? `Đã tạo đề nghị ${saved.number}, nhưng chưa liên kết hết sai lệch. ${inventoryError(failure)}`
          : inventoryError(failure),
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <FormDialog
      title="Báo mất hàng trên đường"
      formId="transit-loss-action"
      submitLabel={created ? 'Tiếp tục liên kết sai lệch' : preview ? 'Tạo đề nghị và liên kết' : 'Xem trước ảnh hưởng'}
      submitDisabled={!valid || (preview != null && files.length === 0)}
      busy={busy}
      className="tf-dialog"
      onClose={onClose}
    >
      <form id="transit-loss-action" className="tf-form" onSubmit={submit}>
        <p>Đề nghị ghi giảm lượng hàng đang điều chuyển. Khi tạo, hệ thống tự gắn đề nghị vào sai lệch của lệnh này.</p>
        <fieldset disabled={busy || !!created}>
          {lines.map((line) => (
            <div key={line.productId} className="tf-transit-loss-line">
              <label>
                <input
                  type="checkbox"
                  checked={selected.has(line.productId)}
                  onChange={(event) => {
                    setSelected((current) => {
                      const next = new Set(current)
                      if (event.target.checked) next.add(line.productId)
                      else next.delete(line.productId)
                      return next
                    })
                    setPreview(undefined)
                  }}
                />
                {line.sku} · còn thiếu {line.quantity}
              </label>
              <input
                aria-label={'Số lượng mất ' + line.sku}
                type="number"
                min="1"
                max={line.quantity}
                value={quantities[line.productId] ?? ''}
                disabled={!selected.has(line.productId)}
                onChange={(event) => {
                  setQuantities((current) => ({ ...current, [line.productId]: event.target.value }))
                  setPreview(undefined)
                }}
              />
            </div>
          ))}
          <label>
            Lý do
            <textarea required rows={3} maxLength={500} value={reason} onChange={(event) => { setReason(event.target.value); setPreview(undefined) }} />
          </label>
          {!created && (
            <label>
              Ảnh hoặc biên bản
              <LocalizedFileInput
                required={!!preview}
                multiple
                accept=".jpg,.jpeg,.png,.webp,.pdf"
                aria-label="Ảnh hoặc biên bản mất hàng trên đường"
                onChange={(event) => setFiles(Array.from(event.currentTarget.files ?? []))}
              />
            </label>
          )}
        </fieldset>
        {preview && <AdjustmentEffects data={preview} />}
        {created && <p role="status">Đã tạo đề nghị {created.number}. Đã gắn {linked.size}/{chosen.length} dòng sai lệch.</p>}
        {error && <p className="stock-error" role="alert">{error}</p>}
      </form>
    </FormDialog>
  )
}
