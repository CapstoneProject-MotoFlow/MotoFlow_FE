import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import Icon from '../../shared/ui/Icon'
export default function AdminSidebarNav({ collapsed }: { collapsed: boolean }) {
  const location = useLocation()
  const [open, setOpen] = useState(true)
  const items = [
    { label: 'Cửa hàng', href: '/stores' },
    { label: 'Tài khoản', href: '/accounts' },
    { label: 'Lịch sử phân quyền', href: '/permission-history' },
  ]
  return (
    <nav className="sidebar-nav owner-accordion" aria-label="Điều hướng Admin">
      <Link
        to="/dashboard"
        className={
          'sidebar-link' +
          (location.pathname === '/dashboard' ? ' is-active' : '')
        }
        title={collapsed ? 'Tổng quan' : undefined}
      >
        <Icon name="grid" />
        {!collapsed && <span>Tổng quan</span>}
      </Link>
      <button
        type="button"
        className="sidebar-link owner-group-toggle"
        aria-expanded={open && !collapsed}
        aria-controls="admin-system-menu"
        title={collapsed ? 'Hệ thống' : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        <Icon name="store" />
        {!collapsed && (
          <>
            <span>Hệ thống</span>
            <svg
              className={'owner-nav-caret' + (open ? ' expanded' : '')}
              viewBox="0 0 20 20"
              fill="none"
              aria-hidden="true"
            >
              <path d="m5 7 5 5 5-5" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </>
        )}
      </button>
      {!collapsed && open && (
        <div id="admin-system-menu" className="owner-submenu">
          {items.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              className={
                'sidebar-link owner-child-link' +
                (location.pathname.startsWith(item.href) ? ' is-active' : '')
              }
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </nav>
  )
}
