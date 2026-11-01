import axiosClient from '../../../shared/api/axiosClient'
import type { DashboardProduct } from '../../dashboard/types/dashboardTypes'

type Page = { items: DashboardProduct[]; totalItems: number }
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
  categories: { id: number; categoryName: string }[],
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
  const category = categories.find((c) => normalize(c.categoryName) === text)
  const type = Object.entries(types).find(
    ([, label]) => normalize(label) === vehicle,
  )
  const vehicleModel = models.find(
    (m) => normalize(m.manufacturer + ' ' + m.modelName) === model,
  )
  // Partial input filters the suggestions; only a resolved option filters products.
  if ((text && !category) || (vehicle && !type) || (model && !vehicleModel))
    return { items: [], totalItems: 0 }
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
