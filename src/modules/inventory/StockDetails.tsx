import { useState } from 'react'
import { Link } from 'react-router-dom'
import FormDialog from '../../shared/ui/FormDialog'
import { useInventoryData } from './api'
import { InventoryNotice, LotState } from './components'
import {
  date,
  lotLink,
  money,
  sourceNames,
  stockStatuses,
} from './presentation'
import type { StockDetail, StockRow } from './types'

import { documentCode } from '../../shared/utils/documentCode'
export function StockLots({ row, owner }: { row: StockRow; owner: boolean }) {
  const detail = useInventoryData<StockDetail>(
    '/inventory/stock/' + row.storeId + '/' + row.productId,
  )
  return (
    <div className="stock-expanded">
      <InventoryNotice loading={detail.loading} error={detail.error} />
      {detail.data && (
        <>
          <div className="stock-lot-heading">
            <h3>Tồn theo lô · {row.storeName}</h3>
            {owner && <AvailabilityButton row={row} />}
            {owner && (
              <span>
                Giá vốn bình quân:{' '}
                {detail.data.movingAvgCost == null
                  ? '—'
                  : money.format(detail.data.movingAvgCost)}
              </span>
            )}
          </div>
          <div className="stock-table-scroll">
            <table className="stock-table">
              <thead>
                <tr>
                  <th>Lô</th>
                  <th>Nguồn</th>
                  <th>Ngày nhận</th>
                  <th>Hạn dùng</th>
                  <th>Trạng thái tồn</th>
                  <th>Số lượng</th>
                  {owner && <th>Giá vốn lô</th>}
                  <th>Cảnh báo</th>
                </tr>
              </thead>
              <tbody>
                {detail.data.lots.map((lot) => (
                  <tr key={lot.lotId + lot.stockStatus}>
                    <td>
                      <Link to={lotLink(lot.lotId, row.storeId)}>
                        {documentCode('L', lot.lotId)}
                      </Link>
                      <small>{lot.manufacturerLotNo}</small>
                    </td>
                    <td>{lot.supplierName ?? sourceNames[lot.sourceType]}</td>
                    <td>{date(lot.receivedDate)}</td>
                    <td>{date(lot.expiryDate)}</td>
                    <td>{stockStatuses[lot.stockStatus] ?? lot.stockStatus}</td>
                    <td>
                      {lot.quantity} {row.baseUnit}
                    </td>
                    {owner && (
                      <td>
                        {lot.purchaseUnitPrice == null
                          ? '—'
                          : money.format(lot.purchaseUnitPrice)}
                      </td>
                    )}
                    <td>
                      <LotState state={lot.expiryState} />
                    </td>
                  </tr>
                ))}
                {!detail.data.lots.length && (
                  <tr>
                    <td colSpan={owner ? 8 : 7} className="stock-empty">
                      Chưa có lô hàng tại kho này.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

type AvailabilityProduct = Pick<
  StockRow,
  'productId' | 'partName' | 'sku' | 'baseUnit'
>
export function AvailabilityButton({
  row,
  label = 'Liên kho',
}: {
  row: AvailabilityProduct
  label?: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        {label}
      </button>
      {open && <AvailabilityDialog row={row} onClose={() => setOpen(false)} />}
    </>
  )
}
function AvailabilityDialog({
  row,
  onClose,
}: {
  row: AvailabilityProduct
  onClose: () => void
}) {
  const resource = useInventoryData<
    {
      productId: number
      storeId: number
      storeName: string
      sellableQty: number
      central: boolean
    }[]
  >('/inventory/availability', { productIds: row.productId })
  return (
    <FormDialog
      title={'Tra tồn liên kho · ' + row.partName}
      formId="stock-availability"
      submitLabel="Đóng"
      onClose={onClose}
    >
      <form
        id="stock-availability"
        onSubmit={(event) => {
          event.preventDefault()
          onClose()
        }}
      >
        <InventoryNotice loading={resource.loading} error={resource.error} />
        <p>Chỉ tính hàng có thể bán, không bao gồm hàng hết hạn.</p>
        {resource.data && (
          <table className="stock-table">
            <thead>
              <tr>
                <th>Kho</th>
                <th>Có thể bán</th>
              </tr>
            </thead>
            <tbody>
              {!resource.data.length && (
                <tr>
                  <td colSpan={2}>
                    Chưa có kho đang hoạt động có hàng có thể bán.
                  </td>
                </tr>
              )}
              {resource.data.map((item) => (
                <tr key={item.storeId}>
                  <td>
                    <Link
                      to={
                        '/inventory?storeId=' +
                        item.storeId +
                        '&q=' +
                        encodeURIComponent(row.sku)
                      }
                    >
                      {item.storeName}
                    </Link>
                  </td>
                  <td>
                    {item.sellableQty} {row.baseUnit}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </form>
    </FormDialog>
  )
}
