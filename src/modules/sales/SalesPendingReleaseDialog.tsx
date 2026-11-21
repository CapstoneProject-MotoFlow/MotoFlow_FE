import { useMemo, useState, type FormEvent } from 'react'
import FormDialog from '../../shared/ui/FormDialog'
import axiosClient from '../../shared/api/axiosClient'
import { inventoryError } from '../inventory/api'
import { number } from '../inventory/presentation'
import type { SalesOrder } from './salesModel'

type ReleaseResult = {
  order?: { id: number; code?: string } | null
  pendingOrder?: { id: number; code?: string } | null
}

export default function SalesPendingReleaseDialog({
  order,
  onClose,
  onSaved,
}: {
  order: SalesOrder
  onClose: () => void
  onSaved: (message: string, linkedOrders: { orderId?: number; pendingOrderId?: number }) => void
}) {
  const [quantities, setQuantities] = useState<Record<number, string>>(() =>
    Object.fromEntries(
      order.lines.map((line) => [
        line.productId,
        String(
          Math.max(
            0,
            Math.min(line.requested, line.sellableQty ?? line.requested),
          ),
        ),
      ]),
    ),
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const releaseLines = useMemo(
    () =>
      order.lines.map((line) => ({
        lineId: line.lineId,
        productId: line.productId,
        nowQty: Number(quantities[line.productId] ?? 0),
      })),
    [order.lines, quantities],
  )
  const valid =
    order.lines.length > 0 &&
    order.lines.every(
      (line, index) =>
        Number.isSafeInteger(releaseLines[index].nowQty) &&
        releaseLines[index].nowQty >= 0 &&
        releaseLines[index].nowQty <= line.requested,
    ) && releaseLines.some((line) => line.nowQty > 0)
  const missingLineIds = order.lines.some((line) => line.lineId == null)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy || !valid || missingLineIds) return
    setBusy(true)
    setError('')
    try {
      const { data } = await axiosClient.post<ReleaseResult>(
        `/sales-orders/${order.id}/release`,
        {
          lines: releaseLines.map(({ lineId, nowQty }) => ({ lineId, nowQty })),
        },
      )
      const orderCode = data.order?.code ?? (data.order && `SO-${data.order.id}`)
      const pendingCode =
        data.pendingOrder?.code ??
        (data.pendingOrder && `SO-${data.pendingOrder.id}`)
      const message = [
        orderCode ? `Đơn bán ${orderCode}` : '',
        pendingCode ? `còn chờ ${pendingCode}` : '',
      ]
        .filter(Boolean)
        .join(' · ')
      onSaved(
        message ? `Đã chuyển hàng: ${message}.` : 'Đã chuyển đơn sang soạn.',
        { orderId: data.order?.id, pendingOrderId: data.pendingOrder?.id },
      )
    } catch (cause) {
      setError(inventoryError(cause))
    } finally {
      setBusy(false)
    }
  }

  return (
    <FormDialog
      title={`Chuyển đơn ${order.code} sang soạn`}
      formId="sales-pending-release"
      submitLabel="Chuyển sang soạn"
      busy={busy}
      submitDisabled={!valid || missingLineIds}
      onClose={onClose}
    >
      <form
        id="sales-pending-release"
        className="sales-form"
        onSubmit={(event) => void submit(event)}
      >
        <p>
          Nhập số lượng có thể lấy ngay. Phần còn lại tiếp tục ở trạng thái chờ
          hàng; kho sẽ được kiểm tra lại khi lưu.
        </p>
        {error && <p role="alert">{error}</p>}
        {missingLineIds && (
          <p role="status">
            Chờ BE trả mã dòng hàng để gửi yêu cầu chuyển soạn.
          </p>
        )}
        <div className="stock-table-scroll">
          <table className="stock-table">
            <thead>
              <tr>
                <th>Phụ tùng</th>
                <th>Còn bán được</th>
                <th>Lấy ngay</th>
                <th>Lấy sau</th>
              </tr>
            </thead>
            <tbody>
              {order.lines.map((line) => {
                const now = Number(quantities[line.productId] ?? 0)
                return (
                  <tr key={line.productId}>
                    <td>
                      {line.partName}
                      <small>{line.sku}</small>
                    </td>
                    <td>
                      {line.sellableQty == null
                        ? 'Chưa có dữ liệu'
                        : number.format(line.sellableQty)}
                    </td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        max={line.requested}
                        step="1"
                        aria-label={'Lấy ngay ' + line.sku}
                        value={quantities[line.productId] ?? ''}
                        onChange={(event) =>
                          setQuantities((current) => ({
                            ...current,
                            [line.productId]: event.target.value,
                          }))
                        }
                      />
                    </td>
                    <td>{Math.max(0, line.requested - now)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </form>
    </FormDialog>
  )
}
