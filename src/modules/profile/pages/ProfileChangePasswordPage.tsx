/** Password change form for an already signed-in user. The temporary-password flow stays on the auth page. */
import { useState, type FormEvent } from 'react'
import axios from 'axios'
import { Link, useNavigate } from 'react-router-dom'
import PasswordField from '../../../shared/ui/PasswordField'
import PasswordRequirements from '../../../shared/ui/PasswordRequirements'
import { validateNewPassword } from '../../../shared/utils/passwordPolicy'
import { useAuth } from '../../../shared/hooks/useAuth'
import '../profile.css'
import { changePassword } from '../services/profileService'

export default function ProfileChangePasswordPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const validation = validateNewPassword(newPassword, currentPassword, user!.username)
  const matches = confirmation.length > 0 && confirmation === newPassword

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSuccess('')
    if (!validation.isValid) { setError(validation.error); return }
    if (newPassword !== confirmation) { setError('Mật khẩu nhập lại chưa khớp.'); return }

    setSubmitting(true)
    try {
      await changePassword(currentPassword, newPassword)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmation('')
      setSuccess('Đổi mật khẩu thành công. Bạn có thể tiếp tục sử dụng MotoFlow.')
    } catch (requestError) {
      const message = axios.isAxiosError(requestError) ? requestError.response?.data?.message : undefined
      setError(typeof message === 'string' ? message : 'Không thể đổi mật khẩu. Vui lòng thử lại.')
    } finally { setSubmitting(false) }
  }

  return <>
    <main className="dashboard-content profile-password-content">
      <div className="profile-password-heading"><h1>Đổi mật khẩu</h1><div className="breadcrumb"><Link to="/dashboard">Trang chủ</Link><span>›</span><Link to="/profile">Thông tin cá nhân</Link><span>›</span><span>Đổi mật khẩu</span></div></div>
      <section className="profile-password-panel">
        <div className="profile-password-panel-title"><h2>Đặt mật khẩu mới</h2></div>
        <form className="profile-password-form" onSubmit={submit}>
          {success && <p className="profile-password-success" role="status">{success}</p>}
          {error && <p className="form-error profile-password-error" role="alert">{error}</p>}
          <PasswordField id="profile-current-password" label="Mật khẩu hiện tại" value={currentPassword} onChange={(value) => { setCurrentPassword(value); setError(''); setSuccess('') }} autoComplete="current-password" />
          <PasswordField id="profile-new-password" label="Mật khẩu mới" value={newPassword} onChange={(value) => { setNewPassword(value); setError(''); setSuccess('') }} autoComplete="new-password" />
          <PasswordRequirements password={newPassword} temporaryPassword={currentPassword} username={user!.username} differentFromLabel="Khác mật khẩu hiện tại" />
          <PasswordField id="profile-confirm-password" label="Nhập lại mật khẩu mới" value={confirmation} onChange={(value) => { setConfirmation(value); setError(''); setSuccess('') }} autoComplete="new-password" />
          {confirmation && <p className={matches ? 'confirmation-hint is-valid' : 'confirmation-hint'}>{matches ? 'Mật khẩu đã khớp.' : 'Mật khẩu nhập lại chưa khớp.'}</p>}
          <div className="profile-password-actions"><button className="submit-button" type="submit" disabled={submitting}>{submitting ? 'Đang cập nhật…' : 'Đổi mật khẩu'}</button><button className="secondary-button" type="button" disabled={submitting} onClick={() => navigate('/profile')}>Hủy</button></div>
        </form>
      </section>
    </main>
  </>
}
