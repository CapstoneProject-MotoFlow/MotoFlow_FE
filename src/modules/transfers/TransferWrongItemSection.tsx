/**
 * File: modules/transfers/TransferWrongItemSection.tsx
 * Loại: THÀNH PHẦN — phần "Hàng giao sai" trên chi tiết lệnh điều chuyển.
 * Công dụng: PM 23/11 (plan bản 2). Giao sai = giao nhầm mặt hàng khác mặt hàng yêu cầu, không tính là thiếu, luôn
 * được nhận. BM kho nhận (hoặc Owner) lập phiếu nhận hàng giao sai: phụ tùng thực nhận, số lượng, HSD (nếu có), như
 * hộp nhận hàng giao sai của NCC nhưng không có giá vốn và giao bù. Tồn chưa đổi cho tới khi Owner xác nhận; Owner
 * không từ chối (thấy kho nhận ghi sai thì dùng "Bên nhận kiểm sai" ở bảng Sai lệch).
 */
import { useState } from 'react'
import axiosClient from '../../shared/api/axiosClient'
import ConfirmDialog from '../../shared/ui/ConfirmDialog'
import FieldError from '../../shared/ui/FieldError'
import InfoTip from '../../shared/ui/InfoTip'
import ProductPicker, { type ProductOption } from '../receiving/ProductPicker'
import { inventoryError } from '../inventory/api'
import TransferAction from './TransferAction'
import type { PartLine, Transfer } from './types'
import './transfers.css'

const day = (value?: string | null) =>
  value ? value.split('-').reverse().join('/') : null

type WrongItemEvent = Transfer['discrepancies'][number]['events'][number] & {
  productId: number
}
const statusLabels: Record<string, string> = {
  AWAITING_OWNER: 'Chờ Owner xác nhận',
  CONFIRMED: 'Owner đã xác nhận',
  CANCELLED: 'Đã hủy (bên nhận kiểm sai)',
}

