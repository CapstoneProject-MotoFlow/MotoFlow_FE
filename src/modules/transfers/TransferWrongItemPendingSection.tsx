/**
 * File: modules/transfers/TransferWrongItemPendingSection.tsx
 * Loại: THÀNH PHẦN — hộp "Chờ xác nhận hàng giao sai" (BM kho gửi, trang Lệnh điều chuyển) và phần xem của Owner
 * (màn "Chờ duyệt hàng thừa").
 * Công dụng: GVHD 24/11 (phần C). BM kho nhận đã lập phiếu nhận hàng giao sai (phụ tùng thực nhận Y, ảnh), tồn chưa
 * đổi. BM kho gửi xác nhận: Y trừ ở tồn khả dụng kho gửi (lô cùng HSD bên nhận ghi; không ghi HSD thì lô nhập trước),
 * cộng vào kho nhận. Hoặc từ chối kèm lý do. Kho gửi không đủ tồn khả dụng (không tính hàng đang giữ cho đơn bán) thì
 * BE báo MSG339, không có lô cùng HSD thì MSG341. Owner chỉ xem.
 * Review 25/11 (R-14): việc kho nhận hoàn trả hàng giao sai cũng nằm ở đây; BM kho gửi xác nhận đã nhận lại (tồn không
 * đổi) hoặc từ chối kèm lý do, khi đó số lượng quay về "chưa xử lý".
 */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import axiosClient from '../../shared/api/axiosClient'
import ConfirmDialog from '../../shared/ui/ConfirmDialog'
import { documentCode } from '../../shared/utils/documentCode'
import DebtEvidence from '../receivables/DebtEvidence'
import type { Evidence } from '../receivables/types'
import TransferAction from './TransferAction'
import { inventoryError } from '../inventory/api'
import { partLabel } from './transferRules'
import './transfers.css'

type PlannedLot = { lotId: number; expiryDate: string | null; quantity: number }
type PendingWrongItem = {
  eventId: number
  transferOrderId: number
  sourceStoreName: string
  destStoreName: string
  sku: string
  partName: string
  receivedSku: string
  receivedPartName: string
  quantity: number
  expiryDate: string | null
  reason: string | null
  recordedByName: string | null
  recordedAt: string
  sourceSellableQty: number
  lots: PlannedLot[]
  blockedCode: string | null
  attachments?: Evidence[]
  /** RECEIVED_AS_OTHER_PRODUCT: phiếu nhận; WRONG_ITEM_RETURNED: hoàn trả (không trừ lô). */
  resolutionType?: string
}

const day = (value: string | null) =>
  value ? value.split('-').reverse().join('/') : null

function blockedText(item: PendingWrongItem) {
  if (item.blockedCode === 'MSG339')
    return (
      'Kho gửi không đủ tồn khả dụng (không tính hàng đang giữ cho đơn bán): còn ' +
      item.sourceSellableQty +
      ', cần ' +
      item.quantity +
      '.'
    )
  if (item.blockedCode === 'MSG341')
    return 'Kho gửi không có lô cùng hạn sử dụng còn bán được; kiểm tra lại HSD kho nhận đã ghi.'
  return item.blockedCode ? 'Chưa xác nhận được phiếu này.' : ''
}

