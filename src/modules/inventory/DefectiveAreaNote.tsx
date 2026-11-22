import { Link } from 'react-router-dom'
import { damagedVariantBaseSku } from '../../shared/utils/damagedVariant'
import { number } from './presentation'
import type { StockRow } from './types'

/**
 * KH1 + BH7 (GVHD 20/11): dưới tên phụ tùng ở Tồn kho, hiện phần đang để ở Khu hàng lỗi (hỏng / sai / chờ trả)
 * và nhãn "Hàng lỗi của <SKU gốc>" cho mã biến thể "<SKU>-M".
 */
export default function DefectiveAreaNote({ rows }: { rows: StockRow[] }) {
  const first = rows[0]
  if (!first) return null
  const baseSku = damagedVariantBaseSku(first)
  const defective = rows.filter((row) => row.defectiveArea)
  const damaged = defective.reduce((sum, row) => sum + row.damagedQty, 0)
  const wrong = defective.reduce((sum, row) => sum + row.wrongItemQty, 0)
  const awaitingReturn = defective.reduce(
    (sum, row) => sum + row.awaitingSupplierReturnQty,
    0,
  )
  const held = damaged + wrong + awaitingReturn
  return (
    <>
      {baseSku && (
        <small className="stock-variant-label">
          Hàng lỗi của{' '}
          <Link to={'/inventory?q=' + encodeURIComponent(baseSku)}>
            {baseSku}
          </Link>
        </small>
      )}
      {held > 0 && (
        <small className="stock-defective-note">
          {defective[0].defectiveArea}: {number.format(held)} (
          {[
            damaged ? 'hỏng ' + number.format(damaged) : '',
            wrong ? 'sai ' + number.format(wrong) : '',
            awaitingReturn ? 'chờ trả ' + number.format(awaitingReturn) : '',
          ]
            .filter(Boolean)
            .join(' · ')}
          )
        </small>
      )}
    </>
  )
}
