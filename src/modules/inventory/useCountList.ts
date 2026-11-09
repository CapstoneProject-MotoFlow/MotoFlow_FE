import { useEffect, useState } from 'react'
import axiosClient from '../../shared/api/axiosClient'
import { useInventoryData, inventoryError, type Query } from './api'
import type { CountList, CountRow } from './countApi'
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
          for (const status of ['DRAFT', 'COUNTING', 'AWAITING_APPROVAL']) {
            for (let page = 0; ; page++) {
              const { data } = await axiosClient.get<CountList>(
                '/stock-counts',
                {
                  params: {
                    ...JSON.parse(key),
                    revision: undefined,
                    status,
                    page,
                    size: 100,
                  },
                  signal: controller.signal,
                },
              )
              rows.push(...data.counts.items)
              if (
                !data.counts.items.length ||
                (page + 1) * 100 >= data.counts.totalItems
              )
                break
            }
          }
          const all = [...new Map(rows.map((r) => [r.id, r])).values()].sort(
              (a, b) => a.countDate.localeCompare(b.countDate) || a.id - b.id,
            ),
            query = JSON.parse(key),
            page = Number(query.page) || 0
          if (!controller.signal.aborted)
            setResult({
              key,
              data: {
                counts: {
                  items: all.slice(page * 20, (page + 1) * 20),
                  totalItems: all.length,
                  page,
                  size: 20,
                },
                pendingRequests: [],
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
