import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import axiosClient from '../../shared/api/axiosClient'
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
    [error, setError] = useState(''),
    [transferFallback, setTransferFallback] = useState(false)
  const pending = useRef<AbortController | null>(null)
  useEffect(() => () => pending.current?.abort(), [])
  const target = noticeTarget(notice, user?.role)
  async function act(open: boolean) {
    if (pending.current) return
    const controller = new AbortController()
    pending.current = controller
    setBusy(true)
    setError('')
    setTransferFallback(false)
    try {
      if (!notice.read) await markNoticeRead(notice.id, controller.signal)
      if (controller.signal.aborted) return
      if (open && target) {
        // Inspection notices use the same reference for supplier and transfer receipts.
        // The API does not supply the parent transfer ID needed for its detail route.
        if (notice.refType === 'GOODS_RECEIPT_NOTE') {
          try {
            await axiosClient.get(target.path, { signal: controller.signal })
          } catch (e) {
            if (isAxiosError(e) && e.response?.status === 404) {
              setTransferFallback(true)
              setError(
                'Phiếu nhận không có trong danh sách nhập từ nhà cung cấp. Mở lệnh điều chuyển để tìm phiếu nhận liên quan.',
              )
              refreshNotifications()
              return
            }
            throw e
          }
        }
        if (controller.signal.aborted) return
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
      {transferFallback && (
        <Link to="/transfer-orders" onClick={onOpened}>
          Mở lệnh điều chuyển
        </Link>
      )}
    </div>
  )
}
