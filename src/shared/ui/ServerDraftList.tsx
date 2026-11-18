/**
 * File: shared/ui/ServerDraftList.tsx
 * Loại: THÀNH PHẦN GIAO DIỆN dùng chung — không phải màn hình.
 * Công dụng: Nội dung tab "Nháp" (PM 17/11) của Đơn nhập hàng và Yêu cầu bổ sung. Nháp lưu trên server, chỉ người
 * tạo thấy: GET {path}?q&page&size (mới nhất trước), mở lại để làm tiếp, xóa hẳn bằng DELETE {path}/{id}.
 * Đơn bán dùng SalesDraftTab riêng (cùng cách, có từ 13/11).
 */
import { useEffect, useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import axiosClient from '../api/axiosClient'
import ConfirmDialog from './ConfirmDialog'
import './server-draft-list.css'

export type DraftColumn<T> = { header: string; cell: (row: T) => ReactNode }

type DraftPage<T> = { items: T[]; totalItems: number }

const pageSize = 20

function errorMessage(error: unknown) {
  return (
    (error as { response?: { data?: { message?: string } } }).response?.data
      ?.message || 'Không tải được danh sách nháp. Vui lòng thử lại.'
  )
}

export default function ServerDraftList<T extends { id: number }>({
  path,
  code,
  openPath,
  columns,
  searchLabel,
  emptyText,
  tableClassName,
}: {
  /** Ví dụ "/purchase-orders/drafts". */
  path: string
  /** Mã hiển thị của nháp, ví dụ DNH-0012. */
  code: (id: number) => string
  /** Màn mở lại nháp, ví dụ "/purchase-orders/drafts/12". */
  openPath: (id: number) => string
  columns: DraftColumn<T>[]
  searchLabel: string
  emptyText: string
  /** Lớp của khung bảng theo màn chứa nó (ví dụ "table-scroll" hoặc "tf-table"). */
  tableClassName?: string
}) {
  const location = useLocation()
  const [notice, setNotice] = useState(
    (location.state as { notice?: string } | null)?.notice ?? '',
  )
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const [revision, setRevision] = useState(0)
  const [result, setResult] = useState<{
    key: string
    data?: DraftPage<T>
    error?: string
  }>()
  const [removing, setRemoving] = useState<T>()
  const [actionError, setActionError] = useState('')
  const key = [path, query.trim(), page, revision].join('|')

  useEffect(() => {
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      void axiosClient
        .get<DraftPage<T>>(path, {
          params: { q: query.trim() || undefined, page, size: pageSize },
          signal: controller.signal,
        })
        .then(({ data }) => {
          if (!controller.signal.aborted) setResult({ key, data })
        })
        .catch((error) => {
          if (!controller.signal.aborted)
            setResult({ key, error: errorMessage(error) })
        })
    }, 200)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [key, path, query, page])

  const current = result?.key === key ? result : undefined
  const items = current?.data?.items ?? []
  const total = current?.data?.totalItems ?? 0

  async function remove(row: T) {
    setActionError('')
    setNotice('')
    try {
      await axiosClient.delete(path + '/' + row.id)
      setNotice('Đã xóa nháp ' + code(row.id) + '.')
      if (items.length === 1 && page > 0) setPage(page - 1)
      setRevision((value) => value + 1)
    } catch (error) {
      setActionError(errorMessage(error))
    }
  }

  return (
    <div className="mf-draft-list">
      <div className="mf-draft-head">
        <label className="mf-draft-search">
          {searchLabel}
          <input
            value={query}
            placeholder="Mã nháp hoặc tên…"
            onChange={(event) => {
              setQuery(event.target.value)
              setPage(0)
            }}
          />
        </label>
        <p className="mf-draft-hint">
          Nháp chỉ có ở tab này và chỉ bạn thấy. Mở nháp để làm tiếp rồi gửi;
          nháp chưa có hiệu lực cho tới khi gửi.
        </p>
        {notice && (
          <p className="mf-success-notice" role="status">
            {notice}
          </p>
        )}
        {actionError && <p role="alert">{actionError}</p>}
        {!current && <p role="status">Đang tải…</p>}
        {current?.error && <p role="alert">{current.error}</p>}
      </div>
      <div className={tableClassName}>
        <table>
          <thead>
            <tr>
              <th>Mã nháp</th>
              {columns.map((column) => (
                <th key={column.header}>{column.header}</th>
              ))}
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr key={row.id}>
                <td>
                  <Link to={openPath(row.id)}>{code(row.id)}</Link>
                </td>
                {columns.map((column) => (
                  <td key={column.header}>{column.cell(row)}</td>
                ))}
                <td>
                  <div className="mf-row-actions">
                    <Link
                      className="mf-btn mf-btn--sm mf-btn--primary"
                      to={openPath(row.id)}
                    >
                      Mở nháp
                    </Link>
                    <button
                      type="button"
                      className="mf-btn mf-btn--sm mf-btn--danger"
                      onClick={() => setRemoving(row)}
                    >
                      Xóa
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {current?.data && !items.length && (
              <tr>
                <td colSpan={columns.length + 2}>{emptyText}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {total > pageSize && (
        <footer className="mf-draft-pagination">
          <span>
            {`Hiển thị ${page * pageSize + 1}–${Math.min((page + 1) * pageSize, total)} trên ${total} nháp`}
          </span>
          <button
            type="button"
            className="mf-btn mf-btn--sm mf-btn--secondary"
            aria-label="Trang trước"
            disabled={page === 0}
            onClick={() => setPage(page - 1)}
          >
            ‹
          </button>
          <button
            type="button"
            className="mf-btn mf-btn--sm mf-btn--secondary"
            aria-label="Trang sau"
            disabled={(page + 1) * pageSize >= total}
            onClick={() => setPage(page + 1)}
          >
            ›
          </button>
        </footer>
      )}
      {removing && (
        <ConfirmDialog
          title={'Xóa nháp ' + code(removing.id) + '?'}
          message="Nháp bị xóa hẳn và không khôi phục được."
          confirmLabel="Xóa nháp"
          cancelLabel="Không xóa"
          danger
          onConfirm={async () => {
            const row = removing
            setRemoving(undefined)
            await remove(row)
          }}
          onCancel={() => setRemoving(undefined)}
        />
      )}
    </div>
  )
}
