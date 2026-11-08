import { useState } from 'react'
import { useInventoryData } from '../inventory/api'
import type { OrderDto } from './salesApi'
import { dateTime, money } from '../inventory/presentation'
type Version = {
  version: number
  savedAt: string
  savedBy: string
  cause: string
  customerName: string | null
  total: number
  lines: {
    productId: number
    sku: string
    partName: string
    requestedQty: number
    deliveredQty: number | null
    actualUnitPrice: number
  }[]
}
export default function SalesVersions({ id }: { id: number }) {
  const [open, setOpen] = useState(false)
  const data = useInventoryData<Version[]>(
    '/sales-orders/' + id + '/versions',
    {},
    0,
    open,
  )
  return (
    <section className="sales-payment-card">
      <h2>
        <button onClick={() => setOpen(!open)} aria-expanded={open}>
          Lịch sử phiên bản
        </button>
      </h2>
      {open && (
        <>
          {data.loading && <p role="status">Đang tải…</p>}
          {data.error && <p role="alert">{data.error}</p>}
          {data.data?.map((v) => (
            <details key={v.version}>
              <summary>
                Phiên bản {v.version} · {dateTime(v.savedAt)} · {v.savedBy} ·{' '}
                {money.format(v.total)}
              </summary>
              <p>
                {v.customerName ?? 'Khách lẻ'} ·{' '}
                {v.cause === 'DELIVERY'
                  ? 'Thay đổi số giao'
                  : v.cause === 'UPDATE'
                    ? 'Sửa đơn'
                    : 'Tạo đơn'}
              </p>
              <div className="stock-table-scroll">
                <table className="stock-table">
                  <thead>
                    <tr>
                      <th>Phụ tùng</th>
                      <th>Yêu cầu</th>
                      <th>Giao</th>
                      <th>Đơn giá</th>
                    </tr>
                  </thead>
                  <tbody>
                    {v.lines.map((l) => (
                      <tr key={l.productId}>
                        <td>
                          {l.partName}
                          <small>{l.sku}</small>
                        </td>
                        <td>{l.requestedQty}</td>
                        <td>{l.deliveredQty ?? '—'}</td>
                        <td>{money.format(l.actualUnitPrice)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          ))}
        </>
      )}
    </section>
  )
}
export type { OrderDto }
