import StaffWorkTable from './StaffWorkTable'
import './staff-overview.css'
export default function StaffOverview() {
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
      <StaffWorkTable />
    </main>
  )
}
