/**
 * File: modules/dashboard/components/DashboardWidgets.tsx
 * Loại: THÀNH PHẦN / XỬ LÝ HỖ TRỢ — không phải màn hình độc lập.
 * Công dụng: Khối UI nhỏ dùng lại: MetricCard (thẻ chỉ số), StoreStatusPanel (trạng thái cửa hàng), DashboardIcon (dùng lại Icon).
 */
import { Link } from 'react-router-dom'
/** Small reusable presentation pieces shared by role dashboards. */
import type { DashboardStore } from '../types/dashboardTypes'
import Icon, { type IconName } from '../../../shared/ui/Icon'
import { formatStoreStatus } from '../../../shared/utils/format'

export type { IconName }

export const DashboardIcon = Icon

/** MetricCard: Hiển thị thẻ chỉ số với tiêu đề, giá trị, biểu tượng và liên kết. */
export function MetricCard({
  title,
  value,
  icon,
  color,
  href,
}: {
  title: string
  value: number
  icon: IconName
  color: string
  href: string
}) {
  return (
    <article className="metric-card">
      <span className={`metric-icon tone-${color}`}>
        <DashboardIcon name={icon} />
      </span>
      <p>{title}</p>
      <div className="metric-footer">
        <strong>{value}</strong>
        <a href={href}>
          Xem <span aria-hidden="true">→</span>
        </a>
      </div>
    </article>
  )
}

/** StoreStatusPanel: Hiển thị tình trạng các cửa hàng trong khối tổng quan. */
export function StoreStatusPanel({
  stores,
  management = false,
}: {
  stores: DashboardStore[]
  management?: boolean
}) {
  return (
    <section className="dashboard-panel" id="stores">
      <div className="panel-heading">
        <h2>Cửa hàng</h2>
        <>
          {management ? (
            <Link className="panel-action" to="/stores">
              Quản lý
            </Link>
          ) : (
            <span className="panel-count">{stores.length}</span>
          )}
        </>
      </div>
      {stores.length ? (
        <ul className="store-status-list">
          {stores.map((store) => (
            <li key={store.id}>
              <span className="store-status-icon">
                <DashboardIcon name="store" />
              </span>
              <span className="store-status-name">{store.storeName}</span>
              <span
                className={`status-badge store-${store.status.toLowerCase()}`}
              >
                {formatStoreStatus(store.status)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty-state">Chưa có cửa hàng.</p>
      )}
    </section>
  )
}
