import { Fragment, useState, type ReactNode } from 'react'
import TransferAction from './TransferAction'
export default function CoordinationAction({
  id,
  lines,
  replenishment = false,
  onSaved,
  canDecide = true,
  canReturn = false,
  returnLines,
  inHead = false,
  secondary = false,
}: {
  id: number
  lines: {
    productId: number
    sku: string
    quantity: number
    currentPurchaseQty?: number
  }[]
  returnLines?: {
    productId: number
    sku: string
    quantity: number
    currentPurchaseQty?: number
  }[]
  replenishment?: boolean
  canDecide?: boolean
  canReturn?: boolean
  /** Đặt nút trên dòng tiêu đề thẻ (CardHead) thay vì một khối riêng. */
  inHead?: boolean
  /** Hiển thị dạng nút phụ khi đầu thẻ đã có nút chính khác. */
  secondary?: boolean
  /** Hàng trả về nguồn: nhận id phiếu nhận vừa mở để chuyển ngay sang bước giao việc kiểm nhận. */
  onSaved: (receiptId?: number) => void
}) {
  const [action, setAction] = useState(''),
    [product, setProduct] = useState(String(lines[0]?.productId ?? '')),
    [qty, setQty] = useState(1),
    [decision, setDecision] = useState('LATE_DELIVERY'),
    [reason, setReason] = useState('')
  const options = action === 'return' ? (returnLines ?? lines) : lines
  const chosen = options.find((l) => l.productId === Number(product)),
    valid =
      !!chosen &&
      Number.isInteger(qty) &&
      qty >= (replenishment ? 0 : 1) &&
      qty <= chosen.quantity
  function open(next: string) {
    setDecision('LATE_DELIVERY')
    const first = (next === 'return' ? (returnLines ?? lines) : lines)[0]
    setProduct(String(first?.productId ?? ''))
    setQty(
      next === 'purchase'
        ? first && 'currentPurchaseQty' in first
          ? (first.currentPurchaseQty ?? 0)
          : 0
        : 1,
    )
    setReason('')
    setAction(next)
  }
  const headBtnClass = inHead
    ? 'mf-btn ' + (secondary ? 'mf-btn--secondary' : 'mf-btn--primary')
    : undefined
  const buttons = (
    <>
      {canDecide && lines.length > 0 && (
        <button
          type="button"
          className={headBtnClass}
          onClick={() => open(replenishment ? 'purchase' : 'decision')}
        >
          {replenishment ? 'Chuyển phần thiếu sang mua' : 'Xử lý phần thiếu'}
        </button>
      )}
      {!replenishment && canReturn && (returnLines ?? lines).length > 0 && (
        <button
          type="button"
          className={headBtnClass}
          onClick={() => open('return')}
        >
          Ghi nhận hàng trả về nguồn
        </button>
      )}
    </>
  )
  const Wrapper = inHead ? Fragment : NoteBlock
  return (
    <Wrapper>
      {inHead ? buttons : <div className="tf-filters">{buttons}</div>}
      {action ? (
        <TransferAction
          title={
            action === 'purchase'
              ? 'Cập nhật tổng số cần mua'
              : action === 'return'
                ? 'Nhận hàng trả về kho nguồn'
                : 'Xử lý phần thiếu'
          }
          method={action === 'purchase' ? 'put' : 'post'}
          path={
            replenishment
              ? `/replenishment-requests/${id}/to-purchase`
              : `/transfer-orders/${id}/${action === 'return' ? 'returns' : 'discrepancy/decisions'}`
          }
          disabled={!valid}
          payload={() =>
            action === 'purchase'
              ? { lines: [{ productId: Number(product), toPurchaseQty: qty }] }
              : action === 'return'
                ? { lines: [{ productId: Number(product), quantity: qty }] }
                : {
                    productId: Number(product),
                    decision,
                    quantity: qty,
                    reason,
                  }
          }
          onClose={() => setAction('')}
          onSaved={(saved) => {
            setAction('')
            onSaved(
              action === 'return'
                ? (saved as { id?: number } | null)?.id
                : undefined,
            )
          }}
        >
          <label>
            Phụ tùng
            <select
              value={product}
              onChange={(e) => {
                setProduct(e.target.value)
                const picked = options.find(
                  (l) => l.productId === Number(e.target.value),
                )
                setQty(
                  action === 'purchase'
                    ? picked && 'currentPurchaseQty' in picked
                      ? (picked.currentPurchaseQty ?? 0)
                      : 0
                    : 1,
                )
              }}
            >
              {options.map((l) => (
                <option key={l.productId} value={l.productId}>
                  {l.sku} ·{' '}
                  {action === 'purchase'
                    ? 'Mua tối đa'
                    : action === 'return'
                      ? 'Có thể nhận trả'
                      : 'Chờ quyết'}{' '}
                  {l.quantity}
                </option>
              ))}
            </select>
          </label>
          <label>
            {action === 'purchase' ? 'Tổng số cần mua' : 'Số lượng'}
            <input
              type="number"
              required
              min={action === 'purchase' ? 0 : 1}
              max={chosen?.quantity ?? 0}
              value={qty}
              onChange={(e) => setQty(Number(e.target.value))}
            />
          </label>
          {action === 'decision' && (
            <>
              <label>
                Cách xử lý
                <select
                  value={decision}
                  onChange={(e) => setDecision(e.target.value)}
                >
                  <option value="LATE_DELIVERY">Nhận sau</option>
                  <option value="NO_REPLACEMENT">Không cần giao bù</option>
                </select>
              </label>
              <p className="tf-note">
                {decision === 'NO_REPLACEMENT'
                  ? 'Không cần giao bù: khi Owner đóng phiếu, số này cộng lại tồn khả dụng kho gửi.'
                  : 'Nhận sau: chờ lần giao tiếp theo; Owner chỉ đóng phiếu được khi đã nhận đủ.'}{' '}
                Phần chưa chọn sẽ tính là mất khi Owner đóng phiếu.
              </p>
              <label>
                Lý do
                <textarea
                  maxLength={255}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
            </>
          )}
          {action === 'purchase' && (
            <p>
              Số này thay thế tổng đã chuyển mua, không cộng thêm. Nhập 0 để bỏ
              phần chuyển mua.
            </p>
          )}
        </TransferAction>
      ) : null}
    </Wrapper>
  )
}

function NoteBlock({ children }: { children: ReactNode }) {
  return <div className="tf-note">{children}</div>
}
