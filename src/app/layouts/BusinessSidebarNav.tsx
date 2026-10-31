import { canEditCatalog as hasCatalogPermission } from '../../shared/utils/roles'
import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import Icon, { type IconName } from '../../shared/ui/Icon'
import { ownerNavigation as ownerItems, type NavItem } from './ownerNavigation'
import { branchManagerNavigation } from './branchManagerNavigation'
import { useAuth } from '../../shared/hooks/useAuth'
const groups: { label: string; icon: IconName; labels: string[] }[] = [
  { label: 'Bán hàng', icon: 'receipt', labels: ['Đơn bán', 'Khách hàng'] },
  {
    label: 'Điều chuyển',
    icon: 'transfer',
    labels: ['Yêu cầu bổ sung', 'Lệnh điều chuyển'],
  },
  {
    label: 'Kho hàng',
    icon: 'box',
    labels: [
      'Tồn kho',
      'Lịch sử xuất nhập',
      'Lô hàng',
      'Tồn theo ngày',
      'Kỳ kho',
      'Kiểm kê',
    ],
  },
  {
    label: 'Chứng từ',
    icon: 'document',
    labels: ['Tra cứu chứng từ', 'Yêu cầu điều chỉnh'],
  },
  {
    label: 'Báo cáo',
    icon: 'chart',
    labels: [
      'Báo cáo bán hàng',
      'Báo cáo kho hàng',
      'Lãi gộp',
      'Xuất dữ liệu kế toán',
    ],
  },
  {
    label: 'Giá bán',
    icon: 'tag',
    labels: ['Bảng giá', 'Quy tắc giá', 'Quyền danh mục và giá'],
  },
  {
    label: 'Danh mục',
    icon: 'tool',
    labels: ['Phụ tùng', 'Nhóm phụ tùng', 'Dòng xe', 'Nhà cung cấp'],
  },
]
export default function BusinessSidebarNav({
  owner,
  collapsed,
  onNotice,
}: {
  owner: boolean
  collapsed: boolean
  onNotice: (message: string) => void
}) {
  const { user } = useAuth()
  const canEditCatalog = hasCatalogPermission(user)
  const ownerNavigation: NavItem[] = owner
    ? ownerItems
    : [
        ...branchManagerNavigation,
        ...(canEditCatalog
          ? [
              {
                label: 'Nhóm phụ tùng',
                href: '/branch-manager/categories',
                icon: 'tool' as const,
              },
              {
                label: 'Dòng xe',
                href: '/branch-manager/vehicles',
                icon: 'tool' as const,
              },
            ]
          : []),
      ]
  const availableGroups = groups.map((group) => ({
    ...group,
    labels: group.labels.filter((label) =>
      ownerNavigation.some((item) => item.label === label),
    ),
  }))
  const location = useLocation()
  const active = (href: string) =>
    href.includes('#')
      ? location.pathname + location.hash === href
      : location.pathname === href || location.pathname.startsWith(href + '/')
  const [open, setOpen] = useState<string[]>(() =>
    availableGroups
      .filter((group) =>
        ownerNavigation.some(
          (item) => group.labels.includes(item.label) && active(item.href),
        ),
      )
      .map((group) => group.label),
  )
  const find = (label: string) =>
    ownerNavigation.find((item) => item.label === label)
  function link(item: NavItem | undefined, child = false) {
    if (!item) return null
    return (
      <Link
        key={item.href}
        to={item.href}
        title={collapsed ? item.label : undefined}
        className={`sidebar-link${child ? ' owner-child-link' : ''}${active(item.href) ? ' is-active' : ''}`}
        onClick={(event) => {
          if (item.pending) {
            event.preventDefault()
            onNotice(`${item.label}: chưa có dữ liệu hiển thị.`)
          }
        }}
      >
        {!child && <Icon name={item.icon} />}
        {!collapsed && (
          <span>
            {item.label === 'Báo cáo kho hàng' ? 'Báo cáo kho' : item.label}
          </span>
        )}
      </Link>
    )
  }
  function group(label: string) {
    const entry = availableGroups.find((item) => item.label === label)!
    const expanded = open.includes(label)
    return (
      <div key={label} className="owner-nav-group">
        <button
          type="button"
          className={
            'sidebar-link owner-group-toggle' + (expanded ? ' is-open' : '')
          }
          title={collapsed ? label : undefined}
          aria-expanded={expanded && !collapsed}
          aria-controls={`owner-nav-${entry.icon}`}
          onClick={() =>
            setOpen((old) =>
              old.includes(label)
                ? old.filter((value) => value !== label)
                : [...old, label],
            )
          }
        >
          <Icon name={entry.icon} />
          {!collapsed && (
            <>
              <span>{label}</span>
              <svg
                className={
                  expanded ? 'owner-nav-caret expanded' : 'owner-nav-caret'
                }
                viewBox="0 0 20 20"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="m5 7 5 5 5-5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </>
          )}
        </button>
        {!collapsed && expanded && (
          <div id={`owner-nav-${entry.icon}`} className="owner-submenu">
            {entry.labels.map((name) => link(find(name), true))}
          </div>
        )}
      </div>
    )
  }
  return (
    <nav
      className="sidebar-nav owner-accordion"
      aria-label={owner ? 'Điều hướng Owner' : 'Điều hướng Branch Manager'}
    >
      {link({ label: 'Tổng quan', href: '/dashboard', icon: 'grid' })}
      {link(find('Thông báo'))}
      {group('Bán hàng')}
      {link(find('Công nợ'))}
      {link(find(owner ? 'Phiếu nhập hàng' : 'Yêu cầu nhập hàng'))}
      {group('Điều chuyển')}
      {group('Kho hàng')}
      {group('Chứng từ')}
      {group('Báo cáo')}
      {owner ? group('Giá bán') : link(find('Bảng giá'))}
      {owner || canEditCatalog ? group('Danh mục') : link(find('Phụ tùng'))}
      {owner && link(find('Cửa hàng'))}
    </nav>
  )
}
