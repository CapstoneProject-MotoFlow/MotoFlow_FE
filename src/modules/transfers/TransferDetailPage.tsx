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
import {
  canConfirmExcess,
  EXCESS_TIP,
  openWrongItems,
  receiptAcceptsResult,
  reconciliationTimeline,
  WRONG_ITEM_TIP,
  wrongParts,
} from './transferRules'
import InfoTip from '../../shared/ui/InfoTip'
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
    wrongAwaitingSourceQty?: number
    wrongConfirmedQty?: number
    wrongReturnedQty?: number
    receiverMiscounted?: boolean
  }[]
}
/** Lý do đóng phiếu bị chặn (blockedBy của closing-preview). */
const closeBlockers: Record<string, string> = {
  MSG221: 'Còn số lượng chưa có kết quả cuối',
  MSG222: 'Chưa xác nhận hàng thừa',
  MSG223: 'Kho nguồn không đủ tồn cho phần thừa',
  MSG225: 'Còn phiếu nhận hoặc trả chưa xác nhận',
  MSG336: 'Kho nhận chưa gửi yêu cầu đối soát',
  MSG337: 'Số hàng đi đường không khớp kết quả đối soát',
  MSG339:
    'Kho gửi không đủ tồn khả dụng cho hàng thừa sẽ chấp nhận (không tính hàng đang giữ cho đơn bán)',
  MSG340: 'Còn yêu cầu trả hàng hoặc điều chỉnh đang xử lý',
  MSG348: 'Còn hàng nhận sau chưa tới',
  MSG341: 'Kho gửi không có lô cùng hạn sử dụng cho hàng thừa sẽ chấp nhận',
  MSG342:
    'Còn hàng giao sai chưa xử lý: lập phiếu nhận (chờ kho gửi xác nhận) hoặc ghi hoàn trả',
  MSG363: 'Kho gửi chưa xác nhận đối soát',
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
        ? ' · Kho gửi đã xác nhận'
        : event.status === 'CANCELLED'
          ? ' · Đã hủy'
          : event.status === 'REJECTED'
            ? ' · Kho gửi từ chối' +
              (event.rejectionReason ? ': ' + event.rejectionReason : '')
            : ' · Chờ kho gửi xác nhận')
    )
  // GVHD 24/11 + R-14: hàng giao sai trả lại kho gửi, tồn không đổi; thể hiện rõ trạng thái xác nhận/từ chối.
  if (event.resolutionType === 'WRONG_ITEM_RETURNED')
    return (
      'Hoàn trả hàng giao sai: ' +
      (event.receivedSku ?? 'phụ tùng khác') +
      (event.status === 'CONFIRMED'
        ? ' · Kho gửi đã xác nhận nhận lại'
        : event.status === 'CANCELLED'
          ? ' · Đã hủy'
          : event.status === 'REJECTED'
            ? ' · Kho gửi từ chối' +
              (event.rejectionReason ? ': ' + event.rejectionReason : '')
            : event.status === 'AWAITING_SOURCE'
              ? ' · Chờ kho gửi xác nhận'
              : '')
    )
  return resolutionNames[event.resolutionType] ?? 'Bước xử lý khác'
}

function miscountEvent(order: Transfer, productId: number) {
  return order.discrepancies
    .filter((item) => item.productId === productId)
    .flatMap((item) => item.events)
    .find((event) => event.resolutionType === 'RECEIVER_MISCOUNT')
}

/**
 * PM 24/11: cột Đạt hiện đúng số người kiểm nhập trên phiếu nhận. BE trả receivedQty = đạt trong số đã xuất
 * (đã trừ hàng thừa), nên cộng lại extraReceivedQty. Chưa nhận thì null.
 */
