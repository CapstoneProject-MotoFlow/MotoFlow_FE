import { useEffect, useRef, useState } from 'react'
import axiosClient from '../../../shared/api/axiosClient'
import { uploadAttachment as uploadReceiptDocument } from '../../../shared/api/upload'
import { supplierResolutionLabels } from '../../../shared/labels/status'
import ConfirmDialog from '../../../shared/ui/ConfirmDialog'
import FormDialog from '../../../shared/ui/FormDialog'
import LocalizedFileInput from '../../../shared/ui/LocalizedFileInput'
import PhotoButton from '../../../shared/ui/PhotoButton'
import { formatDateTime } from '../../../shared/utils/format'
import { isImageFile } from '../../../shared/utils/imageFile'
import { returnKindOptions } from '../discrepancyRules'
import ChoiceToggle from './ChoiceToggle'
import {
  errorMessage,
  goodsKindLabels,
  type Case,
  type CaseEvent,
  type GoodsKind,
} from './types'

export type CaseActionMode = 'return' | 'waive' | 'history'

function useCaseDetail(id: number) {
  const [row, setRow] = useState<Case>()
  const [error, setError] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    void axiosClient
      .get<Case>('/discrepancy-cases/' + id, { signal: controller.signal })
      .then(({ data }) => {
        if (!controller.signal.aborted) setRow(data)
      })
      .catch((failure) => {
        if (!controller.signal.aborted) setError(errorMessage(failure))
      })
    return () => controller.abort()
  }, [id])
  return { row, error, setError }
}

/** Dòng thời gian xử lý: mới nhất ở trên, mỗi bước một dòng có người làm, loại hàng, số lượng, lý do và bằng chứng. */
export function CaseTimeline({ events }: { events?: CaseEvent[] }) {
  if (!events?.length) return <p className="sd-muted">Chưa có bước xử lý nào.</p>
  return (
    <ol className="sd-timeline">
      {[...events].reverse().map((event) => {
        const images = (event.evidence ?? [])
          .filter((file) => isImageFile(file.fileName) && !!file.downloadUrl)
          .map((file) => ({ src: file.downloadUrl! }))
        const files = (event.evidence ?? []).filter(
          (file) => !isImageFile(file.fileName) && file.downloadUrl,
        )
        return (
          <li key={event.id}>
            <div className="sd-timeline-head">
              <strong>{supplierResolutionLabels[event.type] ?? 'Bước xử lý khác'}</strong>
              <span className="sd-qty">{event.quantity}</span>
            </div>
            <div className="sd-timeline-meta">
              <time>{formatDateTime(event.occurredAt)}</time>
              <span>{event.recordedByName ?? 'Hệ thống'}</span>
              {event.goodsKind && <span>{goodsKindLabels[event.goodsKind]}</span>}
            </div>
            {event.reason && <p className="sd-timeline-note">{event.reason}</p>}
            {(images.length > 0 || files.length > 0) && (
              <div className="sd-timeline-files">
                {images.length > 0 && (
                  <PhotoButton label={'Xem ' + images.length + ' ảnh'} images={images} />
                )}
                {files.map((file, index) => (
                  <a key={file.id} href={file.downloadUrl!} target="_blank" rel="noreferrer">
                    Mở tệp {index + 1}
                  </a>
                ))}
              </div>
            )}
          </li>
        )
      })}
    </ol>
  )
}

