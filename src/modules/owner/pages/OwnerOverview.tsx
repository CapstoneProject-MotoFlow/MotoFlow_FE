/**
 * File: modules/owner/pages/OwnerOverview.tsx
 * Loại: THÀNH PHẦN MÀN HÌNH — Tổng quan của Owner (route /dashboard).
 * Công dụng: Tiêu đề + nút tạo nhanh (Owner tạo yêu cầu nhập hàng, đơn bán), dải việc chờ duyệt gọn một hàng
 * (thay cho 2 thẻ to), rồi số liệu bán hàng, công nợ, kho và so sánh cửa hàng.
 */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getHome } from '../../../shared/api/homeService'
import { InventoryNotice } from '../../inventory/components'
import OwnerMonitoring from '../../operations/OwnerMonitoring'
import Icon, { type IconName } from '../../../shared/ui/Icon'
import PageHeader from '../../../shared/ui/PageHeader'
import '../owner.css'
const metrics: { key: string; title: string; icon: IconName; href?: string }[] =
  [
    {
      key: 'ADJUSTMENTS_AWAITING_APPROVAL',
      title: 'Điều chỉnh chờ duyệt',
      icon: 'sliders',
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
      icon: 'checklist',
      href: '/stock-counts?status=AWAITING_APPROVAL',
    },
    {
      key: 'REPLENISHMENTS_AWAITING_COORDINATION',
      title: 'Bổ sung chờ điều phối',
      icon: 'transfer',
      href: '/replenishment-requests?status=AWAITING_COORDINATION',
    },
  ]
const todayLabel = () =>
  new Intl.DateTimeFormat('vi-VN', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date())

export default function OwnerOverview() {
  const [counts, setCounts] = useState<Record<string, number>>({}),
    [loaded, setLoaded] = useState(false),
    [error, setError] = useState('')
  useEffect(() => {
    let active = true
    getHome()
      .then((r) => {
        if (active) {
          setCounts(
            Object.fromEntries(r.data.shortcuts.map((s) => [s.key, s.count])),
          )
          setLoaded(true)
        }
      })
      .catch(() => {
        if (active) setError('Không tải được việc chờ duyệt.')
      })
    return () => {
      active = false
    }
  }, [])
  const waiting = metrics.filter((m) => (counts[m.key] ?? 0) > 0)
  return (
    <div className="owner-overview">
      <PageHeader
        title="Tổng quan"
        subtitle={todayLabel().replace(/^./, (c) => c.toLocaleUpperCase('vi'))}
        actions={
          <>
            <Link className="mf-btn mf-btn--primary" to="/purchase-orders/new">
              <Icon name="plus" />
              Tạo yêu cầu nhập hàng
            </Link>
            <Link className="mf-btn mf-btn--secondary" to="/sales-orders/new">
              <Icon name="plus" />
              Tạo đơn bán
            </Link>
          </>
        }
      />
      <InventoryNotice error={error} />
      {/* Góp ý cô Hoài: 2 thẻ to đầu trang chiếm quá nhiều chỗ, thu thành một dải gọn. */}
      <section className="owner-waiting" aria-label="Việc chờ bạn duyệt">
        <span className="owner-waiting-title">Chờ bạn duyệt</span>
        {waiting.map((m) =>
          m.href ? (
            <Link className="owner-waiting-chip" key={m.key} to={m.href}>
              <Icon name={m.icon} />
              {m.title}
              <strong>{counts[m.key]}</strong>
            </Link>
          ) : (
            <span
              className="owner-waiting-chip is-static"
              key={m.key}
              title="Màn duyệt điều chỉnh đang được hoàn thiện."
            >
              <Icon name={m.icon} />
              {m.title}
              <strong>{counts[m.key]}</strong>
            </span>
          ),
        )}
        {loaded && !waiting.length && (
          <span className="owner-waiting-empty">
            <Icon name="check" />
            Không có việc nào chờ duyệt.
          </span>
        )}
      </section>
      <OwnerMonitoring />
    </div>
  )
}
