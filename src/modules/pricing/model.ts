import type { AuthUser } from '../../shared/types/auth'
export type RoundingRule = 'NONE' | 'UP_100' | 'UP_500' | 'UP_1000'
export type PolicyState = 'ACTIVE' | 'SCHEDULED' | 'SUPERSEDED'
export type ProductStatus = 'ACTIVE' | 'DISCONTINUED'
export const canEditPrice = (u: AuthUser | null) =>
  u?.role === 'OWNER' ||
  (u?.role === 'BRANCH_MANAGER' &&
    !!u.permissions?.includes('RETAIL_PRICE_EDIT'))
export const today = () =>
  new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' })
export const money = (n: number | null | undefined) =>
  n == null ? '—' : n.toLocaleString('vi-VN') + ' ₫'
export const date = (s: string | null | undefined) =>
  s ? s.slice(0, 10).split('-').reverse().join('/') : '—'
export const percentValid = (v: string, max = 100) =>
  /^\d+(\.\d{1,2})?$/.test(v) && Number(v) <= max
export const priceValid = (v: string) =>
  /^\d+$/.test(v) && Number.isSafeInteger(Number(v)) && Number(v) > 0
export const stateNames: Record<string, string> = {
  ACTIVE: 'Đang áp dụng',
  SCHEDULED: 'Chờ áp dụng',
  SUPERSEDED: 'Đã thay thế',
}
export const roundingNames: Record<string, string> = {
  NONE: 'Không làm tròn',
  UP_100: 'Làm tròn lên 100 ₫',
  UP_500: 'Làm tròn lên 500 ₫',
  UP_1000: 'Làm tròn lên 1.000 ₫',
}
export type Price = {
  productId: number
  sku: string
  partName: string
  categoryId: number | null
  categoryName: string | null
  baseUnit: string
  status: ProductStatus
  currentPrice: number | null
  currentFrom: string | null
  scheduledPrice: number | null
  scheduledFrom: string | null
  suggestedPrice: number | null
  purchaseBasis: {
    latestPurchasePrice: number | null
    receivedDate: string
    markupRate: number
    roundingRule: RoundingRule
  } | null
}
export type Version = {
  id: number
  unitPrice: number
  change: number | null
  effectiveFrom: string
  effectiveTo: string | null
  state: PolicyState
  fromSuggestion: boolean | null
  reason: string | null
  setByName: string
  setAt: string
}
export type RateVersion = {
  effectiveTo?: string | null
  id: number
  rate: number
  effectiveFrom: string
  state: PolicyState
  setByName: string
  setAt: string
}
export type Limit = {
  current: RateVersion | null
  scheduled: RateVersion | null
  history: RateVersion[]
}
export type Limits = { discountThreshold: Limit; minimumMargin: Limit }
export type Category = {
  vehicleType?: string
  id: number
  categoryName: string
  children?: Category[]
}
export const flattenCategories = (rows: Category[]): Category[] =>
  rows.flatMap((r) => [r, ...flattenCategories(r.children ?? [])])
export type Config = {
  effectiveFrom: string
  roundingRule: RoundingRule
  categories: {
    categoryId: number
    categoryName: string
    vehicleType?: string
    markupRate: number
  }[]
  products: {
    productId: number
    sku: string
    partName: string
    markupRate: number
  }[]
  setByName: string
  setAt: string
}
export type Rules = { current: Config | null; scheduled: Config | null }
export type Preview = {
  productId: number
  sku: string
  partName: string
  currentPrice: number | null
  latestPurchasePrice: number | null
  receivedDate: string | null
  markupRate: number | null
  suggestedPrice: number | null
}
