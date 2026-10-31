/**
 * File: modules/admin/pages/AdminPermissionHistoryPage.tsx
 * Loại: MÀN HÌNH — Lịch sử phân quyền Admin.
 * Đường dẫn: /permission-history.
 * Công dụng: Lịch sử phân quyền; gom dữ liệu lịch sử theo tài khoản, lọc người/loại thay đổi/ngày, phân trang và chức năng xuất dữ liệu trong màn.
 */
/** Admin permission audit screen. Combines each account's existing history endpoint for display/export. */
import '../admin.css'
import HeaderSearch from '../../../shared/ui/HeaderSearch'
import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import { Link } from 'react-router-dom'
import type {
  DashboardAccount,
  PermissionHistoryItem,
} from '../../../shared/types/account'
import type { DashboardStore } from '../../../shared/types/store'
import {
  listAccountSummaries,
  listPermissionHistory,
  listStores,
} from '../services/accountService'
import { formatDate } from '../../../shared/utils/format'
import { roleNames } from '../../../shared/utils/roles'

type ChangeFilter =
  | ''
  | 'ACCOUNT_CREATED'
  | 'ROLE_CHANGED'
  | 'STORE_CHANGED'
  | 'PERMISSION_GRANTED'
  | 'PERMISSION_REVOKED'

const changeNames: Record<string, string> = {
  ACCOUNT_CREATED: 'Tạo tài khoản',
  ROLE_CHANGED: 'Đổi vai trò',
  STORE_CHANGED: 'Đổi cửa hàng',
  PERMISSION_GRANTED: 'Cấp quyền',
  PERMISSION_REVOKED: 'Thu hồi quyền',
}

