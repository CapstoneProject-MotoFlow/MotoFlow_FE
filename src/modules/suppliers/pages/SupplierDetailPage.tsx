/**
 * File: modules/suppliers/pages/SupplierDetailPage.tsx
 * Loại: MÀN HÌNH — Chi tiết nhà cung cấp.
 * Đường dẫn: /owner/suppliers/:id.
 * Công dụng: Thông tin chi tiết nhà cung cấp và các dữ liệu liên quan API cung cấp.
 */
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import axiosClient from '../../../shared/api/axiosClient'
import SupplierForm from '../components/SupplierForm'
import type { Supplier } from '../types'
import { apiMessage } from '../supplierService'
import '../suppliers.css'
import '../supplier-redesign.css'
type Detail = {
  supplier: Supplier
  purchaseOrderCount: number
  deliveryCount: number
  discrepancyCount: number
  openDiscrepancyCount: number
  purchaseOrders: {
    id: number
    storeName: string
    status: string
    orderedValue: number
    expectedArrival: string | null
    createdAt: string
    lineCount: number
  }[]
  deliveries: {
    id: number
    purchaseOrderId: number
    deliveryDocumentNo: string | null
    status: string
    arrivedAt: string
    confirmedAt: string | null
  }[]
  discrepancies: {
    id: number
    deliveryId: number
    productId: number
    sku: string
    partName: string
    status: string
    shortQty: number
    wrongItemQty: number
    damagedQty: number
    rejectedExcessQty: number
    openedAt: string
    closedAt: string | null
  }[]
}
const labels: Record<string, string> = {
  AWAITING_DELIVERY: 'Chờ giao hàng',
  RECEIVING: 'Đang nhận hàng',
  FULLY_RECEIVED: 'Đã nhận đủ',
  CANCELLED: 'Đã hủy',
  AWAITING_INSPECTION: 'Chờ kiểm nhận',
  AWAITING_CONFIRMATION: 'Chờ xác nhận',
  AWAITING_RECOUNT: 'Chờ kiểm đếm lại',
  CONFIRMED: 'Đã xác nhận',
  OPEN: 'Chưa đóng',
  CLOSED: 'Đã đóng',
}
const date = (value: string | null) =>
  value ? new Date(value).toLocaleDateString('vi-VN') : '—'
