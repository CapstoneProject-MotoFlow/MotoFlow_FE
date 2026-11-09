import WarehouseAssignmentDialog from '../operations/WarehouseAssignmentDialog'
import { useEffect, useState, type FormEvent } from 'react'
import axiosClient from '../../shared/api/axiosClient'
import FormDialog from '../../shared/ui/FormDialog'
import { apiMessage } from '../suppliers/supplierService'

type Assignment = {
  canAssign: boolean
  blockedMessage: string | null
  noticeMessage: string | null
  current: { assigneeName: string; status: string } | null
  history: {
    id: number
    assigneeName: string
    assignedByName: string
    assignedAt: string
    status: string
  }[]
  eligibleAssignees: {
    id: number
    fullName: string
    openTasks: number
    self: boolean
  }[]
}

type Receipt = {
  canConfirm: boolean
  lines: {
    id: number
    partName: string
    passedQty: number
    shortQty: number
    wrongItemQty: number
    damagedQty: number
    excessQty: number
  }[]
}

function ExistingReceiptActionDialog({
  receiptId,
  documentNo,
  mode,
  onClose,
  onSaved,
}: {
  receiptId: number
  documentNo: string
  mode: 'assign' | 'confirm'
  onClose: () => void
  onSaved: () => void
}) {
  const assign = mode === 'assign'
  const [assignment, setAssignment] = useState<Assignment>()
  const [receipt, setReceipt] = useState<Receipt>()
  const [assigneeId, setAssigneeId] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    const signal = controller.signal
    const load = assign
      ? axiosClient
          .get<Assignment>('/warehouse-tasks', {
            params: { taskType: 'INSPECTION', documentId: receiptId },
            signal,
          })
          .then(({ data }) => {
            if (!signal.aborted) setAssignment(data)
          })
      : axiosClient
          .get<Receipt>('/goods-receipt-notes/' + receiptId, { signal })
          .then(({ data }) => {
            if (!signal.aborted) setReceipt(data)
          })
    void load
      .catch((error) => {
        if (!signal.aborted) setError(apiMessage(error))
      })
      .finally(() => {
        if (!signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [assign, receiptId])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (
      saving ||
      loading ||
      (assign ? !assignment?.canAssign || !assigneeId : !receipt?.canConfirm)
    )
      return
    setError('')
    setSaving(true)
    try {
      if (assign) {
        await axiosClient.post('/warehouse-tasks', {
          taskType: 'INSPECTION',
          documentId: receiptId,
          assigneeId: Number(assigneeId),
        })
      } else {
        await axiosClient.post('/goods-receipt-notes/' + receiptId + '/confirm')
      }
      onSaved()
    } catch (error) {
      setError(apiMessage(error))
    } finally {
      setSaving(false)
    }
  }

  return (
    <FormDialog
      title={
        (assign ? 'Giao việc kiểm nhận · ' : 'Xác nhận lượt nhận · ') +
        documentNo
      }
      formId="receiving-row-action"
      submitLabel={assign ? 'Giao việc' : 'Xác nhận'}
      onClose={onClose}
      busy={saving}
    >
      <form id="receiving-row-action" onSubmit={submit}>
        {loading && <p role="status">Đang tải phiếu nhập…</p>}
        {assignment && (
          <>
            <p>
              Đang giao cho:{' '}
              <strong>
                {assignment.current?.assigneeName ?? 'Chưa có người nhận'}
              </strong>
            </p>
            {assignment.noticeMessage && (
              <p role="status">{assignment.noticeMessage}</p>
            )}
          </>
        )}
        {assignment &&
          (assignment.canAssign && assignment.eligibleAssignees.length ? (
            <label>
              Người kiểm nhận
              <select
                value={assigneeId}
                onChange={(event) => setAssigneeId(event.target.value)}
                required
                disabled={saving}
              >
                <option value="">Chọn người kiểm nhận</option>
                {assignment.eligibleAssignees.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.fullName} · {item.openTasks} việc đang mở
                    {item.self ? ' · Tự nhận' : ''}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p>
              {assignment.blockedMessage ||
                'Chưa có người đủ điều kiện nhận việc.'}
            </p>
          ))}
        {receipt && (
          <>
            <div className="table-scroll">
              <table className="receiving-confirm-table">
                <thead>
                  <tr>
                    <th>Phụ tùng</th>
                    <th>Đạt</th>
                    <th>Thiếu</th>
                    <th>Giao sai</th>
                    <th>Hỏng</th>
                    <th>Thừa</th>
                  </tr>
                </thead>
                <tbody>
                  {receipt.lines.map((line) => (
                    <tr key={line.id}>
                      <td>{line.partName}</td>
                      <td>{line.passedQty}</td>
                      <td>{line.shortQty}</td>
                      <td>{line.wrongItemQty}</td>
                      <td>{line.damagedQty}</td>
                      <td>{line.excessQty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>
              {receipt.canConfirm
                ? 'Xác nhận sẽ ghi nhận hàng đạt vào tồn kho. Phần hàng thừa chờ Owner quyết định.'
                : 'Phiếu này hiện chưa thể xác nhận.'}
            </p>
          </>
        )}
        {assignment && (
          <section>
            <h3>Lịch sử giao việc</h3>
            {assignment.history.length ? (
              <div className="table-scroll">
                <table className="receiving-confirm-table">
                  <thead>
                    <tr>
                      <th>Người nhận</th>
                      <th>Người giao</th>
                      <th>Thời điểm</th>
                      <th>Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assignment.history.map((task) => (
                      <tr key={task.id}>
                        <td>{task.assigneeName}</td>
                        <td>{task.assignedByName}</td>
                        <td>
                          {new Date(task.assignedAt).toLocaleString('vi-VN')}
                        </td>
                        <td>
                          {{
                            ASSIGNED: 'Đã giao',
                            RESULT_SUBMITTED: 'Đã gửi kết quả',
                            DONE: 'Đã xong',
                            RELEASED: 'Đã thu hồi',
                            CANCELLED: 'Đã hủy giao việc',
                          }[task.status] ?? task.status}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p>Chưa có lịch sử giao việc.</p>
            )}
          </section>
        )}
        {error && <p role="alert">{error}</p>}
      </form>
    </FormDialog>
  )
}

export default function ReceiptActionDialog(
  props: Parameters<typeof ExistingReceiptActionDialog>[0],
) {
  return props.mode === 'assign' ? (
    <WarehouseAssignmentDialog
      taskType="INSPECTION"
      documentId={props.receiptId}
      title={'Giao kiểm nhận ' + props.documentNo}
      onClose={props.onClose}
      onSaved={props.onSaved}
    />
  ) : (
    <ExistingReceiptActionDialog {...props} />
  )
}
