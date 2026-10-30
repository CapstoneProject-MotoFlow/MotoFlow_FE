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
  { label: 'Đơn bán', href: '#staff-sales', icon: 'receipt', pending: true },
  {
    label: 'Yêu cầu nhập hàng',
    href: '#staff-receiving',
    icon: 'clipboard',
    pending: true,
  },
  {
    label: 'Lệnh điều chuyển',
    href: '#staff-transfers',
    icon: 'truck',
    pending: true,
  },
  { label: 'Kiểm kê', href: '#staff-counts', icon: 'checklist', pending: true },
  { label: 'Phụ tùng', href: '/staff/products', icon: 'tool' },
]
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
            (location.pathname + location.hash === item.href
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
