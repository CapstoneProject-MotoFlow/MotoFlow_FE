import { useEffect, useState } from 'react'
import axiosClient from '../../shared/api/axiosClient'
import { useAuth } from '../../shared/hooks/useAuth'
import type { Notice } from './notificationModel'
export { noticeTime } from './notificationModel'
export type { Notice } from './notificationModel'
type NoticePage = {
  items: Notice[]
  totalItems: number
  page: number
  size: number
}
export type Notices = {
  unread: number
  latest: Notice[]
  totalItems: number
  page: number
  size: number
}
const changed = 'motoflow-notifications-changed'
export function refreshNotifications() {
  window.dispatchEvent(new Event(changed))
}
export function useNotifications({
  page = 0,
  size = 5,
  unreadOnly = true,
}: { page?: number; size?: number; unreadOnly?: boolean } = {}) {
  const { user } = useAuth()
  const enabled = ['OWNER', 'BRANCH_MANAGER', 'STAFF'].includes(
    user?.role ?? '',
  )
  const [revision, setRevision] = useState(0)
  const session = [user?.id, user?.username, user?.role].join(':')
  const key = [session, page, size, unreadOnly, revision].join('|')
  const [state, setState] = useState<{
    key: string
    data?: Notices
    error?: string
  }>()
  useEffect(() => {
    const refresh = () => setRevision((value) => value + 1)
    window.addEventListener(changed, refresh)
    return () => window.removeEventListener(changed, refresh)
  }, [])
  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    const timer = setTimeout(() => {
      const list = axiosClient.get<NoticePage>('/notifications', {
        params: { page, size, unreadOnly },
        signal: controller.signal,
      })
      const count = unreadOnly
        ? Promise.resolve(null)
        : axiosClient.get<NoticePage>('/notifications', {
            params: { page: 0, size: 1, unreadOnly: true },
            signal: controller.signal,
          })
      void Promise.all([list, count])
        .then(([list, count]) => {
          if (!controller.signal.aborted)
            setState({
              key,
              data: {
                latest: list.data.items,
                totalItems: list.data.totalItems,
                page: list.data.page,
                size: list.data.size,
                unread: count?.data.totalItems ?? list.data.totalItems,
              },
            })
        })
        .catch(() => {
          if (!controller.signal.aborted)
            setState({
              key,
              error: 'Không tải được thông báo. Vui lòng thử lại.',
            })
        })
    }, 100)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [key, page, size, unreadOnly, enabled])
  return {
    enabled,
    data: enabled && state?.key === key ? state.data : undefined,
    error: enabled && state?.key === key ? state.error : undefined,
    loading: enabled && state?.key !== key,
    reload: () => setRevision((value) => value + 1),
  }
}
export async function markNoticeRead(id: number, signal?: AbortSignal) {
  const response = await axiosClient.post<Notice>(
    '/notifications/' + id + '/read',
    undefined,
    { signal },
  )
  return response.data
}
export async function markAllNoticesRead() {
  const response = await axiosClient.post<{ marked: number }>(
    '/notifications/read-all',
  )
  window.dispatchEvent(new Event(changed))
  return response.data
}
