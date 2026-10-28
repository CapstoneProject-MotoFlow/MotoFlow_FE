/**
 * Admin account screen: loads accounts/stores, handles search and filters,
 * creates accounts, changes catalog permission, resets passwords and locks users.
 * Shared dashboard navigation and API client are imported rather than duplicated.
 */
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import axios from 'axios'
import { Link } from 'react-router-dom'
import { useAuth } from '../../../shared/hooks/useAuth'
import { default as DashboardIcon } from '../../../shared/ui/Icon'
import type { AuthUser } from '../../../shared/types/auth'
import type { Account, AccountRole } from '../../../shared/types/account'
import type { DashboardStore } from '../../../shared/types/store'
import { changeAccountLock, createAccount as createAccountRequest, getAccount, listAccounts, listStores, resetAccountPassword, updatePermissions } from '../services/accountService'
import '../admin.css'

type CreatedAccount = { account: Account; temporaryPassword: string; kind: 'created' | 'reset' }
type AccountForm = { fullName: string; username: string; phone: string; email: string; role: AccountRole; storeId: string }
type PermissionForm = { role: AccountRole; storeId: string; catalogEdit: boolean; reason: string }
type AccountConfirmation = { account: Account; action: 'lock' | 'unlock' | 'reset' }
type Tab = 'ALL' | 'ACTIVE' | 'LOCKED'

const roleLabels: Record<AccountRole, string> = { ADMIN: 'Admin', OWNER: 'Owner', BRANCH_MANAGER: 'Branch Manager', STAFF: 'Staff' }
const emptyForm: AccountForm = { fullName: '', username: '', phone: '', email: '', role: 'STAFF', storeId: '' }

