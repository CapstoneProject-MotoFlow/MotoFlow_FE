import PageBackLink from '../../shared/ui/PageBackLink'
import { canCoordinateTransfers } from '../../shared/utils/roles'
import ReplenishmentPurchaseDialog from './ReplenishmentPurchaseDialog'
import TransferAction from './TransferAction'
import CardHead, { HeadButton } from './CardHead'
import { useState, type ReactNode } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import Hint from '../../shared/ui/Hint'
import { useInventoryData, useInventoryScope } from '../inventory/api'
import { InventoryNotice } from '../inventory/components'
import { dateTime } from '../inventory/presentation'
import { states, type Replenishment } from './types'
import './transfers.css'
import {
  purchaseQuantityLimit,
  hasExistingPurchase,
  unplannedQuantity,
} from './transferRules'

import { documentCode } from '../../shared/utils/documentCode'
import { purchaseOrderStatusLabels } from '../../shared/labels/status'
export function ReplenishmentDetailPage() {
  const [revision, setRevision] = useState(0)
  const [purchase, setPurchase] = useState(false)
  const { id } = useParams()
  const scope = useInventoryScope()
  // Góp ý cô Hoài: tạo yêu cầu xong phải thấy ngay cửa hàng nào và các phụ tùng đã yêu cầu.
  const created = (useLocation().state as { created?: string } | null)?.created
  const { data, loading, error } = useInventoryData<Replenishment>(
    '/replenishment-requests/' + id,
    {},
    revision,
    !!id && /^\d+$/.test(id),
  )
  const canCoordinate = canCoordinateTransfers(scope.user)
  const open = data?.status !== 'CLOSED'
  const hasUnplanned = data?.lines.some((line) => unplannedQuantity(line) > 0)
  const hasPurchaseLines = data?.lines.some((line) => line.toPurchaseQty > 0)
  const existingPurchase = hasExistingPurchase(data?.purchaseOrders ?? [])
  const canHandOff =
    open &&
    canCoordinate &&
    !scope.owner &&
    !existingPurchase &&
    (hasUnplanned || hasPurchaseLines)
  const handoff = scope.params.get('action') === 'purchase'
  const canPurchase =
    open &&
    scope.owner &&
    !existingPurchase &&
    (hasPurchaseLines || hasUnplanned)

  function finishHandoff() {
    scope.filter({ action: undefined }, true)
  }

  return (
    <main className="dashboard-content tf-page tf-replenishment-detail">
      <PageBackLink to="/replenishment-requests" />
      <header>
        <h1>Yêu cầu bổ sung {documentCode('YBS', id)}</h1>
      </header>
      {created && (
        <Hint>{created} Danh sách phụ tùng đã yêu cầu ở bảng bên dưới.</Hint>
      )}
      <InventoryNotice loading={loading} error={error} />
      {data && (
        <>
          <ReplenishmentProgress request={data}>
            {open && canCoordinate && hasUnplanned && (
              <HeadButton
                action={{
                  key: 'coordinate',
                  label: 'Điều phối',
                  icon: 'transfer',
                  primary: true,
                  to: '/replenishment-requests/' + id + '/coordinate',
                }}
              />
            )}
            {canHandOff && (
              <HeadButton
                action={{
                  key: 'handoff',
                  label: hasUnplanned
                    ? 'Báo chủ cửa hàng phần còn thiếu'
                    : 'Sửa số lượng đề nghị mua',
                  icon: 'alert',
                  primary: !hasUnplanned,
                  onClick: () => scope.filter({ action: 'purchase' }, true),
                }}
              />
            )}
            {canPurchase && (
              <HeadButton
                action={{
                  key: 'purchase',
                  label: 'Lập yêu cầu nhập hàng',
                  icon: 'receipt',
                  primary: !(open && canCoordinate && hasUnplanned),
                  onClick: () => setPurchase(true),
                }}
              />
            )}
          </ReplenishmentProgress>
          {handoff && canHandOff && (
            <PurchaseHandoff
              request={data}
              onClose={finishHandoff}
              onSaved={() => {
                finishHandoff()
                setRevision((n) => n + 1)
              }}
            />
          )}
          {canPurchase && (purchase || handoff) && (
            <ReplenishmentPurchaseDialog
              request={data}
              onClose={() => {
                setPurchase(false)
                if (handoff) finishHandoff()
                setRevision((n) => n + 1)
              }}
            />
          )}
          <RelatedDocuments
            request={data}
            canViewPurchases={
              scope.owner || scope.user?.storeId === data.requestingStoreId
            }
          />
        </>
      )}
    </main>
  )
}

