import { useEffect, useState } from 'react'
import Icon, { type IconName } from '../../../shared/ui/Icon'
import { useAuth } from '../../../shared/hooks/useAuth'
import { loadBranchHome, type BranchHome } from '../services/branchHomeService'
import './branch-overview.css'
const cards: { label: string; icon: IconName; keys: string[]; color: string }[] = [
  { label: 'Đơn bán cần xử lý', icon: 'receipt', keys: ['ORDERS_TO_ASSIGN', 'ORDERS_AWAITING_CONFIRMATION', 'ORDERS_AWAITING_COMPLETION'], color: 'blue' },
  { label: 'Hàng nhập cần xử lý', icon: 'clipboard', keys: ['RECEIPTS_TO_ASSIGN', 'RECEIPTS_AWAITING_CONFIRMATION'], color: 'orange' },
  { label: 'Điều chuyển cần xử lý', icon: 'truck', keys: ['TRANSFERS_AWAITING_DISPATCH'], color: 'cyan' },
  { label: 'Bổ sung hàng cần xử lý', icon: 'transfer', keys: ['REPLENISHMENTS_AWAITING_COORDINATION'], color: 'blue' },
  { label: 'Kiểm kê cần xử lý', icon: 'checklist', keys: [], color: 'orange' },
  { label: 'Điều chỉnh chưa gửi', icon: 'sliders', keys: [], color: 'orange' },
]
export default function BranchManagerOverview() {
  const { user } = useAuth()
  const [data, setData] = useState<BranchHome | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  useEffect(() => { let active = true; setLoading(true); setError(''); loadBranchHome().then(value => { if(active) setData(value) }).catch(() => { if(active) setError('Không tải được tổng quan. Vui lòng thử lại.') }).finally(() => { if(active) setLoading(false) }); return () => { active = false } }, [revision])
  function count(keys: string[]) { if (loading || error || !data || !keys.some(key => data.shortcuts.some(item => item.key === key))) return '—'; return data.shortcuts.filter(item => keys.includes(item.key)).reduce((sum,item) => sum + item.count,0).toLocaleString('vi-VN') }
  return <main className="dashboard-content bm-overview"><header className="bm-overview-heading"><h1>Tổng quan</h1><time>{new Intl.DateTimeFormat('vi-VN',{ weekday:'long',day:'2-digit',month:'2-digit',year:'numeric',timeZone:'Asia/Ho_Chi_Minh' }).format(new Date())}</time></header>{error && <div className="bm-error" role="alert">{error} <button onClick={() => setRevision(x => x+1)}>Thử lại</button></div>}<section className="bm-summary" aria-label="Việc cần xử lý" aria-busy={loading}>{cards.map(card => <article className="bm-summary-card" key={card.label}><span className={'bm-card-icon ' + card.color}><Icon name={card.icon} /></span><span>{card.label}</span><strong>{count(card.keys)}</strong>{!card.keys.length && <span className="bm-info" title="Chưa có dữ liệu từ hệ thống" aria-label="Chưa có dữ liệu từ hệ thống">ⓘ</span>}</article>)}</section><div className="bm-overview-columns"><section className="bm-panel"><h2>Việc chờ lâu nhất</h2><div className="bm-work-table"><table><thead><tr><th>Chứng từ</th><th>Việc</th><th>Đã chờ</th><th>Thao tác</th></tr></thead><tbody><tr><td colSpan={4} className="bm-unavailable">{loading ? 'Đang tải tổng quan…' : 'Chưa có dữ liệu chi tiết về các công việc chờ xử lý.'}</td></tr></tbody></table></div><footer>Số lượng việc cần xử lý được cập nhật từ hệ thống theo phạm vi cửa hàng.</footer></section><aside className="bm-panel bm-monitor"><h2>Theo dõi</h2><section><p>Doanh số hôm nay</p><strong>—</strong><small>Chưa có dữ liệu doanh số.</small></section><section><p>Tồn dưới ngưỡng · {data?.storeName || user?.storeName || 'Cửa hàng được phân công'}</p><strong>—</strong><small>Chưa có dữ liệu cảnh báo tồn kho.</small></section><section><p>Lô sắp hết hạn</p><strong>—</strong><small>Chưa có dữ liệu hạn sử dụng của lô hàng.</small></section></aside></div></main>
}
