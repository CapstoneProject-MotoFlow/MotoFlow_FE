import { Link } from 'react-router-dom'
import './owner-permissions.css'
export default function OwnerPermissionsPage() {
  return (
    <main className="dashboard-content owner-permissions-page">
      <header className="owner-permissions-heading">
        <h1>Quyền danh mục và giá</h1>
        <nav aria-label="Đường dẫn">
          <Link to="/dashboard">Trang chủ</Link>
          <span>›</span>
          <span>Giá bán</span>
          <span>›</span>
          <span>Quyền danh mục và giá</span>
        </nav>
      </header>
      <div className="owner-permissions-notice" role="status">
        <strong>Chưa thể tải và thay đổi quyền.</strong>
        <p>
          Hệ thống chưa hỗ trợ Owner xem danh sách Branch Manager và cấp/thu hồi
          quyền danh mục, giá bán lẻ. Thao tác sẽ được mở khi có API phù hợp.
        </p>
      </div>
      <section
        className="owner-permissions-panel"
        aria-labelledby="branch-manager-title"
      >
        <h2 id="branch-manager-title">Branch Manager</h2>
        <div className="owner-permissions-table">
          <table>
            <thead>
              <tr>
                <th>Tài khoản</th>
                <th>Cửa hàng</th>
                <th>Sửa danh mục</th>
                <th>Sửa giá bán lẻ</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={4} className="owner-permissions-empty">
                  Chưa tải được danh sách Branch Manager và quyền hiện tại.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <footer>
          <span className="owner-permissions-switch" aria-hidden="true" />
          <span>
            Công tắc cấp/thu hồi sẽ hiển thị theo quyền hiện tại của từng Branch
            Manager.
          </span>
        </footer>
      </section>
      <section
        className="owner-permissions-panel owner-permissions-history"
        aria-labelledby="permission-history-title"
      >
        <h2 id="permission-history-title">Thay đổi gần đây</h2>
        <div className="owner-permissions-history-empty">
          <span aria-hidden="true">◷</span>
          <p>Chưa có dữ liệu lịch sử thay đổi quyền.</p>
          <small>
            Thời điểm, người thực hiện và lý do sẽ hiển thị khi hệ thống hỗ trợ
            tra cứu.
          </small>
        </div>
      </section>
    </main>
  )
}
