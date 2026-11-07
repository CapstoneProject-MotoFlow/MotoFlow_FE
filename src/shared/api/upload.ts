import axiosClient from './axiosClient'
import { isAxiosError } from 'axios'

type Signature = {
  uploadUrl: string
  apiKey: string
  timestamp: number
  signature: string
  folder: string
  type: string
  allowedFormats: string
}

async function uploadFile(file: File, purpose: 'PRODUCT_IMAGE' | 'ATTACHMENT') {
  const formats =
    purpose === 'ATTACHMENT'
      ? ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
      : ['image/jpeg', 'image/png', 'image/webp']
  if (
    !formats.includes(file.type) ||
    !file.size ||
    (purpose === 'ATTACHMENT' && file.size > 10 * 1024 * 1024)
  ) {
    throw new Error(
      purpose === 'ATTACHMENT'
        ? 'Chứng từ phải là JPG, PNG, WebP hoặc PDF, tối đa 10 MB.'
        : 'Ảnh phải là JPG, PNG hoặc WebP.',
    )
  }
  const { data } = await axiosClient.post<Signature>('/uploads/signature', {
    purpose,
  })
  const fields = new FormData()
  fields.append('file', file)
  fields.append('api_key', data.apiKey)
  fields.append('timestamp', String(data.timestamp))
  fields.append('signature', data.signature)
  fields.append('folder', data.folder)
  fields.append('type', data.type)
  fields.append('allowed_formats', data.allowedFormats)
  const response = await fetch(data.uploadUrl, { method: 'POST', body: fields })
  if (!response.ok) throw new Error('Không tải được tệp. Vui lòng thử lại.')
  return (await response.json()) as { public_id?: string; secure_url?: string }
}

export async function uploadAttachment(file: File) {
  const uploaded = await uploadFile(file, 'ATTACHMENT').catch((error) => {
    if (isAxiosError(error) && error.response?.data?.code === 'MSG76') {
      throw new Error(
        'Chức năng tải tệp chưa sẵn sàng. Vui lòng báo quản trị viên.',
      )
    }
    throw error
  })
  if (!uploaded.public_id)
    throw new Error('Không nhận được mã tệp đã tải. Vui lòng thử lại.')
  return {
    storageKey: uploaded.public_id,
    fileName: file.name,
    contentType: file.type,
    fileSize: file.size,
  }
}

export async function uploadProductImage(file: File) {
  const uploaded = await uploadFile(file, 'PRODUCT_IMAGE')
  if (!uploaded.secure_url)
    throw new Error('Không nhận được đường dẫn ảnh. Vui lòng thử lại.')
  return uploaded.secure_url
}
