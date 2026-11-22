/**
 * File: app/layouts/DashboardLayout.tsx
 * Loại: KHUNG GIAO DIỆN — bao quanh màn hình, không phải trang nghiệp vụ.
 * Công dụng: Khung sau đăng nhập: sidebar, header, menu tài khoản, chuông, ô tìm kiếm và Outlet chứa page; quản lý thu gọn menu và thông báo giao diện.
 */
import NotificationBell from './NotificationBell'
import AdminSidebarNav from './AdminSidebarNav'
import StaffSidebarNav from './StaffSidebarNav'
import BranchManagerSidebarNav from './BranchManagerSidebarNav'
import OwnerSidebarNav from './OwnerSidebarNav'
import PageErrorBoundary from './PageErrorBoundary'
import './layouts.css'
import { HeaderSearchTarget } from '../../shared/ui/HeaderSearchTarget'
import { useEffect, useRef, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../shared/hooks/useAuth'
import Brand from '../../shared/ui/Brand'
import Icon from '../../shared/ui/Icon'
import { roleNames } from '../../shared/utils/roles'

/** Dưới 600px menu là ngăn kéo mở bằng ☰, không còn thanh icon cố định. */
function usePhoneLayout(setDrawerOpen: (open: boolean) => void) {
  const [phone, setPhone] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(max-width: 599px)').matches,
  )
  useEffect(() => {
    const media = window.matchMedia('(max-width: 599px)')
    const update = () => {
      setPhone(media.matches)
      // Rời layout điện thoại thì đóng ngăn kéo, quay lại không tự mở.
      if (!media.matches) setDrawerOpen(false)
    }
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [setDrawerOpen])
  return phone
}

/** DashboardLayout: Khung sau đăng nhập: sidebar, header, menu tài khoản, chuông, ô tìm kiếm và Outlet chứa page; quản lý thu gọn menu và thông báo giao diện. */
export default function DashboardLayout() {
  const { user, signOut } = useAuth()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [ownerNotice, setOwnerNotice] = useState('')
  const [searchTarget, setSearchTarget] = useState<HTMLDivElement | null>(null)
  const phone = usePhoneLayout(setDrawerOpen)
  const sidebarRef = useRef<HTMLElement>(null)
  const toggleRef = useRef<HTMLButtonElement>(null)
  const drawerShown = phone && drawerOpen
  // Trên điện thoại menu luôn đầy đủ nhãn; thu gọn chỉ áp dụng cho máy tính/máy tính bảng.
  const menuCollapsed = collapsed && !phone
  useEffect(() => {
    if (!drawerShown) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    sidebarRef.current?.focus()
    function closeDrawer() {
      setDrawerOpen(false)
      toggleRef.current?.focus()
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') closeDrawer()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [drawerShown])
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
        menuCollapsed ? 'sidebar-collapsed' : '',
        role !== 'ADMIN' ? 'owner-dashboard' : 'admin-role-dashboard',
      ].join(' ')}
    >
      <aside
        id="admin-sidebar"
        ref={sidebarRef}
        tabIndex={drawerShown ? -1 : undefined}
        className={[
          'admin-sidebar',
          menuCollapsed ? 'is-collapsed' : '',
          drawerShown ? 'is-drawer-open' : '',
        ].join(' ')}
        onClick={(event) => {
          // Chọn một mục menu trên điện thoại thì đóng ngăn kéo.
          if (phone && (event.target as Element).closest('a')) setDrawerOpen(false)
        }}
      >
        <div className="sidebar-brand">
          <Brand compact />
        </div>
        {role === 'ADMIN' ? (
          <AdminSidebarNav collapsed={menuCollapsed} />
        ) : role === 'OWNER' ? (
          <OwnerSidebarNav collapsed={menuCollapsed} onNotice={setOwnerNotice} />
        ) : role === 'BRANCH_MANAGER' ? (
          <BranchManagerSidebarNav
            collapsed={menuCollapsed}
            onNotice={setOwnerNotice}
          />
        ) : role === 'STAFF' ? (
          <StaffSidebarNav collapsed={menuCollapsed} onNotice={setOwnerNotice} />
        ) : (
          <AdminSidebarNav collapsed={menuCollapsed} />
        )}
        {!menuCollapsed && (
          <div className="sidebar-scope">
            <span>Đang xem:</span>
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
      {drawerShown && (
        <div
          className="sidebar-backdrop"
          aria-hidden="true"
          onClick={() => {
            setDrawerOpen(false)
            toggleRef.current?.focus()
          }}
        />
      )}
      <div className="dashboard-main">
        <header className="dashboard-header">
          <div className="header-tools">
            <button
              ref={toggleRef}
              className="icon-button sidebar-toggle"
              type="button"
              onClick={() =>
                phone
                  ? setDrawerOpen((open) => !open)
                  : setCollapsed((value) => !value)
              }
              aria-expanded={phone ? drawerOpen : !collapsed}
              aria-controls="admin-sidebar"
              aria-label={
                phone
                  ? drawerOpen
                    ? 'Đóng menu'
                    : 'Mở menu'
                  : collapsed
                    ? 'Mở rộng menu'
                    : 'Thu gọn menu'
              }
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
          <section className="access-denied-card" role="alert">
            <h2>Không có quyền truy cập</h2>
            <p>Bạn chưa được cấp quyền sử dụng chức năng này. (MSG05)</p>
            <Link className="mf-btn mf-btn--secondary" to="/">
              Về trang chủ
            </Link>
          </section>
        )}
        <HeaderSearchTarget.Provider value={searchTarget}>
          <PageErrorBoundary key={location.pathname}>
            <Outlet />
          </PageErrorBoundary>
        </HeaderSearchTarget.Provider>
      </div>
    </div>
  )
}
