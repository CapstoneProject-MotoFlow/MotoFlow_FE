/**
 * File: modules/transfers/TransferReceiptCreatePage.tsx
 * Loại: MÀN HÌNH — route /transfer-orders/:id/receipts/new (STAFF, BRANCH_MANAGER).
 * Công dụng: Người được BM kho nhận giao việc nhận hàng điều chuyển (TRANSFER_RECEIVING) lập phiếu nhận khi hàng tới,
 * nhập chứng từ giao hàng như phiếu nhập từ PO. Lập xong BE giao việc kiểm nhận cho chính người lập, màn chuyển sang ghi kết quả.
 */
import { useRef, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import axiosClient from '../../shared/api/axiosClient'
import PageBackLink from '../../shared/ui/PageBackLink'
import { inventoryError, useInventoryData } from '../inventory/api'
import { InventoryNotice } from '../inventory/components'
import { dateTime } from '../inventory/presentation'
import { refreshNotifications } from '../notifications/notificationService'
import DeliveryDocumentFields from '../receiving/DeliveryDocumentFields'
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
  const saving = stage !== undefined

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (lock.current || !open) return
    const form = event.currentTarget
    const read = docs.read(form)
    if ('error' in read) {
      setError(read.error)
      if (read.focus)
        form
          .querySelector<HTMLInputElement>('[name="' + read.focus + '"]')
          ?.focus()
      return
    }
    lock.current = true
    setError('')
    setStage(receiptDocumentUploadEnabled ? 'uploading' : 'creating')
    try {
      const documents = await docs.upload(read.files)
      setStage('creating')
      const { data } = await axiosClient.post<{ id: number }>(
        '/transfer-orders/' + id + '/receipts',
        { ...read.body, documents },
      )
      refreshNotifications()
      navigate('/transfer-orders/' + id + '/receipts/' + data.id)
    } catch (e) {
      setError(inventoryError(e))
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
              status={states[d.status] ?? d.status}
            >
              {stage && (
                <span className="tf-head-meta" role="status">
                  {stage === 'uploading'
                    ? 'Đang tải chứng từ…'
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
                  disabled: saving || !open,
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
            <h2>Chứng từ giao hàng</h2>
            <DeliveryDocumentFields
              state={docs}
              disabled={saving || !open}
              defaultDocumentNo={code}
            />
          </section>
        </form>
      )}
    </main>
  )
}
