/**
 * File: modules/receiving/ReceiptDocuments.tsx
 * Loại: THÀNH PHẦN DÙNG CHUNG — không phải màn hình.
 * Công dụng: Một kiểu xem ảnh cho mọi màn phiếu nhận (PM 17/11, mở rộng G05): hiện tên ảnh và nút
 * "Xem ảnh …", bấm mới tải link mới rồi mở trình xem ảnh nổi (mục E, PM 19/11). Tệp không phải ảnh hiện link.
 * Phiếu nhập NCC tải lại từ GET /goods-receipt-notes/{id}; màn khác (phiếu nhận điều chuyển) truyền reload.
 */
import { useState } from 'react'
import axiosClient from '../../shared/api/axiosClient'
import ImageViewer, { type ViewerImage } from '../../shared/ui/ImageViewer'
import { apiMessage } from '../suppliers/supplierService'
import './receiving.css'

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
  const [images, setImages] = useState<ViewerImage[]>()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const files = documents.filter((file) => !isImage(file))
  const imageFiles = documents.filter(isImage)
  if (!documents.length) return null

  // Mục E (PM 19/11): ảnh mở trong trình xem ảnh nổi, chuyển qua lại giữa các ảnh.
  async function openImages() {
    setError('')
    setLoading(true)
    try {
      // The download URLs expire, so request fresh ones when opening the viewer.
      const fresh = await (reload ? reload() : reloadGoodsReceipt(receiptId))
      const shown = fresh
        .filter(isImage)
        .flatMap((file) =>
          file.downloadUrl
            ? [{ src: file.downloadUrl, name: file.fileName }]
            : [],
        )
      if (shown.length) setImages(shown)
      else setError('Ảnh chưa có liên kết tải.')
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
            disabled={loading}
            onClick={() => void openImages()}
          >
            {loading ? 'Đang tải ảnh…' : 'Xem ' + label}
          </button>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
      {images && (
        <ImageViewer images={images} onClose={() => setImages(undefined)} />
      )}
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
