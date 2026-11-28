/**
 * File: shared/live/useLiveReload.ts
 * Loại: THÀNH PHẦN / XỬ LÝ HỖ TRỢ — không phải màn hình độc lập.
 * Công dụng: Hook cho màn hình nhận tín hiệu làm mới ngầm, và hook tạm giữ tín hiệu khi popup đang mở.
 */
import { useEffect, useEffectEvent, useState } from 'react'
import { holdLiveReload, subscribeLiveChanged } from './liveSignal'

/** Calls onChange on each live signal while enabled. */
export function useLiveReload(onChange: () => void, enabled = true) {
  const handle = useEffectEvent(onChange)
  useEffect(() => {
    if (!enabled) return
    return subscribeLiveChanged(() => handle())
  }, [enabled])
}

/** Holds live reloads while active (e.g. while a dialog is open). */
export function useLiveReloadPause(active = true) {
  useEffect(() => (active ? holdLiveReload() : undefined), [active])
}

/** On each live signal while enabled, calls refresh 200 ms later with an AbortSignal; a newer signal or unmount aborts it. */
export function useQuietRefresh(
  refresh: (signal: AbortSignal) => void,
  enabled: boolean,
) {
  const [tick, setTick] = useState(0)
  useLiveReload(() => setTick((n) => n + 1), enabled)
  const run = useEffectEvent(refresh)
  useEffect(() => {
    if (tick === 0 || !enabled) return
    const controller = new AbortController()
    const timer = setTimeout(() => run(controller.signal), 200)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [tick, enabled])
}
