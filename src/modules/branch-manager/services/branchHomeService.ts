import { getHome } from '../../../shared/api/homeService'
export type BranchHome = {
  storeName: string | null
  shortcuts: { key: string; count: number }[]
}
export async function loadBranchHome() {
  return (await getHome()).data
}
