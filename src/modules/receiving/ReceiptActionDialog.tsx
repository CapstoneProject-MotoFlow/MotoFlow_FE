import WarehouseAssignmentDialog from '../operations/WarehouseAssignmentDialog'
import { useEffect, useState, type FormEvent } from 'react'
import axiosClient from '../../shared/api/axiosClient'
import FormDialog from '../../shared/ui/FormDialog'
import { apiMessage } from '../suppliers/supplierService'
import { formatDate, formatDateTime } from '../../shared/utils/format'
import { inspectionCountFields, inspectionResultFields } from './receivingRules'
import ReceiptDocuments, { type ReceiptDocument } from './ReceiptDocuments'

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
    self: boolean
  }[]
}

type Receipt = {
  canConfirm: boolean
  documents: ReceiptDocument[]
  lines: ({
    id: number
    partName: string
    expectedQty: number | null
    manufactureDate: string | null
    expiryDate: string | null
  } &
    Record<(typeof inspectionColumns)[number][0], number>)[]
}

const inspectionColumns = [...inspectionCountFields, ...inspectionResultFields]

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
      className={!assign ? 'receiving-confirm-dialog' : ''}
      title={
        (assign ? 'Giao việc kiểm nhận · ' : 'Xác nhận phiếu nhập · ') +
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
                    {item.fullName}
                    {item.self ? ' (Tôi)' : ''}
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
            <ReceiptDocuments
              receiptId={receiptId}
              documents={receipt.documents}
            />
            <div className="table-scroll">
              <table className="receiving-confirm-table">
                <thead>
                  <tr>
                    <th>Phụ tùng</th>
                    <th>Còn chờ nhận</th>
                    {inspectionColumns.map(([field, label]) => (
                      <th key={field}>{label}</th>
                    ))}
                    <th>Ngày sản xuất</th>
                    <th>Hạn dùng</th>
                  </tr>
                </thead>
                <tbody>
                  {receipt.lines.map((line) => (
                    <tr key={line.id}>
                      <td>{line.partName}</td>
                      <td>{line.expectedQty ?? '—'}</td>
                      {inspectionColumns.map(([field]) => (
                        <td key={field}>{line[field]}</td>
                      ))}
                      <td>{formatDate(line.manufactureDate)}</td>
                      <td>{formatDate(line.expiryDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>
              {receipt.canConfirm
                ? 'Xác nhận sẽ ghi nhận hàng đạt vào tồn kho. Phần hàng thừa chờ chủ cửa hàng quyết định.'
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
                        <td>{formatDateTime(task.assignedAt)}</td>
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
