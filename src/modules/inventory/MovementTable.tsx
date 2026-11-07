import { useState } from 'react'
import { Link } from 'react-router-dom'
import FormDialog from '../../shared/ui/FormDialog'
import { useInventoryData } from './api'
import { InventoryNotice } from './components'
import {
  date,
  dateTime,
  lotLink,
  movementNames,
  number,
  sourceNames,
  stockStatuses,
} from './presentation'
import type { Movement } from './types'

type Receipt = {
  id: number
  supplierName: string
  storeName: string
  deliveryDocumentNo: string
  deliveryDocumentDate: string | null
  arrivedAt: string
  assignee: { fullName: string } | null
  recordedByName: string | null
  confirmedByName: string | null
  lines: {
    id: number
    sku: string
    partName: string
    documentQty: number
    deliveredQty: number
    passedQty: number
    wrongItemQty: number
    damagedQty: number
  }[]
}
export function SourceDocument({ type, id }: { type: string; id: number }) {
  const [open, setOpen] = useState(false)
  const label = (sourceNames[type] ?? type) + ' #' + id
  return type === 'GOODS_RECEIPT_NOTE' ? (
    <>
      <button className="stock-text" onClick={() => setOpen(true)}>
        {label}
      </button>
      {open && <ReceiptDialog id={id} onClose={() => setOpen(false)} />}
    </>
  ) : (
    <span>{label}</span>
  )
}
function ReceiptDialog({ id, onClose }: { id: number; onClose: () => void }) {
  const receipt = useInventoryData<Receipt>('/goods-receipt-notes/' + id)
  return (
    <FormDialog
      title={'Phiếu nhập #' + id}
      formId="stock-source"
      submitLabel="Đóng"
      onClose={onClose}
    >
      <form
        id="stock-source"
        onSubmit={(e) => {
          e.preventDefault()
          onClose()
        }}
      >
        <InventoryNotice loading={receipt.loading} error={receipt.error} />
        {receipt.data && (
          <>
            <dl className="stock-facts">
              <div>
                <dt>Nhà cung cấp</dt>
                <dd>{receipt.data.supplierName}</dd>
              </div>
              <div>
                <dt>Kho nhận</dt>
                <dd>{receipt.data.storeName}</dd>
              </div>
              <div>
                <dt>Chứng từ giao hàng</dt>
                <dd>
                  {receipt.data.deliveryDocumentNo} ·{' '}
                  {date(receipt.data.deliveryDocumentDate)}
                </dd>
              </div>
              <div>
                <dt>Hàng đến</dt>
                <dd>{dateTime(receipt.data.arrivedAt)}</dd>
              </div>
              <div>
                <dt>Kiểm nhận</dt>
                <dd>
                  {receipt.data.assignee?.fullName ??
                    receipt.data.recordedByName ??
                    '—'}
                </dd>
              </div>
              <div>
                <dt>Người xác nhận</dt>
                <dd>{receipt.data.confirmedByName ?? '—'}</dd>
              </div>
            </dl>
            <div className="stock-table-scroll">
              <table className="stock-table">
                <thead>
                  <tr>
                    <th>Phụ tùng</th>
                    <th>Chứng từ</th>
                    <th>Thực giao</th>
                    <th>Đạt</th>
                    <th>Sai</th>
                    <th>Hỏng</th>
                  </tr>
                </thead>
                <tbody>
                  {receipt.data.lines.map((line) => (
                    <tr key={line.id}>
                      <td>
                        {line.partName}
                        <small>{line.sku}</small>
                      </td>
                      <td>{line.documentQty}</td>
                      <td>{line.deliveredQty}</td>
                      <td>{line.passedQty}</td>
                      <td>{line.wrongItemQty}</td>
                      <td>{line.damagedQty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </form>
    </FormDialog>
  )
}
export function MovementTable({
  rows,
  empty = 'Chưa có biến động trong khoảng ngày này.',
}: {
  rows: Movement[]
  empty?: string
}) {
  return (
    <div className="stock-table-scroll">
      <table className="stock-table">
        <thead>
          <tr>
            <th>Thời điểm</th>
            <th>Phụ tùng</th>
            <th>Loại biến động</th>
            <th title="Xuất điều chuyển trừ khả dụng và cộng đang điều chuyển; đây là hai trạng thái của cùng lượt chuyển.">
              Trạng thái tồn ⓘ
            </th>
            <th>Thay đổi</th>
            <th>Lô</th>
            <th>Chứng từ gốc / người thực hiện</th>
            <th>Ghi chú</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <MovementRows
              key={row.id}
              row={row}
              day={
                index === 0 ||
                rows[index - 1].occurredAt.slice(0, 10) !==
                  row.occurredAt.slice(0, 10)
              }
            />
          ))}
          {!rows.length && (
            <tr>
              <td colSpan={8} className="stock-empty">
                {empty}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
function MovementRows({ row, day }: { row: Movement; day: boolean }) {
  return (
    <>
      {day && (
        <tr className="stock-day">
          <th colSpan={8} scope="rowgroup">
            {date(row.occurredAt)}
          </th>
        </tr>
      )}
      <tr>
        <td>{dateTime(row.occurredAt)}</td>
        <td>{row.sku}</td>
        <td>{movementNames[row.movementType] ?? row.movementType}</td>
        <td>{stockStatuses[row.stockStatus] ?? row.stockStatus}</td>
        <td
          className={row.quantityChange > 0 ? 'stock-positive' : 'stock-danger'}
        >
          {row.quantityChange > 0 ? '+' : ''}
          {number.format(row.quantityChange)}
        </td>
        <td>
          {row.lotId ? (
            <Link to={lotLink(row.lotId, row.storeId)}>
              L-{String(row.lotId).padStart(4, '0')}
            </Link>
          ) : (
            '—'
          )}
        </td>
        <td>
          <SourceDocument type={row.sourceType} id={row.sourceId} />
          <small>{row.performedByName ?? '—'}</small>
        </td>
        <td>{row.reason ?? '—'}</td>
      </tr>
    </>
  )
}
