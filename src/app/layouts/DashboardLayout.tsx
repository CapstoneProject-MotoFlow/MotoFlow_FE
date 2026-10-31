import NotificationBell from './NotificationBell'
import AdminSidebarNav from './AdminSidebarNav'
import StaffSidebarNav from './StaffSidebarNav'
import BranchManagerSidebarNav from './BranchManagerSidebarNav'
import OwnerSidebarNav from './OwnerSidebarNav'
import './layouts.css'
import { HeaderSearchTarget } from '../../shared/ui/HeaderSearchTarget'
import { useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../shared/hooks/useAuth'
import Brand from '../../shared/ui/Brand'
import Icon from '../../shared/ui/Icon'
import { roleNames } from '../../shared/utils/roles'

export default function DashboardLayout() {
  const { user, signOut } = useAuth()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [ownerNotice, setOwnerNotice] = useState('')
  const [searchTarget, setSearchTarget] = useState<HTMLDivElement | null>(null)
  if (!user) return null
  const role = user.role || 'STAFF'
  const initials = (user.fullName || user.username)
    .split(/\s+/)
    .slice(-2)
    .map((part) => part[0])
    .join('')
    .toLocaleUpperCase('vi')

  return (
    <div
      className={[
        'admin-dashboard',
        collapsed ? 'sidebar-collapsed' : '',
        role !== 'ADMIN' ? 'owner-dashboard' : 'admin-role-dashboard',
      ].join(' ')}
    >
      <aside
        className={collapsed ? 'admin-sidebar is-collapsed' : 'admin-sidebar'}
      >
        <div className="sidebar-brand">
          <Brand compact />
        </div>
        {role === 'ADMIN' ? (
          <AdminSidebarNav collapsed={collapsed} />
        ) : role === 'OWNER' ? (
          <OwnerSidebarNav collapsed={collapsed} onNotice={setOwnerNotice} />
        ) : role === 'BRANCH_MANAGER' ? (
          <BranchManagerSidebarNav
            collapsed={collapsed}
            onNotice={setOwnerNotice}
          />
        ) : role === 'STAFF' ? (
          <StaffSidebarNav collapsed={collapsed} onNotice={setOwnerNotice} />
        ) : (
          <AdminSidebarNav collapsed={collapsed} />
        )}
        {!collapsed && (
          <div className="sidebar-scope">
            <span>Phạm vi làm việc</span>
            <strong>
              {role === 'OWNER'
                ? 'Toàn chuỗi'
                : role === 'BRANCH_MANAGER' || role === 'STAFF'
                  ? user.storeName || 'Chưa được phân công cửa hàng'
                  : role === 'ADMIN'
                    ? 'Quản trị hệ thống'
                    : roleNames[role] || role}
            </strong>
          </div>
        )}
      </aside>
      <div className="dashboard-main">
        <header className="dashboard-header">
          <div className="header-tools">
            <button
              className="icon-button sidebar-toggle"
              type="button"
              onClick={() => setCollapsed((value) => !value)}
              aria-expanded={!collapsed}
              aria-label={collapsed ? 'Mở rộng menu' : 'Thu gọn menu'}
            >
              <Icon name="menu" />
            </button>
            <div id="header-search" ref={setSearchTarget} />
          </div>
          <div className="header-profile-tools">
            {role !== 'ADMIN' && <NotificationBell />}
            <div className="profile-area">
              <button
                className="profile-button"
                type="button"
                aria-expanded={profileOpen}
                aria-label="Mở thông tin tài khoản"
                onClick={() => setProfileOpen((open) => !open)}
              >
                <span className="profile-avatar">{initials}</span>
                <span className="profile-text">
                  <strong>{user.fullName || user.username}</strong>
                  <small>{roleNames[role] || role}</small>
                </span>
                <svg
                  className="profile-caret"
                  viewBox="0 0 20 20"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="m6 8 4 4 4-4"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              {profileOpen && (
                <div className="profile-menu">
                  <div className="profile-menu-heading">
                    <strong>{user.fullName || user.username}</strong>
                    <small>
                      {user.username} · {roleNames[role] || role}
                    </small>
                  </div>
                  <Link
                    to="/profile"
                    className="profile-menu-link"
                    onClick={() => setProfileOpen(false)}
                  >
                    <Icon name="users" />
                    Thông tin cá nhân
                  </Link>
                  <button
                    className="profile-menu-logout"
                    type="button"
                    onClick={() => void signOut()}
                  >
                    <Icon name="logout" />
                    Đăng xuất
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        {role !== 'ADMIN' && ownerNotice && (
          <div className="owner-notice" role="status">
            <span>{ownerNotice}</span>
            <button
              type="button"
              onClick={() => setOwnerNotice('')}
              aria-label="Đóng thông báo"
            >
              ×
            </button>
          </div>
        )}
        {location.state?.accessDenied && (
          <p className="owner-notice" role="alert">
            Bạn không có quyền truy cập chức năng này. (MSG05)
          </p>
        )}
        <HeaderSearchTarget.Provider value={searchTarget}>
          <Outlet key={location.pathname} />
        </HeaderSearchTarget.Provider>
      </div>
    </div>
  )
}
