import ProductImagePicker from './ProductImagePicker'
import { useEffect, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import axiosClient from '../../../shared/api/axiosClient'
import '../owner.css'
import './products.css'
import './product-create.css'
type Category = { id: number; categoryName: string; vehicleType: string; children: Category[]; status: string }
type Model = { id: number; manufacturer: string; modelName: string }
function Codes({ label, values, onChange }: { label: string; values: string[]; onChange: (values: string[]) => void }) {
  const [text, setText] = useState('')
  function add(event: KeyboardEvent<HTMLInputElement>) { if (event.key === 'Enter' || event.key === ',') { event.preventDefault(); const value = text.trim(); if (value && !values.includes(value)) onChange([...values, value]); setText('') } }
  return <label>{label}<div className="part-tags">{values.map(value => <button type="button" key={value} onClick={() => onChange(values.filter(x => x !== value))}>{value} ×</button>)}<input aria-label={label} placeholder="Nhập mã rồi nhấn Enter" value={text} maxLength={100} onChange={e => setText(e.target.value)} onKeyDown={add} onBlur={() => { if (text.trim() && !values.includes(text.trim())) onChange([...values, text.trim()]); setText('') }} /></div></label>
}
export default function ProductCreatePage() {
  const navigate = useNavigate()
  const [categories, setCategories] = useState<Category[]>([])
  const [models, setModels] = useState<Model[]>([])
  const [vehicleType, setVehicleType] = useState('MOTORCYCLE')
  const [parent, setParent] = useState('')
  const [oem, setOem] = useState<string[]>([])
  const [barcodes, setBarcodes] = useState<string[]>([])
  const [selected, setSelected] = useState<number[]>([])
  const [query, setQuery] = useState('')
  const [files, setFiles] = useState<File[]>([])

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  useEffect(() => { let active = true; Promise.all([axiosClient.get<Category[]>('/part-categories'), axiosClient.get<Model[]>('/vehicle-models')]).then(([a,b]) => { if(active) { setCategories(a.data); setModels(b.data) } }).catch(() => { if(active) setError('Không tải được danh mục. Vui lòng tải lại trang.') }).finally(() => { if(active) setLoading(false) }); return () => { active = false } }, [])
  const roots = categories.filter(c => c.vehicleType === vehicleType && c.status === 'ACTIVE')
  const root = roots.find(c => String(c.id) === parent)
  function leaves(nodes: Category[]): Category[] { return nodes.flatMap(c => c.children.length ? leaves(c.children) : [c]) }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if(saving) return; if (files.length) { setError('Chưa thể lưu ảnh đã chọn: BE chưa có API tải ảnh. Hãy xóa ảnh để lưu phụ tùng không kèm ảnh.'); return }
    const form = new FormData(event.currentTarget); setSaving(true); setError('')
    try { await axiosClient.post('/products', { sku: form.get('sku'), partName: form.get('partName'), categoryId: Number(form.get('categoryId') || parent), brand: form.get('brand'), countryOfOrigin: form.get('countryOfOrigin'), baseUnit: form.get('baseUnit'), specifications: form.get('specifications'), oemCodes: oem, barcodes, vehicleModelIds: selected, imageUrls: [] }); navigate('/owner/products') }
    catch (err) { const response = (err as { response?: { data?: { message?: string } } }).response; setError(response?.data?.message || 'Không lưu được phụ tùng. Vui lòng kiểm tra thông tin và thử lại.') } finally { setSaving(false) }
  }
  return <main className="dashboard-content part-create"><div className="parts-heading"><h1>Thêm phụ tùng</h1><span><Link to="/dashboard">Trang chủ</Link> › <Link to="/owner/products">Phụ tùng</Link> › Thêm mới</span></div>{error && <p role="alert" className="part-create-error">{error}</p>}<form onSubmit={save}><fieldset disabled={saving || loading}><div className="part-create-grid"><div className="part-create-main"><section className="owner-panel"><h2>Thông tin cơ bản</h2><div className="part-create-fields"><label className="part-wide">Tên phụ tùng *<input name="partName" required maxLength={200} /></label><label>Mã SKU *<input name="sku" required pattern="[A-Za-z0-9._-]{1,50}" maxLength={50} title="Chữ không dấu, số và dấu . _ -" /></label><label>Loại xe *<select value={vehicleType} onChange={e => { setVehicleType(e.target.value); setParent('') }}><option value="MOTORCYCLE">Xe máy</option><option value="BICYCLE">Xe đạp</option><option value="E_MOTORCYCLE">Xe máy điện</option><option value="E_BICYCLE">Xe đạp điện</option></select></label><label>Nhóm phụ tùng *<select required value={parent} onChange={e => setParent(e.target.value)}><option value="">Chọn nhóm phụ tùng</option>{roots.map(c => <option key={c.id} value={c.id}>{c.categoryName}</option>)}</select></label>{root && root.children.length > 0 && <label>Nhóm con *<select name="categoryId" required key={parent}><option value="">Chọn nhóm con</option>{leaves(root.children).filter(c => c.status === 'ACTIVE').map(c => <option key={c.id} value={c.id}>{c.categoryName}</option>)}</select></label>}<label>Nhà sản xuất *<input name="brand" required maxLength={100} /></label><label>Xuất xứ<input name="countryOfOrigin" maxLength={100} /></label><label>Đơn vị tính cơ sở *<input name="baseUnit" required maxLength={20} placeholder="Ví dụ: cái, bộ, chai" /></label><label className="part-wide">Thông số kỹ thuật<textarea name="specifications" maxLength={5000} rows={4} /></label></div></section><section className="owner-panel"><h2>Mã bổ sung</h2><div className="part-create-codes"><Codes label="Mã OEM" values={oem} onChange={setOem} /><Codes label="Mã vạch" values={barcodes} onChange={setBarcodes} /></div></section><section className="owner-panel"><h2>Dòng xe tương thích</h2><div className="part-create-body"><input aria-label="Tìm dòng xe" placeholder="Tìm dòng xe theo hãng hoặc tên" value={query} onChange={e => setQuery(e.target.value)} /><div className="part-tags">{models.filter(m => selected.includes(m.id)).map(m => <button key={m.id} type="button" onClick={() => setSelected(selected.filter(id => id !== m.id))}>{m.manufacturer} {m.modelName} ×</button>)}</div><div className="part-model-options">{models.filter(m => !selected.includes(m.id) && `${m.manufacturer} ${m.modelName}`.toLowerCase().includes(query.toLowerCase())).map(m => <button key={m.id} type="button" onClick={() => setSelected([...selected, m.id])}>＋ {m.manufacturer} {m.modelName}</button>)}</div>{!models.length && <small>Chưa có dòng xe trong danh mục.</small>}</div></section></div><aside><section className="owner-panel"><h2>Ảnh phụ tùng</h2><ProductImagePicker onChange={setFiles} /></section><section className="owner-panel part-create-actions"><button className="ui-confirm-button" type="submit">{saving ? 'Đang lưu…' : loading ? 'Đang tải…' : 'Lưu phụ tùng'}</button><Link to="/owner/products">Hủy</Link></section></aside></div></fieldset></form></main>
}

