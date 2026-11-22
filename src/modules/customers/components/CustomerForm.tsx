/**
 * File: modules/customers/components/CustomerForm.tsx
 * Loại: FORM / POPUP — mở bên trong màn hình, không phải trang riêng.
 * Công dụng: Form tạo/sửa thông tin liên hệ; lưu bằng POST/PUT; báo lỗi; khóa khi gửi.
 */
import { useState, type FormEvent } from 'react'
import { isAxiosError } from 'axios'
import FormDialog from '../../../shared/ui/FormDialog'
import FieldError from '../../../shared/ui/FieldError'
import axiosClient from '../../../shared/api/axiosClient'
import { useFormValidation } from '../../../shared/hooks/useFormValidation'
import type { Customer } from '../types'
import { apiMessage } from '../../suppliers/supplierService'
import '../customer-form.css'
/** CustomerForm: Form tạo/sửa thông tin liên hệ; lưu bằng POST/PUT; báo lỗi; khóa khi gửi. */
export default function CustomerForm({
  customer,
  onClose,
  onSaved,
}: {
  customer?: Customer
  onClose: () => void
  onSaved: (customer: Customer) => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  // Góp ý UI 21/11: số điện thoại là bắt buộc; BE trả fieldErrors.phone khi thiếu hoặc sai.
  const [phoneError, setPhoneError] = useState('')
  const validation = useFormValidation()
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    if (!validation.check(event.currentTarget)) return
    const form = new FormData(event.currentTarget)
    const body = Object.fromEntries(
      [...form].map(([key, value]) => [key, String(value).trim()]),
    )
    setBusy(true)
    setError('')
    setPhoneError('')
    try {
      const response = customer
        ? await axiosClient.put<Customer>(`/customers/${customer.id}`, body)
        : await axiosClient.post<Customer>('/customers', body)
      onSaved(response.data)
    } catch (e) {
      const phone = isAxiosError<{ fieldErrors?: Record<string, string> }>(e)
        ? e.response?.data?.fieldErrors?.phone
        : undefined
      if (phone) setPhoneError(phone)
      else setError(apiMessage(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <FormDialog
      busy={busy}
      title={customer ? 'Sửa khách hàng' : 'Thêm khách hàng'}
      formId="customer-form"
      submitLabel={busy ? 'Đang lưu…' : 'Lưu khách hàng'}
      onClose={() => {
        if (!busy) onClose()
      }}
    >
      <form
        id="customer-form"
        className="customer-edit-form"
        noValidate
        onInput={validation.onInput}
        onSubmit={submit}
      >
        <fieldset disabled={busy}>
          <label>
            Tên khách hoặc tên cửa hàng <b>*</b>
            <input
              name="customerName"
              required
              maxLength={150}
              placeholder="Ví dụ: Garage Tuấn Phát…"
              defaultValue={customer?.customerName}
            />
          </label>
          <div className="customer-edit-row">
            <label>
              Số điện thoại <b>*</b>
              <input
                name="phone"
                type="tel"
                required
                data-required-message="Vui lòng nhập số điện thoại."
                pattern="[0-9+ ]{8,20}"
                maxLength={20}
                title="8–20 ký tự, chỉ gồm số, dấu + và khoảng trắng"
                placeholder="09xx xxx xxx"
                defaultValue={customer?.phone || ''}
              />
              <FieldError
                message={validation.errors['phone'] || phoneError || undefined}
              />
            </label>
            <label>
              Mã số thuế
              <input
                name="taxCode"
                pattern="[0-9]{10}(-?[0-9]{3})?"
                maxLength={14}
                title="10 hoặc 13 chữ số"
                defaultValue={customer?.taxCode || ''}
              />
            </label>
          </div>
          <label>
            Địa chỉ
            <input
              name="address"
              maxLength={255}
              defaultValue={customer?.address || ''}
            />
          </label>
        </fieldset>
        {error && <p role="alert">{error}</p>}
      </form>
    </FormDialog>
  )
}
