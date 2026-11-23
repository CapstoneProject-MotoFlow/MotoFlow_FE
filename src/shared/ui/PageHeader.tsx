/**
 * File: shared/ui/PageHeader.tsx
 * Loại: THÀNH PHẦN GIAO DIỆN DÙNG CHUNG — không phải màn hình.
 * Công dụng: Tiêu đề trang thống nhất cho mọi module: h1 22px, nút chính đặt bên phải. PM 22/11: bỏ breadcrumb ở mọi trang.
 */
import type { ReactNode } from 'react'

/** PageHeader: tiêu đề trang, dòng phụ (không bắt buộc) và nút chính của trang. */
export default function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
}) {
  return (
    <header className="mf-page-header">
      <div className="mf-page-header-title">
        <h1>{title}</h1>
        {subtitle && <p className="mf-page-header-sub">{subtitle}</p>}
      </div>
      <div className="mf-page-header-side">
        {actions && <div className="mf-page-header-actions">{actions}</div>}
      </div>
    </header>
  )
}
