import type { Evidence } from './types'
import { dateTime } from '../inventory/presentation'
export default function DebtEvidence({ files }: { files?: Evidence[] }) {
  if (!files?.length) return null
  return (
    <details className="rv-evidence-list">
      <summary>Chứng từ ({files.length})</summary>
      {files.map((file) => (
        <div key={file.id}>
          {file.downloadUrl && /^https?:\/\//i.test(file.downloadUrl) ? (
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
    </details>
  )
}
