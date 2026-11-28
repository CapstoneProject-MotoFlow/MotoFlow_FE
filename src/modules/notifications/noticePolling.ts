/**
 * File: modules/notifications/noticePolling.ts
 * Loại: XỬ LÝ HỖ TRỢ — không phải màn hình độc lập.
 * Công dụng: Thuật toán thuần cho việc hỏi thông báo mới: so sánh theo tập id và tính thời gian chờ giữa các lần hỏi.
 */
/** First call (seen === null) only records ids. Later calls return items whose id was not in seen.
 *  Ids are compared as a set, not "max id": ids are given at INSERT, not in commit order, so a
 *  notification with a smaller id can become visible after a larger one. */
export function diffNotices<T extends { id: number }>(
  seen: Set<number> | null,
  items: T[],
): { seen: Set<number>; fresh: T[] } {
  return {
    seen: new Set(items.map((item) => item.id)),
    fresh: seen === null ? [] : items.filter((item) => !seen.has(item.id)),
  }
}

export const FOCUSED_DELAY = 2000
export const BACKGROUND_DELAY = 10000

/** null = stop (tab hidden). random in [0,1) adds 0–300 ms so tabs do not poll in step. */
export function nextDelay(
  state: { hidden: boolean; focused: boolean },
  random: number,
): number | null {
  if (state.hidden) return null
  const jitter = Math.floor(random * 300)
  return (state.focused ? FOCUSED_DELAY : BACKGROUND_DELAY) + jitter
}
