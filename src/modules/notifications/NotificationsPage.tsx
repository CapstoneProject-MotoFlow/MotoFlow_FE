import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { isAxiosError } from 'axios'
import {
  useNotifications,
  noticeTime,
  markAllNoticesRead,
} from './notificationService'
import NotificationActions from './NotificationActions'
import { ReceiptDialog } from '../inventory/MovementTable'
import Icon from '../../shared/ui/Icon'
import './notifications.css'
export default function NotificationsPage() {
  const [params, setParams] = useSearchParams()
  const requestedPage = Number(params.get('page'))
  const page =
    Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 0
  const unreadOnly = params.get('unreadOnly') === 'true'
  const { data, error, loading, reload } = useNotifications({
    page,
    size: 20,
    unreadOnly,
  })
  const [busy, setBusy] = useState(false),
    [actionError, setActionError] = useState(''),
    [receipt, setReceipt] = useState<number>()
  async function markAll() {
    if (busy) return
    setBusy(true)
    setActionError('')
    setParams((previous) => {
      const next = new URLSearchParams(previous)
      next.delete('page')
      return next
    })
    try {
      await markAllNoticesRead()
    } catch (error) {
      setActionError(
        isAxiosError<{ message?: string }>(error)
          ? (error.response?.data?.message ??
              'Chưa đánh dấu được thông báo. Vui lòng thử lại.')
          : 'Chưa đánh dấu được thông báo. Vui lòng thử lại.',
      )
    } finally {
      setBusy(false)
    }
  }
  function changePage(next: number) {
    setParams((previous) => {
      const params = new URLSearchParams(previous)
      params.set('page', String(next))
      return params
    })
  }
  return (
    <main className="notifications-page">
      <header className="notifications-heading">
        <h1>Thông báo</h1>
        <nav>
          <Link to="/dashboard">Trang chủ</Link> › Thông báo
        </nav>
      </header>
      <section className="notifications-panel">
        <header>
          <h2>Thông báo của bạn</h2>
          <button
            disabled={busy || loading || !data?.unread}
            onClick={() => void markAll()}
          >
            ✓ Đánh dấu tất cả đã đọc
          </button>
        </header>
        <div className="notifications-toolbar">
          <strong>
            {unreadOnly ? 'Thông báo chưa đọc' : 'Tất cả thông báo'}
          </strong>
          <label>
            <input
              type="checkbox"
              checked={unreadOnly}
              disabled={busy}
              onChange={(event) => {
                const checked = event.currentTarget.checked
                setParams((previous) => {
                  const params = new URLSearchParams(previous)
                  params.delete('page')
                  if (checked) params.set('unreadOnly', 'true')
                  else params.delete('unreadOnly')
                  return params
                })
              }}
            />
            Chỉ thông báo chưa đọc
          </label>
        </div>
        {actionError && (
          <p role="alert" className="notification-error">
            {actionError}
          </p>
        )}
        {error ? (
          <p className="notifications-empty" role="alert">
            {error}
            <button onClick={reload}>Thử lại</button>
          </p>
        ) : loading ? (
          <p className="notifications-empty" role="status">
            Đang tải thông báo…
          </p>
        ) : data?.latest.length ? (
          <ul className="notifications-list">
            {data.latest.map((item) => (
              <li key={item.id} className={item.read ? 'is-read' : 'is-unread'}>
                <span className="notifications-symbol">
                  <Icon name="bell" />
                </span>
                <div>
                  <p>{item.message}</p>
                  <small>
                    {noticeTime(item.createdAt)} ·{' '}
                    <strong>{item.read ? 'Đã đọc' : 'Chưa đọc'}</strong>
                  </small>
                  <NotificationActions notice={item} onReceipt={setReceipt} />
                </div>
                {!item.read && (
                  <span className="notifications-dot" aria-label="Chưa đọc" />
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="notifications-empty">
            {page > 0
              ? 'Không có thông báo ở trang này.'
              : unreadOnly
                ? 'Không có thông báo chưa đọc.'
                : 'Chưa có thông báo.'}
          </p>
        )}
        <footer className="notifications-pagination">
          <span>
            {data
              ? data.unread +
                ' thông báo chưa đọc · ' +
                data.totalItems +
                ' kết quả'
              : '—'}
          </span>
          <div>
            <button
              aria-label="Trang trước"
              disabled={!page || loading}
              onClick={() => changePage(page - 1)}
            >
              ‹
            </button>
            <span>{page + 1}</span>
            <button
              aria-label="Trang sau"
              disabled={loading || !data || (page + 1) * 20 >= data.totalItems}
              onClick={() => changePage(page + 1)}
            >
              ›
            </button>
          </div>
        </footer>
      </section>
      {receipt != null && (
        <ReceiptDialog id={receipt} onClose={() => setReceipt(undefined)} />
      )}
    </main>
  )
}
