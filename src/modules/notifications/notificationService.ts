/**
 * File: modules/notifications/notificationService.ts
 * Loại: THÀNH PHẦN / XỬ LÝ HỖ TRỢ — không phải màn hình độc lập.
 * Công dụng: useNotifications tải dữ liệu, quản lý trạng thái lỗi và tải lại; Notice/Notices là kiểu thông báo; noticeTime định dạng thời gian.
 */
import { useEffect, useState } from 'react'
import { getHome, type Home } from '../../shared/api/homeService'
export type Notices = NonNullable<Home['notifications']>
export type Notice = Notices['latest'][number]
/** useNotifications: Tải thông báo từ home và cung cấp dữ liệu, lỗi cùng thao tác tải lại. */
export function useNotifications() {
  const [data, setData] = useState<Notices | null>(null)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    let active = true
    setError('')
    getHome()
      .then((r) => {
        if (active) setData(r.data.notifications || { unread: 0, latest: [] })
      })
      .catch(() => {
        if (active) setError('Không tải được thông báo.')
      })
    return () => {
      active = false
    }
  }, [revision])
  return { data, error, reload: () => setRevision((x) => x + 1) }
}
/** noticeTime: Đổi thời gian thông báo sang chuỗi ngày giờ tiếng Việt. */
export function noticeTime(value: string) {
  return new Date(value).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}
