import { isAxiosError } from 'axios'
import axiosClient from '../../shared/api/axiosClient'

type Signature = {
  uploadUrl: string
  apiKey: string
  timestamp: number
  signature: string
  folder: string
  type: string
  allowedFormats: string
}

export async function uploadReceiptDocument(file: File) {
  if (
    !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
    !file.size ||
    file.size > 10 * 1024 * 1024
  ) {
    throw new Error(
      'Ảnh chứng từ phải là JPG, PNG hoặc WebP và có dung lượng tối đa 10 MB.',
    )
  }
  const { data } = await axiosClient
    .post<Signature>('/uploads/signature', { purpose: 'ATTACHMENT' })
    .catch((error) => {
      if (
        isAxiosError<{ code?: string }>(error) &&
        error.response?.data?.code === 'MSG76'
      ) {
        throw new Error(
          'MSG76 · BE chưa cấu hình tải ảnh chứng từ. Chưa thể lập phiếu nhập trên môi trường này.',
        )
      }
      throw error
    })
  const fields = new FormData()
  fields.append('file', file)
  fields.append('api_key', data.apiKey)
  fields.append('timestamp', String(data.timestamp))
  fields.append('signature', data.signature)
  fields.append('folder', data.folder)
  fields.append('type', data.type)
  fields.append('allowed_formats', data.allowedFormats)
  const result = await fetch(data.uploadUrl, { method: 'POST', body: fields })
  if (!result.ok)
    throw new Error('Không tải được ảnh chứng từ. Vui lòng thử lại.')
  const uploaded: { public_id?: string } = await result.json()
  if (!uploaded.public_id)
    throw new Error('Máy chủ tải ảnh không trả về mã tệp.')
  return {
    storageKey: uploaded.public_id,
    fileName: file.name,
    contentType: file.type,
    fileSize: file.size,
  }
}
