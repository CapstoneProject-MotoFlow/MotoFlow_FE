import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import Icon from '../../shared/ui/Icon'
import {
  useNotifications,
  noticeTime,
} from '../../modules/notifications/notificationService'
import NotificationActions from '../../modules/notifications/NotificationActions'
import { ReceiptDialog } from '../../modules/inventory/MovementTable'
import '../../modules/notifications/notifications.css'
export default function NotificationBell() {
  const { data, error, reload, enabled } = useNotifications()
  const location = useLocation(),
    path = location.pathname + location.search
  const [openOn, setOpenOn] = useState<string | null>(null),
    [receipt, setReceipt] = useState<number>()
  const open = openOn === path,
    ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function close(event: PointerEvent) {
      if (!ref.current?.contains(event.target as Node)) setOpenOn(null)
    }
    function key(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpenOn(null)
    }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', key)
    }
  }, [])
  if (!enabled) return null
  return (
    <>
      <div className="notification-anchor" ref={ref}>
        <button
          className="icon-button notification-trigger"
          aria-label={
            'Thông báo' + (data ? ': ' + data.unread + ' chưa đọc' : '')
          }
          aria-expanded={open}
          onClick={() => {
            setOpenOn(open ? null : path)
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
                <p role="status">Đang tải…</p>
              ) : data.latest.length ? (
                data.latest.map((item) => (
                  <article key={item.id}>
                    <span className="notifications-symbol">
                      <Icon name="bell" />
                    </span>
                    <div>
                      <p>{item.message}</p>
                      <small>{noticeTime(item.createdAt)}</small>
                      <NotificationActions
                        notice={item}
                        onReceipt={setReceipt}
                        onOpened={() => setOpenOn(null)}
                      />
                    </div>
                    <span className="notifications-dot" aria-label="Chưa đọc" />
                  </article>
                ))
              ) : (
                <p>Không có thông báo chưa đọc.</p>
              )}
            </div>
            <footer>
              <Link to="/notifications" onClick={() => setOpenOn(null)}>
                Xem tất cả thông báo
              </Link>
            </footer>
          </section>
        )}
      </div>
      {receipt != null && (
        <ReceiptDialog id={receipt} onClose={() => setReceipt(undefined)} />
      )}
    </>
  )
}
