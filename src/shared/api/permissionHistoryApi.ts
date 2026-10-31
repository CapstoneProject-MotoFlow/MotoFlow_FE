import axiosClient from './axiosClient'
import type { PermissionHistoryItem } from '../types/account'

/** Shared adapter for the existing per-account permission-history endpoint. */
export async function fetchPermissionHistory(accountId: number) {
  const response = await axiosClient.get<
    Omit<PermissionHistoryItem, 'accountId'>[]
  >(`/accounts/${accountId}/permission-history`)
  return response.data
}
