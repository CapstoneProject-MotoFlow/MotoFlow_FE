import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getHome } from '../../../shared/api/homeService'
import { InventoryNotice } from '../../inventory/components'
import OwnerMonitoring from '../../operations/OwnerMonitoring'
import Icon, { type IconName } from '../../../shared/ui/Icon'
import '../owner.css'
const metrics: { key: string; title: string; icon: IconName; href?: string }[] =
  [
    {
      key: 'ADJUSTMENTS_AWAITING_APPROVAL',
      title: 'Điều chỉnh chờ duyệt',
      icon: 'box',
    },
    {
      key: 'EXCESS_AWAITING_DECISION',
      title: 'Hàng thừa chờ quyết định',
      icon: 'clipboard',
      href: '/goods-receipt-notes/excess',
    },
    {
      key: 'STOCK_COUNTS_AWAITING_APPROVAL',
      title: 'Kiểm kê chờ duyệt',
      icon: 'alert',
      href: '/stock-counts?status=AWAITING_APPROVAL',
    },
    {
      key: 'REPLENISHMENTS_AWAITING_COORDINATION',
      title: 'Bổ sung chờ điều phối',
      icon: 'inventory',
      href: '/replenishment-requests?status=AWAITING_COORDINATION',
    },
  ]
export default function OwnerOverview() {
  const [counts, setCounts] = useState<Record<string, number>>({}),
    [error, setError] = useState('')
  useEffect(() => {
    let active = true
    getHome()
      .then((r) => {
        if (active)
          setCounts(
            Object.fromEntries(r.data.shortcuts.map((s) => [s.key, s.count])),
          )
      })
      .catch(() => {
        if (active) setError('Không tải được tổng quan.')
      })
    return () => {
      active = false
    }
  }, [])
  return (
    <div className="owner-overview">
      <InventoryNotice error={error} />
      <section className="owner-metrics" aria-label="Tổng quan hoạt động">
        {metrics
          .filter((m) => counts[m.key] !== 0)
          .map((m) => (
            <article className="owner-metric" key={m.key}>
              <span className="owner-metric-icon owner-icon-amber">
                <Icon name={m.icon} />
              </span>
              <p>{m.title}</p>
              <div>
                <strong>{counts[m.key] ?? '—'}</strong>
                {m.href ? (
                  <Link to={m.href}>Xem →</Link>
                ) : (
                  <small>Chờ chức năng điều chỉnh</small>
                )}
              </div>
            </article>
          ))}
      </section>
      <OwnerMonitoring />
    </div>
  )
}
