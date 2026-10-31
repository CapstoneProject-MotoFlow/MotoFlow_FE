/**
 * File: shared/ui/HeaderSearch.tsx
 * Loại: THÀNH PHẦN GIAO DIỆN DÙNG CHUNG — không phải màn hình.
 * Công dụng: Ô tìm kiếm đưa lên vị trí header khi có vùng đích; hỗ trợ màn hình dùng tìm kiếm chung.
 */
import { useContext, useState } from 'react'
import { createPortal } from 'react-dom'
import Icon from './Icon'
import { HeaderSearchTarget } from './HeaderSearchTarget'

export type SearchItem = {
  id: string | number
  label: string
  meta?: string
  select: () => void
}
/** HeaderSearch: Ô tìm kiếm đưa lên vị trí header khi có vùng đích; hỗ trợ màn hình dùng tìm kiếm chung. */
export default function HeaderSearch({
  items,
  placeholder,
  loading = false,
  onClear,
}: {
  items: SearchItem[]
  placeholder: string
  loading?: boolean
  onClear?: () => void
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const target = useContext(HeaderSearchTarget)
  if (!target) return null
  const text = query.trim().toLocaleLowerCase('vi')
  const matches = items
    .filter((item) =>
      [item.label, item.meta].join(' ').toLocaleLowerCase('vi').includes(text),
    )
    .slice(0, 10)
  return createPortal(
    <div
      className="account-search"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
      }}
    >
      <Icon name="search" />
      <input
        type="search"
        aria-label={placeholder}
        placeholder={placeholder}
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value)
          setOpen(true)
          if (!event.target.value.trim()) onClear?.()
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setOpen(false)
          if (event.key === 'Enter' && matches[0] && text) {
            matches[0].select()
            setOpen(false)
          }
        }}
      />
      {open && text && (
        <div className="search-results">
          {loading ? (
            <p>Đang tải dữ liệu…</p>
          ) : matches.length ? (
            matches.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  item.select()
                  setQuery(item.label)
                  setOpen(false)
                }}
              >
                <span className="search-result-name">{item.label}</span>
                <span className="search-result-meta">{item.meta}</span>
              </button>
            ))
          ) : (
            <p>Không có kết quả phù hợp.</p>
          )}
        </div>
      )}
    </div>,
    target,
  )
}
