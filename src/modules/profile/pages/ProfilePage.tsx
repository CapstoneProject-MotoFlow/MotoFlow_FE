/**
 * File: modules/profile/pages/ProfilePage.tsx
 * Loại: MÀN HÌNH — Thông tin cá nhân.
 * Đường dẫn: /profile.
 * Công dụng: Đọc thông tin tài khoản hiện tại, vai trò/quyền, tên cửa hàng; mở đổi mật khẩu.
 */
import { useAuth } from '../../../shared/hooks/useAuth'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import axiosClient from '../../../shared/api/axiosClient'
import type { AuthUser } from '../../../shared/types/auth'
import { roleNames } from '../../../shared/utils/roles'
import '../profile.css'

const permissionNames: Record<string, string> = {
  CATALOG_EDIT: 'Chỉnh sửa danh mục',
  RETAIL_PRICE_EDIT: 'Chỉnh sửa giá bán lẻ',
}
/** ProfilePage: Đọc thông tin tài khoản hiện tại, vai trò/quyền, tên cửa hàng; mở đổi mật khẩu. */
export default function ProfilePage() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<AuthUser | null>(null)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    let active = true
    axiosClient
      .get<AuthUser>('/auth/me')
      .then((response) => {
        if (active) setProfile(response.data)
      })
      .catch(() => {
        if (active)
          setError('Không tải được thông tin cá nhân. Vui lòng thử lại.')
      })
    return () => {
      active = false
    }
  }, [retry])
  return (
    <main className="dashboard-content profile-info-content">
      <div className="profile-password-heading">
        <h1>Thông tin cá nhân</h1>
        <Link to="/dashboard">Trang chủ</Link>
      </div>
      {error ? (
        <div className="dashboard-banner error-banner" role="alert">
          {error}{' '}
          <button
            type="button"
            onClick={() => {
              setError('')
              setRetry((value) => value + 1)
            }}
          >
            Thử lại
          </button>
        </div>
      ) : !profile ? (
        <p role="status">Đang tải thông tin…</p>
      ) : (
        <section
          className="profile-info-panel"
          aria-label="Thông tin tài khoản"
        >
          <div className="profile-password-panel-title">
            <h2>Thông tin tài khoản</h2>
          </div>
          <dl className="profile-info-list">
            <div>
              <dt>Họ và tên</dt>
              <dd>{profile.fullName || 'Chưa có thông tin'}</dd>
            </div>
            <div>
              <dt>Tên đăng nhập</dt>
              <dd>{profile.username}</dd>
            </div>
            <div>
              <dt>Vai trò</dt>
              <dd>
                {roleNames[profile.role || ''] ||
                  profile.role ||
                  'Chưa có thông tin'}
              </dd>
            </div>
            <div>
              <dt>Cửa hàng / phạm vi làm việc</dt>
              <dd>
                {profile.storeName ||
                  user?.storeName ||
                  (profile.storeId != null
                    ? 'Cửa hàng #' + profile.storeId
                    : profile.role === 'OWNER' || profile.role === 'ADMIN'
                      ? 'Toàn chuỗi'
                      : 'Chưa được phân công cửa hàng')}
              </dd>
            </div>
            <div>
              <dt>Quyền được cấp thêm</dt>
              <dd>
                {profile.permissions === undefined ? (
                  'Chưa có thông tin quyền được cấp'
                ) : profile.permissions.length ? (
                  <ul>
                    {profile.permissions.map((permission) => (
                      <li key={permission}>
                        {permissionNames[permission] || permission}
                      </li>
                    ))}
                  </ul>
                ) : (
                  'Không có quyền được cấp thêm'
                )}
                <p className="profile-info-hint">
                  Quyền theo vai trò được áp dụng riêng.
                </p>
              </dd>
            </div>
          </dl>
        </section>
      )}
      <section className="profile-info-panel profile-security">
        <div>
          <h2>Bảo mật tài khoản</h2>
          <p>Thay đổi mật khẩu đăng nhập của bạn.</p>
        </div>
        <Link className="profile-password-link" to="/profile/change-password">
          Đổi mật khẩu
        </Link>
      </section>
    </main>
  )
}
