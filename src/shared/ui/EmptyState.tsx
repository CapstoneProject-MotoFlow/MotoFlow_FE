/**
 * File: shared/ui/EmptyState.tsx
 * Loại: THÀNH PHẦN GIAO DIỆN DÙNG CHUNG — không phải màn hình.
 * Công dụng: Trạng thái rỗng một kiểu cho mọi bảng: biểu tượng, câu thông báo và nút hành động (nếu có).
 */
import type { ReactNode } from 'react'
import Icon, { type IconName } from './Icon'

export default function EmptyState({
  icon = 'clipboard',
  message,
  action,
}: {
  icon?: IconName
  message: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="mf-empty" role="status">
      <span className="mf-empty-icon">
        <Icon name={icon} />
      </span>
      <p>{message}</p>
      {action}
    </div>
  )
}
