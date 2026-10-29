import { useEffect, useRef, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import type { Customer, CustomerFormValues } from '../types'
import { customerApiMessage } from '../types'
export default function CustomerForm({ customer, onClose }: { customer?: Customer; onClose: () => void }) {
  const [form, setForm] = useState<CustomerFormValues>({ customerName: customer?.customerName || '', phone: customer?.phone || '', contactName: '', address: customer?.address || '', taxCode: customer?.taxCode || '', notes: '' })
  const [error, setError] = useState('')
  const dialog = useRef<HTMLElement>(null)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialog.current?.querySelector<HTMLInputElement>('input')?.focus()
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'Tab') {
        const elements = Array.from(dialog.current?.querySelectorAll<HTMLElement>('input:not(:disabled), textarea:not(:disabled), button:not(:disabled)') || [])
        const first = elements[0], last = elements.at(-1)
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
      }
    }
    document.addEventListener('keydown', key)
    return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', key); previous?.focus() }
  }, [onClose])
  const field = (name: keyof CustomerFormValues, value: string) => { setForm(current => ({ ...current, [name]: value })); setError('') }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!form.customerName.trim() || !form.phone.trim()) { setError('Vui lòng nhập tên khách hàng và số điện thoại.'); return }
    setError(customerApiMessage)
  }
  return createPortal(<div className="customer-dialog-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}><section ref={dialog} className="customer-dialog" role="dialog" aria-modal="true" aria-labelledby="customer-form-title"><header><h2 id="customer-form-title">{customer ? 'Sửa khách hàng' : 'Thêm khách hàng'}</h2><button type="button" aria-label="Đóng" onClick={onClose}>×</button></header><form id="customer-form" onSubmit={submit} className="customer-form"><label><span>Tên khách hoặc tên cửa hàng <b>*</b></span><input required maxLength={150} value={form.customerName} placeholder="Nhập tên khách hoặc tên cửa hàng" onChange={event => field('customerName', event.target.value)} /></label><div className="customer-form-row"><label><span>Số điện thoại <b>*</b></span><input required type="tel" maxLength={20} pattern="[0-9+ ()-]{8,20}" title="Nhập số điện thoại từ 8 đến 20 ký tự." value={form.phone} placeholder="09xx xxx xxx" onChange={event => field('phone', event.target.value)} /></label><label><span>Người liên hệ</span><input maxLength={150} value={form.contactName} onChange={event => field('contactName', event.target.value)} /></label></div><label><span>Địa chỉ</span><input maxLength={255} value={form.address} onChange={event => field('address', event.target.value)} /></label><div className="customer-form-row"><label><span>Mã số thuế</span><input maxLength={20} value={form.taxCode} onChange={event => field('taxCode', event.target.value)} /></label></div><label><span>Ghi chú</span><textarea maxLength={1000} rows={3} value={form.notes} onChange={event => field('notes', event.target.value)} /></label><p className="customer-api-note">Chưa có API lưu khách hàng. Người liên hệ và ghi chú chưa có trường tương ứng trong dữ liệu hiện tại.</p>{error && <p className="form-error" role="alert">{error}</p>}</form><footer><button type="button" className="secondary-button" onClick={onClose}>Hủy</button><button type="submit" form="customer-form" className="customer-primary">{customer ? 'Lưu thay đổi' : 'Thêm khách hàng'}</button></footer></section></div>, document.body)
}
