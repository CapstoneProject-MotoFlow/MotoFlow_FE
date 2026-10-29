import '../dashboard.css'
import { useNavigate } from 'react-router-dom'
import OwnerOverview from '../../owner/pages/OwnerOverview'
import HeaderSearch from '../../../shared/ui/HeaderSearch'
import { useEffect, useState } from 'react'
import { useAuth } from '../../../shared/hooks/useAuth'
import { loadDashboard } from '../services/dashboardService'
import type { DashboardData } from '../types/dashboardTypes'
import AdminDashboardOverview from '../components/AdminDashboardOverview'
import BusinessOverview from '../components/BusinessOverview'
import { roleNames } from '../../../shared/utils/roles'

export default function DashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const role = user?.role || 'STAFF'
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedAccount, setSelectedAccount] = useState<number | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let mounted = true
    setLoading(true)
    loadDashboard(role).then((result) => { if (mounted) setData(result) })
      .catch(() => { if (mounted) setError('Không tải được dữ liệu. Hãy kiểm tra kết nối backend và quyền truy cập của tài khoản.') })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [role])
  const searchItems = role === 'ADMIN'
    ? (data?.accounts || []).map(item => ({
      id: item.id,
      label: item.fullName,
      meta: item.username,
      select: () => {
        setSelectedAccount(item.id)
        window.requestAnimationFrame(() => document.getElementById(`account-${item.id}`)?.scrollIntoView({ block: 'center' }))
      },
    }))
    : (data?.products || []).map(item => ({
      id: item.id,
      label: item.partName,
      meta: item.sku,
      select: () => {
        if (role === 'OWNER') {
          navigate('/owner/products?sku=' + encodeURIComponent(item.sku))
          return
        }
        const row = document.getElementById(`product-${item.id}`)
        row?.scrollIntoView({ block: 'center' })
        row?.focus()
      },
    }))
  const greetingName = (user?.fullName || user?.username || '').trim().split(/\s+/).at(-1)
  return <><HeaderSearch loading={loading} placeholder={role === 'ADMIN' ? 'Tìm tài khoản theo tên đăng nhập, họ tên...' : 'Tìm phụ tùng theo SKU, tên...'} items={searchItems} onClear={() => setSelectedAccount(null)} /><main className={role === 'OWNER' ? 'dashboard-content owner-content' : 'dashboard-content'} id="overview"><h1 className="dashboard-greeting">Chào {greetingName}</h1><p className="dashboard-role-caption">Tổng quan · {roleNames[role] || role}</p>
    {loading && <div className="dashboard-banner">Đang tải dữ liệu…</div>}{error && <div className="dashboard-banner error-banner" role="alert">{error}</div>}
    {role === 'OWNER' ? <OwnerOverview /> : !loading && !error && data && (role === 'ADMIN' ? <AdminDashboardOverview data={data} selectedAccount={selectedAccount} onClear={() => setSelectedAccount(null)} /> : <BusinessOverview data={data} user={user!} role={role} />)}
  </main></>
}
