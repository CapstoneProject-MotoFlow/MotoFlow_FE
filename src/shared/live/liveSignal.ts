/**
 * File: shared/live/liveSignal.ts
 * Loại: THÀNH PHẦN / XỬ LÝ HỖ TRỢ — không phải màn hình độc lập.
 * Công dụng: Tín hiệu "dữ liệu có thể đã đổi" dùng chung; tạm giữ khi có popup đang mở và gửi một lần khi popup đóng.
 */
// Internal target, not window, so the module also runs in node tests.
const target = new EventTarget()
const EVENT = 'live-changed'
let holds = 0
let pending = false

/** Sends the signal now, or once the last hold is released. */
export function emitLiveChanged(): void {
  if (holds > 0) {
    pending = true
    return
  }
  target.dispatchEvent(new Event(EVENT))
}

/** Holds the signal; returns release (calling release twice is a no-op). */
export function holdLiveReload(): () => void {
  holds++
  let released = false
  return () => {
    if (released) return
    released = true
    holds = Math.max(0, holds - 1)
    if (holds === 0 && pending) {
      pending = false
      target.dispatchEvent(new Event(EVENT))
    }
  }
}

export function subscribeLiveChanged(listener: () => void): () => void {
  target.addEventListener(EVENT, listener)
  return () => target.removeEventListener(EVENT, listener)
}
