import { unplannedQuantity } from './transferRules'
import { useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import axiosClient from '../../shared/api/axiosClient'
import { useInventoryData, inventoryError } from '../inventory/api'
import { InventoryNotice } from '../inventory/components'
import { dateTime } from '../inventory/presentation'
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
    ),
    stock = useInventoryData<Stock[]>(
      '/inventory/availability',
      { productIds: r.data?.lines.map((l) => l.productId).join(',') },
      0,
      !!r.data?.lines.length,
    )
  return (
    <main className="dashboard-content tf-page tf-coordinate">
      <header>
        <h1>Điều phối YBS-{String(id).padStart(4, '0')}</h1>
        <nav>
          <Link to="/replenishment-requests">Yêu cầu bổ sung</Link> › Điều phối
        </nav>
      </header>
      <InventoryNotice
        loading={r.loading || stock.loading}
        error={r.error || stock.error}
      />
      {r.data && stock.data && (
        <AllocationEditor request={r.data} stock={stock.data} />
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
    options = (productId: number) =>
      stock
        .filter(
          (s) =>
            s.productId === productId &&
            s.storeId !== request.requestingStoreId &&
            s.sellableQty > 0,
        )
        .sort((a, b) => Number(b.central) - Number(a.central)),
    [values, setValues] = useState<
      Record<number, { storeId: number; qty: number }>
    >(() =>
      Object.fromEntries(
        lines.map((l) => {
          const s = options(l.productId)[0]
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
  const valid =
      groups.size > 0 &&
      lines.every((l) => {
        const v = values[l.productId],
          available = options(l.productId).find((s) => s.storeId === v.storeId)
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
      navigate('/replenishment-requests/' + request.id)
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
      <section className="tf-coord-meta">
        <div>
          <span>Yêu cầu</span>
          <Link to={'/replenishment-requests/' + request.id}>
            YBS-{String(request.id).padStart(4, '0')}
          </Link>
        </div>
        <div>
          <span>Cửa hàng cần hàng</span>
          <strong>{request.storeName}</strong>
        </div>
        <div>
          <span>Người tạo</span>
          <strong>{request.createdByName}</strong>
          <small>{dateTime(request.createdAt)}</small>
        </div>
        <div className="tf-full">
          <span>Ghi chú</span>
          <p>{request.note || 'Không có ghi chú'}</p>
        </div>
      </section>
      <section>
        <h2>Lấy hàng từ các kho</h2>
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
                    <th>Còn cần</th>
                    <th>Lấy từ kho</th>
                    <th>Số lấy</th>
                    <th>Còn thiếu</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => {
                    const v = values[l.productId],
                      available = options(l.productId).find(
                        (s) => s.storeId === v.storeId,
                      )
                    return (
                      <tr key={l.productId}>
                        <td>
                          {l.partName}
                          <small>{l.sku}</small>
                        </td>
                        <td>{l.remainingQty}</td>
                        <td>
                          <select
                            aria-label={'Kho nguồn ' + l.sku}
                            value={v.storeId}
                            onChange={(e) => {
                              const storeId = Number(e.target.value),
                                s = options(l.productId).find(
                                  (x) => x.storeId === storeId,
                                )
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
                          >
                            <option value={0}>Chọn kho nguồn</option>
                            {options(l.productId).map((s) => (
                              <option key={s.storeId} value={s.storeId}>
                                {s.storeName} · bán được {s.sellableQty}
                              </option>
                            ))}
                          </select>
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
        {!lines.length && (
          <p className="tf-empty">Yêu cầu không còn phần thiếu để điều phối.</p>
        )}
      </section>
      <section>
        <h2>Sẽ tạo</h2>
        {[...groups].map(([storeId, parts]) => (
          <p className="tf-note" key={storeId}>
            {created[storeId] ? (
              <Link to={'/transfer-orders/' + created[storeId]}>
                Đã tạo DC-{String(created[storeId]).padStart(4, '0')}
              </Link>
            ) : (
              'Lệnh điều chuyển'
            )}{' '}
            · {stock.find((s) => s.storeId === storeId)?.storeName} →{' '}
            {request.storeName} · {parts.length} phụ tùng ·{' '}
            {parts.reduce((n, l) => n + values[l.productId].qty, 0)} sản phẩm
          </p>
        ))}
        {remaining > 0 && (
          <p className="tf-note tf-shortage">
            Còn thiếu {remaining} sản phẩm. Sau khi tạo lệnh, có thể chuyển phần
            thiếu sang mua từ chi tiết yêu cầu; bước chuyển mua không tự thực
            hiện.
          </p>
        )}
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
          {partial ? 'Tiếp tục tạo lệnh còn lại' : '✓ Tạo lệnh điều chuyển'}
        </button>
      </footer>
    </>
  )
}
