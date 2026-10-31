/**
 * File: modules/suppliers/supplierService.ts
 * Loại: THÀNH PHẦN / XỬ LÝ HỖ TRỢ — không phải màn hình độc lập.
 * Công dụng: Gọi API nhà cung cấp; apiMessage chuẩn hóa thông báo lỗi API để màn hình hiển thị.
 */
import axiosClient from '../../shared/api/axiosClient'
import type { Supplier } from './types'
export const supplierService = {
  nameExists: async (name: string, exceptId?: number) => {
    const normalize = (value: string) =>
      value.trim().normalize('NFC').toLocaleLowerCase('vi')
    let page = 0
    let loaded = 0
    while (true) {
      const { data } = await axiosClient.get<{
        items: Supplier[]
        totalItems: number
      }>('/suppliers', {
        params: { q: name, page, size: 100 },
      })
      if (
        data.items.some(
          (item) =>
            item.id !== exceptId &&
            normalize(item.supplierName) === normalize(name),
        )
      )
        return true
      loaded += data.items.length
      if (!data.items.length || loaded >= data.totalItems) return false
      page++
    }
  },
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
