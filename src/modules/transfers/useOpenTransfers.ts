import { useEffect, useState } from 'react'
import axiosClient from '../../shared/api/axiosClient'
import { inventoryError, type Query } from '../inventory/api'
import type { Page } from '../inventory/types'
import type { TransferRow } from './types'
/** Fetch only the prefixes needed for this page, never filter a single server page. */
export function useOpenTransfers(
  params: Query,
  page: number,
  enabled: boolean,
) {
  const key = JSON.stringify({ params, page }),
    [response, setResponse] = useState<{
      key: string
      data?: Page<TransferRow>
      error?: string
    }>()
  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController(),
      input = JSON.parse(key) as { params: Query; page: number }
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const needed = (input.page + 1) * 20
          const results = await Promise.all(
            ['AWAITING_DISPATCH', 'IN_TRANSIT', 'RECONCILING'].map(
              async (status) => {
                const items: TransferRow[] = []
                let total = 0
                for (let next = 0; items.length < needed; next++) {
                  const { data } = await axiosClient.get<Page<TransferRow>>(
                    '/transfer-orders',
                    {
                      params: {
                        ...input.params,
                        status,
                        page: next,
                        size: Math.min(100, needed),
                      },
                      signal: controller.signal,
                    },
                  )
                  total = data.totalItems
                  items.push(...data.items)
                  if (!data.items.length || items.length >= total) break
                }
                return { items, total }
              },
            ),
          )
          const all = results
            .flatMap((r) => r.items)
            .sort(
              (a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id,
            )
          if (!controller.signal.aborted)
            setResponse({
              key,
              data: {
                items: all.slice(input.page * 20, needed),
                totalItems: results.reduce((n, r) => n + r.total, 0),
                page: input.page,
                size: 20,
              },
            })
        } catch (e) {
          if (!controller.signal.aborted)
            setResponse({ key, error: inventoryError(e) })
        }
      })()
    }, 200)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [key, enabled])
  return {
    data: enabled && response?.key === key ? response.data : undefined,
    error: enabled && response?.key === key ? response.error : undefined,
    loading: enabled && response?.key !== key,
  }
}
