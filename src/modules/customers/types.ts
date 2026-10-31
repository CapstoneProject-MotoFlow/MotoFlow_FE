/**
 * File: modules/customers/types.ts
 * Loại: THÀNH PHẦN / XỬ LÝ HỖ TRỢ — không phải màn hình độc lập.
 * Công dụng: Kiểu Customer dùng trong module; chỉ mô tả cấu trúc, không gọi API.
 */
export type Customer = {
  id: number
  customerName: string
  phone: string | null
  address: string | null
  taxCode: string | null
  totalDebt: number
  debtAtOwnStore: number | null
  creditStatus: string
  createdAt: string
  updatedAt: string
}
