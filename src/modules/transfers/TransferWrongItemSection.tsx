/**
 * File: modules/transfers/TransferWrongItemSection.tsx
 * Loại: THÀNH PHẦN — phần "Hàng giao sai" trên chi tiết lệnh điều chuyển.
 * Công dụng: PM 23/11 (plan bản 2), GVHD 24/11 (phần C). Giao sai = giao nhầm mặt hàng khác mặt hàng yêu cầu, không
 * tính là thiếu. Với mỗi dòng có hàng giao sai, BM kho nhận chọn một trong hai (có thể chia):
 * - "Nhập kho (lập phiếu nhận)": phụ tùng thực nhận, số lượng, ảnh (PM 25/11, R-04: không điền HSD; kho gửi trừ lô
 *   nhập trước). Tồn chưa đổi cho tới khi BM kho gửi xác nhận;
 *   kho gửi cũng có thể từ chối (ghi lý do), khi đó số hàng đó quay lại "chưa xử lý".
 * - "Hoàn trả": trả lại kho gửi, không đổi tồn (hàng chưa rời sổ kho gửi).
 * Owner chỉ xem; thấy kho nhận ghi sai thì dùng "Bên nhận kiểm sai" ở bảng Sai lệch.
 */
import { useState } from 'react'
import axiosClient from '../../shared/api/axiosClient'
import { uploadAttachment } from '../../shared/api/upload'
import ConfirmDialog from '../../shared/ui/ConfirmDialog'
import FieldError from '../../shared/ui/FieldError'
import InfoTip from '../../shared/ui/InfoTip'
import LocalizedFileInput from '../../shared/ui/LocalizedFileInput'
import ProductPicker, { type ProductOption } from '../receiving/ProductPicker'
import DebtEvidence from '../receivables/DebtEvidence'
import { inventoryError } from '../inventory/api'
import TransferAction from './TransferAction'
import type { PartLine, Transfer } from './types'
import { partLabel } from './transferRules'
import './transfers.css'

const day = (value?: string | null) =>
  value ? value.split('-').reverse().join('/') : null

type WrongItemEvent = Transfer['discrepancies'][number]['events'][number] & {
  productId: number
}
const statusLabels: Record<string, string> = {
  AWAITING_SOURCE: 'Chờ kho gửi xác nhận',
  CONFIRMED: 'Kho gửi đã xác nhận, đã nhập kho',
  REJECTED: 'Kho gửi từ chối',
  CANCELLED: 'Đã hủy (bên nhận kiểm sai)',
}
// Review 25/11 (R-14): hoàn trả cũng chờ kho gửi xác nhận đã nhận lại hoặc từ chối; tồn không đổi.
const returnStatusLabels: Record<string, string> = {
  ...statusLabels,
  CONFIRMED: 'Kho gửi đã xác nhận nhận lại',
}
const isHandBack = (event: { resolutionType: string }) =>
  event.resolutionType === 'WRONG_ITEM_RETURNED'

/** Ảnh người dùng chọn trong ô {@code name}, tải lên trước khi gửi (tối đa 10). */
async function uploadedPhotos(form: HTMLFormElement, name: string) {
  const files = new FormData(form)
    .getAll(name)
    .filter((file): file is File => file instanceof File && file.size > 0)
  if (files.length > 10) throw new Error('Chọn tối đa 10 ảnh.')
  const uploaded = []
  for (const file of files) uploaded.push(await uploadAttachment(file))
  return uploaded
}

function QuantityField({
  label,
  value,
  onChange,
  error,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  error: string
}) {
  return (
    <label>
      Số lượng
      <input
        inputMode="numeric"
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, ''))}
      />
      <FieldError message={error} />
    </label>
  )
}

