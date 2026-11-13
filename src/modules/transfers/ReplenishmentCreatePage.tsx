import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import PageHeader from '../../shared/ui/PageHeader'
import CardHead, { HeadButton } from './CardHead'
import Hint from '../../shared/ui/Hint'
import { formatDateTime } from '../../shared/utils/format'
import {
  clearDraft,
  draftKey,
  readDraft,
  writeDraft,
} from '../../shared/utils/localDraft'
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
/** Dữ liệu điền sẵn khi bấm "Tạo yêu cầu bổ sung" từ màn Tồn kho (các dòng đã tích). */
export type ReplenishmentPrefill = {
  storeId?: number
  lines: { productId: number; sku: string; partName: string; qty: number }[]
}
type Draft = { store: string; note: string; rows: Row[] }
export default function ReplenishmentCreatePage() {
  const scope = useInventoryScope(),
    navigate = useNavigate(),
    location = useLocation(),
    prefill = (location.state as { prefill?: ReplenishmentPrefill } | null)
      ?.prefill,
    key = draftKey('replenishment', scope.user),
    [restored] = useState(() => (prefill ? undefined : readDraft<Draft>(key))),
    [store, setStore] = useState(
      prefill?.storeId ? String(prefill.storeId) : (restored?.data.store ?? ''),
    ),
    [note, setNote] = useState(restored?.data.note ?? ''),
    [rows, setRows] = useState<Row[]>(() =>
      prefill?.lines.length
        ? prefill.lines.map((line, index) => ({ key: index + 1, ...line }))
        : restored?.data.rows.length
          ? restored.data.rows
          : [{ key: 1, productId: 0, sku: '', partName: '', qty: 1 }],
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [draftNotice, setDraftNotice] = useState(
      restored
        ? 'Đang mở bản nháp lưu lúc ' + formatDateTime(restored.savedAt) + '.'
        : prefill
          ? 'Đã điền sẵn ' +
            prefill.lines.length +
            ' phụ tùng chọn từ màn Tồn kho. Kiểm tra số lượng rồi gửi.'
          : '',
    )
  // Dùng dữ liệu điền sẵn một lần; tải lại trang thì không ghi đè bản nháp người dùng đã lưu.
  useEffect(() => {
    if (prefill)
      navigate(location.pathname + location.search, {
        replace: true,
        state: null,
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const lock = useRef(false),
    counter = useRef(Math.max(1, ...rows.map((row) => row.key))),
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
      clearDraft(key)
      navigate('/replenishment-requests/' + r.data.id, {
        state: {
          created:
            'Đã gửi yêu cầu bổ sung cho ' +
            (scope.owner
              ? (scope.stores.find((s) => String(s.id) === destination)
                  ?.storeName ?? 'cửa hàng')
              : (scope.user?.storeName ?? 'cửa hàng')) +
            ' gồm ' +
            selectedRows.length +
            ' phụ tùng.',
        },
      })
    } catch (e) {
      setError(inventoryError(e))
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  return (
    <main className="dashboard-content tf-page tf-repl-create tf-replenishment-form">
      <PageHeader
        title="Tạo yêu cầu bổ sung"
        breadcrumb={[
          { label: 'Yêu cầu bổ sung', to: '/replenishment-requests' },
          { label: 'Tạo mới' },
        ]}
      />
      {draftNotice && (
        <Hint>
          {draftNotice}{' '}
          {restored && (
            <button
              type="button"
              className="mf-btn mf-btn--link"
              onClick={() => {
                clearDraft(key)
                setRows([
                  { key: 1, productId: 0, sku: '', partName: '', qty: 1 },
                ])
                setNote('')
                setStore('')
                setDraftNotice('Đã bỏ bản nháp.')
              }}
            >
              Bỏ nháp
            </button>
          )}
        </Hint>
      )}
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
            <CardHead title="Phụ tùng cần bổ sung">
              <span className="tf-head-meta">
                {selectedRows.length} mã · {totalQuantity} phụ tùng
              </span>
              <HeadButton
                action={{
                  key: 'cancel',
                  label: 'Hủy',
                  to: '/replenishment-requests',
                }}
              />
              <HeadButton
                action={{
                  key: 'draft',
                  label: 'Lưu nháp',
                  icon: 'note',
                  disabled: busy || !selectedRows.length,
                  onClick: () => {
                    const saved = writeDraft<Draft>(key, { store, note, rows })
                    setDraftNotice(
                      saved
                        ? 'Đã lưu nháp lúc ' +
                            formatDateTime(saved.savedAt) +
                            ' trên máy này.'
                        : 'Không lưu được nháp trên máy này.',
                    )
                  },
                }}
              />
              <HeadButton
                action={{
                  key: 'send',
                  label: busy ? 'Đang gửi…' : 'Gửi yêu cầu',
                  icon: 'check',
                  primary: true,
                  form: 'replenishment-create',
                  disabled: !valid || busy,
                }}
              />
            </CardHead>
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
                placeholder="Ví dụ: Garage Tuấn Phát đặt 10 bộ má phanh, cần có hàng trước thứ Bảy."
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
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
  const [query, setQuery] = useState<string | null>(null)
  const choices = useInventoryData<
    Page<{ id: number; sku: string; partName: string }>
  >('/products', { q: query?.trim(), page: 0, size: 10 }, 0, query !== null)
  const parts =
    choices.data?.items.filter((part) => !excluded.includes(part.id)) ?? []
  const options = parts.map((part) => ({
    value: String(part.id),
    label: part.partName + ' · ' + part.sku,
  }))
  if (query === null && row.productId) {
    options.push({
      value: String(row.productId),
      label: row.partName + ' · ' + row.sku,
    })
  }
  return (
    <div className="tf-part-choice">
      <SearchableFilter
        label="Tìm và chọn phụ tùng"
        searchPlaceholder={
          query === null ? 'Chọn phụ tùng' : 'Tìm theo tên hoặc SKU'
        }
        value={String(row.productId)}
        options={options}
        maxOptions={10}
        loading={choices.loading}
        error={choices.error}
        toggleOnClick
        onSearch={setQuery}
        onChange={(value) => {
          const part = parts.find((item) => String(item.id) === value)
          if (part)
            onChange({
              productId: part.id,
              sku: part.sku,
              partName: part.partName,
            })
        }}
      />
    </div>
  )
}
