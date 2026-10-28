import { useEffect, useState } from 'react'
import { useAuth } from '../../../shared/hooks/useAuth'
import { loadDashboard } from '../services/dashboardService'
import type { DashboardData } from '../types/dashboardTypes'
import AdminDashboardOverview from '../components/AdminDashboardOverview'
import BusinessOverview from '../components/BusinessOverview'

const roleNames: Record<string, string> = { ADMIN: 'Admin', OWNER: 'Chủ cửa hàng', BRANCH_MANAGER: 'Quản lý cửa hàng', STAFF: 'Nhân viên' }

export default function DashboardPage() {
  const { user } = useAuth()
  const role = user?.role || 'STAFF'
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => {
    let mounted = true
    setLoading(true)
    loadDashboard(role).then((result) => { if (mounted) setData(result) })
      .catch(() => { if (mounted) setError('Không tải được dữ liệu. Hãy kiểm tra kết nối backend và quyền truy cập của tài khoản.') })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [role])
  const greetingName = (user?.fullName || user?.username || '').trim().split(/\s+/).at(-1)
  return <main className="dashboard-content" id="overview"><h1 className="dashboard-greeting">Chào {greetingName}</h1><p className="dashboard-role-caption">Tổng quan · {roleNames[role] || role}</p>
    {loading && <div className="dashboard-banner">Đang tải dữ liệu…</div>}{error && <div className="dashboard-banner error-banner" role="alert">{error}</div>}
    {!loading && !error && data && (role === 'ADMIN' ? <AdminDashboardOverview data={data} /> : <BusinessOverview data={data} user={user!} role={role} />)}
  </main>
}
