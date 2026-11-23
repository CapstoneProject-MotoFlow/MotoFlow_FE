import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import PageHeader from '../../shared/ui/PageHeader'
import CardHead, { HeadButton } from './CardHead'
import Hint from '../../shared/ui/Hint'
import ConfirmDialog from '../../shared/ui/ConfirmDialog'
import { formatDateTime } from '../../shared/utils/format'
import { documentCode } from '../../shared/utils/documentCode'
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
import { isDamagedVariant } from '../../shared/utils/damagedVariant'
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
/**
 * GET /replenishment-requests/drafts/{id} (BE #61, D2): nháp lưu trên server, chỉ người tạo mở được.
 * Cùng dạng ReplenishmentDetailResponse: cửa hàng cần hàng là requestingStoreId (PM 18/11: FE theo tên của BE).
 * Gửi nháp (POST …/submit) thành yêu cầu thật, giữ nguyên id.
 */
export type ReplenishmentDraft = {
  id: number
  status: string
  requestingStoreId: number | null
  note: string | null
  createdAt?: string | null
  updatedAt?: string | null
  lines: {
    productId: number
    sku: string
    partName: string
    requestedQty: number | null
  }[]
}
export const replenishmentDraftsPath = '/replenishment-requests?status=DRAFT'

export default function ReplenishmentCreatePage({
  savedDraft,
}: {
  /** Nháp mở lại từ tab "Nháp" (PM 17/11: nháp lưu trên server, không lưu trên trình duyệt). */
  savedDraft?: ReplenishmentDraft
} = {}) {
  const scope = useInventoryScope(),
    navigate = useNavigate(),
    location = useLocation(),
    prefill = savedDraft
      ? undefined
      : (location.state as { prefill?: ReplenishmentPrefill } | null)?.prefill,
    draftCode = savedDraft ? documentCode('YBS', savedDraft.id) : '',
    [store, setStore] = useState(
      prefill?.storeId
        ? String(prefill.storeId)
        : savedDraft?.requestingStoreId
          ? String(savedDraft.requestingStoreId)
          : '',
    ),
    [note, setNote] = useState(savedDraft?.note ?? ''),
    [rows, setRows] = useState<Row[]>(() =>
      prefill?.lines.length
        ? prefill.lines.map((line, index) => ({ key: index + 1, ...line }))
        : savedDraft?.lines.length
          ? savedDraft.lines.map((line, index) => ({
              key: index + 1,
              productId: line.productId,
              sku: line.sku,
              partName: line.partName,
              qty: line.requestedQty ?? 1,
            }))
          : [{ key: 1, productId: 0, sku: '', partName: '', qty: 1 }],
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [confirmDelete, setConfirmDelete] = useState(false),
    savedAt = savedDraft?.updatedAt ?? savedDraft?.createdAt,
    draftNotice = savedDraft
      ? 'Đang mở nháp ' +
        draftCode +
        (savedAt ? ', lưu lúc ' + formatDateTime(savedAt) : '') +
        '. Bấm "Gửi yêu cầu" để gửi nháp thành yêu cầu.'
      : prefill
        ? 'Đã điền sẵn ' +
          prefill.lines.length +
          ' phụ tùng chọn từ màn Tồn kho. Kiểm tra số lượng rồi gửi.'
        : ''
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
      const body = {
        storeId: Number(destination),
        note: note.trim(),
        lines: rows.map((l) => ({
          productId: l.productId,
          requestedQty: l.qty,
        })),
      }
      // Gửi nháp: BE kiểm như tạo yêu cầu, đổi nháp thành yêu cầu thật, giữ nguyên id (PM 17/11).
      const r = savedDraft
        ? await axiosClient.post<{ id: number }>(
            '/replenishment-requests/drafts/' + savedDraft.id + '/submit',
            body,
          )
        : await axiosClient.post<{ id: number }>(
            '/replenishment-requests',
            body,
          )
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
  /** Lưu nháp lên server: POST /replenishment-requests/drafts, hoặc PUT …/drafts/{id} khi đang mở nháp. */
  async function saveDraft() {
    if (lock.current) return
    lock.current = true
    setBusy(true)
    setError('')
    try {
      const body = {
        storeId: Number(destination) || null,
        note: note.trim() || null,
        lines: selectedRows.map((l) => ({
          productId: l.productId,
          requestedQty: l.qty,
        })),
      }
      const r = savedDraft
        ? await axiosClient.put<{ id: number }>(
            '/replenishment-requests/drafts/' + savedDraft.id,
            body,
          )
        : await axiosClient.post<{ id: number }>(
            '/replenishment-requests/drafts',
            body,
          )
      navigate(replenishmentDraftsPath, {
        state: {
          notice: 'Đã lưu nháp ' + documentCode('YBS', r.data.id) + '.',
        },
      })
    } catch (e) {
      setError(inventoryError(e))
      lock.current = false
      setBusy(false)
    }
  }
  async function deleteDraft() {
    if (!savedDraft || lock.current) return
    lock.current = true
    setBusy(true)
    setError('')
    try {
      await axiosClient.delete(
        '/replenishment-requests/drafts/' + savedDraft.id,
      )
      navigate(replenishmentDraftsPath, {
        state: { notice: 'Đã xóa nháp ' + draftCode + '.' },
      })
    } catch (e) {
      setError(inventoryError(e))
      lock.current = false
      setBusy(false)
    }
  }
  return (
    <main className="dashboard-content tf-page tf-repl-create tf-replenishment-form">
      <PageHeader
        title={
          savedDraft
            ? 'Nháp yêu cầu bổ sung ' + draftCode
            : 'Tạo yêu cầu bổ sung'
        }
      />
      {draftNotice && <Hint>{draftNotice}</Hint>}
      {confirmDelete && (
        <ConfirmDialog
          title={'Xóa nháp ' + draftCode + '?'}
          message="Nháp bị xóa hẳn và không khôi phục được."
          confirmLabel="Xóa nháp"
          cancelLabel="Không xóa"
          danger
          onConfirm={async () => {
            setConfirmDelete(false)
            await deleteDraft()
          }}
          onCancel={() => setConfirmDelete(false)}
        />
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
                  to: savedDraft
                    ? replenishmentDraftsPath
                    : '/replenishment-requests',
                }}
              />
              {savedDraft && (
                <HeadButton
                  action={{
                    key: 'delete-draft',
                    label: 'Xóa nháp',
                    disabled: busy,
                    onClick: () => setConfirmDelete(true),
                  }}
                />
              )}
              <HeadButton
                action={{
                  key: 'draft',
                  label: 'Lưu nháp',
                  icon: 'note',
                  disabled: busy || !selectedRows.length,
                  onClick: () => void saveDraft(),
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
    // BH8 (GVHD 20/11): yêu cầu bổ sung không xin mã hàng lỗi.
    choices.data?.items.filter(
      (part) => !excluded.includes(part.id) && !isDamagedVariant(part),
    ) ?? []
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

/** Route /replenishment-requests/drafts/:id: mở lại nháp yêu cầu bổ sung lưu trên server (PM 17/11). */
export function ReplenishmentDraftPage() {
  const { id } = useParams()
  const valid = !!id && /^[1-9]\d*$/.test(id)
  const [result, setResult] = useState<{
    id: string
    draft?: ReplenishmentDraft
    error?: string
  }>()
  useEffect(() => {
    if (!valid) return
    const controller = new AbortController()
    void axiosClient
      .get<ReplenishmentDraft>('/replenishment-requests/drafts/' + id, {
        signal: controller.signal,
      })
      .then(({ data }) => {
        if (!controller.signal.aborted) setResult({ id: id!, draft: data })
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setResult({ id: id!, error: inventoryError(e) })
      })
    return () => controller.abort()
  }, [id, valid])
  const current = result?.id === id ? result : undefined
  if (current?.draft?.status === 'DRAFT')
    return <ReplenishmentCreatePage key={id} savedDraft={current.draft} />
  return (
    <main className="dashboard-content tf-page tf-repl-create">
      <PageHeader
        title="Nháp yêu cầu bổ sung"
      />
      {!valid ? (
        <p role="alert">Mã nháp không hợp lệ.</p>
      ) : current?.error ? (
        <InventoryNotice error={current.error} />
      ) : current?.draft ? (
        <p role="status">
          Nháp này đã được gửi thành yêu cầu bổ sung.{' '}
          <Link to={'/replenishment-requests/' + current.draft.id}>
            Xem yêu cầu {documentCode('YBS', current.draft.id)}
          </Link>
        </p>
      ) : (
        <p role="status">Đang tải nháp…</p>
      )}
    </main>
  )
}
