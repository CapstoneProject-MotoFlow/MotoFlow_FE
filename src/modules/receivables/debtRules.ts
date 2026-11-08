import type { Preview } from './types'
/** Preserve the server allocation snapshot; never recompute debt priority in the browser. */
export function confirmedAllocations(preview: Preview) {
  const lines = preview.allocations.filter((line) => line.allocatedAmount > 0)
  if (
    !lines.length ||
    new Set(lines.map((l) => l.receivableId)).size !== lines.length ||
    lines.some(
      (l) =>
        !Number.isSafeInteger(l.allocatedAmount) ||
        !Number.isSafeInteger(l.remainingBefore) ||
        l.allocatedAmount > l.remainingBefore ||
        l.remainingAfter !== l.remainingBefore - l.allocatedAmount,
    ) ||
    lines.reduce((sum, l) => sum + l.allocatedAmount, 0) !== preview.amount
  )
    throw new Error('Phân bổ không hợp lệ. Vui lòng xem lại trước khi ghi.')
  return lines.map((l) => ({
    receivableId: l.receivableId,
    remainingBefore: l.remainingBefore,
    amount: l.allocatedAmount,
  }))
}
