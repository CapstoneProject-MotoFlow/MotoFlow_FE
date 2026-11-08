import { useRef, useState } from 'react'
import FormDialog from '../../shared/ui/FormDialog'
import axiosClient from '../../shared/api/axiosClient'
import { inventoryError, useInventoryData } from '../inventory/api'
import { InventoryNotice } from '../inventory/components'
import type { Assignment } from '../inventory/countAssignment'
import type { SalesOrder } from './salesModel'
import { dateTime } from '../inventory/presentation'
export default function SalesAssignmentDialog({
  documentId,
  order,
  onClose,
}: {
  order?: SalesOrder
  documentId: number
  onClose: () => void
}) {
  const [revision, setRevision] = useState(0),
    [choice, setChoice] = useState<number>(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [saved, setSaved] = useState(false)
  const submitting = useRef(false)
  const resource = useInventoryData<Assignment>(
    '/warehouse-tasks',
    { taskType: 'PICKING', documentId },
    revision,
    Number.isSafeInteger(documentId) && documentId > 0,
  )
  const selected =
    choice ??
    resource.data?.current?.assigneeId ??
    (resource.data?.eligibleAssignees.length === 1
      ? resource.data.eligibleAssignees[0].id
      : undefined)
  const selectedPerson = resource.data?.eligibleAssignees.find(
    (person) => person.id === selected,
  )
  const allowed =
    resource.data?.documentId === documentId &&
    resource.data.canAssign &&
    resource.data.eligibleAssignees.some((p) => p.id === selected) &&
    !resource.loading &&
    !busy
  return (
    <FormDialog
      className="sales-assignment-dialog"
      title={'Giao lấy hàng ' + (order?.code ?? 'SO-' + documentId)}
      formId="sales-assign"
      submitLabel={
        busy
          ? 'Đang giao…'
          : selectedPerson
            ? 'Giao cho ' + selectedPerson.fullName
            : 'Giao việc'
      }
      busy={busy}
      submitDisabled={!allowed}
      onClose={onClose}
    >
      <form
        id="sales-assign"
        className="sales-form"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!allowed || submitting.current) return
          submitting.current = true
          setBusy(true)
          setError('')
          setSaved(false)
          try {
            await axiosClient.post('/warehouse-tasks', {
              taskType: 'PICKING',
              documentId,
              assigneeId: selected,
            })
            setSaved(true)
            setRevision((n) => n + 1)
            window.dispatchEvent(
              new CustomEvent('sales-changed', {
                detail:
                  'Đã giao lấy hàng cho ' +
                  (selectedPerson?.fullName ?? 'nhân viên') +
                  '.',
              }),
            )
            onClose()
          } catch (error) {
            setError(inventoryError(error))
          } finally {
            submitting.current = false
            setBusy(false)
          }
        }}
      >
        <InventoryNotice
          loading={resource.loading}
          error={error || resource.error}
        />
        {resource.data?.blockedMessage && (
          <p role="status">{resource.data.blockedMessage}</p>
        )}
        {resource.data?.noticeMessage && <p>{resource.data.noticeMessage}</p>}
        {order && (
          <dl className="sales-assignment-summary">
            <div>
              <dt>Hàng cần lấy</dt>
              <dd>
                {order.lines.length} phụ tùng ·{' '}
                {order.lines.reduce((sum, l) => sum + l.requested, 0)} sản phẩm
              </dd>
            </div>
            <div>
              <dt>Khách hàng</dt>
              <dd>{order.customerName}</dd>
            </div>
          </dl>
        )}
        <fieldset
          className="sales-assignment-people"
          disabled={!resource.data?.canAssign || busy}
        >
          <legend>
            Chọn người lấy hàng{order ? ' của ' + order.storeName : ''}
          </legend>
          {resource.data?.eligibleAssignees.map((person) => (
            <label
              key={person.id}
              className={selected === person.id ? 'selected' : ''}
            >
              <input
                type="radio"
                name="assignee"
                value={person.id}
                checked={selected === person.id}
                onChange={() => {
                  setChoice(person.id)
                  setSaved(false)
                }}
              />
              <span className="sales-assignment-avatar">
                {person.fullName
                  .split(' ')
                  .filter(Boolean)
                  .slice(-2)
                  .map((word) => word[0])
                  .join('')}
              </span>
              <span className="sales-assignment-name">
                {person.fullName}
                {person.self && <small>Bạn</small>}
              </span>
              <span className="sales-assignment-count">
                <strong>{person.openTasks}</strong>
                <small>việc đang mở</small>
              </span>
            </label>
          ))}
          {!resource.loading &&
            !resource.error &&
            !resource.data?.eligibleAssignees.length && (
              <p>Không có người đủ điều kiện nhận việc.</p>
            )}
        </fieldset>
        {saved && <p role="status">Đã giao việc lấy hàng.</p>}
        {!!resource.data?.history.length && (
          <details className="sales-assignment-history">
            <summary>Lịch sử giao việc</summary>
            <ul>
              {resource.data?.history.map((item) => (
                <li key={item.id}>
                  {item.assigneeName} · {item.assignedByName} ·{' '}
                  {dateTime(item.assignedAt)}
                </li>
              ))}
            </ul>
          </details>
        )}
      </form>
    </FormDialog>
  )
}
