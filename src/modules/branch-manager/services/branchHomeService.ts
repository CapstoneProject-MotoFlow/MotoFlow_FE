/**
 * File: modules/branch-manager/services/branchHomeService.ts
 * Loại: THÀNH PHẦN / XỬ LÝ HỖ TRỢ — không phải màn hình độc lập.
 * Công dụng: Kiểu BranchHome và hàm tải dữ liệu home qua service dùng chung.
 */
import { getHome } from '../../../shared/api/homeService'
export type BranchHome = {
  storeName: string | null
  shortcuts: { key: string; count: number }[]
}
export async function loadBranchHome() {
  return (await getHome()).data
}
