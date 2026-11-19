import { stockStatusLabels } from '../../shared/labels/status'
import { formatMoney } from '../../shared/utils/format'
import { Table } from './DocumentUi'
import type { AdjustmentEffects as Effects } from './types'

export default function AdjustmentEffects({ data }: { data: Effects }) {
  const showValue = data.stockLines.some((line) => line.value != null)
  return (
    <>
      {!!data.stockLines.length && (
        <Table
          label="Ảnh hưởng tồn kho"
          headers={[
            'Phụ tùng',
            'Hiện tại',
            'Chênh lệch',
            'Sau điều chỉnh',
            ...(showValue ? ['Giá trị'] : []),
          ]}
        >
          {data.stockLines.map((line, index) => (
            <tr key={index}>
              <td>
                {line.partName}
                <small>
                  {line.sku} ·{' '}
                  {stockStatusLabels[line.stockStatus] ?? line.stockStatus}
                  {/* Mục 7 (PM 19/11): bỏ cột Lô; hàng xử lý theo lô (có hạn dùng) ghi lô ở dòng phụ. */}
                  {(line.manufacturerLotNo || line.lotId) &&
                    ' · Lô ' + (line.manufacturerLotNo || '#' + line.lotId)}
                </small>
              </td>
              <td>
                {line.currentQty} {line.baseUnit}
              </td>
              <td>
                {line.quantityChange} {line.baseUnit}
              </td>
              <td>
                {line.afterQty} {line.baseUnit}
              </td>
              {showValue && <td>{formatMoney(line.value)}</td>}
            </tr>
          ))}
        </Table>
      )}
      {!!data.amountLines.length && (
        <Table
          label="Ảnh hưởng số tiền"
          headers={['Bản ghi', 'Đang ghi', 'Chênh lệch', 'Sau điều chỉnh']}
        >
          {data.amountLines.map((line, index) => (
            <tr key={index}>
              <td>{line.label}</td>
              <td>{formatMoney(line.before)}</td>
              <td>{formatMoney(line.amountChange)}</td>
              <td>{formatMoney(line.after)}</td>
            </tr>
          ))}
        </Table>
      )}
      {!data.stockLines.length && !data.amountLines.length && (
        <p className="docs-muted">Chưa có dòng điều chỉnh.</p>
      )}
      {data.totalValue != null && (
        <p className="docs-total">
          Chênh lệch tiền <strong>{formatMoney(data.totalValue)}</strong>
        </p>
      )}
    </>
  )
}
