import { paymentMethodLabels } from '../../../shared/labels/status'
import {
  formatDate,
  formatDateTime,
  formatMoney,
} from '../../../shared/utils/format'
import { Facts, Table } from '../DocumentUi'
import { printForms } from '../model'
import { paymentTitle } from './printLayout'
import type { DocumentPrint, PrintParty, PrintPayment } from '../types'

const paymentTypeLabels: Record<PrintPayment['paymentType'], string> = {
  ORDER_PAYMENT: 'Thu tiền đơn bán',
  REFUND: 'Hoàn tiền',
  DEBT_PAYMENT: 'Thu nợ',
  DEPOSIT: 'Thu tiền cọc',
  DEPOSIT_REFUND: 'Trả lại tiền cọc',
}

/** Amounts that leave the till are shown negative. */
const outgoingPaymentTypes: PrintPayment['paymentType'][] = [
  'REFUND',
  'DEPOSIT_REFUND',
]

function Party({ title, party }: { title: string; party: PrintParty }) {
  return (
    <div>
      <strong>
        {title} · {party.name}
      </strong>
      <p>{party.address}</p>
      {party.phone && <p>Điện thoại {party.phone}</p>}
      {party.taxCode && <p>Mã số thuế {party.taxCode}</p>}
    </div>
  )
}

/** Mẫu in chung cho mọi chứng từ (A4/khổ mặc định). */
export default function PrintSheetStandard({ data }: { data: DocumentPrint }) {
  const priced = data.lines.some(
    (line) => line.unitPrice != null || line.amount != null,
  )
  const lots = data.lines.some(
    (line) => line.lotId != null || line.manufacturerLotNo,
  )
  const payment = data.payment
  const totals = data.totals
  const amounts: [string, number | null | undefined][] = [
    ['Tổng theo giá tham chiếu', totals?.referenceTotal],
    ['Chiết khấu', totals?.discountAmount],
    ['Tổng tiền', totals?.total],
    ['Đã thu', totals?.paid],
    ['Ghi nợ', totals?.credit],
  ]
  const heading =
    data.form === 'PAYMENT_RECEIPT'
      ? paymentTitle(payment, printForms[data.form], data.title)
      : (data.title ?? printForms[data.form])
  const outgoing =
    payment != null && outgoingPaymentTypes.includes(payment.paymentType)
  return (
    <article className="docs-print-sheet" aria-label={'Bản in ' + data.number}>
      <div className="docs-print-title">
        <div>
          <strong>MotoFlow</strong>
          <p>{data.store.name}</p>
        </div>
        <div>
          <strong>{data.number}</strong>
          <p>{formatDateTime(data.documentDate)}</p>
        </div>
      </div>
      <h2>{heading}</h2>
      <div className="docs-print-parties">
        <Party title="Đơn vị lập" party={data.store} />
        {data.counterpart && <Party title="Đối tác" party={data.counterpart} />}
      </div>
      {!!data.lines.length && (
        <Table
          label="Nội dung bản in"
          headers={[
            'STT',
            'Phụ tùng',
            ...(lots ? ['Lô'] : []),
            'Đơn vị',
            'Số lượng',
            ...(priced ? ['Đơn giá', 'Thành tiền'] : []),
          ]}
        >
          {data.lines.map((line) => (
            <tr key={line.no}>
              <td>{line.no}</td>
              <td>
                {line.partName}
                <small>{line.sku}</small>
              </td>
              {lots && (
                <td>
                  {line.manufacturerLotNo ||
                    (line.lotId ? '#' + line.lotId : '—')}
                </td>
              )}
              <td>{line.baseUnit}</td>
              <td>{line.quantity}</td>
              {priced && (
                <>
                  <td>{formatMoney(line.unitPrice)}</td>
                  <td>{formatMoney(line.amount)}</td>
                </>
              )}
            </tr>
          ))}
        </Table>
      )}
      {totals && (
        <Facts
          items={amounts.map(([label, value]) => [
            label,
            value != null ? formatMoney(value) : null,
          ])}
        />
      )}
      {payment && (
        <Facts
          items={[
            [
              'Loại phiếu',
              paymentTypeLabels[payment.paymentType] ?? payment.paymentType,
            ],
            [
              'Hình thức thanh toán',
              paymentMethodLabels[payment.paymentMethod] ??
                payment.paymentMethod,
            ],
            [
              'Số tiền',
              formatMoney(outgoing ? -payment.amount : payment.amount),
            ],
            [
              'Khách đưa',
              payment.tenderedAmount != null
                ? formatMoney(payment.tenderedAmount)
                : null,
            ],
            [
              'Tiền trả lại',
              payment.changeGiven != null
                ? formatMoney(payment.changeGiven)
                : null,
            ],
            ['Mã giao dịch', payment.transactionReference],
            [
              'Hạn cọc',
              payment.depositExpiresOn
                ? formatDate(payment.depositExpiresOn)
                : null,
            ],
          ]}
        />
      )}
      {!!payment?.allocations.length && (
        <Table
          label="Phân bổ khoản thu"
          headers={['Đơn bán', 'Khoản nợ', 'Số tiền phân bổ']}
        >
          {payment.allocations.map((allocation) => (
            <tr key={allocation.receivableId}>
              <td>
                {allocation.salesOrderId
                  ? `Đơn bán #${allocation.salesOrderId}`
                  : '—'}
              </td>
              <td>#{allocation.receivableId}</td>
              <td>{formatMoney(allocation.amount)}</td>
            </tr>
          ))}
        </Table>
      )}
      {data.note && (
        <p>
          {data.documentType === 'SALES_ORDER'
            ? 'Hình thức: ' + (data.note === 'PAID' ? 'Trả đủ' : 'Ghi nợ')
            : data.documentType === 'GOODS_RECEIPT'
              ? 'Số chứng từ NCC: ' + data.note
              : 'Ghi chú: ' + data.note}
        </p>
      )}
      {/* Góp ý 23/11: phiếu thu tiền cọc không có ô ký. */}
      {!(
        data.documentType === 'PAYMENT' && payment?.paymentType === 'DEPOSIT'
      ) && (
        <div className="docs-signatures">
          <strong>Người lập</strong>
          <strong>Người giao / nhận</strong>
          <strong>Quản lý cửa hàng</strong>
        </div>
      )}
      <p className="docs-muted">
        In từ MotoFlow · {formatDateTime(data.printedAt)}
        {data.printedBy && ' · ' + data.printedBy}
      </p>
    </article>
  )
}
