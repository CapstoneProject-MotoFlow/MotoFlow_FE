import PageBackLink from '../../shared/ui/PageBackLink'
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
  }[]
}
export default function TransferDetailPage() {
  const { id } = useParams(),
    scope = useInventoryScope(),
    [revision, setRevision] = useState(0),
    [action, setAction] = useState(''),
    [success, setSuccess] = useState(''),
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
      // Staff không thấy số chưa xử lý (null): để BE quyết định còn nhận được không.
      !!d?.lines.some(
        (line) => line.unresolvedQty == null || line.unresolvedQty > 0,
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
    (coordinator || source)
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
    if (source && canConfirmExcess(d.status, d.lines))
      actions.push({
        key: 'extra',
        label: 'Xác nhận hàng gửi dư',
        icon: 'layers',
        to: base + '/extra',
      })
    if (closing.data && moving)
      closeAction = {
        key: 'close',
        label: 'Xem trước đóng phiếu',
        icon: 'lock',
        onClick: () => setAction('close'),
        primary:
          !actions.some((act) => act.primary) &&
          !(
            coordinationInHead &&
            ((coordinator && unresolvedLines.length > 0) ||
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
                  canDecide={coordinator}
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
                    <th>Đã nhận</th>
                    <th>Đã trả</th>
                    <th>Mất</th>
                    <th>Chưa xử lý</th>
                  </tr>
                </thead>
                <tbody>
                  {d.lines.map((l) => (
                    <tr key={l.productId}>
                      <td>
                        {l.sku}
                        <small>{l.partName}</small>
                      </td>
                      <td>{l.plannedQty}</td>
                      <td>{l.preparedQty ?? 'Chưa ghi'}</td>
                      <td>{l.dispatchedQty ?? 'Chưa xuất'}</td>
                      <td>{l.receivedQty ?? '—'}</td>
                      <td>{l.returnedQty ?? '—'}</td>
                      <td>{l.lossQty ?? '—'}</td>
                      <td>{l.unresolvedQty ?? '—'}</td>
                    </tr>
                  ))}
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
                  : 'Chưa có phiếu nhận. Nhân viên được quản lý cửa hàng nhận giao việc nhận hàng sẽ lập phiếu khi hàng tới.'}
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
          {d.discrepancies.length > 0 && (
            <section>
              <h2>Sai lệch</h2>
              <InventoryNotice
                loading={returns.loading}
                error={returns.error}
              />
              {d.discrepancies.map((c) => (
                <div className="tf-note" key={c.id}>
                  {d.lines.find((l) => l.productId === c.productId)?.sku} ·
                  Thiếu {c.shortQty} · {states[c.status] ?? c.status}
                  {c.events.map((e) => (
                    <p key={e.id}>
                      {resolutionNames[e.resolutionType] ?? e.resolutionType} ·{' '}
                      {e.quantity} · {e.reason}
                    </p>
                  ))}
                </div>
              ))}
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
              payload={() =>
                action === 'dispatch'
                  ? {
                      lines: dispatch.data!.lines.map((l) => ({
                        productId: l.productId,
                        dispatchedQty: l.preparedQty,
                      })),
                    }
                  : undefined
              }
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
              {action === 'dispatch' && dispatchStockShort && (
                <p role="alert" className="stock-error">
                  Số có thể bán của kho nguồn thấp hơn số đã soạn. Hãy kiểm tra
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
                        .map(
                          (code) =>
                            (
                              ({
                                MSG221: 'Còn số lượng chưa có kết quả cuối',
                                MSG222: 'Chưa xác nhận hàng thừa',
                                MSG223: 'Kho nguồn không đủ tồn cho phần thừa',
                                MSG225: 'Còn phiếu nhận hoặc trả chưa xác nhận',
                              }) as Record<string, string>
                            )[code] ?? code,
                        )
                        .join('; ')}
                </p>
              )}
              {action === 'close' && closing.data && (
                <div className="tf-table">
                  <table>
                    <thead>
                      <tr>
                        {[
                          'Phụ tùng',
                          'Đã xuất',
                          'Đã nhận',
                          'Đã trả',
                          'Mất',
                          'Chưa xử lý',
                          'Thừa nhận',
                          'Thừa xuất',
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
                            l.returnedQty,
                            l.lossQty,
                            l.unresolvedQty,
                            l.extraReceivedQty,
                            l.extraDispatchedQty,
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
    </main>
  )
}
export { TransferWorkPage }
