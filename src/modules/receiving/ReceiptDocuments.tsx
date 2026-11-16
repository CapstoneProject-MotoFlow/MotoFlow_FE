import { useId, useState } from 'react'
import axiosClient from '../../shared/api/axiosClient'
import { apiMessage } from '../suppliers/supplierService'
import ReceiptImage from './ReceiptImage'

export type ReceiptDocument = {
  id: number
  fileName: string
  contentType: string
  downloadUrl: string | null
}

function isImage(file: ReceiptDocument) {
  return file.contentType?.startsWith('image/')
}

export default function ReceiptDocuments({
  receiptId,
  documents = [],
}: {
  receiptId: number
  documents?: ReceiptDocument[]
}) {
  const previewId = useId()
  const [images, setImages] = useState<ReceiptDocument[]>()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const files = documents.filter((file) => !isImage(file))
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
      const { data } = await axiosClient.get<{ documents: ReceiptDocument[] }>(
        '/goods-receipt-notes/' + receiptId,
      )
      setImages(data.documents.filter(isImage))
    } catch (error) {
      setError(apiMessage(error))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="receiving-receipt-documents">
      {documents.some(isImage) && (
        <button
          type="button"
          className="mf-btn mf-btn--secondary"
          aria-expanded={!!images}
          aria-controls={previewId}
          disabled={loading}
          onClick={() => void toggleImages()}
        >
          {loading
            ? 'Đang tải ảnh…'
            : images
              ? 'Ẩn ảnh chứng từ'
              : 'Xem ảnh chứng từ'}
        </button>
      )}
      {error && <p role="alert">{error}</p>}
      <div id={previewId} hidden={!images}>
        {images && (
          <ul className="receiving-document-list" aria-label="Ảnh chứng từ">
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
