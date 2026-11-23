import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react'
import './localized-file-input.css'
import ImageViewer from './ImageViewer'

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange'> & {
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void
  buttonText?: string
  children?: ReactNode
}

const sameFile = (a: File, b: File) =>
  a.name === b.name && a.size === b.size && a.lastModified === b.lastModified

/**
 * Ô chọn tệp tiếng Việt.
 * PM 22/11: với `multiple`, mỗi lần chọn thêm sẽ cộng dồn (không thay tệp đã chọn); mỗi tệp có nút ✕ để bỏ trước
 * khi gửi; bấm ảnh nhỏ để xem, lật qua lại giữa các ảnh. Danh sách tệp được ghi lại vào chính ô input, nên form đọc
 * bằng FormData và màn đọc `event.target.files` trong onChange đều nhận đúng danh sách sau khi bỏ.
 * Màn tự giữ danh sách riêng (gán `value = ''` sau khi đọc) thì ô này không giữ thêm.
 */
export default function LocalizedFileInput({
  id,
  onChange,
  buttonText = 'Chọn tệp',
  children,
  multiple,
  ...props
}: Props) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const input = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<File[]>([])
  const [viewing, setViewing] = useState<number>()
  // Review #72 (72-3): form.reset() xóa ô input nhưng không xóa state; nghe sự kiện reset của form để bỏ danh sách.
  useEffect(() => {
    const form = input.current?.form
    if (!form) return
    const clear = () => {
      setViewing(undefined)
      setFiles([])
    }
    form.addEventListener('reset', clear)
    return () => form.removeEventListener('reset', clear)
  }, [])
  const previews = useMemo(
    () =>
      files.map((file) => ({
        file,
        url: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
      })),
    [files],
  )
  useEffect(
    () => () =>
      previews.forEach((item) => item.url && URL.revokeObjectURL(item.url)),
    [previews],
  )
  const images = previews.flatMap((item) =>
    item.url ? [{ src: item.url }] : [],
  )

  /** Ghi danh sách vào ô input (để FormData / required thấy đúng) rồi báo cho màn cha. */
  function commit(next: File[], event?: ChangeEvent<HTMLInputElement>) {
    const element = input.current
    if (!element) return
    const transfer = new DataTransfer()
    next.forEach((file) => transfer.items.add(file))
    element.files = transfer.files
    onChange?.(
      event ??
        ({ target: element, currentTarget: element } as ChangeEvent<HTMLInputElement>),
    )
    // Màn cha đã tự lấy tệp và xóa ô (value = ''): danh sách do màn cha giữ.
    setFiles(element.files?.length ? next : [])
  }

  function remove(index: number) {
    setViewing(undefined)
    commit(files.filter((_, i) => i !== index))
  }

  return (
    <div className="localized-file-input">
      <input
        {...props}
        ref={input}
        id={inputId}
        multiple={multiple}
        type="file"
        className="localized-file-input-native"
        onChange={(event) => {
          const picked = Array.from(event.currentTarget.files ?? [])
          const next = multiple
            ? [...files, ...picked.filter((file) => !files.some((old) => sameFile(old, file)))]
            : picked
          commit(next, event)
        }}
      />
      <label className="localized-file-input-label" htmlFor={inputId}>
        <span>{multiple && files.length ? 'Chọn thêm' : buttonText}</span>
        {/* Mục 8 (PM 19/11): không hiện tên tệp, chỉ báo số tệp đã chọn. */}
        <small>{files.length ? 'Đã chọn ' + files.length + ' tệp' : 'Chưa chọn tệp'}</small>
      </label>
      {children}
      {previews.length > 0 && (
        <ul className="localized-file-input-previews">
          {previews.map((item, index) => {
            const imageIndex = images.findIndex((image) => image.src === item.url)
            return (
              <li key={index + ':' + item.file.name} className="localized-file-input-item">
                {item.url ? (
                  <button
                    type="button"
                    className="localized-file-input-thumb"
                    aria-label={'Xem ảnh ' + (imageIndex + 1)}
                    onClick={() => setViewing(imageIndex)}
                  >
                    <img src={item.url} alt="" />
                  </button>
                ) : (
                  <span>{item.file.type === 'application/pdf' ? 'PDF' : 'Tệp'}</span>
                )}
                <button
                  type="button"
                  className="localized-file-input-remove"
                  aria-label={'Bỏ tệp ' + (index + 1)}
                  title="Bỏ tệp này"
                  disabled={props.disabled}
                  onClick={() => remove(index)}
                >
                  ×
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {viewing != null && images.length > 0 && (
        <ImageViewer
          images={images}
          start={viewing}
          onClose={() => setViewing(undefined)}
        />
      )}
    </div>
  )
}
