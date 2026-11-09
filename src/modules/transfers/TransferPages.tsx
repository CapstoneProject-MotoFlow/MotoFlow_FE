import BranchReplenishmentDetail from './BranchReplenishmentDetail'
import { useCoordinationAccess } from './useCoordinationAccess'
import ManagerTransferListPage from './ManagerTransferListPage'
import StaffTransferListPage from './StaffTransferListPage'
import ReplenishmentPurchaseDialog from './ReplenishmentPurchaseDialog'
import ReplenishmentListPage from './ReplenishmentListPage'
import CoordinationAction from './CoordinationAction'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useInventoryData, useInventoryScope } from '../inventory/api'
import { InventoryNotice } from '../inventory/components'
import { dateTime } from '../inventory/presentation'
import { states, type Replenishment } from './types'
import './transfers.css'
export function ReplenishmentDetailPage() {
  const [revision, setRevision] = useState(0),
    [purchase, setPurchase] = useState(false)
  const { id } = useParams(),
    scope = useInventoryScope(),
    r = useInventoryData<Replenishment>(
      '/replenishment-requests/' + id,
      {},
      revision,
      !!id && /^\d+$/.test(id),
    )
  const canCoordinate = useCoordinationAccess(r.data?.lines[0]?.productId)
  if (r.data && scope.user?.role === 'BRANCH_MANAGER' && !canCoordinate)
    return <BranchReplenishmentDetail request={r.data} />
  return (
    <main className="dashboard-content tf-page">
      <header>
        <div>
          <Link to="/replenishment-requests">← Yêu cầu bổ sung</Link>
          <h1>Yêu cầu bổ sung #{id}</h1>
        </div>
        {r.data && canCoordinate && (
          <Link
            className="tf-primary"
            to={'/transfer-orders/new?requestId=' + id}
          >
            Lập phiếu điều chuyển
          </Link>
        )}
      </header>
      <InventoryNotice loading={r.loading} error={r.error} />
      {r.data && purchase && (
        <ReplenishmentPurchaseDialog
          request={r.data}
          onClose={() => {
            setPurchase(false)
            setRevision((n) => n + 1)
          }}
          onSaved={() => {}}
        />
      )}
      {r.data && (
        <>
          <section>
            <h2>
              {r.data.storeName} · {states[r.data.status]}
            </h2>
            <p className="tf-note">
              {r.data.note} · {r.data.createdByName} ·{' '}
              {dateTime(r.data.createdAt)}
            </p>
            <div className="tf-table">
              <table>
                <thead>
                  <tr>
                    <th>Phụ tùng</th>
                    <th>Yêu cầu</th>
                    <th>Đã lập kế hoạch</th>
                    <th>Đã nhận</th>
                    <th>Chuyển mua</th>
                    <th>Còn thiếu</th>
                  </tr>
                </thead>
                <tbody>
                  {r.data.lines.map((l) => (
                    <tr key={l.productId}>
                      <td>
                        {l.sku}
                        <small>{l.partName}</small>
                      </td>
                      <td>{l.requestedQty}</td>
                      <td>{l.plannedQty}</td>
                      <td>{l.fulfilledQty}</td>
                      <td>{l.toPurchaseQty}</td>
                      <td>{l.remainingQty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section>
            <h2>Phiếu liên quan</h2>
            {r.data.lines.some((l) => l.toPurchaseQty > 0) && (
              <div className="tf-note">
                <h3>Phần chuyển mua</h3>
                <p>
                  {r.data.lines.filter((l) => l.toPurchaseQty > 0).length} phụ
                  tùng cần mua bổ sung.
                </p>
                {scope.owner ? (
                  <button
                    className="tf-primary"
                    onClick={() => setPurchase(true)}
                  >
                    Lập phiếu nhập hàng
                  </button>
                ) : (
                  <p>Chờ Owner lập phiếu nhập hàng.</p>
                )}
              </div>
            )}
            {canCoordinate && (
              <CoordinationAction
                replenishment
                id={r.data.id}
                lines={r.data.lines
                  .filter((l) => l.remainingQty > 0)
                  .map((l) => ({
                    productId: l.productId,
                    sku: l.sku,
                    quantity: l.remainingQty,
                  }))}
                onSaved={() => setRevision((n) => n + 1)}
              />
            )}
            {r.data.transferOrders.map((x) => (
              <p className="tf-note" key={x.id}>
                <Link to={'/transfer-orders/' + x.id}>Điều chuyển #{x.id}</Link>{' '}
                · {x.sourceStoreName} · {states[x.status]}
              </p>
            ))}
            {r.data.purchaseOrders.map((x) => (
              <p className="tf-note" key={x.id}>
                <Link to={'/purchase-orders/' + x.id}>Đơn mua #{x.id}</Link> ·{' '}
                {x.supplierName}
              </p>
            ))}
          </section>
        </>
      )}
    </main>
  )
}

export function TransferListPage({
  replenishment = false,
}: {
  replenishment?: boolean
}) {
  const scope = useInventoryScope()
  if (scope.user?.role === 'STAFF') return <StaffTransferListPage />
  return replenishment ? <ReplenishmentListPage /> : <ManagerTransferListPage />
}
