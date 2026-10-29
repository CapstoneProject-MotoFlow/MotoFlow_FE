import HeaderSearch from '../../../shared/ui/HeaderSearch'
/** Shared store management page for Admin and Owner; store data comes from the existing API. */
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
            <button className="add-store-button" type="button" onClick={openCreateForm}><span aria-hidden="true">＋</span> Thêm cửa hàng</button>
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

      {editingStore !== undefined && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditingStore(undefined) }}>
          <section className="store-modal" role="dialog" aria-modal="true" aria-labelledby="store-modal-title">
            <div className="store-modal-heading"><h2 id="store-modal-title">{editingStore ? 'Sửa cửa hàng' : 'Thêm cửa hàng'}</h2><button type="button" aria-label="Đóng" onClick={() => setEditingStore(undefined)}>×</button></div>
            <form onSubmit={saveStore} className="store-form">
              <label>Tên cửa hàng <span>*</span><input maxLength={150} required value={form.storeName} onChange={(event) => setForm({ ...form, storeName: event.target.value })} /></label>
              <label>Địa chỉ <span>*</span><input maxLength={255} required value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} /></label>
              <label>Điện thoại<input maxLength={20} pattern="[0-9+ ]{8,20}" title="Nhập 8–20 chữ số, dấu + hoặc khoảng trắng." value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label>
              <label>Tên kho <span>*</span><input maxLength={150} required value={form.warehouseName} onChange={(event) => setForm({ ...form, warehouseName: event.target.value })} /></label>
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
