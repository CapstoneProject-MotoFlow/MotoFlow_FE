import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../shared/hooks/useAuth'
import { isAxiosError } from 'axios'
import { noticeTarget, type Notice } from './notificationModel'
import { markNoticeRead, refreshNotifications } from './notificationService'
export default function NotificationActions({
  notice,
  onOpened,
}: {
  notice: Notice
  onOpened?: () => void
}) {
  const { user } = useAuth(),
    navigate = useNavigate()
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  const pending = useRef<AbortController | null>(null)
  useEffect(() => () => pending.current?.abort(), [])
  const target = noticeTarget(notice, user?.role)
  async function act(open: boolean) {
    if (pending.current) return
    const controller = new AbortController()
    pending.current = controller
    setBusy(true)
    setError('')
    try {
      if (!notice.read) await markNoticeRead(notice.id, controller.signal)
      if (controller.signal.aborted) return
      if (open && target) {
        onOpened?.()
        navigate(target.path)
      }
      refreshNotifications()
    } catch (error) {
      if (!controller.signal.aborted)
        setError(
          isAxiosError<{ message?: string }>(error)
            ? (error.response?.data?.message ??
                'Chưa đánh dấu được thông báo. Vui lòng thử lại.')
            : 'Chưa đánh dấu được thông báo. Vui lòng thử lại.',
        )
    } finally {
      if (!controller.signal.aborted) {
        pending.current = null
        setBusy(false)
      }
    }
  }
  return (
    <div className="notification-item-controls">
      <div>
        {target && (
          <button type="button" disabled={busy} onClick={() => void act(true)}>
            Mở
          </button>
        )}
        {!notice.read && (
          <button type="button" disabled={busy} onClick={() => void act(false)}>
            Đánh dấu đã đọc
          </button>
        )}
      </div>
      {error && <p role="alert">{error}</p>}
    </div>
  )
}