function WrongItemDialog({
  order,
  line,
  onClose,
  onSaved,
}: {
  order: Transfer
  line: PartLine
  onClose: () => void
  onSaved: (message: string) => void
}) {
  const pending = line.wrongPendingQty ?? 0
  const [product, setProduct] = useState<ProductOption>()
  const [quantity, setQuantity] = useState(String(pending))
  const [reason, setReason] = useState('')
  const qty = Number(quantity)
  const qtyError =
    !Number.isInteger(qty) || qty < 1 || qty > pending
      ? 'Số lượng từ 1 đến ' + pending + '.'
      : ''
  return (
    <TransferAction
      title={'Nhập kho hàng giao sai · ' + line.sku}
      path={'/transfer-orders/' + order.id + '/wrong-items'}
      disabled={!!qtyError || !product}
      payload={async (form) => ({
        productId: line.productId,
        receivedProductId: product!.id,
        quantity: qty,
        reason: reason.trim() || null,
        files: await uploadedPhotos(form, 'wrongItemPhotos'),
      })}
      onClose={onClose}
      onSaved={() =>
        onSaved(
          'Đã lập phiếu nhận hàng giao sai: ' +
            qty +
            ' ' +
            product!.sku +
            // Test 23/11 T-08: Y có thể giao kèm chứ không thay X, nên không ghi 'thay cho'.
            ' giao sai ở dòng ' +
            line.sku +
            '. Tồn chưa đổi, chờ ' +
            order.sourceStoreName +
            ' xác nhận.',
        )
      }
    >
      <p className="tf-note">
        Mặt hàng đặt: {line.sku} · {line.partName}. Còn {pending} hàng giao sai
        chưa xử lý.
      </p>
      <ProductPicker
        id={'wrong-product-' + line.productId}
        label="Mặt hàng thực nhận"
        selected={product}
        excludedIds={[line.productId]}
        excludeDamagedVariants
        disabled={false}
        onSelect={setProduct}
      />
      <QuantityField
        label="Số lượng giao sai"
        value={quantity}
        onChange={setQuantity}
        error={qtyError}
      />
      <label>
        Ghi chú
        <input
          maxLength={255}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </label>
      <div>
        <span>Ảnh hàng giao sai (không bắt buộc)</span>
        <LocalizedFileInput
          name="wrongItemPhotos"
          aria-label="Ảnh hàng giao sai"
          accept="image/jpeg,image/png,image/webp"
          multiple
        />
      </div>
      <p className="tf-wrong-item-hint">
        Tồn chưa đổi. Khi {order.sourceStoreName} xác nhận: cộng vào{' '}
        {order.destStoreName}, trừ ở {order.sourceStoreName}.
      </p>
    </TransferAction>
  )
}

function ReturnDialog({
  order,
  line,
  onClose,
  onSaved,
}: {
  order: Transfer
  line: PartLine
  onClose: () => void
  onSaved: (message: string) => void
}) {
  const pending = line.wrongPendingQty ?? 0
  const [product, setProduct] = useState<ProductOption>()
  const [quantity, setQuantity] = useState(String(pending))
  const [note, setNote] = useState('')
  const qty = Number(quantity)
  const qtyError =
    !Number.isInteger(qty) || qty < 1 || qty > pending
      ? 'Số lượng từ 1 đến ' + pending + '.'
      : ''
  return (
    <TransferAction
      title={'Hoàn trả hàng giao sai · ' + line.sku}
      path={'/transfer-orders/' + order.id + '/wrong-items/returns'}
      disabled={!!qtyError || !product}
      payload={() => ({
        productId: line.productId,
        receivedProductId: product!.id,
        quantity: qty,
        note: note.trim() || null,
      })}
      onClose={onClose}
      onSaved={() =>
        onSaved(
          'Đã ghi hoàn trả ' +
            qty +
            ' ' +
            product!.sku +
            ' về ' +
            order.sourceStoreName +
            '. Tồn hai kho không đổi.',
        )
      }
    >
      <p className="tf-note">
        Mặt hàng đặt: {line.sku} · {line.partName}. Còn {pending} hàng giao sai
        chưa xử lý.
      </p>
      <ProductPicker
        id={'return-product-' + line.productId}
        label="Mặt hàng thực nhận (trả lại)"
        selected={product}
        excludedIds={[line.productId]}
        excludeDamagedVariants
        disabled={false}
        onSelect={setProduct}
      />
      <QuantityField
        label="Số lượng hoàn trả"
        value={quantity}
        onChange={setQuantity}
        error={qtyError}
      />
      <label>
        Ghi chú
        <input
          maxLength={255}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </label>
      <p className="tf-wrong-item-hint">
        Hàng trả lại chưa từng rời sổ {order.sourceStoreName}, nên tồn hai kho
        không đổi.
      </p>
    </TransferAction>
  )
}

