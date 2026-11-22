import { formatDateTime, formatMoney } from '../../../shared/utils/format'
import { numberToVietnameseWords } from '../../../shared/utils/numberToVietnameseWords'
import { Table } from '../DocumentUi'
import type { DocumentPrint } from '../types'
import { amountAfterDeposit } from './printLayout'

/** Phiếu bán sỉ khổ A5, đủ thông tin thuế hai bên và chữ ký. */
export default function PrintSheetLarge({ data }: { data: DocumentPrint }) {
  const totals = data.totals
  const buyer = data.counterpart
  const due = amountAfterDeposit(totals)
  const payment =
    data.note === 'CREDIT' ? 'Ghi nợ' : data.note === 'PAID' ? 'Trả đủ' : ''
  return (
    <article className="print-a5" aria-label={'Bản in ' + data.number}>
      <h2 className="print-title">{data.title ?? 'Phiếu bán hàng'}</h2>
      <p className="print-center">
        Số: {data.number} · Ngày {formatDateTime(data.documentDate)}
      </p>

      <div className="print-block">
        <p>Đơn vị bán hàng: {data.store.name}</p>
        <p>Mã số thuế: {data.store.taxCode ?? ''}</p>
        <p>Địa chỉ: {data.store.address ?? ''}</p>
        <p>Điện thoại: {data.store.phone ?? ''}</p>
      </div>

      <div className="print-block">
        <p>Họ tên người mua hàng: {buyer?.name ?? ''}</p>
        <p>
          Tên đơn vị: <span className="print-blank" />
        </p>
        <p>Mã số thuế: {buyer?.taxCode ?? ''}</p>
        <p>Địa chỉ: {buyer?.address ?? ''}</p>
        <p>Hình thức thanh toán: {payment}</p>
      </div>

      <Table
        label="Nội dung hàng hóa"
        headers={['STT', 'Tên hàng', 'ĐVT', 'SL', 'Đơn giá', 'Thành tiền']}
      >
        {data.lines.map((line) => (
          <tr key={line.no}>
            <td>{line.no}</td>
            <td>{line.partName}</td>
            <td>{line.baseUnit}</td>
            <td>{line.quantity}</td>
            <td>{formatMoney(line.unitPrice)}</td>
            <td>{formatMoney(line.amount)}</td>
          </tr>
        ))}
      </Table>

      <div className="print-summary">
        <div className="print-row">
          <span>Cộng tiền hàng (giá niêm yết)</span>
          <span>{formatMoney(totals?.referenceTotal)}</span>
        </div>
        {!!totals?.discountAmount && (
          <div className="print-row">
            <span>
              Chiết khấu
              {totals.discountRate ? ` (${totals.discountRate}%)` : ''}
            </span>
            <span>{formatMoney(totals.discountAmount)}</span>
          </div>
        )}
        <div className="print-row">
          <span>Tổng tiền</span>
          <span>{formatMoney(totals?.total)}</span>
        </div>
        {!!totals?.deposit && (
          <div className="print-row">
            <span>Đã cọc</span>
            <span>{formatMoney(totals.deposit)}</span>
          </div>
        )}
        <div className="print-row print-strong">
          <span>Còn phải trả</span>
          <span>{formatMoney(due)}</span>
        </div>
      </div>

      <p>Số tiền bằng chữ: {numberToVietnameseWords(due)}</p>

      <div className="print-signatures">
        <div>
          <strong>Người mua hàng</strong>
          <p>(Ký, ghi rõ họ tên)</p>
        </div>
        <div>
          <strong>Người bán hàng</strong>
          <p>(Ký, ghi rõ họ tên)</p>
        </div>
      </div>
    </article>
  )
}
