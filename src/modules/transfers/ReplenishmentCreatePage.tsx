import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import axiosClient from '../../shared/api/axiosClient'
import {
  useInventoryScope,
  useInventoryData,
  inventoryError,
} from '../inventory/api'
import { InventoryNotice } from '../inventory/components'
import SearchableFilter from '../../shared/ui/SearchableFilter'
import { transferQuantitiesValid } from './transferRules'
import type { Page } from '../inventory/types'
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
  const selectedRows = rows.filter((row) => row.productId > 0)
  const totalQuantity = selectedRows.reduce((sum, row) => sum + row.qty, 0)
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
    <main className="dashboard-content tf-page tf-repl-create tf-replenishment-form">
      <header>
        <h1>Tạo yêu cầu bổ sung</h1>
        <nav>
          <Link to="/dashboard">Trang chủ</Link> ›{' '}
          <Link to="/replenishment-requests">Yêu cầu bổ sung</Link> › Tạo mới
        </nav>
      </header>
      <InventoryNotice error={error || scope.storesError} />
      <form
        id="replenishment-create"
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        <fieldset disabled={busy}>
          <section>
            <h2>Phụ tùng cần bổ sung</h2>
            <div className="tf-replenishment-store">
              <span>Cửa hàng cần hàng</span>
              {scope.owner ? (
                <SearchableFilter
                  label="Cửa hàng cần hàng"
                  value={store}
                  options={scope.stores
                    .filter((s) => s.status !== 'INACTIVE')
                    .map((s) => ({
                      value: String(s.id),
                      label: s.storeName,
                    }))}
                  searchPlaceholder="Chọn cửa hàng"
                  onChange={setStore}
                />
              ) : (
                <strong>{scope.user?.storeName ?? 'Cửa hàng của tôi'}</strong>
              )}
            </div>
            <div className="tf-table">
              <table>
                <thead>
                  <tr>
                    <th>Phụ tùng</th>
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
                ＋ Thêm phụ tùng
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
            <label className="tf-replenishment-note">
              Ghi chú (không bắt buộc)
              <textarea
                maxLength={500}
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
            <footer className="tf-coord-footer">
              <span>
                {selectedRows.length} mã · {totalQuantity} sản phẩm
              </span>
              <Link to="/replenishment-requests">Hủy</Link>
              <button className="tf-primary" disabled={!valid || busy}>
                {busy ? 'Đang gửi…' : 'Gửi yêu cầu'}
              </button>
            </footer>
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
    choices = useInventoryData<
      Page<{ id: number; sku: string; partName: string }>
    >('/products', { q: query, page: 0, size: 10 }, 0, open)
  return (
    <div
      className="tf-part-choice"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          setOpen(false)
        }
      }}
    >
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
        onMouseDown={(event) => {
          if (event.button !== 0) return
          event.preventDefault()
          event.currentTarget.focus()
          setOpen(!open)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.preventDefault()
        }}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
      />
      {open && (
        <div
          id={'parts-' + row.key}
          className="tf-part-options"
          role="listbox"
          aria-label="Phụ tùng"
        >
          {choices.data?.items
            .filter((p) => !excluded.includes(p.id))
            .map((p) => (
              <button
                type="button"
                key={p.id}
                role="option"
                aria-selected={row.productId === p.id}
                onMouseDown={(event) => event.preventDefault()}
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
          <button type="button" onClick={() => setOpen(false)}>
            Đóng lựa chọn
          </button>
        </div>
      )}
    </div>
  )
}
