/**
 * File: modules/suppliers/components/SupplierForm.tsx
 * Loại: FORM / POPUP — mở bên trong màn hình, không phải trang riêng.
 * Công dụng: Form tạo/sửa nhà cung cấp, validation và trạng thái đang lưu.
 */
import { useState, type FormEvent } from 'react'
import FormDialog from '../../../shared/ui/FormDialog'
import type { Supplier } from '../types'
import { supplierService, apiMessage } from '../supplierService'
import '../supplier-redesign.css'
/** SupplierForm: Form tạo/sửa nhà cung cấp, validation và trạng thái đang lưu. */
export default function SupplierForm({
  supplier,
  onClose,
  onSaved,
}: {
  supplier?: Supplier
  onClose: () => void
  onSaved: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState(supplier?.status || 'ACTIVE')
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (busy) return
    const values = Object.fromEntries(
      Array.from(new FormData(e.currentTarget), ([key, value]) => [
        key,
        typeof value === 'string' ? value.trim() : value,
      ]),
    )
    if (!values.supplierName || !values.contactName || !values.phone) {
      setError(
        'Vui lòng nhập tên nhà cung cấp, người liên hệ và số điện thoại.',
      )
      return
    }
    setBusy(true)
    setError('')
    let saved = false
    try {
      if (
        await supplierService.nameExists(
          String(values.supplierName),
          supplier?.id,
        )
      ) {
        setError('Tên nhà cung cấp đã tồn tại. Vui lòng kiểm tra lại.')
        return
      }
      await supplierService.save(supplier?.id, values)
      saved = true
      if (supplier && status !== supplier.status)
        await supplierService.status(supplier)
      onSaved()
    } catch (e) {
      setError(
        (saved ? 'Thông tin đã lưu, nhưng chưa đổi được trạng thái. ' : '') +
          apiMessage(e),
      )
    } finally {
      setBusy(false)
    }
  }
  return (
    <FormDialog
      busy={busy}
      title={supplier ? `Sửa ${supplier.supplierName}` : 'Thêm nhà cung cấp'}
      formId="supplier-form"
      submitLabel={
        busy ? 'Đang lưu…' : supplier ? 'Lưu thay đổi' : 'Thêm nhà cung cấp'
      }
      onClose={() => {
        if (!busy) onClose()
      }}
    >
      <form id="supplier-form" className="supplier-edit" onSubmit={save}>
        <fieldset disabled={busy}>
          {!supplier && (
            <label>
              <span>
                Mã nhà cung cấp <b className="required">*</b>
              </span>
              <input
                name="supplierCode"
                required
                maxLength={20}
                pattern="[A-Za-z0-9._-]{1,20}"
              />
            </label>
          )}
          <label>
            <span>
              Tên nhà cung cấp <b className="required">*</b>
            </span>
            <input
              name="supplierName"
              required
              maxLength={150}
              defaultValue={supplier?.supplierName}
            />
          </label>
          <div className="supplier-edit-row">
            <label>
              <span>
                Người liên hệ <b className="required">*</b>
              </span>
              <input
                name="contactName"
                required
                maxLength={100}
                defaultValue={supplier?.contactName || ''}
              />
            </label>
            <label>
              <span>
                Số điện thoại <b className="required">*</b>
              </span>
              <input
                name="phone"
                required
                title="Nhập 8–20 ký tự gồm chữ số, dấu + hoặc khoảng trắng."
                type="tel"
                pattern="[0-9+ ]{8,20}"
                maxLength={20}
                defaultValue={supplier?.phone || ''}
              />
            </label>
          </div>
          <div className="supplier-edit-row">
            <label>
              Email
              <input
                name="email"
                type="email"
                maxLength={100}
                defaultValue={supplier?.email || ''}
              />
            </label>
            <label>
              Mã số thuế
              <input
                name="taxCode"
                pattern="[0-9]{10}(-?[0-9]{3})?"
                maxLength={14}
                defaultValue={supplier?.taxCode || ''}
              />
            </label>
          </div>
          <label>
            Địa chỉ
            <input
              name="address"
              maxLength={255}
              defaultValue={supplier?.address || ''}
            />
          </label>
          {supplier && (
            <div className="supplier-edit-row">
              <label>
                Trạng thái
                <select
                  value={status}
                  onChange={(e) =>
                    setStatus(e.target.value as Supplier['status'])
                  }
                >
                  <option value="ACTIVE">Đang giao dịch</option>
                  <option value="INACTIVE">Ngừng giao dịch</option>
                </select>
              </label>
            </div>
          )}
        </fieldset>
        {error && <p role="alert">{error}</p>}
      </form>
    </FormDialog>
  )
}
