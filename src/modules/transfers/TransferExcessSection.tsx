/**
 * File: modules/transfers/TransferExcessSection.tsx
 * Loại: THÀNH PHẦN — phần "Hàng thừa điều chuyển" trên màn Owner "Chờ duyệt hàng thừa".
 * Công dụng: PM 22/11 (Q7, G3, G4b) + BE #98. Hàng thừa của phiếu nhận điều chuyển chờ Owner như hàng thừa NCC.
 * PM 23/11 (plan bản 2): hàng thừa điều chuyển luôn được nhận, không còn "Không nhận" (BE MSG346). Owner đóng phiếu
 * là tự chấp nhận; Owner có thể chấp nhận sớm ở đây. Chấp nhận: cộng tồn kho nhận, trừ tồn khả dụng kho gửi (lô cùng
 * HSD bên nhận ghi; không ghi HSD thì lô nhập trước). Dòng kho gửi không cho được (MSG339 thiếu tồn, MSG341 không có
 * lô cùng HSD) thì cũng chặn đóng phiếu cho tới khi kho gửi có hàng.
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

const blockedLabels: Record<string, string> = {
  MSG339: 'Kho gửi không đủ tồn khả dụng (không tính hàng đang giữ cho đơn bán).',
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
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const ready =
    item.lines.length > 0 && item.lines.every((line) => !line.blockedCode)
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
            decision: 'ACCEPTED',
          })),
        },
      )
      onDecided(
        'Đã chấp nhận hàng thừa của ' +
          documentCode('PN', item.receiptId) +
          ': tồn kho gửi và kho nhận đã cập nhật.',
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
              <th>Xử lý</th>
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
                    {blocked
                      ? 'Chặn đóng phiếu tới khi kho gửi cho được'
                      : 'Tự chấp nhận khi đóng phiếu'}
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
          {busy ? 'Đang lưu…' : 'Chấp nhận ngay'}
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
        Hàng thừa điều chuyển luôn được nhận: tự chấp nhận khi Owner đóng phiếu, hoặc bấm Chấp nhận ngay. Chấp nhận
        là cộng tồn kho nhận và trừ tồn khả dụng kho gửi (lô cùng hạn sử dụng bên nhận ghi; không ghi thì lô nhập
        trước). Kho gửi không đủ tồn hoặc không có lô cùng hạn sử dụng thì chưa chấp nhận được và chặn đóng phiếu.
      </p>
      {notice && (
        <p className="mf-success-notice" role="status">
          {notice}
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      {items && !items.length && (
        <p className="receiving-empty-cell">Không có phiếu nhận điều chuyển có hàng thừa chờ chấp nhận.</p>
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
