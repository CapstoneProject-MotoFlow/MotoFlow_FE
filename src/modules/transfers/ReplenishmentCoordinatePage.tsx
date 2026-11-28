import PageBackLink from '../../shared/ui/PageBackLink'
import { unplannedQuantity } from './transferRules'
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
type Allocation = { storeId: number; qty: string }
/** AllocationEditor: để người điều phối tự chọn kho nguồn và nhập số lượng cho từng kho. */
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
  const [values, setValues] = useState<Record<number, Allocation[]>>(() =>
      Object.fromEntries(
        lines.map((l) => [l.productId, [{ storeId: 0, qty: '' }]]),
      ),
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [created, setCreated] = useState<Record<number, number>>({})
  const lock = useRef(false),
    groups = new Map<number, { line: (typeof lines)[number]; qty: number }[]>()
  for (const line of lines) {
    for (const value of values[line.productId]) {
      const qty = value.qty === '' ? 0 : Number(value.qty)
      if (value.storeId && qty > 0)
        groups.set(value.storeId, [
          ...(groups.get(value.storeId) ?? []),
          { line, qty },
        ])
    }
  }
  const taken = (productId: number) =>
    values[productId].reduce(
      (sum, v) => sum + (v.qty === '' ? 0 : Number(v.qty)),
      0,
    )
  const canHandOff = lines.some((l) => unplannedQuantity(l) > 0)
  const remaining = lines.reduce(
      (sum, l) => sum + Math.max(0, l.remainingQty - taken(l.productId)),
      0,
    ),
    partial = Object.keys(created).length > 0
  function update(productId: number, index: number, next: Allocation) {
    setError('')
    setValues((old) => ({
      ...old,
      [productId]: old[productId].map((v, i) => (i === index ? next : v)),
    }))
  }
  async function save() {
    if (lock.current) return
    for (const line of lines) {
      const allocations = values[line.productId]
      const seenStores = new Set<number>()
      for (let index = 0; index < allocations.length; index += 1) {
        const allocation = allocations[index]
        const row = index + 1
        if (!allocation.storeId) {
          setError(`Dòng ${line.sku}: vui lòng chọn kho nguồn cho dòng ${row}.`)
          return
        }
        if (allocation.qty === '') {
          setError(`Dòng ${line.sku}: vui lòng nhập số lượng lấy cho dòng ${row}.`)
          return
        }
        const qty = Number(allocation.qty)
        const source = options(line).find((item) => item.storeId === allocation.storeId)
        if (!Number.isInteger(qty) || qty < 1) {
          setError(`Dòng ${line.sku}: số lượng lấy phải là số nguyên lớn hơn 0.`)
          return
        }
        if (qty > line.remainingQty) {
          setError(`Dòng ${line.sku}: số lượng lấy không được vượt phần còn thiếu (${line.remainingQty}).`)
          return
        }
        if (!source || qty > source.sellableQty) {
          setError(`Dòng ${line.sku}: số lượng lấy vượt tồn có thể bán tại kho nguồn.`)
          return
        }
        if (seenStores.has(allocation.storeId)) {
          setError(`Dòng ${line.sku}: mỗi kho nguồn chỉ được chọn một lần.`)
          return
        }
        seenStores.add(allocation.storeId)
      }
      if (taken(line.productId) > line.remainingQty) {
        setError(`Dòng ${line.sku}: tổng số lượng lấy vượt phần còn thiếu (${line.remainingQty}).`)
        return
      }
    }
    if (groups.size === 0) {
      setError(
        'Chưa có phụ tùng nào được điều phối. Hãy chọn kho nguồn và nhập số lượng lấy.',
      )
      return
    }
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
              disabled: busy,
            }}
          />
        </CardHead>
        {request.note && <p className="tf-note">{request.note}</p>}
        <form
          id="coordinate-form"
          noValidate
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
                      canAddSource = allocations.length < sources.length
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
                                          ' · Tồn kho ' +
                                          s.sellableQty,
                                      })),
                                  ]}
                                  onChange={(value) => {
                                    const storeId = Number(value)
                                    update(l.productId, index, {
                                      ...v,
                                      storeId,
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
                                    <svg
                                      aria-hidden="true"
                                      viewBox="0 0 16 16"
                                      focusable="false"
                                    >
                                      <path d="m4 4 8 8m0-8-8 8" />
                                    </svg>
                                  </button>
                                )}
                              </div>
                            ) : (
                              <small>Chưa có kho nguồn còn tồn kho</small>
                            )}
                            {index === allocations.length - 1 &&
                              canAddSource && (
                                <button
                                  type="button"
                                  className="tf-coord-add"
                                  onClick={() =>
                                    setValues((old) => ({
                                      ...old,
                                      [l.productId]: [
                                        ...old[l.productId],
                                        {
                                          storeId: 0,
                                          qty: '',
                                        },
                                      ],
                                    }))
                                  }
                                >
                                  ＋ Thêm kho nguồn
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
                                  qty: e.target.value,
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
