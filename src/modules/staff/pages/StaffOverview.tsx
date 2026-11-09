import DashboardWork from '../../operations/DashboardWork'
/**
 * File: modules/staff/pages/StaffOverview.tsx
 * Loại: MÀN HÌNH — Tổng quan nhân viên.
 * Đường dẫn: /dashboard.
 * Công dụng: Tổng quan công việc/phạm vi của Staff.
 */
import { useEffect, useState } from 'react'
import { loadStaffHome, type StaffHome } from '../services/staffHomeService'
import './staff-overview.css'
const taskLabels: Record<string, string> = {
  PICKING_TASKS: 'Lấy hàng đơn bán',
  INSPECTION_TASKS: 'Kiểm nhận hàng',
  DISPATCH_PREPARATION_TASKS: 'Chuẩn bị điều chuyển',
  COUNTING_TASKS: 'Đếm kiểm kê',
}
/** StaffOverview: Tổng quan công việc/phạm vi của Staff. */
export default function StaffOverview() {
  const [data, setData] = useState<StaffHome | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    loadStaffHome()
      .then((value) => {
        if (active) setData(value)
      })
      .catch(() => {
        if (active) setError('Không tải được công việc. Vui lòng thử lại.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [revision])
  const tasks = data?.shortcuts.filter((item) => item.key in taskLabels) || []
  const total = tasks.reduce((sum, item) => sum + item.count, 0)
  return (
    <main className="dashboard-content staff-overview">
      <header>
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
      <section className="staff-task-panel" aria-busy={loading}>
        <h2>
          Việc của tôi
          {data && !error ? ` (${total.toLocaleString('vi-VN')})` : ''}
        </h2>
        {error ? (
          <p className="staff-task-message" role="alert">
            {error}{' '}
            <button onClick={() => setRevision((x) => x + 1)}>Thử lại</button>
          </p>
        ) : (
          <>
            <DashboardWork role="STAFF" />
            {!loading && tasks.length > 0 && (
              <div
                className="staff-task-summary"
                aria-label="Số việc chưa bắt đầu theo loại"
              >
                {tasks.map((item) => (
                  <span key={item.key}>
                    {taskLabels[item.key]}:{' '}
                    <strong>{item.count.toLocaleString('vi-VN')}</strong>
                  </span>
                ))}
              </div>
            )}
            <footer>
              Số lượng trên là việc đã giao và chưa bắt đầu. Mở từng chứng từ để
              xem kết quả, phân công và thao tác được phép.
            </footer>
          </>
        )}
      </section>
    </main>
  )
}
