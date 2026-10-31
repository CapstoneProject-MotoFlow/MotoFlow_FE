import { Link } from 'react-router-dom'
import { useAuth } from '../../../shared/hooks/useAuth'
import { useEffect, useState } from 'react'
import axiosClient from '../../../shared/api/axiosClient'
import FormDialog from '../../../shared/ui/FormDialog'
import { apiMessage } from '../../suppliers/supplierService'
import './owner-permissions.css'
type Manager = {
  id: number
  username: string
  fullName: string
  storeId: number
  storeName: string
  permissions: string[]
}
export default function OwnerPermissionsPage() {
  const { user } = useAuth()
  const [history, setHistory] = useState<
    {
      name: string
      granted: boolean
      permission: string
      reason: string
      at: string
      actor: string
    }[]
  >([])
  const [rows, setRows] = useState<Manager[]>([])
  const [stores, setStores] = useState<
    { id: number; storeName: string; central?: boolean }[]
  >([])
  const [storeId, setStoreId] = useState('')
  const [revision, setRevision] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pending, setPending] = useState<{
    row: Manager
    permission: string
  } | null>(null)
  const [busy, setBusy] = useState(false)
  const [storeError, setStoreError] = useState('')
  const [formError, setFormError] = useState('')
  useEffect(() => {
    let active = true
    axiosClient
      .get('/stores')
      .then((r) => {
        if (active) setStores(r.data)
      })
      .catch(() => {
        if (active)
          setStoreError('Không tải được cửa hàng. Vui lòng tải lại trang.')
      })
    return () => {
      active = false
    }
  }, [])
  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    axiosClient
      .get<Manager[]>('/branch-managers', {
        params: { storeId: storeId || undefined },
      })
      .then((r) => {
        if (active) setRows(r.data)
      })
      .catch((e) => {
        if (active) setError(apiMessage(e))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [storeId, revision])
  return (
    <main className="dashboard-content owner-permissions-page">
      <header className="owner-permissions-heading">
        <h1>Quyền danh mục và giá</h1>
        <nav aria-label="Đường dẫn">
          <Link to="/dashboard">Trang chủ</Link>
          <span>›</span>
          <span>Giá bán</span>
          <span>›</span>
          <span>Quyền danh mục và giá</span>
        </nav>
      </header>
      <div className="owner-permissions-filter">
        <select
          aria-label="Cửa hàng"
          value={storeId}
          onChange={(e) => setStoreId(e.target.value)}
        >
          <option value="">Tất cả cửa hàng</option>
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.storeName}
            </option>
          ))}
        </select>
      </div>
      {storeError && <p role="alert">{storeError}</p>}
      {error && (
        <p role="alert">
          {error}
          <button onClick={() => setRevision((x) => x + 1)}>Thử lại</button>
        </p>
      )}
      {loading ? (
        <p role="status">Đang tải…</p>
      ) : (
        <section className="owner-permissions-panel">
          <h2>Branch Manager</h2>
          <div className="owner-permissions-table">
            <table>
              <thead>
                <tr>
                  <th>Tài khoản</th>
                  <th>Cửa hàng</th>
                  <th>Sửa danh mục</th>
                  <th>Sửa giá bán lẻ</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <div className="permission-account">
                        <span className="permission-avatar" aria-hidden="true">
                          {row.fullName
                            .trim()
                            .split(/\s+/)
                            .slice(-2)
                            .map((part) => part[0])
                            .join('')
                            .toUpperCase()}
                        </span>
                        <span>
                          <strong>{row.fullName}</strong>
                          <small>{row.username}</small>
                        </span>
                      </div>
                    </td>
                    <td>
                      {row.storeName}
                      {stores.find((store) => store.id === row.storeId)
                        ?.central && (
                        <small className="permission-central">Kho tổng</small>
                      )}
                    </td>
                    {['CATALOG_EDIT', 'RETAIL_PRICE_EDIT'].map((permission) => (
                      <td key={permission}>
                        <label className="permission-control">
                          <input
                            role="switch"
                            type="checkbox"
                            aria-label={
                              row.username +
                              ': ' +
                              (permission === 'CATALOG_EDIT'
                                ? 'Sửa danh mục'
                                : 'Sửa giá bán lẻ')
                            }
                            checked={row.permissions.includes(permission)}
                            onChange={() => {
                              setFormError('')
                              setPending({ row, permission })
                            }}
                          />
                          <span
                            className="permission-toggle"
                            aria-hidden="true"
                          />
                          <span>
                            {row.permissions.includes(permission)
                              ? 'Đã có quyền'
                              : 'Không có quyền'}
                          </span>
                        </label>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {!loading && !error && !rows.length && <p>Không có quản lý chi nhánh.</p>}
      <section className="owner-permissions-panel permission-history">
        <h2>Thay đổi gần đây</h2>
        {history.length ? (
          <ol>
            {history.map((event, index) => (
              <li
                key={index}
                className={event.granted ? 'is-granted' : 'is-revoked'}
              >
                <span className="permission-event-icon" aria-hidden="true">
                  {event.granted ? '✓' : '×'}
                </span>
                <div>
                  <p>
                    {event.granted ? 'Cấp' : 'Thu hồi'} quyền{' '}
                    {event.permission === 'CATALOG_EDIT'
                      ? 'sửa danh mục'
                      : 'sửa giá bán lẻ'}{' '}
                    của {event.name}
                  </p>
                  <small>
                    {new Date(event.at).toLocaleString('vi-VN')} · {event.actor}
                  </small>
                  <blockquote>{event.reason}</blockquote>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="permission-history-empty">
            Chưa có thay đổi trong phiên làm việc này.
          </p>
        )}
        <p className="permission-history-note">
          Hiển thị thay đổi trong phiên này. Lịch sử trước đó chưa được hệ thống
          cung cấp cho Owner.
        </p>
      </section>
      {pending && (
        <FormDialog
          busy={busy}
          title="Xác nhận thay đổi quyền"
          formId="manager-permissions"
          submitLabel={busy ? 'Đang lưu…' : 'Lưu thay đổi'}
          onClose={() => {
            if (!busy) setPending(null)
          }}
        >
          <form
            id="manager-permissions"
            onSubmit={async (e) => {
              e.preventDefault()
              if (busy) return
              const reason = String(
                new FormData(e.currentTarget).get('reason') || '',
              ).trim()
              if (!reason) {
                setFormError('Vui lòng nhập lý do.')
                return
              }
              setBusy(true)
              setFormError('')
              const granted = (code: string) =>
                pending.permission === code
                  ? !pending.row.permissions.includes(code)
                  : pending.row.permissions.includes(code)
              try {
                await axiosClient.put(
                  '/branch-managers/' + pending.row.id + '/permissions',
                  {
                    catalogEdit: granted('CATALOG_EDIT'),
                    retailPriceEdit: granted('RETAIL_PRICE_EDIT'),
                    reason,
                  },
                )
                setHistory((previous) => [
                  {
                    name: pending.row.fullName,
                    granted: granted(pending.permission),
                    permission: pending.permission,
                    reason,
                    at: new Date().toISOString(),
                    actor: user?.fullName || user?.username || 'Owner',
                  },
                  ...previous,
                ])
                setPending(null)
                setRevision((x) => x + 1)
              } catch (error) {
                setFormError(apiMessage(error))
              } finally {
                setBusy(false)
              }
            }}
          >
            <p>
              {pending.row.fullName}:{' '}
              {pending.row.permissions.includes(pending.permission)
                ? 'Thu hồi'
                : 'Cấp'}{' '}
              quyền{' '}
              {pending.permission === 'CATALOG_EDIT'
                ? 'sửa danh mục'
                : 'sửa giá bán lẻ'}
            </p>
            <label>
              Lý do
              <textarea
                name="reason"
                required
                maxLength={500}
                disabled={busy}
              />
            </label>
            {formError && <p role="alert">{formError}</p>}
          </form>
        </FormDialog>
      )}
    </main>
  )
}
