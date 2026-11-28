/**
 * File: modules/notifications/useNotificationPoller.ts
 * Loại: XỬ LÝ HỖ TRỢ — không phải màn hình độc lập.
 * Công dụng: Hỏi thông báo mới theo chu kỳ khi tab đang mở; khi có thông báo mới thì làm mới chuông và phát tín hiệu cho các màn hình đang mở.
 */
import { useEffect } from 'react'
import { isAxiosError } from 'axios'
import axiosClient from '../../shared/api/axiosClient'
import { useAuth } from '../../shared/hooks/useAuth'
import { emitLiveChanged } from '../../shared/live/liveSignal'
import type { Notice } from './notificationModel'
import { refreshNotifications } from './notificationService'
import { diffNotices, nextDelay } from './noticePolling'

const pollingRoles = ['OWNER', 'BRANCH_MANAGER', 'STAFF']

/** Polls for new notifications; one request at a time, chained timeouts, stops on 403. */
export function useNotificationPoller() {
  const { user } = useAuth()
  const enabled =
    !!user && pollingRoles.includes(user.role ?? '') && !user.mustChangePassword
  // A new user or role starts a new loop with an empty baseline.
  const session = [user?.id, user?.role].join(':')

  useEffect(() => {
    if (!enabled) return
    let seen: Set<number> | null = null
    let stopped = false
    let inFlight = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let controller: AbortController | undefined

    function clearTimer() {
      if (timer !== undefined) clearTimeout(timer)
      timer = undefined
    }

    function schedule() {
      clearTimer()
      // While a request is in flight, its finally block schedules the next poll.
      if (stopped || inFlight) return
      const delay = nextDelay(
        { hidden: document.hidden, focused: document.hasFocus() },
        Math.random(),
      )
      if (delay === null) return
      timer = setTimeout(() => {
        timer = undefined
        void poll()
      }, delay)
    }

    async function poll() {
      if (stopped || inFlight) return
      inFlight = true
      const current = new AbortController()
      controller = current
      try {
        const { data } = await axiosClient.get<{ items: Notice[] }>(
          '/notifications',
          {
            params: { page: 0, size: 20, unreadOnly: false },
            signal: current.signal,
          },
        )
        if (stopped) return
        const result = diffNotices(seen, data.items)
        seen = result.seen
        if (result.fresh.length > 0) {
          refreshNotifications()
          emitLiveChanged()
        }
      } catch (error) {
        if (stopped) return
        // 403 means the session may not read notifications; stop instead of retrying forever.
        if (isAxiosError(error) && error.response?.status === 403) {
          stopped = true
          return
        }
      } finally {
        inFlight = false
        if (controller === current) controller = undefined
      }
      schedule()
    }

    function onVisibility() {
      if (document.hidden) {
        clearTimer()
        return
      }
      clearTimer()
      void poll()
    }
    function onFocus() {
      clearTimer()
      void poll()
    }
    function onBlur() {
      schedule()
    }

    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('focus', onFocus)
    window.addEventListener('blur', onBlur)
    void poll()

    return () => {
      stopped = true
      clearTimer()
      controller?.abort()
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('blur', onBlur)
    }
  }, [enabled, session])
}
