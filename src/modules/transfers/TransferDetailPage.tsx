import PageBackLink from '../../shared/ui/PageBackLink'
import ConfirmDialog from '../../shared/ui/ConfirmDialog'
import axiosClient from '../../shared/api/axiosClient'
import { inventoryError } from '../inventory/api'
import LocalizedFileInput from '../../shared/ui/LocalizedFileInput'
import { uploadAttachment } from '../../shared/api/upload'
import CardHead, { HeadButton, type HeadAction } from './CardHead'
import DebtEvidence from '../receivables/DebtEvidence'
import { canCoordinateTransfers } from '../../shared/utils/roles'
import { dateTime } from '../inventory/presentation'
import CoordinationAction from './CoordinationAction'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useInventoryData, useInventoryScope } from '../inventory/api'
import { InventoryNotice } from '../inventory/components'
import TransferAction from './TransferAction'
import { states, type Transfer } from './types'
import TransferWorkPage from './TransferWorkPage'
import './transfers.css'
import { canConfirmExcess, receiptAcceptsResult } from './transferRules'
import { useReturnQuantities } from './useReturnQuantities'
import { resolutionNames } from './types'
import TransferWrongItemSection from './TransferWrongItemSection'
import ReceiverMiscountAction from './ReceiverMiscountAction'
import ReceivingAssignment from '../operations/ReceivingAssignment'
import { useReceivingTasks } from '../operations/useReceivingTasks'
import { receivingCreatePath } from '../operations/receivingTaskModel'
import ReceiptDocumentSummary from './ReceiptDocumentSummary'
import { documentCode } from '../../shared/utils/documentCode'
type Dispatch = {
  canConfirm: boolean
  lines: {
    productId: number
    sku: string
    preparedQty: number | null
    plannedQty: number
    shortageQty: number | null
    lots: import('./types').PickLot[]
    sellableQty: number
  }[]
}
type Closing = {
  canClose: boolean
  blockedBy: string[]
  lines: {
    sku: string
    dispatchedQty: number
    receivedQty: number
    returnedQty: number
    lossQty: number
    unresolvedQty: number
    extraReceivedQty: number
    extraDispatchedQty: number
    sourceSellableQty: number
    /** BE #98 */
    damagedQty?: number
    pendingExcessQty?: number
    /** PM 23/11: khi đóng, cộng lại kho gửi (không giao bù), tính là mất, hàng thừa tự chấp nhận. */
    toSourceQty?: number
    toLossQty?: number
    excessToAcceptQty?: number
    wrongItemQty?: number
    wrongPendingQty?: number
    wrongAwaitingOwnerQty?: number
    receiverMiscounted?: boolean
  }[]
}
/** Lý do đóng phiếu bị chặn (blockedBy của closing-preview). */
const closeBlockers: Record<string, string> = {
  MSG221: 'Còn số lượng chưa có kết quả cuối',
  MSG222: 'Chưa xác nhận hàng thừa',
  MSG223: 'Kho nguồn không đủ tồn cho phần thừa',
  MSG225: 'Còn phiếu nhận hoặc trả chưa xác nhận',
  MSG336: 'Kho nhận chưa xác nhận xử lý sai lệch',
  MSG337: 'Số hàng đi đường không khớp kết quả đối soát',
  MSG339:
    'Kho gửi không đủ tồn khả dụng cho hàng thừa sẽ chấp nhận (không tính hàng đang giữ cho đơn bán)',
  MSG340: 'Còn yêu cầu trả hàng hoặc điều chỉnh đang xử lý',
  MSG341: 'Kho gửi không có lô cùng hạn sử dụng cho hàng thừa sẽ chấp nhận',
  MSG342:
    'Còn hàng giao sai chưa xử lý: lập phiếu nhận hàng giao sai và chờ Owner xác nhận',
}
type TransferEvent = Transfer['discrepancies'][number]['events'][number]

