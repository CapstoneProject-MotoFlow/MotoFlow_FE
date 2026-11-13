import PageBackLink from '../../shared/ui/PageBackLink'
import { hasExistingPurchase, unplannedQuantity } from './transferRules'
import { useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import axiosClient from '../../shared/api/axiosClient'
import { useInventoryData, inventoryError } from '../inventory/api'
import { InventoryNotice } from '../inventory/components'
import SearchableFilter from '../../shared/ui/SearchableFilter'
import type { Replenishment } from './types'
import './transfers.css'
import CardHead, { HeadButton } from './CardHead'
import { documentCode } from '../../shared/utils/documentCode'
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
      <PageBackLink to={detailPath} />
      <header>
        <h1>Điều phối {documentCode('YBS', id)}</h1>
        <p className="tf-note">Chọn kho gửi hàng cho yêu cầu bổ sung</p>
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
type Allocation = { storeId: number; qty: number }
/**
 * AllocationEditor: chia phần chưa điều phối của từng phụ tùng cho một hoặc nhiều kho nguồn.
 * Góp ý cô Hoài 12/11: cho tạo nhanh điều phối từ nhiều cửa hàng. Mỗi kho nguồn vẫn sinh một lệnh điều chuyển riêng
 * (BR-57: một lệnh có một kho nguồn và một kho đích); nút "Tự chia từ nhiều kho" lấy lần lượt từ kho có nhiều hàng nhất.
 */
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
        )
  /** Chia tự động: kho có nhiều hàng nhất trước, sang kho tiếp theo nếu chưa đủ. */
  function autoSplit(line: (typeof lines)[number]): Allocation[] {
    let left = line.remainingQty
    const result: Allocation[] = []
    for (const s of options(line)) {
      if (left <= 0) break
      const qty = Math.min(left, s.sellableQty)
      result.push({ storeId: s.storeId, qty })
      left -= qty
    }
    return result.length ? result : [{ storeId: 0, qty: 0 }]
  }
  const [values, setValues] = useState<Record<number, Allocation[]>>(() =>
      Object.fromEntries(
        lines.map((l) => {
          const s = options(l)[0]
          return [
            l.productId,
            [
              {
                storeId: s?.storeId ?? 0,
                qty: s ? Math.min(l.remainingQty, s.sellableQty) : 0,
              },
            ],
          ]
        }),
      ),
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [created, setCreated] = useState<Record<number, number>>({})
  const lock = useRef(false),
    groups = new Map<number, { line: (typeof lines)[number]; qty: number }[]>()
  for (const line of lines) {
    for (const value of values[line.productId]) {
      if (value.storeId && value.qty > 0)
        groups.set(value.storeId, [
          ...(groups.get(value.storeId) ?? []),
          { line, qty: value.qty },
        ])
    }
  }
  const taken = (productId: number) =>
    values[productId].reduce((sum, v) => sum + (v.qty || 0), 0)
  const canHandOff = !hasExistingPurchase(request.purchaseOrders)
  const valid =
      (groups.size > 0 || canHandOff) &&
      lines.every((l) => {
        const allocations = values[l.productId]
        const stores = allocations.map((v) => v.storeId).filter(Boolean)
        return (
          new Set(stores).size === stores.length &&
          taken(l.productId) <= l.remainingQty &&
          allocations.every((v) => {
            const available = options(l).find((s) => s.storeId === v.storeId)
            return (
              Number.isInteger(v.qty) &&
              v.qty >= 0 &&
              (!v.qty || (!!available && v.qty <= available.sellableQty))
            )
          })
        )
      }),
    remaining = lines.reduce(
      (sum, l) => sum + Math.max(0, l.remainingQty - taken(l.productId)),
      0,
    ),
    partial = Object.keys(created).length > 0
  function update(productId: number, index: number, next: Allocation) {
    setValues((old) => ({
      ...old,
      [productId]: old[productId].map((v, i) => (i === index ? next : v)),
    }))
  }
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
            lines: parts.map((part) => ({
              productId: part.line.productId,
              plannedQty: part.qty,
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
  const storeName = (storeId: number) =>
    stock.find((s) => s.storeId === storeId)?.storeName ?? 'Kho #' + storeId
  return (
    <>
      <section>
        <CardHead title={'Cửa hàng nhận · ' + request.storeName}>
          <span className="tf-head-meta">
            {groups.size} lệnh điều chuyển
            {groups.size > 0 &&
              ' (' + [...groups.keys()].map(storeName).join(', ') + ')'}{' '}
            · còn thiếu {remaining} phụ tùng
          </span>
          <HeadButton
            action={{
              key: 'split',
              label: 'Tự chia từ nhiều kho',
              icon: 'layers',
              disabled: busy || partial,
              onClick: () =>
                setValues(
                  Object.fromEntries(
                    lines.map((l) => [l.productId, autoSplit(l)]),
                  ),
                ),
            }}
          />
          <HeadButton
            action={{
              key: 'cancel',
              label: partial ? 'Xem các lệnh đã tạo' : 'Hủy',
              to: '/replenishment-requests/' + request.id,
            }}
          />
          <HeadButton
            action={{
              key: 'submit',
              label: partial
                ? 'Tiếp tục tạo lệnh còn lại'
                : groups.size > 1
                  ? 'Xác nhận, tạo ' + groups.size + ' lệnh'
                  : 'Xác nhận điều phối',
              icon: 'check',
              primary: true,
              form: 'coordinate-form',
              disabled: !valid || busy,
            }}
          />
        </CardHead>
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
                    const allocations = values[l.productId],
                      sources = options(l),
                      left = l.remainingQty - taken(l.productId),
                      unused = sources.filter(
                        (s) =>
                          !allocations.some((v) => v.storeId === s.storeId),
                      )
                    return allocations.map((v, index) => {
                      const available = sources.find(
                        (s) => s.storeId === v.storeId,
                      )
                      return (
                        <tr
                          key={l.productId + ':' + index}
                          className={index ? 'tf-coord-extra' : ''}
                        >
                          {index === 0 && (
                            <>
                              <td rowSpan={allocations.length}>
                                {l.partName}
                                <small>{l.sku}</small>
                              </td>
                              <td rowSpan={allocations.length}>
                                {l.remainingQty}
                              </td>
                            </>
                          )}
                          <td>
                            {sources.length ? (
                              <div className="tf-coord-source">
                                <SearchableFilter
                                  label={
                                    'Kho nguồn ' +
                                    l.sku +
                                    ' dòng ' +
                                    (index + 1)
                                  }
                                  value={String(v.storeId)}
                                  options={[
                                    { value: '0', label: 'Chọn kho nguồn' },
                                    ...sources
                                      .filter(
                                        (s) =>
                                          s.storeId === v.storeId ||
                                          !allocations.some(
                                            (x) => x.storeId === s.storeId,
                                          ),
                                      )
                                      .map((s) => ({
                                        value: String(s.storeId),
                                        label:
                                          s.storeName +
                                          ' · có thể bán ' +
                                          s.sellableQty,
                                      })),
                                  ]}
                                  onChange={(value) => {
                                    const storeId = Number(value),
                                      s = sources.find(
                                        (x) => x.storeId === storeId,
                                      )
                                    const room =
                                      l.remainingQty -
                                      taken(l.productId) +
                                      (v.qty || 0)
                                    update(l.productId, index, {
                                      storeId,
                                      qty: s
                                        ? Math.min(room, s.sellableQty)
                                        : 0,
                                    })
                                  }}
                                />
                                {index > 0 && (
                                  <button
                                    type="button"
                                    className="tf-coord-remove"
                                    aria-label={
                                      'Bỏ kho nguồn dòng ' +
                                      (index + 1) +
                                      ' của ' +
                                      l.sku
                                    }
                                    onClick={() =>
                                      setValues((old) => ({
                                        ...old,
                                        [l.productId]: old[l.productId].filter(
                                          (_, i) => i !== index,
                                        ),
                                      }))
                                    }
                                  >
                                    ×
                                  </button>
                                )}
                              </div>
                            ) : (
                              <small>Chưa có kho còn hàng có thể bán</small>
                            )}
                            {index === allocations.length - 1 &&
                              left > 0 &&
                              unused.length > 0 && (
                                <button
                                  type="button"
                                  className="tf-coord-add"
                                  onClick={() =>
                                    setValues((old) => ({
                                      ...old,
                                      [l.productId]: [
                                        ...old[l.productId],
                                        {
                                          storeId: unused[0].storeId,
                                          qty: Math.min(
                                            left,
                                            unused[0].sellableQty,
                                          ),
                                        },
                                      ],
                                    }))
                                  }
                                >
                                  ＋ Lấy thêm từ {storeName(unused[0].storeId)}
                                </button>
                              )}
                          </td>
                          <td>
                            <input
                              aria-label={
                                'Số lấy ' + l.sku + ' dòng ' + (index + 1)
                              }
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
                                update(l.productId, index, {
                                  ...v,
                                  qty: Number(e.target.value),
                                })
                              }
                            />
                          </td>
                          {index === 0 && (
                            <td
                              rowSpan={allocations.length}
                              className={left !== 0 ? 'tf-shortage' : ''}
                            >
                              {left < 0 ? 'Vượt ' + -left : left}
                            </td>
                          )}
                        </tr>
                      )
                    })
                  })}
                </tbody>
              </table>
            </div>
          </fieldset>
        </form>
      </section>
      <InventoryNotice error={error} />
    </>
  )
}
