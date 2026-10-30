import { Link } from 'react-router-dom'
import { useNotifications, noticeTime } from './notificationService'
import Icon from '../../shared/ui/Icon'
import './notifications.css'
export default function NotificationsPage() {
  const { data, error, reload } = useNotifications()
  return (
    <main className="dashboard-content notifications-page">
      <header className="notifications-heading">
        <h1>Thông báo</h1>
        <nav>
          <Link to="/dashboard">Trang chủ</Link> › Thông báo
        </nav>
      </header>
      <section className="notifications-panel">
        <header>
          <h2>Thông báo của bạn</h2>
          <button disabled title="BE chưa hỗ trợ đánh dấu đã đọc">
            ✓ Đánh dấu tất cả đã đọc
          </button>
        </header>
        <div className="notifications-toolbar">
          <div className="notifications-tabs">
            <button disabled title="Chưa có phân loại từ API">
              Việc cần tôi làm
            </button>
            <button disabled title="Chưa có phân loại từ API">
              Cảnh báo tồn, hạn dùng
            </button>
            <button disabled title="Chưa có phân loại từ API">
              Tin để biết
            </button>
            <button aria-pressed="true">Tất cả dữ liệu hiện có</button>
          </div>
          <label>
            <input type="checkbox" checked disabled />
            Chỉ thông báo chưa đọc
          </label>
        </div>
        {error ? (
          <p className="notifications-empty" role="alert">
            {error}
            <button onClick={reload}>Thử lại</button>
          </p>
        ) : !data ? (
          <p className="notifications-empty" role="status">
            Đang tải thông báo…
          </p>
        ) : data.latest.length ? (
          <ul className="notifications-list">
            {data.latest.map((item) => (
              <li key={item.id}>
                <span className="notifications-symbol">
                  <Icon name="bell" />
                </span>
                <div>
                  <p>{item.message}</p>
                  <small>
                    {noticeTime(item.createdAt)} · <strong>Chưa đọc</strong>
                  </small>
                </div>
                <span className="notifications-dot" aria-label="Chưa đọc" />
              </li>
            ))}
          </ul>
        ) : (
          <p className="notifications-empty">Không có thông báo chưa đọc.</p>
        )}
        <footer>
          {data ? `${data.unread} thông báo chưa đọc. ` : ''}Hiện hiển thị tối
          đa 5 thông báo mới nhất. Lịch sử, phân loại và đánh dấu đã đọc chưa
          được hệ thống hỗ trợ.
        </footer>
      </section>
    </main>
  )
}
