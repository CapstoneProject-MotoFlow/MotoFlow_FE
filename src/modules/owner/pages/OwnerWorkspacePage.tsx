import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import axiosClient from '../../../shared/api/axiosClient'
import FormDialog from '../../../shared/ui/FormDialog'
import type { DashboardProduct } from '../../dashboard/types/dashboardTypes'
import '../owner.css'
import './products.css'

type Category = { id: number; categoryName: string; children: Category[]; status: string }
type Model = { id: number; manufacturer: string; modelName: string }
const flatten = (nodes: Category[]): Category[] => nodes.flatMap(node => [node, ...flatten(node.children || [])])
const vehicleTypes = { MOTORCYCLE: 'Xe máy', BICYCLE: 'Xe đạp', E_MOTORCYCLE: 'Xe máy điện', E_BICYCLE: 'Xe đạp điện' }
export default function OwnerWorkspacePage() {
  const navigate = useNavigate(); const [params] = useSearchParams()
  const [q, setQ] = useState(params.get('sku') || '')
  const [filters, setFilters] = useState({ vehicleType: '', categoryId: '', vehicleModelId: '', brand: '', status: 'ACTIVE', inStockOnly: false })
  const [page, setPage] = useState(0)
  const [data, setData] = useState<{ items: DashboardProduct[]; totalItems: number }>({ items: [], totalItems: 0 })
  const [categories, setCategories] = useState<Category[]>([])
  const [models, setModels] = useState<Model[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  useEffect(() => {
    let active = true
    Promise.all([axiosClient.get<Category[]>('/part-categories'), axiosClient.get<Model[]>('/vehicle-models')]).then(([a, b]) => { if (active) { setCategories(flatten(a.data)); setModels(b.data) } }).catch(() => { if (active) setError('Không tải được bộ lọc danh mục. Vui lòng tải lại trang.') })
    return () => { active = false }
  }, [])
  useEffect(() => {
    let active = true
    const timer = setTimeout(() => {
      setLoading(true); setError('')
      axiosClient.get('/products', { params: { ...Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== '')), q, page, size: 20 } }).then(response => { if (active) setData(response.data) }).catch(() => { if (active) setError('Không tải được phụ tùng. Vui lòng thử lại.') }).finally(() => { if (active) setLoading(false) })
    }, 250)
    return () => { active = false; clearTimeout(timer) }
  }, [q, filters, page, revision])
  function filter(key: string, value: string | boolean) { setFilters(old => ({ ...old, [key]: value })); setPage(0) }
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (saving) return
    const form = new FormData(event.currentTarget)
    setSaving(true); setFormError('')
    try {
      await axiosClient.post('/products', { sku: form.get('sku'), partName: form.get('partName'), categoryId: Number(form.get('categoryId')), brand: form.get('brand'), baseUnit: form.get('baseUnit'), countryOfOrigin: form.get('countryOfOrigin'), specifications: form.get('specifications'), oemCodes: String(form.get('oemCodes') || '').split(',').map(x => x.trim()).filter(Boolean), barcodes: String(form.get('barcodes') || '').split(',').map(x => x.trim()).filter(Boolean), vehicleModelIds: form.getAll('vehicleModelIds').map(Number) })
      setCreating(false); setPage(0); setRevision(x => x + 1)
    } catch { setFormError('Không thể thêm phụ tùng. Kiểm tra SKU trùng, thông tin và quyền truy cập rồi thử lại.') } finally { setSaving(false) }
  }
  return <main className="dashboard-content owner-content parts-page"><div className="parts-heading"><h1 className="dashboard-greeting">Phụ tùng</h1><span><Link to="/dashboard">Trang chủ</Link> › Phụ tùng</span></div><section className="owner-panel"><header className="parts-panel-heading"><h2>Tìm phụ tùng</h2><button className="ui-confirm-button" onClick={() => { navigate('/owner/products/new') }}>＋ Thêm phụ tùng</button></header><div className="parts-filters"><input aria-label="Tìm phụ tùng" placeholder="Tìm theo tên, SKU, mã OEM hoặc mã vạch" value={q} onChange={e => { setQ(e.target.value); setPage(0) }} /><div className="parts-filter-row"><select aria-label="Loại xe" value={filters.vehicleType} onChange={e => filter('vehicleType', e.target.value)}><option value="">Mọi loại xe</option>{Object.entries(vehicleTypes).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><select aria-label="Nhóm phụ tùng" value={filters.categoryId} onChange={e => filter('categoryId', e.target.value)}><option value="">Mọi nhóm phụ tùng</option>{categories.map(c => <option key={c.id} value={c.id}>{c.categoryName}</option>)}</select><select aria-label="Dòng xe" value={filters.vehicleModelId} onChange={e => filter('vehicleModelId', e.target.value)}><option value="">Mọi dòng xe</option>{models.map(m => <option key={m.id} value={m.id}>{m.manufacturer} {m.modelName}</option>)}</select><input aria-label="Nhà sản xuất" placeholder="Mọi nhà sản xuất" value={filters.brand} onChange={e => filter('brand', e.target.value)} /><select aria-label="Trạng thái" value={filters.status} onChange={e => filter('status', e.target.value)}><option value="">Mọi trạng thái</option><option value="ACTIVE">Đang kinh doanh</option><option value="DISCONTINUED">Ngừng kinh doanh</option></select><label><input type="checkbox" checked={filters.inStockOnly} onChange={e => filter('inStockOnly', e.target.checked)} /> Chỉ hiện hàng còn bán được</label></div><p className="parts-count" aria-live="polite">{loading ? 'Đang tìm…' : `Tìm thấy ${data.totalItems} phụ tùng`}</p></div>{error ? <div className="empty-state" role="alert">{error} <button onClick={() => setRevision(x => x + 1)}>Thử lại</button></div> : loading ? <p className="empty-state">Đang tải phụ tùng…</p> : <><div className="owner-table-scroll"><table><thead><tr><th>Phụ tùng</th><th>Nhóm</th><th>Nhà sản xuất</th><th>Giá lẻ chuẩn</th><th>Khả dụng</th><th>Trạng thái</th></tr></thead><tbody>{data.items.map(item => <tr key={item.id}><td><strong>{item.partName}</strong><small>{item.sku}</small></td><td>{item.categoryName}</td><td>{item.brand}</td><td className="parts-number">{item.retailPrice == null ? '—' : item.retailPrice.toLocaleString('vi-VN') + ' ₫'}</td><td className="parts-number">{item.availableQty == null ? '—' : `${item.availableQty.toLocaleString('vi-VN')} ${item.baseUnit}`}</td><td><span className={'parts-status ' + (item.status === 'ACTIVE' ? '' : 'inactive')}>{item.status === 'ACTIVE' ? 'Đang kinh doanh' : 'Ngừng kinh doanh'}</span></td></tr>)}</tbody></table></div>{!data.items.length && <p className="empty-state">Không tìm thấy phụ tùng phù hợp.</p>}<footer className="parts-pagination"><button disabled={!page} onClick={() => setPage(x => x - 1)}>Trang trước</button><span>Trang {page + 1} / {Math.max(1, Math.ceil(data.totalItems / 20))}</span><button disabled={(page + 1) * 20 >= data.totalItems} onClick={() => setPage(x => x + 1)}>Trang sau</button></footer></>}</section>{creating && <FormDialog title="Thêm phụ tùng" formId="create-part" submitLabel={saving ? 'Đang lưu…' : 'Thêm phụ tùng'} onClose={() => { if (!saving) setCreating(false) }}><form id="create-part" className="parts-form" onSubmit={create}><fieldset disabled={saving}>{[['sku', 'Mã SKU', 50], ['partName', 'Tên phụ tùng', 200], ['brand', 'Nhà sản xuất / thương hiệu', 100], ['baseUnit', 'Đơn vị tính', 20]].map(([name, label, max]) => <label key={name}>{label} *<input name={String(name)} required maxLength={Number(max)} /></label>)}<label>Nhóm phụ tùng *<select name="categoryId" required><option value="">Chọn nhóm</option>{categories.filter(c => !c.children.length && c.status === 'ACTIVE').map(c => <option key={c.id} value={c.id}>{c.categoryName}</option>)}</select></label><label>Xuất xứ<input name="countryOfOrigin" maxLength={100} /></label><label>Mã OEM (cách nhau bằng dấu phẩy)<input name="oemCodes" /></label><label>Mã vạch (cách nhau bằng dấu phẩy)<input name="barcodes" /></label><label>Dòng xe tương thích<select name="vehicleModelIds" multiple>{models.map(m => <option key={m.id} value={m.id}>{m.manufacturer} {m.modelName}</option>)}</select></label><label>Thông số kỹ thuật<textarea name="specifications" maxLength={5000} /></label></fieldset>{formError && <p role="alert">{formError}</p>}</form></FormDialog>}</main>
}

