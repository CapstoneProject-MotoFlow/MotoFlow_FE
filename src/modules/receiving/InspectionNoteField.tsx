import { useId } from 'react'

export default function InspectionNoteField({
  value,
  onChange,
  required,
  disabled,
  showError = true,
}: {
  value: string
  onChange: (value: string) => void
  required: boolean
  disabled: boolean
  showError?: boolean
}) {
  const errorId = useId()
  const missing = required && !value.trim()
  const showMissingError = missing && showError
  return (
    <label>
      Ghi chú kiểm hàng{required ? ' *' : ' (không bắt buộc)'}
      <textarea
        rows={2}
        maxLength={500}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-required={required}
        aria-invalid={showMissingError}
        aria-describedby={missing ? errorId : undefined}
        disabled={disabled}
      />
      {showMissingError ? (
        <small id={errorId} className="stock-error">
          Nhập ghi chú khi có hàng thiếu, thừa, giao sai hoặc hư hỏng.
        </small>
      ) : required && !value.trim() ? (
        <small id={errorId} className="mf-field-hint">
          Bắt buộc khi có hàng thiếu, thừa, giao sai hoặc hư hỏng.
        </small>
      ) : null}
    </label>
  )
}
