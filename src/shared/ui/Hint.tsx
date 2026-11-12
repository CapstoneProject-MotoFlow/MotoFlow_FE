/**
 * File: shared/ui/Hint.tsx
 * Loại: THÀNH PHẦN GIAO DIỆN DÙNG CHUNG — không phải màn hình.
 * Công dụng: Hộp giải thích nghiệp vụ ngắn đặt đầu màn (ví dụ: lô chỉ dùng để tính giá vốn).
 */
import type { ReactNode } from 'react'
import Icon from './Icon'

export default function Hint({
  children,
  tone = 'info',
}: {
  children: ReactNode
  tone?: 'info' | 'warning'
}) {
  return (
    <div
      className={'mf-hint' + (tone === 'warning' ? ' mf-hint--warning' : '')}
    >
      <Icon name={tone === 'warning' ? 'alert' : 'info'} />
      <p>{children}</p>
    </div>
  )
}
