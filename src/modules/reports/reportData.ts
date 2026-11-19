/**
 * File: modules/reports/reportData.ts
 * Loại: THÀNH PHẦN / XỬ LÝ HỖ TRỢ — không phải màn hình độc lập.
 * Công dụng: Hàm ngày và hook tải dữ liệu dùng chung cho các màn báo cáo.
 */
import { useEffect, useState } from 'react'
import { inventoryError } from '../inventory/api'

/** Ngày theo giờ Việt Nam, dạng "2026-11-19". */
export const day = (date: Date) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(
    date,
  )
export const defaultTo = () => day(new Date())
export const monthStart = () =>
  day(new Date(new Date().getFullYear(), new Date().getMonth(), 1))

/** Tải lại khi key đổi; bỏ kết quả của lần tải cũ. */
export function useLoad<T>(
  key: string,
  load: (signal: AbortSignal) => Promise<T>,
) {
  const [state, setState] = useState<{ key: string; data?: T; error?: string }>(
    { key: '' },
  )
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    load(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setState({ key: key + retry, data })
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setState({ key: key + retry, error: inventoryError(error) })
      })
    return () => controller.abort()
  }, [key, retry, load])
  return {
    data: state.key === key + retry ? state.data : undefined,
    error: state.key === key + retry ? state.error : undefined,
    loading: state.key !== key + retry,
    reload: () => setRetry((v) => v + 1),
  }
}
