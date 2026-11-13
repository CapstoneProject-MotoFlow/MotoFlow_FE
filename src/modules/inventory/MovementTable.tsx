import { useEffect, useState } from 'react'
import axiosClient from '../../shared/api/axiosClient'
import { mapConcurrent } from '../../shared/utils/mapConcurrent'
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
  sourceLabel,
  stockStatuses,
} from './presentation'
import type { Movement } from './types'
import { documentCode } from '../../shared/utils/documentCode'

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
export function SourceDocument({
  type,
  id,
  movementType,
}: {
  type: string
  id: number
  movementType?: string
}) {
  const [open, setOpen] = useState(false)
  const label = sourceLabel(type, id, movementType)
  return type === 'GOODS_RECEIPT_NOTE' ? (
    <>
      <button className="stock-text" onClick={() => setOpen(true)}>
        {label}
      </button>
      {open && (
        <ReceiptDialog id={id} title={label} onClose={() => setOpen(false)} />
      )}
    </>
  ) : type === 'STOCK_COUNT' ? (
    <Link to={'/stock-counts/' + id}>{label}</Link>
  ) : type === 'SALES_ORDER' ? (
    <Link to={'/sales-orders/' + id}>{label}</Link>
  ) : type === 'TRANSFER_ORDER' ? (
    <Link to={'/transfer-orders/' + id}>{label}</Link>
  ) : (
    <span>{label}</span>
  )
}
export function ReceiptDialog({
  id,
  title,
  onClose,
}: {
  id: number
  title?: string
  onClose: () => void
}) {
  const receipt = useInventoryData<Receipt>('/goods-receipt-notes/' + id)
  return (
    <FormDialog
      title={title ?? 'Phiếu nhập ' + documentCode('PN', id)}
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
              {receipt.data.supplierName && (
                <div>
                  <dt>Nhà cung cấp</dt>
                  <dd>{receipt.data.supplierName}</dd>
                </div>
              )}
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
  showBalance = false,
}: {
  rows: Movement[]
  empty?: string
  showBalance?: boolean
}) {
  const nameOf = usePartNames(rows)
  return (
    <div className="stock-table-scroll">
      <table className="stock-table">
        <thead>
          <tr>
            <th>Giờ</th>
            <th>Phụ tùng</th>
            <th>Loại biến động</th>
            <th title="Xuất điều chuyển trừ hàng có thể bán và cộng hàng đang chuyển; đây là hai trạng thái của cùng lượt chuyển.">
              Trạng thái tồn ⓘ
            </th>
            <th>Thay đổi</th>
            {showBalance && <th>Tồn sau</th>}
            <th>Lô</th>
            <th>Chứng từ gốc / người thực hiện</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <MovementRows
              key={row.id}
              row={row}
              partName={nameOf(row.productId)}
              showBalance={showBalance}
              day={
                index === 0 ||
                rows[index - 1].occurredAt.slice(0, 10) !==
                  row.occurredAt.slice(0, 10)
              }
            />
          ))}
          {!rows.length && (
            <tr>
              <td colSpan={showBalance ? 8 : 7} className="stock-empty">
                {empty}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
/**
 * Review T10: cột Phụ tùng hiện tên + SKU như màn Tồn kho. API lịch sử chỉ trả SKU, nên đọc tên theo mã phụ tùng
 * (tối đa số dòng một trang, nhớ lại tên đã đọc). Nên bổ sung partName vào StockMovementResponse ở BE.
 */
const partNames = new Map<number, string>()
function usePartNames(rows: Movement[]) {
  const [, setVersion] = useState(0)
  const missing = [...new Set(rows.map((row) => row.productId))].filter(
    (id) => !partNames.has(id),
  )
  const key = missing.join(',')
  useEffect(() => {
    if (!key) return
    let active = true
    void mapConcurrent(
      key.split(',').map(Number),
      4,
      async (id) => {
        try {
          const { data } = await axiosClient.get<{ partName: string }>(
            '/products/' + id,
          )
          partNames.set(id, data.partName)
        } catch {
          partNames.set(id, '')
        }
      },
      () => active,
    ).finally(() => {
      if (active) setVersion((value) => value + 1)
    })
    return () => {
      active = false
    }
  }, [key])
  return (id: number) => partNames.get(id)
}
function MovementRows({
  row,
  day,
  showBalance,
  partName,
}: {
  row: Movement
  day: boolean
  showBalance: boolean
  partName?: string
}) {
  return (
    <>
      {day && (
        <tr className="stock-day">
          <th colSpan={showBalance ? 8 : 7} scope="rowgroup">
            {date(row.occurredAt)}
          </th>
        </tr>
      )}
      <tr>
        {/* Ngày đã có ở dòng nhóm phía trên, ô này chỉ ghi giờ cho gọn (review C1). */}
        <td title={dateTime(row.occurredAt)}>
          {dateTime(row.occurredAt).slice(11) || dateTime(row.occurredAt)}
        </td>
        <td className="stock-movement-part">
          {partName ? (
            <>
              {partName}
              <small>{row.sku}</small>
            </>
          ) : (
            row.sku
          )}
        </td>
        <td>{movementNames[row.movementType] ?? row.movementType}</td>
        <td>{stockStatuses[row.stockStatus] ?? row.stockStatus}</td>
        <td
          className={row.quantityChange > 0 ? 'stock-positive' : 'stock-danger'}
        >
          {row.quantityChange > 0 ? '+' : ''}
          {number.format(row.quantityChange)}
        </td>
        {showBalance && <td>—</td>}
        <td>
          {row.lotId ? (
            <Link to={lotLink(row.lotId, row.storeId)}>
              {documentCode('L', row.lotId)}
            </Link>
          ) : (
            '—'
          )}
        </td>
        <td>
          <SourceDocument
            type={row.sourceType}
            id={row.sourceId}
            movementType={row.movementType}
          />
          <small>{row.performedByName ?? '—'}</small>
        </td>
      </tr>
    </>
  )
}
