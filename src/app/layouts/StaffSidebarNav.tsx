/**
 * File: app/layouts/StaffSidebarNav.tsx
 * Loại: THÀNH PHẦN / XỬ LÝ HỖ TRỢ — không phải màn hình độc lập.
 * Công dụng: Menu dành cho nhân viên.
 */
import { Link, useLocation } from 'react-router-dom'
import Icon from '../../shared/ui/Icon'
import type { NavItem } from './ownerNavigation'
const items: NavItem[] = [
  { label: 'Tổng quan', href: '/dashboard', icon: 'grid' },
  {
    label: 'Thông báo',
    href: '/notifications',
    icon: 'bell',
  },
  { label: 'Đơn bán', href: '/sales-orders', icon: 'receipt' },
  {
    label: 'Yêu cầu nhập hàng',
    href: '/purchase-orders',
    icon: 'clipboard',
  },
  {
    label: 'Lệnh điều chuyển',
    href: '#staff-transfers',
    icon: 'truck',
    pending: true,
  },
  { label: 'Kiểm kê', href: '/stock-counts', icon: 'checklist' },
  { label: 'Phụ tùng', href: '/staff/products', icon: 'tool' },
]
/** StaffSidebarNav: Menu dành cho nhân viên. */
export default function StaffSidebarNav({
  collapsed,
  onNotice,
}: {
  collapsed: boolean
  onNotice: (message: string) => void
}) {
  const location = useLocation()
  return (
    <nav
      className="sidebar-nav owner-accordion"
      aria-label="Điều hướng nhân viên"
    >
      {items.map((item) => (
        <Link
          key={item.href}
          to={item.href}
          title={collapsed ? item.label : undefined}
          className={
            'sidebar-link' +
            (location.pathname + location.hash === item.href ||
            location.pathname.startsWith(item.href + '/')
              ? ' is-active'
              : '')
          }
          onClick={(event) => {
            if (item.pending) {
              event.preventDefault()
              onNotice(`${item.label}: chức năng đang được hoàn thiện.`)
            }
          }}
        >
          <Icon name={item.icon} />
          {!collapsed && <span>{item.label}</span>}
        </Link>
      ))}
    </nav>
  )
}
