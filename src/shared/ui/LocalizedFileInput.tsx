import {
  useEffect,
  useId,
  useState,
  type ChangeEvent,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react'
import './localized-file-input.css'
import PhotoButton from './PhotoButton'

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange'> & {
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void
  buttonText?: string
  children?: ReactNode
}

export default function LocalizedFileInput({
  id,
  onChange,
  buttonText = 'Chọn tệp',
  children,
  ...props
}: Props) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const [names, setNames] = useState('')
  // Báo lỗi 20/11 (mục 5): xem trước ảnh đã chọn; tệp khác (PDF) chỉ hiện nhãn.
  const [previews, setPreviews] = useState<
    { key: string; url: string | null; name: string }[]
  >([])
  useEffect(
    () => () =>
      previews.forEach((item) => item.url && URL.revokeObjectURL(item.url)),
    [previews],
  )
  return (
    <div className="localized-file-input">
      <input
        {...props}
        id={inputId}
        type="file"
        className="localized-file-input-native"
        onChange={(event) => {
          // Mục 8 (PM 19/11): không hiện tên tệp, chỉ báo số tệp đã chọn.
          const files = Array.from(event.currentTarget.files ?? [])
          setNames(files.length ? 'Đã chọn ' + files.length + ' tệp' : '')
          setPreviews(
            files.map((file, index) => ({
              key: index + ':' + file.name,
              url: file.type.startsWith('image/')
                ? URL.createObjectURL(file)
                : null,
              name: file.name,
            })),
          )
          onChange?.(event)
        }}
      />
      <label className="localized-file-input-label" htmlFor={inputId}>
        <span>{buttonText}</span>
        <small>{names || 'Chưa chọn tệp'}</small>
      </label>
      {children}
      {previews.some((item) => item.url) && (
        <PhotoButton
          label="Xem ảnh"
          images={previews.flatMap((item) =>
            item.url ? [{ src: item.url }] : [],
          )}
        />
      )}
    </div>
  )
}
