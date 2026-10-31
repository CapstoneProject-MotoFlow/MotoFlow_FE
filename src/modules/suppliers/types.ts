/**
 * File: modules/suppliers/types.ts
 * Loại: THÀNH PHẦN / XỬ LÝ HỖ TRỢ — không phải màn hình độc lập.
 * Công dụng: Kiểu dữ liệu nhà cung cấp và dữ liệu liên quan.
 */
export type Supplier = {
  id: number
  supplierCode: string
  supplierName: string
  contactName: string | null
  phone: string | null
  email: string | null
  address: string | null
  taxCode: string | null
  status: 'ACTIVE' | 'INACTIVE'
}
