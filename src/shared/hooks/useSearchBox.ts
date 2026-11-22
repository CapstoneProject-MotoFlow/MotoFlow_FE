/**
 * File: shared/hooks/useSearchBox.ts
 * Loại: HOOK DÙNG CHUNG — ô tìm kiếm trên danh sách.
 * Công dụng: giữ chữ đang gõ trong state cục bộ (không ghi URL từng phím, để IME tiếng Việt
 * không mất ký tự) và chỉ gọi onCommit sau khi dừng gõ 300 ms, hoặc ngay khi bấm Enter / kết thúc IME.
 * Khi giá trị ngoài (URL, ví dụ khi bấm Quay lại hoặc Xóa bộ lọc) đổi khác giá trị vừa commit thì
 * hủy lịch commit đang chờ và đồng bộ lại ô.
 *
 * Cách dùng: <input {...search} placeholder="…" />
 */
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type CompositionEvent,
  type KeyboardEvent,
  type MutableRefObject,
} from 'react'
import { createSearchCommitter, type SearchCommitter } from './searchCommit'

/** Tạo bộ hẹn commit một lần (trong sự kiện hoặc effect, không trong lúc render). */
function ensureCommitter(
  slot: MutableRefObject<SearchCommitter | null>,
  initial: string,
  onCommit: MutableRefObject<(value: string) => void>,
) {
  if (!slot.current)
    slot.current = createSearchCommitter({
      initial,
      onCommit: (value) => onCommit.current(value),
    })
  return slot.current
}

export function useSearchBox(
  external: string,
  onCommit: (value: string) => void,
) {
  const [text, setText] = useState(external)
  const commitRef = useRef(onCommit)
  const committerRef = useRef<SearchCommitter | null>(null)

  useEffect(() => {
    commitRef.current = onCommit
  })

  useEffect(() => {
    const committer = ensureCommitter(committerRef, external, commitRef)
    if (committer.isComposing() || committer.committed() === external) return
    committer.reset(external)
    setText(external)
  }, [external])

  useEffect(
    () => () => {
      committerRef.current?.dispose()
    },
    [],
  )

  // Trong sự kiện, committer đã được tạo ở effect đầu tiên; ensureCommitter chỉ là chốt an toàn.
  const commit = (initial: string) =>
    ensureCommitter(committerRef, initial, commitRef)

  return {
    value: text,
    onChange: (event: ChangeEvent<HTMLInputElement>) => {
      setText(event.target.value)
      commit(text).input(event.target.value)
    },
    onCompositionStart: () => commit(text).compositionStart(),
    onCompositionEnd: (event: CompositionEvent<HTMLInputElement>) =>
      commit(text).compositionEnd(event.currentTarget.value),
    onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter' && !event.nativeEvent.isComposing)
        commit(text).flush(event.currentTarget.value)
    },
  }
}
