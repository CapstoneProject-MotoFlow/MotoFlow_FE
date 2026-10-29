import './layouts.css'
import { HeaderSearchTarget } from '../../shared/ui/HeaderSearchTarget'
import { useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../shared/hooks/useAuth'
import Brand from '../../shared/ui/Brand'
import Icon from '../../shared/ui/Icon'
import { ownerNavigation, type NavItem } from './ownerNavigation'
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
  const items: NavItem[] = [{ label: 'Tổng quan', href: '/dashboard', icon: 'grid' }]
  if (role === 'ADMIN') items.push(
    { label: 'Tài khoản', href: '/accounts', icon: 'users', group: 'HỆ THỐNG' },
    { label: 'Cửa hàng', href: '/stores', icon: 'store' },
    { label: 'Lịch sử phân quyền', href: '/permission-history', icon: 'shield' },
  )
  else if (role === 'OWNER') items.push(...ownerNavigation)
  if (role !== 'ADMIN' && role !== 'OWNER') items.push({ label: 'Sản phẩm', href: '/dashboard#products', icon: 'box', group: role === 'OWNER' ? undefined : 'HOẠT ĐỘNG' })
  function isNavActive(href: string) {
    if (href === '/dashboard' && location.pathname.startsWith('/profile')) return true
    if (href === '/owner/customers' && location.pathname.startsWith('/owner/customers/')) return true
    return location.pathname + location.hash === href
  }
  const initials = (user.fullName || user.username).split(/\s+/).slice(-2).map((part) => part[0]).join('').toLocaleUpperCase('vi')

  return <div className={['admin-dashboard', collapsed ? 'sidebar-collapsed' : '', role === 'OWNER' ? 'owner-dashboard' : ''].join(' ')}>
    <aside className={collapsed ? 'admin-sidebar is-collapsed' : 'admin-sidebar'}>
      <div className="sidebar-brand"><Brand compact /></div>
      <nav className="sidebar-nav" aria-label="Điều hướng dashboard">{items.map((item) => <div key={item.href}>
        {item.group && !collapsed && <p className="nav-group-title">{item.group}</p>}
        <Link onClick={event => { if (item.pending) { event.preventDefault(); setOwnerNotice(`${item.label}: chưa có dữ liệu hiển thị.`) } }} className={isNavActive(item.href) ? 'sidebar-link is-active' : 'sidebar-link'} to={item.href} title={collapsed ? item.label : undefined}><Icon name={item.icon} />{!collapsed && <span>{item.label}</span>}</Link>
      </div>)}</nav>
      {!collapsed && <div className="sidebar-scope"><span>Phạm vi làm việc</span><strong>{role === 'OWNER' ? 'Toàn chuỗi' : roleNames[role] || role}</strong></div>}
    </aside>
    <div className="dashboard-main">
      <header className="dashboard-header"><div className="header-tools">
        <button className="icon-button sidebar-toggle" type="button" onClick={() => setCollapsed((value) => !value)} aria-expanded={!collapsed} aria-label={collapsed ? 'Mở rộng menu' : 'Thu gọn menu'}><Icon name="menu" /></button>
        <div id="header-search" ref={setSearchTarget} />
      </div><div className="header-profile-tools">{role === 'OWNER' && <button className="icon-button owner-bell" type="button" aria-label="Thông báo" onClick={() => setOwnerNotice('Chưa có dữ liệu thông báo.')}><Icon name="bell" /></button>}<div className="profile-area">
        <button className="profile-button" type="button" onClick={() => setProfileOpen((open) => !open)}><span className="profile-avatar">{initials}</span><span className="profile-text"><strong>{user.fullName || user.username}</strong><small>{roleNames[role] || role}</small></span><span className="profile-caret">⌄</span></button>
        {profileOpen && <div className="profile-menu"><div className="profile-menu-heading"><strong>{user.fullName || user.username}</strong><small>{user.username} · {roleNames[role] || role}</small></div><Link to="/profile" className="profile-menu-link" onClick={() => setProfileOpen(false)}><Icon name="users" />Thông tin cá nhân</Link><button className="profile-menu-logout" type="button" onClick={() => void signOut()}><Icon name="logout" />Đăng xuất</button></div>}
      </div></div></header>
      {role === 'OWNER' && ownerNotice && <div className="owner-notice" role="status"><span>{ownerNotice}</span><button type="button" onClick={() => setOwnerNotice('')} aria-label="Đóng thông báo">×</button></div>}
      <HeaderSearchTarget.Provider value={searchTarget}><Outlet key={location.pathname} /></HeaderSearchTarget.Provider>
    </div>
  </div>
}
