/**
 * File: modules/dashboard/utils/recentAccounts.ts
 * Loại: THÀNH PHẦN / XỬ LÝ HỖ TRỢ — không phải màn hình độc lập.
 * Công dụng: Hàm chọn/sắp xếp tài khoản đăng nhập gần đây; xử lý giá trị ngày null và lựa chọn tài khoản.
 */
import type { DashboardAccount } from '../../../shared/types/account'
/** recentAccounts: Chọn và sắp xếp danh sách tài khoản đăng nhập gần đây theo lựa chọn hiện tại. */
export function recentAccounts(
  accounts: DashboardAccount[],
  selectedId: number | null,
) {
  if (selectedId !== null)
    return accounts.filter((account) => account.id === selectedId)
  return accounts
    .filter((account) => account.lastLoginAt)
    .sort((a, b) => b.lastLoginAt!.localeCompare(a.lastLoginAt!))
    .slice(0, 6)
}
