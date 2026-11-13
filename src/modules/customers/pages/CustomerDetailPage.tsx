import { useInventoryData } from '../../inventory/api'
import type { DebtDetail } from '../../receivables/types'
import CustomerCreditActions from '../../receivables/CustomerCreditActions'
/**
 * File: modules/customers/pages/CustomerDetailPage.tsx
 * Loại: MÀN HÌNH — Chi tiết khách hàng / công nợ.
 * Đường dẫn: /owner/customers/:id/debts, /owner/customers/:id, /branch-manager/customers/:id/debts, /branch-manager/customers/:id.
 * Công dụng: Hồ sơ, công nợ, đơn, thanh toán, lịch sử mua chịu, nhu cầu chưa đáp ứng; PaymentTable là component con hiển thị giao dịch thanh toán.
 */
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../../../shared/hooks/useAuth'
import axiosClient from '../../../shared/api/axiosClient'
import CustomerForm from '../components/CustomerForm'
import type { Customer } from '../types'
import { apiMessage } from '../../suppliers/supplierService'
import { documentCode } from '../../../shared/utils/documentCode'
import {
  creditStatusLabels,
  paymentMethodLabels,
  paymentStatusLabels,
  salesOrderStatusLabels,
} from '../../../shared/labels/status'
import './customer-profile.css'
type Debt = {
  id: number
  originType: string
  storeName: string
  salesOrderId: number | null
  originalAmount: number
  remainingAmount: number
  recognizedAt: string
}
type Payment = {
  id: number
  paymentType: string
  salesOrderId: number | null
  amount: number
  paymentMethod: string
  status: string
  recordedAt: string
  receivableIds: number[]
}
type Data = {
  unmetDemand?: {
    sku: string
    partName: string
    missingQty: number
    salesOrderId: number
    storeId: number
    storeName: string
  }[]
  customer: Customer
  debts: Debt[]
  orders: {
    id: number
    storeName: string
    status: string
    total: number
    createdAt: string
    completionType: string | null
    completedAt: string | null
  }[]
  orderCount: number
  payments: Payment[]
  paymentCount: number
  creditHistory: {
    eventType: string
    reason: string
    decidedBy: string
    decidedAt: string
  }[]
}
const money = (n: number) => n.toLocaleString('vi-VN') + ' ₫'
const date = (value: string) => new Date(value).toLocaleDateString('vi-VN')
const credit = creditStatusLabels
const status: Record<string, string> = {
  ...salesOrderStatusLabels,
  ...paymentStatusLabels,
  ...paymentMethodLabels,
  ORDER_PAYMENT: 'Thanh toán đơn bán',
  DEBT_PAYMENT: 'Thu nợ',
  REFUND: 'Hoàn tiền',
  CREDIT_SALE: 'Mua chịu',
  OPENING_BALANCE: 'Nợ đầu kỳ',
  PAID: 'Thanh toán ngay',
  CREDIT: 'Mua chịu',
  GRANTED: 'Cấp quyền mua chịu',
  REVOKED: 'Thu hồi quyền mua chịu',
}
/** CustomerDetailPage: Hồ sơ, công nợ, đơn, thanh toán, lịch sử mua chịu, nhu cầu chưa đáp ứng; PaymentTable là component con hiển thị giao dịch thanh toán. */
export default function CustomerDetailPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const owner = user?.role === 'OWNER'
  const base = owner ? '/owner/customers' : '/branch-manager/customers'
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)
  const [revision, setRevision] = useState(0)
  const debtResource = useInventoryData<DebtDetail>(
    '/customers/' + id + '/debts',
    {},
    revision,
    !!id && ['OWNER', 'BRANCH_MANAGER'].includes(user?.role ?? ''),
  )
  const earliestDue = debtResource.data?.debts
    .filter((d) => d.remainingAmount > 0 && d.dueDate)
    .map((d) => d.dueDate)
    .sort()[0]

  useEffect(() => {
    let active = true
    setData(null)
    setError('')
    axiosClient
      .get<Data>(`/customers/${id}`)
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
  if (error)
    return (
      <main className="dashboard-content">
        <p role="alert">{error}</p>
        <button onClick={() => setRevision((x) => x + 1)}>Thử lại</button>
      </main>
    )
  if (!data)
    return (
      <main className="dashboard-content" role="status">
        Đang tải hồ sơ…
      </main>
    )
  const c = data.customer
  const badge = (
    <span className={'cp-badge ' + c.creditStatus.toLowerCase()}>
      {credit[c.creditStatus] || c.creditStatus}
    </span>
  )
  return (
    <main className="dashboard-content customer-profile">
      <header className="cp-heading">
        <h1>{c.customerName}</h1>
        <nav>
          <Link to="/dashboard">Trang chủ</Link> ›{' '}
          <Link to={base}>Khách hàng</Link> › {c.customerName}
        </nav>
      </header>
      <div className="cp-layout">
        <div className="cp-main">
          <section className="cp-panel cp-summary">
            <header>
              <h2>{c.customerName}</h2>
              <div className="cp-actions">
                <button className="cp-button" onClick={() => setEditing(true)}>
                  ✎ Sửa
                </button>
                <CustomerCreditActions
                  data={debtResource.data}
                  error={debtResource.error}
                  onSaved={() => setRevision((n) => n + 1)}
                />
              </div>
            </header>
            <dl className="cp-fields">
              <div>
                <dt>Điện thoại</dt>
                <dd>{c.phone || '—'}</dd>
              </div>
              <div>
                <dt>Người liên hệ</dt>
                <dd>Chưa có thông tin</dd>
              </div>
              <div>
                <dt>Mã số thuế</dt>
                <dd>{c.taxCode || '—'}</dd>
              </div>
              <div>
                <dt>Quyền mua chịu</dt>
                <dd>{badge}</dd>
              </div>
              <div className="cp-wide">
                <dt>Địa chỉ</dt>
                <dd>{c.address || '—'}</dd>
              </div>
            </dl>
          </section>
          <section className="cp-panel">
            <h2>
              Đơn đã mua <small>({data.orderCount})</small>
            </h2>
            <div className="cp-table">
              <table>
                <thead>
                  <tr>
                    <th>Đơn</th>
                    <th>Ngày tạo</th>
                    <th>Cửa hàng</th>
                    <th>Tổng tiền</th>
                    <th>Trạng thái</th>
                    <th>Hoàn tất</th>
                  </tr>
                </thead>
                <tbody>
                  {data.orders.map((o) => (
                    <tr key={o.id}>
                      <td>{documentCode('SO', o.id)}</td>
                      <td>{date(o.createdAt)}</td>
                      <td>{o.storeName}</td>
                      <td>{money(o.total)}</td>
                      <td>
                        <span className="cp-badge">
                          {status[o.status] || o.status}
                        </span>
                        {o.completionType && (
                          <small>
                            {status[o.completionType] || o.completionType}
                          </small>
                        )}
                      </td>
                      <td>{o.completedAt ? date(o.completedAt) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!data.orders.length && (
                <p className="cp-empty">Chưa có đơn bán.</p>
              )}
            </div>
            <p className="cp-note">
              Hiển thị các đơn gần nhất trong phạm vi được phép xem.
            </p>
          </section>
          <PaymentTable rows={data.payments} total={data.paymentCount} />
          <section className="cp-panel">
            <h2>Đơn chưa đáp ứng đủ</h2>
            {data.unmetDemand?.length ? (
              <div className="cp-table">
                <table>
                  <thead>
                    <tr>
                      <th>SKU</th>
                      <th>Phụ tùng</th>
                      <th>Số lượng thiếu</th>
                      <th>Đơn gốc</th>
                      <th>Cửa hàng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.unmetDemand.map((row, index) => (
                      <tr key={index}>
                        <td>{row.sku}</td>
                        <td>{row.partName}</td>
                        <td>{row.missingQty}</td>
                        <td>{documentCode('SO', row.salesOrderId)}</td>
                        <td>{row.storeName}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="cp-empty">
                {data.unmetDemand == null
                  ? 'Chưa có dữ liệu đơn chưa đáp ứng đủ.'
                  : 'Khách chưa có đơn nào chưa đáp ứng đủ.'}
              </p>
            )}
          </section>
          {data.creditHistory.length > 0 && (
            <section className="cp-panel">
              <h2>Lịch sử quyền mua chịu</h2>
              {data.creditHistory.map((e, i) => (
                <p className="cp-history" key={i}>
                  {status[e.eventType] || e.eventType} · {date(e.decidedAt)} ·{' '}
                  {e.decidedBy}
                  <small>{e.reason}</small>
                </p>
              ))}
            </section>
          )}
        </div>
        <aside className="cp-panel cp-debt">
          <h2>Công nợ toàn chuỗi</h2>
          <div>
            <strong>{money(c.totalDebt)}</strong>
            <dl className="cp-fields">
              <div>
                <dt>Nợ quá hạn {owner ? 'toàn chuỗi' : 'trong phạm vi xem'}</dt>
                <dd>
                  {debtResource.data
                    ? money(debtResource.data.overdueDebt)
                    : debtResource.loading
                      ? 'Đang tải…'
                      : 'Không tải được'}
                </dd>
              </div>
              <div>
                <dt>Hạn trả sớm nhất</dt>
                <dd>
                  {debtResource.data
                    ? earliestDue
                      ? date(earliestDue + 'T00:00:00')
                      : 'Không có khoản còn nợ'
                    : debtResource.loading
                      ? 'Đang tải…'
                      : 'Không tải được'}
                </dd>
              </div>
            </dl>
            {!owner && (
              <p>
                Nợ tại cửa hàng:{' '}
                {c.debtAtOwnStore == null ? '—' : money(c.debtAtOwnStore)}
              </p>
            )}
            <p>
              {c.totalDebt === 0
                ? 'Không còn khoản nợ nào.'
                : 'Còn nợ toàn chuỗi.'}
            </p>
            <Link className="cp-button" to={`${base}/${id}/debts`}>
              Xem công nợ
            </Link>
            {debtResource.error && (
              <small role="alert">{debtResource.error}</small>
            )}
          </div>
        </aside>
      </div>

      {editing && (
        <CustomerForm
          customer={c}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false)
            setRevision((x) => x + 1)
          }}
        />
      )}
    </main>
  )
}
/** PaymentTable: Hiển thị bảng thanh toán, số tiền, trạng thái và liên kết chứng từ liên quan. */
function PaymentTable({
  rows,
  total,
  debtOnly = false,
}: {
  rows: Payment[]
  total?: number
  debtOnly?: boolean
}) {
  return (
    <section className="cp-panel">
      <h2>
        {debtOnly ? 'Lịch sử thu nợ' : 'Lịch sử thanh toán'}
        {total != null && <small> ({total})</small>}
      </h2>
      {rows.length ? (
        <>
          <div className="cp-table">
            <table>
              <thead>
                <tr>
                  <th>Phiếu thu</th>
                  <th>Lúc</th>
                  <th>Loại</th>
                  <th>Hình thức</th>
                  <th>Số tiền</th>
                  <th>Trừ vào / Liên quan</th>
                  <th>Xác minh</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id}>
                    <td>#{p.id}</td>
                    <td>{date(p.recordedAt)}</td>
                    <td>{status[p.paymentType] || p.paymentType}</td>
                    <td>{status[p.paymentMethod] || p.paymentMethod}</td>
                    <td>{money(p.amount)}</td>
                    <td>
                      {p.salesOrderId != null && (
                        <small>
                          Đơn bán {documentCode('SO', p.salesOrderId)}
                        </small>
                      )}
                      {p.salesOrderId == null && p.receivableIds.length > 0 && (
                        <small>Trả {p.receivableIds.length} khoản nợ</small>
                      )}
                      {p.salesOrderId == null && !p.receivableIds.length && '—'}
                    </td>
                    <td>{status[p.status] || p.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="cp-note">
            Hiển thị các khoản thanh toán gần nhất trong phạm vi được phép xem.
            Các khoản nợ đã tất toán có thể không còn trong danh sách công nợ.
          </p>
        </>
      ) : (
        <p className="cp-empty">Chưa có thanh toán trong dữ liệu được xem.</p>
      )}
    </section>
  )
}
