import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../../shared/ui/Icon'
import { useAuth } from '../../shared/hooks/useAuth'
import { useInventoryData } from '../inventory/api'
import type { Assignment } from '../inventory/countAssignment'
import type { ReceivingTaskType } from './receivingTaskModel'
import { receivingCreatePath } from './receivingTaskModel'
import WarehouseAssignmentDialog from './WarehouseAssignmentDialog'

/**
 * Nút "Nhận hàng" của BM: mở ngay hộp giao việc nhận hàng (SUPPLIER_RECEIVING cho PO, TRANSFER_RECEIVING cho lệnh
 * điều chuyển). Đã giao thì hiện người đang được giao và nút đổi người. BM tự nhận việc thì có thêm nút lập phiếu.
 * variant "row": nút nhỏ trong cột Thao tác; "head": nút ở đầu thẻ (CardHead) hoặc thanh thao tác của trang.
 * Khi không còn gì để giao (BE báo không giao được, hoặc chưa hỗ trợ loại việc này) thì hiện fallback.
 */
export default function ReceivingAssignment({
  taskType,
  documentId,
  variant = 'head',
  fallback = null,
  onSaved,
}: {
  taskType: ReceivingTaskType
  documentId: number
  variant?: 'row' | 'head'
  fallback?: ReactNode
  onSaved?: (name: string) => void
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
  if (r.loading && !r.data)
    return variant === 'row' ? (
      <small className="mf-row-note">Đang tải…</small>
    ) : null
  if (!r.data || (!r.data.canAssign && !current)) return <>{fallback}</>
  const row = variant === 'row'
  const button =
    'mf-btn ' +
    (row ? 'mf-btn--sm ' : '') +
    (current ? 'mf-btn--secondary' : 'mf-btn--primary')
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
          {current ? 'Đổi người nhận' : 'Nhận hàng'}
        </button>
      )}
      {open && (
        <WarehouseAssignmentDialog
          taskType={taskType}
          documentId={documentId}
          title={
            taskType === 'SUPPLIER_RECEIVING'
              ? 'Giao việc nhận hàng nhập'
              : 'Giao việc nhận hàng điều chuyển'
          }
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
