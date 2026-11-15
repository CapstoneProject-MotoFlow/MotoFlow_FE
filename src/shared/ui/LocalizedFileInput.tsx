import { useId, useState, type ChangeEvent, type InputHTMLAttributes } from 'react'
import './localized-file-input.css'

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange'> & {
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void
  buttonText?: string
}

export default function LocalizedFileInput({
  id,
  onChange,
  buttonText = 'Chọn tệp',
  ...props
}: Props) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const [names, setNames] = useState('')
  return (
    <div className="localized-file-input">
      <input
        {...props}
        id={inputId}
        type="file"
        className="localized-file-input-native"
        onChange={(event) => {
          setNames(Array.from(event.currentTarget.files ?? []).map((file) => file.name).join(', '))
          onChange?.(event)
        }}
      />
      <label className="localized-file-input-label" htmlFor={inputId}>
        <span>{buttonText}</span>
        <small>{names || 'Chưa chọn tệp'}</small>
      </label>
    </div>
  )
}
