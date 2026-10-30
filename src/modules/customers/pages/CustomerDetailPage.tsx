import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../../../shared/hooks/useAuth'
import axiosClient from '../../../shared/api/axiosClient'
import CustomerForm from '../components/CustomerForm'
import type { Customer } from '../types'
import { apiMessage } from '../../suppliers/supplierService'
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
const credit: Record<string, string> = {
  NOT_GRANTED: 'Không mua chịu',
  ELIGIBLE: 'Được mua chịu',
  REVOKED: 'Đã thu hồi',
}
const status: Record<string, string> = {
  AWAITING_PICKING: 'Chờ lấy hàng',
  PICKING: 'Đang lấy hàng',
  AWAITING_CONFIRMATION: 'Chờ xác nhận',
  CONFIRMED: 'Đã xác nhận',
  COMPLETED: 'Hoàn tất',
  CANCELLED: 'Đã hủy',
  VERIFIED: 'Đã xác minh',
  PENDING: 'Chờ xác minh',
  CASH: 'Tiền mặt',
  BANK_TRANSFER: 'Chuyển khoản',
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
export default function CustomerDetailPage({
  debtView = false,
}: {
  debtView?: boolean
}) {
  const { id } = useParams()
  const { user } = useAuth()
  const owner = user?.role === 'OWNER'
  const base = owner ? '/owner/customers' : '/branch-manager/customers'
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)
  const [revision, setRevision] = useState(0)
  const [tab, setTab] = useState('open')
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
  const debts = data.debts.filter(
    (d) => tab !== 'open' || d.remainingAmount > 0,
  )
  const payments = data.payments.filter((p) => p.paymentType === 'DEBT_PAYMENT')
  const badge = (
    <span className={'cp-badge ' + c.creditStatus.toLowerCase()}>
      {credit[c.creditStatus] || c.creditStatus}
    </span>
  )
  return (
    <main className="dashboard-content customer-profile">
      <header className="cp-heading">
        <h1>
          {debtView ? 'Công nợ của ' : ''}
          {c.customerName}
        </h1>
        <nav>
          <Link to="/dashboard">Trang chủ</Link> ›{' '}
          <Link to={base}>Khách hàng</Link> › {c.customerName}
        </nav>
      </header>
      {debtView ? (
        <>
          <section className="cp-panel cp-summary">
            <header>
              <h2>
                {c.customerName} {badge}
              </h2>
              <Link className="cp-button" to={`${base}/${id}`}>
                Hồ sơ khách hàng
              </Link>
            </header>
            <dl className="cp-fields four">
              <div>
                <dt>Điện thoại</dt>
                <dd>{c.phone || '—'}</dd>
              </div>
              <div>
                <dt>Còn nợ toàn chuỗi</dt>
                <dd>
                  <strong>{money(c.totalDebt)}</strong>
                </dd>
              </div>
              <div>
                <dt>Nợ quá hạn</dt>
                <dd title="API chưa cung cấp">—</dd>
              </div>
              <div>
                <dt>Hạn trả gần nhất</dt>
                <dd title="API chưa cung cấp">—</dd>
              </div>
            </dl>
          </section>
          <section className="cp-panel">
            <h2>Các khoản nợ</h2>
            <div className="cp-tabs">
              <button
                aria-pressed={tab === 'open'}
                onClick={() => setTab('open')}
              >
                Còn nợ {data.debts.filter((d) => d.remainingAmount > 0).length}
              </button>
              <button disabled title="Chưa có dữ liệu hạn trả">
                Quá hạn —
              </button>
              <button
                aria-pressed={tab === 'all'}
                onClick={() => setTab('all')}
              >
                Khoản nợ hiện có {data.debts.length}
              </button>
            </div>
            <div className="cp-table">
              <table>
                <thead>
                  <tr>
                    <th>Khoản nợ</th>
                    <th>Nguồn</th>
                    <th>Ngày ghi nợ</th>
                    <th>Hạn trả</th>
                    <th>Số nợ</th>
                    <th>Đã thu</th>
                    <th>Còn lại</th>
                  </tr>
                </thead>
                <tbody>
                  {debts.map((d) => (
                    <tr key={d.id}>
                      <td id={`customer-debt-${d.id}`}>#{d.id}</td>
                      <td>
                        {status[d.originType] || d.originType}
                        {d.salesOrderId != null && (
                          <small>Đơn #{d.salesOrderId}</small>
                        )}
                        <small>{d.storeName}</small>
                      </td>
                      <td>{date(d.recognizedAt)}</td>
                      <td>—</td>
                      <td>{money(d.originalAmount)}</td>
                      <td>{money(d.originalAmount - d.remainingAmount)}</td>
                      <td>{money(d.remainingAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!debts.length && (
                <p className="cp-empty">
                  Khách không còn khoản nợ nào trong phạm vi dữ liệu được xem.
                </p>
              )}
            </div>
            <p className="cp-note">
              API chỉ trả khoản nợ chưa tất toán trong phạm vi được phép; chưa
              có lịch sử toàn bộ khoản nợ hoặc hạn trả.
            </p>
          </section>
          <PaymentTable rows={payments} debtOnly />
        </>
      ) : (
        <div className="cp-layout">
          <div className="cp-main">
            <section className="cp-panel cp-summary">
              <header>
                <h2>
                  {c.customerName} <small>#{c.id}</small>
                </h2>
                <div className="cp-actions">
                  <button
                    className="cp-button"
                    onClick={() => setEditing(true)}
                  >
                    ✎ Sửa
                  </button>
                  {owner && (
                    <button
                      className="cp-primary"
                      disabled
                      title="BE chưa có API cấp hoặc thu hồi quyền mua chịu"
                    >
                      {c.creditStatus === 'ELIGIBLE'
                        ? 'Thu hồi quyền mua chịu'
                        : 'Cấp quyền mua chịu'}
                    </button>
                  )}
                </div>
              </header>
              <dl className="cp-fields">
                <div>
                  <dt>Điện thoại</dt>
                  <dd>{c.phone || '—'}</dd>
                </div>
                <div>
                  <dt>Người liên hệ</dt>
                  <dd>—</dd>
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
              {owner && (
                <p className="cp-note">
                  Cấp/thu hồi quyền mua chịu chưa được hệ thống hỗ trợ.
                </p>
              )}
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
                        <td>#{o.id}</td>
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
                  <dt>Nợ quá hạn</dt>
                  <dd>—</dd>
                </div>
                <div>
                  <dt>Hạn trả sớm nhất</dt>
                  <dd>—</dd>
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
              <small>Nợ quá hạn và hạn trả chưa được API cung cấp.</small>
            </div>
          </aside>
        </div>
      )}
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
                    <small>Đơn #{p.salesOrderId}</small>
                  )}
                  {p.receivableIds.map((debtId) => (
                    <small key={debtId}>Khoản nợ #{debtId}</small>
                  ))}
                  {p.salesOrderId == null && !p.receivableIds.length && '—'}
                </td>
                <td>{status[p.status] || p.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && (
          <p className="cp-empty">Chưa có thanh toán trong dữ liệu được xem.</p>
        )}
      </div>
      <p className="cp-note">
        Hiển thị các khoản thanh toán gần nhất trong phạm vi được phép xem. Các
        khoản nợ đã tất toán có thể không còn trong danh sách công nợ.
      </p>
    </section>
  )
}
