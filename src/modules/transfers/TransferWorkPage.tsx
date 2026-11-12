import PageBackLink from '../../shared/ui/PageBackLink'
import WarehouseAssignmentDialog from '../operations/WarehouseAssignmentDialog'
import ExcessDispatchEditor from './ExcessDispatchEditor'
import { uploadAttachment } from '../../shared/api/upload'
import { receiptAcceptsResult } from './transferRules'
import { dateTime } from '../inventory/presentation'
import { useRef, useState, type ReactNode } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import axiosClient from '../../shared/api/axiosClient'
import {
  useInventoryData,
  useInventoryScope,
  inventoryError,
} from '../inventory/api'
import { InventoryNotice } from '../inventory/components'
import type { Assignment } from '../inventory/countAssignment'
import TransferAction from './TransferAction'
import CardHead, { HeadButton } from './CardHead'
import ReceiptDocumentSummary from './ReceiptDocumentSummary'
import { states, type Preparation, type Receipt, type Transfer } from './types'
import './transfers.css'

const WORK_FORM = 'tf-work-form'
export default function TransferWorkPage({
  mode = 'prepare',
}: {
  mode?: 'prepare' | 'receipt' | 'extra'
}) {
  const { id, receiptId } = useParams(),
    location = useLocation(),
    navigate = useNavigate(),
    scope = useInventoryScope(),
    [revision, setRevision] = useState(0),
    [success, setSuccess] = useState('')
  const onWorkSaved = (message: string) => {
    setSuccess(message)
    setRevision((n) => n + 1)
  }
  const prep = useInventoryData<Preparation>(
      `/transfer-orders/${id}/preparation`,
      {},
      revision,
      mode === 'prepare',
    ),
    receipt = useInventoryData<Receipt>(
      `/transfer-orders/${id}/receipts/${receiptId}`,
      {},
      revision,
      mode === 'receipt',
    ),
    order = useInventoryData<Transfer>(
      `/transfer-orders/${id}`,
      {},
      revision,
      mode !== 'prepare',
    )
  // Vừa bấm "Hàng đã đến" ở lệnh điều chuyển: mở ngay hộp giao việc kiểm nhận (như phiếu nhập từ nhà cung cấp).
  const assignNow =
    mode === 'receipt' &&
    !!(location.state as { assignNow?: boolean } | null)?.assignNow
  const clearAssignNow = () => {
    if (assignNow)
      navigate(location.pathname + location.search, {
        replace: true,
        state: null,
      })
  }
  const manager = scope.user?.role === 'BRANCH_MANAGER'
  const receiptStoreId =
    receipt.data?.receiptType === 'RETURN_TO_SOURCE'
      ? order.data?.sourceStoreId
      : order.data?.destStoreId
  const managesReceipt =
    manager && !!receiptStoreId && scope.user?.storeId === receiptStoreId
  const taskType = mode === 'prepare' ? 'DISPATCH_PREPARATION' : 'INSPECTION'
  const documentId = Number(mode === 'prepare' ? id : receiptId)
  const assignment = useInventoryData<Assignment>(
    '/warehouse-tasks',
    { taskType, documentId },
    revision,
    (manager &&
      mode === 'prepare' &&
      prep.data?.status === 'AWAITING_DISPATCH') ||
      (mode === 'receipt' &&
        managesReceipt &&
        receiptAcceptsResult(receipt.data?.status)),
  )
  const assignmentControl = assignment.data?.canAssign ? (
    <AssignmentControl
      key={'a' + revision}
      taskType={taskType}
      documentId={documentId}
      assigneeName={assignment.data.current?.assigneeName}
      autoOpen={assignNow && !assignment.data.current}
      onClose={clearAssignNow}
      onSaved={(name) => {
        clearAssignNow()
        onWorkSaved(
          (mode === 'prepare'
            ? 'Đã giao việc soạn hàng cho '
            : 'Đã giao việc kiểm nhận cho ') +
            name +
            '.',
        )
      }}
    />
  ) : null
  return (
    <main className="dashboard-content tf-page">
      <PageBackLink to={'/transfer-orders/' + id} />
      <header>
        <div>
          <h1>
            {mode === 'prepare'
              ? 'Ghi số đã soạn'
              : mode === 'extra'
                ? 'Xác nhận xuất thừa'
                : 'Kiểm nhận hàng chuyển'}
          </h1>
        </div>
      </header>
      <InventoryNotice
        loading={prep.loading || receipt.loading || order.loading}
        error={prep.error || receipt.error || order.error}
        onRetry={() =>
          [prep, receipt, order].forEach((source) => source.retry())
        }
      />
      {success && (
        <p className="tf-success-notice" role="status">
          {success}
        </p>
      )}
      {mode === 'prepare' && prep.data && (
        <WorkEditor
          key={'p' + revision}
          preparation={prep.data}
          headActions={assignmentControl}
          id={id!}
          mode={mode}
          onSaveStart={() => setSuccess('')}
          onSaved={onWorkSaved}
        />
      )}{' '}
      {mode === 'receipt' && receipt.data && order.data && (
        <WorkEditor
          key={'r' + revision}
          receipt={receipt.data}
          headActions={assignmentControl}
          order={order.data}
          assignment={assignment.data}
          id={id!}
          mode={mode}
          onSaveStart={() => setSuccess('')}
          onSaved={onWorkSaved}
        />
      )}{' '}
      {mode === 'extra' && order.data && (
        <ExcessDispatchEditor
          key={'e' + revision}
          order={order.data}
          onSaved={() => setRevision((n) => n + 1)}
        />
      )}{' '}
    </main>
  )
}
/** Chữ "Đang giao cho" + nút giao/đổi nhân viên, đặt trên dòng tiêu đề thẻ. */
function AssignmentControl({
  taskType,
  documentId,
  assigneeName,
  autoOpen = false,
  onClose,
  onSaved,
}: {
  taskType: 'DISPATCH_PREPARATION' | 'INSPECTION'
  documentId: number
  assigneeName?: string
  autoOpen?: boolean
  onClose: () => void
  onSaved: (name: string) => void
}) {
  const [open, setOpen] = useState(autoOpen)
  return (
    <>
      <span className="tf-head-meta">
        {assigneeName ? (
          <>
            Đang giao cho <strong>{assigneeName}</strong>
          </>
        ) : (
          'Chưa giao nhân viên'
        )}
      </span>
      <HeadButton
        action={{
          key: 'assign',
          label: assigneeName ? 'Đổi nhân viên' : 'Giao nhân viên',
          icon: 'users',
          primary: !assigneeName,
          onClick: () => setOpen(true),
        }}
      />
      {open && (
        <WarehouseAssignmentDialog
          taskType={taskType}
          documentId={documentId}
          title={
            taskType === 'INSPECTION'
              ? 'Giao việc kiểm nhận hàng chuyển'
              : 'Giao việc soạn hàng'
          }
          onClose={() => {
            setOpen(false)
            onClose()
          }}
          onSaved={onSaved}
        />
      )}
    </>
  )
}
function WorkEditor({
  preparation,
  receipt,
  order,
  assignment,
  id,
  mode,
  onSaveStart,
  onSaved,
  headActions,
}: {
  headActions?: ReactNode
  preparation?: Preparation
  receipt?: Receipt
  order?: Transfer
  assignment?: Assignment
  id: string
  mode: string
  onSaveStart: () => void
  onSaved: (message: string) => void
}) {
  const scope = useInventoryScope(),
    lines =
      preparation?.lines ??
      receipt?.lines ??
      order!.lines.filter((l) => (l.extraReceivedQty ?? 0) > 0),
    [values, setValues] = useState<
      Record<number, { qty: number; damaged: number; reason: string }>
    >(() =>
      Object.fromEntries(
        lines.map((l) => [
          l.productId,
          {
            qty:
              mode === 'extra'
                ? 0
                : 'preparedQty' in l
                  ? (l.preparedQty ?? 0)
                  : 'passedQty' in l
                    ? l.passedQty
                    : 0,
            damaged: 'damagedQty' in l ? l.damagedQty : 0,
            reason: 'shortReason' in l ? (l.shortReason ?? '') : '',
          },
        ]),
      ),
    ),
    [files, setFiles] = useState<File[]>([]),
    [reason, setReason] = useState(''),
    [action, setAction] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  const lock = useRef(false),
    bm = scope.user?.role === 'BRANCH_MANAGER',
    resultSubmitted =
      mode === 'prepare' &&
      preparation?.preparer?.taskStatus === 'RESULT_SUBMITTED',
    // Đã giao người soạn và chưa có kết quả: tên người soạn đã hiện ở đầu thẻ nên không hiện thêm thông báo xanh.
    preparedByOther =
      !!preparation?.preparer &&
      !resultSubmitted &&
      !preparation.canRecord &&
      preparation.status === 'AWAITING_DISPATCH',
    canRecord =
      mode === 'prepare'
        ? !!preparation?.canRecord
        : mode === 'receipt'
          ? ['STAFF', 'BRANCH_MANAGER'].includes(scope.user?.role ?? '') &&
            receiptAcceptsResult(receipt?.status) &&
            (!bm || assignment?.current?.assigneeId === scope.user?.id)
          : bm && scope.user?.storeId === order?.sourceStoreId
  // BM của kho nhận duyệt kết quả kiểm nhận (trước đây khối "Duyệt kết quả kiểm nhận" ở cuối trang).
  const approver =
    !!receipt &&
    bm &&
    scope.user?.storeId ===
      (receipt.receiptType === 'RETURN_TO_SOURCE'
        ? order?.sourceStoreId
        : order?.destStoreId) &&
    receipt.status === 'AWAITING_CONFIRMATION'
  const valid =
    lines.length > 0 &&
    lines.every((l) => {
      const v = values[l.productId]
      return (
        Number.isInteger(v.qty) &&
        v.qty >= 0 &&
        v.qty <=
          ('sellableQty' in l
            ? Math.min(l.plannedQty, l.sellableQty)
            : 2147483647) &&
        Number.isInteger(v.damaged) &&
        v.damaged >= 0 &&
        v.damaged <= 100000 &&
        (mode !== 'prepare' ||
          !('plannedQty' in l) ||
          v.qty >= l.plannedQty ||
          !!v.reason.trim())
      )
    })
  async function save() {
    if (lock.current || !valid || !canRecord) return
    lock.current = true
    setBusy(true)
    setError('')
    onSaveStart()
    try {
      const evidence = []
      if (mode === 'extra')
        for (const file of files) evidence.push(await uploadAttachment(file))
      const path = '/transfer-orders/' + id
      const payload =
        mode === 'prepare'
          ? {
              lines: lines.map((l) => ({
                productId: l.productId,
                preparedQty: values[l.productId].qty,
                shortReason: values[l.productId].reason,
              })),
            }
          : mode === 'receipt'
            ? {
                lines: lines.map((l) => ({
                  productId: l.productId,
                  passedQty: values[l.productId].qty,
                  damagedQty: values[l.productId].damaged,
                })),
              }
            : {
                lines: lines.map((l) => ({
                  productId: l.productId,
                  extraQty: values[l.productId].qty,
                })),
                reason,
                evidence,
              }
      if (mode === 'extra')
        await axiosClient.post(path + '/extra-dispatch', payload)
      else
        await axiosClient.put(
          path +
            (mode === 'prepare'
              ? '/prepared-lines'
              : '/receipts/' + receipt!.id + '/result'),
          payload,
        )
      onSaved(
        mode === 'prepare'
          ? resultSubmitted
            ? 'Đã cập nhật kết quả soạn hàng.'
            : 'Đã gửi kết quả soạn hàng.'
          : mode === 'receipt'
            ? 'Đã gửi kết quả kiểm nhận.'
            : 'Đã xác nhận xuất thêm.',
      )
    } catch (e) {
      setError(inventoryError(e))
    } finally {
      setBusy(false)
      lock.current = false
    }
  }
  return (
    <>
      <section>
        <CardHead
          title={receipt ? 'Phiếu nhận #' + receipt.id : 'Kết quả thực tế'}
          status={
            receipt ? (states[receipt.status] ?? receipt.status) : undefined
          }
        >
          {headActions}
          {approver && (
            <HeadButton
              action={{
                key: 'recount',
                label: 'Yêu cầu kiểm lại',
                icon: 'clipboard',
                onClick: () => setAction('recount'),
              }}
            />
          )}
          {approver && receipt.recordedBy !== scope.user?.id && (
            <HeadButton
              action={{
                key: 'confirm',
                label: 'Xác nhận nhận hàng',
                icon: 'check',
                primary: true,
                onClick: () => setAction('confirm'),
              }}
            />
          )}
          {canRecord && (
            <HeadButton
              action={{
                key: 'submit',
                label: resultSubmitted ? 'Cập nhật kết quả' : 'Gửi kết quả',
                icon: 'check',
                primary: true,
                form: WORK_FORM,
                disabled: busy || !valid,
              }}
            />
          )}
        </CardHead>
        {receipt?.recountReason && (
          <p className="tf-note">Yêu cầu đếm lại: {receipt.recountReason}</p>
        )}
        {preparation && !preparedByOther && (
          <div className="tf-preparation-notice" role="status">
            {resultSubmitted ? (
              <>
                <strong>
                  Đã gửi kết quả soạn hàng, đang chờ BM xác nhận xuất.
                </strong>
                <p>
                  Bạn vẫn có thể chỉnh sửa số đã soạn trước khi BM xác nhận
                  xuất.
                </p>
              </>
            ) : preparation.canRecord ? (
              <>
                <strong>Bạn có thể ghi kết quả soạn hàng.</strong>
                <p>
                  Nếu số soạn ít hơn kế hoạch, hãy nhập lý do thiếu trước khi
                  gửi.
                </p>
              </>
            ) : preparation.status !== 'AWAITING_DISPATCH' ? (
              <>
                <strong>Phiếu đã qua bước soạn hàng.</strong>
                <p>Kết quả hiện chỉ để xem.</p>
              </>
            ) : (
              <>
                <strong>Chưa giao người soạn hàng.</strong>
                <p>
                  Quản lý kho nguồn cần giao việc trước khi người thực hiện nhập
                  kết quả.
                </p>
              </>
            )}
          </div>
        )}
        {preparation?.canRecord && !valid && (
          <p className="tf-validation-hint">
            Số đã soạn phải là số nguyên, từ 0 đến mức thấp hơn giữa kế hoạch và
            tồn khả dụng. Nếu soạn ít hơn kế hoạch, hãy nhập lý do.
          </p>
        )}
        {receipt && !receiptAcceptsResult(receipt.status) && (
          <div className="tf-preparation-notice" role="status">
            {receipt.status === 'AWAITING_CONFIRMATION' ? (
              <>
                <strong>
                  {bm
                    ? 'Kết quả kiểm nhận đang chờ bạn duyệt.'
                    : 'Kết quả đã gửi, đang chờ BM kho nhận xác nhận.'}
                </strong>
                <p>
                  {bm
                    ? 'Kiểm tra số đạt, số hỏng rồi chọn Xác nhận nhận hàng ở đầu thẻ. Nếu số liệu chưa đúng, chọn Yêu cầu kiểm lại để nhân viên cập nhật.'
                    : 'Bạn không cần gửi lại. Nếu cần sửa, BM phải chọn Yêu cầu kiểm lại trước.'}
                </p>
              </>
            ) : (
              <strong>Phiếu nhận đã xác nhận; kết quả chỉ để xem.</strong>
            )}
          </div>
        )}
        {mode === 'extra' && (
          <div className="tf-note">
            <p>
              Nhập số thực tế xác nhận xuất thêm; số này không lấy từ số đã
              soạn.
            </p>
            <input
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,application/pdf"
              disabled={busy || !canRecord}
              onChange={(e) => {
                const next = Array.from(e.target.files ?? [])
                if (next.length > 10) {
                  setError('Tối đa 10 chứng từ.')
                  e.target.value = ''
                  return
                }
                setFiles(next)
              }}
            />
          </div>
        )}
        {receipt && <ReceiptDocumentSummary receipt={receipt} />}
        {receipt && (
          <p className="tf-note">
            Đến: {dateTime(receipt.arrivedAt)}
            {receipt && (
              <span>
                {' '}
                · Thực nhận:{' '}
                {receipt.lines.reduce((n, l) => n + l.deliveredQty, 0)} · Hàng
                thừa: {receipt.lines.reduce((n, l) => n + l.excessQty, 0)}
              </span>
            )}
            {receipt.submittedAt && (
              <>
                {' '}
                · Gửi kết quả: {dateTime(receipt.submittedAt)} · Người ghi #
                {receipt.recordedBy}
              </>
            )}
            {receipt.confirmedAt && (
              <>
                {' '}
                · Xác nhận: {dateTime(receipt.confirmedAt)} · Người xác nhận #
                {receipt.confirmedBy}
              </>
            )}
          </p>
        )}
        <InventoryNotice error={error} />
        <form
          id={WORK_FORM}
          className="tf-form"
          onSubmit={(e) => {
            e.preventDefault()
            void save()
          }}
        >
          <fieldset disabled={busy || !canRecord}>
            <div className="tf-table">
              <table>
                <thead>
                  <tr>
                    <th>Phụ tùng</th>
                    <th>{mode === 'receipt' ? 'Theo phiếu' : 'Kế hoạch'}</th>
                    <th>
                      {mode === 'receipt'
                        ? 'Số đạt'
                        : mode === 'extra'
                          ? 'Xuất thêm'
                          : 'Đã soạn'}
                    </th>
                    <th>{mode === 'receipt' ? 'Số hỏng' : 'Lý do thiếu'}</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => (
                    <tr key={l.productId}>
                      <td>
                        {l.sku}
                        <small>{l.partName}</small>
                        {preparation && 'storageArea' in l && (
                          <small>
                            {l.storageArea} / {l.binLocation} · Tồn khả dụng{' '}
                            {l.sellableQty}
                            {l.barcodes?.length
                              ? ' · Mã vạch: ' + l.barcodes.join(', ')
                              : ''}
                            {l.pickFirst?.map((lot) => (
                              <small key={lot.lotId}>
                                Lô {lot.manufacturerLotNo ?? lot.lotId} · Lấy{' '}
                                {lot.takeQty} · Hạn{' '}
                                {lot.expiryDate ?? 'Không có'}
                              </small>
                            ))}
                            {l.sellableQty < l.plannedQty && (
                              <small className="tf-validation-hint">
                                Kho nguồn thiếu {l.plannedQty - l.sellableQty}{' '}
                                so với kế hoạch.
                              </small>
                            )}
                          </small>
                        )}
                      </td>
                      <td>
                        {'documentQty' in l ? (
                          <>
                            {l.documentQty}
                            <small>
                              Thực nhận: {l.deliveredQty} · Thừa: {l.excessQty}
                            </small>
                          </>
                        ) : 'plannedQty' in l ? (
                          l.plannedQty
                        ) : (
                          0
                        )}
                      </td>
                      <td>
                        <input
                          aria-label={'Số lượng ' + l.sku}
                          required
                          type="number"
                          min={0}
                          max={
                            'sellableQty' in l
                              ? Math.min(l.plannedQty, l.sellableQty)
                              : 2147483647
                          }
                          aria-invalid={
                            'sellableQty' in l &&
                            values[l.productId].qty > l.sellableQty
                          }
                          value={values[l.productId].qty}
                          onChange={(e) =>
                            setValues({
                              ...values,
                              [l.productId]: {
                                ...values[l.productId],
                                qty: Number(e.target.value),
                              },
                            })
                          }
                        />
                      </td>
                      <td>
                        {mode === 'receipt' ? (
                          <input
                            aria-label={'Số hỏng ' + l.sku}
                            type="number"
                            required
                            min={0}
                            max={100000}
                            value={values[l.productId].damaged}
                            onChange={(e) =>
                              setValues({
                                ...values,
                                [l.productId]: {
                                  ...values[l.productId],
                                  damaged: Number(e.target.value),
                                },
                              })
                            }
                          />
                        ) : (
                          <input
                            aria-label={'Lý do ' + l.sku}
                            maxLength={255}
                            value={values[l.productId].reason}
                            onChange={(e) =>
                              setValues({
                                ...values,
                                [l.productId]: {
                                  ...values[l.productId],
                                  reason: e.target.value,
                                },
                              })
                            }
                          />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {mode === 'extra' && (
              <label className="tf-note">
                Lý do (bắt buộc nếu xác nhận 0)
                <textarea
                  required={lines.some((l) => values[l.productId].qty === 0)}
                  maxLength={500}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
            )}
          </fieldset>
        </form>
      </section>
      {action && (
        <TransferAction
          title={
            action === 'confirm' ? 'Xác nhận nhận hàng' : 'Yêu cầu kiểm lại'
          }
          path={`/transfer-orders/${id}/receipts/${receipt!.id}/${action}`}
          payload={() => (action === 'recount' ? { reason } : undefined)}
          onClose={() => setAction('')}
          onSaved={() => {
            setAction('')
            onSaved(
              action === 'confirm'
                ? 'Đã xác nhận nhận hàng.'
                : 'Đã gửi yêu cầu kiểm lại.',
            )
          }}
        >
          {action === 'recount' ? (
            <label>
              Lý do
              <textarea
                required
                maxLength={255}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
          ) : (
            <p>
              Xác nhận kết quả kiểm nhận và nhập kho theo các lô của phiếu
              chuyển?
            </p>
          )}
        </TransferAction>
      )}
    </>
  )
}
