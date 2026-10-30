import { useEffect, useState } from 'react'
import axiosClient from '../../shared/api/axiosClient'
export type Notice = {
  id: number
  type: string
  message: string
  refType: string | null
  refId: number | null
  createdAt: string
}
export type Notices = { unread: number; latest: Notice[] }
export function useNotifications() {
  const [data, setData] = useState<Notices | null>(null)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    let active = true
    setError('')
    axiosClient
      .get<{ notifications: Notices | null }>('/home')
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
export function noticeTime(value: string) {
  return new Date(value).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}
