/**
 * Shared dashboard entry for all roles. Admin-only overview sections are in
 * Admin overview is implemented in features/admin/AdminDashboardOverview; owner/manager/staff
 * overview sections are in BusinessOverview.
 * DashboardShell is shared by admin account/store pages so navigation stays consistent.
 */
import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { AuthUser } from '../../shared/types/auth'
import Brand from '../../shared/components/Brand'
import { loadDashboard } from './dashboardService'
import type { DashboardData, DashboardProduct } from './dashboardTypes'
import { DashboardIcon, MetricCard, StoreStatusPanel, type IconName } from './DashboardWidgets'
import AdminDashboardOverview from '../admin/AdminDashboardOverview'

type DashboardPageProps = { user: AuthUser; onLogout: () => void }

const roleNames: Record<string, string> = {
  ADMIN: 'Admin',
  OWNER: 'Chủ cửa hàng',
  BRANCH_MANAGER: 'Quản lý cửa hàng',
  STAFF: 'Nhân viên',
}
export default function DashboardPage({ user, onLogout }: DashboardPageProps) {
  const role = user.role || 'STAFF'
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true
    loadDashboard(role)
      .then((result) => { if (mounted) setData(result) })
      .catch(() => { if (mounted) setError('Không tải được dữ liệu. Hãy kiểm tra kết nối backend và quyền truy cập của tài khoản.') })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [role])

  const searchItems = useMemo(() => {
    if (!data) return []
    if (role === 'ADMIN') return data.accounts.map((account) => ({ id: account.id, title: account.fullName, subtitle: account.username }))
    return data.products.map((product) => ({ id: product.id, title: product.partName, subtitle: product.sku }))
  }, [data, role])
  const greetingName = (user.fullName || user.username).trim().split(/\s+/).at(-1)

  return (
    <DashboardShell user={user} role={role} activePage="overview" searchItems={searchItems} onLogout={onLogout}>
      <main className="dashboard-content" id="overview">
          <h1 className="dashboard-greeting">Chào {greetingName}</h1>
          <p className="dashboard-role-caption">Tổng quan · {roleNames[role] || role}</p>
          {loading && <div className="dashboard-banner">Đang tải dữ liệu…</div>}
          {error && <div className="dashboard-banner error-banner" role="alert">{error}</div>}
          {!loading && !error && data && (role === 'ADMIN'
            ? <AdminDashboardOverview data={data} />
            : <BusinessOverview data={data} user={user} role={role} />)}
      </main>
    </DashboardShell>
  )
}

export function DashboardShell({
  user,
  role,
  activePage,
  searchItems,
  searchPlaceholder,
  onLogout,
  children,
}: {
  user: AuthUser
  role: string
  activePage: 'overview' | 'stores' | 'accounts' | 'history'
  searchItems: { id: number; title: string; subtitle: string }[]
  searchPlaceholder?: string
  onLogout: () => void
  children: ReactNode
}) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className={collapsed ? 'admin-dashboard sidebar-collapsed' : 'admin-dashboard'}>
      <DashboardSidebar role={role} collapsed={collapsed} activePage={activePage} />
      <div className="dashboard-main">
        <DashboardHeader
          user={user}
          role={role}
          searchItems={searchItems}
          searchPlaceholder={searchPlaceholder}
          onToggleSidebar={() => setCollapsed((value) => !value)}
          onLogout={onLogout}
        />
        {children}
      </div>
    </div>
  )
}

function DashboardSidebar({ role, collapsed, activePage }: { role: string; collapsed: boolean; activePage: 'overview' | 'stores' | 'accounts' | 'history' }) {
  const commonLinks: { label: string; href: string; icon: IconName; group?: string; page?: 'overview' | 'stores' | 'accounts' | 'history' }[] = [{ label: 'Tổng quan', href: '/dashboard', icon: 'grid', page: 'overview' }]
  const roleLinks: { label: string; href: string; icon: IconName; group?: string; page?: 'overview' | 'stores' | 'accounts' | 'history' }[] = role === 'ADMIN'
    ? [
        { label: 'Tài khoản', href: '/accounts', icon: 'users' as const, group: 'HỆ THỐNG', page: 'accounts' as const },
        { label: 'Cửa hàng', href: '/stores', icon: 'store' as const, page: 'stores' as const },
        { label: 'Lịch sử phân quyền', href: '/permission-history', icon: 'shield' as const, page: 'history' as const },
      ]
    : [
        { label: 'Sản phẩm', href: '/dashboard#products', icon: 'box' as const, group: 'HOẠT ĐỘNG' },
        ...(role === 'OWNER' ? [{ label: 'Cửa hàng', href: '/stores', icon: 'store' as const, page: 'stores' as const }] : []),
      ]

  return (
    <aside className={collapsed ? 'admin-sidebar is-collapsed' : 'admin-sidebar'}>
      <div className="sidebar-brand"><Brand compact /></div>
      <nav className="sidebar-nav" aria-label="Điều hướng dashboard">
        {[...commonLinks, ...roleLinks].map((link) => (
          <div key={link.href}>
            {link.group && !collapsed && <p className="nav-group-title">{link.group}</p>}
            <Link className={link.page === activePage ? 'sidebar-link is-active' : 'sidebar-link'} to={link.href} title={collapsed ? link.label : undefined}>
              <DashboardIcon name={link.icon} />
              {!collapsed && <span>{link.label}</span>}
            </Link>
          </div>
        ))}
      </nav>
      {!collapsed && <div className="sidebar-scope"><span>Phạm vi làm việc</span><strong>{roleNames[role] || role}</strong></div>}
    </aside>
  )
}

