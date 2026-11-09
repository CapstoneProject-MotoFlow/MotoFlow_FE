import { useEffect, useState } from 'react'
import axiosClient from '../../shared/api/axiosClient'
import { useInventoryData, inventoryError, type Query } from './api'
import type { CountList, CountRow, CountRequest } from './countApi'
export function useCountList(params: Query, revision: number, enabled = true) {
  const grouped = params.status === 'OPEN',
    key = JSON.stringify({ ...params, revision }),
    normal = useInventoryData<CountList>(
      '/stock-counts',
      params,
      revision,
      enabled && !grouped,
    )
  const [result, setResult] = useState<{
    key: string
    data?: CountList
    error?: string
  }>()
  useEffect(() => {
    if (!enabled || !grouped) return
    const controller = new AbortController()
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const rows: CountRow[] = []
          const pending = new Map<number, CountRequest>()
          const query = JSON.parse(key),
            currentPage = Number(query.page) || 0,
            needed = (currentPage + 1) * 20,
            size = Math.min(100, needed)
          let totalItems = 0
          for (const status of ['DRAFT', 'COUNTING', 'AWAITING_APPROVAL']) {
            let received = 0,
              total = 0
            for (let page = 0; ; page++) {
              const { data } = await axiosClient.get<CountList>(
                '/stock-counts',
                {
                  params: {
                    ...JSON.parse(key),
                    revision: undefined,
                    status,
                    page,
                    size,
                  },
                  signal: controller.signal,
                },
              )
              rows.push(...data.counts.items)
              received += data.counts.items.length
              total = data.counts.totalItems
              data.pendingRequests.forEach((r) => pending.set(r.id, r))
              if (
                !data.counts.items.length ||
                received >= total ||
                received >= needed
              )
                break
            }
            totalItems += total
          }
          const all = [...new Map(rows.map((r) => [r.id, r])).values()].sort(
              (a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id,
            ),
            page = Number(query.page) || 0
          if (!controller.signal.aborted)
            setResult({
              key,
              data: {
                counts: {
                  items: all.slice(page * 20, (page + 1) * 20),
                  totalItems,
                  page,
                  size: 20,
                },
                pendingRequests: [...pending.values()],
              },
            })
        } catch (e) {
          if (!controller.signal.aborted)
            setResult({ key, error: inventoryError(e) })
        }
      })()
    }, 150)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [key, enabled, grouped])
  return grouped
    ? {
        data: enabled && result?.key === key ? result.data : undefined,
        error: enabled && result?.key === key ? result.error : undefined,
        loading: enabled && result?.key !== key,
      }
    : normal
}