function RejectDialog({
  order,
  event,
  onClose,
  onSaved,
}: {
  order: Transfer
  event: WrongItemEvent
  onClose: () => void
  onSaved: (message: string) => void
}) {
  const [reason, setReason] = useState('')
  return (
    <TransferAction
      title={
        isHandBack(event)
          ? 'Từ chối việc hoàn trả hàng giao sai'
          : 'Từ chối phiếu nhận hàng giao sai'
      }
      path={
        '/transfer-orders/' + order.id + '/wrong-items/' + event.id + '/reject'
      }
      disabled={!reason.trim()}
      payload={() => ({ reason: reason.trim() })}
      onClose={onClose}
      onSaved={() =>
        onSaved(
          (isHandBack(event)
            ? 'Đã từ chối việc hoàn trả '
            : 'Đã từ chối phiếu nhận ') +
            event.quantity +
            ' ' +
            (event.receivedSku ?? 'phụ tùng giao sai') +
            '. ' +
            order.destStoreName +
            ' được báo để lập lại hoặc hoàn trả.',
        )
      }
    >
      <p className="tf-note">
        {event.quantity} ×{' '}
        {partLabel(event.receivedSku, event.receivedPartName)}. Tồn không đổi.
      </p>
      <label>
        Lý do từ chối
        <textarea
          maxLength={255}
          value={reason}
          onChange={(change) => setReason(change.target.value)}
        />
        <FieldError
          message={reason.trim() ? '' : 'Vui lòng nhập lý do từ chối.'}
        />
      </label>
    </TransferAction>
  )
}

