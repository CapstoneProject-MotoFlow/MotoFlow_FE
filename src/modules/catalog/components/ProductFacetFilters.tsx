import SearchableFilter from '../../../shared/ui/SearchableFilter'
import {
  vehicleTypes,
  visibleCategories,
  type Category,
} from '../api/searchProducts'

const vehicleOptions = Object.values(vehicleTypes).map((label) => ({
  value: label,
  label,
}))

export default function ProductFacetFilters({
  categories,
  models,
  vehicle,
  category,
  model,
  onVehicle,
  onCategory,
  onModel,
}: {
  categories: Category[]
  models: { manufacturer: string; modelName: string }[]
  vehicle: string
  category: string
  model: string
  onVehicle: (value: string) => void
  onCategory: (value: string) => void
  onModel: (value: string) => void
}) {
  const modelNames = new Set(
    models.map((item) => item.manufacturer + ' ' + item.modelName),
  )
  return (
    <>
      <SearchableFilter
        label="Loại xe"
        value={vehicle}
        options={[{ value: '', label: 'Mọi loại xe' }, ...vehicleOptions]}
        onChange={onVehicle}
      />
      <SearchableFilter
        label="Nhóm phụ tùng"
        value={category}
        options={[
          { value: '', label: 'Mọi nhóm phụ tùng' },
          ...visibleCategories(categories, vehicle).map((item) => {
            const label = item.label ?? item.categoryName
            return { value: label, label }
          }),
        ]}
        onChange={onCategory}
      />
      <SearchableFilter
        label="Dòng xe"
        value={model}
        options={[
          { value: '', label: 'Mọi dòng xe' },
          ...Array.from(modelNames, (label) => ({ value: label, label })),
        ]}
        onChange={onModel}
      />
    </>
  )
}
