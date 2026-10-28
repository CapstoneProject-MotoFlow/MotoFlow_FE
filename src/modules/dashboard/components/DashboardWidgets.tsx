import type { DashboardStore } from '../types/dashboardTypes'
import Icon, { type IconName } from '../../../shared/ui/Icon'
import { formatStoreStatus } from '../../../shared/utils/format'

/** Small reusable presentation pieces shared by role dashboards. */
export type { IconName }

export const DashboardIcon = Icon

export function MetricCard({ title, value, icon, color, href }: { title: string; value: number; icon: IconName; color: string; href: string }) {
  return <article className="metric-card">
    <span className={`metric-icon tone-${color}`}><DashboardIcon name={icon} /></span>
    <p>{title}</p>
    <div className="metric-footer"><strong>{value}</strong><a href={href}>Xem <span aria-hidden="true">→</span></a></div>
  </article>
}

export function StoreStatusPanel({ stores }: { stores: DashboardStore[] }) {
  return <section className="dashboard-panel stores-panel" id="stores">
    <div className="panel-heading"><h2>Cửa hàng</h2><span className="panel-count">{stores.length}</span></div>
    {stores.length ? <ul className="store-status-list">{stores.map((store) => <li key={store.id}>
      <span className="store-status-icon"><DashboardIcon name="store" /></span>
      <span className="store-status-name">{store.storeName}</span>
      <span className={`status-badge store-${store.status.toLowerCase()}`}>{formatStoreStatus(store.status)}</span>
    </li>)}</ul> : <p className="empty-state">Chưa có cửa hàng.</p>}
  </section>
}