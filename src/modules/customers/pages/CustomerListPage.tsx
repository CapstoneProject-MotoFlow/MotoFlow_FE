import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import axiosClient from '../../../shared/api/axiosClient'
import Icon from '../../../shared/ui/Icon'
import CustomerForm from '../components/CustomerForm'
import type { Customer } from '../types'
import { apiMessage } from '../../suppliers/supplierService'
import '../customer-list.css'
type Row = Customer & { totalDebt: number; debtAtOwnStore: number | null }
const credit: Record<string, string> = {
  NOT_GRANTED: 'Không mua chịu',
  ELIGIBLE: 'Được mua chịu',
  REVOKED: 'Đã thu hồi',
}
export default function CustomerListPage({
  scope,
}: {
  scope: 'chain' | 'store'
}) {
  const chain = scope === 'chain'
  const base = chain ? '/owner/customers' : '/branch-manager/customers'
  const debtOf = (row: Row) => (chain ? row.totalDebt : row.debtAtOwnStore)
  const scopeLabel = chain
    ? 'Công nợ toàn chuỗi cửa hàng'
    : 'Công nợ tại cửa hàng của bạn'
  const [totalItems, setTotalItems] = useState(0)
  const [rows, setRows] = useState<Row[]>([])
  const [q, setQ] = useState('')
  const [debt, setDebt] = useState(false)
  const [creditOnly, setCreditOnly] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const [page, setPage] = useState(0)
  const [editing, setEditing] = useState<Customer | null | undefined>()
  const close = useCallback(() => setEditing(undefined), [])
  useEffect(() => {
    let active = true
    const timer = setTimeout(async () => {
      setLoading(true)
      setError('')
      try {
        const response = await axiosClient.get<{
          items: Row[]
          totalItems: number
        }>('/customers', {
          params: {
            q,
            creditStatus: creditOnly ? 'ELIGIBLE' : undefined,
            hasDebt: debt,
            page,
            size: 20,
          },
        })
        if (active) {
          setRows(response.data.items)
          setTotalItems(response.data.totalItems)
        }
      } catch (e) {
        if (active) setError(apiMessage(e))
      } finally {
        if (active) setLoading(false)
      }
    }, 250)
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [q, creditOnly, debt, page, revision])
  const visible = rows
  return (
    <main className="dashboard-content branch-customers">
      <header className="branch-customers-heading">
        <h1>Khách hàng</h1>
        <nav>
          <Link to="/dashboard">Trang chủ</Link>
          <span>›</span>
          <span>Bán hàng</span>
          <span>›</span>
          <span>Khách hàng</span>
        </nav>
      </header>
      <section className="branch-customers-panel">
        <header>
          <h2>
            Danh sách khách hàng{' '}
            <span title={scopeLabel} aria-label={scopeLabel}>
              ⓘ
            </span>
          </h2>
          <button
            className="branch-customer-primary"
            onClick={() => setEditing(null)}
          >
            ＋ Thêm khách hàng
          </button>
        </header>
        <div className="branch-customers-toolbar">
          <label className="branch-customers-search">
            <Icon name="search" />
            <input
              aria-label="Tìm khách hàng"
              placeholder="Tìm tên, số điện thoại hoặc mã khách"
              value={q}
              onChange={(e) => {
                setQ(e.target.value)
                setPage(0)
              }}
            />
          </label>
          <label className="branch-customers-debt">
            <input
              type="checkbox"
              checked={creditOnly}
              onChange={(event) => {
                setCreditOnly(event.target.checked)
                setPage(0)
              }}
            />
            Chỉ khách được mua nợ
          </label>
          <label className="branch-customers-debt">
            <input
              type="checkbox"
              checked={debt}
              onChange={(e) => {
                setDebt(e.target.checked)
                setPage(0)
              }}
            />
            Chỉ khách đang nợ
          </label>
        </div>
        {error ? (
          <p role="alert" className="branch-customers-message">
            {error}{' '}
            <button onClick={() => setRevision((x) => x + 1)}>Thử lại</button>
          </p>
        ) : loading ? (
          <p role="status" className="branch-customers-message">
            Đang tải khách hàng…
          </p>
        ) : (
          <>
            <div className="branch-customers-table">
              <table>
                <thead>
                  <tr>
                    <th>Khách hàng</th>
                    <th>Điện thoại</th>
                    <th>Mua gần nhất</th>
                    <th>Mua chịu</th>
                    <th className="branch-customer-money">
                      {chain ? 'Nợ toàn chuỗi' : 'Nợ tại cửa hàng'}
                    </th>
                    <th className="branch-customer-actions">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <Link to={`${base}/${row.id}`}>{row.customerName}</Link>
                        <small>#{row.id}</small>
                      </td>
                      <td>{row.phone || '—'}</td>
                      <td title="API chưa cung cấp ngày mua gần nhất">—</td>
                      <td>
                        <span
                          className={
                            'branch-credit ' + row.creditStatus.toLowerCase()
                          }
                        >
                          {credit[row.creditStatus] || row.creditStatus}
                        </span>
                      </td>
                      <td
                        className={
                          'branch-customer-money ' +
                          (debtOf(row) === 0 ? 'zero' : '')
                        }
                      >
                        {debtOf(row) == null
                          ? '—'
                          : debtOf(row) === 0
                            ? '0'
                            : debtOf(row)!.toLocaleString('vi-VN') + ' ₫'}
                      </td>
                      <td className="branch-customer-actions">
                        <button onClick={() => setEditing(row)}>Sửa</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!visible.length && (
                <p className="branch-customers-message">
                  Không tìm thấy khách hàng phù hợp.
                </p>
              )}
            </div>
            {totalItems > 20 && (
              <footer>
                <button disabled={!page} onClick={() => setPage((x) => x - 1)}>
                  Trang trước
                </button>
                <span>
                  Trang {page + 1} / {Math.max(1, Math.ceil(totalItems / 20))}
                </span>
                <button
                  disabled={(page + 1) * 20 >= totalItems}
                  onClick={() => setPage((x) => x + 1)}
                >
                  Trang sau
                </button>
              </footer>
            )}
          </>
        )}
        <p className="branch-customer-note">
          Ngày mua gần nhất và số nợ quá hạn chưa được API cung cấp.
        </p>
      </section>
      {editing !== undefined && (
        <CustomerForm
          customer={editing || undefined}
          onClose={close}
          onSaved={() => {
            close()
            setPage(0)
            setRevision((x) => x + 1)
          }}
        />
      )}
    </main>
  )
}
