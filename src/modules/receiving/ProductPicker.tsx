import BarcodeScan from '../operations/BarcodeScan'
import { useEffect, useId, useState } from 'react'
import axiosClient from '../../shared/api/axiosClient'
import { apiMessage } from '../suppliers/supplierService'

export type ProductOption = { id: number; sku: string; partName: string }

export default function ProductPicker({
  selected,
  excludedIds,
  label,
  disabled,
  onSelect,
}: {
  selected?: ProductOption
  excludedIds: number[]
  label: string
  disabled: boolean
  onSelect: (product?: ProductOption) => void
}) {
  const listId = useId()
  const [query, setQuery] = useState<string>()
  const [open, setOpen] = useState(false)
  const [result, setResult] = useState<{
    query: string
    items: ProductOption[]
    error?: string
  }>()
  const text = query ?? ''
  useEffect(() => {
    if (!open || !text.trim() || disabled) return
    const controller = new AbortController()
    const timer = setTimeout(() => {
      void axiosClient
        .get<{ items: ProductOption[] }>('/products', {
          params: { q: text.trim(), status: 'ACTIVE', size: 20 },
          signal: controller.signal,
        })
        .then(({ data }) => {
          if (!controller.signal.aborted)
            setResult({ query: text, items: data.items })
        })
        .catch((error) => {
          if (!controller.signal.aborted)
            setResult({ query: text, items: [], error: apiMessage(error) })
        })
    }, 250)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [text, open, disabled])
  const current = result?.query === text ? result : undefined
  return (
    <div
      className="receiving-product-picker"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
      }}
    >
      <BarcodeScan
        disabled={disabled}
        onFound={(p) => {
          if (excludedIds.includes(p.productId)) {
            setResult({
              query: text,
              items: [],
              error: 'Phụ tùng đã có trong phiếu.',
            })
            return
          }
          onSelect({ id: p.productId, sku: p.sku, partName: p.partName })
          setQuery(undefined)
          setOpen(false)
        }}
      />
      <input
        role="combobox"
        aria-label={label}
        aria-expanded={open && !!text.trim()}
        aria-controls={listId}
        aria-autocomplete="list"
        value={
          query ?? (selected ? selected.partName + ' · ' + selected.sku : '')
        }
        disabled={disabled}
        placeholder="Tìm phụ tùng theo tên hoặc mã"
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value)
          setOpen(true)
          onSelect(undefined)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setOpen(false)
          if (event.key === 'Enter') {
            event.preventDefault()
            const item = current?.items.find(
              (item) => !excludedIds.includes(item.id),
            )
            if (item) {
              onSelect(item)
              setQuery(undefined)
              setOpen(false)
            }
          }
        }}
      />
      {open && !!text.trim() && (
        <div
          className="receiving-product-results"
          id={listId}
          role="listbox"
          aria-label="Kết quả phụ tùng"
        >
          {!current ? (
            <p role="status">Đang tìm…</p>
          ) : current.error ? (
            <p role="alert">{current.error}</p>
          ) : !current.items.length ? (
            <p>Không tìm thấy phụ tùng.</p>
          ) : (
            current.items.map((product) => (
              <button
                key={product.id}
                type="button"
                role="option"
                aria-selected={selected?.id === product.id}
                disabled={excludedIds.includes(product.id)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onSelect(product)
                  setQuery(undefined)
                  setOpen(false)
                }}
              >
                {product.partName} · {product.sku}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
