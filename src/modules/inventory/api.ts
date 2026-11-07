import { useEffect, useState } from 'react'
import { isAxiosError } from 'axios'
import axiosClient from '../../shared/api/axiosClient'
import { useAuth } from '../../shared/hooks/useAuth'
import { useSearchParams } from 'react-router-dom'
import type { DashboardStore } from '../../shared/types/store'

export type Query = Record<string, string | number | boolean | undefined>
export function inventoryError(error: unknown) {
  if (
    isAxiosError<{
      message?: string
      code?: string
      fieldErrors?: Record<string, string>
    }>(error)
  ) {
    if (error.response?.data?.code === 'MSG70')
      return 'Chức năng kho hàng hiện chưa sẵn sàng. Vui lòng thử lại sau.'
    const fields = error.response?.data?.fieldErrors
    if (fields && Object.keys(fields).length)
      return Object.values(fields).join(' ')
    return (
      error.response?.data?.message ??
      'Không tải được dữ liệu. Vui lòng thử lại.'
    )
  }
  return error instanceof Error
    ? error.message
    : 'Không thực hiện được. Vui lòng thử lại.'
}

export function useInventoryData<T>(
  path: string,
  params: Query = {},
  revision = 0,
  enabled = true,
) {
  const query = new URLSearchParams(
    Object.entries(params)
      .filter(([, value]) => value !== undefined && value !== '')
      .map(([key, value]) => [key, String(value)]),
  ).toString()
  const key = path + '?' + query + '#' + revision
  const [response, setResponse] = useState<{
    key: string
    data?: T
    error?: string
  }>()
  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    const timer = setTimeout(() => {
      void axiosClient
        .get<T>(path + (query ? '?' + query : ''), {
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
  }, [path, query, key, enabled])
  return {
    data: enabled && response?.key === key ? response.data : undefined,
    error: enabled && response?.key === key ? response.error : undefined,
    loading: enabled && response?.key !== key,
  }
}

export function useInventoryScope() {
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const owner = user?.role === 'OWNER'
  const stores = useInventoryData<DashboardStore[]>('/stores', {}, 0, owner)
  const storeId = owner ? (params.get('storeId') ?? '') : ''
  function filter(
    change: Record<string, string | boolean | number | undefined>,
    replace = false,
  ) {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous)
        for (const [key, value] of Object.entries(change)) {
          if (value === undefined || value === '' || value === false)
            next.delete(key)
          else next.set(key, String(value))
        }
        next.delete('page')
        return next
      },
      { replace },
    )
  }
  return {
    user,
    owner,
    params,
    setParams,
    filter,
    stores: stores.data ?? [],
    storesError: stores.error,
    storeId,
    warehouse: owner
      ? (stores.data?.find((store) => String(store.id) === storeId)
          ?.storeName ?? 'Toàn chuỗi')
      : (user?.storeName ?? 'Kho của tôi'),
  }
}