/** Tên bước xử lý; Nhận sau chưa tới là sự kiện LATE_DELIVERY_RECEIVED chưa xác nhận. */
function eventName(event: TransferEvent) {
  if (event.resolutionType === 'LATE_DELIVERY_RECEIVED' && !event.confirmedAt)
    return 'Nhận sau (chờ hàng)'
  if (event.resolutionType === 'NO_REPLACEMENT')
    return event.confirmedAt
      ? 'Không cần giao bù, đã trả lại kho gửi'
      : 'Không cần giao bù'
  if (event.resolutionType === 'RECEIVED_AS_OTHER_PRODUCT')
    return (
      'Phiếu nhận hàng giao sai: ' +
      (event.receivedSku ?? 'phụ tùng khác') +
      (event.status === 'CONFIRMED'
        ? ' · Owner đã xác nhận'
        : event.status === 'CANCELLED'
          ? ' · Đã hủy'
          : ' · Chờ Owner xác nhận')
    )
  return resolutionNames[event.resolutionType] ?? 'Bước xử lý khác'
}

function miscountEvent(order: Transfer, productId: number) {
  return order.discrepancies
    .filter((item) => item.productId === productId)
    .flatMap((item) => item.events)
    .find((event) => event.resolutionType === 'RECEIVER_MISCOUNT')
}

/** Tổng một cột của closing-preview, kèm danh sách SKU có số. */
function closingSummary(
  data: Closing,
  key: 'toSourceQty' | 'toLossQty' | 'excessToAcceptQty',
) {
  const rows = data.lines.filter((line) => (line[key] ?? 0) > 0)
  return rows.length
    ? rows.map((line) => line.sku + ' x' + line[key]).join(', ')
    : 'Không có'
}

