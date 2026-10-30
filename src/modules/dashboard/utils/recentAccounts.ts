import type { DashboardAccount } from '../../../shared/types/account'
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
