/** Shared store management page for Admin and Owner; store data comes from the existing API. */
import HeaderSearch from '../../../shared/ui/HeaderSearch'
import { useEffect, useState, type FormEvent } from 'react'
import axios from 'axios'
import { Link } from 'react-router-dom'
import { default as DashboardIcon } from '../../../shared/ui/Icon'
import type { DashboardStore } from '../../../shared/types/store'
import { listStores, saveStoreRequest } from '../services/storeService'
import '../stores.css'

type StoreStatus = DashboardStore['status']
type StoreFormValues = {
  storeName: string
  address: string
  phone: string
  warehouseName: string
  central: boolean
  status: StoreStatus
}

const emptyForm: StoreFormValues = { storeName: '', address: '', phone: '', warehouseName: '', central: false, status: 'PLANNED' }

export default function StoresPage() {
  const [copyOpen, setCopyOpen] = useState(false)
  const [templates, setTemplates] = useState<DashboardStore[]>([])
  const [templateLoading, setTemplateLoading] = useState(false)
  const [templateId, setTemplateId] = useState('')
  const [success, setSuccess] = useState('')
  const [stores, setStores] = useState<DashboardStore[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [warehouseFilter, setWarehouseFilter] = useState('')
  const [page, setPage] = useState(1)
  const [refreshKey, setRefreshKey] = useState(0)
  const [editingStore, setEditingStore] = useState<DashboardStore | null | undefined>(undefined)
  const [form, setForm] = useState<StoreFormValues>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  useEffect(() => {
    let active = true
    const timer = window.setTimeout(() => {
      setLoading(true)
      setError('')
      listStores({
          q: query.trim() || undefined,
          status: status || undefined,
          central: warehouseFilter === '' ? undefined : warehouseFilter === 'central',
        }).then((storeList) => {
        if (active) setStores(storeList)
      }).catch((requestError) => {
        if (!active) return
        const message = axios.isAxiosError(requestError) ? requestError.response?.data?.message : undefined
        setError(typeof message === 'string' ? message : 'Không tải được danh sách cửa hàng. Vui lòng thử lại.')
      }).finally(() => {
        if (active) setLoading(false)
      })
    }, 180)

    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [query, status, warehouseFilter, refreshKey])

  useEffect(() => {
    if (!copyOpen) return
    const previousFocus = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const dialog = document.getElementById('copy-store-dialog')
    const controls = () => Array.from(dialog?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled)') || [])
    controls()[0]?.focus()
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) setCopyOpen(false)
      if (event.key === 'Tab') {
        const elements = controls(), first = elements[0], last = elements.at(-1)
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', handleKey); previousFocus?.focus() }
  }, [copyOpen, saving])

  async function openCopyForm() {
    setCopyOpen(true)
    setForm({ ...emptyForm })
    setFormError('')
    setTemplateId('')
    setTemplateLoading(true)
    try { setTemplates(await listStores()) }
    catch { setTemplates([]); setFormError('Không tải được danh sách cửa hàng mẫu. Đóng và thử lại.') }
    finally { setTemplateLoading(false) }
  }

  async function createFromTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const source = templates.find(store => String(store.id) === templateId)
    if (!source) { setFormError('Vui lòng chọn cửa hàng mẫu.'); return }
    if (!form.storeName.trim() || !form.address.trim()) { setFormError('Vui lòng nhập tên cửa hàng và địa chỉ.'); return }
    setSaving(true)
    setFormError('')
    try {
      await saveStoreRequest(null, { storeName: form.storeName.trim(), address: form.address.trim(), phone: form.phone.trim(), warehouseName: ('Kho ' + form.storeName.trim()).slice(0, 150), central: false })
      setCopyOpen(false)
      setPage(1)
      setRefreshKey(value => value + 1)
      setSuccess('Đã tạo cửa hàng ở trạng thái Đang chuẩn bị. Không sao chép ngưỡng tồn hoặc sơ đồ kho.')
    } catch (requestError) {
      const message = axios.isAxiosError(requestError) ? requestError.response?.data?.message : undefined
      setFormError(typeof message === 'string' ? message : 'Không tạo được cửa hàng. Vui lòng thử lại.')
    } finally { setSaving(false) }
  }

  const pageSize = 6
  const pageCount = Math.max(1, Math.ceil(stores.length / pageSize))
  const visibleStores = stores.slice((page - 1) * pageSize, page * pageSize)
  const firstResult = stores.length ? (page - 1) * pageSize + 1 : 0
  const lastResult = Math.min(page * pageSize, stores.length)

  function openCreateForm() {
    setEditingStore(null)
    setForm({ ...emptyForm })
    setFormError('')
  }

  function openEditForm(store: DashboardStore) {
    setEditingStore(store)
    setForm({
      storeName: store.storeName,
      address: store.address,
      phone: store.phone || '',
      warehouseName: store.warehouse?.name || `${store.storeName} - Kho`,
      central: store.warehouse?.central || false,
      status: store.status,
    })
    setFormError('')
  }

  async function saveStore(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError('')
    setSaving(true)
    const payload = {
      storeName: form.storeName.trim(),
      address: form.address.trim(),
      phone: form.phone.trim(),
      warehouseName: form.warehouseName.trim(),
      central: form.central,
      ...(editingStore ? { status: form.status } : {}),
    }

    try {
      await saveStoreRequest(editingStore?.id ?? null, payload)
      setEditingStore(undefined)
      setRefreshKey((key) => key + 1)
    } catch (requestError) {
      const message = axios.isAxiosError(requestError) ? requestError.response?.data?.message : undefined
      setFormError(typeof message === 'string' ? message : 'Không lưu được cửa hàng. Vui lòng kiểm tra thông tin và thử lại.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <HeaderSearch loading={loading} placeholder="Tìm cửa hàng..." items={stores.map(item => ({ id: item.id, label: item.storeName, meta: item.address, select: () => { setQuery(item.storeName); setPage(1) } }))} /><main className="stores-page dashboard-content">
        <div className="stores-page-heading">
          <h1>Cửa hàng</h1>
          <div className="breadcrumbs"><Link to="/dashboard">Trang chủ</Link><span>›</span><strong>Cửa hàng</strong></div>
        </div>

        <section className="dashboard-panel stores-table-panel">
          <div className="stores-panel-heading">
            <h2>Danh sách cửa hàng</h2>
            <div className="stores-heading-actions"><button className="edit-store-button copy-store-button" type="button" onClick={() => void openCopyForm()}><span aria-hidden="true">▢</span> Tạo theo cửa hàng có sẵn</button><button className="add-store-button" type="button" onClick={openCreateForm}><span aria-hidden="true">＋</span> Thêm cửa hàng</button></div>
          </div>
          <div className="stores-toolbar">
            <label className="store-filter-search">
              <DashboardIcon name="search" />
              <input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1) }} placeholder="Tìm theo tên hoặc địa chỉ" aria-label="Tìm theo tên hoặc địa chỉ" />
            </label>
            <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1) }} aria-label="Lọc trạng thái">
              <option value="">Mọi trạng thái</option>
              <option value="ACTIVE">Đang hoạt động</option>
              <option value="PLANNED">Đang chuẩn bị</option>
              <option value="INACTIVE">Ngừng hoạt động</option>
            </select>
            <select value={warehouseFilter} onChange={(event) => { setWarehouseFilter(event.target.value); setPage(1) }} aria-label="Lọc loại kho">
              <option value="">Mọi loại kho</option>
              <option value="central">Kho tổng</option>
              <option value="branch">Kho cửa hàng</option>
            </select>
          </div>

          {success && <p className="stores-success" role="status">{success}</p>}
          {error && <div className="dashboard-banner error-banner stores-error" role="alert">{error}</div>}
          <div className="table-scroll">
            <table className="stores-table">
              <thead><tr><th>Cửa hàng</th><th>Địa chỉ</th><th>Điện thoại</th><th>Loại kho</th><th>BM phụ trách</th><th>Trạng thái</th><th aria-label="Thao tác" /></tr></thead>
              <tbody>
                {loading ? <tr><td className="stores-placeholder" colSpan={7}>Đang tải danh sách cửa hàng…</td></tr> : visibleStores.length ? visibleStores.map((store) => (
                  <tr key={store.id}>
                    <td><strong>{store.storeName}</strong></td>
                    <td>{store.address}</td>
                    <td>{store.phone || '—'}</td>
                    <td><span className={store.warehouse?.central ? 'change-badge tone-blue' : ''}>{store.warehouse ? store.warehouse.central ? 'Kho tổng' : 'Kho cửa hàng' : 'Chưa có kho'}</span></td>
                    <td>{store.managers?.[0]?.fullName || 'Chưa gán'}</td>
                    <td><span className={`status-badge store-${store.status.toLowerCase()}`}>{formatStatus(store.status)}</span></td>
                    <td><button className="edit-store-button" type="button" onClick={() => openEditForm(store)}>Sửa</button></td>
                  </tr>
                )) : <tr><td className="stores-placeholder" colSpan={7}>Không có cửa hàng phù hợp.</td></tr>}
              </tbody>
            </table>
          </div>

          <div className="stores-table-footer">
            <span>Hiển thị {firstResult}–{lastResult} trên {stores.length} cửa hàng</span>
            <div className="pagination-controls">
              <button type="button" aria-label="Trang trước" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>‹</button>
              <span>{page}</span>
              <button type="button" aria-label="Trang sau" disabled={page >= pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))}>›</button>
            </div>
          </div>
        </section>
      </main>

      {copyOpen && <div className="modal-backdrop stores-copy-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !saving) setCopyOpen(false) }}><section id="copy-store-dialog" className="store-modal store-copy-modal" role="dialog" aria-modal="true" aria-labelledby="copy-store-title" aria-describedby="copy-store-note"><div className="store-modal-heading"><h2 id="copy-store-title">Tạo cửa hàng theo cấu hình có sẵn</h2><button type="button" disabled={saving} aria-label="Đóng" onClick={() => setCopyOpen(false)}>×</button></div><form id="copy-store-form" className="store-form" onSubmit={createFromTemplate}>
        <label><span className="store-field-label">Cửa hàng mẫu <span className="store-required">*</span></span><select required disabled={templateLoading || saving} value={templateId} onChange={event => setTemplateId(event.target.value)}><option value="">{templateLoading ? 'Đang tải cửa hàng…' : 'Chọn cửa hàng mẫu'}</option>{templates.map(store => <option key={store.id} value={store.id}>{store.storeName}</option>)}</select></label>
        <label><span className="store-field-label">Tên cửa hàng mới <span className="store-required">*</span></span><input required maxLength={150} disabled={saving} placeholder="Nhập tên cửa hàng mới" value={form.storeName} onChange={event => setForm({ ...form, storeName: event.target.value })} /></label>
        <label><span className="store-field-label">Địa chỉ <span className="store-required">*</span></span><input required maxLength={255} disabled={saving} value={form.address} onChange={event => setForm({ ...form, address: event.target.value })} /></label>
        <div className="store-copy-row"><label>Điện thoại<input type="tel" maxLength={20} pattern="[0-9+ ]{8,20}" disabled={saving} placeholder="024 xxxx xxxx" value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} /></label><label>Trạng thái<input readOnly value="Đang chuẩn bị" /></label></div>
        <fieldset className="store-copy-options"><legend>Cấu hình được sao chép</legend><label><input type="checkbox" disabled /> Ngưỡng tồn tối thiểu của phụ tùng</label><label><input type="checkbox" disabled /> Sơ đồ khu và kệ lưu kho</label><p>Hai tùy chọn này chưa được hệ thống hỗ trợ sao chép.</p></fieldset>
        <p id="copy-store-note" className="store-copy-note">Cửa hàng mới được tạo với kho cửa hàng riêng. Hiện chỉ tạo thông tin cơ bản; không sao chép tồn kho, chứng từ, công nợ hoặc cấu hình từ cửa hàng mẫu.</p>
        {formError && <p className="form-error" role="alert">{formError}</p>}</form><div className="store-modal-actions store-copy-actions"><button type="button" className="edit-store-button" disabled={saving} onClick={() => setCopyOpen(false)}>Hủy</button><button type="submit" form="copy-store-form" className="add-store-button" disabled={saving || templateLoading || !templates.length}>{saving ? 'Đang tạo…' : 'Tạo cửa hàng'}</button></div>
      </section></div>}

      {editingStore !== undefined && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditingStore(undefined) }}>
          <section className="store-modal" role="dialog" aria-modal="true" aria-labelledby="store-modal-title">
            <div className="store-modal-heading"><h2 id="store-modal-title">{editingStore ? 'Sửa cửa hàng' : 'Thêm cửa hàng'}</h2><button type="button" aria-label="Đóng" onClick={() => setEditingStore(undefined)}>×</button></div>
            <form onSubmit={saveStore} className="store-form">
              <label><span className="store-field-label">Tên cửa hàng <span className="store-required">*</span></span><input maxLength={150} required value={form.storeName} onChange={(event) => setForm({ ...form, storeName: event.target.value })} /></label>
              <label><span className="store-field-label">Địa chỉ <span className="store-required">*</span></span><input maxLength={255} required value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} /></label>
              <label>Điện thoại<input maxLength={20} pattern="[0-9+ ]{8,20}" title="Nhập 8–20 chữ số, dấu + hoặc khoảng trắng." value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label>
              <label><span className="store-field-label">Tên kho <span className="store-required">*</span></span><input maxLength={150} required value={form.warehouseName} onChange={(event) => setForm({ ...form, warehouseName: event.target.value })} /></label>
              {editingStore && <label>Trạng thái<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as StoreStatus })}><option value="PLANNED">Đang chuẩn bị</option><option value="ACTIVE">Đang hoạt động</option><option value="INACTIVE">Ngừng hoạt động</option></select></label>}
              <label className="central-checkbox"><input type="checkbox" checked={form.central} onChange={(event) => setForm({ ...form, central: event.target.checked })} /> Đây là kho tổng</label>
              {formError && <p className="form-error" role="alert">{formError}</p>}
              <div className="store-modal-actions"><button className="edit-store-button" type="button" onClick={() => setEditingStore(undefined)}>Hủy</button><button className="add-store-button" type="submit" disabled={saving}>{saving ? 'Đang lưu…' : editingStore ? 'Lưu thay đổi' : 'Tạo cửa hàng'}</button></div>
            </form>
          </section>
        </div>
      )}
    </>
  )
}

function formatStatus(status: StoreStatus) {
  return { ACTIVE: 'Đang hoạt động', PLANNED: 'Đang chuẩn bị', INACTIVE: 'Ngừng hoạt động' }[status]
}
