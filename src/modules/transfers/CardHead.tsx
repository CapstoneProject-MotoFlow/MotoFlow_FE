/**
 * File: modules/transfers/CardHead.tsx
 * Loại: THÀNH PHẦN GIAO DIỆN của nhóm Điều chuyển — không phải màn hình.
 * Công dụng: Dòng tiêu đề thẻ: tên và trạng thái bên trái, mọi nút thao tác của màn bên phải (Trường 12/11: nút đặt trên đầu, dễ thấy).
 * Nút dùng class mf-btn mf-btn--primary (nút chính, mỗi màn một nút) hoặc mf-btn mf-btn--secondary; chữ phụ dùng class tf-head-meta.
 */
import { Children, type ReactNode } from 'react'
import Icon, { type IconName } from '../../shared/ui/Icon'
import { Link } from 'react-router-dom'

export default function CardHead({
  title,
  status,
  statusClass,
  children,
}: {
  title: ReactNode
  status?: ReactNode
  /** Class màu riêng của trạng thái, ví dụ tf-status-AWAITING_COORDINATION. */
  statusClass?: string
  children?: ReactNode
}) {
  const actions = Children.toArray(children)
  return (
    <div className="tf-detail-head">
      <div className="tf-detail-title">
        <h2>{title}</h2>
        {status && (
          <span className={'tf-badge' + (statusClass ? ' ' + statusClass : '')}>
            {status}
          </span>
        )}
      </div>
      {actions.length > 0 && <div className="tf-detail-actions">{actions}</div>}
    </div>
  )
}

export type HeadAction = {
  key: string
  label: string
  icon?: IconName
  to?: string
  onClick?: () => void
  primary?: boolean
  disabled?: boolean
  /** Nút gửi của một form nằm ở chỗ khác trên trang (thuộc tính form của HTML). */
  form?: string
}

export function HeadButton({ action }: { action: HeadAction }) {
  const className =
    'mf-btn ' + (action.primary ? 'mf-btn--primary' : 'mf-btn--secondary')
  const content = (
    <>
      {action.icon && <Icon name={action.icon} />}
      {action.label}
    </>
  )
  return action.to ? (
    <Link className={className} to={action.to}>
      {content}
    </Link>
  ) : (
    <button
      type={action.form ? 'submit' : 'button'}
      form={action.form}
      className={className}
      disabled={action.disabled}
      onClick={action.onClick}
    >
      {content}
    </button>
  )
}
