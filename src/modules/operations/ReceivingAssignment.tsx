import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../../shared/ui/Icon'
import { useAuth } from '../../shared/hooks/useAuth'
import { useInventoryData } from '../inventory/api'
import type { Assignment } from '../inventory/countAssignment'
import type { ReceivingTaskType } from './receivingTaskModel'
import { receivingCreatePath } from './receivingTaskModel'
import WarehouseAssignmentDialog from './WarehouseAssignmentDialog'

/**
 * Nút giao nhận hàng của BM mở hộp giao việc (SUPPLIER_RECEIVING cho PO, TRANSFER_RECEIVING cho lệnh
 * điều chuyển). Đã giao thì hiện người đang được giao và nút đổi người. BM tự nhận việc thì có thêm nút lập phiếu.
 * variant "row": nút nhỏ trong cột Thao tác; "head": nút ở đầu thẻ (CardHead) hoặc thanh thao tác của trang.
 * Khi không còn gì để giao (BE báo không giao được, hoặc chưa hỗ trợ loại việc này) thì hiện fallback.
 */
export default function ReceivingAssignment({
  taskType,
  documentId,
  variant = 'head',
  secondary = false,
  fallback = null,
  onSaved,
  onCurrentChange,
}: {
  taskType: ReceivingTaskType
  documentId: number
  variant?: 'row' | 'head'
  /** Hiển thị nút phụ khi đầu thẻ đã có nút chính khác. */
  secondary?: boolean
  fallback?: ReactNode
  onSaved?: (name: string) => void
  onCurrentChange?: (documentId: number, assigned: boolean) => void
}) {
  const { user } = useAuth()
  const [revision, setRevision] = useState(0),
    [open, setOpen] = useState(false)
  const r = useInventoryData<Assignment>(
    '/warehouse-tasks',
    { taskType, documentId },
    revision,
    Number.isSafeInteger(documentId) && documentId > 0,
  )
  const current = r.data?.current
  useEffect(() => {
    if (r.data) onCurrentChange?.(documentId, !!current)
  }, [current, documentId, onCurrentChange, r.data])
  if (r.loading && !r.data)
    return variant === 'row' ? (
      <small className="mf-row-note">Đang tải…</small>
    ) : null
  if (!r.data || (!r.data.canAssign && !current)) return <>{fallback}</>
  const row = variant === 'row'
  const assignLabel = taskType === 'SUPPLIER_RECEIVING' ? 'Giao việc' : 'Nhận hàng'
  const button =
    'mf-btn ' +
    (row ? 'mf-btn--sm ' : '') +
    (current || secondary ? 'mf-btn--secondary' : 'mf-btn--primary')
  return (
    <>
      {current &&
        (row ? (
          <small className="mf-row-note">
            Đang giao: <strong>{current.assigneeName}</strong>
          </small>
        ) : (
          <span className="mf-head-meta">
            Đang giao nhận hàng cho <strong>{current.assigneeName}</strong>
          </span>
        ))}
      {current?.assigneeId === user?.id && (
        <Link
          className={'mf-btn mf-btn--primary' + (row ? ' mf-btn--sm' : '')}
          to={receivingCreatePath(taskType, documentId)}
        >
          {!row && <Icon name="receipt" />}
          Lập phiếu nhập
        </Link>
      )}
      {r.data.canAssign && (
        <button type="button" className={button} onClick={() => setOpen(true)}>
          {!row && <Icon name={current ? 'users' : 'box'} />}
          {current ? 'Đổi người nhận' : assignLabel}
        </button>
      )}
      {open && (
        <WarehouseAssignmentDialog
          taskType={taskType}
          documentId={documentId}
          title="Giao nhân viên nhận hàng"
          onClose={() => setOpen(false)}
          onSaved={(name) => {
            setRevision((n) => n + 1)
            onSaved?.(name)
          }}
        />
      )}
    </>
  )
}
