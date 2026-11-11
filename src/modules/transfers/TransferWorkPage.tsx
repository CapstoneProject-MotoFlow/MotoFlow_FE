import WarehouseAssignmentDialog from '../operations/WarehouseAssignmentDialog'
import ExcessDispatchEditor from './ExcessDispatchEditor'
import { uploadAttachment } from '../../shared/api/upload'
import { receiptAcceptsResult } from './transferRules'
import { dateTime } from '../inventory/presentation'
import { useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import axiosClient from '../../shared/api/axiosClient'
import {
  useInventoryData,
  useInventoryScope,
  inventoryError,
} from '../inventory/api'
import { InventoryNotice } from '../inventory/components'
import type { Assignment } from '../inventory/countAssignment'
import TransferAction from './TransferAction'
import { states, type Preparation, type Receipt, type Transfer } from './types'
import './transfers.css'
export default function TransferWorkPage({
  mode = 'prepare',
}: {
  mode?: 'prepare' | 'receipt' | 'extra'
}) {
  const { id, receiptId } = useParams(),
    scope = useInventoryScope(),
    [revision, setRevision] = useState(0)
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
  return (
    <main className="dashboard-content tf-page">
      <header>
        <div>
          <Link to={'/transfer-orders/' + id}>← Chi tiết điều chuyển</Link>
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
      />
      {mode === 'prepare' && prep.data && (
        <WorkEditor
          key={'p' + revision}
          preparation={prep.data}
          id={id!}
          mode={mode}
          onSaved={() => setRevision((n) => n + 1)}
        />
      )}{' '}
      {mode === 'receipt' && receipt.data && order.data && (
        <WorkEditor
          key={'r' + revision}
          receipt={receipt.data}
          order={order.data}
          id={id!}
          mode={mode}
          onSaved={() => setRevision((n) => n + 1)}
        />
      )}{' '}
      {mode === 'extra' && order.data && (
        <ExcessDispatchEditor
          key={'e' + revision}
          order={order.data}
          onSaved={() => setRevision((n) => n + 1)}
        />
      )}{' '}
      {scope.user?.role === 'BRANCH_MANAGER' && mode !== 'extra' && (
        <AssignmentPanel
          key={'a' + revision}
          taskType={mode === 'prepare' ? 'DISPATCH_PREPARATION' : 'INSPECTION'}
          documentId={Number(mode === 'prepare' ? id : receiptId)}
          onSaved={() => setRevision((n) => n + 1)}
        />
      )}
    </main>
  )
}
function AssignmentPanel({
  taskType,
  documentId,
  onSaved,
}: {
  taskType: 'DISPATCH_PREPARATION' | 'INSPECTION'
  documentId: number
  onSaved: () => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <section>
      <h2>Giao việc cho nhân viên</h2>
      <div className="tf-note">
        <button className="tf-primary" onClick={() => setOpen(true)}>
          Giao / đổi nhân viên
        </button>
      </div>
      {open && (
        <WarehouseAssignmentDialog
          taskType={taskType}
          documentId={documentId}
          onClose={() => setOpen(false)}
          onSaved={onSaved}
        />
      )}
    </section>
  )
}
function WorkEditor({
  preparation,
  receipt,
  order,
  id,
  mode,
  onSaved,
}: {
  preparation?: Preparation
  receipt?: Receipt
  order?: Transfer
  id: string
  mode: string
  onSaved: () => void
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
  const receiptAssignment = useInventoryData<Assignment>(
    '/warehouse-tasks',
    { taskType: 'INSPECTION', documentId: receipt?.id },
    0,
    mode === 'receipt' && scope.user?.role === 'BRANCH_MANAGER' && !!receipt,
  )
  const lock = useRef(false),
    bm = scope.user?.role === 'BRANCH_MANAGER',
    canRecord =
      mode === 'prepare'
        ? !!preparation?.canRecord
        : mode === 'receipt'
          ? ['STAFF', 'BRANCH_MANAGER'].includes(scope.user?.role ?? '') &&
            receiptAcceptsResult(receipt?.status) &&
            (!bm ||
              receiptAssignment.data?.current?.assigneeId === scope.user?.id)
          : bm && scope.user?.storeId === order?.sourceStoreId
  const valid =
    lines.length > 0 &&
    lines.every((l) => {
      const v = values[l.productId]
      return (
        Number.isInteger(v.qty) &&
        v.qty >= 0 &&
        v.qty <=
          (mode === 'prepare' && 'plannedQty' in l
            ? l.plannedQty
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
      onSaved()
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
        <h2>
          {receipt
            ? 'Phiếu nhận #' +
              receipt.id +
              ' · ' +
              (states[receipt.status] ?? receipt.status)
            : 'Kết quả thực tế'}
        </h2>
        {receipt?.recountReason && (
          <p className="tf-note">Yêu cầu đếm lại: {receipt.recountReason}</p>
        )}
        {preparation && (
          <div className="tf-preparation-notice" role="status">
            {preparation.canRecord ? (
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
            ) : preparation.preparer ? (
              <>
                <strong>
                  Việc soạn đang giao cho {preparation.preparer.name}.
                </strong>
                <p>
                  Chỉ người được giao mới được nhập và gửi kết quả. Quản lý có
                  thể giao lại ở phần Giao việc nếu được phép; người xác nhận
                  xuất phải khác người soạn.
                </p>
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
            Nhập số lượng nguyên từ 0 đến 100.000; nếu thiếu so với kế hoạch,
            cần có lý do.
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
                    ? 'Kiểm tra số đạt, số hỏng rồi chọn Xác nhận nhận hàng. Nếu số liệu chưa đúng, chọn Yêu cầu kiểm lại để nhân viên cập nhật.'
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
                            mode === 'prepare' && 'plannedQty' in l
                              ? l.plannedQty
                              : 2147483647
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
            {canRecord && (
              <button
                className="tf-primary tf-submit-result"
                disabled={busy || !valid}
              >
                Gửi kết quả
              </button>
            )}
          </fieldset>
        </form>
      </section>
      {receipt &&
        bm &&
        scope.user?.storeId ===
          (receipt.receiptType === 'RETURN_TO_SOURCE'
            ? order?.sourceStoreId
            : order?.destStoreId) &&
        receipt.status === 'AWAITING_CONFIRMATION' && (
          <div className="tf-receipt-actions">
            <div>
              <strong>Duyệt kết quả kiểm nhận</strong>
              <p>Kiểm tra số đạt, số hỏng trước khi xác nhận nhập kho.</p>
            </div>
            <button
              className="tf-recount-button"
              onClick={() => setAction('recount')}
            >
              Yêu cầu kiểm lại
            </button>
            <button
              className="tf-primary tf-confirm-receipt"
              disabled={receipt.recordedBy === scope.user?.id}
              title={
                receipt.recordedBy === scope.user?.id
                  ? 'Người xác nhận phải khác người ghi kết quả'
                  : undefined
              }
              onClick={() => setAction('confirm')}
            >
              Xác nhận nhận hàng
            </button>
          </div>
        )}
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
            onSaved()
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
