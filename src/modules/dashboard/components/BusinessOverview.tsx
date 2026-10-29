import type { AuthUser } from '../../../shared/types/auth'
import type { DashboardData, DashboardProduct } from '../types/dashboardTypes'
import { DashboardIcon, MetricCard, StoreStatusPanel } from './DashboardWidgets'

import { roleNames } from '../../../shared/utils/roles'

export default function BusinessOverview({ data, user, role }: { data: DashboardData; user: AuthUser; role: string }) {
  const productsWithStock = data.products.filter((product) => (product.availableQty ?? 0) > 0).length
  return <>
    <section className="metrics-grid business-metrics" aria-label="Tổng quan công việc">
      <MetricCard title="Sản phẩm trong danh mục" value={data.productCount} icon="box" color="blue" href="#products" />
      <MetricCard title="Có hàng trong danh sách xem" value={productsWithStock} icon="store" color="green" href="#products" />
      {role === 'OWNER' && <MetricCard title="Cửa hàng đang hoạt động" value={data.stores.filter((store) => store.status === 'ACTIVE').length} icon="users" color="cyan" href="#stores" />}
    </section>
    <section className="business-columns"><ProductPanel products={data.products} />{role === 'OWNER' ? <StoreStatusPanel stores={data.stores} /> : <WorkScopePanel user={user} role={role} />}</section>
  </>
}

function ProductPanel({ products }: { products: DashboardProduct[] }) {
  return <section className="dashboard-panel product-panel" id="products"><div className="panel-heading"><h2>Sản phẩm gần đây</h2><span className="panel-subtitle">Dữ liệu theo phạm vi cửa hàng của bạn</span></div>
    {products.length ? <div className="table-scroll"><table><thead><tr><th>Sản phẩm</th><th>Mã SKU</th><th>Tồn khả dụng</th><th>Vị trí</th></tr></thead><tbody>{products.map((product) => <tr key={product.id} id={`product-${product.id}`} tabIndex={-1}><td><strong>{product.partName}</strong><small>{product.brand || product.categoryName}</small></td><td>{product.sku}</td><td>{product.availableQty ?? '—'} {product.availableQty !== null ? product.baseUnit : ''}</td><td>{[product.storageArea, product.binLocation].filter(Boolean).join(' · ') || '—'}</td></tr>)}</tbody></table></div> : <p className="empty-state">Chưa có sản phẩm phù hợp.</p>}
  </section>
}

function WorkScopePanel({ user, role }: { user: AuthUser; role: string }) {
  return <section className="dashboard-panel work-scope-panel"><div className="panel-heading"><h2>Phạm vi làm việc</h2></div><div className="scope-content"><span className="metric-icon tone-blue"><DashboardIcon name="users" /></span><strong>{roleNames[role] || role}</strong><p>{user.storeId ? `Cửa hàng ID ${user.storeId}` : 'Chuỗi cửa hàng Nga Minh'}</p></div></section>
}
