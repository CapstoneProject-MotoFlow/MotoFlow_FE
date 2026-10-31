import axiosClient from '../../../shared/api/axiosClient'
export type StaffHome = {
  storeName: string | null
  shortcuts: { key: string; count: number }[]
  notifications: { unread: number } | null
}
export async function loadStaffHome() {
  return (await axiosClient.get<StaffHome>('/home')).data
}
