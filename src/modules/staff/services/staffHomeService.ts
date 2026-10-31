/**
 * File: modules/staff/services/staffHomeService.ts
 * Loại: THÀNH PHẦN / XỬ LÝ HỖ TRỢ — không phải màn hình độc lập.
 * Công dụng: Kiểu StaffHome và hàm tải home dùng chung.
 */
import { getHome } from '../../../shared/api/homeService'
export type StaffHome = {
  storeName: string | null
  shortcuts: { key: string; count: number }[]
  notifications: { unread: number } | null
}
export async function loadStaffHome() {
  return (await getHome()).data
}
