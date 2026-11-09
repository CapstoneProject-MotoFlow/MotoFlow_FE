import BarcodeScan from '../operations/BarcodeScan'
import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import axiosClient from '../../shared/api/axiosClient'
import {
  useInventoryScope,
  useInventoryData,
  inventoryError,
} from '../inventory/api'
import { InventoryNotice } from '../inventory/components'
import type { DashboardStore } from '../../shared/types/store'
import { transferQuantitiesValid } from './transferRules'
import { useCompleteStock } from '../inventory/useCompleteStock'
import { useChoicePages } from '../sales/useSalesList'
import './transfers.css'
type Row = {
  key: number
  productId: number
  sku: string
  partName: string
  qty: number
}
export default function ReplenishmentCreatePage() {
  const scope = useInventoryScope(),
    navigate = useNavigate(),
    [store, setStore] = useState(''),
    [note, setNote] = useState(''),
    [rows, setRows] = useState<Row[]>([
      { key: 1, productId: 0, sku: '', partName: '', qty: 1 },
    ]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  const lock = useRef(false),
    counter = useRef(1),
    destination = scope.owner ? store : String(scope.user?.storeId ?? ''),
    stores = useInventoryData<DashboardStore[]>('/stores', {}, 0, scope.owner),
    central = stores.data?.find((s) => s.central),
    valid =
      !!destination &&
      transferQuantitiesValid(
        rows.map((r) => ({ productId: r.productId, quantity: r.qty })),
      ),
    suggestions = useInventoryData<
      {
        productId: number
        sku: string
        partName: string
        suggestedQty: number
      }[]
    >(
      '/replenishment-requests/low-stock-suggestions',
      { storeId: destination },
      0,
      !!destination,
    )
  const productIds = [
    ...new Set(rows.filter((r) => r.productId > 0).map((r) => r.productId)),
  ].join(',')
  const availability = useInventoryData<
    { storeId: number; productId: number; sellableQty: number }[]
  >('/inventory/availability', { productIds }, 0, scope.owner && !!productIds)
  const ownStock = useCompleteStock(
    {},
    0,
    !scope.owner && !!productIds && !!destination,
    String(scope.user?.id ?? ''),
  )
  function stockText(storeId: string, productId: number) {
    if (!storeId) return 'Chọn cửa hàng'
    if (!productId) return 'Chọn phụ tùng'
    const data = scope.owner ? availability : ownStock
    if (data.loading) return 'Đang tải…'
    if (data.error) return <span title={data.error}>Không tải được</span>
    if (!data.data) return '—'
    if (scope.owner)
      return (
        availability.data?.find(
          (s) => s.storeId === Number(storeId) && s.productId === productId,
        )?.sellableQty ?? 0
      )
    const row = ownStock.data?.find((s) => s.productId === productId)
    return row ? Math.max(0, row.availableQty - row.expiredQty) : 0
  }
  async function save() {
    if (lock.current || !valid) return
    lock.current = true
    setBusy(true)
    setError('')
    try {
      const r = await axiosClient.post<{ id: number }>(
        '/replenishment-requests',
        {
          storeId: Number(destination),
          note: note.trim(),
          lines: rows.map((l) => ({
            productId: l.productId,
            requestedQty: l.qty,
          })),
        },
      )
      navigate('/replenishment-requests/' + r.data.id)
    } catch (e) {
      setError(inventoryError(e))
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  return (
    <main className="dashboard-content tf-page tf-repl-create">
      <header>
        <h1>Tạo yêu cầu bổ sung</h1>
        <nav>
          <Link to="/dashboard">Trang chủ</Link> ›{' '}
          <Link to="/replenishment-requests">Yêu cầu bổ sung</Link> › Tạo mới
        </nav>
      </header>
      <InventoryNotice error={error || stores.error} />
      <form
        id="replenishment-create"
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        <fieldset disabled={busy}>
          <div className="tf-create-top">
            <section>
              <h2>Thông tin chung</h2>
              <div className="tf-general-grid">
                <label>
                  Cửa hàng cần hàng <span>*</span>
                  {scope.owner ? (
                    <select
                      required
                      value={store}
                      onChange={(e) => setStore(e.target.value)}
                    >
                      <option value="">Chọn cửa hàng</option>
                      {stores.data
                        ?.filter((s) => s.status !== 'INACTIVE')
                        .map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.storeName}
                            {s.status === 'PLANNED'
                              ? ' · đang chuẩn bị mở'
                              : ''}
                          </option>
                        ))}
                    </select>
                  ) : (
                    <strong>{scope.user?.storeName}</strong>
                  )}
                </label>
                <div>
                  <span>Gửi tới</span>
                  <p>
                    {central
                      ? 'Branch Manager ' +
                        central.storeName +
                        (central.managers?.length
                          ? ' · ' +
                            central.managers.map((m) => m.fullName).join(', ')
                          : '')
                      : 'Bộ phận điều phối kho tổng'}
                  </p>
                </div>
                <label className="tf-full">
                  Ghi chú
                  <textarea
                    maxLength={500}
                    rows={2}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Ví dụ: khách sỉ đặt trước, cần trước thứ Hai…"
                  />
                </label>
              </div>
            </section>
            <section className="tf-create-summary">
              <h2>Tóm tắt</h2>
              <dl>
                <div>
                  <dt>Số dòng</dt>
                  <dd>{rows.filter((r) => r.productId > 0).length}</dd>
                </div>
                <div>
                  <dt>Tổng số lượng</dt>
                  <dd>
                    {rows
                      .filter((r) => r.productId > 0)
                      .reduce((sum, r) => sum + r.qty, 0)}
                  </dd>
                </div>
              </dl>
              <button className="tf-primary" disabled={!valid || busy}>
                ♧ Gửi yêu cầu
              </button>
              <Link className="tf-cancel" to="/replenishment-requests">
                Hủy
              </Link>
            </section>
          </div>
          <section>
            <h2>Phụ tùng cần bổ sung</h2>
            <div className="tf-table">
              <table>
                <thead>
                  <tr>
                    <th>Phụ tùng</th>
                    <th>
                      Tồn ở{' '}
                      {stores.data?.find((s) => String(s.id) === destination)
                        ?.storeName ??
                        scope.user?.storeName ??
                        'cửa hàng'}
                    </th>
                    <th>Bán được ở {central?.storeName ?? 'kho tổng'}</th>
                    <th>Số lượng</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.key}>
                      <td>
                        <PartChoice
                          row={row}
                          excluded={rows
                            .filter((r) => r.key !== row.key)
                            .map((r) => r.productId)}
                          onChange={(p) =>
                            setRows(
                              rows.map((r) =>
                                r.key === row.key ? { ...r, ...p } : r,
                              ),
                            )
                          }
                        />
                      </td>
                      <td>
                        {row.productId > 0
                          ? stockText(destination, row.productId)
                          : '—'}
                      </td>
                      <td>
                        {row.productId > 0 && central
                          ? stockText(String(central.id), row.productId)
                          : scope.owner
                            ? 'Chọn phụ tùng'
                            : 'Chưa có dữ liệu được phép xem'}
                      </td>
                      <td>
                        <input
                          aria-label={'Số lượng dòng ' + row.key}
                          required
                          type="number"
                          min={1}
                          max={2147483647}
                          step={1}
                          value={row.qty}
                          onChange={(e) =>
                            setRows(
                              rows.map((r) =>
                                r.key === row.key
                                  ? { ...r, qty: Number(e.target.value) }
                                  : r,
                              ),
                            )
                          }
                        />
                      </td>
                      <td>
                        <button
                          type="button"
                          onClick={() =>
                            setRows(rows.filter((r) => r.key !== row.key))
                          }
                        >
                          Bỏ
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="tf-add-row">
              <button
                type="button"
                disabled={rows.length >= 200}
                onClick={() =>
                  setRows([
                    ...rows,
                    {
                      key: ++counter.current,
                      productId: 0,
                      sku: '',
                      partName: '',
                      qty: 1,
                    },
                  ])
                }
              >
                ＋ Thêm dòng
              </button>
              <button
                type="button"
                disabled={!suggestions.data?.length || rows.length >= 200}
                onClick={() =>
                  setRows((old) =>
                    [
                      ...old.filter((r) => r.productId > 0),
                      ...(suggestions.data ?? [])
                        .filter(
                          (s) => !old.some((r) => r.productId === s.productId),
                        )
                        .map((s) => ({
                          key: ++counter.current,
                          productId: s.productId,
                          sku: s.sku,
                          partName: s.partName,
                          qty: s.suggestedQty,
                        })),
                    ].slice(0, 200),
                  )
                }
              >
                Thêm phụ tùng dưới ngưỡng
              </button>
              <InventoryNotice error={suggestions.error} />
            </div>
          </section>
        </fieldset>
      </form>
    </main>
  )
}
export function PartChoice({
  row,
  excluded,
  onChange,
}: {
  row: Row
  excluded: number[]
  onChange: (p: { productId: number; sku: string; partName: string }) => void
}) {
  const [query, setQuery] = useState(''),
    [open, setOpen] = useState(false),
    choices = useChoicePages<{ id: number; sku: string; partName: string }>(
      '/products',
      query,
      open,
    )
  return (
    <div className="tf-part-choice">
      <BarcodeScan
        onFound={(p) => {
          if (excluded.includes(p.productId))
            throw new Error(
              'Phụ tùng đã có trong phiếu. Hãy sửa số lượng ở dòng hiện có.',
            )
          onChange({ productId: p.productId, sku: p.sku, partName: p.partName })
          setOpen(false)
        }}
      />
      <input
        aria-label="Tìm và chọn phụ tùng"
        role="combobox"
        aria-expanded={open}
        aria-controls={'parts-' + row.key}
        value={
          open ? query : row.productId ? row.partName + ' · ' + row.sku : ''
        }
        placeholder="Chọn phụ tùng"
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
      />
      {open && (
        <div id={'parts-' + row.key} className="tf-part-options">
          {choices.data?.items
            .filter((p) => !excluded.includes(p.id))
            .map((p) => (
              <button
                type="button"
                key={p.id}
                onClick={() => {
                  onChange({
                    productId: p.id,
                    sku: p.sku,
                    partName: p.partName,
                  })
                  setOpen(false)
                  setQuery('')
                }}
              >
                {p.partName} · {p.sku}
              </button>
            ))}
          {choices.loading && <small>Đang tải…</small>}
          {choices.error && <small role="alert">{choices.error}</small>}
          {choices.hasMore && (
            <button type="button" onClick={choices.loadMore}>
              Xem thêm
            </button>
          )}
          <button type="button" onClick={() => setOpen(false)}>
            Đóng lựa chọn
          </button>
        </div>
      )}
    </div>
  )
}
