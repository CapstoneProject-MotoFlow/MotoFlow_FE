/**
 * File: modules/transfers/TransferReceiptCreatePage.tsx
 * Loại: MÀN HÌNH — route /transfer-orders/:id/receipts/new (STAFF, BRANCH_MANAGER).
 * Công dụng: Người được BM kho nhận giao việc nhận hàng điều chuyển (TRANSFER_RECEIVING) lập phiếu nhận khi hàng tới,
 * xem thông tin bàn giao từ lần xuất và có thể đính kèm ảnh lúc nhận.
 */
import { useRef, useState, type FormEvent } from 'react'
import { isAxiosError } from 'axios'
import { Link, useNavigate, useParams } from 'react-router-dom'
import axiosClient from '../../shared/api/axiosClient'
import PageBackLink from '../../shared/ui/PageBackLink'
import { inventoryError, useInventoryData } from '../inventory/api'
import { InventoryNotice } from '../inventory/components'
import { dateTime } from '../inventory/presentation'
import { refreshNotifications } from '../notifications/notificationService'
import { useReceivingTasks } from '../operations/useReceivingTasks'
import LocalizedFileInput from '../../shared/ui/LocalizedFileInput'
import { receiptDatesInFuture } from '../receiving/receivingRules'
import {
  receiptDocumentUploadEnabled,
  useDeliveryDocuments,
} from '../receiving/useDeliveryDocuments'
import CardHead, { HeadButton } from './CardHead'
import { states, type Transfer } from './types'
import { documentCode } from '../../shared/utils/documentCode'
import './transfers.css'

const FORM_ID = 'transfer-receipt-create'
const SUBMIT_LABEL = 'Lập phiếu nhận'
const NOT_ASSIGNED_MESSAGE = 'Cần giao việc nhận hàng trước khi lập phiếu.'

