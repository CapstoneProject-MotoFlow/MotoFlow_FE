import { useEffect, useState } from 'react'
import { loadDashboard } from '../../dashboard/services/dashboardService'
import type { DashboardProduct } from '../../dashboard/types/dashboardTypes'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import '../owner.css'

export default function OwnerWorkspacePage() {
  const location = useLocation()
  const [params] = useSearchParams()
  const [products, setProducts] = useState<DashboardProduct[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    if (location.pathname !== '/owner/products') return
    let active = true
    loadDashboard('OWNER').then(data => { if (active) setProducts(data.products) }).catch(() => { if (active) setError('Không tải được phụ tùng. Vui lòng thử lại.') }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [location.pathname])
  if (location.pathname === '/owner/products') {
    const visible = products.filter(item => !params.get('sku') || item.sku === params.get('sku'))
    return <main className="dashboard-content owner-content"><h1 className="dashboard-greeting">Phụ tùng</h1>{params.get('sku') && <p><Link to="/owner/products">Xem danh sách gần đây</Link></p>}<section className="owner-panel"><div className="owner-table-scroll"><table><thead><tr><th>Phụ tùng</th><th>SKU</th><th>Tồn khả dụng</th></tr></thead><tbody>{visible.map(item => <tr key={item.id}><td>{item.partName}<small>{item.brand}</small></td><td>{item.sku}</td><td>{item.availableQty ?? '—'}</td></tr>)}</tbody></table></div>{loading && <p className="empty-state">Đang tải phụ tùng…</p>}{error && <p className="empty-state" role="alert">{error}</p>}{!loading && !error && !visible.length && <p className="empty-state">Chưa có phụ tùng phù hợp.</p>}</section></main>
  }
  return null
}
