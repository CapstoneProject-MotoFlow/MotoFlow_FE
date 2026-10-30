import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import Icon, { type IconName } from '../../shared/ui/Icon'
import type { NavItem } from './ownerNavigation'
import { branchManagerNavigation as ownerNavigation } from './branchManagerNavigation'
const groups: { label: string; icon: IconName; labels: string[] }[] = [
  { label: 'Bán hàng', icon: 'receipt', labels: ['Đơn bán', 'Khách hàng'] },
  { label: 'Điều chuyển', icon: 'transfer', labels: ['Yêu cầu bổ sung', 'Lệnh điều chuyển'] },
  { label: 'Kho hàng', icon: 'box', labels: ['Tồn kho', 'Lịch sử xuất nhập', 'Lô hàng', 'Tồn theo ngày', 'Kiểm kê'] },
  { label: 'Chứng từ', icon: 'document', labels: ['Tra cứu chứng từ', 'Yêu cầu điều chỉnh'] },
  { label: 'Báo cáo', icon: 'chart', labels: ['Báo cáo bán hàng', 'Báo cáo kho hàng'] },
]
export default function BranchManagerSidebarNav({ collapsed, onNotice }: { collapsed: boolean; onNotice: (message: string) => void }) {
  const location = useLocation()
  const active = (href: string) => href.includes('#') ? location.pathname + location.hash === href : location.pathname === href || location.pathname.startsWith(href + '/')
  const [open, setOpen] = useState<string[]>(() => groups.filter(group => ownerNavigation.some(item => group.labels.includes(item.label) && active(item.href))).map(group => group.label))
  const find = (label: string) => ownerNavigation.find(item => item.label === label)
  function link(item: NavItem | undefined, child = false) {
    if (!item) return null
    return <Link key={item.href} to={item.href} title={collapsed ? item.label : undefined} className={`sidebar-link${child ? ' owner-child-link' : ''}${active(item.href) ? ' is-active' : ''}`} onClick={event => { if (item.pending) { event.preventDefault(); onNotice(`${item.label}: chưa có dữ liệu hiển thị.`) } }}>{!child && <Icon name={item.icon} />}{!collapsed && <span>{item.label === 'Báo cáo kho hàng' ? 'Báo cáo kho' : item.label}</span>}</Link>
  }
  function group(label: string) {
    const entry = groups.find(item => item.label === label)!
    const expanded = open.includes(label)
    return <div key={label} className="owner-nav-group"><button type="button" className={'sidebar-link owner-group-toggle' + (expanded ? ' is-open' : '')} title={collapsed ? label : undefined} aria-expanded={expanded && !collapsed} aria-controls={`owner-nav-${entry.icon}`} onClick={() => setOpen(old => old.includes(label) ? old.filter(value => value !== label) : [...old, label])}><Icon name={entry.icon} />{!collapsed && <><span>{label}</span><svg className={expanded ? 'owner-nav-caret expanded' : 'owner-nav-caret'} viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m5 7 5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg></>}</button>{!collapsed && expanded && <div id={`owner-nav-${entry.icon}`} className="owner-submenu">{entry.labels.map(name => link(find(name), true))}</div>}</div>
  }
  return <nav className="sidebar-nav owner-accordion" aria-label="Điều hướng quản lý cửa hàng">{link({ label: 'Tổng quan', href: '/dashboard', icon: 'grid' })}{link(find('Thông báo'))}{group('Bán hàng')}{link(find('Công nợ'))}{link(find('Yêu cầu nhập hàng'))}{group('Điều chuyển')}{group('Kho hàng')}{group('Chứng từ')}{group('Báo cáo')}{link(find('Bảng giá'))}{link(find('Phụ tùng'))}</nav>
}


