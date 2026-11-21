import PhotoButton from '../../shared/ui/PhotoButton'
import { isHttpUrl, isImageFile } from '../../shared/utils/imageFile'
import type { Evidence } from './types'
import { dateTime } from '../inventory/presentation'

/** Chứng từ của khoản nợ / phiếu thu. Mục E (PM 19/11): ảnh mở trong trình xem ảnh nổi; tệp khác mở tab mới. */
export default function DebtEvidence({ files }: { files?: Evidence[] }) {
  if (!files?.length) return null
  const images = files.filter(
    (file) => isHttpUrl(file.downloadUrl) && isImageFile(file.fileName),
  )
  return (
    <div className="rv-evidence-list">
      <strong className="rv-evidence-title">Chứng từ ({files.length})</strong>
      {images.length > 0 && (
        <PhotoButton
          label="Xem ảnh"
          images={images.map((file) => ({ src: file.downloadUrl ?? '' }))}
        />
      )}
      {files.filter((file) => !images.includes(file)).map((file, index) => (
        <div key={file.id}>
          {isHttpUrl(file.downloadUrl) ? (
            <a href={file.downloadUrl} target="_blank" rel="noreferrer">
              Mở tệp {index + 1}
            </a>
          ) : (
            <span>Tệp {index + 1} · Chưa có liên kết tải</span>
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
    </div>
  )
}
