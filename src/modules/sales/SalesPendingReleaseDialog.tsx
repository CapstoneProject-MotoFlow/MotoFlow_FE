import { useMemo, useState, type FormEvent } from 'react'
import { isAxiosError } from 'axios'
import FormDialog from '../../shared/ui/FormDialog'
import MoneyInput from '../../shared/ui/MoneyInput'
import axiosClient from '../../shared/api/axiosClient'
import { formatMoney } from '../../shared/utils/format'
import { inventoryError } from '../inventory/api'
import { number } from '../inventory/presentation'
import type { SalesOrder } from './salesModel'
import type { OrderDto } from './salesApi'
import { parseMoney } from './salesDeposit'
import {
  buildReleaseBody,
  estimateReleaseTotal,
  isLastRelease,
  parseSurplusFromMessage,
  releaseBlockers,
  releaseDeposit,
  shortLines,
} from './salesRelease'
import './salesRelease.css'

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
  // null = theo số đề nghị của hệ thống; có giá trị = người dùng đã sửa ô "Trừ cọc vào đơn này".
  const [depositInput, setDepositInput] = useState<string | null>(null)
  const [refundMethod, setRefundMethod] = useState<'CASH' | 'BANK_TRANSFER'>('CASH')
  const [refundReference, setRefundReference] = useState('')
  const [refundPaid, setRefundPaid] = useState(false)
  // BE báo MSG328 (có cọc thừa mà FE không ước tính được): buộc hiện khối hoàn tiền.
  const [forceRefund, setForceRefund] = useState(false)
  const [systemRefund, setSystemRefund] = useState<number | null>(null)
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
  const qtyByLineId = useMemo(
    () =>
      Object.fromEntries(
        releaseLines
          .filter((line) => line.lineId != null)
          .map((line) => [line.lineId, line.nowQty]),
      ) as Record<number, number>,
    [releaseLines],
  )
  // MSG305: không vượt số đang chờ; BE cũng chỉ bán tối đa số còn bán được nên chặn luôn ở đây.
  const valid =
    order.lines.length > 0 &&
    order.lines.every(
      (line, index) =>
        Number.isSafeInteger(releaseLines[index].nowQty) &&
        releaseLines[index].nowQty >= 0 &&
        releaseLines[index].nowQty <=
          Math.min(line.requested, line.sellableQty ?? line.requested),
    ) && releaseLines.some((line) => line.nowQty > 0)
  const missingLineIds = order.lines.some((line) => line.lineId == null)
  const shortIds = shortLines(order.lines, qtyByLineId)

  // Cọc: chỉ khi đơn còn cọc giữ. Tổng đơn tách chỉ ước tính; BE tính lại bằng giá hiện tại.
  const deposit =
    order.deposit && order.deposit.remaining > 0 ? order.deposit : null
  const estimatedTotal = estimateReleaseTotal(
    order.lines,
    qtyByLineId,
    order.discount,
  )
  const isLast = isLastRelease(order.lines, qtyByLineId)
  const typedDeposit =
    depositInput == null ? null : (parseMoney(depositInput) ?? 0)
  const depositPlan = deposit
    ? releaseDeposit({
        remaining: deposit.remaining,
        estimatedTotal,
        isLast,
        typed: typedDeposit,
      })
    : null
  const refund = depositPlan && isLast ? depositPlan.refund : 0
  const refundInput = {
    needed: isLast && (refund > 0 || forceRefund),
    method: refundMethod,
    reference: refundReference,
    paid: refundPaid,
  }
  const blockers = releaseBlockers({
    shortCount: shortIds.length,
    isLast,
    deposit,
    typed: typedDeposit,
    max: depositPlan?.max ?? null,
    estimatedTotal,
    refund: refundInput,
  })

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy || !valid || missingLineIds || blockers.length > 0) return
    setBusy(true)
    setError('')
    try {
      const body = buildReleaseBody({
        lines: releaseLines,
        deposit:
          deposit && depositPlan
            ? {
                remaining: deposit.remaining,
                isLast,
                send: depositPlan.send,
              }
            : null,
        refund: refundInput,
      })
      const { data } = await axiosClient.post<OrderDto>(
        `/sales-orders/${order.id}/release`,
        body,
      )
      // BE #79: nhả một phần → split.salesOrderId là đơn bán mới, đơn này vẫn chờ phần còn lại.
      const soldId = data.split?.salesOrderId ?? null
      const waitingId = data.split?.waitingOrderId ?? null
      const message = [
        soldId != null ? `đơn bán SO-${soldId}` : '',
        waitingId != null ? `còn chờ SO-${waitingId}` : '',
      ]
        .filter(Boolean)
        .join(' · ')
      onSaved(
        message ? `Đã chuyển sang soạn: ${message}.` : 'Đã chuyển đơn sang soạn.',
        {
          orderId: soldId ?? data.id,
          pendingOrderId: waitingId ?? undefined,
        },
      )
    } catch (cause) {
      if (
        isAxiosError<{ code?: string; message?: string }>(cause) &&
        cause.response?.data?.code === 'MSG328'
      ) {
        // Cọc thừa mà FE không tính ra: mở khối hoàn tiền để người dùng nhập, không để kẹt.
        setForceRefund(true)
        setSystemRefund(
          parseSurplusFromMessage(cause.response?.data?.message ?? ''),
        )
      }
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
      submitDisabled={!valid || missingLineIds || blockers.length > 0}
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
        {blockers.length > 0 && (
          <ul className="sales-release-blockers" role="status">
            {blockers.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        )}
        <div className="stock-table-scroll">
          <table className="stock-table">
            <thead>
              <tr>
                <th>Phụ tùng</th>
                <th>Khách đặt / Còn bán được</th>
                <th>Lấy ngay</th>
                <th>Lấy sau</th>
              </tr>
            </thead>
            <tbody>
              {order.lines.map((line) => {
                const now = Number(quantities[line.productId] ?? 0)
                const short =
                  line.sellableQty != null && now > line.sellableQty
                return (
                  <tr
                    key={line.productId}
                    className={short ? 'is-short' : undefined}
                  >
                    <td>
                      {line.partName}
                      <small>{line.sku}</small>
                    </td>
                    <td>
                      {number.format(line.requested)} /{' '}
                      {line.sellableQty == null
                        ? 'Chưa có dữ liệu'
                        : number.format(line.sellableQty)}
                      {!!line.heldByOthersQty && (
                        <small>
                          đã trừ {number.format(line.heldByOthersQty)} đang giữ
                        </small>
                      )}
                    </td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        max={Math.min(line.requested, line.sellableQty ?? line.requested)}
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
                      {short && (
                        <small className="sales-release-short-note">
                          {`Thiếu ${number.format(now - (line.sellableQty ?? 0))}`}
                        </small>
                      )}
                    </td>
                    <td>{Math.max(0, line.requested - now)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {deposit && depositPlan && (
          <section className="sales-release-deposit" aria-label="Tiền cọc khi chuyển đơn">
            <p>{`Cọc còn giữ: ${formatMoney(deposit.remaining)}`}</p>
            <p>
              {`Tổng đơn tách (ước tính): ${
                estimatedTotal == null
                  ? 'chưa ước tính được'
                  : formatMoney(estimatedTotal)
              }`}
            </p>
            {!isLast && (
              <label className="sales-release-deposit-field">
                Trừ cọc vào đơn này
                <MoneyInput
                  value={depositInput ?? String(depositPlan.suggested)}
                  onValueChange={setDepositInput}
                  onBlur={() => {
                    if (
                      depositPlan.max != null &&
                      typedDeposit != null &&
                      typedDeposit > depositPlan.max
                    )
                      setDepositInput(String(depositPlan.max))
                  }}
                />
              </label>
            )}
            {isLast && (
              <>
                <p>{`Trừ hết cọc vào đơn này (ước tính): ${formatMoney(depositPlan.suggested)}`}</p>
                <p className="sales-release-hint">
                  Lần chuyển cuối: hệ thống trừ hết cọc còn lại, tối đa bằng tổng đơn.
                </p>
                {(refund > 0 || forceRefund) && (
                  <fieldset className="sales-release-refund">
                    <legend>
                      {forceRefund
                        ? 'Hoàn lại khách (theo hệ thống)'
                        : `Hoàn lại khách ${formatMoney(refund)} (ước tính)`}
                    </legend>
                    {forceRefund && (
                      <p className="sales-release-hint">
                        {systemRefund != null
                          ? `Số tiền hoàn: ${formatMoney(systemRefund)}`
                          : 'Số tiền hoàn theo hệ thống'}
                      </p>
                    )}
                    <label>
                      Phương thức
                      <select
                        value={refundMethod}
                        onChange={(event) =>
                          setRefundMethod(event.target.value as 'CASH' | 'BANK_TRANSFER')
                        }
                      >
                        <option value="CASH">Tiền mặt</option>
                        <option value="BANK_TRANSFER">Chuyển khoản</option>
                      </select>
                    </label>
                    {refundMethod === 'BANK_TRANSFER' && (
                      <label>
                        Mã giao dịch <span className="sales-required">*</span>
                        <input
                          required
                          maxLength={100}
                          value={refundReference}
                          onChange={(event) => setRefundReference(event.target.value)}
                        />
                      </label>
                    )}
                    <label className="sales-release-check">
                      <input
                        type="checkbox"
                        required
                        checked={refundPaid}
                        onChange={(event) => setRefundPaid(event.target.checked)}
                      />
                      Đã trả tiền cho khách
                    </label>
                  </fieldset>
                )}
              </>
            )}
          </section>
        )}
      </form>
    </FormDialog>
  )
}
