/**
 * File: shared/live/useLiveReload.ts
 * Loại: THÀNH PHẦN / XỬ LÝ HỖ TRỢ — không phải màn hình độc lập.
 * Công dụng: Hook cho màn hình nhận tín hiệu làm mới ngầm, và hook tạm giữ tín hiệu khi popup đang mở.
 */
import { useEffect, useEffectEvent } from 'react'
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
