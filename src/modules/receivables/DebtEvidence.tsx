import { useState } from 'react'
import ImageViewer from '../../shared/ui/ImageViewer'
import { isHttpUrl, isImageFile } from '../../shared/utils/imageFile'
import type { Evidence } from './types'
import { dateTime } from '../inventory/presentation'

/** Chứng từ của khoản nợ / phiếu thu. Mục E (PM 19/11): ảnh mở trong trình xem ảnh nổi; tệp khác mở tab mới. */
export default function DebtEvidence({ files }: { files?: Evidence[] }) {
  const [viewing, setViewing] = useState<number>()
  if (!files?.length) return null
  const images = files.filter(
    (file) => isHttpUrl(file.downloadUrl) && isImageFile(file.fileName),
  )
  return (
    <details className="rv-evidence-list">
      <summary>Chứng từ ({files.length})</summary>
      {files.map((file) => (
        <div key={file.id}>
          {images.includes(file) ? (
            <button
              type="button"
              className="rv-evidence-view"
              onClick={() => setViewing(images.indexOf(file))}
            >
              {file.fileName}
            </button>
          ) : isHttpUrl(file.downloadUrl) ? (
            <a href={file.downloadUrl} target="_blank" rel="noreferrer">
              {file.fileName}
            </a>
          ) : (
            <span>{file.fileName} · Chưa có liên kết tải</span>
          )}
          <small>
            {Math.ceil(file.fileSize / 1024)} KB · {file.uploadedByName ?? '—'}{' '}
            · {dateTime(file.uploadedAt)}
          </small>
        </div>
      ))}
      <small>
        Liên kết tải có thời hạn. Tải lại dữ liệu nếu liên kết hết hạn.
      </small>
      {viewing !== undefined && (
        <ImageViewer
          images={images.map((file) => ({
            src: file.downloadUrl ?? '',
            name: file.fileName,
          }))}
          start={viewing}
          onClose={() => setViewing(undefined)}
        />
      )}
    </details>
  )
}