function DashboardHeader({
  user,
  role,
  searchItems,
  searchPlaceholder,
  onToggleSidebar,
  onLogout,
}: {
  user: AuthUser
  role: string
  searchItems: { id: number; title: string; subtitle: string }[]
  searchPlaceholder?: string
  onToggleSidebar: () => void
  onLogout: () => void
}) {
  const [query, setQuery] = useState('')
  const [profileOpen, setProfileOpen] = useState(false)
  const normalizedQuery = query.trim().toLocaleLowerCase('vi')
  const matches = normalizedQuery
    ? searchItems.filter((item) => `${item.title} ${item.subtitle}`.toLocaleLowerCase('vi').includes(normalizedQuery)).slice(0, 6)
    : []
  const initials = (user.fullName || user.username).split(/\s+/).slice(-2).map((part) => part[0]).join('').toLocaleUpperCase('vi')

  return (
    <header className="dashboard-header">
      <div className="header-tools">
        <button className="icon-button sidebar-toggle" type="button" onClick={onToggleSidebar} aria-label="Thu gọn menu"><DashboardIcon name="menu" /></button>
        <div className="account-search">
          <DashboardIcon name="search" />
          <input
            type="search"
            placeholder={searchPlaceholder || (role === 'ADMIN' ? 'Tìm tài khoản theo tên đăng nhập, họ tên...' : 'Tìm sản phẩm theo tên hoặc mã...')}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Tìm kiếm"
          />
          {query && <div className="search-results">
            {matches.length ? matches.map((item) => <button key={item.id} type="button" onClick={() => setQuery(item.subtitle)}><span className="search-result-name">{item.title}</span><span className="search-result-meta">{item.subtitle}</span></button>) : <p>Không tìm thấy kết quả.</p>}
          </div>}
        </div>
      </div>
      <div className="profile-area">
        <button className="profile-button" type="button" onClick={() => setProfileOpen((open) => !open)}>
          <span className="profile-avatar">{initials}</span>
          <span className="profile-text"><strong>{user.fullName || user.username}</strong><small>{roleNames[role] || role}</small></span>
          <span className="profile-caret">⌄</span>
        </button>
        {profileOpen && <div className="profile-menu">
          <div className="profile-menu-heading"><strong>{user.fullName || user.username}</strong><small>{user.username} · {roleNames[role] || role}</small></div>
          <Link to="/profile/change-password" className="profile-menu-link"><DashboardIcon name="key" />Đổi mật khẩu</Link>
          <button className="profile-menu-logout" type="button" onClick={onLogout}><DashboardIcon name="logout" />Đăng xuất</button>
        </div>}
      </div>
    </header>
  )
}

function BusinessOverview({ data, user, role }: { data: DashboardData; user: AuthUser; role: string }) {
  const productsWithStock = data.products.filter((product) => (product.availableQty ?? 0) > 0).length

  return <>
    <section className="metrics-grid business-metrics" aria-label="Tổng quan công việc">
      <MetricCard title="Sản phẩm trong danh mục" value={data.productCount} icon="box" color="blue" href="#products" />
      <MetricCard title="Có hàng trong danh sách xem" value={productsWithStock} icon="store" color="green" href="#products" />
      {role === 'OWNER' && <MetricCard title="Cửa hàng đang hoạt động" value={data.stores.filter((store) => store.status === 'ACTIVE').length} icon="users" color="cyan" href="#stores" />}
    </section>
    <section className="business-columns">
      <ProductPanel products={data.products} />
      {role === 'OWNER'
        ? <StoreStatusPanel stores={data.stores} />
        : <WorkScopePanel user={user} role={role} />}
    </section>
  </>
}

function ProductPanel({ products }: { products: DashboardProduct[] }) {
  return <section className="dashboard-panel product-panel" id="products">
    <div className="panel-heading"><h2>Sản phẩm gần đây</h2><span className="panel-subtitle">Dữ liệu theo phạm vi cửa hàng của bạn</span></div>
    {products.length ? <div className="table-scroll"><table>
      <thead><tr><th>Sản phẩm</th><th>Mã SKU</th><th>Tồn khả dụng</th><th>Vị trí</th></tr></thead>
      <tbody>{products.map((product) => <tr key={product.id}>
        <td><strong>{product.partName}</strong><small>{product.brand || product.categoryName}</small></td>
        <td>{product.sku}</td>
        <td>{product.availableQty ?? '—'} {product.availableQty !== null ? product.baseUnit : ''}</td>
        <td>{[product.storageArea, product.binLocation].filter(Boolean).join(' · ') || '—'}</td>
      </tr>)}</tbody>
    </table></div> : <p className="empty-state">Chưa có sản phẩm phù hợp.</p>}
  </section>
}

function WorkScopePanel({ user, role }: { user: AuthUser; role: string }) {
  return <section className="dashboard-panel work-scope-panel">
    <div className="panel-heading"><h2>Phạm vi làm việc</h2></div>
    <div className="scope-content">
      <span className="metric-icon tone-blue"><DashboardIcon name="users" /></span>
      <strong>{roleNames[role] || role}</strong>
      <p>{user.storeId ? `Cửa hàng ID ${user.storeId}` : 'Chuỗi cửa hàng Nga Minh'}</p>
    </div>
  </section>
}
