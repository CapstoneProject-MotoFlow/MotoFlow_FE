import { useEffect, useState } from 'react'
import { isAxiosError } from 'axios'
import axiosClient from '../../shared/api/axiosClient'
import { inventoryError } from '../inventory/api'
export default function StoreStock({
  storeId,
  productId,
}: {
  storeId: string
  productId: number
}) {
  const key = storeId + ':' + productId,
    [state, setState] = useState<{
      key: string
      qty?: number
      error?: string
    }>()
  useEffect(() => {
    if (!storeId || productId <= 0) return
    const controller = new AbortController()
    void axiosClient
      .get<{ stock: { availableQty: number; expiredQty: number } }>(
        `/inventory/stock/${storeId}/${productId}`,
        { signal: controller.signal },
      )
      .then((r) => {
        if (!controller.signal.aborted)
          setState({
            key,
            qty: Math.max(
              0,
              r.data.stock.availableQty - r.data.stock.expiredQty,
            ),
          })
      })
      .catch((e) => {
        if (controller.signal.aborted) return
        if (
          isAxiosError<{ code?: string }>(e) &&
          e.response?.status === 404 &&
          e.response.data.code === 'MSG89'
        )
          setState({ key, qty: 0 })
        else setState({ key, error: inventoryError(e) })
      })
    return () => controller.abort()
  }, [storeId, productId, key])
  const current = state?.key === key ? state : undefined
  return (
    <span title={current?.error}>
      {!storeId
        ? 'Chọn cửa hàng'
        : !current
          ? 'Đang tải…'
          : current.error
            ? 'Không tải được'
            : current.qty}
    </span>
  )
}