export default function AccountsPage() {
  const { user: authenticatedUser } = useAuth()
  const user = authenticatedUser as AuthUser
  const [accounts, setAccounts] = useState<Account[]>([])
  const [stores, setStores] = useState<DashboardStore[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [storeFilter, setStoreFilter] = useState('')
  const [tab, setTab] = useState<Tab>('ALL')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState<AccountForm>(emptyForm)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [created, setCreated] = useState<CreatedAccount | null>(null)
  const [editingPermission, setEditingPermission] = useState<Account | null>(null)
  const [permissionForm, setPermissionForm] = useState<PermissionForm | null>(null)
  const [permissionLoading, setPermissionLoading] = useState(false)
  const [permissionSaving, setPermissionSaving] = useState(false)
  const [permissionError, setPermissionError] = useState('')
  const [confirmation, setConfirmation] = useState<AccountConfirmation | null>(null)
  const [notice, setNotice] = useState('')
  const [workingId, setWorkingId] = useState<number | null>(null)
  const [page, setPage] = useState(1)

  async function loadAccounts() {
    setError('')
    try {
      const [accountList, storeList] = await Promise.all([listAccounts(), listStores()])
      setAccounts(accountList)
      setStores(storeList)
    } catch (requestError) {
      const message = axios.isAxiosError(requestError) ? requestError.response?.data?.message : undefined
      setError(typeof message === 'string' ? message : 'Không tải được tài khoản. Vui lòng kiểm tra backend và quyền Admin.')
    } finally { setLoading(false) }
  }

  useEffect(() => { void loadAccounts() }, [])

  const counts = useMemo(() => ({
    ALL: accounts.length,
    ACTIVE: accounts.filter((account) => account.state === 'ACTIVE').length,
    LOCKED: accounts.filter((account) => account.state !== 'ACTIVE').length,
  }), [accounts])
  const filtered = useMemo(() => accounts.filter((account) => {
    const search = query.trim().toLocaleLowerCase('vi')
    const matchesQuery = !search || [account.fullName, account.username, account.phone, account.email].some((value) => value?.toLocaleLowerCase('vi').includes(search))
    const matchesState = tab === 'ALL' || (tab === 'ACTIVE' ? account.state === 'ACTIVE' : account.state !== 'ACTIVE')
    return matchesQuery && matchesState && (!roleFilter || account.role === roleFilter) && (!storeFilter || String(account.storeId) === storeFilter)
  }), [accounts, query, tab, roleFilter, storeFilter])
  const pageSize = 8
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize)

  function openCreate() { setForm({ ...emptyForm }); setFormError(''); setCreated(null); setModal(true) }
  function closeModal() { if (!saving) setModal(false) }

  async function openPermissionEditor(account: Account) {
    setEditingPermission(account)
    setPermissionForm(null)
    setPermissionError('')
    setPermissionLoading(true)
    try {
      const detail = await getAccount(account.id)
      setEditingPermission(detail)
      setPermissionForm({
        role: detail.role,
        storeId: detail.storeId === null ? '' : String(detail.storeId),
        catalogEdit: detail.permissions.includes('CATALOG_EDIT'),
        reason: '',
      })
    } catch (requestError) {
      setPermissionError(getErrorMessage(requestError, 'Không tải được phân quyền tài khoản.'))
    } finally { setPermissionLoading(false) }
  }

  async function savePermissions(releaseAssignedTasks = false) {
    if (!editingPermission || !permissionForm) return
    const needsStore = ['BRANCH_MANAGER', 'STAFF'].includes(permissionForm.role)
    if (needsStore && !permissionForm.storeId) {
      setPermissionError('Vai trò này cần được gán một cửa hàng.')
      return
    }
    setPermissionError('')
    setPermissionSaving(true)
    try {
      const updatedAccount = await updatePermissions(editingPermission.id, {
        role: permissionForm.role,
        storeId: needsStore ? Number(permissionForm.storeId) : null,
        catalogEdit: permissionForm.role === 'BRANCH_MANAGER' && permissionForm.catalogEdit,
        reason: permissionForm.reason.trim(),
        releaseAssignedTasks,
      })
      setAccounts((current) => current.map((account) => account.id === updatedAccount.id ? updatedAccount : account))
      setEditingPermission(null)
      setPermissionForm(null)
      setNotice('Đã cập nhật phân quyền tài khoản.')
    } catch (requestError) {
      if (axios.isAxiosError(requestError) && requestError.response?.status === 409) {
        const data = requestError.response.data as { code?: string; message?: string; detail?: string }
        if (data.code === 'MSG18' && !releaseAssignedTasks) {
          const message = typeof data.message === 'string' ? data.message : (typeof data.detail === 'string' ? data.detail : 'Tài khoản còn các chứng từ đang được giao. Nếu tiếp tục, các chứng từ sẽ trở về trạng thái chờ giao việc.')
          if (window.confirm(`${message}\n\nBạn có muốn tiếp tục thay đổi phân quyền không?`)) {
            setPermissionSaving(false)
            await savePermissions(true)
            return
          }
        } else setPermissionError(getErrorMessage(requestError, 'Không thể cập nhật phân quyền.'))
      } else setPermissionError(getErrorMessage(requestError, 'Không thể cập nhật phân quyền.'))
    } finally { setPermissionSaving(false) }
  }

  async function createAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setFormError('')
    if (['STAFF', 'BRANCH_MANAGER'].includes(form.role) && !form.storeId) { setFormError('Vui lòng chọn cửa hàng làm việc.'); return }
    setSaving(true)
    try {
      const createdAccount = await createAccountRequest({
        fullName: form.fullName.trim(), username: form.username.trim(), phone: form.phone.trim(), email: form.email.trim(),
        role: form.role, storeId: ['STAFF', 'BRANCH_MANAGER'].includes(form.role) ? Number(form.storeId) : null,
      })
      setCreated({ ...createdAccount, kind: 'created' })
      await loadAccounts()
    } catch (requestError) { setFormError(getErrorMessage(requestError, 'Không tạo được tài khoản. Vui lòng kiểm tra thông tin và thử lại.')) }
    finally { setSaving(false) }
  }

  async function toggleCatalogPermission(account: Account) {
    const allowed = !account.permissions.includes('CATALOG_EDIT')
    if (!window.confirm(`${allowed ? 'Cấp' : 'Thu hồi'} quyền sửa danh mục ${allowed ? 'cho' : 'của'} ${account.fullName}?`)) return
    setWorkingId(account.id)
    try {
      await updatePermissions(account.id, {
        role: account.role, storeId: account.storeId, catalogEdit: allowed,
        reason: allowed ? 'Cấp quyền từ danh sách tài khoản' : 'Thu hồi quyền từ danh sách tài khoản', releaseAssignedTasks: false,
      })
      await loadAccounts(); setNotice('Đã cập nhật quyền sửa danh mục.')
    } catch (requestError) { setNotice(getErrorMessage(requestError, 'Không thể cập nhật quyền tài khoản.')) }
    finally { setWorkingId(null) }
  }

  function setLocked(account: Account) {
    setConfirmation({ account, action: account.state === 'ACTIVE' ? 'lock' : 'unlock' })
  }

  function resetPassword(account: Account) {
    setConfirmation({ account, action: 'reset' })
  }

  async function confirmAccountAction() {
    if (!confirmation) return
    const { account, action } = confirmation
    setWorkingId(account.id)
    setConfirmation(null)
    try {
      if (action === 'reset') {
        const response = await resetAccountPassword(account.id, 'Cấp lại mật khẩu từ màn hình tài khoản')
        setCreated({ account, temporaryPassword: response.temporaryPassword, kind: 'reset' })
        setModal(true)
      } else {
        await changeAccountLock(account.id, action, `${action === 'lock' ? 'Khóa' : 'Mở khóa'} từ màn hình tài khoản`)
        await loadAccounts()
        setNotice(`Đã ${action === 'lock' ? 'khóa' : 'mở khóa'} tài khoản ${account.username}.`)
      }
    } catch (requestError) {
      setNotice(getErrorMessage(requestError, action === 'reset' ? 'Không thể cấp lại mật khẩu tạm.' : `Không thể ${action === 'lock' ? 'khóa' : 'mở khóa'} tài khoản.`))
    } finally { setWorkingId(null) }
  }

  async function copyPassword(password: string) {
    try { await navigator.clipboard.writeText(password); setNotice('Đã sao chép mật khẩu tạm.') }
    catch { setNotice('Trình duyệt không cho phép sao chép. Hãy chọn và sao chép mật khẩu trên màn hình.') }
  }

  const start = filtered.length ? (page - 1) * pageSize + 1 : 0
  const end = Math.min(page * pageSize, filtered.length)

  return <>
    <main className="dashboard-content accounts-content">
      <div className="accounts-page-heading"><h1>Tài khoản</h1><div className="accounts-breadcrumb"><Link to="/dashboard">Trang chủ</Link><span>›</span><span>Tài khoản</span></div></div>
      {error && <div className="dashboard-banner error-banner" role="alert">{error}<button type="button" onClick={() => { setLoading(true); void loadAccounts() }}>Thử lại</button></div>}
      {notice && <div className="account-notice" role="status">{notice}<button type="button" aria-label="Đóng thông báo" onClick={() => setNotice('')}>×</button></div>}
      <section className="accounts-panel">
        <div className="accounts-panel-heading"><h2>Tài khoản người dùng</h2><button className="accounts-primary-button" type="button" onClick={openCreate}><span>＋</span> Tạo tài khoản</button></div>
        <div className="accounts-toolbar">
          <div className="account-tabs" role="tablist" aria-label="Lọc theo trạng thái">{([['ALL', 'Tất cả'], ['ACTIVE', 'Hoạt động'], ['LOCKED', 'Đã khóa']] as const).map(([value, label]) => <button key={value} type="button" role="tab" aria-selected={tab === value} className={tab === value ? 'is-selected' : ''} onClick={() => { setTab(value); setPage(1) }}>{label}<span>{counts[value]}</span></button>)}</div>
          <div className="accounts-filters">
            <label className="accounts-filter-search"><DashboardIcon name="search" /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1) }} placeholder="Tìm theo tên, tên đăng nhập hoặc số điện thoại" aria-label="Tìm tài khoản" /></label>
            <select aria-label="Lọc theo vai trò" value={roleFilter} onChange={(event) => { setRoleFilter(event.target.value); setPage(1) }}><option value="">Mọi vai trò</option>{Object.entries(roleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
            <select aria-label="Lọc theo cửa hàng" value={storeFilter} onChange={(event) => { setStoreFilter(event.target.value); setPage(1) }}><option value="">Mọi cửa hàng</option>{stores.map((store) => <option key={store.id} value={store.id}>{store.storeName}</option>)}</select>
          </div>
        </div>
        <div className="table-scroll accounts-table-wrap"><table className="accounts-table"><thead><tr><th>Người dùng</th><th>Vai trò</th><th>Cửa hàng</th><th>Điện thoại, email</th><th>Quyền sửa<br />danh mục</th><th>Trạng thái</th><th><span className="sr-only">Thao tác</span></th></tr></thead>
          <tbody>{loading ? <tr><td colSpan={7} className="accounts-empty">Đang tải danh sách tài khoản…</td></tr> : visible.length ? visible.map((account) => <tr key={account.id}>
            <td><strong>{account.fullName}</strong><small>{account.username}{account.id === user.id ? <em>Bạn</em> : null}</small></td>
            <td>{roleLabels[account.role] || account.role}</td><td>{account.storeName || (account.role === 'ADMIN' || account.role === 'OWNER' ? 'Toàn chuỗi' : '—')}</td>
            <td><span>{account.phone || '—'}</span><small>{account.email || 'Chưa có email'}</small></td>
            <td>{account.role === 'BRANCH_MANAGER' ? <button type="button" role="switch" aria-checked={account.permissions.includes('CATALOG_EDIT')} className={`permission-switch ${account.permissions.includes('CATALOG_EDIT') ? 'is-on' : ''}`} disabled={workingId === account.id || account.id === user.id} onClick={() => void toggleCatalogPermission(account)}><span /></button> : '—'}</td>
            <td><span className={`status-badge account-state-${account.state.toLowerCase().replaceAll('_', '-')}`}>{account.state === 'ACTIVE' ? 'Hoạt động' : account.state === 'LOCKED' ? 'Đã khóa' : 'Tạm khóa'}</span></td>
            <td><div className="account-row-actions"><button type="button" title="Cập nhật phân quyền" aria-label={`Cập nhật phân quyền ${account.fullName}`} disabled={workingId === account.id || account.id === user.id} onClick={() => void openPermissionEditor(account)}><DashboardIcon name="shield" /></button><button type="button" title="Cấp mật khẩu tạm" aria-label={`Cấp lại mật khẩu ${account.fullName}`} disabled={workingId === account.id} onClick={() => void resetPassword(account)}>⚿</button><button type="button" title={account.state !== 'ACTIVE' ? 'Mở khóa tài khoản' : 'Khóa tài khoản'} aria-label={`${account.state !== 'ACTIVE' ? 'Mở khóa' : 'Khóa'} ${account.fullName}`} disabled={workingId === account.id || account.id === user.id} onClick={() => void setLocked(account)}><DashboardIcon name="lock" /></button></div></td>
          </tr>) : <tr><td colSpan={7} className="accounts-empty">Không tìm thấy tài khoản phù hợp.</td></tr>}</tbody></table></div>
        <div className="accounts-pagination"><span>Hiển thị {start}–{end} trên {filtered.length} tài khoản</span><div><button type="button" aria-label="Trang trước" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>‹</button><strong>{page}</strong><button type="button" aria-label="Trang sau" disabled={page >= pageCount} onClick={() => setPage((current) => current + 1)}>›</button></div></div>
      </section>
    </main>
    {modal && <div className="account-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeModal() }}><section className="account-modal" role="dialog" aria-modal="true" aria-labelledby="account-modal-title">
      <button className="account-modal-close" type="button" onClick={closeModal} aria-label="Đóng">×</button>
      {created ? <div className="created-password"><h2 id="account-modal-title">{created.kind === 'reset' ? 'Mật khẩu tạm mới' : 'Tài khoản đã được tạo'}</h2><p>Gửi mật khẩu này cho <strong>{created.account.fullName}</strong>. Mật khẩu chỉ hiển thị lần này và người dùng cần đổi sau khi đăng nhập.</p><label>Mật khẩu tạm</label><div className="temporary-password-value"><code>{created.temporaryPassword}</code><button type="button" onClick={() => void copyPassword(created.temporaryPassword)}>Sao chép</button></div><button className="accounts-primary-button modal-submit" type="button" onClick={() => { setModal(false); setCreated(null) }}>Hoàn tất</button></div>
      : <form onSubmit={createAccount}>
        <h2 id="account-modal-title">Tạo tài khoản</h2>
        {formError && <p className="account-form-error" role="alert">{formError}</p>}
        <div className="account-form-grid"><label>Họ và tên <b>*</b><input required maxLength={100} value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} autoFocus /></label><label>Tên đăng nhập <b>*</b><input required minLength={3} maxLength={50} pattern="[A-Za-z0-9._-]+" value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} /></label><label>Số điện thoại<input type="tel" maxLength={20} value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label><label>Email<input type="email" maxLength={100} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label></div>
        <fieldset className="account-choice-group"><legend>Vai trò <b>*</b></legend><div className="account-choice-grid">{Object.entries(roleLabels).map(([value, label]) => <label key={value} className={form.role === value ? 'is-checked' : ''}><input type="radio" name="role" value={value} checked={form.role === value} onChange={() => setForm({ ...form, role: value as AccountRole, storeId: '' })} />{label}</label>)}</div></fieldset>
        {['STAFF', 'BRANCH_MANAGER'].includes(form.role) && <fieldset className="account-choice-group"><legend>Cửa hàng làm việc <b>*</b></legend><div className="account-choice-grid">{stores.map((store) => <label key={store.id} className={form.storeId === String(store.id) ? 'is-checked' : ''}><input type="radio" name="store" value={store.id} checked={form.storeId === String(store.id)} onChange={() => setForm({ ...form, storeId: String(store.id) })} />{store.storeName}</label>)}</div>{!stores.length && <small>Chưa có cửa hàng khả dụng.</small>}</fieldset>}
        <div className="temporary-password-note"><DashboardIcon name="lock" /><span>Mật khẩu tạm sẽ được hệ thống tạo và chỉ hiển thị một lần sau khi tạo tài khoản.</span></div>
        <div className="account-modal-actions"><button type="button" className="account-secondary-button" onClick={closeModal}>Hủy</button><button type="submit" className="accounts-primary-button" disabled={saving || (['STAFF', 'BRANCH_MANAGER'].includes(form.role) && !stores.length)}>{saving ? 'Đang tạo…' : 'Tạo tài khoản'}</button></div>
      </form>}
    </section></div>}
    {editingPermission && <div className="account-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !permissionSaving) { setEditingPermission(null); setPermissionForm(null) } }}><section className="account-modal permission-modal" role="dialog" aria-modal="true" aria-labelledby="permission-modal-title">
      <button className="account-modal-close" type="button" disabled={permissionSaving} onClick={() => { setEditingPermission(null); setPermissionForm(null) }} aria-label="Đóng">×</button>
      <h2 id="permission-modal-title">Cập nhật phân quyền · {editingPermission.fullName}</h2>
      {permissionLoading ? <p className="permission-loading">Đang tải thông tin phân quyền…</p> : !permissionForm ? <div className="permission-load-error" role="alert"><p>{permissionError || 'Không tải được thông tin phân quyền.'}</p><button type="button" className="account-secondary-button" onClick={() => void openPermissionEditor(editingPermission)}>Thử lại</button></div> : <>
        {permissionError && <p className="account-form-error" role="alert">{permissionError}</p>}
        <fieldset className="account-choice-group permission-roles"><legend>Vai trò <b>*</b></legend><div className="account-choice-grid">{Object.entries(roleLabels).map(([value, label]) => <label key={value} className={permissionForm.role === value ? 'is-checked' : ''}><input type="radio" name="permission-role" value={value} checked={permissionForm.role === value} onChange={() => setPermissionForm((current) => current ? { ...current, role: value as AccountRole, storeId: ['STAFF', 'BRANCH_MANAGER'].includes(value) ? current.storeId : '', catalogEdit: value === 'BRANCH_MANAGER' && current.catalogEdit } : current)} />{label}</label>)}</div></fieldset>
        <fieldset className={`account-choice-group permission-stores ${['STAFF', 'BRANCH_MANAGER'].includes(permissionForm.role) ? '' : 'is-disabled'}`}><legend>Cửa hàng làm việc {['STAFF', 'BRANCH_MANAGER'].includes(permissionForm.role) && <b>*</b>}</legend><div className="account-choice-grid">{stores.map((store) => <label key={store.id} className={`${permissionForm.storeId === String(store.id) ? 'is-checked' : ''} ${store.status === 'INACTIVE' && String(store.id) !== permissionForm.storeId ? 'is-unavailable' : ''}`}><input type="radio" name="permission-store" value={store.id} disabled={!['STAFF', 'BRANCH_MANAGER'].includes(permissionForm.role) || (store.status === 'INACTIVE' && String(store.id) !== permissionForm.storeId)} checked={permissionForm.storeId === String(store.id)} onChange={() => setPermissionForm((current) => current ? { ...current, storeId: String(store.id) } : current)} />{store.storeName}</label>)}</div>{!['STAFF', 'BRANCH_MANAGER'].includes(permissionForm.role) && <small>Admin và Owner không được gán cửa hàng.</small>}</fieldset>
        <button type="button" role="switch" aria-checked={permissionForm.catalogEdit} disabled={permissionForm.role !== 'BRANCH_MANAGER'} className="permission-modal-toggle" onClick={() => setPermissionForm((current) => current ? { ...current, catalogEdit: !current.catalogEdit } : current)}><span className={`permission-switch ${permissionForm.catalogEdit ? 'is-on' : ''}`}><span /></span><span>Được sửa danh mục phụ tùng</span></button>
        <div className="permission-readonly"><DashboardIcon name="lock"/><span>Quyền sửa giá bán lẻ: {editingPermission.permissions.includes('RETAIL_PRICE_EDIT') ? 'Đã được Owner cấp' : 'Chưa có (do Owner cấp)'}</span></div>
        <label className="permission-reason">Lý do thay đổi<textarea maxLength={255} value={permissionForm.reason} onChange={(event) => setPermissionForm((current) => current ? { ...current, reason: event.target.value } : current)} placeholder="Ví dụ: điều động sang cửa hàng Long Biên…" /></label>
        <div className="account-modal-actions"><button type="button" className="account-secondary-button" disabled={permissionSaving} onClick={() => { setEditingPermission(null); setPermissionForm(null) }}>Hủy</button><button type="button" className="accounts-primary-button" disabled={permissionSaving} onClick={() => void savePermissions()}>{permissionSaving ? 'Đang lưu…' : 'Lưu thay đổi'}</button></div>
      </>}
    </section></div>}
    {confirmation && <div className="account-modal-backdrop account-confirm-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setConfirmation(null) }}><section className="account-modal account-confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="account-confirm-title" aria-describedby="account-confirm-description">
      <button className="account-modal-close" type="button" onClick={() => setConfirmation(null)} aria-label="Đóng">×</button>
      <h2 id="account-confirm-title">{confirmation.action === 'reset' ? `Cấp lại mật khẩu cho ${confirmation.account.username}?` : confirmation.action === 'lock' ? `Khóa tài khoản ${confirmation.account.username}?` : `Mở khóa tài khoản ${confirmation.account.username}?`}</h2>
      {confirmation.action === 'lock' && <div className="confirm-account-card"><span className="confirm-account-avatar">{confirmation.account.fullName.split(/\s+/).slice(-2).map((part) => part[0]).join('').toLocaleUpperCase('vi')}</span><span><strong>{confirmation.account.fullName}</strong><small>{roleLabels[confirmation.account.role]}</small></span></div>}
      <p id="account-confirm-description">{confirmation.action === 'reset'
        ? <>Mật khẩu hiện tại của <strong>{confirmation.account.fullName}</strong> hết hiệu lực ngay. Người dùng phải đổi mật khẩu tạm trước khi dùng chức năng khác.</>
        : confirmation.action === 'lock'
          ? 'Người dùng không đăng nhập được cho tới khi Admin mở khóa. Tài khoản không bị xóa và chứng từ đã lập vẫn giữ tên người lập.'
          : 'Người dùng có thể đăng nhập lại sau khi Admin mở khóa tài khoản.'}</p>
      <div className="account-modal-actions"><button type="button" className="account-secondary-button" onClick={() => setConfirmation(null)}>Hủy</button><button type="button" className={`account-confirm-submit ${confirmation.action === 'lock' ? 'is-danger' : ''}`} onClick={() => void confirmAccountAction()}>{confirmation.action === 'reset' ? 'Cấp mật khẩu tạm' : confirmation.action === 'lock' ? 'Khóa tài khoản' : 'Mở khóa tài khoản'}</button></div>
    </section></div>}
  </>
}

function getErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { message?: unknown; detail?: unknown } | undefined
    if (typeof data?.message === 'string') return data.message
    if (typeof data?.detail === 'string') return data.detail
  }
  return fallback
}
