/**
 * File: modules/receiving/LotDatesDialog.tsx
 * Loại: FORM / POPUP — mở từ nút "Có HSD" ở bảng kiểm từng phụ tùng.
 * Công dụng: Mục 9 (PM 19/11): bảng kiểm nhận tạm ẩn 2 cột Ngày sản xuất và Hạn dùng. Phụ tùng có
 * hạn sử dụng thì người kiểm bấm "Có HSD" để nhập 2 ngày này trong popup.
 */
import { useState, type FormEvent } from 'react'
import FormDialog from '../../shared/ui/FormDialog'

export type LotDates = { manufactureDate: string; expiryDate: string }

export default function LotDatesDialog({
  sku,
  partName,
  value,
  onClose,
  onSave,
}: {
  sku: string
  partName: string
  value: LotDates | undefined
  onClose: () => void
  onSave: (dates: LotDates) => void
}) {
  const [manufactureDate, setManufactureDate] = useState(
    value?.manufactureDate ?? '',
  )
  const [expiryDate, setExpiryDate] = useState(value?.expiryDate ?? '')
  const [error, setError] = useState('')
  const hadDates = !!(value?.manufactureDate || value?.expiryDate)

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    // Popup nằm trong cây React của form kiểm nhận: không để sự kiện submit lan ra form đó.
    event.stopPropagation()
    if (!expiryDate) {
      setError('Vui lòng nhập hạn dùng.')
      return
    }
    if (manufactureDate && expiryDate < manufactureDate) {
      setError('Hạn dùng không được trước ngày sản xuất.')
      return
    }
    onSave({ manufactureDate, expiryDate })
  }

  return (
    <FormDialog
      title={'Hạn sử dụng · ' + sku}
      formId="receipt-lot-dates"
      submitLabel="Lưu"
      onClose={onClose}
      footerExtra={
        hadDates && (
          <button
            type="button"
            className="secondary-button"
            onClick={() => onSave({ manufactureDate: '', expiryDate: '' })}
          >
            Bỏ hạn dùng
          </button>
        )
      }
    >
      <form id="receipt-lot-dates" noValidate onSubmit={submit}>
        <p>{partName}</p>
        <label>
          Ngày sản xuất
          <input
            type="date"
            value={manufactureDate}
            onChange={(event) => {
              setManufactureDate(event.target.value)
              setError('')
            }}
          />
        </label>
        <label>
          <span>
            Hạn dùng <b aria-hidden="true">*</b>
          </span>
          <input
            type="date"
            required
            aria-invalid={!!error}
            value={expiryDate}
            onChange={(event) => {
              setExpiryDate(event.target.value)
              setError('')
            }}
          />
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </form>
    </FormDialog>
  )
}
