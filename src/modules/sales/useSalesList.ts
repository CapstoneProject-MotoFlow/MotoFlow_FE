import { useEffect, useState } from 'react'
import axiosClient from '../../shared/api/axiosClient'
import { inventoryError, type Query } from '../inventory/api'
import type { Page } from '../inventory/types'
import type { SummaryDto } from './salesApi'
/** Status filtering and pagination are performed by the server. */
export function useSalesList(params: Query, status: string, enabled = true) {
  const key = JSON.stringify({ ...params, status: status || undefined })
  const [response, setResponse] = useState<{
    key: string
    data?: Page<SummaryDto>
    error?: string
  }>()
  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    const timer = setTimeout(() => {
      void axiosClient
        .get<Page<SummaryDto>>('/sales-orders', {
          params: JSON.parse(key),
          signal: controller.signal,
        })
        .then(({ data }) => {
          if (!controller.signal.aborted) setResponse({ key, data })
        })
        .catch((error) => {
          if (!controller.signal.aborted)
            setResponse({ key, error: inventoryError(error) })
        })
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
/** Searchable option lists fetch additional pages only when requested. */
export function useChoicePages<T extends { id: number }>(
  path: string,
  q: string,
  enabled = true,
) {
  const [retry, setRetry] = useState(0)
  const [request, setRequest] = useState({ q: '', page: 0 }),
    page = request.q === q ? request.page : 0
  const [response, setResponse] = useState<{
    q: string
    page: number
    data?: Page<T>
    error?: string
  }>()
  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    const timer = setTimeout(() => {
      void axiosClient
        .get<Page<T>>(path, {
          params: { q, page, size: 20 },
          signal: controller.signal,
        })
        .then(({ data }) => {
          if (!controller.signal.aborted)
            setResponse((previous) => ({
              q,
              page,
              data: {
                ...data,
                items: [
                  ...new Map(
                    [
                      ...(page > 0 && previous?.q === q
                        ? (previous.data?.items ?? [])
                        : []),
                      ...data.items,
                    ].map((item) => [item.id, item]),
                  ).values(),
                ],
              },
            }))
        })
        .catch((error) => {
          if (!controller.signal.aborted)
            setResponse((previous) => ({
              q,
              page,
              data: previous?.q === q ? previous.data : undefined,
              error: inventoryError(error),
            }))
        })
    }, 200)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [path, q, page, retry, enabled])
  const current = response?.q === q ? response : undefined,
    loading = enabled && (!current || current.page !== page)
  return {
    data: current?.data,
    error: current?.error,
    loading,
    hasMore:
      (current?.data?.items.length ?? 0) < (current?.data?.totalItems ?? 0),
    loadMore: () => {
      if (enabled && !loading) {
        if (current?.error) setRetry((n) => n + 1)
        else setRequest({ q, page: page + 1 })
      }
    },
  }
}
