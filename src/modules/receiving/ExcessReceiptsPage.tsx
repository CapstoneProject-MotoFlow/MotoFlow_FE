import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import axiosClient from '../../shared/api/axiosClient'
import { apiMessage } from '../suppliers/supplierService'
import './receiving.css'

type Row = {
  id: number
  purchaseOrderId: number
  supplierName: string
  storeName: string
  deliveryDocumentNo: string
  confirmedAt: string | null
}

export default function ExcessReceiptsPage() {
  const [page, setPage] = useState(0)
  const [data, setData] = useState<{ items: Row[]; totalItems: number }>()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    const controller = new AbortController()
    const signal = controller.signal
    async function load() {
      setLoading(true)
      try {
        const response = await axiosClient.get<{
          items: Row[]
          totalItems: number
        }>('/goods-receipt-notes', {
          params: { excessAwaiting: true, page, size: 20 },
          signal,
        })
        if (!signal.aborted) {
          setData(response.data)
          setError('')
        }
      } catch (error) {
        if (!signal.aborted) setError(apiMessage(error))
      } finally {
        if (!signal.aborted) setLoading(false)
      }
    }
    void load()
    return () => controller.abort()
  }, [page])
  return (
    <main className="dashboard-content receiving-page">
      <header className="receiving-heading">
        <h1>Chờ duyệt hàng thừa</h1>
        <Link to="/purchase-orders">Yêu cầu nhập hàng</Link>
      </header>
      {loading && <p role="status">Đang tải phiếu…</p>}
      {error && <p role="alert">{error}</p>}
      {!loading && !error && (
        <section className="receiving-panel">
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Phiếu nhập</th>
                  <th>Nhà cung cấp</th>
                  <th>Kho nhận</th>
                  <th>Ngày xác nhận</th>
                  <th>Cần làm</th>
                </tr>
              </thead>
              <tbody>
                {data?.items.map((row) => (
                  <tr key={row.id}>
                    <td>{row.deliveryDocumentNo}</td>
                    <td>{row.supplierName}</td>
                    <td>{row.storeName}</td>
                    <td>
                      {row.confirmedAt
                        ? new Date(row.confirmedAt).toLocaleDateString('vi-VN')
                        : '—'}
                    </td>
                    <td>
                      <Link
                        className="receiving-layout-primary"
                        to={'/goods-receipt-notes/' + row.id}
                      >
                        Duyệt hàng thừa
                      </Link>
                    </td>
                  </tr>
                ))}
                {!data?.items.length && (
                  <tr>
                    <td colSpan={5} className="receiving-empty-cell">
                      Không có phiếu chờ duyệt hàng thừa.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {!!data?.totalItems && (
            <div className="receiving-pagination">
              <span>{data.totalItems} phiếu</span>
              <button
                type="button"
                disabled={!page}
                onClick={() => setPage(page - 1)}
              >
                Trang trước
              </button>
              <span>Trang {page + 1}</span>
              <button
                type="button"
                disabled={(page + 1) * 20 >= data.totalItems}
                onClick={() => setPage(page + 1)}
              >
                Trang sau
              </button>
            </div>
          )}
        </section>
      )}
    </main>
  )
}
