/**
 * File: shared/ui/PageHeader.tsx
 * Loại: THÀNH PHẦN GIAO DIỆN DÙNG CHUNG — không phải màn hình.
 * Công dụng: Tiêu đề trang thống nhất cho mọi module: h1 22px, breadcrumb một kiểu dấu "›", nút chính đặt bên phải.
 */
import { Fragment, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

export type Crumb = { label: ReactNode; to?: string }

export function Breadcrumb({ items }: { items: Crumb[] }) {
  const all: Crumb[] = [{ label: 'Trang chủ', to: '/dashboard' }, ...items]
  return (
    <nav className="mf-breadcrumb" aria-label="Đường dẫn">
      {all.map((item, index) => (
        <Fragment key={index}>
          {index > 0 && (
            <span className="mf-breadcrumb-sep" aria-hidden="true">
              ›
            </span>
          )}
          {item.to && index < all.length - 1 ? (
            <Link to={item.to}>{item.label}</Link>
          ) : (
            <span aria-current={index === all.length - 1 ? 'page' : undefined}>
              {item.label}
            </span>
          )}
        </Fragment>
      ))}
    </nav>
  )
}

/** PageHeader: tiêu đề trang, dòng phụ (không bắt buộc), breadcrumb và nút chính của trang. */
export default function PageHeader({
  title,
  subtitle,
  breadcrumb,
  actions,
}: {
  title: ReactNode
  subtitle?: ReactNode
  breadcrumb?: Crumb[]
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
        {breadcrumb && <Breadcrumb items={breadcrumb} />}
      </div>
    </header>
  )
}
