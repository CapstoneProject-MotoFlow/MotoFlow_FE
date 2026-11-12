import { useEffect, useState } from 'react'
import axiosClient from '../../shared/api/axiosClient'
import { inventoryError } from '../inventory/api'
import type { Page } from '../inventory/types'
import type { Debtor } from '../receivables/types'
import { mapConcurrent } from '../../shared/utils/mapConcurrent'

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
  const [attempt, setAttempt] = useState(0)
  const key = url + '#' + attempt
  const [result, setResult] = useState<{
    key: string
    data?: T
    error?: string
  }>()
  useEffect(() => {
    const controller = new AbortController()
    void load(url, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setResult({ key, data })
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setResult({ key, error: inventoryError(error) })
      })
    return () => controller.abort()
  }, [key, url, load])
  const error = result?.key === key ? result.error : undefined
  return {
    data: result?.key === key ? result.data : undefined,
    error,
    loading: result?.key !== key,
    retry() {
      if (error) setAttempt((previous) => previous + 1)
    },
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

const isoDay = (date: Date) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(
    date,
  )
async function debtTotals(url: string, signal: AbortSignal) {
  const debtors = await readPages<Debtor>(url, signal)
  const today = isoDay(new Date())
  const week = isoDay(new Date(Date.now() + 7 * 86_400_000))
  return debtors.reduce(
    (totals, debtor) => ({
      debt: totals.debt + debtor.debt,
      overdueDebt: totals.overdueDebt + debtor.overdueDebt,
      dueSoonCustomers:
        totals.dueSoonCustomers +
        (debtor.earliestDueDate &&
        debtor.earliestDueDate >= today &&
        debtor.earliestDueDate <= week
          ? 1
          : 0),
    }),
    { debt: 0, overdueDebt: 0, dueSoonCustomers: 0 },
  )
}

export function useOwnerSalesTotals(day: string) {
  return useTotals(
    `/sales-orders?view=COMPLETED&createdFrom=${day}&createdTo=${day}`,
    salesTotals,
  )
}

/** Review C3: Tổng quan và màn Công nợ dùng chung một cách tính, nên số luôn khớp nhau. */
export function useOwnerDebtTotals(storeId?: number | string) {
  const scope =
    storeId === undefined || storeId === '' ? '' : `?storeId=${storeId}`
  return useTotals('/receivables/customers' + scope, debtTotals)
}

type SaleRow = { id: number; storeId: number; total: number | null }
type SaleMoney = {
  money: {
    netCollected: number
    credit: { amount: number | null } | null
  } | null
}
export type SalesPeriodTotals = {
  /** Doanh thu: tổng tiền các đơn hoàn tất tạo trong kỳ. */
  revenue: number
  /** Số đơn bán được (đơn hoàn tất). */
  orders: number
  /** Tiền đã thu: tiền khách đã trả (đã xác nhận, trừ tiền hoàn) của các đơn đó. */
  collected: number | null
  /** Bán chịu: phần ghi nợ của các đơn đó. */
  credit: number | null
  stores: Map<number, { revenue: number; orders: number }>
}
/** Số đơn tối đa đọc chi tiết để tính tiền đã thu; quá số này thì hiện "—" thay vì gọi quá nhiều API. */
export const COLLECTED_DETAIL_LIMIT = 150

async function salesPeriod(url: string, signal: AbortSignal) {
  const orders = await readPages<SaleRow>(url, signal)
  const stores = new Map<number, { revenue: number; orders: number }>()
  let revenue = 0
  for (const order of orders) {
    const total = order.total ?? 0
    revenue += total
    const store = stores.get(order.storeId) ?? { revenue: 0, orders: 0 }
    stores.set(order.storeId, {
      revenue: store.revenue + total,
      orders: store.orders + 1,
    })
  }
  let collected: number | null = null
  let credit: number | null = null
  if (orders.length <= COLLECTED_DETAIL_LIMIT) {
    // BE chưa có API tổng hợp tiền thu: đọc chi tiết từng đơn hoàn tất (giới hạn 4 request song song).
    const details = await mapConcurrent(
      orders,
      4,
      (order) =>
        axiosClient
          .get<SaleMoney>('/sales-orders/' + order.id, { signal })
          .then(({ data }) => data),
      () => !signal.aborted,
    )
    collected = details.reduce(
      (sum, detail) => sum + (detail?.money?.netCollected ?? 0),
      0,
    )
    credit = details.reduce(
      (sum, detail) => sum + (detail?.money?.credit?.amount ?? 0),
      0,
    )
  }
  return {
    revenue,
    orders: orders.length,
    collected,
    credit,
    stores,
  } satisfies SalesPeriodTotals
}

/** useOwnerSalesPeriod: Doanh thu, số đơn bán được, tiền đã thu và bán chịu trong khoảng ngày (theo ngày tạo đơn). */
export function useOwnerSalesPeriod(from: string, to: string) {
  return useTotals(
    `/sales-orders?view=COMPLETED&createdFrom=${from}&createdTo=${to}`,
    salesPeriod,
  )
}
