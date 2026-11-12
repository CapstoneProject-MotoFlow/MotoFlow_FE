import PageBackLink from '../../../shared/ui/PageBackLink'
import { isAxiosError } from 'axios'
import { useInventoryScope } from '../../inventory/api'
import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import axiosClient from '../../../shared/api/axiosClient'
import FormDialog from '../../../shared/ui/FormDialog'
import { apiMessage } from '../supplierService'
import { uploadAttachment as uploadReceiptDocument } from '../../../shared/api/upload'
import {
  handlingDraft,
  replacementLimit,
  replacementValue,
  type HandlingCase,
  type HandlingDraft,
} from '../../receiving/receivingRules'
import '../supplier-discrepancy.css'
import { formatDateTime } from '../../../shared/utils/format'

type Case = HandlingCase & {
  id: number
  goodsReceiptNoteId: number
  sku: string
  partName: string
  status: string
  canHandle: boolean
  canRecordReturn: boolean
  canWaiveReplacement: boolean
  outstandingReturnQty: number
  outstandingReplacementQty: number
  openReplacementQty: number
  events: {
    id: number
    type: string
    quantity: number
    reason: string | null
    recordedByName: string | null
    occurredAt: string
  }[]
}

function errorMessage(error: unknown) {
  if (!isAxiosError(error))
    return error instanceof Error ? error.message : apiMessage(error)
  const code = error.response?.data?.code
  return code ? code + ' · ' + apiMessage(error) : apiMessage(error)
}

const eventNames: Record<string, string> = {
  MOVED_TO_AWAITING_RETURN: 'Chuyển sang chờ trả NCC',
  RETURNED_TO_SUPPLIER: 'Đã trả nhà cung cấp',
  LATE_DELIVERY_RECEIVED: 'Nhận hàng giao muộn',
  RECEIVED_BACK_AT_SOURCE: 'Đã nhận lại tại kho nguồn',
  APPROVED_LOSS: 'Đã duyệt hao hụt',
  CLOSED_BY_AGREEMENT: 'Đóng theo thỏa thuận',
  RETURN_TO_SUPPLIER: 'Đã trả nhà cung cấp',
  SUPPLIER_RETURN: 'Đã trả nhà cung cấp',
  REPLACEMENT_RECEIVED: 'Nhận hàng giao bù',
  REPLACEMENT_WAIVED: 'Miễn giao bù',
  WRITE_OFF: 'Xử lý hàng hỏng',
}

