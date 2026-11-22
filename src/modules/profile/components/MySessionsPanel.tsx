/**
 * File: modules/profile/components/MySessionsPanel.tsx
 * Loại: THÀNH PHẦN / XỬ LÝ HỖ TRỢ — không phải màn hình độc lập.
 * Công dụng: Ô "Thiết bị đang đăng nhập" trong trang cá nhân: xem các thiết bị của mình, đăng xuất một thiết bị
 * khác hoặc tất cả thiết bị khác.
 */
import axios from 'axios'
import { useEffect, useState } from 'react'
import type { Session } from '../../../shared/types/session'
import ConfirmDialog from '../../../shared/ui/ConfirmDialog'
import SessionTable from '../../../shared/ui/SessionTable'
import {
  listMySessions,
  signOutMySession,
  signOutOtherSessions,
} from '../services/profileService'

type Pending = { kind: 'one'; session: Session } | { kind: 'others' }

/** MySessionsPanel: Thiết bị đang dùng không đăng xuất ở đây (dùng nút Đăng xuất ở menu tài khoản). */
export default function MySessionsPanel() {
  const [sessions, setSessions] = useState<Session[] | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [pending, setPending] = useState<Pending | null>(null)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let active = true
    listMySessions()
      .then((found) => {
        if (active) setSessions(found)
      })
      .catch(() => {
        if (active)
          setError('Không tải được danh sách thiết bị. Vui lòng thử lại.')
      })
    return () => {
      active = false
    }
  }, [reload])

  const others = sessions?.filter((session) => !session.current).length ?? 0

  async function confirm() {
    if (!pending) return
    setError('')
    setNotice('')
    try {
      if (pending.kind === 'one') {
        await signOutMySession(pending.session.id)
        setNotice(
          `Đã đăng xuất ${pending.session.device || 'thiết bị'} khỏi tài khoản.`,
        )
      } else {
        await signOutOtherSessions()
        setNotice('Đã đăng xuất tất cả thiết bị khác.')
      }
    } catch (requestError) {
      setError(
        errorMessage(requestError, 'Không đăng xuất được. Vui lòng thử lại.'),
      )
    } finally {
      setPending(null)
      // Tải lại cả khi lỗi: phiên có thể đã kết thúc trước đó (MSG75).
      setReload((value) => value + 1)
    }
  }

  return (
    <section
      className="profile-info-panel profile-sessions"
      aria-label="Thiết bị đang đăng nhập"
    >
      <div className="profile-sessions-heading">
        <div>
          <h2>Thiết bị đang đăng nhập</h2>
          <p>
            Thấy thiết bị lạ thì đăng xuất thiết bị đó và đổi mật khẩu. Thiết bị
            bị đăng xuất phải đăng nhập lại ở thao tác kế tiếp.
          </p>
        </div>
        {others > 0 && (
          <button
            type="button"
            className="mf-btn mf-btn--danger mf-btn--sm"
            disabled={pending !== null}
            onClick={() => setPending({ kind: 'others' })}
          >
            Đăng xuất tất cả thiết bị khác
          </button>
        )}
      </div>
      {notice && (
        <p className="mf-success-notice profile-sessions-message" role="status">
          {notice}
        </p>
      )}
      {error && (
        <div
          className="dashboard-banner error-banner profile-sessions-message"
          role="alert"
        >
          {error}
        </div>
      )}
      {sessions === null ? (
        !error && (
          <p className="profile-sessions-empty" role="status">
            Đang tải danh sách thiết bị…
          </p>
        )
      ) : (
        <SessionTable
          sessions={sessions}
          disabled={pending !== null}
          onSignOut={(session) => setPending({ kind: 'one', session })}
        />
      )}
      {pending && (
        <ConfirmDialog
          danger
          title={
            pending.kind === 'one'
              ? 'Đăng xuất thiết bị này?'
              : 'Đăng xuất tất cả thiết bị khác?'
          }
          message={
            pending.kind === 'one'
              ? `${pending.session.device || 'Thiết bị'} sẽ phải đăng nhập lại.`
              : `${others} thiết bị khác sẽ phải đăng nhập lại. Thiết bị bạn đang dùng vẫn giữ đăng nhập.`
          }
          confirmLabel="Đăng xuất"
          onConfirm={confirm}
          onCancel={() => setPending(null)}
        />
      )}
    </section>
  )
}

function errorMessage(error: unknown, fallback: string) {
  const message = axios.isAxiosError(error)
    ? error.response?.data?.message
    : undefined
  return typeof message === 'string' && message ? message : fallback
}
