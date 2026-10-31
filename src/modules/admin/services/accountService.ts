import axiosClient from '../../../shared/api/axiosClient'
import type { Account, DashboardAccount } from '../../../shared/types/account'
import type { DashboardStore } from '../../../shared/types/store'
import { fetchPermissionHistory } from '../../../shared/api/permissionHistoryApi'

export type CreateAccountResult = {
  account: Account
  temporaryPassword: string
}
export type PermissionUpdate = {
  role: Account['role']
  storeId: number | null
  catalogEdit: boolean
  reason: string
  releaseAssignedTasks: boolean
}

export async function listAccounts() {
  return (await axiosClient.get<Account[]>('/accounts')).data
}
export async function listAccountSummaries() {
  return (await axiosClient.get<DashboardAccount[]>('/accounts')).data
}
export async function listStores() {
  return (await axiosClient.get<DashboardStore[]>('/stores')).data
}
export async function getAccount(id: number) {
  return (await axiosClient.get<Account>(`/accounts/${id}`)).data
}
export async function updatePermissions(id: number, payload: PermissionUpdate) {
  return (
    await axiosClient.put<Account>(`/accounts/${id}/permissions`, payload)
  ).data
}
export async function createAccount(payload: {
  fullName: string
  username: string
  phone: string
  email: string
  role: Account['role']
  storeId: number | null
}) {
  return (await axiosClient.post<CreateAccountResult>('/accounts', payload))
    .data
}
export async function resetAccountPassword(id: number, reason: string) {
  return (
    await axiosClient.post<{ temporaryPassword: string }>(
      `/accounts/${id}/reset-password`,
      { reason },
    )
  ).data
}
export async function changeAccountLock(
  id: number,
  action: 'lock' | 'unlock',
  reason: string,
) {
  await axiosClient.post(`/accounts/${id}/${action}`, { reason })
}
export const listPermissionHistory = fetchPermissionHistory
