import axiosClient from '../../shared/api/axiosClient'
import type { Supplier } from './types'
export const supplierService = {
  list: async (params: { q: string; status: string; page: number }) =>
    (
      await axiosClient.get<{ items: Supplier[]; totalItems: number }>(
        '/suppliers',
        { params: { ...params, status: params.status || undefined, size: 20 } },
      )
    ).data,
  save: async (id: number | undefined, values: object) =>
    id
      ? axiosClient.put(`/suppliers/${id}`, values)
      : axiosClient.post('/suppliers', values),
  status: async (supplier: Supplier) =>
    axiosClient.post(
      `/suppliers/${supplier.id}/${supplier.status === 'ACTIVE' ? 'deactivate' : 'activate'}`,
    ),
}
export function apiMessage(error: unknown) {
  return (
    (error as { response?: { data?: { message?: string } } }).response?.data
      ?.message || 'Không thực hiện được. Vui lòng thử lại.'
  )
}
