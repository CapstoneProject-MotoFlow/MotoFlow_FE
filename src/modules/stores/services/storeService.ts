import axiosClient from '../../../shared/api/axiosClient'
import type { DashboardStore } from '../../../shared/types/store'

export type StorePayload = {
  storeName: string
  address: string
  phone: string
  warehouseName: string
  central: boolean
  status?: DashboardStore['status']
}

export async function listStores(params?: { q?: string; status?: string; central?: boolean }) {
  return (await axiosClient.get<DashboardStore[]>('/stores', { params })).data
}
export async function saveStoreRequest(id: number | null, payload: StorePayload) {
  if (id !== null) return (await axiosClient.put<DashboardStore>(`/stores/${id}`, payload)).data
  return (await axiosClient.post<DashboardStore>('/stores', payload)).data
}