function PendingRow({
  item,
  canAct,
  onDone,
}: {
  item: PendingWrongItem
  canAct: boolean
  onDone: (message: string) => void
}) {
  const [busy, setBusy] = useState(false)
  const [asking, setAsking] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const handBack = item.resolutionType === 'WRONG_ITEM_RETURNED'
  const blocked = blockedText(item)
  const lotText = item.lots
    .map(
      (lot) =>
        documentCode('L', lot.lotId) +
        (lot.expiryDate ? ' (HSD ' + day(lot.expiryDate) + ')' : '') +
        ' × ' +
        lot.quantity,
    )
    .join(', ')
  async function confirm() {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      await axiosClient.post(
        '/transfer-orders/' +
          item.transferOrderId +
          '/wrong-items/' +
          item.eventId +
          '/confirm',
      )
      onDone(
        handBack
          ? 'Đã xác nhận nhận lại ' +
              item.quantity +
              ' ' +
              item.receivedSku +
              ' ' +
              item.destStoreName +
              ' hoàn trả. Tồn không đổi.'
          : 'Đã xác nhận: cộng ' +
              item.quantity +
              ' ' +
              item.receivedSku +
              ' vào ' +
              item.destStoreName +
              ', trừ ' +
              item.quantity +
              ' ở ' +
              item.sourceStoreName +
              '.',
      )
    } catch (failure) {
      setError(inventoryError(failure))
    } finally {
      setBusy(false)
      setAsking(false)
    }
  }
  return (
    <tr>
      <td data-label="Lệnh">
        <Link to={'/transfer-orders/' + item.transferOrderId}>
          {documentCode('DC', item.transferOrderId)}
        </Link>
        <small>
          {item.sourceStoreName} → {item.destStoreName}
        </small>
      </td>
      <td data-label="Phụ tùng yêu cầu" className="tf-part-cell">
        <strong>{item.sku}</strong>
        <small>{item.partName}</small>
      </td>
      <td data-label="Phụ tùng thực nhận" className="tf-part-cell">
        <div>
          <span
            className={
              handBack
                ? 'tf-kind-tag tf-kind-tag--return'
                : 'tf-kind-tag tf-kind-tag--receive'
            }
          >
            {handBack ? 'Hoàn trả' : 'Nhập kho'}
          </span>{' '}
          <strong>{item.receivedSku}</strong>
        </div>
        <small>{item.receivedPartName}</small>
        {item.reason && <small>{item.reason}</small>}
        {!!item.attachments?.length && (
          <div className="tf-pending-evidence">
            <DebtEvidence files={item.attachments} />
          </div>
        )}
      </td>
      <td data-label="Số lượng" className="tf-num">
        {item.quantity}
      </td>
      <td data-label="HSD bên nhận ghi">
        {handBack
          ? '—'
          : (day(item.expiryDate) ?? 'Không ghi (trừ lô nhập trước)')}
      </td>
      <td data-label="Lô kho gửi sẽ trừ">
        {handBack ? (
          'Không trừ lô (hàng chưa rời sổ)'
        ) : blocked ? (
          <span className="tf-excess-blocked">{blocked}</span>
        ) : (
          lotText || '—'
        )}
        {error && (
          <p role="alert" className="tf-alert-error">
            {error}
          </p>
        )}
      </td>
      <td data-label={canAct ? 'Xác nhận' : 'Trạng thái'}>
        {canAct ? (
          <div className="mf-row-actions">
            <button
              type="button"
              className="mf-btn mf-btn--sm mf-btn--primary"
              disabled={busy || !!blocked}
              onClick={() => setAsking(true)}
            >
              Xác nhận
            </button>
            <button
              type="button"
              className="mf-btn mf-btn--sm"
              disabled={busy}
              onClick={() => setRejecting(true)}
            >
              Từ chối
            </button>
          </div>
        ) : (
          <small>Chờ {item.sourceStoreName} xác nhận</small>
        )}
        {rejecting && (
          <TransferAction
            title={
              handBack
                ? 'Từ chối việc hoàn trả hàng giao sai'
                : 'Từ chối phiếu nhận hàng giao sai'
            }
            path={
              '/transfer-orders/' +
              item.transferOrderId +
              '/wrong-items/' +
              item.eventId +
              '/reject'
            }
            disabled={!reason.trim()}
            payload={() => ({ reason: reason.trim() })}
            onClose={() => setRejecting(false)}
            onSaved={() => {
              setRejecting(false)
              onDone(
                (handBack
                  ? 'Đã từ chối việc hoàn trả '
                  : 'Đã từ chối phiếu nhận ') +
                  item.quantity +
                  ' ' +
                  item.receivedSku +
                  '. ' +
                  item.destStoreName +
                  ' được báo để lập lại hoặc hoàn trả.',
              )
            }}
          >
            <label>
              Lý do từ chối
              <textarea
                maxLength={255}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </label>
          </TransferAction>
        )}
        {/* Test 23/11 T-09: xác nhận đổi tồn hai kho, phải hỏi lại trước khi gửi. */}
        {asking && (
          <ConfirmDialog
            title={
              handBack
                ? 'Xác nhận đã nhận lại hàng hoàn trả'
                : 'Xác nhận hàng giao sai'
            }
            message={
              handBack ? (
                <p>
                  {item.sourceStoreName} đã nhận lại {item.quantity}{' '}
                  {partLabel(item.receivedSku, item.receivedPartName)} từ{' '}
                  {item.destStoreName}. Tồn không đổi.
                </p>
              ) : (
                <p>
                  {/* GVHD 24/11 (C5): chỉ hai ý, cộng ở đâu và trừ ở đâu. */}
                  Cộng {item.quantity}{' '}
                  {partLabel(item.receivedSku, item.receivedPartName)} vào{' '}
                  {item.destStoreName}, trừ {item.quantity} ở{' '}
                  {item.sourceStoreName}
                  {lotText ? ' (' + lotText + ')' : ''}. Thao tác không hoàn tác
                  được.
                </p>
              )
            }
            onCancel={() => setAsking(false)}
            onConfirm={confirm}
          />
        )}
      </td>
    </tr>
  )
}

