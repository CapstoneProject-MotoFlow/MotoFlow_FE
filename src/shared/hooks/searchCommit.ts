/**
 * File: shared/hooks/searchCommit.ts
 * Loại: XỬ LÝ HỖ TRỢ — thuần TypeScript, không phụ thuộc React (để test bằng node).
 * Công dụng: quyết định khi nào một ô tìm kiếm được đẩy lên URL (onCommit):
 * - gõ bình thường: đợi `delay` ms rồi mới commit (debounce);
 * - đang gõ IME (Telex/VNI, tiếng Trung/Nhật…): không commit giữa compositionstart và compositionend;
 * - compositionend hoặc Enter: commit ngay;
 * - không commit lại giá trị vừa commit (Safari còn bắn input sau compositionend);
 * - khi giá trị ngoài đổi (ví dụ "Xóa bộ lọc"): reset() hủy lịch chờ để chữ cũ không ghi đè.
 */

export type SearchCommitter = {
  /** Gọi khi người dùng gõ. Hẹn commit sau `delay` ms; không hẹn gì khi đang compose. */
  input(value: string): void
  compositionStart(): void
  compositionEnd(value: string): void
  /** Commit ngay (Enter). Bỏ qua khi đang compose. */
  flush(value: string): void
  isComposing(): boolean
  /** Giá trị đã commit (hoặc đặt bởi reset) gần nhất. */
  committed(): string | undefined
  /** Đặt lại giá trị đã commit theo nguồn ngoài và hủy lịch commit đang chờ; không gọi onCommit. */
  reset(value: string): void
  /** Hủy lịch commit đang chờ (khi unmount). */
  dispose(): void
}

export type SearchCommitOptions = {
  onCommit: (value: string) => void
  /** Giá trị ban đầu đã có trên URL; commit đúng giá trị này sẽ bị bỏ qua. */
  initial?: string
  delay?: number
  schedule?: (run: () => void, ms: number) => unknown
  cancel?: (handle: unknown) => void
}

export function createSearchCommitter(
  options: SearchCommitOptions,
): SearchCommitter {
  const delay = options.delay ?? 300
  const schedule =
    options.schedule ?? ((run, ms) => globalThis.setTimeout(run, ms))
  const cancel =
    options.cancel ??
    ((handle) => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>))
  let timer: unknown = null
  let composing = false
  let last: string | undefined = options.initial

  function clear() {
    if (timer !== null) {
      cancel(timer)
      timer = null
    }
  }

  function emit(value: string) {
    if (value === last) return
    last = value
    options.onCommit(value)
  }

  return {
    input(value) {
      if (composing) return
      clear()
      timer = schedule(() => {
        timer = null
        if (!composing) emit(value)
      }, delay)
    },
    compositionStart() {
      composing = true
      clear()
    },
    compositionEnd(value) {
      composing = false
      clear()
      emit(value)
    },
    flush(value) {
      if (composing) return
      clear()
      emit(value)
    },
    isComposing: () => composing,
    committed: () => last,
    reset(value) {
      clear()
      last = value
    },
    dispose() {
      clear()
    },
  }
}
