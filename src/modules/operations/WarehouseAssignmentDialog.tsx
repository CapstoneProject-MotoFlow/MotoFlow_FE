import './operations.css'
import { useRef, useState } from 'react'
import FormDialog from '../../shared/ui/FormDialog'
import { useInventoryData, inventoryError } from '../inventory/api'
import { InventoryNotice } from '../inventory/components'
import { dateTime } from '../inventory/presentation'
import type { Assignment } from '../inventory/countAssignment'
import axiosClient from '../../shared/api/axiosClient'
import { refreshNotifications } from '../notifications/notificationService'
export default function WarehouseAssignmentDialog({
  taskType,
  documentId,
  title = 'Giao việc kho',
  onClose,
  onSaved,
}: {
  taskType: 'PICKING' | 'INSPECTION' | 'DISPATCH_PREPARATION' | 'COUNTING'
  documentId: number
  title?: string
  onClose: () => void
  onSaved?: () => void
}) {
  const [choice, setChoice] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  const lock = useRef(false),
    r = useInventoryData<Assignment>(
      '/warehouse-tasks',
      { taskType, documentId },
      0,
      Number.isSafeInteger(documentId) && documentId > 0,
    ),
    valid =
      !!r.data?.canAssign &&
      r.data.documentId === documentId &&
      r.data.eligibleAssignees.some((p) => p.id === Number(choice))
  return (
    <FormDialog
      title={title}
      formId="warehouse-assignment"
      busy={busy}
      submitLabel="Xác nhận giao việc"
      submitDisabled={!valid || r.loading}
      onClose={onClose}
    >
      <form
        id="warehouse-assignment"
        className="warehouse-assignment-form"
        onSubmit={async (e) => {
          e.preventDefault()
          if (lock.current || !valid) return
          lock.current = true
          setBusy(true)
          setError('')
          try {
            await axiosClient.post('/warehouse-tasks', {
              taskType,
              documentId,
              assigneeId: Number(choice),
            })
            refreshNotifications()
            onSaved?.()
            onClose()
          } catch (e) {
            setError(inventoryError(e))
          } finally {
            lock.current = false
            setBusy(false)
          }
        }}
      >
        <InventoryNotice loading={r.loading} error={error || r.error} />
        {r.data && (
          <>
            <p>
              {r.data.current
                ? 'Đang giao: ' + r.data.current.assigneeName
                : 'Chưa giao người thực hiện'}
            </p>
            {r.data.blockedMessage && (
              <p role="status">{r.data.blockedMessage}</p>
            )}
            {r.data.noticeMessage && <p>{r.data.noticeMessage}</p>}
            <label>
              Người thực hiện
              <select
                disabled={!r.data.canAssign || busy}
                value={choice}
                onChange={(e) => setChoice(e.target.value)}
              >
                <option value="">Chọn nhân viên</option>
                {r.data.eligibleAssignees.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.fullName}
                    {p.self ? ' (Tôi)' : ''} · {p.openTasks} việc
                  </option>
                ))}
              </select>
            </label>
            <h3>Lịch sử giao việc</h3>
            {r.data.history.map((h) => (
              <p key={h.id}>
                {h.assigneeName} · {h.assignedByName} · {dateTime(h.assignedAt)}
              </p>
            ))}
            {!r.data.history.length && <p>Chưa có lịch sử giao việc.</p>}
          </>
        )}
      </form>
    </FormDialog>
  )
}
