import { formatDateTime, formatMoney } from '../../../shared/utils/format'
import type { DocumentPrint } from '../types'
import { amountAfterDeposit, settlementRows } from './printLayout'

type TotalRow = {
  label: string
  value: number | null | undefined
  /** Luôn hiện dù giá trị rỗng hoặc 0. */
  always?: boolean
  /** Không đặt thì hiện khi giá trị khác 0. */
  show?: boolean
  strong?: boolean
}

/** Phiếu nhiệt 80 mm cho bán lẻ: chỉ tên cửa hàng, không logo, không QR. */
export default function PrintSheetSmall({ data }: { data: DocumentPrint }) {
  const totals = data.totals
  const rows: TotalRow[] = [
    { label: 'Chiết khấu', value: totals?.discountAmount },
    { label: 'Tổng tiền', value: totals?.total, always: true },
    { label: 'Đã cọc', value: totals?.deposit },
    {
      label: 'Khách cần thanh toán',
      value: amountAfterDeposit(totals),
      always: true,
      strong: true,
    },
    ...settlementRows(totals),
  ]
  return (
    <article className="print-small" aria-label={'Bản in ' + data.number}>
      <p className="print-center">
        <strong>{data.store.name}</strong>
      </p>
      <p className="print-center">{data.title ?? 'Phiếu bán hàng'}</p>
      <p className="print-center">{data.number}</p>
      <p className="print-center">{formatDateTime(data.documentDate)}</p>
      {data.counterpart && <p>Khách: {data.counterpart.name}</p>}
      <div className="print-divider" />
      {data.lines.map((line) => (
        <div className="print-line" key={line.no}>
          <p>{line.partName}</p>
          <div className="print-row">
            <span>
              {line.quantity} × {formatMoney(line.unitPrice)}
            </span>
            <span>{formatMoney(line.amount)}</span>
          </div>
        </div>
      ))}
      <div className="print-divider" />
      {rows
        .filter(
          (row) =>
            row.always ||
            (row.show ?? (row.value != null && row.value !== 0)),
        )
        .map((row) => (
          <div
            className={row.strong ? 'print-row print-strong' : 'print-row'}
            key={row.label}
          >
            <span>{row.label}</span>
            <span>{formatMoney(row.value)}</span>
          </div>
        ))}
      <div className="print-divider" />
      <p>Người in: {data.printedBy}</p>
      <p className="print-center">Cảm ơn quý khách!</p>
    </article>
  )
}
