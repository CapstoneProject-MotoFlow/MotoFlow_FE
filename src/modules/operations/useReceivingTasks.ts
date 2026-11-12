import { useEffect, useState } from 'react'
import axiosClient from '../../shared/api/axiosClient'
import {
  readReceivingTasks,
  receivingTaskTypes,
  type ReceivingTask,
  type ReceivingTaskType,
} from './receivingTaskModel'

/**
 * Việc nhận hàng đang giao cho tôi (GET /warehouse-tasks/assigned-to-me?taskType=...).
 * Lỗi đọc một loại việc không làm hỏng các bảng việc khác, chỉ coi như không có việc loại đó.
 */
export function useReceivingTasks(
  types: ReceivingTaskType[] = receivingTaskTypes,
  enabled = true,
  revision = 0,
) {
  const key = types.join(',') + '#' + revision
  const [state, setState] = useState<{ key: string; tasks: ReceivingTask[] }>()
  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    const timer = setTimeout(() => {
      void Promise.allSettled(
        key
          .split('#')[0]
          .split(',')
          .map((taskType) =>
            axiosClient.get('/warehouse-tasks/assigned-to-me', {
              params: { taskType },
              signal: controller.signal,
            }),
          ),
      ).then((results) => {
        if (controller.signal.aborted) return
        setState({
          key,
          tasks: results.flatMap((result) =>
            result.status === 'fulfilled'
              ? readReceivingTasks(result.value.data)
              : [],
          ),
        })
      })
    }, 0)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [key, enabled])
  const current = enabled && state?.key === key ? state : undefined
  return { tasks: current?.tasks ?? [], loading: enabled && !current }
}