/** SupplierDetailPage: Thông tin chi tiết nhà cung cấp và các dữ liệu liên quan API cung cấp. */
export default function SupplierDetailPage() {
  const { id } = useParams()
  const [data, setData] = useState<Detail | null>(null)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const [editing, setEditing] = useState(false)
  const [tab, setTab] = useState('orders')
  const [orderStatus, setOrderStatus] = useState('open')
  useEffect(() => {
    let active = true
    setError('')
    setData(null)
    axiosClient
      .get<Detail>(`/suppliers/${id}`)
      .then((r) => {
        if (active) setData(r.data)
      })
      .catch((e) => {
        if (active) setError(apiMessage(e))
      })
    return () => {
      active = false
    }
  }, [id, revision])
  return (
    <main className="dashboard-content suppliers-page supplier-redesign supplier-detail-page">
      <div className="suppliers-page-heading">
        <h1>{data?.supplier.supplierName || 'Chi tiết nhà cung cấp'}</h1>
        <nav>
          <Link to="/dashboard">Trang chủ</Link> ›{' '}
          <Link to="/owner/suppliers">Nhà cung cấp</Link> › Chi tiết
        </nav>
      </div>
      {error ? (
        <p role="alert">
          {error}
          <button onClick={() => setRevision((x) => x + 1)}>Thử lại</button>
        </p>
      ) : !data ? (
        <p>Đang tải…</p>
      ) : (
        <>
          <section className="supplier-profile">
            <header>
              <span className="supplier-avatar">
                {data.supplier.supplierName
                  .split(' ')
                  .slice(-2)
                  .map((x) => x[0])
                  .join('')}
              </span>
              <div>
                <strong>{data.supplier.supplierName}</strong>
                <small>{data.supplier.address || 'Chưa có địa chỉ'}</small>
              </div>
              <span
                className={
                  'supplier-state ' + data.supplier.status.toLowerCase()
                }
              >
                {data.supplier.status === 'ACTIVE'
                  ? 'Đang giao dịch'
                  : 'Ngừng giao dịch'}
              </span>
              <button
                className="secondary-button"
                onClick={() => setEditing(true)}
              >
                ✎ Sửa
              </button>
            </header>
            <dl>
              {[
                ['Người liên hệ', data.supplier.contactName],
                ['Điện thoại', data.supplier.phone],
                ['Email', data.supplier.email],
                ['Mã số thuế', data.supplier.taxCode],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value || '—'}</dd>
                </div>
              ))}
            </dl>
            <dl>
              {[
                ['Phiếu đang mở', '—'],
                ['Giá trị chưa nhận', '—'],
                ['Đã nhận trong năm', '—'],
                ['Sai lệch chưa đóng', String(data.openDiscrepancyCount)],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            <small className="supplier-data-note">
              Các chỉ số “—” chưa được hệ thống cung cấp.
            </small>
          </section>
          <section className="suppliers-panel supplier-transactions">
            <header>
              <h2>Giao dịch với nhà cung cấp</h2>
              <div className="supplier-tabs">
                {[
                  ['orders', 'Phiếu nhập hàng'],
                  ['deliveries', 'Các lần giao hàng'],
                  [
                    'discrepancies',
                    `Hàng giao sai lệch (${data.openDiscrepancyCount})`,
                  ],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    aria-pressed={tab === key}
                    onClick={() => setTab(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </header>
            {tab === 'orders' && (
              <>
                <div className="supplier-filter">
                  <select
                    aria-label="Lọc phiếu"
                    value={orderStatus}
                    onChange={(e) => setOrderStatus(e.target.value)}
                  >
                    <option value="open">Đang mở</option>
                    <option value="FULLY_RECEIVED">Đã nhận đủ</option>
                    <option value="CANCELLED">Đã hủy</option>
                    <option value="all">Tất cả trạng thái</option>
                  </select>
                </div>
                <div className="table-scroll">
                  <table className="suppliers-table">
                    <thead>
                      <tr>
                        <th>Phiếu</th>
                        <th>Số dòng</th>
                        <th>Kho nhận</th>
                        <th>Ngày lập</th>
                        <th>Giao dự kiến</th>
                        <th>Giá trị</th>
                        <th>Chưa nhận</th>
                        <th>Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.purchaseOrders
                        .filter(
                          (x) =>
                            orderStatus === 'all' ||
                            (orderStatus === 'open'
                              ? ['AWAITING_DELIVERY', 'RECEIVING'].includes(
                                  x.status,
                                )
                              : x.status === orderStatus),
                        )
                        .map((x) => (
                          <tr key={x.id}>
                            <td>#{x.id}</td>
                            <td>{x.lineCount}</td>
                            <td>{x.storeName}</td>
                            <td>{date(x.createdAt)}</td>
                            <td>{date(x.expectedArrival)}</td>
                            <td>{x.orderedValue.toLocaleString('vi-VN')} ₫</td>
                            <td>—</td>
                            <td>
                              <span
                                className={
                                  'supplier-state order-' +
                                  x.status.toLowerCase()
                                }
                              >
                                {labels[x.status] || x.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
                <p className="supplier-data-note">
                  Hiển thị các phiếu gần nhất API trả về; tổng cộng{' '}
                  {data.purchaseOrderCount} phiếu.
                </p>
              </>
            )}
            {tab === 'deliveries' && (
              <div className="table-scroll">
                <table className="suppliers-table">
                  <thead>
                    <tr>
                      <th>Lượt nhận</th>
                      <th>Phiếu nhập hàng</th>
                      <th>Chứng từ giao</th>
                      <th>Hàng đến</th>
                      <th>Xác nhận lúc</th>
                      <th>Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.deliveries.map((x) => (
                      <tr key={x.id}>
                        <td>#{x.id}</td>
                        <td>#{x.purchaseOrderId}</td>
                        <td>{x.deliveryDocumentNo || '—'}</td>
                        <td>{date(x.arrivedAt)}</td>
                        <td>
                          {x.confirmedAt
                            ? new Date(x.confirmedAt).toLocaleString('vi-VN')
                            : '—'}
                        </td>
                        <td>{labels[x.status] || x.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="supplier-data-note">
                  Tổng cộng {data.deliveryCount} lượt nhận.
                </p>
              </div>
            )}
            {tab === 'discrepancies' && (
              <div className="table-scroll">
                <table className="suppliers-table">
                  <thead>
                    <tr>
                      <th>Phụ tùng</th>
                      <th>Lượt nhận</th>
                      <th>Thiếu</th>
                      <th>Sai</th>
                      <th>Hỏng</th>
                      <th>Thừa bị từ chối</th>
                      <th>Ngày mở / đóng</th>
                      <th>Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.discrepancies.map((x) => (
                      <tr key={x.id}>
                        <td>
                          <Link to={`/owner/products/${x.productId}`}>
                            {x.partName}
                          </Link>
                          <small>{x.sku}</small>
                        </td>
                        <td>#{x.deliveryId}</td>
                        <td>{x.shortQty}</td>
                        <td>{x.wrongItemQty}</td>
                        <td>{x.damagedQty}</td>
                        <td>{x.rejectedExcessQty}</td>
                        <td>
                          {date(x.openedAt)}
                          <small>
                            {x.closedAt
                              ? `Đóng: ${date(x.closedAt)}`
                              : 'Chưa đóng'}
                          </small>
                        </td>
                        <td>{labels[x.status] || x.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!data.discrepancies.length && (
                  <p className="supplier-data-note">Chưa có sai lệch.</p>
                )}
                <p className="supplier-data-note">
                  Tổng cộng {data.discrepancyCount} sai lệch;{' '}
                  {data.openDiscrepancyCount} chưa đóng. Danh sách hiển thị các
                  sai lệch gần nhất.
                </p>
              </div>
            )}
          </section>
          {editing && (
            <SupplierForm
              supplier={data.supplier}
              onClose={() => setEditing(false)}
              onSaved={() => {
                setEditing(false)
                setRevision((x) => x + 1)
              }}
            />
          )}
        </>
      )}
    </main>
  )
}
