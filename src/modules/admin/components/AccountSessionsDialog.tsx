/**
 * File: modules/admin/components/AccountSessionsDialog.tsx
 * Loại: FORM / POPUP — mở bên trong màn hình Tài khoản, không phải trang riêng.
 * Công dụng: Admin xem các thiết bị một tài khoản đang đăng nhập và buộc đăng xuất một thiết bị, kèm lý do không
 * bắt buộc (ghi vào nhật ký).
 */
import axios from 'axios'
import { useEffect, useState, type FormEvent } from 'react'
import type { Account } from '../../../shared/types/account'
import type { Session } from '../../../shared/types/session'
import FormDialog from '../../../shared/ui/FormDialog'
import SessionTable from '../../../shared/ui/SessionTable'
import {
  listAccountSessions,
  signOutAccountSession,
} from '../services/accountService'

/**
 * AccountSessionsDialog: Chọn "Đăng xuất" ở một dòng thì popup chuyển sang bước xác nhận có ô lý do; nút
 * "Đăng xuất thiết bị" ở chân popup gửi yêu cầu. Thiết bị bị đăng xuất phải đăng nhập lại ở thao tác kế tiếp.
 */
export default function AccountSessionsDialog({
  account,
  onClose,
}: {
  account: Pick<Account, 'id' | 'username' | 'fullName'>
  onClose: () => void
}) {
  const [sessions, setSessions] = useState<Session[] | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [target, setTarget] = useState<Session | null>(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let active = true
    listAccountSessions(account.id)
      .then((found) => {
        if (active) setSessions(found)
      })
      .catch((requestError) => {
        if (active)
          setError(
            errorMessage(
              requestError,
              'Không tải được danh sách thiết bị. Vui lòng thử lại.',
            ),
          )
      })
    return () => {
      active = false
    }
  }, [account.id, reload])

  async function signOut(event: FormEvent) {
    event.preventDefault()
    if (!target) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await signOutAccountSession(account.id, target.id, reason)
      setNotice(
        `Đã đăng xuất ${target.device || 'thiết bị'} của ${account.username}.`,
      )
    } catch (requestError) {
      setError(
        errorMessage(requestError, 'Không đăng xuất được. Vui lòng thử lại.'),
      )
    } finally {
      setBusy(false)
      setTarget(null)
      setReason('')
      // Tải lại cả khi lỗi: phiên có thể đã kết thúc trước đó (MSG75).
      setReload((value) => value + 1)
    }
  }

  return (
    <FormDialog
      title={`Phiên đăng nhập của ${account.username}`}
      formId="account-session-sign-out"
      submitLabel={busy ? 'Đang đăng xuất…' : 'Đăng xuất thiết bị'}
      hideSubmit={target === null}
      closeLabel={target ? 'Hủy' : 'Đóng'}
      busy={busy}
      className="account-sessions-dialog"
      onClose={() => {
        if (target) {
          setTarget(null)
          setReason('')
        } else onClose()
      }}
    >
      <p className="account-sessions-intro">
        {account.fullName} đang đăng nhập trên các thiết bị dưới đây. Thiết bị
        bị đăng xuất phải đăng nhập lại ở thao tác kế tiếp.
      </p>
      {notice && (
        <p className="mf-success-notice" role="status">
          {notice}
        </p>
      )}
      {error && (
        <div className="dashboard-banner error-banner" role="alert">
          {error}
        </div>
      )}
      {target ? (
        <form
          id="account-session-sign-out"
          className="account-sessions-confirm"
          onSubmit={signOut}
        >
          <p>
            Đăng xuất <strong>{target.device || 'thiết bị'}</strong> của{' '}
            {account.username}?
          </p>
          <label>
            Lý do (không bắt buộc)
            <textarea
              maxLength={500}
              value={reason}
              disabled={busy}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Ví dụ: nhân viên báo mất điện thoại…"
            />
          </label>
        </form>
      ) : sessions === null ? (
        !error && <p role="status">Đang tải danh sách thiết bị…</p>
      ) : sessions.length === 0 ? (
        <p className="account-sessions-empty">
          Tài khoản không đăng nhập trên thiết bị nào.
        </p>
      ) : (
        <SessionTable
          sessions={sessions}
          disabled={busy}
          onSignOut={(session) => {
            setNotice('')
            setError('')
            setTarget(session)
          }}
        />
      )}
    </FormDialog>
  )
}

function errorMessage(error: unknown, fallback: string) {
  const message = axios.isAxiosError(error)
    ? error.response?.data?.message
    : undefined
  return typeof message === 'string' && message ? message : fallback
}
