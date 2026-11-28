import { useEffect, useState } from 'react'
import axiosClient from '../../shared/api/axiosClient'
import { useQuietRefresh } from '../../shared/live/useLiveReload'
import { inventoryError, type Query } from '../inventory/api'
import type { Page } from '../inventory/types'
import type { TransferRow } from './types'

async function loadOpenTransfers(
  input: { params: Query; page: number },
  signal: AbortSignal,
): Promise<Page<TransferRow>> {
  const needed = (input.page + 1) * 20
  const results = await Promise.all(
    ['AWAITING_DISPATCH', 'IN_TRANSIT', 'RECONCILING'].map(async (status) => {
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
            signal,
          },
        )
        total = data.totalItems
        items.push(...data.items)
        if (!data.items.length || items.length >= total) break
      }
      return { items, total }
    }),
  )
  const all = results
    .flatMap((r) => r.items)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id)
  return {
    items: all.slice(input.page * 20, needed),
    totalItems: results.reduce((n, r) => n + r.total, 0),
    page: input.page,
    size: 20,
  }
}

/** Fetch only the prefixes needed for this page, never filter a single server page. */
export function useOpenTransfers(
  params: Query,
  page: number,
  enabled: boolean,
  live = false,
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
      loadOpenTransfers(input, controller.signal)
        .then((data) => {
          if (!controller.signal.aborted) setResponse({ key, data })
        })
        .catch((e) => {
          if (!controller.signal.aborted)
            setResponse({ key, error: inventoryError(e) })
        })
    }, 200)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [key, enabled])
  useQuietRefresh((signal) => {
    const k = key
    const input = JSON.parse(k) as { params: Query; page: number }
    loadOpenTransfers(input, signal)
      .then((data) => {
        if (!signal.aborted)
          setResponse((p) =>
            p?.key === k ? { ...p, data, error: undefined } : p,
          )
      })
      .catch(() => {})
  }, enabled && live)
  return {
    data: enabled && response?.key === key ? response.data : undefined,
    error: enabled && response?.key === key ? response.error : undefined,
    loading: enabled && response?.key !== key,
  }
}
