export type AccountRole = 'ADMIN' | 'OWNER' | 'BRANCH_MANAGER' | 'STAFF'
export type AccountState = 'ACTIVE' | 'TEMPORARILY_LOCKED' | 'LOCKED'
export type DashboardAccount = {
  id: number; username: string; fullName: string; role: AccountRole
  status: 'ACTIVE' | 'LOCKED'; state: AccountState; lastLoginAt: string | null
}
export type Account = DashboardAccount & {
  phone: string | null; email: string | null; storeId: number | null; storeName: string | null
  permissions: string[]; mustChangePassword: boolean
}
export type PermissionHistoryItem = {
  id: number; changeType: string; permissionCode: string | null; oldValue: string | null
  newValue: string | null; reason: string | null; changedBy: number; changedByName: string
  changedAt: string; accountId: number
}