export default function TransferWrongItemPendingSection({
  canAct = false,
}: {
  /** BM kho gửi xác nhận hoặc từ chối; Owner chỉ xem (GVHD 24/11). */
  canAct?: boolean
}) {
  const [items, setItems] = useState<PendingWrongItem[]>()
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    axiosClient
      .get<PendingWrongItem[]>('/transfer-orders/wrong-items/pending', {
        params: { page: 0, size: 100 },
        signal: controller.signal,
      })
      .then(({ data }) => {
        setItems(data)
        setError('')
      })
      .catch((failure) => {
        if (!controller.signal.aborted) setError(inventoryError(failure))
      })
    return () => controller.abort()
  }, [revision])
  // BM kho gửi: hộp chỉ hiện khi có phiếu chờ mình (hoặc vừa xử lý xong một phiếu).
  if (canAct && items && !items.length && !notice && !error) return null
  return (
    <section className="receiving-panel tf-excess-section">
      <header className="receiving-panel-head">
        <h2>
          {canAct
            ? 'Chờ xác nhận hàng giao sai'
            : 'Hàng giao sai điều chuyển (chờ kho gửi xác nhận)'}
        </h2>
      </header>
      {!canAct && (
        <p className="tf-excess-hint">
          Tồn kho chỉ đổi khi quản lý kho gửi xác nhận. Nếu kho nhận ghi sai, mở lệnh và chọn &ldquo;Bên nhận kiểm sai&rdquo;.
        </p>
      )}
      {notice && (
        <p className="mf-success-notice" role="status">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="tf-alert-error">
          {error}
        </p>
      )}
      {items && !items.length && (
        <p className="receiving-empty-cell">
          Không có phiếu nhận hàng giao sai chờ xác nhận.
        </p>
      )}
      {!!items?.length && (
        <div className="tf-table tf-pending-wrong-table">
          <table>
            <thead>
              <tr>
                <th>Lệnh</th>
                <th>Phụ tùng yêu cầu</th>
                <th>Phụ tùng thực nhận</th>
                <th className="tf-num">SL</th>
                <th>HSD</th>
                <th>Lô kho gửi sẽ trừ</th>
                <th>{canAct ? 'Xác nhận' : 'Trạng thái'}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <PendingRow
                  key={item.eventId + ':' + revision}
                  item={item}
                  canAct={canAct}
                  onDone={(message) => {
                    setNotice(message)
                    setRevision((n) => n + 1)
                  }}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
