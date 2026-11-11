import { useEffect, useState } from 'react'
import axiosClient from '../../shared/api/axiosClient'
import { inventoryError } from '../inventory/api'
import type { Page } from '../inventory/types'
import type { Debtor } from '../receivables/types'

type Sale = { storeId: number; total: number | null }

async function readPages<T>(url: string, signal: AbortSignal) {
  const items: T[] = []
  let page = 0
  while (true) {
    const { data } = await axiosClient.get<Page<T>>(url, {
      params: { page, size: 100 },
      signal,
    })
    items.push(...data.items)
    page += 1
    if (!data.items.length || page * data.size >= data.totalItems) return items
  }
}

function useTotals<T>(
  url: string,
  load: (url: string, signal: AbortSignal) => Promise<T>,
) {
  const [result, setResult] = useState<{
    url: string
    data?: T
    error?: string
  }>()
  useEffect(() => {
    const controller = new AbortController()
    void load(url, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setResult({ url, data })
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setResult({ url, error: inventoryError(error) })
      })
    return () => controller.abort()
  }, [url, load])
  return {
    data: result?.url === url ? result.data : undefined,
    error: result?.url === url ? result.error : undefined,
    loading: result?.url !== url,
  }
}

async function salesTotals(url: string, signal: AbortSignal) {
  const orders = await readPages<Sale>(url, signal)
  const stores = new Map<number, number>()
  let total = 0
  for (const order of orders) {
    if (order.total == null)
      throw new Error('Thiếu số tiền của đơn bán đã hoàn tất.')
    total += order.total
    stores.set(order.storeId, (stores.get(order.storeId) ?? 0) + order.total)
  }
  return { total, stores }
}

async function debtTotals(url: string, signal: AbortSignal) {
  const debtors = await readPages<Debtor>(url, signal)
  return debtors.reduce(
    (totals, debtor) => ({
      debt: totals.debt + debtor.debt,
      overdueDebt: totals.overdueDebt + debtor.overdueDebt,
    }),
    { debt: 0, overdueDebt: 0 },
  )
}

export function useOwnerSalesTotals(day: string) {
  return useTotals(
    `/sales-orders?view=COMPLETED&createdFrom=${day}&createdTo=${day}`,
    salesTotals,
  )
}

export function useOwnerDebtTotals(storeId?: number) {
  const scope = storeId === undefined ? '' : `?storeId=${storeId}`
  return useTotals('/receivables/customers' + scope, debtTotals)
}
