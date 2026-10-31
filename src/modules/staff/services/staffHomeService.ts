import { getHome } from '../../../shared/api/homeService'
export type StaffHome = {
  storeName: string | null
  shortcuts: { key: string; count: number }[]
  notifications: { unread: number } | null
}
export async function loadStaffHome() {
  return (await getHome()).data
}
