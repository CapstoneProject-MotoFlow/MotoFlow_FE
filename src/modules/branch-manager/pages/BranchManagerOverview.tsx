import BranchWorkBoard from './BranchWorkBoard'
import { useBranchWork } from './useBranchWork'
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
  href?: string
}[] = [
  {
    label: 'Đơn bán cần xử lý',
    href: '/sales-orders',
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
    href: '/purchase-orders',
    icon: 'clipboard',
    keys: ['RECEIPTS_TO_ASSIGN', 'RECEIPTS_AWAITING_CONFIRMATION'],
    color: 'orange',
  },
  {
    label: 'Điều chuyển cần xử lý',
    href: '/transfer-orders',
    icon: 'truck',
    keys: ['TRANSFERS_AWAITING_DISPATCH'],
    color: 'cyan',
  },
  {
    label: 'Bổ sung hàng cần xử lý',
    href: '/replenishment-requests',
    icon: 'transfer',
    keys: ['REPLENISHMENTS_AWAITING_COORDINATION'],
    color: 'blue',
  },
  {
    label: 'Kiểm kê cần xử lý',
    href: '/stock-counts',
    icon: 'checklist',
    keys: ['BM_COUNTS_OPEN'],
    color: 'orange',
  },
  {
    label: 'Điều chỉnh chưa gửi',
    icon: 'sliders',
    keys: [],
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
  const work = useBranchWork(
    !!data?.shortcuts.some(
      (s) => s.key === 'REPLENISHMENTS_AWAITING_COORDINATION',
    ),
  )
  function count(keys: string[]) {
    if (keys.includes('BM_COUNTS_OPEN'))
      return work.countError
        ? '—'
        : (work.countTotal?.toLocaleString('vi-VN') ?? '—')
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
        {cards.map((card) => {
          const content = (
            <>
              <span className={'bm-card-icon ' + card.color}>
                <Icon name={card.icon} />
              </span>
              <span className="bm-summary-label">{card.label}</span>
              <strong>{count(card.keys)}</strong>
              <span className="bm-card-arrow" aria-hidden="true">
                ›
              </span>
            </>
          )
          return card.href ? (
            <Link className="bm-summary-card" key={card.label} to={card.href}>
              {content}
            </Link>
          ) : (
            <article
              className="bm-summary-card is-unavailable"
              key={card.label}
              title="Chức năng điều chỉnh kho chưa có API"
            >
              {content}
            </article>
          )
        })}
      </section>
      <BranchWorkBoard
        data={work}
        storeName={data?.storeName ?? 'Kho của bạn'}
      />
    </main>
  )
}
