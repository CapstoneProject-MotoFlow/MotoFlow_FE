import { useState } from 'react'
import SearchableFilter from '../../shared/ui/SearchableFilter'
import { useInventoryData } from '../inventory/api'
import type { Page } from '../inventory/types'

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
  onSelect: (product: ProductOption) => void
}) {
  const [query, setQuery] = useState<string | null>(null)
  const products = useInventoryData<Page<ProductOption>>(
    '/products',
    { q: query?.trim(), status: 'ACTIVE', size: 10 },
    0,
    query !== null && !disabled,
  )
  const parts =
    query === null && selected
      ? [selected]
      : (products.data?.items.filter(
          (part) => !excludedIds.includes(part.id),
        ) ?? [])

  return (
    <div className="receiving-product-picker">
      <SearchableFilter
        label={label}
        value={selected ? String(selected.id) : ''}
        options={parts.map((part) => ({
          value: String(part.id),
          label: part.partName + ' · ' + part.sku,
        }))}
        searchPlaceholder="Tìm phụ tùng theo tên hoặc SKU"
        maxOptions={10}
        disabled={disabled}
        loading={products.loading}
        error={products.error}
        toggleOnClick
        onSearch={setQuery}
        onChange={(value) => {
          const part = parts.find((item) => String(item.id) === value)
          if (part) onSelect(part)
        }}
      />
    </div>
  )
}
