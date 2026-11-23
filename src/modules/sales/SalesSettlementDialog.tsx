import { isAxiosError } from 'axios'
import { useRef, useState } from 'react'
import FormDialog from '../../shared/ui/FormDialog'
import axiosClient from '../../shared/api/axiosClient'
import { inventoryError } from '../inventory/api'
import { today, money } from '../inventory/presentation'
import { discountedPrice, salesTotal, type SalesOrder } from './salesModel'
import {
  creditPrepaymentBody,
  creditPrepaymentFigures,
  fullPaymentFigures,
  fullPaymentState,
  splitPaymentBody,
  splitPaymentErrorField,
  type SplitPaymentField,
} from './splitPayment'
import { paymentMethodLabels } from '../../shared/labels/status'
import { formatDateTime, formatMoney } from '../../shared/utils/format'
import { useFormValidation } from '../../shared/hooks/useFormValidation'
import FieldError from '../../shared/ui/FieldError'
function refreshSales(message = 'Đã lưu thay đổi.') {
  window.dispatchEvent(new CustomEvent('sales-changed', { detail: message }))
}
const digitsOnly = (text: string) => text.replace(/[^0-9]/g, '')
const formatSplitInput = (text: string) =>
  text === '' ? '' : Number(text).toLocaleString('vi-VN')
