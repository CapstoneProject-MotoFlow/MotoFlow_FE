import { useEffect, useState } from 'react'
import axiosClient from '../../shared/api/axiosClient'
import { inventoryError } from '../inventory/api'
import type { Transfer, Receipt } from './types'
import { returnableQuantities } from './transferRules'
export function useReturnQuantities(
  order: Transfer | undefined,
  enabled: boolean,
) {
  const key = JSON.stringify(order),
    [state, setState] = useState<{
      key: string
      data?: { productId: number; sku: string; quantity: number }[]
      error?: string
    }>()
  useEffect(() => {
    if (!enabled || !order) return
    const controller = new AbortController()
    const timer = setTimeout(() => {
      void Promise.all(
        order.receipts
          .filter(
            (r) =>
              r.receiptType === 'RETURN_TO_SOURCE' && r.status !== 'CONFIRMED',
          )
          .map((r) =>
            axiosClient
              .get<Receipt>(`/transfer-orders/${order.id}/receipts/${r.id}`, {
                signal: controller.signal,
              })
              .then((r) => r.data),
          ),
      )
        .then((receipts) => {
          if (!controller.signal.aborted)
            setState({ key, data: returnableQuantities(order, receipts) })
        })
        .catch((e) => {
          if (!controller.signal.aborted)
            setState({ key, error: inventoryError(e) })
        })
    }, 150)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [key, enabled, order])
  return {
    data: enabled && state?.key === key ? state.data : undefined,
    error: enabled && state?.key === key ? state.error : undefined,
    loading: enabled && state?.key !== key,
  }
}
