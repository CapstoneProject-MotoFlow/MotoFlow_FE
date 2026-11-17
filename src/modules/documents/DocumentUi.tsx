import type { ReactNode } from 'react'
import { useInventoryData } from '../inventory/api'
import type { Page } from '../inventory/types'
import { formatDateTime } from '../../shared/utils/format'
import { historyLabels } from './model'
import type { Evidence, HistoryItem } from './types'
import './documents.css'

export function Card({
  title,
  actions,
  children,
}: {
  title: ReactNode
  actions?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="docs-card">
      <header>
        <h2>{title}</h2>
        {actions}
      </header>
      <div className="docs-card-body">{children}</div>
    </section>
  )
}

export function Table({
  headers,
  children,
  label,
}: {
  headers: string[]
  children: ReactNode
  label: string
}) {
  return (
    <div className="docs-table-scroll">
      <table aria-label={label}>
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header} scope="col">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

export function Facts({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="docs-facts">
      {items
        .filter(([, value]) => value != null && value !== '')
        .map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
    </dl>
  )
}

export function Result<T>({
  request,
  children,
  empty = 'Không tìm thấy dữ liệu.',
}: {
  request: ReturnType<typeof useInventoryData<T>>
  children: (data: T) => ReactNode
  empty?: string
}) {
  if (request.loading)
    return (
      <p className="docs-message" role="status">
        Đang tải…
      </p>
    )
  if (request.error)
    return (
      <div className="docs-alert" role="alert">
        <span>{request.error}</span>
        <button className="mf-btn mf-btn--secondary" onClick={request.retry}>
          Thử lại
        </button>
      </div>
    )
  return request.data ? (
    children(request.data)
  ) : (
    <p className="docs-message">{empty}</p>
  )
}

export function Pager({
  page,
  onPage,
  noun,
}: {
  page: Page<unknown>
  onPage: (page: number) => void
  noun: string
}) {
  const start = page.page * page.size
  return (
    <div className="docs-pager">
      <span>
        {page.items.length
          ? start + 1 + '–' + (start + page.items.length) + ' / '
          : ''}
        {page.totalItems} {noun}
      </span>
      <div className="docs-actions">
        <button
          type="button"
          className="mf-btn mf-btn--secondary"
          disabled={page.page === 0}
          onClick={() => onPage(page.page - 1)}
        >
          Trước
        </button>
        <button
          type="button"
          className="mf-btn mf-btn--secondary"
          disabled={start + page.size >= page.totalItems}
          onClick={() => onPage(page.page + 1)}
        >
          Sau
        </button>
      </div>
    </div>
  )
}

export function Status({ value, label }: { value: string; label: string }) {
  return (
    <span className="docs-status" data-value={value}>
      {label}
    </span>
  )
}

export function History({ items }: { items: HistoryItem[] }) {
  return items.length ? (
    <ol className="docs-history">
      {[...items].reverse().map((entry, index) => (
        <li key={index}>
          <strong>{historyLabels[entry.action] ?? entry.action}</strong>
          <small>
            {formatDateTime(entry.occurredAt)}
            {(entry.actorName || entry.actor?.fullName) &&
              ' · ' + (entry.actorName || entry.actor?.fullName)}
          </small>
          {entry.reason && <p>{entry.reason}</p>}
        </li>
      ))}
    </ol>
  ) : (
    <p className="docs-muted">Chưa có lịch sử.</p>
  )
}

export function EvidenceList({ files }: { files: Evidence[] }) {
  return files.length ? (
    <ul className="docs-files">
      {files.map((file) => (
        <li key={file.id}>
          <span>{file.fileName}</span>
          {file.downloadUrl && /^https?:\/\//i.test(file.downloadUrl) && (
            <a
              href={file.downloadUrl}
              target="_blank"
              rel="noreferrer"
              className="mf-btn mf-btn--secondary"
              aria-label={'Xem ' + file.fileName}
            >
              Xem
            </a>
          )}
        </li>
      ))}
    </ul>
  ) : (
    <p className="docs-muted">Chưa có tệp đính kèm.</p>
  )
}
