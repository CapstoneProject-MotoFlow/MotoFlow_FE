import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import Icon from '../../shared/ui/Icon'
import {
  useNotifications,
  noticeTime,
} from '../../modules/notifications/notificationService'
import '../../modules/notifications/notifications.css'
export default function NotificationBell() {
  const { data, error, reload } = useNotifications()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const location = useLocation()
  useEffect(() => {
    function close(event: PointerEvent) {
      if (!ref.current?.contains(event.target as Node)) setOpen(false)
    }
    function key(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', key)
    }
  }, [])
  useEffect(() => {
    setOpen(false)
  }, [location.pathname])
  return (
    <div className="notification-anchor" ref={ref}>
      <button
        className="icon-button notification-trigger"
        aria-label={`Thông báo${data ? ': ' + data.unread + ' chưa đọc' : ''}`}
        aria-expanded={open}
        onClick={() => {
          setOpen((x) => !x)
          if (!open) reload()
        }}
      >
        <Icon name="bell" />
        {!!data?.unread && (
          <span className="notification-count">{data.unread}</span>
        )}
      </button>
      {open && (
        <section className="notification-popover" aria-label="Thông báo">
          <header>
            <strong>Thông báo</strong>
            <small>{data?.unread ?? '—'} chưa đọc</small>
          </header>
          <div className="notification-popover-list">
            {error ? (
              <p role="alert">
                {error}
                <button onClick={reload}>Thử lại</button>
              </p>
            ) : !data ? (
              <p>Đang tải…</p>
            ) : data.latest.length ? (
              data.latest.map((item) => (
                <article key={item.id}>
                  <span className="notifications-symbol">
                    <Icon name="bell" />
                  </span>
                  <div>
                    <p>{item.message}</p>
                    <small>{noticeTime(item.createdAt)}</small>
                  </div>
                  <span className="notifications-dot" />
                </article>
              ))
            ) : (
              <p>Không có thông báo chưa đọc.</p>
            )}
          </div>
          <footer>
            <Link to="/notifications" onClick={() => setOpen(false)}>
              Xem tất cả thông báo
            </Link>
          </footer>
        </section>
      )}
    </div>
  )
}
