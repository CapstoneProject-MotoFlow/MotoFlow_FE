import { useState } from 'react'
import TransferAction from './TransferAction'
export default function CoordinationAction({
  id,
  lines,
  replenishment = false,
  onSaved,
  canDecide = true,
  canReturn = false,
}: {
  id: number
  lines: { productId: number; sku: string; quantity: number }[]
  replenishment?: boolean
  canDecide?: boolean
  canReturn?: boolean
  onSaved: () => void
}) {
  const [action, setAction] = useState(''),
    [product, setProduct] = useState(String(lines[0]?.productId ?? '')),
    [qty, setQty] = useState(1),
    [decision, setDecision] = useState('LATE_DELIVERY'),
    [reason, setReason] = useState(''),
    [adjustment, setAdjustment] = useState('')
  const chosen = lines.find((l) => l.productId === Number(product)),
    valid =
      !!chosen && Number.isInteger(qty) && qty > 0 && qty <= chosen.quantity
  return (
    <div className="tf-note">
      <div className="tf-filters">
        {canDecide && (
          <button
            disabled={!lines.length}
            onClick={() => setAction(replenishment ? 'purchase' : 'decision')}
          >
            {replenishment ? 'Chuyển phần thiếu sang mua' : 'Xử lý phần thiếu'}
          </button>
        )}
        {!replenishment && canReturn && (
          <button disabled={!lines.length} onClick={() => setAction('return')}>
            Ghi nhận hàng trả về nguồn
          </button>
        )}
      </div>
      {action && (
        <TransferAction
          title={
            action === 'purchase'
              ? 'Chuyển mua'
              : action === 'return'
                ? 'Nhận hàng trả về kho nguồn'
                : 'Quyết định xử lý sai lệch'
          }
          method={action === 'purchase' ? 'put' : 'post'}
          path={
            replenishment
              ? `/replenishment-requests/${id}/to-purchase`
              : `/transfer-orders/${id}/${action === 'return' ? 'returns' : 'discrepancy/decisions'}`
          }
          disabled={
            !valid ||
            (action === 'decision' && decision === 'LOSS' && !adjustment)
          }
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
                    adjustmentRequestId:
                      decision === 'LOSS' ? Number(adjustment) : undefined,
                  }
          }
          onClose={() => setAction('')}
          onSaved={() => {
            setAction('')
            onSaved()
          }}
        >
          <label>
            Phụ tùng
            <select
              value={product}
              onChange={(e) => {
                setProduct(e.target.value)
                setQty(1)
              }}
            >
              {lines.map((l) => (
                <option key={l.productId} value={l.productId}>
                  {l.sku} · Còn thiếu {l.quantity}
                </option>
              ))}
            </select>
          </label>
          <label>
            Số lượng
            <input
              type="number"
              required
              min={1}
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
                  <option value="RETURN_TO_SOURCE">Trả về kho nguồn</option>
                  <option value="LOSS">Mất/hỏng</option>
                </select>
              </label>
              {decision === 'LOSS' && (
                <label>
                  Mã yêu cầu điều chỉnh mất tồn
                  <input
                    type="number"
                    required
                    min={1}
                    value={adjustment}
                    onChange={(e) => setAdjustment(e.target.value)}
                  />
                </label>
              )}
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
          <p>
            BE kiểm tra quyền điều phối/kho nguồn và số lượng trước khi ghi.
          </p>
        </TransferAction>
      )}
    </div>
  )
}