/** AdminPermissionHistoryPage: Lịch sử phân quyền; gom dữ liệu lịch sử theo tài khoản, lọc người/loại thay đổi/ngày, phân trang và chức năng xuất dữ liệu trong màn. */
export default function AdminPermissionHistoryPage() {
  const [accounts, setAccounts] = useState<DashboardAccount[]>([])
  const [stores, setStores] = useState<DashboardStore[]>([])
  const [history, setHistory] = useState<PermissionHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [changeFilter, setChangeFilter] = useState<ChangeFilter>('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [page, setPage] = useState(1)

  useEffect(() => {
    let active = true
    async function loadHistory() {
      setLoading(true)
      setError('')
      try {
        const [accountList, storeList] = await Promise.all([
          listAccountSummaries(),
          listStores(),
        ])
        const entries: PermissionHistoryItem[] = []
        for (let offset = 0; offset < accountList.length; offset += 6) {
          const batch = accountList.slice(offset, offset + 6)
          const results = await Promise.all(
            batch.map(async (account) => {
              const items = await listPermissionHistory(account.id)
              return items.map((item) => ({ ...item, accountId: account.id }))
            }),
          )
          entries.push(...results.flat())
        }
        entries.sort((left, right) =>
          right.changedAt.localeCompare(left.changedAt),
        )
        if (active) {
          setAccounts(accountList)
          setStores(storeList)
          setHistory(entries)
        }
      } catch (requestError) {
        if (!active) return
        const message = axios.isAxiosError(requestError)
          ? requestError.response?.data?.message
          : undefined
        setError(
          typeof message === 'string'
            ? message
            : 'Không tải được lịch sử phân quyền. Hãy kiểm tra kết nối backend và quyền Admin.',
        )
      } finally {
        if (active) setLoading(false)
      }
    }
    void loadHistory()
    return () => {
      active = false
    }
  }, [])

  const accountById = useMemo(
    () => new Map(accounts.map((account) => [account.id, account])),
    [accounts],
  )
  const storeById = useMemo(
    () => new Map(stores.map((store) => [String(store.id), store.storeName])),
    [stores],
  )
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('vi')
    return history.filter((item) => {
      const account = accountById.get(item.accountId)
      const matchesQuery =
        !normalized ||
        `${account?.fullName || ''} ${account?.username || ''}`
          .toLocaleLowerCase('vi')
          .includes(normalized)
      const day = item.changedAt.slice(0, 10)
      return (
        matchesQuery &&
        (!changeFilter || item.changeType === changeFilter) &&
        (!fromDate || day >= fromDate) &&
        (!toDate || day <= toDate)
      )
    })
  }, [history, accountById, query, changeFilter, fromDate, toDate])

  const pageSize = 8
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize)
  const start = filtered.length ? (page - 1) * pageSize + 1 : 0
  const end = Math.min(page * pageSize, filtered.length)

  function exportCsv() {
    const rows = [
      [
        'Thời điểm',
        'Tài khoản',
        'Tên đăng nhập',
        'Thay đổi',
        'Trước',
        'Sau',
        'Lý do',
        'Người thực hiện',
      ],
      ...filtered.map((item) => {
        const account = accountById.get(item.accountId)
        const detail = changeDetail(item, storeById)
        const actor = accountById.get(item.changedBy)
        return [
          formatDate(item.changedAt),
          account?.fullName || `Tài khoản #${item.accountId}`,
          account?.username || '',
          changeNames[item.changeType] || item.changeType,
          detail.before,
          detail.after,
          item.reason || '',
          `${item.changedByName || '—'}${actor ? ` (${roleNames[actor.role] || actor.role})` : ''}`,
        ]
      }),
    ]
    const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}`
    const url = URL.createObjectURL(
      new Blob([csv], { type: 'text/csv;charset=utf-8' }),
    )
    const link = document.createElement('a')
    link.href = url
    link.download = 'lich-su-phan-quyen.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <HeaderSearch
        loading={loading}
        placeholder="Tìm tài khoản trong lịch sử phân quyền..."
        items={accounts.map((item) => ({
          id: item.id,
          label: item.fullName,
          meta: item.username,
          select: () => {
            setQuery(item.username)
            setPage(1)
          },
        }))}
      />
      <main className="dashboard-content history-content">
        <div className="history-page-heading">
          <h1>Lịch sử phân quyền</h1>
          <div className="breadcrumb">
            <Link to="/dashboard">Trang chủ</Link>
            <span>›</span>
            <Link to="/accounts">Tài khoản</Link>
            <span>›</span>
            <span>Lịch sử phân quyền</span>
          </div>
        </div>
        {error && (
          <div className="dashboard-banner error-banner" role="alert">
            {error}
          </div>
        )}
        <section className="accounts-panel history-page-panel">
          <div className="accounts-panel-heading">
            <h2>Lịch sử cấp, đổi và thu hồi quyền</h2>
            <button
              className="secondary-button history-export"
              type="button"
              disabled={loading || filtered.length === 0}
              onClick={exportCsv}
            >
              <span aria-hidden="true">⇧</span> Xuất CSV
            </button>
          </div>
          <div className="history-filters">
            <label className="accounts-filter-search">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M10.8 18a7.2 7.2 0 110-14.4 7.2 7.2 0 010 14.4zm5.2-1l4 4"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                />
              </svg>
              <input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value)
                  setPage(1)
                }}
                placeholder="Tìm theo tên hoặc tên đăng nhập"
                aria-label="Tìm theo tên tài khoản"
              />
            </label>
            <select
              aria-label="Lọc loại thay đổi"
              value={changeFilter}
              onChange={(event) => {
                setChangeFilter(event.target.value as ChangeFilter)
                setPage(1)
              }}
            >
              <option value="">Tất cả loại thay đổi</option>
              {Object.entries(changeNames).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <label className="history-date-field">
              <input
                type="date"
                aria-label="Từ ngày"
                value={fromDate}
                onChange={(event) => {
                  setFromDate(event.target.value)
                  setPage(1)
                }}
              />
            </label>
            <span className="history-date-to">đến</span>
            <label className="history-date-field">
              <input
                type="date"
                aria-label="Đến ngày"
                value={toDate}
                onChange={(event) => {
                  setToDate(event.target.value)
                  setPage(1)
                }}
              />
            </label>
          </div>
          <div className="table-scroll history-table-wrap">
            <table className="accounts-table history-table">
              <thead>
                <tr>
                  <th>Thời điểm</th>
                  <th>Tài khoản</th>
                  <th>Thay đổi</th>
                  <th>Trước → Sau</th>
                  <th>Lý do</th>
                  <th>Người thực hiện</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="accounts-empty">
                      Đang tải lịch sử phân quyền…
                    </td>
                  </tr>
                ) : visible.length ? (
                  visible.map((item) => {
                    const account = accountById.get(item.accountId)
                    const actor = accountById.get(item.changedBy)
                    const detail = changeDetail(item, storeById)
                    return (
                      <tr key={`${item.accountId}-${item.id}`}>
                        <td className="history-date-cell">
                          {formatDate(item.changedAt)}
                        </td>
                        <td>
                          <strong>
                            {account?.fullName ||
                              `Tài khoản #${item.accountId}`}
                          </strong>
                          <small>
                            {account?.username ||
                              'Tài khoản không còn trong danh sách'}
                          </small>
                        </td>
                        <td>
                          <span
                            className={`change-badge tone-${changeTone(item.changeType)}`}
                          >
                            {changeNames[item.changeType] || item.changeType}
                          </span>
                          {detail.permission && (
                            <small>{detail.permission}</small>
                          )}
                        </td>
                        <td className="history-values">
                          {detail.before} <span>→</span> {detail.after}
                        </td>
                        <td className="history-reason">{item.reason || '—'}</td>
                        <td>
                          <strong>{item.changedByName || '—'}</strong>
                          <small>
                            {actor ? roleNames[actor.role] || actor.role : '—'}
                          </small>
                        </td>
                      </tr>
                    )
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="accounts-empty">
                      Không có thay đổi phân quyền phù hợp.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="accounts-pagination">
            <span>
              Hiển thị {start}–{end} trên {filtered.length} thay đổi
            </span>
            <div>
              <button
                type="button"
                aria-label="Trang trước"
                disabled={page <= 1}
                onClick={() => setPage((current) => current - 1)}
              >
                ‹
              </button>
              <strong>{page}</strong>
              <button
                type="button"
                aria-label="Trang sau"
                disabled={page >= pageCount}
                onClick={() => setPage((current) => current + 1)}
              >
                ›
              </button>
            </div>
          </div>
        </section>
      </main>
    </>
  )
}

