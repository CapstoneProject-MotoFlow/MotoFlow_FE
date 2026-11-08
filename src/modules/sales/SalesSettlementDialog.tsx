import { cashCollection } from './salesModel'
import { useRef, useState } from 'react'
import FormDialog from '../../shared/ui/FormDialog'
import axiosClient from '../../shared/api/axiosClient'
import { inventoryError } from '../inventory/api'
import { today, money } from '../inventory/presentation'
import { discountedPrice, salesTotal, type SalesOrder } from './salesModel'
function refreshSales(message = 'Đã lưu thay đổi.') {
  window.dispatchEvent(new CustomEvent('sales-changed', { detail: message }))
}
export default function SalesSettlementDialog({
  action,
  order,
  onClose,
  onCredit,
}: {
  action: string
  order: SalesOrder
  onCredit?: () => void
  onClose: () => void
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [method, setMethod] = useState('CASH'),
    [amount, setAmount] = useState(
      String(
        action === 'refund'
          ? (order.refundable ?? 0)
          : (order.payableNow ?? order.remainingPayable ?? 0),
      ),
    ),
    [verified, setVerified] = useState(false),
    [agreed, setAgreed] = useState(false)
  const [cashGiven, setCashGiven] = useState(
    String(order.payableNow ?? order.remainingPayable ?? 0),
  )
  const cashResult = cashCollection(cashGiven, order.payableNow ?? 0)
  const cash = Number(cashGiven),
    recorded = method === 'CASH' ? (cashResult?.amount ?? 0) : Number(amount)
  const validPayment =
    method === 'CASH'
      ? cashResult != null
      : Number.isSafeInteger(Number(amount)) &&
        Number(amount) > 0 &&
        Number(amount) <= (order.payableNow ?? 0)
  const [delivered, setDelivered] = useState<Record<number, string>>(() =>
    Object.fromEntries(
      order.lines.map((l) => [l.productId, String(l.picked ?? 0)]),
    ),
  )
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
  const stockKnown = order.lines.every((l) => l.sellableQty != null),
    stockEnough = order.lines.every(
      (l) => Number(delivered[l.productId]) <= (l.sellableQty ?? 0),
    )
  return (
    <FormDialog
      className={
        'sales-transaction-dialog' +
        (action === 'confirm'
          ? ' sales-confirm-dialog'
          : action === 'payment'
            ? ' sales-payment-dialog'
            : '')
      }
      title={titles[action] + ' · ' + order.code}
      formId="sales-transaction"
      busy={busy}
      submitDisabled={
        !allowed ||
        busy ||
        (action === 'confirm' && (!agreed || !validDelivery)) ||
        (action === 'payment' && !validPayment)
      }
      submitLabel={
        busy
          ? 'Đang lưu…'
          : action === 'payment'
            ? 'Ghi khoản thu'
            : titles[action]
      }
      footerExtra={
        action === 'payment' && order.actions?.canRecordCredit && onCredit ? (
          <button
            type="button"
            className="secondary-button"
            disabled={busy}
            onClick={onCredit}
          >
            Ghi nợ {money.format(order.remainingPayable ?? 0)}
          </button>
        ) : undefined
      }
      onClose={onClose}
    >
      <form
        id="sales-transaction"
        className="sales-form"
        onSubmit={async (e) => {
          e.preventDefault()
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
            body = { version: order.version, customerAgreed: agreed, lines }
          } else if (action === 'payment' || action === 'refund') {
            const value = action === 'payment' ? recorded : Number(amount),
              limit = action === 'payment' ? order.payableNow : order.refundable
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
            path = action === 'payment' ? 'payments' : 'refunds'
            body = {
              amount: value,
              paymentMethod: method,
              transactionReference: text('reference') || null,
              verified,
              ...(action === 'payment'
                ? {
                    expectedPayable: order.payableNow,
                    tenderedAmount: method === 'CASH' ? cash : null,
                    evidence: [],
                  }
                : { expectedRefundable: order.refundable }),
            }
          } else if (action === 'credit') {
            if (!agreed) {
              setError('Cần xác nhận khách đồng ý số tiền và hạn trả.')
              return
            }
            body = {
              version: order.version,
              creditAmount: order.remainingPayable,
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
            onClose()
          } catch (error) {
            setError(inventoryError(error))
          } finally {
            lock.current = false
            setBusy(false)
          }
        }}
      >
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
                <p>○ Giá và biên lợi nhuận được BE kiểm tra khi xác nhận</p>
                <p>
                  {stockKnown
                    ? stockEnough
                      ? '✓ Tồn vừa tải đủ số giao'
                      : '! Số giao vượt tồn vừa tải'
                    : '○ Tồn khả dụng được kiểm tra khi xác nhận'}
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
                <div>
                  <dt>Đã thu trước</dt>
                  <dd>{money.format(order.netPaid)}</dd>
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
                . Số giao ít hơn yêu cầu sẽ tạo phiên bản mới. Nhu cầu còn thiếu
                được BE tổng hợp khi đơn hoàn tất.
              </p>
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
              <div>
                <dt>Đã thu</dt>
                <dd>{money.format(order.netPaid)}</dd>
              </div>
              <div>
                <dt>Còn phải thu</dt>
                <dd>{money.format(order.remainingPayable ?? 0)}</dd>
              </div>
            </dl>
            <fieldset className="sales-payment-methods">
              <legend>Hình thức</legend>
              <div>
                {[
                  ['CASH', 'Tiền mặt'],
                  ['BANK_TRANSFER', 'Chuyển khoản'],
                ].map(([value, label]) => (
                  <label
                    key={value}
                    className={method === value ? 'selected' : ''}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      value={value}
                      checked={method === value}
                      onChange={() => setMethod(value)}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>
            <label>
              {method === 'CASH' ? 'Số tiền khách đưa' : 'Số tiền chuyển khoản'}{' '}
              <span className="sales-required">*</span>
              <div className="sales-payment-amount">
                <input
                  required
                  inputMode="numeric"
                  aria-label={
                    method === 'CASH'
                      ? 'Số tiền khách đưa'
                      : 'Số tiền chuyển khoản'
                  }
                  value={
                    (method === 'CASH' ? cashGiven : amount) === ''
                      ? ''
                      : Number(
                          method === 'CASH' ? cashGiven : amount,
                        ).toLocaleString('vi-VN')
                  }
                  onChange={(e) => {
                    const value = e.target.value.replace(/[^0-9]/g, '')
                    if (method === 'CASH') setCashGiven(value)
                    else setAmount(value)
                  }}
                />
                <span>đ</span>
              </div>
            </label>
            <dl className="sales-payment-change">
              <div>
                <dt>Ghi thu cho đơn</dt>
                <dd>{validPayment ? money.format(recorded) : 'Chưa hợp lệ'}</dd>
              </div>
              <div>
                <dt>Tiền thối lại</dt>
                <dd>
                  {validPayment
                    ? money.format(
                        method === 'CASH' ? Math.max(0, cash - recorded) : 0,
                      )
                    : '—'}
                </dd>
              </div>
            </dl>
          </>
        )}
        {action === 'refund' && (
          <label>
            Số tiền hoàn (đ)
            <input
              required
              type="number"
              min="1"
              max={order.refundable ?? 0}
              step="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>
        )}
        {(action === 'payment' ||
          action === 'refund' ||
          (action === 'cancel' && order.netPaid > 0)) && (
          <>
            {action !== 'payment' && (
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
            )}
            {method === 'BANK_TRANSFER' && (
              <label>
                Mã giao dịch
                <input required name="reference" maxLength={100} />
              </label>
            )}
            <label>
              <input
                type="checkbox"
                checked={verified}
                onChange={(e) => setVerified(e.target.checked)}
              />
              {action === 'payment'
                ? 'Đã nhận đủ số tiền này'
                : 'Đã trả tiền cho khách'}
            </label>
          </>
        )}
        {action === 'credit' && (
          <>
            <p>Số tiền ghi nợ: {money.format(order.remainingPayable ?? 0)}</p>
            <label>
              Hạn trả
              <input required name="dueDate" type="date" min={today()} />
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
              value={paymentId ?? ''}
              onChange={(e) => setPaymentId(Number(e.target.value))}
            >
              <option value="">Chọn khoản tiền</option>
              {order.payments
                ?.filter((p) => p.status === 'UNVERIFIED')
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    #{p.id} · {money.format(p.amount)}
                  </option>
                ))}
            </select>
          </label>
        )}
        {(action === 'cancel' || action === 'reject') && (
          <label>
            Lý do *<textarea name="reason" required maxLength={255} />
          </label>
        )}
        {action === 'cancel' && order.netPaid > 0 && (
          <p>
            Cần hoàn {money.format(order.netPaid)} cho khách trong thao tác hủy.
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