export default function CaseActionDialog({
  selected,
  mode,
  onClose,
  onSaved,
}: {
  selected: Case
  mode: CaseActionMode
  onClose: () => void
  onSaved: (row: Case) => void
}) {
  const { row, error, setError } = useCaseDetail(selected.id)
  const [saving, setSaving] = useState(false)
  const [picked, setPicked] = useState<GoodsKind>()
  const uploads = useRef(
    new WeakMap<File, Awaited<ReturnType<typeof uploadReceiptDocument>>>(),
  )
  const title = selected.sku + ' · ' + selected.partName

  if (mode === 'history')
    return (
      <FormDialog
        title={'Lịch sử xử lý · ' + selected.sku}
        formId="case-history"
        submitLabel="Đóng"
        hideSubmit
        closeLabel="Đóng"
        className="sd-dialog"
        onClose={onClose}
      >
        <form id="case-history" onSubmit={(event) => event.preventDefault()}>
          <p className="sd-dialog-subtitle">{title}</p>
          {!row && !error && <p role="status">Đang tải lịch sử…</p>}
          {error && <p role="alert" className="sd-error">{error}</p>}
          {row && <CaseTimeline events={row.events} />}
        </form>
      </FormDialog>
    )

  // Mục 14 (PM 19/11): "Không cần giao bù" chỉ hỏi xác nhận lần 2, không bắt nhập số lượng và lý do.
  // BE vẫn cần lý do nên FE gửi câu cố định và toàn bộ số còn phải giao bù.
  if (mode === 'waive') {
    const quantity = row?.openReplacementQty ?? selected.openReplacementQty
    return (
      <ConfirmDialog
        title="Không cần nhà cung cấp giao bù?"
        message={
          <>
            <p>
              Nhà cung cấp sẽ không phải giao bù <strong>{quantity}</strong>{' '}
              {selected.partName} ({selected.sku}).
            </p>
            {error && <p role="alert">{error}</p>}
          </>
        }
        onCancel={onClose}
        onConfirm={async () => {
          setError('')
          try {
            const { data } = await axiosClient.post<Case>(
              '/discrepancy-cases/' + selected.id + '/waive-replacement',
              {
                quantity,
                reason: 'Chủ cửa hàng xác nhận không cần nhà cung cấp giao bù.',
              },
            )
            onSaved(data)
          } catch (failure) {
            setError(errorMessage(failure))
          }
        }}
      />
    )
  }

  // Ghi nhận đã trả: chọn loại hàng đã trả (chỉ các loại còn phải trả), số lượng không quá phần còn phải trả của loại đó.
  const allowed = !!row?.canRecordReturn
  const options = row ? returnKindOptions(row) : []
  const active = options.find((option) => option.kind === picked) ?? options[0]
  return (
    <FormDialog
      title="Ghi nhận đã trả nhà cung cấp"
      formId="case-return"
      submitLabel={saving ? 'Đang lưu…' : 'Ghi nhận đã trả'}
      busy={saving}
      submitDisabled={!allowed || !active}
      className="sd-dialog"
      onClose={onClose}
    >
      <form
        id="case-return"
        onSubmit={async (event) => {
          event.preventDefault()
          if (!allowed || saving || !row || !active) return
          const fields = new FormData(event.currentTarget)
          const quantity = Number(fields.get('quantity'))
          if (
            !Number.isInteger(quantity) ||
            quantity < 1 ||
            quantity > active.outstanding
          ) {
            setError(`Số lượng từ 1 đến ${active.outstanding}.`)
            return
          }
          setSaving(true)
          setError('')
          try {
            const files = fields
              .getAll('evidence')
              .filter((value): value is File => value instanceof File && value.size > 0)
            if (!files.length || files.length > 10)
              throw new Error('Chọn từ 1 đến 10 ảnh hoặc tệp bằng chứng trả hàng.')
            const evidence = []
            for (const file of files) {
              const document =
                uploads.current.get(file) ?? (await uploadReceiptDocument(file))
              uploads.current.set(file, document)
              evidence.push(document)
            }
            const { data } = await axiosClient.post<Case>(
              '/discrepancy-cases/' + row.id + '/supplier-returns',
              {
                quantity,
                note: String(fields.get('note') ?? '').trim() || null,
                evidence,
                goodsKind: active.kind,
              },
            )
            onSaved(data)
          } catch (failure) {
            setError(errorMessage(failure))
          } finally {
            setSaving(false)
          }
        }}
      >
        <p className="sd-dialog-subtitle">{title}</p>
        {!row && !error && <p role="status">Đang tải hồ sơ…</p>}
        {row && (
          <div className="sd-form">
            {!allowed && (
              <p className="sd-error">Hồ sơ này hiện không cho ghi nhận trả hàng.</p>
            )}
            <div className="sd-dialog-facts">
              <span>
                Còn phải trả <b>{row.outstandingReturnQty}</b>
              </span>
              <span>
                Đã trả <b>{row.returnedQty}</b>
              </span>
            </div>
            {active ? (
              <>
                <ChoiceToggle<GoodsKind>
                  label="Loại hàng đã trả"
                  value={active.kind}
                  disabled={!allowed || saving}
                  onChange={setPicked}
                  options={options.map((option) => ({
                    value: option.kind,
                    label: goodsKindLabels[option.kind],
                    hint: 'Còn trả ' + option.outstanding,
                  }))}
                />
                <label className="sd-field">
                  <span>Số lượng giao nhà cung cấp lần này</span>
                  <input
                    key={active.kind}
                    name="quantity"
                    type="number"
                    required
                    min={1}
                    max={active.outstanding}
                    // Báo lỗi 20/11 (mục 4): điền sẵn số còn phải trả của loại đang chọn; vẫn sửa được nếu trả làm nhiều lần.
                    defaultValue={active.outstanding}
                    disabled={!allowed || saving}
                  />
                </label>
              </>
            ) : (
              <p className="sd-muted">Không còn hàng nào phải trả nhà cung cấp.</p>
            )}
            <div className="sd-field">
              <span>Ảnh hoặc biên bản trả hàng (1–10 tệp)</span>
              <LocalizedFileInput
                name="evidence"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                multiple
                required
                disabled={!allowed || saving}
              />
            </div>
            <label className="sd-field">
              <span>Ghi chú</span>
              <textarea
                name="note"
                rows={2}
                maxLength={255}
                placeholder="Không bắt buộc"
                disabled={!allowed || saving}
              />
            </label>
          </div>
        )}
        {error && <p role="alert" className="sd-error">{error}</p>}
      </form>
    </FormDialog>
  )
}
