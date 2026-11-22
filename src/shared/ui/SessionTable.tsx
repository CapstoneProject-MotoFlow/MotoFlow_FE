/**
 * File: shared/ui/SessionTable.tsx
 * Loại: THÀNH PHẦN / XỬ LÝ HỖ TRỢ — không phải màn hình độc lập.
 * Công dụng: Bảng thiết bị đang đăng nhập (thiết bị, IP, lúc đăng nhập, hoạt động gần nhất) với nút đăng xuất từng
 * thiết bị; dùng ở trang cá nhân và popup phiên đăng nhập của Admin.
 */
import type { Session } from '../types/session'
import { formatDateTime, formatIpAddress } from '../utils/format'
import './session-table.css'

/**
 * SessionTable: Thiết bị đang dùng (current) có nhãn "Thiết bị này" và không có nút đăng xuất; muốn đăng xuất
 * thiết bị đang dùng thì dùng nút Đăng xuất ở menu tài khoản. {@code disabled} khóa mọi nút khi đang xử lý.
 */
export default function SessionTable({
  sessions,
  disabled = false,
  onSignOut,
}: {
  sessions: Session[]
  disabled?: boolean
  onSignOut: (session: Session) => void
}) {
  return (
    <div className="session-table-scroll">
      <table className="session-table">
        <thead>
          <tr>
            <th>Thiết bị</th>
            <th>Địa chỉ IP</th>
            <th>Đăng nhập lúc</th>
            <th>Hoạt động gần nhất</th>
            <th>
              <span className="sr-only">Thao tác</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((session) => (
            <tr key={session.id}>
              <td>
                {session.device || 'Không rõ thiết bị'}
                {session.current && (
                  <span className="mf-badge mf-badge--info">Thiết bị này</span>
                )}
              </td>
              <td>{formatIpAddress(session.ipAddress)}</td>
              <td>{formatDateTime(session.signedInAt)}</td>
              <td>
                {formatDateTime(session.lastRefreshedAt ?? session.signedInAt)}
              </td>
              <td className="session-table-action">
                {!session.current && (
                  <button
                    type="button"
                    className="mf-btn mf-btn--secondary mf-btn--sm"
                    disabled={disabled}
                    onClick={() => onSignOut(session)}
                  >
                    Đăng xuất
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
