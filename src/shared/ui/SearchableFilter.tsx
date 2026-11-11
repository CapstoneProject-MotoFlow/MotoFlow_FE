import { useEffect, useId, useState } from 'react'
import './searchable-filter.css'

type Option = { value: string; label: string }

function searchText(text: string) {
  return text
    .toLocaleLowerCase('vi')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replaceAll('đ', 'd')
}

export default function SearchableFilter({
  label,
  value,
  options,
  disabled,
  maxOptions,
  onSearch,
  searchPlaceholder,
  loading,
  onChange,
}: {
  label: string
  value: string
  options: Option[]
  disabled?: boolean
  maxOptions?: number
  onSearch?: (query: string | null) => void
  searchPlaceholder?: string
  loading?: boolean
  onChange: (value: string) => void
}) {
  const listId = useId()
  const [query, setQuery] = useState<string | null>(null)
  const [active, setActive] = useState(-1)
  const open = query !== null && !disabled
  const selected = options.find((option) => option.value === value)
  const text = searchText(query?.trim() ?? '')
  const results = (
    onSearch
      ? options
      : options.filter((option) => searchText(option.label).includes(text))
  ).slice(0, maxOptions)
  const activeId = open && results[active] ? `${listId}-${active}` : undefined

  useEffect(() => {
    if (activeId)
      document.getElementById(activeId)?.scrollIntoView({ block: 'nearest' })
  }, [activeId])

  function close() {
    updateQuery(null)
  }

  function updateQuery(value: string | null) {
    setQuery(value)
    setActive(-1)
    onSearch?.(value)
  }

  function choose(option: Option) {
    close()
    onChange(option.value)
  }

  return (
    <div className="searchable-filter">
      <input
        role="combobox"
        aria-label={label}
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={activeId}
        aria-autocomplete="list"
        autoComplete="off"
        disabled={disabled}
        placeholder={
          searchPlaceholder ??
          (open ? `Tìm ${label.toLocaleLowerCase('vi')}…` : label)
        }
        value={open ? (query ?? '') : (selected?.label ?? '')}
        onFocus={() => updateQuery('')}
        onClick={() => {
          if (!open) updateQuery('')
        }}
        onBlur={close}
        onChange={(event) => updateQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && open) {
            event.preventDefault()
            close()
          }
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            if (!open) updateQuery('')
            setActive((index) =>
              event.key === 'ArrowDown'
                ? Math.min(index + 1, results.length - 1)
                : index < 0
                  ? results.length - 1
                  : Math.max(index - 1, 0),
            )
          }
          if (event.key === 'Enter' && open) {
            event.preventDefault()
            const option = results[Math.max(active, 0)]
            if (option) choose(option)
          }
        }}
      />
      <span className="searchable-filter-caret" aria-hidden="true" />
      {open && (
        <div className="searchable-filter-menu">
          <ul id={listId} role="listbox" aria-label={label}>
            {results.map((option, index) => (
              <li
                id={`${listId}-${index}`}
                key={option.value}
                role="option"
                aria-selected={option.value === value}
                data-active={index === active}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(option)}
              >
                {option.label}
              </li>
            ))}
          </ul>
          {(loading || !results.length) && (
            <p role="status">
              {loading ? 'Đang tìm…' : 'Không tìm thấy kết quả.'}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