export default function TransferReceiptCreatePage() {
  const { id } = useParams(),
    valid = !!id && /^[1-9]\d*$/.test(id),
    code = documentCode('DC', id),
    navigate = useNavigate()
  const order = useInventoryData<Transfer>(
    '/transfer-orders/' + id,
    {},
    0,
    valid,
  )
  const docs = useDeliveryDocuments(SUBMIT_LABEL)
  const [error, setError] = useState(''),
    [stage, setStage] = useState<'uploading' | 'creating'>()
  const lock = useRef(false)
  const d = order.data
  // Staff không xem được số đã nhận/chưa xử lý (BE trả null): khi đó hiện số đã xuất, để BE kiểm phần còn chờ nhận.
  const counted = !!d?.lines.some((l) => l.unresolvedQty != null)
  const hasAnyDiscrepancy =
    !counted ||
    (d?.lines ?? []).some(
      (line) =>
        (line.shortageQty ?? 0) > 0 ||
        (line.damagedQty ?? 0) > 0 ||
        (line.wrongItemQty ?? 0) > 0 ||
        (line.extraReceivedQty ?? 0) > 0,
    )
  const pending = (d?.lines ?? []).filter((l) =>
    counted ? (l.unresolvedQty ?? 0) > 0 : (l.dispatchedQty ?? 0) > 0,
  )
  const open =
    !!d &&
    ['IN_TRANSIT', 'RECONCILING'].includes(d.status) &&
    pending.length > 0 &&
    !d.receipts.some(
      (r) => r.receiptType === 'TRANSFER_IN' && r.status !== 'CONFIRMED',
    )
  // Chỉ người đang giữ việc nhận hàng của lệnh này (TRANSFER_RECEIVING) mới được lập phiếu nhận.
  const receiving = useReceivingTasks(['TRANSFER_RECEIVING'], valid && !!d)
  const assigned = receiving.tasks.some(
    (task) => task.documentId === Number(id),
  )
  const awaitingAssignee =
    open && !receiving.loading && !receiving.failed && !assigned
  const canCreate = open && assigned
  const saving = stage !== undefined

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (lock.current || !canCreate) return
    const form = new FormData(event.currentTarget)
    const arrivedAt = String(form.get('arrivedAt') ?? '')
    if (receiptDatesInFuture('', arrivedAt)) {
      setError('Thời điểm hàng đến không được sau thời điểm hiện tại.')
      docs.refreshDateLimits()
      return
    }
    if (
      arrivedAt &&
      d?.dispatchedAt &&
      new Date(arrivedAt).getTime() < new Date(d.dispatchedAt).getTime()
    ) {
      setError('Thời điểm hàng đến không được trước thời điểm xuất kho.')
      return
    }
    const files = form.getAll('photos').filter(
      (file): file is File => file instanceof File && file.size > 0,
    )
    if (files.length > 10) {
      setError('Chọn tối đa 10 ảnh nhận hàng.')
      return
    }
    lock.current = true
    setError('')
    setStage(files.length ? 'uploading' : 'creating')
    let creating = false
    try {
      const photos = await docs.upload(files)
      setStage('creating')
      creating = true
      const { data } = await axiosClient.post<{ id: number }>(
        '/transfer-orders/' + id + '/receipts',
        { arrivedAt: arrivedAt || null, photos },
      )
      refreshNotifications()
      navigate('/transfer-orders/' + id + '/receipts/' + data.id)
    } catch (e) {
      // BE trả 403 khi tạo phiếu nhận hàng: người lập không giữ việc nhận hàng của lệnh này.
      setError(
        creating && isAxiosError(e) && e.response?.status === 403
          ? NOT_ASSIGNED_MESSAGE
          : inventoryError(e),
      )
    } finally {
      lock.current = false
      setStage(undefined)
    }
  }

  return (
    <main className="dashboard-content tf-page tf-detail-page">
      <PageBackLink to={'/transfer-orders/' + (valid ? id : '')} />
      <header>
        <div>
          <h1>Lập phiếu nhận điều chuyển</h1>
        </div>
      </header>
      <InventoryNotice
        loading={order.loading}
        error={valid ? order.error : 'Không tìm thấy lệnh điều chuyển.'}
        onRetry={order.retry}
      />
      {d && (
        <form
          id={FORM_ID}
          className="tf-form"
          onSubmit={submit}
          onInvalid={(event) => {
            const message = docs.invalidMessage(event)
            if (message) setError(message)
          }}
        >
          <section>
            <CardHead
              title={'Lệnh ' + code}
              status={
                d.status === 'RECONCILING' && !hasAnyDiscrepancy
                  ? 'Chờ đóng lệnh'
                  : (states[d.status] ?? d.status)
              }
            >
              {stage && (
                <span className="tf-head-meta" role="status">
                  {stage === 'uploading'
                    ? 'Đang tải ảnh nhận hàng…'
                    : 'Đang lập phiếu nhận…'}
                </span>
              )}
              <HeadButton
                action={{
                  key: 'create',
                  label: SUBMIT_LABEL,
                  icon: 'receipt',
                  primary: true,
                  form: FORM_ID,
                  disabled: saving || !canCreate,
                }}
              />
            </CardHead>
            {error && (
              <p
                className="tf-note receiving-receipt-submit-error"
                role="alert"
              >
                {error}
              </p>
            )}
            {!open && (
              <p className="tf-note" role="status">
                Lệnh này không còn hàng chờ nhận hoặc đã có phiếu nhận đang mở.
              </p>
            )}
            {open && !assigned && receiving.failed && (
              <p role="alert">
                Không tải được việc nhận hàng của bạn. Vui lòng tải lại trang.
              </p>
            )}
            {awaitingAssignee && (
              <p className="tf-note" role="status">
                {NOT_ASSIGNED_MESSAGE}{' '}
                <Link to={'/transfer-orders/' + id}>
                  Mở lệnh để giao việc
                </Link>
              </p>
            )}
            <div className="tf-detail-meta">
              <div>
                <span>Kho xuất</span>
                <strong>{d.sourceStoreName}</strong>
              </div>
              <div>
                <span>Kho nhận</span>
                <strong>{d.destStoreName}</strong>
              </div>
              <div>
                <span>Xuất kho</span>
                <strong>{d.dispatchedBy?.fullName ?? '—'}</strong>
                {d.dispatchedAt && <small>{dateTime(d.dispatchedAt)}</small>}
              </div>
              <div>
                <span>Người giao</span>
                <strong>{d.delivererName || '—'}</strong>
              </div>
              <div>
                <span>Biển số xe</span>
                <strong>{d.vehiclePlateNo || '—'}</strong>
              </div>
              <div>
                <span>{counted ? 'Hàng chờ nhận' : 'Hàng đã xuất'}</span>
                <strong>
                  {pending.length} mã ·{' '}
                  {pending.reduce(
                    (n, l) =>
                      n + ((counted ? l.unresolvedQty : l.dispatchedQty) ?? 0),
                    0,
                  )}{' '}
                  phụ tùng
                </strong>
              </div>
            </div>
            <div className="tf-table">
              <table>
                <thead>
                  <tr>
                    <th>Phụ tùng</th>
                    <th>Đơn vị</th>
                    <th>Đã xuất</th>
                    {counted && <th>Đã nhận</th>}
                    {counted && <th>Chờ nhận</th>}
                  </tr>
                </thead>
                <tbody>
                  {d.lines.map((l) => (
                    <tr key={l.productId}>
                      <td>
                        {l.sku}
                        <small>{l.partName}</small>
                      </td>
                      <td>{l.baseUnit}</td>
                      <td>{l.dispatchedQty ?? '—'}</td>
                      {counted && <td>{l.receivedQty ?? 0}</td>}
                      {counted && <td>{l.unresolvedQty ?? '—'}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section>
            <h2>Thông tin nhận hàng</h2>
            <div className="tf-detail-meta">
              <label>
                Thời điểm hàng đến
                <input
                  name="arrivedAt"
                  type="datetime-local"
                  max={docs.dateLimits.dateTime}
                  min={d.dispatchedAt?.slice(0, 19)}
                  step={1}
                  onFocus={docs.refreshDateLimits}
                  disabled={saving || !canCreate}
                />
              </label>
              {receiptDocumentUploadEnabled && (
                <div>
                  <span>Ảnh nhận hàng (không bắt buộc)</span>
                  <LocalizedFileInput
                    name="photos"
                    aria-label="Ảnh nhận hàng"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    disabled={saving || !canCreate}
                  />
                </div>
              )}
            </div>
          </section>
        </form>
      )}
    </main>
  )
}
