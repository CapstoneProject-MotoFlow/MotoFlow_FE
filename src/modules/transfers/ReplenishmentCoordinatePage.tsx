import { hasExistingPurchase, unplannedQuantity } from './transferRules'
import { useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import axiosClient from '../../shared/api/axiosClient'
import { useInventoryData, inventoryError } from '../inventory/api'
import { InventoryNotice } from '../inventory/components'
import SearchableFilter from '../../shared/ui/SearchableFilter'
import type { Replenishment } from './types'
import './transfers.css'
type Stock = {
  productId: number
  storeId: number
  storeName: string
  central: boolean
  sellableQty: number
}
export default function ReplenishmentCoordinatePage() {
  const { id } = useParams(),
    r = useInventoryData<Replenishment>(
      '/replenishment-requests/' + id,
      {},
      0,
      !!id && /^\d+$/.test(id),
    )
  const detailPath = '/replenishment-requests/' + id
  const productIds =
    r.data?.status !== 'CLOSED'
      ? r.data?.lines
          .filter((l) => unplannedQuantity(l) > 0)
          .map((l) => l.productId)
          .join(',')
      : undefined
  const stock = useInventoryData<Stock[]>(
    '/inventory/availability',
    { productIds },
    0,
    !!productIds,
  )
  return (
    <main className="dashboard-content tf-page tf-coordinate">
      <header>
        <h1>Điều phối YBS-{String(id).padStart(4, '0')}</h1>
        <nav>
          <Link to={detailPath}>Quay lại yêu cầu</Link>
        </nav>
      </header>
      <InventoryNotice
        loading={r.loading || stock.loading}
        error={r.error || stock.error}
      />
      {r.data && productIds && stock.data && (
        <AllocationEditor key={r.data.id} request={r.data} stock={stock.data} />
      )}
      {r.data && !productIds && (
        <section>
          <p className="tf-empty">Yêu cầu không còn phần cần điều phối.</p>
        </section>
      )}
    </main>
  )
}
function AllocationEditor({
  request,
  stock,
}: {
  request: Replenishment
  stock: Stock[]
}) {
  const navigate = useNavigate(),
    lines = request.lines
      .filter((l) => unplannedQuantity(l) > 0)
      .map((l) => ({ ...l, remainingQty: unplannedQuantity(l) })),
    options = (line: (typeof lines)[number]) =>
      stock
        .filter(
          (s) =>
            s.productId === line.productId &&
            s.storeId !== request.requestingStoreId &&
            s.sellableQty > 0,
        )
        .sort(
          (a, b) =>
            Math.min(line.remainingQty, b.sellableQty) -
              Math.min(line.remainingQty, a.sellableQty) ||
            Number(b.central) - Number(a.central),
        ),
    [values, setValues] = useState<
      Record<number, { storeId: number; qty: number }>
    >(() =>
      Object.fromEntries(
        lines.map((l) => {
          const s = options(l)[0]
          return [
            l.productId,
            {
              storeId: s?.storeId ?? 0,
              qty: s ? Math.min(l.remainingQty, s.sellableQty) : 0,
            },
          ]
        }),
      ),
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [created, setCreated] = useState<Record<number, number>>({})
  const lock = useRef(false),
    groups = new Map<number, typeof lines>()
  for (const line of lines) {
    const value = values[line.productId]
    if (value.storeId && value.qty > 0)
      groups.set(value.storeId, [...(groups.get(value.storeId) ?? []), line])
  }
  const canHandOff = !hasExistingPurchase(request.purchaseOrders)
  const valid =
      (groups.size > 0 || canHandOff) &&
      lines.every((l) => {
        const v = values[l.productId],
          available = options(l).find((s) => s.storeId === v.storeId)
        return (
          Number.isInteger(v.qty) &&
          v.qty >= 0 &&
          v.qty <= l.remainingQty &&
          (!v.qty || (!!available && v.qty <= available.sellableQty))
        )
      }),
    remaining = lines.reduce(
      (sum, l) => sum + l.remainingQty - values[l.productId].qty,
      0,
    ),
    partial = Object.keys(created).length > 0
  async function save() {
    if (lock.current || !valid) return
    lock.current = true
    setBusy(true)
    setError('')
    const saved = { ...created }
    try {
      for (const [storeId, parts] of groups) {
        if (saved[storeId]) continue
        const result = await axiosClient.post<{ id: number }>(
          '/transfer-orders',
          {
            sourceStoreId: storeId,
            destStoreId: request.requestingStoreId,
            replenishmentRequestId: request.id,
            lines: parts.map((l) => ({
              productId: l.productId,
              plannedQty: values[l.productId].qty,
            })),
          },
        )
        saved[storeId] = result.data.id
        setCreated({ ...saved })
      }
      navigate(
        '/replenishment-requests/' +
          request.id +
          (remaining > 0 && canHandOff ? '?action=purchase' : ''),
        { replace: true },
      )
    } catch (e) {
      setError(
        inventoryError(e) +
          (Object.keys(saved).length
            ? ' Một số lệnh đã tạo thành công; bấm tiếp tục chỉ tạo các lệnh còn lại.'
            : ''),
      )
    } finally {
      setBusy(false)
      lock.current = false
    }
  }
  return (
    <>
      <section>
        <h2>Cửa hàng nhận · {request.storeName}</h2>
        {request.note && <p className="tf-note">{request.note}</p>}
        <form
          id="coordinate-form"
          onSubmit={(e) => {
            e.preventDefault()
            void save()
          }}
        >
          <fieldset disabled={busy || partial}>
            <div className="tf-table">
              <table>
                <thead>
                  <tr>
                    <th>Phụ tùng</th>
                    <th>Chưa điều phối</th>
                    <th>Kho nguồn</th>
                    <th>Số lượng lấy</th>
                    <th>Còn thiếu</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => {
                    const v = values[l.productId],
                      sources = options(l),
                      available = sources.find((s) => s.storeId === v.storeId)
                    return (
                      <tr key={l.productId}>
                        <td>
                          {l.partName}
                          <small>{l.sku}</small>
                        </td>
                        <td>{l.remainingQty}</td>
                        <td>
                          {sources.length ? (
                            <SearchableFilter
                              label={'Kho nguồn ' + l.sku}
                              value={String(v.storeId)}
                              options={[
                                { value: '0', label: 'Chọn kho nguồn' },
                                ...sources.map((s) => ({
                                  value: String(s.storeId),
                                  label:
                                    s.storeName +
                                    ' · khả dụng ' +
                                    s.sellableQty,
                                })),
                              ]}
                              onChange={(value) => {
                                const storeId = Number(value),
                                  s = sources.find((x) => x.storeId === storeId)
                                setValues({
                                  ...values,
                                  [l.productId]: {
                                    storeId,
                                    qty: s
                                      ? Math.min(l.remainingQty, s.sellableQty)
                                      : 0,
                                  },
                                })
                              }}
                            />
                          ) : (
                            <small>Chưa có kho khả dụng</small>
                          )}
                        </td>
                        <td>
                          <input
                            aria-label={'Số lấy ' + l.sku}
                            disabled={!v.storeId}
                            required
                            type="number"
                            min={0}
                            max={Math.min(
                              l.remainingQty,
                              available?.sellableQty ?? 0,
                            )}
                            value={v.qty}
                            onChange={(e) =>
                              setValues({
                                ...values,
                                [l.productId]: {
                                  ...v,
                                  qty: Number(e.target.value),
                                },
                              })
                            }
                          />
                        </td>
                        <td
                          className={
                            l.remainingQty - v.qty > 0 ? 'tf-shortage' : ''
                          }
                        >
                          {l.remainingQty - v.qty}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </fieldset>
        </form>
      </section>
      <InventoryNotice error={error} />
      <footer className="tf-coord-footer">
        <span>
          {groups.size} lệnh điều chuyển · còn thiếu {remaining} sản phẩm
        </span>
        <Link to={'/replenishment-requests/' + request.id}>
          {partial ? 'Xem các lệnh đã tạo' : 'Hủy'}
        </Link>
        <button
          className="tf-primary"
          form="coordinate-form"
          disabled={!valid || busy}
        >
          {partial ? 'Tiếp tục tạo lệnh còn lại' : 'Xác nhận điều phối'}
        </button>
      </footer>
    </>
  )
}
