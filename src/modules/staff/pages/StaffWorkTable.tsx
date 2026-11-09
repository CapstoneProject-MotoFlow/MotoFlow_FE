import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useInventoryData } from '../../inventory/api'
import { InventoryNotice } from '../../inventory/components'
import type { Page } from '../../inventory/types'
import type { CountList } from '../../inventory/countApi'
import type { SummaryDto } from '../../sales/salesApi'
import type { TransferRow } from '../../transfers/types'
import { date, dateTime } from '../../inventory/presentation'

type AssignedReceipt = {
  goodsReceiptNoteId: number
  supplierName: string
  arrivedAt: string
  assignedAt: string
  taskStatus: string
  status: string
  lineCount: number
}
type Task = {
  key: string
  task: string
  code: string
  description: string
  assignedAt: string | null
  due: string | null
  status: string
  action: string
  href: string
  submitted: boolean
}
export default function StaffWorkTable() {
  const [page, setPage] = useState(0)
  const sales = useInventoryData<Page<SummaryDto>>('/sales-orders', {
      view: 'OPEN',
      page,
      size: 20,
    }),
    receipts = useInventoryData<Page<AssignedReceipt>>(
      '/goods-receipt-notes/assigned-to-me',
      { page, size: 20 },
    ),
    transfers = useInventoryData<Page<TransferRow>>('/transfer-orders', {
      page,
      size: 20,
    }),
    counts = useInventoryData<CountList>('/stock-counts', { page, size: 20 })
  const tasks: Task[] = [
    ...(sales.data?.items ?? [])
      .filter((s) => ['AWAITING_PICKING', 'PICKED'].includes(s.status))
      .map((s) => ({
        key: 's' + s.id,
        task: 'Lấy hàng đơn bán',
        code: 'DB-' + String(s.id).padStart(4, '0'),
        description: s.customerName ?? 'Khách lẻ',
        assignedAt: null,
        due: null,
        status:
          s.status === 'PICKED' ? 'Đã gửi, chờ xác nhận' : 'Chưa gửi kết quả',
        action: s.status === 'PICKED' ? 'Xem kết quả' : 'Ghi số đã lấy',
        href: '/sales-orders/' + s.id + (s.status === 'PICKED' ? '' : '/pick'),
        submitted: s.status === 'PICKED',
      })),
    ...(receipts.data?.items ?? []).map((r) => ({
      key: 'r' + r.goodsReceiptNoteId,
      task: 'Kiểm nhận hàng nhập',
      code: 'PN-' + String(r.goodsReceiptNoteId).padStart(4, '0'),
      description: r.supplierName + ' · ' + r.lineCount + ' dòng',
      assignedAt: r.assignedAt ?? null,
      due: null,
      status:
        r.taskStatus === 'RESULT_SUBMITTED'
          ? 'Đã gửi, chờ xác nhận'
          : r.status === 'AWAITING_RECOUNT'
            ? 'Được yêu cầu kiểm lại'
            : 'Chưa gửi kết quả',
      action:
        r.taskStatus === 'RESULT_SUBMITTED'
          ? 'Xem kết quả'
          : r.status === 'AWAITING_RECOUNT'
            ? 'Kiểm lại'
            : 'Ghi kết quả',
      href: '/goods-receipt-notes/' + r.goodsReceiptNoteId,
      submitted: r.taskStatus === 'RESULT_SUBMITTED',
    })),
    ...(transfers.data?.items ?? [])
      .filter((t) => t.status !== 'CLOSED')
      .map((t) => ({
        key: 't' + t.id,
        task: 'Điều chuyển được giao',
        code: 'DC-' + String(t.id).padStart(4, '0'),
        description: t.sourceStoreName + ' → ' + t.destStoreName,
        assignedAt: null,
        due: null,
        status: 'Mở phiếu để xem kết quả',
        action: 'Mở việc điều chuyển',
        href: '/transfer-orders/' + t.id,
        submitted: false,
      })),
    ...(counts.data?.counts.items ?? [])
      .filter((c) => ['DRAFT', 'COUNTING'].includes(c.status))
      .map((c) => ({
        key: 'c' + c.id,
        task: 'Đếm kiểm kê',
        code: 'KK-' + String(c.id).padStart(4, '0'),
        description: c.storeName,
        assignedAt: null,
        due: 'Ngày đếm ' + date(c.countDate),
        status: c.status === 'DRAFT' ? 'Chưa bắt đầu' : 'Đang kiểm kê',
        action: c.status === 'DRAFT' ? 'Bắt đầu đếm' : 'Mở phiếu kiểm kê',
        href: '/stock-counts/' + c.id + (c.status === 'DRAFT' ? '/record' : ''),
        submitted: false,
      })),
  ]
  const active = tasks.filter((t) => !t.submitted),
    submitted = tasks.filter((t) => t.submitted),
    sources = [sales, receipts, transfers, counts],
    loading = sources.some((s) => s.loading),
    error = sources
      .map((s) => s.error)
      .filter(Boolean)
      .join(' '),
    hasMore =
      Math.max(
        sales.data?.totalItems ?? 0,
        receipts.data?.totalItems ?? 0,
        transfers.data?.totalItems ?? 0,
        counts.data?.counts.totalItems ?? 0,
      ) >
      (page + 1) * 20
  function table(rows: Task[]) {
    return (
      <div className="staff-task-table">
        <table>
          <thead>
            <tr>
              <th>Việc</th>
              <th>Chứng từ</th>
              <th>Giao lúc</th>
              <th>Hạn</th>
              <th>Trạng thái</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.key}>
                <td>{t.task}</td>
                <td>
                  <Link to={t.href}>{t.code}</Link>
                  <small>{t.description}</small>
                </td>
                <td
                  title={
                    !t.assignedAt
                      ? 'Chưa có thời điểm giao trong dữ liệu được cung cấp'
                      : undefined
                  }
                >
                  {t.assignedAt ? dateTime(t.assignedAt) : '—'}
                </td>
                <td>{t.due ?? '—'}</td>
                <td>
                  <span
                    className={
                      'staff-work-status ' +
                      (t.submitted
                        ? 'is-submitted'
                        : t.status.includes('kiểm lại')
                          ? 'is-recount'
                          : '')
                    }
                  >
                    {t.status}
                  </span>
                </td>
                <td>
                  <Link className="staff-work-action" to={t.href}>
                    {t.action}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }
  return (
    <section className="staff-task-panel" aria-busy={loading}>
      <h2>Việc của tôi{!loading ? ' (' + active.length + ')' : ''}</h2>
      <InventoryNotice loading={loading} error={error} />
      {table(active)}
      {!loading && !error && !active.length && (
        <p className="staff-task-message">
          Không có công việc đang làm trong trang này.
        </p>
      )}
      {submitted.length > 0 && (
        <details className="staff-submitted-work">
          <summary>
            {submitted.length} việc đã gửi, chờ Branch Manager xác nhận
          </summary>
          {table(submitted)}
        </details>
      )}
      <footer>
        <p>
          Công việc trong trang {page + 1}, tối đa 20 chứng từ mỗi loại. Mở
          phiếu để xem đầy đủ phân công và kết quả.
        </p>
        <nav className="staff-work-pages" aria-label="Trang công việc">
          <button
            disabled={page === 0 || loading}
            onClick={() => setPage((p) => p - 1)}
          >
            ‹
          </button>
          <span>{page + 1}</span>
          <button
            disabled={!hasMore || loading}
            onClick={() => setPage((p) => p + 1)}
          >
            ›
          </button>
        </nav>
        <p>
          Thời điểm giao và hạn chỉ hiện khi có dữ liệu. Kiểm kê và điều chuyển
          cần mở phiếu để xác định trạng thái việc mới nhất.
        </p>
      </footer>
    </section>
  )
}
