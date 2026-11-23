/**
 * File: modules/transfers/TransferExcessSection.tsx
 * Loại: THÀNH PHẦN — phần "Hàng thừa điều chuyển" trên màn Owner "Chờ duyệt hàng thừa".
 * Công dụng: PM 22/11 (Q7, G3, G4b) + BE #98. Hàng thừa của phiếu nhận điều chuyển chờ Owner như hàng thừa NCC.
 * Nhận: cộng tồn kho nhận, trừ tồn kho gửi (lô cùng HSD bên nhận ghi; không ghi HSD thì lô nhập trước). BE trả sẵn
 * lô sẽ trừ; dòng không nhận được (MSG339 thiếu tồn, MSG341 không có lô cùng HSD) thì chỉ chọn "Không nhận".
 * Không nhận: không đổi tồn, kho nhận trả hàng về kho gửi ngoài hệ thống.
 * Review #73 (73-6): hiện kho gửi, kho nhận và lô sẽ trừ.
 */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import axiosClient from '../../shared/api/axiosClient'
import { documentCode } from '../../shared/utils/documentCode'
import { inventoryError } from '../inventory/api'
import './transfers.css'

type PlannedLot = { lotId: number; expiryDate: string | null; quantity: number }
type PendingLine = {
  lineId: number
  productId: number
  sku: string
  partName: string
  excessQty: number
  expiryDate: string | null
  lots: PlannedLot[]
  blockedCode: string | null
}
type Pending = {
  receiptId: number
  transferOrderId: number
  sourceStoreId: number
  destStoreId: number
  sourceStoreName: string
  destStoreName: string
  lines: PendingLine[]
}
type Choice = 'ACCEPTED' | 'REJECTED'

const blockedLabels: Record<string, string> = {
  MSG339: 'Kho gửi không đủ tồn khả dụng để nhận.',
  MSG341: 'Kho gửi không có lô cùng hạn sử dụng còn bán được; kiểm tra lại HSD kho nhận đã ghi.',
}

const day = (value: string | null) =>
  value ? value.split('-').reverse().join('/') : null

function PendingReceipt({
  item,
  onDecided,
}: {
  item: Pending
  onDecided: (message: string) => void
}) {
  const [choices, setChoices] = useState<Record<number, Choice>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const ready =
    item.lines.length > 0 && item.lines.every((line) => choices[line.lineId])
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
          lines: item.lines.map((line) => ({
            lineId: line.lineId,
            decision: choices[line.lineId],
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
        </strong>{' '}
        <span className="tf-excess-stores">
          Kho gửi <b>{item.sourceStoreName}</b> → Kho nhận{' '}
          <b>{item.destStoreName}</b>
        </span>
      </header>
      {error && <p role="alert">{error}</p>}
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Phụ tùng</th>
              <th>Số thừa</th>
              <th>HSD bên nhận ghi</th>
              <th>Lô kho gửi sẽ trừ</th>
              <th>Quyết định</th>
            </tr>
          </thead>
          <tbody>
            {item.lines.map((line) => {
              const blocked = line.blockedCode
                ? (blockedLabels[line.blockedCode] ?? 'Chưa nhận được dòng này.')
                : ''
              return (
                <tr key={line.lineId}>
                  <td>
                    {line.sku} · {line.partName}
                  </td>
                  <td>{line.excessQty}</td>
                  <td>{day(line.expiryDate) ?? 'Không ghi (trừ lô nhập trước)'}</td>
                  <td>
                    {blocked ? (
                      <span className="tf-excess-blocked">{blocked}</span>
                    ) : (
                      line.lots
                        .map(
                          (lot) =>
                            documentCode('L', lot.lotId) +
                            (lot.expiryDate ? ' (HSD ' + day(lot.expiryDate) + ')' : '') +
                            ' × ' +
                            lot.quantity,
                        )
                        .join(', ') || '—'
                    )}
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
                          checked={choices[line.lineId] === value}
                          disabled={busy || (value === 'ACCEPTED' && !!blocked)}
                          onChange={() =>
                            setChoices({ ...choices, [line.lineId]: value })
                          }
                        />{' '}
                        {label}
                      </label>
                    ))}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
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
        Nhận: cộng tồn kho nhận và trừ tồn kho gửi (lô cùng hạn sử dụng bên nhận ghi; không ghi hạn sử dụng thì lô
        nhập trước). Kho gửi không đủ tồn khả dụng thì không nhận được. Không nhận: tồn kho không đổi, kho nhận trả
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
