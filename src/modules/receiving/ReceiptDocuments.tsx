/**
 * File: modules/receiving/ReceiptDocuments.tsx
 * Loại: THÀNH PHẦN DÙNG CHUNG — không phải màn hình.
 * Công dụng: Một kiểu xem ảnh cho mọi màn phiếu nhận (PM 17/11, mở rộng G05): hiện tên ảnh và nút
 * "Xem ảnh …", bấm mới tải link mới rồi mở ảnh (link tải hết hạn sau một lúc). Tệp không phải ảnh hiện link.
 * Phiếu nhập NCC tải lại từ GET /goods-receipt-notes/{id}; màn khác (phiếu nhận điều chuyển) truyền reload.
 */
import { useId, useState } from 'react'
import axiosClient from '../../shared/api/axiosClient'
import { apiMessage } from '../suppliers/supplierService'
import ReceiptImage from './ReceiptImage'

export type ReceiptDocument = {
  id: number
  fileName: string
  contentType?: string | null
  downloadUrl: string | null
}

function isImage(file: ReceiptDocument) {
  return !!file.contentType?.startsWith('image/')
}

async function reloadGoodsReceipt(receiptId: number) {
  const { data } = await axiosClient.get<{ documents: ReceiptDocument[] }>(
    '/goods-receipt-notes/' + receiptId,
  )
  return data.documents
}

export default function ReceiptDocuments({
  receiptId,
  documents = [],
  reload,
  label = 'ảnh chứng từ',
}: {
  receiptId: number
  documents?: ReceiptDocument[]
  /** Lấy lại danh sách tệp kèm link tải mới; mặc định đọc phiếu nhập NCC. */
  reload?: () => Promise<ReceiptDocument[]>
  /** Tên loại ảnh trên nút, ví dụ "ảnh nhận hàng" cho phiếu nhận điều chuyển. */
  label?: string
}) {
  const previewId = useId()
  const [images, setImages] = useState<ReceiptDocument[]>()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const files = documents.filter((file) => !isImage(file))
  const imageFiles = documents.filter(isImage)
  if (!documents.length) return null

  async function toggleImages() {
    if (images) {
      setImages(undefined)
      return
    }
    setError('')
    setLoading(true)
    try {
      // The download URLs expire, so request fresh ones when opening the preview.
      const fresh = await (reload ? reload() : reloadGoodsReceipt(receiptId))
      setImages(fresh.filter(isImage))
    } catch (error) {
      setError(apiMessage(error))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="receiving-receipt-documents">
      {imageFiles.length > 0 && (
        <div className="receiving-image-document-actions">
          <ul className="receiving-document-list" aria-label={'Tên ' + label}>
            {imageFiles.map((file) => (
              <li key={file.id}>{file.fileName}</li>
            ))}
          </ul>
          <button
            type="button"
            className="mf-btn mf-btn--secondary"
            aria-expanded={!!images}
            aria-controls={previewId}
            disabled={loading}
            onClick={() => void toggleImages()}
          >
            {loading ? 'Đang tải ảnh…' : (images ? 'Ẩn ' : 'Xem ') + label}
          </button>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
      <div id={previewId} hidden={!images}>
        {images && (
          <ul
            className="receiving-document-list"
            aria-label={label.charAt(0).toUpperCase() + label.slice(1)}
          >
            {images.map((file) => (
              <li key={file.id}>
                {file.downloadUrl ? (
                  <ReceiptImage src={file.downloadUrl} name={file.fileName} />
                ) : (
                  <span>{file.fileName} · Không có liên kết tải</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      {files.length > 0 && (
        <ul className="receiving-document-list" aria-label="Tệp chứng từ">
          {files.map((file) => (
            <li key={file.id}>
              {file.downloadUrl ? (
                <a href={file.downloadUrl} target="_blank" rel="noreferrer">
                  {file.fileName}
                </a>
              ) : (
                file.fileName
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
