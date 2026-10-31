import { useState, type FormEvent } from 'react'
import FormDialog from '../../../shared/ui/FormDialog'
import type { Supplier } from '../types'
import { supplierService, apiMessage } from '../supplierService'
import '../supplier-redesign.css'
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
    const values = Object.fromEntries(new FormData(e.currentTarget))
    setBusy(true)
    setError('')
    let saved = false
    try {
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
              Mã nhà cung cấp *
              <input
                name="supplierCode"
                required
                maxLength={20}
                pattern="[A-Za-z0-9._-]{1,20}"
              />
            </label>
          )}
          <label>
            Tên nhà cung cấp *
            <input
              name="supplierName"
              required
              maxLength={150}
              defaultValue={supplier?.supplierName}
            />
          </label>
          <div className="supplier-edit-row">
            <label>
              Người liên hệ
              <input
                name="contactName"
                maxLength={100}
                defaultValue={supplier?.contactName || ''}
              />
            </label>
            <label>
              Điện thoại
              <input
                name="phone"
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
