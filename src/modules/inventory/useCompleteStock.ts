import { useEffect, useState } from 'react'
import axiosClient from '../../shared/api/axiosClient'
import { inventoryError, type Query } from './api'
import { readAllStock } from './stockGrouping'
import type { Page, StockRow } from './types'
export function useCompleteStock(
  params: Query,
  revision: number,
  enabled = true,
  session = '',
) {
  const query = new URLSearchParams(
    Object.entries(params)
      .filter(([, value]) => value !== undefined && value !== '')
      .map(([key, value]) => [key, String(value)]),
  ).toString()
  const key = query + '#' + revision + '#' + session
  const [state, setState] = useState<{
    key: string
    data?: StockRow[]
    error?: string
  }>()
  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    const timer = setTimeout(() => {
      void readAllStock(
        async (page) =>
          (
            await axiosClient.get<Page<StockRow>>(
              '/inventory/stock' + (query ? '?' + query : ''),
              {
                params: { page, size: 100, includeZero: true },
                signal: controller.signal,
              },
            )
          ).data,
        controller.signal,
      )
        .then((data) => {
          if (!controller.signal.aborted) setState({ key, data })
        })
        .catch((error) => {
          if (!controller.signal.aborted)
            setState({ key, error: inventoryError(error) })
        })
    }, 200)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query, key, enabled])
  return {
    data: enabled && state?.key === key ? state.data : undefined,
    error: enabled && state?.key === key ? state.error : undefined,
    loading: enabled && state?.key !== key,
  }
}
