/**
 * File: shared/hooks/useBackClick.ts
 * Loại: HOOK DÙNG CHUNG — nút "Quay lại".
 * Công dụng: quay lại đúng trang đã mở trước đó trong ứng dụng (navigate(-1)). Nếu không có trang
 * trước (mở thẳng bằng link, idx = 0) hoặc người dùng mở trong tab mới (Ctrl/Shift/giữa chuột)
 * thì không chặn link, link đi tới địa chỉ đích như cũ.
 */
import type { MouseEvent } from 'react'
import { useNavigate } from 'react-router-dom'

/** true khi trong phiên này đã có trang trước (react-router lưu idx trong history.state). */
export function hasAppHistory() {
  const idx = (window.history.state as { idx?: number } | null)?.idx
  return typeof idx === 'number' && idx > 0
}

export function useBackClick() {
  const navigate = useNavigate()
  return function onBackClick(event: MouseEvent<HTMLAnchorElement>) {
    const newTab =
      event.metaKey || event.ctrlKey || event.shiftKey || event.altKey
    if (newTab || event.button !== 0 || !hasAppHistory()) return
    event.preventDefault()
    navigate(-1)
  }
}
