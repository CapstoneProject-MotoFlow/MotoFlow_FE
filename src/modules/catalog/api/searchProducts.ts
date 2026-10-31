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
    model = normalize(modelText),
    brand = normalize(String(params.brand || ''))
  if (!text && !vehicle && !model && !brand)
    return (await axiosClient.get<Page>('/products', { params, signal })).data
  const types = {
    MOTORCYCLE: 'Xe máy',
    BICYCLE: 'Xe đạp',
    E_MOTORCYCLE: 'Xe máy điện',
    E_BICYCLE: 'Xe đạp điện',
  }
  const categoryIds = text
    ? categories
        .filter((c) => normalize(c.categoryName).includes(text))
        .map((c) => c.id)
    : [undefined]
  const vehicleIds = vehicle
    ? Object.entries(types)
        .filter(([, label]) => normalize(label).includes(vehicle))
        .map(([id]) => id)
    : [undefined]
  const modelIds = model
    ? models
        .filter((m) =>
          normalize(m.manufacturer + ' ' + m.modelName).includes(model),
        )
        .map((m) => m.id)
    : [undefined]
  const items = new Map<number, DashboardProduct>()
  for (const categoryId of categoryIds)
    for (const vehicleType of vehicleIds)
      for (const vehicleModelId of modelIds) {
        let page = 0
        let loaded = 0
        while (true) {
          const { data } = await axiosClient.get<Page>('/products', {
            params: {
              ...params,
              brand: undefined,
              categoryId,
              vehicleType,
              vehicleModelId,
              page,
              size: 100,
            },
            signal,
          })
          data.items.forEach((item) => items.set(item.id, item))
          loaded += data.items.length
          if (!data.items.length || loaded >= data.totalItems) break
          page++
        }
      }
  const all = [...items.values()]
    .filter((item) => !brand || normalize(item.brand || '').includes(brand))
    .sort((a, b) => a.partName.localeCompare(b.partName, 'vi') || a.id - b.id)
  const page = Number(params.page || 0),
    size = Number(params.size || 20)
  return {
    items: all.slice(page * size, (page + 1) * size),
    totalItems: all.length,
  }
}