export default function TransferDetailPage() {
  const { id } = useParams(),
    scope = useInventoryScope(),
    [revision, setRevision] = useState(0),
    [action, setAction] = useState(''),
    [success, setSuccess] = useState(''),
    [acknowledging, setAcknowledging] = useState(false),
    [ackError, setAckError] = useState(''),
    navigate = useNavigate()
  const openReceipt = (receiptId: number) =>
    navigate('/transfer-orders/' + id + '/receipts/' + receiptId, {
      state: { assignNow: true },
    })
  const r = useInventoryData<Transfer>(
      '/transfer-orders/' + id,
      {},
      revision,
      !!id && /^\d+$/.test(id),
    ),
    d = r.data,
    coordinator = canCoordinateTransfers(scope.user),
    bm = scope.user?.role === 'BRANCH_MANAGER',
    source = bm && scope.user?.storeId === d?.sourceStoreId,
    dest = bm && scope.user?.storeId === d?.destStoreId,
    dispatch = useInventoryData<Dispatch>(
      '/transfer-orders/' + id + '/dispatch-preview',
      {},
      revision,
      source &&
        d?.status === 'AWAITING_DISPATCH' &&
        d.lines.some((line) => (line.preparedQty ?? 0) > 0),
    ),
    closing = useInventoryData<Closing>(
      '/transfer-orders/' + id + '/closing-preview',
      {},
      revision,
      coordinator &&
        !!r.data &&
        ['IN_TRANSIT', 'RECONCILING'].includes(r.data.status),
    ),
    returns = useReturnQuantities(d, source && d?.status === 'RECONCILING'),
    pendingReceipt = d?.receipts.find(
      (receipt) =>
        receipt.receiptType === 'TRANSFER_IN' && receipt.status !== 'CONFIRMED',
    ),
    moving = !!d && ['IN_TRANSIT', 'RECONCILING'].includes(d.status),
    awaitingArrival =
      moving &&
      !pendingReceipt &&
      // Staff không thấy số chưa xử lý (null): để BE quyết định còn nhận được không. PM 23/11: phần thiếu (kể cả
      // Nhận sau) còn đi đường thì còn chờ hàng; hàng giao sai không đến muộn được.
      !!d?.lines.some(
        (line) => line.unresolvedQty == null || (line.shortageQty ?? 0) > 0,
      ),
    // Nhân viên đang giữ việc nhận hàng của lệnh này thì lập phiếu nhận ngay từ trang chi tiết.
    staffReceiving = useReceivingTasks(
      ['TRANSFER_RECEIVING'],
      scope.user?.role === 'STAFF' && awaitingArrival,
    ).tasks.some((task) => task.documentId === d?.id)
  const unresolvedLines = (d?.lines ?? [])
    .filter((l) => (l.unresolvedQty ?? 0) > 0)
    .map((l) => ({
      productId: l.productId,
      sku: l.sku,
      quantity: l.unresolvedQty!,
    }))
  const dispatchStockShort = dispatch.data?.lines.some(
    (line) => (line.preparedQty ?? 0) > line.sellableQty,
  )
  // Nút "Xử lý phần thiếu" / "Ghi nhận hàng trả về nguồn" cũng nằm trên đầu thẻ (trước đây ở phần Sai lệch cuối trang).
  const coordinationInHead =
    !!d &&
    d.status === 'RECONCILING' &&
    d.discrepancies.length > 0 &&
    (coordinator || source || dest)
  // PM 22/11 + BE #98: lệnh đang đối soát mà còn hàng hỏng/thiếu chưa xử lý: BM kho nhận "Xác nhận xử lý"
  // (coi như đã nhận đủ, không đổi trạng thái), Owner được báo rồi mới đóng phiếu.
  const needsAcknowledgement =
    !!d &&
    d.status === 'RECONCILING' &&
    !d.discrepancyAcknowledgedAt &&
    // Cùng điều kiện MSG336 của BE (PM 23/11, B-6): còn thiếu, hỏng hoặc giao sai.
    d.lines.some(
      (line) =>
        (line.shortageQty ?? 0) > 0 ||
        (line.damagedQty ?? 0) > 0 ||
        (line.wrongItemQty ?? 0) > 0,
    )
  // Review #73 (73-2): còn phiếu nhận chưa xác nhận thì BE từ chối (MSG29), nên chưa hiện nút.
  const canAcknowledge = needsAcknowledgement && !pendingReceipt
  // PM 23/11 (B-5): chỉ Owner, khi lệnh đang đối soát, sửa dòng theo "Bên nhận kiểm sai".
  const miscountAllowed = !!scope.owner && d?.status === 'RECONCILING'
  // Sau khi kho nhận xác nhận, BE chỉ cho Owner đóng phiếu.
  const ownerOnlyClose =
    !!d?.discrepancyAcknowledgedAt && scope.user?.role !== 'OWNER'
  // Mọi thao tác của lệnh nằm một chỗ ở góc phải tiêu đề thẻ; mỗi vai trò chỉ có một nút chính (nền xanh).
  const actions: HeadAction[] = []
  let closeAction: HeadAction | undefined
  if (d) {
    const base = '/transfer-orders/' + id
    if (staffReceiving)
      actions.push({
        key: 'create-receipt',
        label: 'Lập phiếu nhập',
        icon: 'receipt',
        to: receivingCreatePath('TRANSFER_RECEIVING', d.id),
        primary: true,
      })
    if (
      scope.user?.role === 'STAFF' &&
      pendingReceipt &&
      receiptAcceptsResult(pendingReceipt.status)
    )
      actions.push({
        key: 'count',
        label: 'Ghi/Đếm',
        icon: 'clipboard',
        to: base + '/receipts/' + pendingReceipt.id,
        primary: true,
      })
    if (d.status === 'AWAITING_DISPATCH') {
      if (scope.user?.role === 'STAFF')
        actions.push({
          key: 'prepared',
          label: 'Ghi số đã soạn',
          icon: 'clipboard',
          to: base + '/prepare',
          primary: true,
        })
      if (source)
        actions.push({
          key: 'assign',
          label: 'Giao việc soạn hàng',
          icon: 'users',
          to: base + '/prepare',
          primary: !dispatch.data?.canConfirm,
        })
      if (source && dispatch.data?.canConfirm)
        actions.push({
          key: 'dispatch',
          label: 'Xác nhận xuất',
          icon: 'truck',
          onClick: () => setAction('dispatch'),
          primary: true,
        })
    }
    if (dest && moving && pendingReceipt)
      actions.push({
        key: 'receipt',
        label: 'Tiếp tục phiếu nhận điều chuyển',
        icon: 'receipt',
        to: base + '/receipts/' + pendingReceipt.id,
        primary: true,
      })
    if (dest && canAcknowledge)
      actions.push({
        key: 'acknowledge',
        label: 'Xác nhận xử lý',
        icon: 'check',
        onClick: () => {
          setAckError('')
          setAcknowledging(true)
        },
        primary: !actions.some((act) => act.primary),
      })
    if (source && canConfirmExcess(d.status, d.lines))
      actions.push({
        key: 'extra',
        label: 'Xác nhận hàng gửi dư',
        icon: 'layers',
        to: base + '/extra',
      })
    if (closing.data && moving && !ownerOnlyClose)
      closeAction = {
        key: 'close',
        label: 'Xem trước đóng phiếu',
        icon: 'lock',
        onClick: () => setAction('close'),
        primary:
          !actions.some((act) => act.primary) &&
          !(
            coordinationInHead &&
            ((!!(dest || scope.owner) && unresolvedLines.length > 0) ||
              (source && !!returns.data?.length))
          ),
      }
  }
  return (
    <main className="dashboard-content tf-page tf-detail-page">
      <PageBackLink to="/transfer-orders" />
      <header>
        <div>
          <h1>Lệnh điều chuyển {documentCode('DC', id)}</h1>
        </div>
      </header>
      <InventoryNotice loading={r.loading} error={r.error} />
      {success && (
        <p className="tf-success-notice" role="status">
          {success}
        </p>
      )}
      {ackError && (
        <p className="stock-error" role="alert">
          {ackError}
        </p>
      )}
      {coordinator && needsAcknowledgement && (
        <p className="tf-note" role="status">
          Kho nhận chưa xác nhận xử lý hàng hỏng/thiếu/giao sai. Owner đóng phiếu sau khi kho nhận xác nhận.
        </p>
      )}
      {dest && needsAcknowledgement && pendingReceipt && (
        <p className="tf-note" role="status">
          Xác nhận phiếu nhận điều chuyển trước, sau đó mới xác nhận xử lý sai lệch.
        </p>
      )}
      {coordinator && ownerOnlyClose && moving && (
        <p className="tf-note" role="status">
          Kho nhận đã xác nhận xử lý. Chỉ Owner đóng phiếu.
        </p>
      )}
      {d && (
        <>
          <section>
            <CardHead
              title={d.sourceStoreName + ' đến ' + d.destStoreName}
              status={states[d.status]}
            >
              {actions.map((act) => (
                <HeadButton key={act.key} action={act} />
              ))}
              {dest && awaitingArrival && (
                <ReceivingAssignment
                  key="receiving"
                  taskType="TRANSFER_RECEIVING"
                  documentId={d.id}
                  onSaved={(name) =>
                    setSuccess('Đã giao việc nhận hàng cho ' + name + '.')
                  }
                />
              )}
              {coordinationInHead && (
                <CoordinationAction
                  inHead
                  // PM 23/11: BM kho nhận (hoặc Owner) chọn Nhận sau / Không cần giao bù.
                  canDecide={dest || scope.owner}
                  canReturn={source && !!returns.data?.length}
                  returnLines={returns.data ?? []}
                  id={d.id}
                  lines={unresolvedLines}
                  onSaved={(receiptId) =>
                    receiptId
                      ? openReceipt(receiptId)
                      : setRevision((n) => n + 1)
                  }
                />
              )}
              {closeAction && <HeadButton key="close" action={closeAction} />}
            </CardHead>
            <div className="tf-detail-meta">
              <div>
                <span>Kho nguồn</span>
                <strong>{d.sourceStoreName}</strong>
              </div>
              <div>
                <span>Kho đích</span>
                <strong>{d.destStoreName}</strong>
              </div>
              {d.discrepancyAcknowledgedAt && (
                <div>
                  <span>Kho nhận xác nhận xử lý</span>
                  <strong>{d.discrepancyAcknowledgedBy?.fullName ?? '—'}</strong>
                  <small>{dateTime(d.discrepancyAcknowledgedAt)}</small>
                </div>
              )}
              <div>
                <span>Người tạo</span>
                <strong>{d.createdBy?.fullName ?? '—'}</strong>
                <small>{dateTime(d.createdAt)}</small>
              </div>
              <div>
                <span>Yêu cầu bổ sung</span>
                {d.replenishmentRequestId && (coordinator || dest) ? (
                  <Link
                    to={'/replenishment-requests/' + d.replenishmentRequestId}
                  >
                    {documentCode('YBS', d.replenishmentRequestId)}
                  </Link>
                ) : d.replenishmentRequestId ? (
                  <strong>
                    {documentCode('YBS', d.replenishmentRequestId)}
                  </strong>
                ) : (
                  <strong>Lập trực tiếp</strong>
                )}
              </div>
            </div>
            <div className="tf-stage-track">
              {[
                ['AWAITING_DISPATCH', 'Chờ xuất'],
                ['IN_TRANSIT', 'Đang chuyển'],
                ['RECONCILING', 'Đối soát'],
                ['CLOSED', 'Đã đóng'],
              ].map(([state, label], i) => (
                <span
                  key={state}
                  className={
                    i <=
                    [
                      'AWAITING_DISPATCH',
                      'IN_TRANSIT',
                      'RECONCILING',
                      'CLOSED',
                    ].indexOf(d.status)
                      ? 'is-active'
                      : ''
                  }
                >
                  {label}
                </span>
              ))}
            </div>
            <div className="tf-table">
              <table>
                <thead>
                  <tr>
                    <th>Phụ tùng</th>
                    <th>Kế hoạch</th>
                    <th>Đã soạn</th>
                    <th>Đã xuất</th>
                    <th>Đạt</th>
                    <th>Hỏng</th>
                    <th>Giao sai</th>
                    <th>Thiếu</th>
                    <th>Không giao bù</th>
                    <th>Mất</th>
                    <th>Chờ quyết</th>
                  </tr>
                </thead>
                <tbody>
                  {d.lines.map((l) => {
                    const miscount = l.receiverMiscounted
                      ? miscountEvent(d, l.productId)
                      : undefined
                    return (
                      <tr key={l.productId}>
                        <td>
                          {l.sku}
                          <small>{l.partName}</small>
                          {l.receiverMiscounted && (
                            <small className="tf-line-flag">
                              Owner sửa: bên nhận kiểm sai
                              {miscount?.reason ? ' · ' + miscount.reason : ''}
                            </small>
                          )}
                        </td>
                        <td>{l.plannedQty}</td>
                        <td>{l.preparedQty ?? 'Chưa ghi'}</td>
                        <td>{l.dispatchedQty ?? 'Chưa xuất'}</td>
                        <td>{l.receivedQty ?? '—'}</td>
                        <td>{l.damagedQty ?? '—'}</td>
                        <td>
                          {l.wrongItemQty ?? '—'}
                          {(l.wrongAwaitingOwnerQty ?? 0) > 0 && (
                            <small>
                              {l.wrongAwaitingOwnerQty} chờ Owner xác nhận
                            </small>
                          )}
                        </td>
                        <td>
                          {l.shortageQty ?? '—'}
                          {(l.latePendingQty ?? 0) > 0 && (
                            <small>{l.latePendingQty} nhận sau</small>
                          )}
                        </td>
                        <td>{l.noReplacementQty ?? '—'}</td>
                        <td>{l.lossQty ?? '—'}</td>
                        <td>{l.unresolvedQty ?? '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
          <section>
            <h2>Các lần nhận hàng</h2>
            {d.receipts.length > 0 && (
              <div className="tf-receipts-list">
                {d.receipts.map((receipt) => {
                  const canOpenReceipt =
                    coordinator ||
                    scope.user?.role === 'STAFF' ||
                    (receipt.receiptType === 'RETURN_TO_SOURCE' ? source : dest)
                  const content = (
                    <>
                      <span className="tf-receipt-card-title">
                        Phiếu nhận điều chuyển
                      </span>
                      <span className="tf-receipt-status">
                        {states[receipt.status] ?? receipt.status}
                      </span>
                      <span className="tf-receipt-card-date">
                        {dateTime(receipt.arrivedAt)}
                      </span>
                      <ReceiptDocumentSummary receipt={receipt} compact />
                    </>
                  )

                  return canOpenReceipt ? (
                    <Link
                      className="tf-receipt-card"
                      key={receipt.id}
                      to={'/transfer-orders/' + id + '/receipts/' + receipt.id}
                    >
                      {content}
                    </Link>
                  ) : (
                    <div className="tf-receipt-card" key={receipt.id}>
                      {content}
                    </div>
                  )
                })}
              </div>
            )}
            {!d.receipts.length && (
              <p className="tf-empty">
                {d.status === 'AWAITING_DISPATCH'
                  ? 'Phiếu chưa xuất kho nên chưa có lần nhận hàng.'
                  : 'Chưa có phiếu nhận. Nhân viên được quản lý kho nhận giao việc nhận hàng sẽ lập phiếu khi hàng tới.'}
              </p>
            )}
          </section>
          <section>
            <h2>Lô đã xuất</h2>
            <DebtEvidence files={d.attachments} />
            {d.extraDispatchConfirmedAt && (
              <p className="tf-note">
                Xác nhận hàng gửi dư: {d.extraDispatchConfirmedBy?.fullName} ·{' '}
                {dateTime(d.extraDispatchConfirmedAt)}
              </p>
            )}
            {d.lots.length ? (
              <div className="tf-table">
                <table>
                  <thead>
                    <tr>
                      <th>Lô</th>
                      <th>Phụ tùng</th>
                      <th>Hạn dùng</th>
                      <th>Số lượng</th>
                      {scope.owner && <th>Giá vốn</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {d.lots.map((l, i) => (
                      <tr key={i}>
                        <td>
                          {l.manufacturerLotNo || documentCode('L', l.lotId)}
                        </td>
                        <td>
                          {
                            d.lines.find((p) => p.productId === l.productId)
                              ?.sku
                          }
                        </td>
                        <td>{l.expiryDate ?? 'Không có'}</td>
                        <td>{l.quantity}</td>
                        {scope.owner && (
                          <td>
                            {l.unitCost == null
                              ? '—'
                              : l.unitCost.toLocaleString('vi-VN')}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="tf-empty tf-empty-lots">
                {d.status === 'AWAITING_DISPATCH'
                  ? 'Chưa xuất kho nên chưa phát sinh lô xuất.'
                  : 'Chưa có thông tin lô xuất.'}
              </p>
            )}
          </section>
          <section>
            <h2>Lịch sử lệnh</h2>
            <ol className="tf-order-history">
              <li>
                <strong>Tạo lệnh</strong>
                <span>
                  {dateTime(d.createdAt)} · {d.createdBy?.fullName ?? '—'}
                </span>
              </li>
              {d.dispatchedAt && (
                <li>
                  <strong>Xác nhận xuất</strong>
                  <span>
                    {dateTime(d.dispatchedAt)} · {d.dispatchedBy?.fullName}
                  </span>
                </li>
              )}
              {d.receipts.map((receipt) => (
                <li key={receipt.id}>
                  <strong>Hàng đến · Phiếu nhận điều chuyển</strong>
                  <span>
                    {dateTime(receipt.arrivedAt)} ·{' '}
                    {states[receipt.status] ?? receipt.status}
                  </span>
                </li>
              ))}
              {d.closedAt && (
                <li>
                  <strong>Đóng lệnh</strong>
                  <span>
                    {dateTime(d.closedAt)} · {d.closedBy?.fullName}
                  </span>
                </li>
              )}
            </ol>
          </section>
          {d.status === 'RECONCILING' && !coordinator && !dest && (
            <p className="tf-note" role="status">
              Kho nhận và Owner đang xử lý sai lệch.
            </p>
          )}
          {dest &&
            d.status === 'RECONCILING' &&
            unresolvedLines.length > 0 && (
              <p className="tf-note" role="status">
                Phần thiếu chưa chọn Nhận sau hoặc Không cần giao bù sẽ tính là
                mất khi Owner đóng phiếu.
              </p>
            )}
          {d.discrepancies.length > 0 && (
            <section>
              <h2>Sai lệch</h2>
              <InventoryNotice
                loading={returns.loading}
                error={returns.error}
              />
              <div className="stock-table-scroll">
                <table className="tf-table tf-discrepancy-table">
                  <thead>
                    <tr>
                      <th>Phụ tùng</th>
                      <th>Đã xuất</th>
                      <th>Đạt</th>
                      <th>Thiếu</th>
                      <th>Giao sai</th>
                      <th>Thừa</th>
                      <th>Chờ quyết</th>
                      <th>Trạng thái</th>
                      <th>Chi tiết</th>
                      {miscountAllowed && <th>Owner</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {d.discrepancies.map((c) => {
                      const line = d.lines.find(
                        (item) => item.productId === c.productId,
                      )
                      return (
                        <tr key={c.id}>
                          <td>{line?.sku ?? '—'} · {line?.partName ?? 'Phụ tùng'}</td>
                          <td>{line?.dispatchedQty ?? '—'}</td>
                          <td>{line?.receivedQty ?? '—'}</td>
                          <td>{line?.shortageQty ?? c.shortQty}</td>
                          <td>{line?.wrongItemQty ?? c.wrongItemQty ?? 0}</td>
                          <td>{line?.extraReceivedQty ?? '—'}</td>
                          <td><strong>{line?.unresolvedQty ?? '—'}</strong></td>
                          <td>{states[c.status] ?? c.status}</td>
                          <td>
                            {c.events.length ? (
                              <details>
                                <summary>{c.events.length} lần xử lý</summary>
                                <ul>
                                  {c.events.map((event) => (
                                    <li key={event.id}>
                                      {eventName(event)}
                                      {' · '}{event.quantity}
                                      {event.reason ? ' · ' + event.reason : ''}
                                      {event.recordedBy ? ' · ' + event.recordedBy.fullName : ''}
                                    </li>
                                  ))}
                                </ul>
                              </details>
                            ) : '—'}
                          </td>
                          {miscountAllowed && (
                            <td>
                              {c.status === 'OPEN' && line && !line.receiverMiscounted ? (
                                <ReceiverMiscountAction
                                  orderId={d.id}
                                  caseId={c.id}
                                  line={line}
                                  onSaved={(message) => {
                                    setSuccess(message)
                                    setRevision((n) => n + 1)
                                  }}
                                />
                              ) : (
                                '—'
                              )}
                            </td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}
          <TransferWrongItemSection
            order={d}
            canRecord={d.status === 'RECONCILING' && (dest || scope.owner)}
            onDone={(message) => {
              setSuccess(message)
              setRevision((n) => n + 1)
            }}
          />
          {action && (
            <TransferAction
              title={
                action === 'dispatch'
                  ? 'Xác nhận xuất kho'
                  : 'Đóng lệnh điều chuyển'
              }
              path={
                '/transfer-orders/' +
                id +
                (action === 'dispatch' ? '/dispatch' : '/close')
              }
              disabled={
                action === 'dispatch'
                  ? !dispatch.data?.canConfirm || dispatchStockShort
                  : action === 'close'
                    ? !closing.data?.canClose
                    : false
              }
              hideSubmit={action === 'close' && !closing.data?.canClose}
              payload={async (form) => {
                if (action !== 'dispatch') return undefined
                const fields = new FormData(form)
                const files = fields.getAll('dispatchEvidence').filter(
                  (file): file is File => file instanceof File && file.size > 0,
                )
                if (files.length > 10) throw new Error('Chọn tối đa 10 ảnh bàn giao.')
                const evidence = []
                for (const file of files) evidence.push(await uploadAttachment(file))
                return {
                  lines: dispatch.data!.lines.map((l) => ({
                    productId: l.productId,
                    dispatchedQty: l.preparedQty,
                  })),
                  delivererName: String(fields.get('delivererName') ?? '').trim() || null,
                  vehiclePlateNo: String(fields.get('vehiclePlateNo') ?? '').trim() || null,
                  evidence,
                }
              }}
              onClose={() => setAction('')}
              onSaved={() => {
                setAction('')
                setRevision((n) => n + 1)
              }}
            >
              <InventoryNotice
                loading={dispatch.loading || closing.loading}
                error={dispatch.error || closing.error}
              />
              {action === 'dispatch' &&
                dispatch.data?.lines.map((l) => (
                  <p key={l.productId}>
                    {l.sku} · Kế hoạch {l.plannedQty} · Đã soạn{' '}
                    {l.preparedQty ?? 0} · Thiếu {l.shortageQty ?? 0} · Tồn khả
                    dụng {l.sellableQty}
                    {l.lots?.map((lot) => (
                      <small key={lot.lotId}>
                        {' '}
                        Lô {lot.manufacturerLotNo ?? lot.lotId}: lấy{' '}
                        {lot.takeQty}, hạn {lot.expiryDate ?? 'không có'}
                      </small>
                    ))}
                  </p>
                ))}
              {action === 'dispatch' && (
                <div className="tf-detail-meta">
                  <label>
                    Người giao (không bắt buộc)
                    <input name="delivererName" maxLength={100} />
                  </label>
                  <label>
                    Biển số xe (không bắt buộc)
                    <input name="vehiclePlateNo" maxLength={20} />
                  </label>
                  <div>
                    <span>Ảnh bàn giao (không bắt buộc)</span>
                    <LocalizedFileInput
                      name="dispatchEvidence"
                      aria-label="Ảnh bàn giao"
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                    />
                  </div>
                </div>
              )}
              {action === 'dispatch' && dispatchStockShort && (
                <p role="alert" className="stock-error">
                  Tồn kho của kho nguồn thấp hơn số đã soạn. Hãy kiểm tra
                  lại tồn và cập nhật kết quả soạn hàng trước khi xác nhận xuất.
                </p>
              )}
              {action === 'dispatch' &&
                dispatch.data &&
                !dispatch.data.canConfirm && (
                  <p>
                    Chưa đủ điều kiện xác nhận hoặc bạn không có quyền xác nhận
                    phiếu này.
                  </p>
                )}
              {action === 'close' && closing.data && (
                <p>
                  {closing.data.canClose
                    ? 'Mọi số lượng đã có kết quả cuối. Xác nhận đóng phiếu?'
                    : 'Chưa thể đóng: ' +
                      closing.data.blockedBy
                        .map((code) => closeBlockers[code] ?? code)
                        .join('; ')}
                </p>
              )}
              {action === 'close' && closing.data && (
                <ul className="tf-close-summary">
                  <li>
                    Cộng lại kho gửi (không cần giao bù):{' '}
                    <strong>{closingSummary(closing.data, 'toSourceQty')}</strong>
                  </li>
                  <li>
                    Tính là mất:{' '}
                    <strong>{closingSummary(closing.data, 'toLossQty')}</strong>
                  </li>
                  <li>
                    Hàng thừa sẽ chấp nhận:{' '}
                    <strong>
                      {closingSummary(closing.data, 'excessToAcceptQty')}
                    </strong>
                  </li>
                </ul>
              )}
              {action === 'close' && closing.data && (
                <div className="tf-table">
                  <table>
                    <thead>
                      <tr>
                        {[
                          'Phụ tùng',
                          'Đã xuất',
                          'Đạt',
                          'Hỏng',
                          'Giao sai',
                          'Không giao bù',
                          'Tính là mất',
                          'Thừa sẽ chấp nhận',
                          'Tồn nguồn',
                        ].map((h) => (
                          <th key={h}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {closing.data.lines.map((l) => (
                        <tr key={l.sku}>
                          <td>{l.sku}</td>
                          {[
                            l.dispatchedQty,
                            l.receivedQty,
                            l.damagedQty ?? 0,
                            l.wrongItemQty ?? 0,
                            l.toSourceQty ?? 0,
                            l.toLossQty ?? 0,
                            l.excessToAcceptQty ?? 0,
                            l.sourceSellableQty,
                          ].map((v, i) => (
                            <td key={i}>{v}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TransferAction>
          )}
        </>
      )}
      {acknowledging && d && (
        <ConfirmDialog
          title="Xác nhận xử lý sai lệch"
          confirmLabel="Xác nhận xử lý"
          message={
            'Xác nhận kho ' +
            d.destStoreName +
            ' đã xử lý xong phần hàng hỏng/thiếu/giao sai của lệnh ' +
            documentCode('DC', d.id) +
            ': kho nhận chỉ giữ số hàng đạt, lệnh vẫn ở trạng thái đối soát và Owner được báo để đóng phiếu.' +
            (unresolvedLines.length
              ? ' Phần thiếu chưa chọn Nhận sau hoặc Không cần giao bù sẽ tính là mất khi Owner đóng phiếu: ' +
                unresolvedLines
                  .map((line) => line.sku + ' x' + line.quantity)
                  .join(', ') +
                '.'
              : '')
          }
          onCancel={() => setAcknowledging(false)}
          onConfirm={async () => {
            try {
              await axiosClient.post(
                '/transfer-orders/' + d.id + '/discrepancy-acknowledgement',
              )
              setSuccess('Đã xác nhận xử lý sai lệch. Owner đã được báo để đóng phiếu.')
              setRevision((n) => n + 1)
            } catch (failure) {
              // Review #73 (73-2): MSG29 = còn phiếu nhận/trả hoặc yêu cầu điều chỉnh đang xử lý.
              const code = (failure as { response?: { data?: { code?: string } } })
                .response?.data?.code
              setAckError(
                code === 'MSG29'
                  ? 'Chưa xác nhận được: lệnh còn phiếu nhận, phiếu trả hoặc yêu cầu điều chỉnh đang xử lý. Hoàn tất các phiếu đó rồi xác nhận lại.'
                  : inventoryError(failure),
              )
            } finally {
              setAcknowledging(false)
            }
          }}
        />
      )}
    </main>
  )
}
export { TransferWorkPage }