function passedOf(line: Transfer['lines'][number]) {
  return line.receivedQty == null
    ? null
    : line.receivedQty + (line.extraReceivedQty ?? 0)
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
    [confirmingReconciliation, setConfirmingReconciliation] = useState(false),
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
  // Test 23/11 T-02: chưa có phiếu nhận nào được xác nhận thì BE vẫn trả thiếu = số xuất; bảng hiện '—' để không
  // trông như hàng thiếu hết. Logic chờ hàng (awaitingArrival) vẫn dùng số của BE.
  const received = !!d?.receipts.some(
    (receipt) =>
      receipt.receiptType === 'TRANSFER_IN' && receipt.status === 'CONFIRMED',
  )
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
  // GVHD 24/11: lệnh đang đối soát mà còn hàng thiếu/hỏng/giao sai: BM kho nhận "Gửi yêu cầu đối soát" (ghi chú, ảnh),
  // BM kho gửi xác nhận đối soát, rồi Owner mới đóng phiếu.
  const reconcilingWithDiscrepancy =
    !!d &&
    d.status === 'RECONCILING' &&
    // Cùng điều kiện MSG336 của BE (PM 23/11, B-6): còn thiếu, hỏng hoặc giao sai.
    d.lines.some(
      (line) =>
        (line.shortageQty ?? 0) > 0 ||
        (line.damagedQty ?? 0) > 0 ||
        (line.wrongItemQty ?? 0) > 0,
    )
  const needsAcknowledgement =
    reconcilingWithDiscrepancy && !d?.discrepancyAcknowledgedAt
  // Review #73 (73-2): còn phiếu nhận chưa xác nhận thì BE từ chối (MSG29), nên chưa hiện nút.
  // Review 25/11: gửi lại được (thêm ghi chú, ảnh) cho tới khi kho gửi xác nhận (MSG365 sau đó).
  const canAcknowledge =
    reconcilingWithDiscrepancy && !d?.reconciliationConfirmedAt && !pendingReceipt
  // PM 23/11 (B-5): chỉ Owner, khi lệnh đang đối soát, sửa dòng theo "Bên nhận kiểm sai".
  const miscountAllowed = !!scope.owner && d?.status === 'RECONCILING'
  // GVHD 24/11: kho gửi xác nhận yêu cầu đối soát của kho nhận.
  const canConfirmReconciliation =
    source &&
    d?.status === 'RECONCILING' &&
    !!d.discrepancyAcknowledgedAt &&
    !d.reconciliationConfirmedAt
  const reconciliationFiles = (d?.attachments ?? []).filter(
    (file) => file.purpose === 'RECONCILIATION',
  )
  // Review 25/11 (R-03): hàng giao sai còn chặn đóng phiếu, hiện sẵn cạnh nút đóng / xác nhận đối soát.
  const wrongOpen = openWrongItems(d?.lines ?? [])
  // Review 25/11 (R-02, plan C5): kho nhận báo gì, kho gửi xác nhận hay từ chối, ai làm lúc nào.
  const timeline = d ? reconciliationTimeline(d) : []
  // Sau khi kho nhận gửi yêu cầu đối soát, BE chỉ cho Owner đóng phiếu.
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
        label: 'Lập phiếu nhận',
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
        label: d?.discrepancyAcknowledgedAt
          ? 'Gửi lại yêu cầu đối soát'
          : 'Gửi yêu cầu đối soát',
        icon: 'check',
        onClick: () => {
          setAckError('')
          setAcknowledging(true)
        },
        primary: !actions.some((act) => act.primary),
      })
    if (canConfirmReconciliation)
      actions.push({
        key: 'confirm-reconciliation',
        label: 'Xác nhận đối soát',
        icon: 'check',
        disabled: wrongOpen.total > 0,
        onClick: () => {
          setAckError('')
          setConfirmingReconciliation(true)
        },
        primary: wrongOpen.total === 0 && !actions.some((act) => act.primary),
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
  const hasPrimaryAction = actions.some((act) => act.primary)
  const showNoReplacementCol = !!d?.lines.some((l) => (l.noReplacementQty ?? 0) > 0)
  const showLossCol = !!d?.lines.some((l) => (l.lossQty ?? 0) > 0)
  const showUnresolvedCol =
    received && !!d?.lines.some((l) => (l.unresolvedQty ?? 0) > 0)
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
        <p className="tf-alert-error" role="alert">
          {ackError}
        </p>
      )}
      {coordinator && needsAcknowledgement && (
        <p className="tf-info-banner" role="status">
          Kho nhận chưa gửi yêu cầu đối soát sai lệch. Owner đóng phiếu sau khi hai kho đối soát xong.
        </p>
      )}
      {dest && needsAcknowledgement && pendingReceipt && (
        <p className="tf-info-banner" role="status">
          Xác nhận phiếu nhận điều chuyển trước khi gửi yêu cầu đối soát.
        </p>
      )}
      {coordinator && ownerOnlyClose && moving && (
        <p className="tf-info-banner" role="status">
          {d?.reconciliationConfirmedAt
            ? 'Hai kho đã đối soát xong. Chờ Owner đóng phiếu.'
            : 'Kho nhận đã gửi yêu cầu đối soát, đang chờ kho gửi xác nhận.'}
        </p>
      )}
      {d && (
        <>
          <section>
            <CardHead
              title={d.sourceStoreName + ' → ' + d.destStoreName}
              status={states[d.status]}
              statusClass={'tf-status-' + d.status}
            >
              {actions.map((act) => (
                <HeadButton key={act.key} action={act} />
              ))}
              {dest && awaitingArrival && (
                <ReceivingAssignment
                  key="receiving"
                  taskType="TRANSFER_RECEIVING"
                  documentId={d.id}
                  secondary={hasPrimaryAction}
                  onSaved={(name) =>
                    setSuccess('Đã giao việc nhận hàng cho ' + name + '.')
                  }
                />
              )}
              {coordinationInHead && (
                <CoordinationAction
                  inHead
                  secondary={hasPrimaryAction || (dest && awaitingArrival)}
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
            {d.status === 'RECONCILING' &&
              (!!closeAction || canConfirmReconciliation) &&
              wrongOpen.total > 0 && (
                <p className="tf-blocker-banner" role="status">
                  <strong>Còn {wrongOpen.total} hàng giao sai chưa xử lý xong</strong> (
                  {wrongOpen.skus.join(', ')}):{' '}
                  {[
                    wrongOpen.pending > 0 &&
                      wrongOpen.pending + ' chưa lập phiếu nhận hay hoàn trả',
                    wrongOpen.awaiting > 0 &&
                      wrongOpen.awaiting + ' chờ kho gửi xác nhận',
                  ]
                    .filter(Boolean)
                    .join(', ')}
                  . Xử lý xong mới{' '}
                  {canConfirmReconciliation
                    ? 'xác nhận đối soát'
                    : 'đóng phiếu'}{' '}
                  được.
                </p>
              )}
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
                  <span>Kho nhận gửi yêu cầu đối soát</span>
                  <strong>{d.discrepancyAcknowledgedBy?.fullName ?? '—'}</strong>
                  <small>{dateTime(d.discrepancyAcknowledgedAt)}</small>
                  {d.reconciliationNote && <small>{d.reconciliationNote}</small>}
                </div>
              )}
              {d.discrepancyAcknowledgedAt && (
                <div>
                  <span>Kho gửi xác nhận đối soát</span>
                  <strong>
                    {d.reconciliationConfirmedBy?.fullName ?? 'Chưa xác nhận'}
                  </strong>
                  {d.reconciliationConfirmedAt && (
                    <small>{dateTime(d.reconciliationConfirmedAt)}</small>
                  )}
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
            <div className="tf-table tf-detail-lines-table">
              <table>
                <thead>
                  <tr>
                    <th>Phụ tùng</th>
                    <th className="tf-num">KH</th>
                    <th className="tf-num">Soạn</th>
                    <th className="tf-num">Xuất</th>
                    <th className="tf-num">Đạt</th>
                    <th className="tf-num">Hỏng</th>
                    <th className="tf-num">
                      Thiếu{' '}
                      <InfoTip text="Thiếu mặt hàng đặt = đã xuất − đạt − hỏng − mất − không giao bù. Hàng giao sai không tính là thiếu." />
                    </th>
                    <th>
                      Giao sai <InfoTip text={WRONG_ITEM_TIP} />
                    </th>
                    <th className="tf-num">
                      Thừa <InfoTip text={EXCESS_TIP} />
                    </th>
                    {showNoReplacementCol && <th className="tf-num">Không bù</th>}
                    {showLossCol && <th className="tf-num">Mất</th>}
                    {showUnresolvedCol && <th className="tf-num">Chờ quyết</th>}
                  </tr>
                </thead>
                <tbody>
                  {d.lines.map((l) => {
                    const miscount = l.receiverMiscounted
                      ? miscountEvent(d, l.productId)
                      : undefined
                    const wrongSummary = wrongParts(d, l.productId)
                    return (
                      <tr key={l.productId}>
                        <td data-label="Phụ tùng" className="tf-part-cell">
                          <strong>{l.sku}</strong>
                          <small>{l.partName}</small>
                          {l.receiverMiscounted && (
                            <small className="tf-line-flag">
                              Owner sửa: bên nhận kiểm sai
                              {miscount?.reason ? ' · ' + miscount.reason : ''}
                            </small>
                          )}
                        </td>
                        <td data-label="Kế hoạch" className="tf-num">
                          {l.plannedQty}
                        </td>
                        <td data-label="Đã soạn" className="tf-num">
                          {l.preparedQty ?? 'Chưa ghi'}
                        </td>
                        <td data-label="Đã xuất" className="tf-num">
                          {l.dispatchedQty ?? 'Chưa xuất'}
                        </td>
                        <td data-label="Đạt" className="tf-num">
                          {passedOf(l) ?? '—'}
                        </td>
                        <td data-label="Hỏng" className="tf-num">
                          {l.damagedQty ?? '—'}
                        </td>
                        <td data-label="Thiếu" className="tf-num">
                          {received ? (l.shortageQty ?? '—') : '—'}
                          {(l.latePendingQty ?? 0) > 0 && (
                            <small>{l.latePendingQty} nhận sau</small>
                          )}
                        </td>
                        <td data-label="Giao sai" className="tf-wrong-cell">
                          <span className="tf-num-val">
                            {l.wrongItemQty ?? '—'}
                          </span>
                          {wrongSummary && <small>{wrongSummary}</small>}
                          {(l.wrongPendingQty ?? 0) > 0 && (
                            <small className="tf-line-flag">
                              {l.wrongPendingQty} chưa xử lý
                            </small>
                          )}
                        </td>
                        <td data-label="Thừa" className="tf-num">
                          {l.extraReceivedQty || (received ? 0 : '—')}
                        </td>
                        {showNoReplacementCol && (
                          <td data-label="Không giao bù" className="tf-num">
                            {l.noReplacementQty ?? '—'}
                          </td>
                        )}
                        {showLossCol && (
                          <td data-label="Mất" className="tf-num">
                            {l.lossQty ?? '—'}
                          </td>
                        )}
                        {showUnresolvedCol && (
                          <td data-label="Chờ quyết" className="tf-num">
                            {received ? (l.unresolvedQty ?? '—') : '—'}
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
          {/* PM 23/11 (UI-02): Sai lệch + Hàng giao sai đặt trên Các lần nhận hàng. */}
          {d.status === 'RECONCILING' && !coordinator && !dest && (
            <p className="tf-info-banner" role="status">
              Kho nhận và kho gửi đang đối soát sai lệch.
            </p>
          )}
          {d.discrepancies.length > 0 && (
            <section>
              <h2>Sai lệch</h2>
              <InventoryNotice
                loading={returns.loading}
                error={returns.error}
              />
              <div className="tf-table tf-discrepancy-wrap">
                <table className="tf-discrepancy-table">
                  <thead>
                    <tr>
                      <th>Phụ tùng</th>
                      <th className="tf-num">Xuất</th>
                      <th className="tf-num">Đạt</th>
                      <th className="tf-num">Thiếu</th>
                      <th>
                        Giao sai <InfoTip text={WRONG_ITEM_TIP} />
                      </th>
                      <th className="tf-num">
                        Thừa <InfoTip text={EXCESS_TIP} />
                      </th>
                      <th className="tf-num">Chờ quyết</th>
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
                      const wrongSummary = wrongParts(d, c.productId)
                      return (
                        <tr key={c.id}>
                          <td data-label="Phụ tùng" className="tf-part-cell">
                            <strong>{line?.sku ?? '—'}</strong>
                            <small>{line?.partName ?? 'Phụ tùng'}</small>
                          </td>
                          <td data-label="Đã xuất" className="tf-num">
                            {line?.dispatchedQty ?? '—'}
                          </td>
                          <td data-label="Đạt" className="tf-num">
                            {(line && passedOf(line)) ?? '—'}
                          </td>
                          <td data-label="Thiếu" className="tf-num">
                            {line?.shortageQty ?? c.shortQty}
                          </td>
                          <td data-label="Giao sai" className="tf-wrong-cell">
                            <span className="tf-num-val">
                              {line?.wrongItemQty ?? c.wrongItemQty ?? 0}
                            </span>
                            {wrongSummary && <small>{wrongSummary}</small>}
                          </td>
                          <td data-label="Thừa" className="tf-num">
                            {line?.extraReceivedQty ?? '—'}
                          </td>
                          <td data-label="Chờ quyết" className="tf-num">
                            <strong>{line?.unresolvedQty ?? '—'}</strong>
                          </td>
                          <td data-label="Trạng thái">
                            {states[c.status] ?? c.status}
                          </td>
                          <td data-label="Chi tiết" className="tf-events-cell">
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
                            <td data-label="Owner">
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
            canReturn={d.status === 'RECONCILING' && dest}
            canConfirm={d.status === 'RECONCILING' && source}
            onDone={(message) => {
              setSuccess(message)
              setRevision((n) => n + 1)
            }}
          />
          {reconciliationFiles.length > 0 && (
            <section>
              <h2>Ảnh yêu cầu đối soát</h2>
              <DebtEvidence files={reconciliationFiles} />
            </section>
          )}
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
                        Phiếu nhận {documentCode('PN', receipt.id)}
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
            <DebtEvidence
              files={d.attachments.filter(
                (file) => file.purpose !== 'RECONCILIATION',
              )}
            />
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
                  <strong>
                    Hàng đến · Phiếu nhận {documentCode('PN', receipt.id)}
                  </strong>
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
          {timeline.length > 0 && (
            <section>
              <h2>Lịch sử đối soát</h2>
              <ol className="tf-order-history">
                {timeline.map((entry) => (
                  <li key={entry.key}>
                    <strong>{entry.title}</strong>
                    <span>
                      {dateTime(entry.at)}
                      {entry.by ? ' · ' + entry.by : ''}
                    </span>
                    {entry.detail && <small>{entry.detail}</small>}
                  </li>
                ))}
              </ol>
            </section>
          )}
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
        <TransferAction
          title="Gửi yêu cầu đối soát"
          path={'/transfer-orders/' + d.id + '/discrepancy-acknowledgement'}
          payload={async (form) => {
            const fields = new FormData(form)
            const files = fields
              .getAll('reconciliationPhotos')
              .filter(
                (file): file is File => file instanceof File && file.size > 0,
              )
            if (files.length > 10) throw new Error('Chọn tối đa 10 ảnh.')
            const uploaded = []
            for (const file of files) uploaded.push(await uploadAttachment(file))
            return {
              note: String(fields.get('reconciliationNote') ?? '').trim() || null,
              files: uploaded,
            }
          }}
          onClose={() => setAcknowledging(false)}
          onSaved={() => {
            setAcknowledging(false)
            setSuccess(
              'Đã gửi yêu cầu đối soát. ' +
                d.sourceStoreName +
                ' được báo để xác nhận.',
            )
            setRevision((n) => n + 1)
          }}
        >
          <p className="tf-note">
            Gửi {d.sourceStoreName} bảng sai lệch của lệnh{' '}
            {documentCode('DC', d.id)}: thiếu (mặt hàng đặt), hỏng, giao sai
            (mặt hàng khác). Kho gửi xác nhận rồi Owner mới đóng phiếu.
            {unresolvedLines.length
              ? ' Phần thiếu chưa chọn Nhận sau hoặc Không cần giao bù sẽ tính là mất khi Owner đóng phiếu: ' +
                unresolvedLines
                  .map((line) => line.sku + ' x' + line.quantity)
                  .join(', ') +
                '.'
              : ''}
          </p>
          <ul className="tf-note">
            {d.lines
              .filter(
                (line) =>
                  (line.shortageQty ?? 0) > 0 ||
                  (line.damagedQty ?? 0) > 0 ||
                  (line.wrongItemQty ?? 0) > 0,
              )
              .map((line) => (
                <li key={line.productId}>
                  {line.sku}: thiếu {line.shortageQty ?? 0}, hỏng{' '}
                  {line.damagedQty ?? 0}, giao sai {line.wrongItemQty ?? 0}
                  {wrongParts(d, line.productId)
                    ? ' (' + wrongParts(d, line.productId) + ')'
                    : ''}
                </li>
              ))}
          </ul>
          <label>
            Ghi chú
            <input name="reconciliationNote" maxLength={255} />
          </label>
          <div>
            <span>Ảnh (không bắt buộc)</span>
            <LocalizedFileInput
              name="reconciliationPhotos"
              aria-label="Ảnh yêu cầu đối soát"
              accept="image/jpeg,image/png,image/webp"
              multiple
            />
          </div>
        </TransferAction>
      )}
      {confirmingReconciliation && d && (
        <ConfirmDialog
          title="Xác nhận đối soát"
          confirmLabel="Xác nhận đối soát"
          message={
            'Xác nhận ' +
            d.sourceStoreName +
            ' đồng ý bảng sai lệch ' +
            d.destStoreName +
            ' đã gửi cho lệnh ' +
            documentCode('DC', d.id) +
            '. Sau đó Owner đóng được phiếu.' +
            (d.reconciliationNote ? ' Ghi chú kho nhận: ' + d.reconciliationNote : '')
          }
          onCancel={() => setConfirmingReconciliation(false)}
          onConfirm={async () => {
            try {
              await axiosClient.post(
                '/transfer-orders/' + d.id + '/reconciliation-confirmation',
              )
              setSuccess('Đã xác nhận đối soát. Owner đã được báo để đóng phiếu.')
              setRevision((n) => n + 1)
            } catch (failure) {
              setAckError(inventoryError(failure))
            } finally {
              setConfirmingReconciliation(false)
            }
          }}
        />
      )}
    </main>
  )
}
export { TransferWorkPage }
