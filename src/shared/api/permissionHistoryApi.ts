/**
 * File: shared/api/permissionHistoryApi.ts
 * Loại: THÀNH PHẦN / XỬ LÝ HỖ TRỢ — không phải màn hình độc lập.
 * Công dụng: Adapter gọi lịch sử quyền một tài khoản; dùng chung giữa Admin và dashboard.
 */
import axiosClient from './axiosClient'
import type { PermissionHistoryItem } from '../types/account'

/** Shared adapter for the existing per-account permission-history endpoint. */
export async function fetchPermissionHistory(accountId: number) {
  const response = await axiosClient.get<
    Omit<PermissionHistoryItem, 'accountId'>[]
  >(`/accounts/${accountId}/permission-history`)
  return response.data
}
