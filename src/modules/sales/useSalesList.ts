import { useEffect, useState } from 'react'
import axiosClient from '../../shared/api/axiosClient'
import { inventoryError, type Query } from '../inventory/api'
import type { Page } from '../inventory/types'
import type { SummaryDto } from './salesApi'
/** The BE supports view, not exact status. Filter a complete collection before paginating. */
export function useSalesList(params: Query, status: string, enabled = true) {
  const key = JSON.stringify({
      params: status ? { ...params, page: undefined, size: undefined } : params,
      status,
    }),
    [response, setResponse] = useState<{
      key: string
      data?: Page<SummaryDto>
      error?: string
    }>()
  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    const input = JSON.parse(key) as { params: Query; status: string }
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const page = Number(input.params.page) || 0,
            size = Number(input.params.size) || 20
          let result: Page<SummaryDto>
          if (!input.status) {
            result = (
              await axiosClient.get<Page<SummaryDto>>('/sales-orders', {
                params: input.params,
                signal: controller.signal,
              })
            ).data
          } else {
            const rows: SummaryDto[] = []
            for (let next = 0; ; next++) {
              const { data } = await axiosClient.get<Page<SummaryDto>>(
                '/sales-orders',
                {
                  params: { ...input.params, page: next, size: 100 },
                  signal: controller.signal,
                },
              )
              rows.push(...data.items)
              if (!data.items.length || rows.length >= data.totalItems) break
            }
            const selected = rows.filter((o) => o.status === input.status)
            result = {
              items: selected,
              totalItems: selected.length,
              page,
              size,
            }
          }
          if (!controller.signal.aborted) setResponse({ key, data: result })
        } catch (error) {
          if (!controller.signal.aborted)
            setResponse({ key, error: inventoryError(error) })
        }
      })()
    }, 200)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [key, enabled])
  return {
    data:
      enabled && response?.key === key && response.data
        ? status
          ? {
              ...response.data,
              items: response.data.items.slice(
                (Number(params.page) || 0) * (Number(params.size) || 20),
                ((Number(params.page) || 0) + 1) * (Number(params.size) || 20),
              ),
              page: Number(params.page) || 0,
              size: Number(params.size) || 20,
            }
          : response.data
        : undefined,
    error: enabled && response?.key === key ? response.error : undefined,
    loading: enabled && response?.key !== key,
  }
}
/** Searchable option lists fetch additional pages only when requested. */
export function useChoicePages<T extends { id: number }>(
  path: string,
  q: string,
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
  }, [path, q, page, retry])
  const current = response?.q === q ? response : undefined,
    loading = !current || current.page !== page
  return {
    data: current?.data,
    error: current?.error,
    loading,
    hasMore:
      (current?.data?.items.length ?? 0) < (current?.data?.totalItems ?? 0),
    loadMore: () => {
      if (!loading) {
        if (current?.error) setRetry((n) => n + 1)
        else setRequest({ q, page: page + 1 })
      }
    },
  }
}
