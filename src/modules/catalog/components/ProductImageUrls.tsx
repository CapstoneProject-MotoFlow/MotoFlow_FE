/**
 * File: modules/catalog/components/ProductImageUrls.tsx
 * Loại: THÀNH PHẦN / XỬ LÝ HỖ TRỢ — không phải màn hình độc lập.
 * Công dụng: Thêm ảnh phụ tùng từ tệp hoặc URL HTTPS và chọn ảnh chính.
 */
import { useState } from 'react'
import { isAxiosError } from 'axios'
import axiosClient from '../../../shared/api/axiosClient'

type UploadSignature = {
  uploadUrl: string
  apiKey: string
  timestamp: number
  signature: string
  folder: string
  type: string
  allowedFormats: string
}

export default function ProductImageUrls({
  values,
  onChange,
  uploading,
  onUploadingChange,
}: {
  values: string[]
  onChange: (values: string[]) => void
  uploading: boolean
  onUploadingChange: (uploading: boolean) => void
}) {
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  const [fileUploadUnavailable, setFileUploadUnavailable] = useState(false)
  function add(value: string) {
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
  async function upload(file: File) {
    onUploadingChange(true)
    setError('')
    try {
      const { data } = await axiosClient.post<UploadSignature>(
        '/uploads/signature',
        {
          purpose: 'PRODUCT_IMAGE',
        },
      )
      const body = new FormData()
      body.append('file', file)
      body.append('api_key', data.apiKey)
      body.append('timestamp', String(data.timestamp))
      body.append('signature', data.signature)
      body.append('folder', data.folder)
      body.append('type', data.type)
      body.append('allowed_formats', data.allowedFormats)
      const response = await fetch(data.uploadUrl, { method: 'POST', body })
      if (!response.ok) throw new Error('Image upload failed')
      const result: { secure_url?: string } = await response.json()
      add(result.secure_url ?? '')
    } catch (error) {
      if (
        isAxiosError<{ code?: string }>(error) &&
        error.response?.data?.code === 'MSG76'
      ) {
        setFileUploadUnavailable(true)
      } else {
        setError('Không tải được ảnh. Vui lòng thử lại hoặc nhập URL HTTPS.')
      }
    } finally {
      onUploadingChange(false)
    }
  }
  return (
    <div className="part-create-body">
      <p>
        Thêm tối đa 3 ảnh từ máy hoặc bằng URL HTTPS. Ảnh đầu tiên là ảnh chính.
      </p>
      <input
        type="file"
        aria-label="Chọn tệp ảnh phụ tùng"
        accept="image/jpeg,image/png,image/webp"
        disabled={uploading || fileUploadUnavailable || values.length >= 3}
        onChange={(event) => {
          const file = event.currentTarget.files?.[0]
          event.currentTarget.value = ''
          if (file) void upload(file)
        }}
      />
      {fileUploadUnavailable && (
        <p role="status">
          Môi trường này chưa bật tải tệp ảnh. Bạn có thể thêm ảnh bằng URL
          HTTPS.
        </p>
      )}
      {uploading && <p role="status">Đang tải ảnh…</p>}
      <input
        aria-label="Đường dẫn ảnh"
        placeholder="https://…"
        value={url}
        disabled={uploading}
        onChange={(e) => setUrl(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            add(url.trim())
          }
        }}
      />
      <button
        type="button"
        disabled={uploading || values.length >= 3}
        onClick={() => add(url.trim())}
      >
        Thêm ảnh
      </button>
      {values.map((value, i) => (
        <div className="part-image" key={value}>
          <img src={value} alt={`Ảnh phụ tùng ${i + 1}`} />
          <span>{i === 0 ? 'Ảnh chính' : `Ảnh ${i + 1}`}</span>
          {i > 0 && (
            <button
              type="button"
              disabled={uploading}
              onClick={() =>
                onChange([value, ...values.filter((x) => x !== value)])
              }
            >
              Đặt ảnh chính
            </button>
          )}
          <button
            type="button"
            disabled={uploading}
            aria-label={`Xóa ảnh ${i + 1}`}
            onClick={() => onChange(values.filter((x) => x !== value))}
          >
            ×
          </button>
        </div>
      ))}
      {error && <p role="alert">{error}</p>}
    </div>
  )
}
