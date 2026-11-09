import DashboardWork from '../../operations/DashboardWork'
/**
 * File: modules/branch-manager/pages/BranchManagerOverview.tsx
 * Loại: MÀN HÌNH — Tổng quan quản lý chi nhánh.
 * Đường dẫn: /dashboard.
 * Công dụng: Tổng quan việc chờ và phạm vi cửa hàng của BM.
 */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Icon, { type IconName } from '../../../shared/ui/Icon'
import { loadBranchHome, type BranchHome } from '../services/branchHomeService'
import './branch-overview.css'
const cards: {
  label: string
  icon: IconName
  keys: string[]
  color: string
}[] = [
  {
    label: 'Đơn bán cần xử lý',
    icon: 'receipt',
    keys: [
      'ORDERS_TO_ASSIGN',
      'ORDERS_AWAITING_CONFIRMATION',
      'ORDERS_AWAITING_COMPLETION',
    ],
    color: 'blue',
  },
  {
    label: 'Hàng nhập cần xử lý',
    icon: 'clipboard',
    keys: ['RECEIPTS_TO_ASSIGN', 'RECEIPTS_AWAITING_CONFIRMATION'],
    color: 'orange',
  },
  {
    label: 'Điều chuyển cần xử lý',
    icon: 'truck',
    keys: ['TRANSFERS_AWAITING_DISPATCH'],
    color: 'cyan',
  },
  {
    label: 'Bổ sung hàng cần xử lý',
    icon: 'transfer',
    keys: ['REPLENISHMENTS_AWAITING_COORDINATION'],
    color: 'blue',
  },
  {
    label: 'Thanh toán chờ xác minh',
    icon: 'checklist',
    keys: ['PAYMENTS_AWAITING_VERIFICATION'],
    color: 'orange',
  },
  {
    label: 'Sai lệch đang mở',
    icon: 'sliders',
    keys: ['OPEN_DISCREPANCIES'],
    color: 'orange',
  },
]
/** BranchManagerOverview: Tổng quan việc chờ và phạm vi cửa hàng của BM. */
export default function BranchManagerOverview() {
  const [data, setData] = useState<BranchHome | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    loadBranchHome()
      .then((value) => {
        if (active) setData(value)
      })
      .catch(() => {
        if (active) setError('Không tải được tổng quan. Vui lòng thử lại.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [revision])
  function count(keys: string[]) {
    if (
      loading ||
      error ||
      !data ||
      !keys.some((key) => data.shortcuts.some((item) => item.key === key))
    )
      return '—'
    return data.shortcuts
      .filter((item) => keys.includes(item.key))
      .reduce((sum, item) => sum + item.count, 0)
      .toLocaleString('vi-VN')
  }
  return (
    <main className="dashboard-content bm-overview">
      <header className="bm-overview-heading">
        <h1>Tổng quan</h1>
        <time>
          {new Intl.DateTimeFormat('vi-VN', {
            weekday: 'long',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            timeZone: 'Asia/Ho_Chi_Minh',
          }).format(new Date())}
        </time>
      </header>
      {error && (
        <div className="bm-error" role="alert">
          {error}{' '}
          <button onClick={() => setRevision((x) => x + 1)}>Thử lại</button>
        </div>
      )}
      <section
        className="bm-summary"
        aria-label="Việc cần xử lý"
        aria-busy={loading}
      >
        {cards
          .filter(
            (card) =>
              !data ||
              !card.keys.includes('REPLENISHMENTS_AWAITING_COORDINATION') ||
              data.shortcuts.some(
                (item) => item.key === 'REPLENISHMENTS_AWAITING_COORDINATION',
              ),
          )
          .map((card) => (
            <article className="bm-summary-card" key={card.label}>
              <span className={'bm-card-icon ' + card.color}>
                <Icon name={card.icon} />
              </span>
              {card.keys.includes('OPEN_DISCREPANCIES') ? (
                <Link to="/supplier-discrepancies">{card.label}</Link>
              ) : (
                <span>{card.label}</span>
              )}
              <strong>{count(card.keys)}</strong>
              {!card.keys.length && (
                <span
                  className="bm-info"
                  title="Chưa có dữ liệu từ hệ thống"
                  aria-label="Chưa có dữ liệu từ hệ thống"
                >
                  ⓘ
                </span>
              )}
            </article>
          ))}
      </section>
      <DashboardWork role="BRANCH_MANAGER" />
    </main>
  )
}