export default function TransferWrongItemSection({
  order,
  canRecord,
  canReturn = false,
  canConfirm = false,
  onDone,
}: {
  order: Transfer
  /** BM kho nhận hoặc Owner, khi lệnh đang đối soát. */
  canRecord: boolean
  /** GVHD 24/11: BM kho nhận ghi hoàn trả. */
  canReturn?: boolean
  /** GVHD 24/11: BM kho gửi xác nhận hoặc từ chối phiếu; Owner chỉ xem. */
  canConfirm?: boolean
  onDone: (message: string) => void
}) {
  const [open, setOpen] = useState<PartLine>()
  const [returning, setReturning] = useState<PartLine>()
  const [asking, setAsking] = useState<WrongItemEvent>()
  const [rejecting, setRejecting] = useState<WrongItemEvent>()
  const [confirmError, setConfirmError] = useState('')
  const lines = order.lines.filter((line) => (line.wrongItemQty ?? 0) > 0)
  const events = order.discrepancies.flatMap((item) =>
    item.events
      .filter(
        (event) =>
          event.resolutionType === 'RECEIVED_AS_OTHER_PRODUCT' ||
          event.resolutionType === 'WRONG_ITEM_RETURNED',
      )
      .map((event) => ({ ...event, productId: item.productId })),
  )
  if (!lines.length) return null
  const done = (message: string) => {
    setOpen(undefined)
    setReturning(undefined)
    setRejecting(undefined)
    onDone(message)
  }
  async function confirm(event: WrongItemEvent) {
    setConfirmError('')
    try {
      await axiosClient.post(
        '/transfer-orders/' +
          order.id +
          '/wrong-items/' +
          event.id +
          '/confirm',
      )
      onDone(
        isHandBack(event)
          ? 'Đã xác nhận nhận lại ' +
              event.quantity +
              ' ' +
              (event.receivedSku ?? 'phụ tùng giao sai') +
              ' kho nhận hoàn trả. Tồn không đổi.'
          : 'Đã xác nhận: cộng ' +
              event.quantity +
              ' ' +
              (event.receivedSku ?? 'phụ tùng giao sai') +
              ' vào ' +
              order.destStoreName +
              ', trừ ' +
              event.quantity +
              ' ở ' +
              order.sourceStoreName +
              '.',
      )
    } catch (failure) {
      setConfirmError(inventoryError(failure))
    } finally {
      setAsking(undefined)
    }
  }
  return (
    <section className="tf-wrong-items">
      <h2>
        Hàng giao sai{' '}
        {/* PM 23/11 (UI-01): giải thích chuyển vào biểu tượng (i), bỏ đoạn mô tả. */}
        <InfoTip text="Giao sai là giao nhầm mặt hàng khác mặt hàng đặt, không tính là thiếu. Kho nhận chọn Nhập kho (lập phiếu nhận) hoặc Hoàn trả cho từng phần, kho gửi xác nhận hoặc từ chối; xử lý hết mới đóng phiếu được." />
      </h2>
      {lines.map((line) => (
        <article className="tf-wrong-item" key={line.productId}>
          <header>
            <strong>
              {line.sku} · {line.partName}
            </strong>
            <span>
              Giao sai {line.wrongItemQty}
              {(line.wrongPendingQty ?? 0) > 0 &&
                ' · Chưa xử lý ' + line.wrongPendingQty}
              {(line.wrongAwaitingSourceQty ?? 0) > 0 &&
                ' · Chờ kho gửi xác nhận ' + line.wrongAwaitingSourceQty}
              {(line.wrongConfirmedQty ?? 0) > 0 &&
                ' · Đã nhập kho ' + line.wrongConfirmedQty}
              {(line.wrongReturnedQty ?? 0) > 0 &&
                ' · Đã hoàn trả ' + line.wrongReturnedQty}
            </span>
          </header>
          {events
            .filter((event) => event.productId === line.productId)
            .map((event) => (
              <div className="tf-wrong-item-hint" key={event.id}>
                <p>
                  {event.resolutionType === 'WRONG_ITEM_RETURNED'
                    ? 'Hoàn trả: '
                    : 'Nhập kho: '}
                  {event.quantity} × {event.receivedSku ?? 'phụ tùng khác'}
                  {event.receivedPartName ? ' · ' + event.receivedPartName : ''}
                  {event.receivedExpiryDate
                    ? ' · HSD ' + day(event.receivedExpiryDate)
                    : ''}
                  {event.status &&
                    ' · ' +
                      ((isHandBack(event) ? returnStatusLabels : statusLabels)[
                        event.status
                      ] ?? event.status)}
                  {event.status === 'REJECTED' && event.rejectionReason
                    ? ': ' + event.rejectionReason
                    : ''}
                  {event.recordedBy ? ' · ' + event.recordedBy.fullName : ''}
                  {event.reason ? ' · ' + event.reason : ''}
                </p>
                <DebtEvidence files={event.attachments} />
                {canConfirm && event.status === 'AWAITING_SOURCE' && (
                  <div className="mf-row-actions">
                    <button
                      type="button"
                      className="mf-btn mf-btn--sm mf-btn--primary"
                      onClick={() => setAsking(event)}
                    >
                      Xác nhận
                    </button>
                    <button
                      type="button"
                      className="mf-btn mf-btn--sm"
                      onClick={() => setRejecting(event)}
                    >
                      Từ chối
                    </button>
                  </div>
                )}
              </div>
            ))}
          {(line.wrongPendingQty ?? 0) > 0 && (canRecord || canReturn) && (
            <div className="mf-row-actions">
              {canRecord && (
                <button
                  type="button"
                  className="mf-btn mf-btn--sm mf-btn--primary"
                  onClick={() => setOpen(line)}
                >
                  Nhập kho (lập phiếu nhận)
                </button>
              )}
              {canReturn && (
                <button
                  type="button"
                  className="mf-btn mf-btn--sm"
                  onClick={() => setReturning(line)}
                >
                  Hoàn trả
                </button>
              )}
            </div>
          )}
        </article>
      ))}
      {confirmError && (
        <p role="alert" className="stock-error">
          {confirmError}
        </p>
      )}
      {asking && (
        <ConfirmDialog
          title={
            isHandBack(asking)
              ? 'Xác nhận đã nhận lại hàng hoàn trả'
              : 'Xác nhận hàng giao sai'
          }
          message={
            isHandBack(asking) ? (
              <p>
                {order.sourceStoreName} đã nhận lại {asking.quantity}{' '}
                {partLabel(asking.receivedSku, asking.receivedPartName)} từ{' '}
                {order.destStoreName}. Tồn không đổi.
              </p>
            ) : (
              <p>
                {/* GVHD 24/11 (C5): chỉ hai ý, cộng ở đâu và trừ ở đâu. */}
                Cộng {asking.quantity}{' '}
                {partLabel(asking.receivedSku, asking.receivedPartName)} vào{' '}
                {order.destStoreName}, trừ {asking.quantity} ở{' '}
                {order.sourceStoreName}. Thao tác không hoàn tác được.
              </p>
            )
          }
          onCancel={() => setAsking(undefined)}
          onConfirm={() => confirm(asking)}
        />
      )}
      {rejecting && (
        <RejectDialog
          order={order}
          event={rejecting}
          onClose={() => setRejecting(undefined)}
          onSaved={done}
        />
      )}
      {open && (
        <WrongItemDialog
          order={order}
          line={open}
          onClose={() => setOpen(undefined)}
          onSaved={done}
        />
      )}
      {returning && (
        <ReturnDialog
          order={order}
          line={returning}
          onClose={() => setReturning(undefined)}
          onSaved={done}
        />
      )}
    </section>
  )
}
