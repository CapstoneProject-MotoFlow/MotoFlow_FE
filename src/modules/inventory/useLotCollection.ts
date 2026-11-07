import { useEffect, useState } from 'react'
import axiosClient from '../../shared/api/axiosClient'
import { inventoryError } from './api'
import type { LotList, LotRow } from './types'
export function useLotCollection(
  storeId: string,
  session: string,
  revision = 0,
) {
  const key = storeId + ':' + session + ':' + revision
  const [state, setState] = useState<{
    key: string
    rows?: LotRow[]
    days?: number | null
    error?: string
  }>()
  useEffect(() => {
    const controller = new AbortController()
    async function read(tab: string) {
      const rows: LotRow[] = []
      const seen = new Set<string>()
      let total: number | undefined
      for (let page = 0; ; page++) {
        const response = await axiosClient.get<LotList>('/inventory/lots', {
          params: { storeId: storeId || undefined, tab, page, size: 100 },
          signal: controller.signal,
        })
        const data = response.data
        const days = data.expiryWarningDays
        if (total != null && total !== data.page.totalItems)
          throw new Error('Danh sách lô đã thay đổi. Vui lòng tải lại.')
        total = data.page.totalItems
        for (const row of data.page.items) {
          const id = row.lotId + ':' + row.storeId
          if (seen.has(id))
            throw new Error('Dữ liệu lô bị trùng. Vui lòng tải lại.')
          seen.add(id)
          rows.push(row)
        }
        if (rows.length === total) return { rows, days }
        if (!data.page.items.length || rows.length > total)
          throw new Error('Chưa tải đủ danh sách lô. Vui lòng tải lại.')
      }
    }
    void Promise.all([read('IN_STOCK'), read('DEPLETED')])
      .then(([stock, depleted]) => {
        if (!controller.signal.aborted)
          setState({
            key,
            rows: [...stock.rows, ...depleted.rows],
            days: stock.days,
          })
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setState({ key, error: inventoryError(error) })
      })
    return () => controller.abort()
  }, [key, storeId])
  return {
    rows: state?.key === key ? state.rows : undefined,
    days: state?.key === key ? state.days : undefined,
    error: state?.key === key ? state.error : undefined,
    loading: state?.key !== key,
  }
}