function CaseAction({
  selected,
  mode,
  onClose,
  onSaved,
}: {
  selected: Case
  mode: 'return' | 'waive' | 'history'
  onClose: () => void
  onSaved: (row: Case) => void
}) {
  const [row, setRow] = useState<Case>()
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const uploads = useRef(
    new WeakMap<File, Awaited<ReturnType<typeof uploadReceiptDocument>>>(),
  )
  const returning = mode === 'return'
  useEffect(() => {
    const controller = new AbortController()
    void axiosClient
      .get<Case>('/discrepancy-cases/' + selected.id, {
        signal: controller.signal,
      })
      .then(({ data }) => {
        if (!controller.signal.aborted) setRow(data)
      })
      .catch((error) => {
        if (!controller.signal.aborted) setError(errorMessage(error))
      })
    return () => controller.abort()
  }, [selected.id])

  const history = row && (
    <section>
      <h3>Lịch sử xử lý</h3>
      {row.events?.length ? (
        <ul>
          {row.events.map((event) => (
            <li key={event.id}>
              {formatDateTime(event.occurredAt)} ·{' '}
              {event.recordedByName ?? 'Hệ thống'} ·{' '}
              {eventNames[event.type] ?? event.type} · {event.quantity}
              {event.reason ? ' · ' + event.reason : ''}
            </li>
          ))}
        </ul>
      ) : (
        <p>Chưa có lịch sử xử lý.</p>
      )}
    </section>
  )

  if (mode === 'history')
    return (
      <FormDialog
        title={'Hồ sơ sai lệch · ' + selected.sku}
        formId="case-history"
        submitLabel="Đóng"
        onClose={onClose}
      >
        <form
          id="case-history"
          onSubmit={(event) => {
            event.preventDefault()
            onClose()
          }}
        >
          {!row && !error && <p role="status">Đang tải…</p>}
          {error && <p role="alert">{error}</p>}
          {history}
        </form>
      </FormDialog>
    )

  const allowed = returning ? row?.canRecordReturn : row?.canWaiveReplacement
  return (
    <FormDialog
      title={
        (returning ? 'Ghi nhận đã trả NCC · ' : 'Miễn giao bù · ') +
        selected.sku
      }
      formId="case-action"
      submitLabel="Lưu"
      busy={saving}
      onClose={onClose}
    >
      <form
        id="case-action"
        onSubmit={async (event) => {
          event.preventDefault()
          if (!allowed || saving || !row) return
          const fields = new FormData(event.currentTarget)
          const quantity = Number(fields.get('quantity'))
          const limit = returning
            ? row.outstandingReturnQty
            : row.openReplacementQty
          if (!Number.isInteger(quantity) || quantity < 1 || quantity > limit) {
            setError('Số lượng phải nằm trong phần nghĩa vụ còn lại.')
            return
          }
          setSaving(true)
          setError('')
          try {
            let payload: object
            if (returning) {
              const files = fields
                .getAll('evidence')
                .filter(
                  (value): value is File =>
                    value instanceof File && value.size > 0,
                )
              if (!files.length || files.length > 10)
                throw new Error('Chọn từ 1 đến 10 tệp bằng chứng trả hàng.')
              const evidence = []
              for (const file of files) {
                const document =
                  uploads.current.get(file) ??
                  (await uploadReceiptDocument(file))
                uploads.current.set(file, document)
                evidence.push(document)
              }
              payload = {
                quantity,
                note: String(fields.get('note') ?? '').trim() || null,
                evidence,
              }
            } else {
              const reason = String(fields.get('reason') ?? '').trim()
              if (!reason) throw new Error('Vui lòng nhập lý do miễn giao bù.')
              payload = { quantity, reason }
            }
            const { data } = await axiosClient.post<Case>(
              '/discrepancy-cases/' +
                row.id +
                (returning ? '/supplier-returns' : '/waive-replacement'),
              payload,
            )
            onSaved(data)
          } catch (error) {
            setError(errorMessage(error))
          } finally {
            setSaving(false)
          }
        }}
      >
        {!row && !error && <p role="status">Đang tải hồ sơ…</p>}
        {row && (
          <div className="receiving-layout-fields">
            {!allowed && <p>Hồ sơ này hiện không cho phép thao tác.</p>}
            <label>
              Số lượng{' '}
              <input
                name="quantity"
                type="number"
                required
                min={1}
                max={
                  returning ? row.outstandingReturnQty : row.openReplacementQty
                }
                disabled={!allowed || saving}
              />
            </label>
            <label className="receiving-layout-wide">
              {returning ? 'Ghi chú' : 'Lý do miễn giao bù'}
              <textarea
                name={returning ? 'note' : 'reason'}
                required={!returning}
                maxLength={255}
                disabled={!allowed || saving}
              />
            </label>
            {returning && (
              <label className="receiving-layout-wide">
                Bằng chứng trả hàng
                <input
                  type="file"
                  name="evidence"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  multiple
                  required
                  disabled={!allowed || saving}
                />
              </label>
            )}
          </div>
        )}
        {error && <p role="alert">{error}</p>}
        {history}
      </form>
    </FormDialog>
  )
}

export default function ResolveSupplierDiscrepancyPage() {
  const [params, setParams] = useSearchParams()
  const receiptId = params.get('receipt') ?? ''
  return (
    <DiscrepancyForm
      key={receiptId}
      receiptId={receiptId}
      onOpenReceipt={(receipt) => setParams(receipt ? { receipt } : {})}
    />
  )
}