function changeDetail(
  item: PermissionHistoryItem,
  stores: Map<string, string>,
) {
  const format = (value: string | null) => {
    if (!value) return '—'
    if (
      item.changeType === 'ROLE_CHANGED' ||
      item.changeType === 'ACCOUNT_CREATED'
    )
      return roleNames[value] || value
    if (item.changeType === 'STORE_CHANGED')
      return stores.get(value) || `Cửa hàng #${value}`
    return value
  }
  return {
    before: format(item.oldValue),
    after: format(item.newValue),
    permission:
      item.permissionCode === 'CATALOG_EDIT'
        ? 'Sửa danh mục'
        : item.permissionCode === 'RETAIL_PRICE_EDIT'
          ? 'Sửa giá bán lẻ'
          : '',
  }
}

function changeTone(type: string) {
  return (
    (
      {
        ACCOUNT_CREATED: 'blue',
        ROLE_CHANGED: 'cyan',
        STORE_CHANGED: 'cyan',
        PERMISSION_GRANTED: 'green',
        PERMISSION_REVOKED: 'red',
      } as Record<string, string>
    )[type] || 'blue'
  )
}

function csvCell(value: string) {
  const safeValue = /^[=+\-@]/.test(value) ? `'${value}` : value
  return `"${safeValue.replaceAll('"', '""')}"`
}
