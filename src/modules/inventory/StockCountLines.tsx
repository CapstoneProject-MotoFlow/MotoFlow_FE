import { Link } from 'react-router-dom'
import {
  countDifference,
  type CountLine,
  type StockCount,
} from './stockCountModel'
import { date, lotLink, money } from './presentation'
export function StockCountLines({
  count,
  role,
  lines,
}: {
  count?: StockCount
  role: string
  lines?: CountLine[]
}) {
  const staff = role === 'STAFF',
    owner = role === 'OWNER',
    opening = count?.type === 'OPENING'
  const columns = staff ? 3 : opening ? (owner ? 4 : 3) : owner ? 5 : 4
  return (
    <div className="stock-table-scroll">
      <table className="stock-table">
        <thead>
          <tr>
            <th>Phụ tùng / lô / hạn dùng</th>
            {staff ? <th>Vị trí</th> : !opening && <th>Sổ sách</th>}
            <th>Số đếm</th>
            {!staff &&
              (opening ? (
                <>
                  {owner && <th>Giá vốn ban đầu</th>}
                  <th>Lô tạo ra</th>
                </>
              ) : (
                <>
                  <th>Chênh lệch</th>
                  {owner && <th>Giá trị chênh lệch</th>}
                </>
              ))}
          </tr>
        </thead>
        <tbody>
          {lines?.map((line) => {
            const diff =
              count?.status === 'DRAFT' ? null : countDifference(line)
            return (
              <tr key={line.id}>
                <td>
                  {line.partName}
                  <small>{line.sku}</small>
                  {line.lotCode && (
                    <strong className="count-lot">
                      Lô {line.lotCode} · HSD {date(line.expiryDate)}
                    </strong>
                  )}
                  {!staff && (line.reason || line.note) && (
                    <small>
                      {line.reason
                        ? 'Nguyên nhân: ' + line.reason
                        : 'Staff ghi: ' + line.note}
                    </small>
                  )}
                </td>
                {staff ? (
                  <td>{line.binLocation ?? '—'}</td>
                ) : (
                  !opening && (
                    <td>
                      {count?.status === 'DRAFT' ? '—' : (line.bookQty ?? '—')}
                    </td>
                  )
                )}
                <td>
                  {line.countedQty ??
                    (line.recount ? 'Cần đếm lại' : 'Chưa đếm')}
                </td>
                {!staff &&
                  (opening ? (
                    <>
                      {owner && (
                        <td>
                          {line.unitCost == null
                            ? 'Chưa nhập'
                            : money.format(line.unitCost)}
                        </td>
                      )}
                      <td>
                        {line.createdLotId && count ? (
                          <Link to={lotLink(line.createdLotId, count.storeId)}>
                            L-{String(line.createdLotId).padStart(4, '0')}
                          </Link>
                        ) : count?.status === 'COMPLETED' ? (
                          '—'
                        ) : (
                          'Khi duyệt'
                        )}
                      </td>
                    </>
                  ) : (
                    <>
                      <td>
                        {diff == null ? '—' : (diff > 0 ? '+' : '') + diff}
                      </td>
                      {owner && (
                        <td>
                          {diff == null || line.unitCost == null
                            ? '—'
                            : money.format(diff * line.unitCost)}
                        </td>
                      )}
                    </>
                  ))}
              </tr>
            )
          })}
          {!lines?.length && (
            <tr>
              <td colSpan={columns} className="stock-empty">
                Chưa có dòng kiểm kê để hiển thị.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