function WrongItemDialog({
  orderId,
  line,
  onClose,
  onSaved,
}: {
  orderId: number
  line: PartLine
  onClose: () => void
  onSaved: (message: string) => void
}) {
  const pending = line.wrongPendingQty ?? 0
  const [product, setProduct] = useState<ProductOption>()
  const [quantity, setQuantity] = useState(String(pending))
  const [expiry, setExpiry] = useState('')
  const [reason, setReason] = useState('')
  const qty = Number(quantity)
  const qtyError =
    !Number.isInteger(qty) || qty < 1 || qty > pending
      ? 'Số lượng từ 1 đến ' + pending + '.'
      : ''
  return (
    <TransferAction
      title={'Phiếu nhận hàng giao sai · ' + line.sku}
      path={'/transfer-orders/' + orderId + '/wrong-items'}
      disabled={!!qtyError || !product}
      payload={() => ({
        productId: line.productId,
        receivedProductId: product!.id,
        quantity: qty,
        expiryDate: expiry || null,
        reason: reason.trim() || null,
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
            '. Tồn chưa đổi, chờ Owner xác nhận.',
        )
      }
    >
      <p className="tf-note">
        Phụ tùng yêu cầu: {line.sku} · {line.partName}. Còn {pending} hàng giao
        sai chưa lập phiếu.
      </p>
      <ProductPicker
        id={'wrong-product-' + line.productId}
        label="Phụ tùng thực nhận"
        selected={product}
        excludedIds={[line.productId]}
        excludeDamagedVariants
        disabled={false}
        onSelect={setProduct}
      />
      <label>
        Số lượng
        <input
          inputMode="numeric"
          aria-label="Số lượng giao sai"
          value={quantity}
          onChange={(event) =>
            setQuantity(event.target.value.replace(/\D/g, ''))
          }
        />
        <FieldError message={qtyError} />
      </label>
      <label>
        Hạn sử dụng (nếu có)
        <input
          type="date"
          value={expiry}
          onChange={(event) => setExpiry(event.target.value)}
        />
      </label>
      <label>
        Ghi chú
        <input
          maxLength={255}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </label>
      <p className="tf-wrong-item-hint">
        Tồn chưa đổi. Khi Owner xác nhận: kho gửi trừ phụ tùng thực nhận (lô
        cùng hạn sử dụng đã ghi, không ghi thì lô nhập trước), kho nhận cộng phụ
        tùng đó; phụ tùng yêu cầu không đổi.
      </p>
    </TransferAction>
  )
}

export default function TransferWrongItemSection({
  order,
  canRecord,
  canConfirm = false,
  onDone,
}: {
  order: Transfer
  /** BM kho nhận hoặc Owner, khi lệnh đang đối soát. */
  canRecord: boolean
  /** Test 23/11 T-04: Owner xác nhận phiếu giao sai ngay trên trang lệnh. */
  canConfirm?: boolean
  onDone: (message: string) => void
}) {
  const [open, setOpen] = useState<PartLine>()
  const [asking, setAsking] = useState<WrongItemEvent>()
  const [confirmError, setConfirmError] = useState('')
  const lines = order.lines.filter((line) => (line.wrongItemQty ?? 0) > 0)
  const receipts = order.discrepancies.flatMap((item) =>
    item.events
      .filter((event) => event.resolutionType === 'RECEIVED_AS_OTHER_PRODUCT')
      .map((event) => ({ ...event, productId: item.productId })),
  )
  if (!lines.length) return null
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
        'Đã xác nhận ' +
          event.quantity +
          ' ' +
          (event.receivedSku ?? 'phụ tùng giao sai') +
          ': tồn kho gửi và kho nhận đã cập nhật.',
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
        <InfoTip text="Giao sai là giao nhầm mặt hàng khác mặt hàng yêu cầu, không tính là thiếu và luôn được nhận. Lập phiếu nhận hàng giao sai cho từng phụ tùng; Owner xác nhận rồi mới đóng phiếu được." />
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
                ' · Chưa lập phiếu ' + line.wrongPendingQty}
              {(line.wrongAwaitingOwnerQty ?? 0) > 0 &&
                ' · Chờ Owner xác nhận ' + line.wrongAwaitingOwnerQty}
            </span>
          </header>
          {receipts
            .filter((event) => event.productId === line.productId)
            .map((event) => (
              <p className="tf-wrong-item-hint" key={event.id}>
                {event.quantity} × {event.receivedSku ?? 'phụ tùng khác'}
                {event.receivedPartName ? ' · ' + event.receivedPartName : ''}
                {event.receivedExpiryDate
                  ? ' · HSD ' + day(event.receivedExpiryDate)
                  : ''}
                {' · '}
                {statusLabels[event.status ?? ''] ??
                  (event.confirmedAt
                    ? 'Owner đã xác nhận'
                    : 'Chờ Owner xác nhận')}
                {event.recordedBy ? ' · ' + event.recordedBy.fullName : ''}
                {canConfirm && event.status === 'AWAITING_OWNER' && (
                  <button
                    type="button"
                    className="mf-btn mf-btn--sm mf-btn--primary tf-wrong-item-confirm"
                    onClick={() => setAsking(event)}
                  >
                    Xác nhận
                  </button>
                )}
              </p>
            ))}
          {canRecord && (line.wrongPendingQty ?? 0) > 0 && (
            <div className="mf-row-actions">
              <button
                type="button"
                className="mf-btn mf-btn--sm mf-btn--primary"
                onClick={() => setOpen(line)}
              >
                Lập phiếu nhận hàng giao sai
              </button>
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
          title="Xác nhận hàng giao sai"
          message={
            <p>
              {order.sourceStoreName} trừ {asking.quantity} {asking.receivedSku}{' '}
              (lô cùng HSD bên nhận ghi, không ghi thì lô nhập trước),{' '}
              {order.destStoreName} cộng {asking.quantity} {asking.receivedSku}.
              Phụ tùng yêu cầu không đổi. Thao tác không hoàn tác được.
            </p>
          }
          onCancel={() => setAsking(undefined)}
          onConfirm={() => confirm(asking)}
        />
      )}
      {open && (
        <WrongItemDialog
          orderId={order.id}
          line={open}
          onClose={() => setOpen(undefined)}
          onSaved={(message) => {
            setOpen(undefined)
            onDone(message)
          }}
        />
      )}
    </section>
  )
}
