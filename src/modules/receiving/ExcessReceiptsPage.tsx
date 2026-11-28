import PageBackLink from '../../shared/ui/PageBackLink'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import axiosClient from '../../shared/api/axiosClient'
import { useLiveReload } from '../../shared/live/useLiveReload'
import { apiMessage } from '../suppliers/supplierService'
import { documentCode } from '../../shared/utils/documentCode'
import TransferExcessSection from '../transfers/TransferExcessSection'
import TransferWrongItemPendingSection from '../transfers/TransferWrongItemPendingSection'
import './receiving.css'

type Row = {
  id: number
  purchaseOrderId: number
  supplierName: string
  storeName: string
  deliveryDocumentNo: string | null
  confirmedAt: string | null
}

export default function ExcessReceiptsPage() {
  const [page, setPage] = useState(0)
  const [data, setData] = useState<{ items: Row[]; totalItems: number }>()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [liveRevision, setLiveRevision] = useState(0)
  const quietNext = useRef(false)
  useLiveReload(() => {
    quietNext.current = true
    setLiveRevision((n) => n + 1)
  })
  useEffect(() => {
    const quiet = quietNext.current
    quietNext.current = false
    const controller = new AbortController()
    const signal = controller.signal
    async function load() {
      if (!quiet) setLoading(true)
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
        if (!signal.aborted && !quiet) setError(apiMessage(error))
      } finally {
        if (!signal.aborted) setLoading(false)
      }
    }
    void load()
    return () => controller.abort()
  }, [page, liveRevision])
  return (
    <main className="dashboard-content receiving-page">
      <PageBackLink to="/purchase-orders" />
      <header className="receiving-heading">
        <h1>Chờ duyệt hàng thừa</h1>
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
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {data?.items.map((row) => (
                  <tr key={row.id}>
                    <td>
                      {documentCode('PN', row.id)}
                      {row.deliveryDocumentNo && (
                        <small> · Chứng từ {row.deliveryDocumentNo}</small>
                      )}
                    </td>
                    <td>{row.supplierName}</td>
                    <td>{row.storeName}</td>
                    <td>
                      {row.confirmedAt
                        ? new Date(row.confirmedAt).toLocaleDateString('vi-VN')
                        : '—'}
                    </td>
                    <td>
                      <div className="mf-row-actions">
                        <Link
                          className="mf-btn mf-btn--sm mf-btn--primary"
                          to={'/goods-receipt-notes/' + row.id}
                        >
                          Duyệt hàng thừa
                        </Link>
                      </div>
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
      {/* PM 22/11 (Q7) + BE #98: hàng thừa điều chuyển duyệt trên cùng màn với hàng thừa NCC. */}
      <TransferExcessSection />
      {/* PM 23/11: phiếu nhận hàng giao sai điều chuyển Owner xác nhận trên cùng màn. */}
      <TransferWrongItemPendingSection />
    </main>
  )
}
