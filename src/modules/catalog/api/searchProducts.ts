import axiosClient from '../../../shared/api/axiosClient'
import type { DashboardProduct } from '../../dashboard/types/dashboardTypes'

export type Category = {
  id: number
  categoryName: string
  vehicleType: string
  children?: Category[]
  label?: string
}
export const vehicleTypes: Record<string, string> = {
  MOTORCYCLE: 'Xe máy',
  BICYCLE: 'Xe đạp',
  E_MOTORCYCLE: 'Xe máy điện',
  E_BICYCLE: 'Xe đạp điện',
}
export function categoryOptions(
  nodes: Category[],
  parents: string[] = [],
): Category[] {
  return nodes.flatMap((node) => {
    const path = [...parents, node.categoryName]
    return [
      {
        ...node,
        label: [
          vehicleTypes[node.vehicleType] || node.vehicleType,
          ...path,
        ].join(' › '),
      },
      ...categoryOptions(node.children || [], path),
    ]
  })
}
export function visibleCategories(categories: Category[], vehicleText: string) {
  const type = Object.entries(vehicleTypes).find(
    ([, label]) => normalize(label) === normalize(vehicleText),
  )?.[0]
  return categories.filter((c) => !type || c.vehicleType === type)
}
type Page = {
  items: DashboardProduct[]
  totalItems: number
  filterPending?: boolean
}
const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim()

export async function searchProducts(
  params: Record<string, unknown>,
  categoryText: string,
  categories: Category[],
  signal: AbortSignal,
  vehicleText = '',
  modelText = '',
  models: { id: number; manufacturer: string; modelName: string }[] = [],
): Promise<Page> {
  const text = normalize(categoryText)
  const vehicle = normalize(vehicleText),
    model = normalize(modelText)
  const types = {
    MOTORCYCLE: 'Xe máy',
    BICYCLE: 'Xe đạp',
    E_MOTORCYCLE: 'Xe máy điện',
    E_BICYCLE: 'Xe đạp điện',
  }
  const matches = visibleCategories(categories, vehicleText).filter(
    (c) => normalize(c.label || c.categoryName) === text,
  )
  const category = matches.length === 1 ? matches[0] : undefined
  const type = Object.entries(types).find(
    ([, label]) => normalize(label) === vehicle,
  )
  const vehicleModel = models.find(
    (m) => normalize(m.manufacturer + ' ' + m.modelName) === model,
  )
  // Partial input filters the suggestions; only a resolved option filters products.
  if ((text && !category) || (vehicle && !type) || (model && !vehicleModel))
    return { items: [], totalItems: 0, filterPending: true }
  return (
    await axiosClient.get<Page>('/products', {
      params: {
        ...params,
        categoryId: category?.id,
        vehicleType: type?.[0],
        vehicleModelId: vehicleModel?.id,
      },
      signal,
    })
  ).data
}
