/**
 * File: modules/suppliers/pages/SuppliersPage.tsx
 * Loại: MÀN HÌNH — Danh sách nhà cung cấp.
 * Đường dẫn: /owner/suppliers.
 * Công dụng: Danh sách/tìm/lọc nhà cung cấp; mở form và thao tác đổi trạng thái.
 */
import '../supplier-redesign.css'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import SupplierForm from '../components/SupplierForm'
import type { Supplier } from '../types'
import { supplierService, apiMessage } from '../supplierService'
import '../suppliers.css'
/** SuppliersPage: Danh sách/tìm/lọc nhà cung cấp; mở form và thao tác đổi trạng thái. */
export default function SuppliersPage() {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('ACTIVE')
  const [page, setPage] = useState(0)
  const [revision, setRevision] = useState(0)
  const [hiddenCount, setHiddenCount] = useState<number | null>(null)
  useEffect(() => {
    let active = true
    setHiddenCount(null)
    if (status !== 'ACTIVE') return
    const timer = setTimeout(() => {
      supplierService
        .list({ q: query, status: 'INACTIVE', page: 0 })
        .then((result) => {
          if (active) setHiddenCount(result.totalItems)
        })
        .catch(() => {
          if (active) setHiddenCount(null)
        })
    }, 250)
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [status, query, revision])
  const [data, setData] = useState<{ items: Supplier[]; totalItems: number }>({
    items: [],
    totalItems: 0,
  })
  const [editing, setEditing] = useState<Supplier | null | undefined>()
  const [loading, setLoading] = useState(true)

  const [error, setError] = useState('')
  const close = useCallback(() => setEditing(undefined), [])
  useEffect(() => {
    let active = true
    const timer = setTimeout(() => {
      setLoading(true)
      setError('')
      supplierService
        .list({ q: query, status, page })
        .then((value) => {
          if (active) setData(value)
        })
        .catch((error) => {
          if (active) setError(apiMessage(error))
        })
        .finally(() => {
          if (active) setLoading(false)
        })
    }, 250)
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [query, status, page, revision])
  return (
    <main className="dashboard-content suppliers-page supplier-redesign">
      <div className="suppliers-page-heading">
        <h1>Nhà cung cấp</h1>
        <nav>
          <Link to="/dashboard">Trang chủ</Link> › Danh mục › Nhà cung cấp
        </nav>
      </div>
      <section className="suppliers-panel">
        <header className="suppliers-panel-heading">
          <h2>Nhà cung cấp</h2>
          <button
            className="suppliers-primary"
            onClick={() => setEditing(null)}
          >
            ＋ Thêm nhà cung cấp
          </button>
        </header>
        <div className="suppliers-toolbar">
          <input
            aria-label="Tìm nhà cung cấp"
            placeholder="Tìm theo mã, tên hoặc số điện thoại"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setPage(0)
            }}
          />
          <select
            aria-label="Trạng thái"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value)
              setPage(0)
            }}
          >
            <option value="">Mọi trạng thái</option>
            <option value="ACTIVE">Đang giao dịch</option>
            <option value="INACTIVE">Ngừng giao dịch</option>
          </select>
          {status === 'ACTIVE' && hiddenCount !== null && hiddenCount > 0 && (
            <span className="supplier-hidden-notice">
              {hiddenCount} nhà cung cấp ngừng giao dịch đang ẩn ·{' '}
              <button
                type="button"
                onClick={() => {
                  setStatus('')
                  setPage(0)
                }}
              >
                Hiện cả nhà cung cấp ngừng giao dịch
              </button>
            </span>
          )}
        </div>
        {error && (
          <p role="alert">
            {error}
            <button onClick={() => setRevision((x) => x + 1)}>Thử lại</button>
          </p>
        )}
        {loading ? (
          <p className="suppliers-empty">Đang tải…</p>
        ) : (
          <div className="table-scroll">
            <table
              className={
                'suppliers-table supplier-list-table ' +
                (status === 'ACTIVE' ? 'active-only' : 'with-status')
              }
            >
              <thead>
                <tr>
                  <th>Nhà cung cấp</th>
                  <th>Người liên hệ</th>
                  <th>Điện thoại</th>
                  <th>Phiếu đang mở</th>
                  <th>Giá trị chưa nhận</th>
                  {status !== 'ACTIVE' && <th>Trạng thái</th>}
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <Link
                        className="supplier-name-link"
                        to={`/owner/suppliers/${s.id}`}
                      >
                        {s.supplierName}
                      </Link>
                      <small>{s.supplierCode}</small>
                    </td>
                    <td>{s.contactName || '—'}</td>
                    <td>{s.phone || '—'}</td>
                    <td>—</td>
                    <td>—</td>
                    {status !== 'ACTIVE' && (
                      <td>
                        <span
                          className={'supplier-state ' + s.status.toLowerCase()}
                        >
                          {s.status === 'ACTIVE'
                            ? 'Đang giao dịch'
                            : 'Ngừng giao dịch'}
                        </span>
                      </td>
                    )}
                    <td>
                      <button
                        className="secondary-button"
                        onClick={() => setEditing(s)}
                      >
                        Sửa
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data.items.length && !error && (
              <p className="suppliers-empty">
                Không tìm thấy nhà cung cấp phù hợp.
              </p>
            )}
          </div>
        )}
        <footer className="suppliers-footer">
          <span>{data.totalItems} nhà cung cấp</span>
          <button
            disabled={!page || loading}
            onClick={() => setPage((x) => x - 1)}
          >
            Trang trước
          </button>
          <span>Trang {page + 1}</span>
          <button
            disabled={(page + 1) * 20 >= data.totalItems || loading}
            onClick={() => setPage((x) => x + 1)}
          >
            Trang sau
          </button>
        </footer>
      </section>
      {editing !== undefined && (
        <SupplierForm
          supplier={editing || undefined}
          onClose={close}
          onSaved={() => {
            close()
            setRevision((x) => x + 1)
          }}
        />
      )}
    </main>
  )
}
