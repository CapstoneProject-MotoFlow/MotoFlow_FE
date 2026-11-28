import { useEffect, useState } from 'react'
import axiosClient from '../../shared/api/axiosClient'
import { useQuietRefresh } from '../../shared/live/useLiveReload'
import {
  readReceivingTasks,
  receivingTaskTypes,
  type ReceivingTask,
  type ReceivingTaskType,
} from './receivingTaskModel'

/** Each request is settled on its own: a failed one is reported in `failed`, not thrown. */
async function loadReceivingTasks(taskTypes: string[], signal: AbortSignal) {
  const results = await Promise.allSettled(
    taskTypes.map((taskType) =>
      axiosClient.get('/warehouse-tasks/assigned-to-me', {
        params: { taskType },
        signal,
      }),
    ),
  )
  return {
    tasks: results.flatMap((result) =>
      result.status === 'fulfilled'
        ? readReceivingTasks(result.value.data)
        : [],
    ),
    failed: results.some((result) => result.status === 'rejected'),
  }
}

/**
 * Việc nhận hàng đang giao cho tôi (GET /warehouse-tasks/assigned-to-me?taskType=...).
 * Lỗi đọc một loại việc không làm hỏng các bảng việc khác, chỉ coi như không có việc loại đó.
 */
export function useReceivingTasks(
  types: ReceivingTaskType[] = receivingTaskTypes,
  enabled = true,
  revision = 0,
  live = false,
) {
  const key = types.join(',') + '#' + revision
  const [state, setState] = useState<{
    key: string
    tasks: ReceivingTask[]
    failed: boolean
  }>()
  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    const timer = setTimeout(() => {
      void loadReceivingTasks(
        key.split('#')[0].split(','),
        controller.signal,
      ).then((result) => {
        if (controller.signal.aborted) return
        setState({ key, ...result })
      })
    }, 0)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [key, enabled])
  useQuietRefresh((signal) => {
    const k = key
    void loadReceivingTasks(k.split('#')[0].split(','), signal)
      .then((result) => {
        // Keep the old list when any request failed, so a partial result never hides tasks.
        if (!signal.aborted && !result.failed)
          setState((p) => (p?.key === k ? { ...p, ...result } : p))
      })
      .catch(() => {})
  }, enabled && live)
  const current = enabled && state?.key === key ? state : undefined
  return {
    tasks: current?.tasks ?? [],
    loading: enabled && !current,
    // Có ít nhất một loại việc đọc lỗi: danh sách có thể thiếu, đừng kết luận là "không được giao".
    failed: current?.failed ?? false,
  }
}
