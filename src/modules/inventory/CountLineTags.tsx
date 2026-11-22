import { isDamagedVariant } from '../../shared/utils/damagedVariant'
import { number } from './presentation'

/**
 * KH2 (GVHD 20/11): phiếu kiểm kê Khu hàng lỗi gồm hàng hỏng của các mã và mã hàng lỗi "<SKU>-M".
 * Nhãn cho biết dòng thuộc phần nào. Đếm mù (Staff) chỉ thấy loại, không thấy số sổ sách.
 */
export default function CountLineTags({
  line,
  blind,
}: {
  line: { sku: string; partName: string; bookDamagedQty?: number | null }
  blind?: boolean
}) {
  const variant = isDamagedVariant(line)
  const damaged = (line.bookDamagedQty ?? 0) > 0
  if (!variant && !damaged) return null
  return (
    <span className="count-line-tags">
      {variant && <small className="count-tag">Hàng lỗi</small>}
      {damaged && (
        <small className="count-tag">
          {blind
            ? 'Có hàng hỏng'
            : 'Hỏng (sổ) ' + number.format(line.bookDamagedQty ?? 0)}
        </small>
      )}
    </span>
  )
}
