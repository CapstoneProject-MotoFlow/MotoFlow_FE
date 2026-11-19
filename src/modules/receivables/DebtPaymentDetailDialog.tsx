/**
 * File: modules/receivables/DebtPaymentDetailDialog.tsx
 * Loại: THÀNH PHẦN / XỬ LÝ HỖ TRỢ — popup, không phải màn hình độc lập.
 * Công dụng: Mục 10 (PM 19/11): popup "Chi tiết phiếu thu" của Lịch sử thu nợ. Bảng chỉ ghi Tiền mặt / Chuyển khoản;
 * mã giao dịch, chứng từ, khách đưa/tiền thối và phần trừ vào từng khoản nợ xem ở đây.
 */
import type { ReactNode } from 'react'
import FormDialog from '../../shared/ui/FormDialog'
import { dateTime, money } from '../inventory/presentation'
import DebtEvidence from './DebtEvidence'
import type { DebtPayment } from './types'

export default function DebtPaymentDetailDialog({
  payment,
  source,
  onClose,
}: {
  payment: DebtPayment
  /** Tên khoản nợ (số đơn bán hoặc nợ đầu kỳ) theo receivableId. */
  source: (receivableId: number) => string
  onClose: () => void
}) {
  const cash = payment.paymentMethod === 'CASH'
  const facts: [string, ReactNode][] = [
    ['Lúc', dateTime(payment.recordedAt)],
    ['Người ghi', payment.recordedBy],
    ['Cửa hàng', payment.storeName],
    ['Hình thức', cash ? 'Tiền mặt' : 'Chuyển khoản'],
    ...(cash
      ? []
      : ([['Mã giao dịch', payment.transactionReference || '—']] as [
          string,
          ReactNode,
        ][])),
    ['Số tiền', <strong key="amount">{money.format(payment.amount)}</strong>],
    ...(payment.tenderedAmount == null
      ? []
      : ([
          ['Khách đưa', money.format(payment.tenderedAmount)],
          ['Tiền thối', money.format(payment.changeAmount ?? 0)],
        ] as [string, ReactNode][])),
    [
      'Xác minh',
      payment.status === 'VERIFIED'
        ? 'Đã xác minh'
        : payment.status === 'REJECTED'
          ? 'Đã từ chối'
          : 'Chưa xác minh',
    ],
  ]
  return (
    <FormDialog
      title={'Chi tiết phiếu thu #' + payment.id}
      formId="debt-payment-detail"
      submitLabel=""
      hideSubmit
      closeLabel="Đóng"
      className="rv-payment-dialog"
      onClose={onClose}
    >
      <dl className="rv-payment-facts">
        {facts.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <h3 className="rv-payment-subtitle">Trừ vào</h3>
      <ul className="rv-payment-allocations">
        {payment.allocations.map((allocation) => (
          <li key={allocation.receivableId}>
            <span>
              {source(allocation.receivableId)}
              <small>
                Còn nợ hiện tại: {money.format(allocation.remainingAmount)}
              </small>
            </span>
            <strong>{money.format(allocation.allocatedAmount)}</strong>
          </li>
        ))}
      </ul>
      <h3 className="rv-payment-subtitle">Chứng từ</h3>
      {payment.evidence.length ? (
        <DebtEvidence files={payment.evidence} />
      ) : (
        <p className="rv-payment-none">Không có chứng từ.</p>
      )}
    </FormDialog>
  )
}