export default function SalesSettlementDialog({
  action,
  order,
  initialRefundAmount,
  onClose,
  onCredit,
  onPayment,
}: {
  action: string
  order: SalesOrder
  initialRefundAmount?: number
  onCredit?: () => void
  /** BH3: chuyển từ hộp ghi nợ về thanh toán. */
  onPayment?: () => void
  onClose: (nextAction?: string) => void
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [method, setMethod] = useState('CASH'),
    [amount, setAmount] = useState(
      action === 'refund'
        ? String(
            Math.min(
              initialRefundAmount ?? order.refundable ?? 0,
              order.refundable ?? 0,
            ),
          )
        : '',
    ),
    [verified, setVerified] = useState(false),
    [agreed, setAgreed] = useState(false)
  // Góp ý 23/11: Thanh toán luôn thu đủ, tiền mặt thu = payableNow − chuyển khoản; khách đưa trống nghĩa là bằng
  // tiền mặt. Ghi nợ có thể kèm trả trước (3b), người bán gõ tiền mặt và chuyển khoản trả trước.
  const payable = order.payableNow ?? 0
  const remaining = order.remainingPayable ?? 0
  const splitMode = action === 'payment' || action === 'credit'
  const [paymentText, setPaymentText] = useState({
      cashText: '',
      tenderedText: '',
      transferText: '',
    }),
    [reference, setReference] = useState(''),
    [touched, setTouched] = useState<
      Partial<Record<SplitPaymentField, boolean>>
    >({}),
    [attempted, setAttempted] = useState(false),
    [serverError, setServerError] = useState<{
      field: SplitPaymentField
      message: string
    } | null>(null)
  const paymentState = { ...paymentText, reference }
  const prepayment = creditPrepaymentFigures(paymentState, remaining)
  const figures =
    action === 'credit'
      ? prepayment
      : fullPaymentFigures(paymentState, payable)
  const { cash, transfer } = figures
  // Lỗi BE gắn vào ô được ưu tiên; lỗi tự kiểm chỉ hiện sau khi bấm Ghi hoặc sau khi sửa ô đó.
  const fieldError = (field: SplitPaymentField) =>
    serverError?.field === field
      ? serverError.message
      : attempted || touched[field]
        ? figures.check.errors[field]
        : undefined
  const touch = (...fields: SplitPaymentField[]) =>
    setTouched((t) => ({
      ...t,
      ...Object.fromEntries(fields.map((f) => [f, true])),
    }))
  // Cọc đã nằm trong netPaid (backend netCollected); hiển thị tách riêng.
  const depositApplied = order.depositApplied ?? 0
  const receivedExDeposit = Math.max(0, order.netPaid - depositApplied)
  const [delivered, setDelivered] = useState<Record<number, string>>(() =>
    Object.fromEntries(
      order.lines.map((l) => [l.productId, String(l.picked ?? 0)]),
    ),
  )
  const validation = useFormValidation()
  const lock = useRef(false),
    [paymentId, setPaymentId] = useState<number>()
  const titles: Record<string, string> = {
    confirm: 'Xác nhận đơn bán',
    payment: 'Thu tiền',
    refund: 'Hoàn tiền',
    credit: 'Ghi nhận bán chịu',
    cancel: 'Hủy đơn',
    complete: 'Hoàn tất đơn',
    verify: 'Xác minh khoản tiền',
    reject: 'Từ chối khoản tiền',
  }
  const allowed =
    action === 'confirm'
      ? order.actions?.canConfirm
      : action === 'payment'
        ? order.actions?.canRecordPayment
        : action === 'refund'
          ? order.actions?.canRefund
          : action === 'credit'
            ? order.actions?.canRecordCredit
            : action === 'cancel'
              ? order.actions?.canCancel
              : action === 'complete'
                ? order.actions?.canComplete
                : !['COMPLETED', 'CANCELLED'].includes(order.status)
  const quantities = order.lines.map((l) => ({
    quantity: Number(delivered[l.productId]),
    price: l.retailPrice,
  }))
  const validDelivery =
    order.lines.every(
      (l) =>
        delivered[l.productId] !== '' &&
        Number.isInteger(Number(delivered[l.productId])) &&
        Number(delivered[l.productId]) >= 0 &&
        Number(delivered[l.productId]) <= Math.min(l.requested, l.picked ?? 0),
    ) && quantities.some((l) => l.quantity > 0)
  const subtotal = salesTotal(quantities, 0),
    total = salesTotal(quantities, order.discount)
  const shortLines = order.lines.filter(
    (l) => Number(delivered[l.productId]) < l.requested,
  )
  // Khung tiền mặt + chuyển khoản, dùng cho Thanh toán (tiền mặt tự tính) và phần trả trước của Ghi nợ (tự gõ).
  const splitParts = (
    <div className="sales-split-parts">
      <fieldset className="sales-split-part">
        <legend>Tiền mặt</legend>
        {action === 'credit' ? (
          <label>
            Số tiền
            <div className="sales-payment-amount">
              <input
                inputMode="numeric"
                aria-label="Số tiền mặt trả trước"
                value={formatSplitInput(paymentText.cashText)}
                onChange={(e) => {
                  const value = digitsOnly(e.target.value)
                  setPaymentText((p) => ({
                    ...p,
                    cashText: value,
                    tenderedText:
                      Number(value || 0) === 0 ? '' : p.tenderedText,
                  }))
                  touch('cash', 'total')
                  setServerError(null)
                }}
              />
              <span>đ</span>
            </div>
            <FieldError message={fieldError('cash')} />
          </label>
        ) : (
          <p className="sales-split-change">
            <span>Tiền mặt thu</span>
            <strong>{money.format(cash)}</strong>
          </p>
        )}
        {cash > 0 && (
          <label>
            Khách đưa
            <div className="sales-payment-amount">
              <input
                inputMode="numeric"
                aria-label="Số tiền khách đưa"
                placeholder={formatSplitInput(String(cash))}
                value={formatSplitInput(paymentText.tenderedText)}
                onChange={(e) => {
                  const value = digitsOnly(e.target.value)
                  setPaymentText((p) => ({ ...p, tenderedText: value }))
                  touch('tendered')
                  setServerError(null)
                }}
              />
              <span>đ</span>
            </div>
            <FieldError message={fieldError('tendered')} />
          </label>
        )}
        {cash > 0 && (
          <p className="sales-split-change">
            <span>Tiền thối</span>
            <strong>{money.format(figures.check.change)}</strong>
          </p>
        )}
      </fieldset>
      <fieldset className="sales-split-part">
        <legend>Chuyển khoản</legend>
        <label>
          Số tiền
          <div className="sales-payment-amount">
            <input
              inputMode="numeric"
              aria-label="Số tiền chuyển khoản"
              placeholder="0"
              value={formatSplitInput(paymentText.transferText)}
              onChange={(e) => {
                const value = digitsOnly(e.target.value)
                setPaymentText((p) => ({ ...p, transferText: value }))
                touch('transfer', 'total')
                setServerError(null)
              }}
            />
            <span>đ</span>
          </div>
          <FieldError message={fieldError('transfer')} />
        </label>
        <label>
          Mã giao dịch{' '}
          {transfer > 0 && <span className="sales-required">*</span>}
          <input
            required={transfer > 0}
            name="reference"
            maxLength={100}
            value={reference}
            onChange={(e) => {
              setReference(e.target.value)
              touch('reference')
              setServerError(null)
            }}
          />
          <FieldError message={fieldError('reference')} />
        </label>
      </fieldset>
    </div>
  )
  return (
    <FormDialog
      className={
        'sales-transaction-dialog' +
        (action === 'confirm'
          ? ' sales-confirm-dialog'
          : action === 'payment' || action === 'credit'
            ? ' sales-payment-dialog'
            : '')
      }
      title={titles[action] + ' · ' + order.code}
      formId="sales-transaction"
      closeLabel={action === 'cancel' ? 'Không hủy' : undefined}
      busy={busy}
      submitDisabled={
        !allowed ||
        busy ||
        (action === 'confirm' && (!agreed || !validDelivery))
      }
      submitLabel={
        busy
          ? 'Đang lưu…'
          : action === 'payment'
            ? 'Ghi khoản thu'
            : titles[action]
      }
      onClose={onClose}
    >
      <form
        id="sales-transaction"
        className="sales-form"
        noValidate
        onInput={validation.onInput}
        onSubmit={async (e) => {
          e.preventDefault()
          if (splitMode) {
            setAttempted(true)
            if (!figures.check.valid) return
          }
          if (!validation.check(e.currentTarget)) return
          if (lock.current || !allowed) return
          const form = new FormData(e.currentTarget),
            text = (key: string) => String(form.get(key) ?? '').trim()
          let path = action,
            body: unknown
          if (action === 'confirm') {
            if (!agreed) {
              setError('Cần xác nhận khách hàng đồng ý.')
              return
            }
            const lines = order.lines.map((l) => ({
              productId: l.productId,
              deliveredQty: Number(delivered[l.productId]),
            }))
            if (
              lines.some(
                (l, i) =>
                  delivered[l.productId] === '' ||
                  !Number.isInteger(l.deliveredQty) ||
                  l.deliveredQty < 0 ||
                  l.deliveredQty >
                    Math.min(
                      order.lines[i].requested,
                      order.lines[i].picked ?? 0,
                    ),
              )
            ) {
              setError('Số giao phải là số nguyên từ 0 đến số đã nhặt/yêu cầu.')
              return
            }
            body = {
              version: order.version,
              customerAgreed: agreed,
              lines,
            }
          } else if (action === 'payment') {
            path = 'payments/split'
            body = splitPaymentBody(
              fullPaymentState(paymentState, payable),
              payable,
            )
          } else if (action === 'refund') {
            const value = Number(amount),
              limit = order.refundable
            if (
              !Number.isSafeInteger(value) ||
              value <= 0 ||
              value > 100000000000 ||
              limit == null ||
              value > limit
            ) {
              setError('Số tiền không hợp lệ hoặc vượt mức được phép.')
              return
            }
            if (method === 'BANK_TRANSFER' && !text('reference')) {
              setError('Nhập mã giao dịch chuyển khoản.')
              return
            }
            path = 'refunds'
            body = {
              amount: value,
              paymentMethod: method,
              transactionReference: text('reference') || null,
              verified,
              expectedRefundable: order.refundable,
            }
          } else if (action === 'credit') {
            if (!agreed) {
              setError('Cần xác nhận khách đồng ý số tiền và hạn trả.')
              return
            }
            body = {
              version: order.version,
              ...creditPrepaymentBody(paymentState, remaining),
              dueDate: text('dueDate'),
              customerAgreed: agreed,
            }
          } else if (action === 'cancel') {
            if (order.netPaid > 0 && !verified) {
              setError('Xác nhận đã hoàn tiền cho khách trước khi hủy.')
              return
            }
            body = {
              reason: text('reason'),
              refund:
                order.netPaid > 0
                  ? {
                      amount: order.netPaid,
                      paymentMethod: method,
                      transactionReference: text('reference') || null,
                      paidToCustomer: verified,
                    }
                  : null,
            }
          } else if (action === 'complete') body = { version: order.version }
          else {
            if (!paymentId) {
              setError('Chọn khoản tiền.')
              return
            }
            path = 'payments/' + paymentId + '/' + action
            body = action === 'reject' ? { reason: text('reason') } : undefined
          }
          lock.current = true
          setBusy(true)
          setError('')
          setServerError(null)
          try {
            const { data } = await axiosClient.post(
              '/sales-orders/' + order.id + '/' + path,
              body,
            )
            refreshSales(
              data.completionBlockedMessage
                ? 'Đã ghi nhận tiền. Chưa hoàn tất: ' +
                    data.completionBlockedMessage
                : 'Đã lưu ' + titles[action].toLowerCase() + '.',
            )
            onClose(action === 'confirm' ? 'payment' : undefined)
          } catch (error) {
            const field =
              splitMode && isAxiosError(error)
                ? splitPaymentErrorField(error.response?.data ?? {})
                : null
            if (field) setServerError({ field, message: inventoryError(error) })
            else setError(inventoryError(error))
          } finally {
            lock.current = false
            setBusy(false)
          }
        }}
      >
        {(order.actions?.canRecordCredit || action === 'credit') && (
          // BH3 (GVHD 20/11): xác nhận xong mở thẳng hộp này; đầu hộp chọn Thanh toán hoặc Ghi nợ.
          <div
            className="sales-settle-choice"
            role="group"
            aria-label="Cách khách trả"
          >
            <button
              type="button"
              aria-pressed={action === 'payment'}
              disabled={busy}
              onClick={() => action !== 'payment' && onPayment?.()}
            >
              Thanh toán
            </button>
            <button
              type="button"
              aria-pressed={action === 'credit'}
              disabled={busy}
              onClick={() => action !== 'credit' && onCredit?.()}
            >
              Ghi nợ {money.format(remaining)}
            </button>
          </div>
        )}
        {action === 'payment' &&
          !order.actions?.canRecordCredit &&
          order.customerId && (
            // Góp ý 23/11: không ghi nợ được thì bỏ cả thanh chọn; khách lẻ không hiện gì.
            <p className="sales-settle-note">
              Khách hàng này không đủ điều kiện mua chịu
            </p>
          )}
        {error && (
          <div role="alert" className="stock-error">
            {error}
            <button
              type="button"
              onClick={() => {
                refreshSales(
                  'Đã tải lại dữ liệu đơn. Kiểm tra số tiền trước khi thao tác lại.',
                )
                onClose()
              }}
            >
              Tải lại đơn
            </button>
          </div>
        )}
        {action === 'confirm' && (
          <>
            <div className="sales-confirm-table">
              <table>
                <thead>
                  <tr>
                    <th>Phụ tùng</th>
                    <th>Yêu cầu</th>
                    <th>Đã lấy</th>
                    <th>Giao</th>
                    <th>Thành tiền</th>
                  </tr>
                </thead>
                <tbody>
                  {order.lines.map((l) => (
                    <tr
                      key={l.productId}
                      className={
                        (l.picked ?? 0) < l.requested ? 'has-shortage' : ''
                      }
                    >
                      <td>
                        {l.partName}
                        <small>{l.sku}</small>
                      </td>
                      <td>{l.requested}</td>
                      <td
                        className={
                          (l.picked ?? 0) < l.requested ? 'sales-short' : ''
                        }
                      >
                        {l.picked ?? 0}
                      </td>
                      <td>
                        <input
                          aria-label={'Số giao ' + l.sku}
                          required
                          type="number"
                          min="0"
                          max={Math.min(l.requested, l.picked ?? 0)}
                          step="1"
                          value={delivered[l.productId]}
                          onChange={(e) =>
                            setDelivered({
                              ...delivered,
                              [l.productId]: e.target.value,
                            })
                          }
                        />
                        <FieldError
                          message={validation.errors['Số giao ' + l.sku]}
                        />
                      </td>
                      <td>
                        {l.retailPrice == null ||
                        !Number.isInteger(Number(delivered[l.productId]))
                          ? 'Chưa tính được'
                          : money.format(
                              discountedPrice(l.retailPrice, order.discount) *
                                Number(delivered[l.productId]),
                            )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="sales-confirm-summary">
              <div className="sales-confirm-checks">
                <p>
                  {order.discountThreshold == null
                    ? '○ Chưa có ngưỡng chiết khấu'
                    : (order.discount <= order.discountThreshold
                        ? '✓ '
                        : '! ') +
                      'Chiết khấu ' +
                      order.discount +
                      '%, ngưỡng ' +
                      order.discountThreshold +
                      '%'}
                </p>
              </div>
              <dl>
                <div>
                  <dt>Tổng theo giá bán lẻ</dt>
                  <dd>
                    {subtotal == null
                      ? 'Chưa tính được'
                      : money.format(subtotal)}
                  </dd>
                </div>
                {depositApplied > 0 && (
                  <div>
                    <dt>Đã cọc</dt>
                    <dd>{money.format(depositApplied)}</dd>
                  </div>
                )}
                <div>
                  <dt>Đã thu trước</dt>
                  <dd>{money.format(receivedExDeposit)}</dd>
                </div>
                <div className="total">
                  <dt>Tổng tiền tạm tính</dt>
                  <dd>
                    {total == null ? 'Chưa tính được' : money.format(total)}
                  </dd>
                </div>
                <div className="payable">
                  <dt>Số tiền cần thu</dt>
                  <dd>
                    {total == null
                      ? 'Chưa tính được'
                      : money.format(
                          Math.max(0, total - order.netPaid - order.credit),
                        )}
                  </dd>
                </div>
              </dl>
            </div>
            {shortLines.length > 0 && (
              <div className="sales-confirm-shortage">
                <p className="sales-confirm-warning">
                  {shortLines
                    .map(
                      (l) =>
                        l.partName +
                        ' giao ' +
                        delivered[l.productId] +
                        '/' +
                        l.requested,
                    )
                    .join('; ')}
                </p>
              </div>
            )}
            <label className="sales-confirm-agreement">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
              />
              Khách đã đồng ý nhận số hàng và tổng tiền này
            </label>
          </>
        )}
        {action === 'payment' && (
          <>
            <dl className="sales-payment-overview">
              <div>
                <dt>Tổng tiền</dt>
                <dd>
                  {order.total == null
                    ? 'Chưa có dữ liệu'
                    : money.format(order.total)}
                </dd>
              </div>
              {depositApplied > 0 && (
                <div>
                  <dt>Đã cọc</dt>
                  <dd>{money.format(depositApplied)}</dd>
                </div>
              )}
              <div>
                <dt>Đã thu</dt>
                <dd>{money.format(receivedExDeposit)}</dd>
              </div>
              <div>
                <dt>{depositApplied > 0 ? 'Còn phải trả' : 'Còn phải thu'}</dt>
                <dd>{money.format(order.remainingPayable ?? 0)}</dd>
              </div>
            </dl>
            {splitParts}
            <div className="sales-split-total" aria-live="polite">
              <p>
                Tổng thu: <strong>{money.format(figures.check.total)}</strong> /
                còn phải thu <strong>{money.format(payable)}</strong>
              </p>
              <FieldError message={fieldError('total')} />
            </div>
          </>
        )}
        {action === 'refund' && (
          <label>
            Số tiền hoàn (đ)
            <input
              required
              name="refundAmount"
              data-label="Số tiền hoàn"
              data-max-message={
                'Không hoàn quá số đã thu (' +
                money.format(order.refundable ?? 0) +
                ')'
              }
              type="number"
              min="1"
              max={order.refundable ?? 0}
              step="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <FieldError message={validation.errors.refundAmount} />
          </label>
        )}
        {(action === 'refund' ||
          (action === 'cancel' && order.netPaid > 0)) && (
          <>
            <label>
              Phương thức
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
              >
                <option value="CASH">Tiền mặt</option>
                <option value="BANK_TRANSFER">Chuyển khoản</option>
              </select>
            </label>
            {method === 'BANK_TRANSFER' && (
              <label>
                Mã giao dịch
                <input required name="reference" maxLength={100} />
                <FieldError message={validation.errors.reference} />
              </label>
            )}
            <label>
              <input
                type="checkbox"
                checked={verified}
                onChange={(e) => setVerified(e.target.checked)}
              />
              Đã trả tiền cho khách
            </label>
          </>
        )}
        {action === 'credit' && (
          <>
            <h3 className="sales-split-heading">Trả trước (nếu có)</h3>
            {splitParts}
            <div className="sales-split-total" aria-live="polite">
              <p>
                Số ghi nợ = Còn phải trả {money.format(remaining)} − Trả trước{' '}
                {money.format(prepayment.check.total)} ={' '}
                <strong>{money.format(prepayment.credit)}</strong>
              </p>
              <FieldError message={fieldError('total')} />
            </div>
            <label>
              Hạn trả
              <input required name="dueDate" type="date" min={today()} />
              <FieldError message={validation.errors.dueDate} />
            </label>
            <label>
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
              />
              Khách đồng ý số tiền và hạn trả
            </label>
          </>
        )}
        {(action === 'verify' || action === 'reject') && (
          <label>
            Khoản tiền chờ xác minh
            <select
              required
              name="paymentId"
              value={paymentId ?? ''}
              onChange={(e) => setPaymentId(Number(e.target.value))}
            >
              <option value="">Chọn khoản tiền</option>
              {order.payments
                ?.filter((p) => p.status === 'UNVERIFIED')
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {paymentMethodLabels[p.method] || p.method}{' '}
                    {money.format(p.amount)} lúc{' '}
                    {formatDateTime(p.recordedAt).slice(-5)}
                  </option>
                ))}
            </select>
            <FieldError message={validation.errors.paymentId} />
          </label>
        )}
        {action === 'cancel' &&
          order.actions?.cancelForfeitsDeposit &&
          (order.deposit?.remaining ?? 0) > 0 && (
            <p className="sales-deposit-banner" role="alert">
              Khách sẽ mất cọc {formatMoney(order.deposit?.remaining)}. Tiền cọc
              không được hoàn.
            </p>
          )}
        {(action === 'cancel' || action === 'reject') && (
          <label>
            Lý do *<textarea name="reason" required maxLength={255} />
            <FieldError message={validation.errors.reason} />
          </label>
        )}
        {action === 'cancel' && order.netPaid > 0 && (
          <p>
            Hủy đơn sẽ hoàn toàn bộ {money.format(order.netPaid)} đã thu cho khách.
          </p>
        )}
        {action === 'complete' && (
          <p>
            Kiểm tra lại tồn và hoàn tất phiên bản {order.version}. Tiền đã ghi
            nhận được giữ nguyên nếu điều kiện hoàn tất chưa đạt.
          </p>
        )}
      </form>
    </FormDialog>
  )
}
