import { useState } from 'react'
export default function ProductImageUrls({
  values,
  onChange,
}: {
  values: string[]
  onChange: (values: string[]) => void
}) {
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  function add() {
    const value = url.trim()
    if (!/^https:\/\/\S{1,492}$/.test(value)) {
      setError('Ảnh phải là đường dẫn HTTPS, tối đa 500 ký tự.')
      return
    }
    if (values.includes(value)) {
      setError('Ảnh này đã được thêm.')
      return
    }
    if (values.length >= 3) {
      setError('Tối đa 3 ảnh.')
      return
    }
    onChange([...values, value])
    setUrl('')
    setError('')
  }
  return (
    <div className="part-create-body">
      <p>Thêm tối đa 3 ảnh bằng URL HTTPS. Ảnh đầu tiên là ảnh chính.</p>
      <input
        aria-label="Đường dẫn ảnh"
        placeholder="https://…"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            add()
          }
        }}
      />
      <button type="button" disabled={values.length >= 3} onClick={add}>
        Thêm ảnh
      </button>
      {values.map((value, i) => (
        <div className="part-image" key={value}>
          <img src={value} alt={`Ảnh phụ tùng ${i + 1}`} />
          <span>{i === 0 ? 'Ảnh chính' : `Ảnh ${i + 1}`}</span>
          {i > 0 && (
            <button
              type="button"
              onClick={() =>
                onChange([value, ...values.filter((x) => x !== value)])
              }
            >
              Đặt ảnh chính
            </button>
          )}
          <button
            type="button"
            aria-label={`Xóa ảnh ${i + 1}`}
            onClick={() => onChange(values.filter((x) => x !== value))}
          >
            ×
          </button>
        </div>
      ))}
      {error && <p role="alert">{error}</p>}
      <small>Chưa hỗ trợ tải tệp từ máy.</small>
    </div>
  )
}