function ReplenishmentProgress({
  request,
  children,
}: {
  request: Replenishment
  children?: ReactNode
}) {
  return (
    <section>
      <CardHead
        title={request.storeName}
        statusClass={'tf-status-' + request.status}
        status={
          request.status === 'IN_PROGRESS'
            ? 'Đang thực hiện'
            : states[request.status]
        }
      >
        {children}
      </CardHead>
      {request.note && <p className="tf-note">{request.note}</p>}
      <div className="tf-table">
        <table>
          <thead>
            <tr>
              <th>Phụ tùng</th>
              <th>Yêu cầu</th>
              <th>Đã nhận từ kho</th>
              <th>Tiến độ phần còn lại</th>
            </tr>
          </thead>
          <tbody>
            {request.lines.map((line) => {
              const awaitingReceipt = Math.max(
                0,
                line.plannedQty - line.fulfilledQty,
              )
              const unplanned = unplannedQuantity(line)
              const progress = [
                awaitingReceipt > 0 && `${awaitingReceipt} chờ nhận`,
                unplanned > 0 && `${unplanned} chưa điều phối`,
                line.toPurchaseQty > 0 && `${line.toPurchaseQty} chuyển mua`,
              ].filter(Boolean)
              return (
                <tr key={line.productId}>
                  <td>
                    {line.partName}
                    <small>{line.sku}</small>
                  </td>
                  <td>{line.requestedQty}</td>
                  <td>{line.fulfilledQty}</td>
                  <td>{progress.length ? progress.join(' · ') : '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function PurchaseHandoff({
  request,
  onClose,
  onSaved,
}: {
  request: Replenishment
  onClose: () => void
  onSaved: () => void
}) {
  const lines = request.lines.filter(
    (line) => unplannedQuantity(line) > 0 || line.toPurchaseQty > 0,
  )
  const [quantities, setQuantities] = useState(() =>
    Object.fromEntries(
      lines.map((line) => [
        line.productId,
        line.toPurchaseQty || purchaseQuantityLimit(line),
      ]),
    ),
  )
  const isValid = lines.every((line) => {
    const qty = quantities[line.productId]
    return (
      Number.isInteger(qty) && qty >= 0 && qty <= purchaseQuantityLimit(line)
    )
  })
  const changed = lines.filter(
    (line) => quantities[line.productId] !== line.toPurchaseQty,
  )
  return (
    <TransferAction
      title="Báo chủ cửa hàng phần còn thiếu"
      path={`/replenishment-requests/${request.id}/to-purchase`}
      method="put"
      disabled={!isValid || !changed.length}
      payload={() => ({
        lines: changed.map((line) => ({
          productId: line.productId,
          toPurchaseQty: quantities[line.productId],
        })),
      })}
      onClose={onClose}
      onSaved={onSaved}
    >
      {lines.map((line) => (
        <label key={line.productId}>
          {line.partName} · {line.sku}
          <input
            type="number"
            required
            min={0}
            max={purchaseQuantityLimit(line)}
            value={quantities[line.productId]}
            onChange={(e) =>
              setQuantities({
                ...quantities,
                [line.productId]: Number(e.target.value),
              })
            }
          />
        </label>
      ))}
    </TransferAction>
  )
}

const purchaseStatuses = purchaseOrderStatusLabels

function RelatedDocuments({
  request,
  canViewPurchases,
}: {
  request: Replenishment
  canViewPurchases: boolean
}) {
  return (
    <section className="tf-replenishment-documents">
      <details>
        <summary>Chứng từ và lịch sử</summary>
        <p className="tf-note">
          Tạo yêu cầu · {dateTime(request.createdAt)} · {request.createdByName}
        </p>
        {request.transferOrders.map((order) => (
          <p className="tf-note" key={order.id}>
            <Link to={'/transfer-orders/' + order.id}>
              {documentCode('DC', order.id)}
            </Link>
            {' · '}
            {order.sourceStoreName} · {states[order.status] ?? order.status}
          </p>
        ))}
        {request.purchaseOrders.map((order) => (
          <p className="tf-note" key={order.id}>
            {canViewPurchases ? (
              <Link to={'/purchase-orders/' + order.id}>
                Yêu cầu nhập hàng {documentCode('YCN', order.id)}
              </Link>
            ) : (
              <span>Yêu cầu nhập hàng {documentCode('YCN', order.id)}</span>
            )}
            {' · '}
            {order.supplierName} ·{' '}
            {purchaseStatuses[order.status] ?? order.status}
          </p>
        ))}
      </details>
    </section>
  )
}
