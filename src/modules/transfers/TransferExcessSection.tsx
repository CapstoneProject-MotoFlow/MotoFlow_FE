/**
 * File: modules/transfers/TransferExcessSection.tsx
 * Loại: THÀNH PHẦN — phần "Hàng thừa điều chuyển" trên màn Owner "Chờ duyệt hàng thừa".
 * Công dụng: PM 22/11 (Q7, G3, G4b) + BE #98. Hàng thừa của phiếu nhận điều chuyển chờ Owner như hàng thừa NCC.
 * Nhận: cộng tồn kho nhận, trừ tồn kho gửi (lô cùng HSD bên nhận ghi; không có HSD thì lô nhập trước); kho gửi
 * không đủ tồn khả dụng thì BE chặn (MSG339). Không nhận: không đổi tồn, kho nhận trả hàng về kho gửi ngoài hệ thống.
 */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import axiosClient from '../../shared/api/axiosClient'
import { documentCode } from '../../shared/utils/documentCode'
import { inventoryError } from '../inventory/api'
import type { Receipt } from './types'
import './transfers.css'

type Pending = {
  receiptId: number
  transferOrderId: number
  sourceStoreId: number
  destStoreId: number
}
type Choice = 'ACCEPTED' | 'REJECTED'

function PendingReceipt({
  item,
  onDecided,
}: {
  item: Pending
  onDecided: (message: string) => void
}) {
  const [receipt, setReceipt] = useState<Receipt>()
  const [choices, setChoices] = useState<Record<number, Choice>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    axiosClient
      .get<Receipt>(
        '/transfer-orders/' + item.transferOrderId + '/receipts/' + item.receiptId,
        { signal: controller.signal },
      )
      .then(({ data }) => setReceipt(data))
      .catch((failure) => {
        if (!controller.signal.aborted) setError(inventoryError(failure))
      })
    return () => controller.abort()
  }, [item.transferOrderId, item.receiptId])
  const lines = (receipt?.lines ?? []).filter(
    (line) => line.excessDecision === 'AWAITING_OWNER' && line.lineId != null,
  )
  const ready = lines.length > 0 && lines.every((line) => choices[line.lineId!])
  async function submit() {
    if (!ready || busy) return
    setBusy(true)
    setError('')
    try {
      await axiosClient.post(
        '/transfer-orders/' +
          item.transferOrderId +
          '/receipts/' +
          item.receiptId +
          '/excess-decision',
        {
          lines: lines.map((line) => ({
            lineId: line.lineId,
            decision: choices[line.lineId!],
          })),
        },
      )
      onDecided(
        'Đã duyệt hàng thừa của ' + documentCode('PN', item.receiptId) + '.',
      )
    } catch (failure) {
      setError(inventoryError(failure))
    } finally {
      setBusy(false)
    }
  }
  return (
    <article className="tf-excess-receipt">
      <header>
        <strong>
          <Link to={'/transfer-orders/' + item.transferOrderId}>
            {documentCode('DC', item.transferOrderId)}
          </Link>{' '}
          ·{' '}
          <Link
            to={
              '/transfer-orders/' +
              item.transferOrderId +
              '/receipts/' +
              item.receiptId
            }
          >
            {documentCode('PN', item.receiptId)}
          </Link>
        </strong>
      </header>
      {error && <p role="alert">{error}</p>}
      {!receipt && !error && <p role="status">Đang tải phiếu…</p>}
      {lines.length > 0 && (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Phụ tùng</th>
                <th>Số thừa</th>
                <th>HSD bên nhận ghi</th>
                <th>Quyết định</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.lineId}>
                  <td>
                    {line.sku} · {line.partName}
                  </td>
                  <td>{line.excessQty}</td>
                  <td>
                    {line.expiryDate
                      ? line.expiryDate.split('-').reverse().join('/')
                      : 'Không có (trừ lô nhập trước)'}
                  </td>
                  <td>
                    {(
                      [
                        ['ACCEPTED', 'Nhận'],
                        ['REJECTED', 'Không nhận'],
                      ] as const
                    ).map(([value, label]) => (
                      <label key={value} className="tf-excess-choice">
                        <input
                          type="radio"
                          name={'excess-' + line.lineId}
                          checked={choices[line.lineId!] === value}
                          disabled={busy}
                          onChange={() =>
                            setChoices({ ...choices, [line.lineId!]: value })
                          }
                        />{' '}
                        {label}
                      </label>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {lines.length > 0 && (
        <div className="mf-row-actions">
          <button
            type="button"
            className="mf-btn mf-btn--sm mf-btn--primary"
            disabled={!ready || busy}
            onClick={() => void submit()}
          >
            {busy ? 'Đang lưu…' : 'Xác nhận'}
          </button>
        </div>
      )}
    </article>
  )
}

export default function TransferExcessSection() {
  const [items, setItems] = useState<Pending[]>()
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    axiosClient
      .get<Pending[]>('/goods-receipt-notes/transfer-excess', {
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
  return (
    <section className="receiving-panel tf-excess-section">
      <header className="receiving-panel-head">
        <h2>Hàng thừa điều chuyển</h2>
      </header>
      <p className="tf-excess-hint">
        Nhận: cộng tồn kho nhận và trừ tồn kho gửi (lô cùng hạn sử dụng bên nhận ghi; không có hạn sử dụng thì lô
        nhập trước). Kho gửi không đủ tồn khả dụng thì hệ thống chặn. Không nhận: tồn kho không đổi, kho nhận trả
        hàng về kho gửi.
      </p>
      {notice && (
        <p className="mf-success-notice" role="status">
          {notice}
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      {items && !items.length && (
        <p className="receiving-empty-cell">Không có phiếu nhận điều chuyển chờ duyệt hàng thừa.</p>
      )}
      {items?.map((item) => (
        <PendingReceipt
          key={item.receiptId + ':' + revision}
          item={item}
          onDecided={(message) => {
            setNotice(message)
            setRevision((n) => n + 1)
          }}
        />
      ))}
    </section>
  )
}
