/**
 * File: shared/types/store.ts
 * Loại: THÀNH PHẦN / XỬ LÝ HỖ TRỢ — không phải màn hình độc lập.
 * Công dụng: Kiểu dữ liệu cửa hàng dùng nhiều module.
 */
export type DashboardStore = {
  id: number
  storeName: string
  address: string
  phone: string | null
  status: 'PLANNED' | 'ACTIVE' | 'INACTIVE'
  central: boolean
  managers: { id: number; fullName: string; phone: string | null }[]
  productsInStock?: number
}
