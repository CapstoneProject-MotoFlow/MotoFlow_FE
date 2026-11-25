/**
 * File: modules/transfers/TransferWrongItemPendingSection.tsx
 * Loại: THÀNH PHẦN — hộp "Chờ xác nhận hàng giao sai" (BM kho gửi, trang Lệnh điều chuyển) và phần xem của Owner
 * (màn "Chờ duyệt hàng thừa").
 * Công dụng: GVHD 24/11 (phần C). BM kho nhận đã lập phiếu nhận hàng giao sai (phụ tùng thực nhận Y, ảnh), tồn chưa
 * đổi. BM kho gửi xác nhận: Y trừ ở tồn khả dụng kho gửi (lô cùng HSD bên nhận ghi; không ghi HSD thì lô nhập trước),
 * cộng vào kho nhận. Hoặc từ chối kèm lý do. Kho gửi không đủ tồn khả dụng (không tính hàng đang giữ cho đơn bán) thì
 * BE báo MSG339, không có lô cùng HSD thì MSG341. Owner chỉ xem.
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
        'Đã xác nhận: cộng ' +
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
      <td>
        <Link to={'/transfer-orders/' + item.transferOrderId}>
          {documentCode('DC', item.transferOrderId)}
        </Link>
        <small>
          {item.sourceStoreName} → {item.destStoreName}
        </small>
      </td>
      <td>
        {item.sku} · {item.partName}
      </td>
      <td>
        {item.receivedSku} · {item.receivedPartName}
        {item.reason && <small>{item.reason}</small>}
        <DebtEvidence files={item.attachments} />
      </td>
      <td>{item.quantity}</td>
      <td>{day(item.expiryDate) ?? 'Không ghi (trừ lô nhập trước)'}</td>
      <td>
        {blocked ? (
          <span className="tf-excess-blocked">{blocked}</span>
        ) : (
          lotText || '—'
        )}
        {error && (
          <p role="alert" className="stock-error">
            {error}
          </p>
        )}
      </td>
      <td>
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
            title="Từ chối phiếu nhận hàng giao sai"
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
                'Đã từ chối phiếu nhận ' +
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
            title="Xác nhận hàng giao sai"
            message={
              <p>
                {/* GVHD 24/11 (C5): chỉ hai ý, cộng ở đâu và trừ ở đâu. */}
                Cộng {item.quantity}{' '}
                {partLabel(item.receivedSku, item.receivedPartName)} vào{' '}
                {item.destStoreName}, trừ {item.quantity} ở{' '}
                {item.sourceStoreName}
                {lotText ? ' (' + lotText + ')' : ''}. Thao tác không hoàn tác
                được.
              </p>
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
      <p className="tf-excess-hint">
        {canAct
          ? 'Kho nhận đã lập phiếu nhận hàng giao sai từ lệnh kho bạn gửi; tồn chưa đổi. Xác nhận: cộng vào kho nhận, trừ ở tồn khả dụng kho bạn (lô cùng hạn sử dụng bên nhận ghi, không ghi thì lô nhập trước). Không đúng thì Từ chối và ghi lý do.'
          : 'Kho nhận đã lập phiếu nhận hàng giao sai; tồn chưa đổi cho tới khi BM kho gửi xác nhận. Owner chỉ xem; thấy kho nhận ghi sai thì mở lệnh và dùng "Bên nhận kiểm sai" ở bảng Sai lệch.'}
      </p>
      {notice && (
        <p className="mf-success-notice" role="status">
          {notice}
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      {items && !items.length && (
        <p className="receiving-empty-cell">
          Không có phiếu nhận hàng giao sai chờ xác nhận.
        </p>
      )}
      {!!items?.length && (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Lệnh</th>
                <th>Phụ tùng yêu cầu</th>
                <th>Phụ tùng thực nhận</th>
                <th>Số lượng</th>
                <th>HSD bên nhận ghi</th>
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