function DiscrepancyForm({
  receiptId,
  onOpenReceipt,
}: {
  receiptId: string
  onOpenReceipt: (receipt: string) => void
}) {
  const scope = useInventoryScope()
  const [status, setStatus] = useState('OPEN'),
    [purchaseOrderId, setPurchaseOrderId] = useState('')
  const [rows, setRows] = useState<Case[]>([])
  const [drafts, setDrafts] = useState<Record<number, HandlingDraft>>({})
  const valid = !receiptId || /^[1-9]\d*$/.test(receiptId)
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(valid)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [action, setAction] = useState<{
    row: Case
    mode: 'return' | 'waive' | 'history'
  }>()
  const editable = !!receiptId && rows.some((row) => row.canHandle)
  const changes = rows.flatMap((row) => {
    const draft = drafts[row.id]
    if (!row.canHandle || !draft) return []
    const returnRequiredQty = Number(draft.returned)
    const replacementRequiredQty = Number(replacementValue(row, draft))
    if (
      returnRequiredQty === row.returnRequiredQty &&
      replacementRequiredQty === row.replacementRequiredQty
    )
      return []
    return [{ caseId: row.id, returnRequiredQty, replacementRequiredQty }]
  })

  useEffect(() => {
    if (!valid || (purchaseOrderId && !/^[1-9]\d*$/.test(purchaseOrderId)))
      return
    const controller = new AbortController()
    async function load() {
      setLoading(true)
      try {
        if (receiptId) {
          const cases: Case[] = []
          for (let current = 0; ; current++) {
            const { data } = await axiosClient.get<{
              items: Case[]
              totalItems: number
            }>('/discrepancy-cases', {
              params: {
                goodsReceiptNoteId: receiptId,
                page: current,
                size: 100,
              },
              signal: controller.signal,
            })
            cases.push(...data.items)
            if (!data.items.length || cases.length >= data.totalItems) break
          }
          if (!controller.signal.aborted) {
            setRows(cases)
            setTotal(cases.length)
          }
        } else {
          const { data } = await axiosClient.get<{
            items: Case[]
            totalItems: number
          }>('/discrepancy-cases', {
            params: {
              status: status || undefined,
              storeId: scope.storeId || undefined,
              purchaseOrderId: purchaseOrderId || undefined,
              page,
              size: 20,
            },
            signal: controller.signal,
          })
          if (!controller.signal.aborted) {
            setRows(data.items)
            setTotal(data.totalItems)
          }
        }
        if (!controller.signal.aborted) setError('')
      } catch (error) {
        if (!controller.signal.aborted) setError(errorMessage(error))
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    const timer = setTimeout(() => void load(), 300)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [receiptId, valid, page, status, scope.storeId, purchaseOrderId])

  return (
    <main className="dashboard-content supplier-discrepancy-page">
      <PageBackLink to="/purchase-orders" />
      <header className="receiving-heading">
        <h1>Xử lý sai lệch nhà cung cấp</h1>
      </header>
      {!receiptId && (
        <div className="receiving-filter-row">
          <label>
            Trạng thái
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value)
                setPage(0)
              }}
            >
              <option value="OPEN">Đang mở</option>
              <option value="CLOSED">Đã đóng</option>
              <option value="">Tất cả</option>
            </select>
          </label>
          {scope.owner && (
            <label>
              Cửa hàng
              <select
                value={scope.storeId}
                onChange={(e) => {
                  scope.filter({ storeId: e.target.value })
                  setPage(0)
                }}
              >
                <option value="">Toàn chuỗi</option>
                {scope.stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.storeName}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            Mã đơn mua
            <input
              type="text"
              inputMode="numeric"
              pattern="[1-9][0-9]*"
              value={purchaseOrderId}
              onChange={(e) => {
                if (
                  e.target.value === '' ||
                  /^[1-9]\d*$/.test(e.target.value)
                ) {
                  setPurchaseOrderId(e.target.value)
                  setPage(0)
                }
              }}
            />
          </label>
          {scope.storesError && <p role="alert">{scope.storesError}</p>}
        </div>
      )}
      <form
        className="receiving-filter-row"
        onSubmit={(event) => {
          event.preventDefault()
          onOpenReceipt(
            String(
              new FormData(event.currentTarget).get('receipt') ?? '',
            ).trim(),
          )
        }}
      >
        <label>
          Mã phiếu nhập hàng{' '}
          <input
            name="receipt"
            defaultValue={receiptId}
            inputMode="numeric"
            pattern="[1-9][0-9]*"
          />
        </label>
        <button type="submit" disabled={saving}>
          Mở phiếu
        </button>
        {receiptId && (
          <button type="button" onClick={() => onOpenReceipt('')}>
            Tất cả hồ sơ đang mở
          </button>
        )}
      </form>
      {!valid && <p role="alert">Mã phiếu nhập hàng không hợp lệ.</p>}
      {loading && <p role="status">Đang tải sai lệch…</p>}
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {!loading && !error && !rows.length && (
        <p>Không có hồ sơ sai lệch phù hợp.</p>
      )}
      {!loading && rows.length > 0 && (
        <section className="receiving-panel">
          <form
            onSubmit={async (event) => {
              event.preventDefault()
              if (saving || !editable || !changes.length) return
              const note = String(
                new FormData(event.currentTarget).get('note') ?? '',
              ).trim()
              setError('')
              setNotice('')
              setSaving(true)
              try {
                const { data } = await axiosClient.put<Case[]>(
                  '/goods-receipt-notes/' + receiptId + '/discrepancies',
                  { lines: changes, note },
                )
                setRows(data)
                setDrafts({})
                setNotice('Đã lưu hướng xử lý sai lệch.')
              } catch (error) {
                setError(errorMessage(error))
              } finally {
                setSaving(false)
              }
            }}
          >
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Phụ tùng / Phiếu nhập</th>
                    <th>Thiếu</th>
                    <th>Giao sai</th>
                    <th>Hỏng</th>
                    <th>Thừa từ chối</th>
                    <th>Số trả lại</th>
                    <th>Số giao bù</th>
                    <th>Còn phải trả</th>
                    <th>Còn phải giao bù</th>
                    <th>Trạng thái</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const draft = drafts[row.id] ?? handlingDraft(row)
                    return (
                      <tr key={row.id}>
                        <th scope="row">
                          {row.sku} · {row.partName}
                          <small>
                            <Link
                              to={
                                '/supplier-discrepancies?receipt=' +
                                row.goodsReceiptNoteId
                              }
                            >
                              Phiếu nhập #{row.goodsReceiptNoteId}
                            </Link>
                          </small>
                        </th>
                        <td>{row.shortQty}</td>
                        <td>{row.wrongItemQty}</td>
                        <td>{row.damagedQty}</td>
                        <td>{row.rejectedExcessQty}</td>
                        <td>
                          {receiptId ? (
                            <input
                              type="number"
                              aria-label={'Số trả lại · ' + row.sku}
                              min={row.returnRequiredQty}
                              max={
                                row.wrongItemQty +
                                row.damagedQty +
                                row.rejectedExcessQty
                              }
                              required
                              disabled={!row.canHandle || saving}
                              value={draft.returned}
                              onChange={(event) =>
                                setDrafts((previous) => ({
                                  ...previous,
                                  [row.id]: {
                                    ...draft,
                                    returned: event.target.value,
                                  },
                                }))
                              }
                            />
                          ) : (
                            row.returnRequiredQty
                          )}
                        </td>
                        <td>
                          {receiptId ? (
                            <input
                              type="number"
                              aria-label={'Số giao bù · ' + row.sku}
                              min={0}
                              max={replacementLimit(row)}
                              required
                              disabled={
                                !row.canHandle ||
                                row.replacementDelivery ||
                                saving
                              }
                              value={replacementValue(row, draft)}
                              onChange={(event) =>
                                setDrafts((previous) => ({
                                  ...previous,
                                  [row.id]: {
                                    ...draft,
                                    replacement: event.target.value,
                                  },
                                }))
                              }
                            />
                          ) : (
                            row.replacementRequiredQty
                          )}
                        </td>
                        <td>{row.outstandingReturnQty}</td>
                        <td>{row.outstandingReplacementQty}</td>
                        <td>
                          <span
                            className={
                              'supplier-case-status ' +
                              (row.status === 'OPEN' ? 'is-open' : 'is-closed')
                            }
                          >
                            {row.status === 'OPEN' ? 'Đang mở' : 'Đã đóng'}
                          </span>
                        </td>
                        <td>
                          <div className="receiving-case-actions">
                            {row.canRecordReturn && (
                              <button
                                type="button"
                                disabled={saving}
                                onClick={() =>
                                  setAction({ row, mode: 'return' })
                                }
                              >
                                Ghi nhận đã trả
                              </button>
                            )}
                            {row.canWaiveReplacement && (
                              <button
                                type="button"
                                disabled={saving}
                                onClick={() =>
                                  setAction({ row, mode: 'waive' })
                                }
                              >
                                Miễn giao bù
                              </button>
                            )}
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() =>
                                setAction({ row, mode: 'history' })
                              }
                            >
                              Lịch sử
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {editable && (
              <div className="supplier-handling-footer">
                <label>
                  Ghi chú
                  <textarea
                    name="note"
                    rows={2}
                    maxLength={255}
                    disabled={saving}
                  />
                </label>
                <div className="supplier-handling-save">
                  <button
                    type="submit"
                    className="receiving-layout-primary"
                    disabled={saving || !changes.length}
                  >
                    {saving ? 'Đang lưu…' : 'Lưu hướng xử lý'}
                  </button>
                  {!changes.length && (
                    <small>Đổi số trả lại hoặc số giao bù để lưu.</small>
                  )}
                </div>
              </div>
            )}
          </form>
        </section>
      )}
      {!receiptId && total > 20 && (
        <div className="receiving-pagination">
          <button
            type="button"
            disabled={page === 0 || loading}
            onClick={() => setPage(page - 1)}
          >
            Trang trước
          </button>
          <span>Trang {page + 1}</span>
          <button
            type="button"
            disabled={(page + 1) * 20 >= total || loading}
            onClick={() => setPage(page + 1)}
          >
            Trang sau
          </button>
        </div>
      )}
      {action && (
        <CaseAction
          key={action.row.id + action.mode}
          selected={action.row}
          mode={action.mode}
          onClose={() => setAction(undefined)}
          onSaved={(row) => {
            setRows((previous) =>
              previous.map((item) => (item.id === row.id ? row : item)),
            )
            setDrafts((previous) => {
              const next = { ...previous }
              delete next[row.id]
              return next
            })
            setAction(undefined)
            setNotice('Đã cập nhật hồ sơ sai lệch.')
          }}
        />
      )}
    </main>
  )
}
