/** Admin-only dashboard content: account/store metrics, permission history, and recent logins. */
import { MetricCard, StoreStatusPanel } from './DashboardWidgets'
import type { DashboardData } from '../types/dashboardTypes'
import type { DashboardAccount, PermissionHistoryItem } from '../../../shared/types/account'
import { formatDate } from '../../../shared/utils/format'
import { Link } from 'react-router-dom'

import { roleNames } from '../../../shared/utils/roles'

export default function AdminDashboardOverview({ data, selectedAccount }: { data: DashboardData; selectedAccount: number | null }) {
  const activeAccounts = data.accounts.filter((account) => account.status === 'ACTIVE' && account.state === 'ACTIVE').length
  const lockedAccounts = data.accounts.filter((account) => account.status === 'LOCKED' || account.state === 'TEMPORARILY_LOCKED').length
  const activeStores = data.stores.filter((store) => store.status === 'ACTIVE').length
  const plannedStores = data.stores.filter((store) => store.status === 'PLANNED').length

  return <>
    <section className="metrics-grid" aria-label="Thống kê tổng quan">
      <MetricCard title="Tài khoản đang hoạt động" value={activeAccounts} icon="users" color="blue" href="#accounts" />
      <MetricCard title="Tài khoản đã khóa" value={lockedAccounts} icon="lock" color="red" href="#accounts" />
      <MetricCard title="Cửa hàng đang hoạt động" value={activeStores} icon="store" color="green" href="#stores" />
      <MetricCard title="Cửa hàng đang chuẩn bị" value={plannedStores} icon="clock" color="cyan" href="#stores" />
    </section>
    <section className="dashboard-columns">
      <RecentPermissionPanel history={data.permissionHistory} accounts={data.accounts} />
      <StoreStatusPanel stores={data.stores} />
    </section>
    <RecentLoginPanel accounts={data.accounts} selectedAccount={selectedAccount} />
  </>
}

function RecentPermissionPanel({ history, accounts }: { history: PermissionHistoryItem[]; accounts: DashboardAccount[] }) {
  const accountById = new Map(accounts.map((account) => [account.id, account]))
  return <section className="dashboard-panel history-panel" id="permission-history">
    <div className="panel-heading"><h2>Thay đổi phân quyền gần đây</h2><Link className="panel-action" to="/permission-history">Xem lịch sử</Link></div>
    {history.length ? <div className="table-scroll"><table>
      <thead><tr><th>Thời điểm</th><th>Tài khoản</th><th>Thay đổi</th><th>Người thực hiện</th></tr></thead>
      <tbody>{history.slice(0, 5).map((change) => {
        const account = accountById.get(change.accountId)
        return <tr key={`${change.accountId}-${change.id}`}>
          <td className="date-cell">{formatDate(change.changedAt)}</td>
          <td><strong>{account?.fullName || account?.username || `Tài khoản #${change.accountId}`}</strong><small>{account?.username}</small></td>
          <td><ChangeType change={change} /></td>
          <td><strong>{change.changedByName || '—'}</strong><small>{change.changedByName ? 'Admin' : ''}</small></td>
        </tr>
      })}</tbody>
    </table></div> : <p className="empty-state">Chưa có lịch sử phân quyền.</p>}
  </section>
}

function ChangeType({ change }: { change: PermissionHistoryItem }) {
  const changeTypes: Record<string, { label: string; tone: string; description: string }> = {
    ACCOUNT_CREATED: { label: 'Tạo tài khoản', tone: 'blue', description: '' },
    ROLE_CHANGED: { label: 'Đổi vai trò', tone: 'blue', description: `${change.oldValue || '—'} → ${change.newValue || '—'}` },
    STORE_CHANGED: { label: 'Đổi cửa hàng', tone: 'cyan', description: '' },
    PERMISSION_GRANTED: { label: 'Cấp quyền', tone: 'green', description: change.permissionCode || '' },
    PERMISSION_REVOKED: { label: 'Thu hồi quyền', tone: 'red', description: change.permissionCode || '' },
  }
  const detail = changeTypes[change.changeType] || { label: change.changeType, tone: 'blue', description: '' }
  return <><span className={`change-badge tone-${detail.tone}`}>{detail.label}</span>{detail.description && <small>{detail.description}</small>}</>
}

function RecentLoginPanel({ accounts, selectedAccount }: { accounts: DashboardAccount[]; selectedAccount: number | null }) {
  const recent = selectedAccount !== null ? accounts.filter(account => account.id === selectedAccount) : accounts.filter((account) => account.lastLoginAt).sort((a, b) => (b.lastLoginAt || '').localeCompare(a.lastLoginAt || '')).slice(0, 6)
  return <section className="dashboard-panel recent-login-panel" id="accounts">
    <div className="panel-heading"><h2>Tài khoản đăng nhập gần đây</h2><span className="panel-subtitle">Theo lần đăng nhập gần nhất</span></div>
    {recent.length ? <div className="table-scroll"><table>
      <thead><tr><th>Tài khoản</th><th>Vai trò</th><th>Đăng nhập lúc</th><th>Trạng thái</th></tr></thead>
      <tbody>{recent.map((account) => <tr key={account.id} id={`account-${account.id}`} className={selectedAccount === account.id ? 'search-selected-row' : undefined}>
        <td><strong>{account.fullName}</strong><small>{account.username}</small></td>
        <td>{roleNames[account.role] || account.role}</td>
        <td className="date-cell">{formatDate(account.lastLoginAt!)}</td>
        <td><span className={`status-badge account-${account.state.toLowerCase().replace('_', '-')}`}>{formatAccountState(account.state)}</span></td>
      </tr>)}</tbody>
    </table></div> : <p className="empty-state">Chưa có thông tin đăng nhập gần đây.</p>}
  </section>
}

function formatAccountState(state: DashboardAccount['state']) {
  return { ACTIVE: 'Đang hoạt động', LOCKED: 'Đã khóa', TEMPORARILY_LOCKED: 'Tạm khóa' }[state]
}
