import DebtEvidence from '../receivables/DebtEvidence'
import { useCoordinationAccess } from './useCoordinationAccess'
import { dateTime } from '../inventory/presentation'
import CoordinationAction from './CoordinationAction'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useInventoryData, useInventoryScope } from '../inventory/api'
import { InventoryNotice } from '../inventory/components'
import TransferAction from './TransferAction'
import { states, type Transfer } from './types'
import TransferWorkPage from './TransferWorkPage'
import './transfers.css'
import { canConfirmExcess } from './transferRules'
import { useReturnQuantities } from './useReturnQuantities'
import { resolutionNames } from './types'
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
    [action, setAction] = useState('')
  const r = useInventoryData<Transfer>(
      '/transfer-orders/' + id,
      {},
      revision,
      !!id && /^\d+$/.test(id),
    ),
    coordinator = useCoordinationAccess(r.data?.lines[0]?.productId),
    dispatch = useInventoryData<Dispatch>(
      '/transfer-orders/' + id + '/dispatch-preview',
      {},
      revision,
      action === 'dispatch',
    ),
    closing = useInventoryData<Closing>(
      '/transfer-orders/' + id + '/closing-preview',
      {},
      revision,
      coordinator &&
        !!r.data &&
        ['IN_TRANSIT', 'RECONCILING'].includes(r.data.status),
    ),
    d = r.data,
    bm = scope.user?.role === 'BRANCH_MANAGER',
    source = bm && scope.user?.storeId === d?.sourceStoreId,
    dest = bm && scope.user?.storeId === d?.destStoreId,
    returns = useReturnQuantities(d, source && d?.status === 'RECONCILING'),
    pendingReceipt = d?.receipts.find(
      (receipt) =>
        receipt.receiptType === 'TRANSFER_IN' && receipt.status !== 'CONFIRMED',
    )
  return (
    <main className="dashboard-content tf-page tf-detail-page">
      <header>
        <div>
          <Link to="/transfer-orders">← Phiếu điều chuyển</Link>
          <h1>Lệnh điều chuyển DC-{String(id).padStart(4, '0')}</h1>
        </div>
      </header>
      <InventoryNotice loading={r.loading} error={r.error} />
      {d && (
        <>
          <section>
            <h2>
              {d.sourceStoreName} → {d.destStoreName}
            </h2>
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
                {d.replenishmentRequestId ? (
                  <Link
                    to={'/replenishment-requests/' + d.replenishmentRequestId}
                  >
                    YBS-{String(d.replenishmentRequestId).padStart(4, '0')}
                  </Link>
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
            <div className="tf-filters tf-detail-actions">
              <span className="tf-badge">{states[d.status]}</span>
              {d.status === 'AWAITING_DISPATCH' && (
                <>
                  {scope.user?.role === 'STAFF' && (
                    <Link to={'/transfer-orders/' + id + '/prepare'}>
                      Ghi số đã soạn
                    </Link>
                  )}
                  {source && (
                    <Link to={'/transfer-orders/' + id + '/prepare'}>
                      Giao việc soạn hàng
                    </Link>
                  )}
                  {source && (
                    <button onClick={() => setAction('dispatch')}>
                      Xác nhận xuất
                    </button>
                  )}
                </>
              )}
              {dest &&
                ['IN_TRANSIT', 'RECONCILING'].includes(d.status) &&
                (pendingReceipt ? (
                  <Link
                    className="tf-row-action"
                    to={
                      '/transfer-orders/' +
                      id +
                      '/receipts/' +
                      pendingReceipt.id
                    }
                  >
                    Tiếp tục phiếu nhận #{pendingReceipt.id}
                  </Link>
                ) : (
                  <button onClick={() => setAction('arrive')}>
                    Hàng đã đến
                  </button>
                ))}
              {source && canConfirmExcess(d.status, d.lines) && (
                <Link to={'/transfer-orders/' + id + '/extra'}>
                  Xác nhận xuất thừa
                </Link>
              )}
              {!!closing.data &&
                ['IN_TRANSIT', 'RECONCILING'].includes(d.status) && (
                  <button onClick={() => setAction('close')}>
                    Xem trước đóng phiếu
                  </button>
                )}
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
            {d.receipts.map((x) => (
              <p className="tf-note" key={x.id}>
                <Link to={'/transfer-orders/' + id + '/receipts/' + x.id}>
                  Phiếu nhận #{x.id}
                </Link>{' '}
                · {states[x.status] ?? x.status}
              </p>
            ))}
            {!d.receipts.length && (
              <p className="tf-empty">
                {d.status === 'AWAITING_DISPATCH'
                  ? 'Phiếu chưa xuất kho nên chưa có lần nhận hàng.'
                  : 'Chưa ghi nhận hàng đến. BM kho nhận tạo phiếu khi hàng tới.'}
              </p>
            )}
          </section>
          <section>
            <h2>Lô đã xuất</h2>
            <DebtEvidence files={d.attachments} />
            {d.extraDispatchConfirmedAt && (
              <p className="tf-note">
                Xác nhận xuất thừa: {d.extraDispatchConfirmedBy?.fullName} ·{' '}
                {dateTime(d.extraDispatchConfirmedAt)}
              </p>
            )}
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
                      <td>{l.manufacturerLotNo || '#' + l.lotId}</td>
                      <td>
                        {d.lines.find((p) => p.productId === l.productId)?.sku}
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
          </section>
          {!d.lots.length && (
            <p className="tf-empty tf-empty-lots">
              Chưa xuất kho nên chưa phát sinh lô xuất.
            </p>
          )}
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
                  <strong>Hàng đến · Phiếu nhận #{receipt.id}</strong>
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
              {scope.user?.role !== 'STAFF' && (
                <CoordinationAction
                  canDecide={coordinator}
                  canReturn={source && d.status === 'RECONCILING'}
                  returnLines={returns.data ?? []}
                  id={d.id}
                  lines={d.lines
                    .filter((l) => (l.unresolvedQty ?? 0) > 0)
                    .map((l) => ({
                      productId: l.productId,
                      sku: l.sku,
                      quantity: l.unresolvedQty!,
                    }))}
                  onSaved={() => setRevision((n) => n + 1)}
                />
              )}
              {d.discrepancies.map((c) => (
                <div className="tf-note" key={c.id}>
                  #{c.id} ·{' '}
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
                  : action === 'arrive'
                    ? 'Ghi nhận hàng đã đến'
                    : 'Đóng phiếu điều chuyển'
              }
              path={
                '/transfer-orders/' +
                id +
                (action === 'arrive'
                  ? '/receipts'
                  : action === 'dispatch'
                    ? '/dispatch'
                    : '/close')
              }
              disabled={
                action === 'dispatch'
                  ? !dispatch.data?.canConfirm
                  : action === 'close'
                    ? !closing.data?.canClose
                    : false
              }
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
              {action === 'arrive' && (
                <p>Tạo phiếu nhận để giao người kiểm nhận hàng.</p>
              )}
            </TransferAction>
          )}
        </>
      )}
    </main>
  )
}
export { TransferWorkPage }
