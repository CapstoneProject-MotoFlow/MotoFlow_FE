import { useState, type FormEvent } from 'react'
import FormDialog from '../../../shared/ui/FormDialog'
import { supplierApiMessage, type Supplier } from '../types'
type Fields = 'supplierName' | 'taxCode' | 'contactName' | 'phone' | 'email' | 'address'
export default function SupplierForm({ supplier, onClose }: { supplier?: Supplier; onClose: () => void }) {
  const [values, setValues] = useState<Record<Fields, string>>({ supplierName: supplier?.supplierName || '', taxCode: supplier?.taxCode || '', contactName: supplier?.contactName || '', phone: supplier?.phone || '', email: supplier?.email || '', address: supplier?.address || '' })
  const [status, setStatus] = useState<Supplier['status']>(supplier?.status || 'ACTIVE')
  const [error, setError] = useState('')
  const input = (name: Fields, label: string, maxLength: number, type = 'text') => <label key={name}><span>{label} <b>*</b></span><input name={name} required maxLength={maxLength} type={type} pattern={name === 'phone' ? '[0-9+ ()-]{8,20}' : undefined} title={name === 'phone' ? 'Nhập số điện thoại từ 8 đến 20 ký tự.' : undefined} value={values[name]} onChange={event => { setValues(current => ({ ...current, [name]: event.target.value })); setError('') }} /></label>
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (Object.values(values).some(value => !value.trim())) { setError('Vui lòng nhập đầy đủ các trường bắt buộc.'); return }
    setError(supplierApiMessage)
  }
  return <FormDialog title={supplier ? `Sửa ${supplier.supplierName}` : 'Thêm nhà cung cấp'} formId="supplier-form" submitLabel={supplier ? 'Lưu thay đổi' : 'Thêm nhà cung cấp'} onClose={onClose}><form id="supplier-form" className="supplier-form" onSubmit={submit}>{input('supplierName', 'Tên nhà cung cấp', 150)}<div className="supplier-form-row">{input('taxCode', 'Mã số thuế', 20)}{input('contactName', 'Người liên hệ', 100)}</div><div className="supplier-form-row">{input('phone', 'Điện thoại', 20, 'tel')}{input('email', 'Email', 100, 'email')}</div>{input('address', 'Địa chỉ', 255)}{supplier && <div className="supplier-form-row"><label><span>Trạng thái <b>*</b></span><select name="status" required value={status} onChange={event => { setStatus(event.target.value as Supplier['status']); setError('') }}><option value="ACTIVE">Đang giao dịch</option><option value="INACTIVE">Ngừng giao dịch</option></select></label></div>}<p className="suppliers-api-note">{supplierApiMessage}</p>{error && <p className="form-error" role="alert">{error}</p>}</form></FormDialog>
}
