import { useId } from 'react'

export default function InspectionNoteField({
  value,
  onChange,
  required,
  disabled,
}: {
  value: string
  onChange: (value: string) => void
  required: boolean
  disabled: boolean
}) {
  const errorId = useId()
  const missing = required && !value.trim()
  return (
    <label>
      Ghi chú kiểm hàng{required ? ' *' : ' (không bắt buộc)'}
      <textarea
        rows={2}
        maxLength={500}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-required={required}
        aria-invalid={missing}
        aria-describedby={missing ? errorId : undefined}
        disabled={disabled}
      />
      {missing && (
        <small id={errorId} className="stock-error">
          Nhập ghi chú khi có hàng thiếu, thừa, giao sai hoặc hư hỏng.
        </small>
      )}
    </label>
  )
}
