import { useState, type FormEvent } from 'react'
import axios from 'axios'
import AuthLayout from '../../../shared/components/AuthLayout'
import PasswordField from '../../../shared/components/PasswordField'
import axiosClient from '../../../shared/api/axiosClient'
import type { AuthUser } from '../../../shared/types/auth'
import PasswordRequirements from '../PasswordRequirements'
import { validateNewPassword } from '../passwordPolicy'

type ChangePasswordPageProps = {
  user: AuthUser
  onChanged: () => void
  onLogout: () => void
}

export default function ChangePasswordPage({ user, onChanged, onLogout }: ChangePasswordPageProps) {
  const [temporaryPassword, setTemporaryPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const passwordValidation = validateNewPassword(newPassword, temporaryPassword, user.username)
  const matchesConfirmation = confirmation.length > 0 && newPassword === confirmation

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    if (!passwordValidation.isValid) {
      setError(passwordValidation.error)
      return
    }
    if (newPassword !== confirmation) {
      setError('Mật khẩu nhập lại chưa khớp.')
      return
    }

    setSubmitting(true)
    try {
      await axiosClient.post<void>('/auth/change-password', {
        currentPassword: temporaryPassword,
        newPassword,
      })
      onChanged()
    } catch (requestError) {
      const message = axios.isAxiosError(requestError)
        ? requestError.response?.data?.message
        : undefined
      setError(typeof message === 'string' ? message : 'Không thể đổi mật khẩu. Vui lòng thử lại.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout>
      <form className="login-form change-password-form" onSubmit={handleSubmit}>
        <h1>Đổi mật khẩu</h1>
        <PasswordNotice />

        <PasswordField id="temporary-password" label="Mật khẩu tạm" value={temporaryPassword} onChange={setTemporaryPassword} autoComplete="current-password" />
        <PasswordField id="new-password" label="Mật khẩu mới" value={newPassword} onChange={(value) => { setNewPassword(value); setError('') }} autoComplete="new-password" />

        <PasswordRequirements password={newPassword} temporaryPassword={temporaryPassword} username={user.username} />

        <PasswordField id="confirm-password" label="Nhập lại mật khẩu mới" value={confirmation} onChange={(value) => { setConfirmation(value); setError('') }} autoComplete="new-password" />
        {confirmation && (
          <p className={matchesConfirmation ? 'confirmation-hint is-valid' : 'confirmation-hint'}>
            {matchesConfirmation ? 'Mật khẩu đã khớp.' : 'Mật khẩu nhập lại chưa khớp.'}
          </p>
        )}

        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="submit-button" type="submit" disabled={submitting}>
          {submitting ? 'Đang cập nhật…' : 'Đổi mật khẩu'}
        </button>
        <button className="text-button logout-link" type="button" onClick={onLogout}>Đăng xuất</button>
      </form>
    </AuthLayout>
  )
}

function PasswordNotice() {
  return (
    <div className="password-notice" role="note">
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" />
        <path d="M12 11v5m0-8h.01" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
      <span>Bạn đang dùng mật khẩu tạm. Vui lòng đổi mật khẩu trước khi tiếp tục.</span>
    </div>
  )
}
