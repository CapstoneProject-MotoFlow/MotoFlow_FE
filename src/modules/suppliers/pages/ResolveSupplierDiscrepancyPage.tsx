import PageBackLink from '../../../shared/ui/PageBackLink'
import { isAxiosError } from 'axios'
import { useInventoryScope } from '../../inventory/api'
import { Fragment, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import axiosClient from '../../../shared/api/axiosClient'
import FormDialog from '../../../shared/ui/FormDialog'
import ConfirmDialog from '../../../shared/ui/ConfirmDialog'
import LocalizedFileInput from '../../../shared/ui/LocalizedFileInput'
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

import { purchaseOrderSearch } from '../../receiving/receivingPresentation'
import { documentCode } from '../../../shared/utils/documentCode'
import { supplierResolutionLabels } from '../../../shared/labels/status'
import PhotoButton from '../../../shared/ui/PhotoButton'
import { isImageFile } from '../../../shared/utils/imageFile'
type Case = HandlingCase & {
  id: number
  goodsReceiptNoteId: number
  storeId?: number
  storeName?: string
  purchaseOrderId?: number
  supplierName?: string
  openedAt?: string
  deliveryDate?: string
  productId: number
  sku: string
  partName: string
  status: string
  canHandle: boolean
  canRecordReturn: boolean
  canWaiveReplacement: boolean
  /** BM của kho nhận còn phải nhận hàng giao bù cho hồ sơ này (BE tính). */
  canCreateReplacement?: boolean
  returnedQty: number
  replacedQty?: number
  waivedQty?: number
  writtenOffQty?: number
  pendingReplacementQty?: number
  heldUndecidedQty?: number
  outstandingReturnQty: number
  outstandingReplacementQty: number
  openReplacementQty: number
  events?: {
    id: number
    type: string
    quantity: number
    reason: string | null
    recordedByName: string | null
    occurredAt: string
    evidence?: { id: number; fileName: string; downloadUrl: string | null }[]
  }[]
}

function errorMessage(error: unknown) {
  if (!isAxiosError(error))
    return error instanceof Error ? error.message : apiMessage(error)
  const code = error.response?.data?.code
  return code ? code + ' · ' + apiMessage(error) : apiMessage(error)
}

const eventNames = supplierResolutionLabels

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
              {!!event.evidence?.length && (
                <span className="supplier-event-evidence">
                  <PhotoButton
                    label="Xem ảnh"
                    images={event.evidence
                      .filter((file) =>
                        isImageFile(file.fileName) && !!file.downloadUrl,
                      )
                      .map((file) => ({ src: file.downloadUrl! }))}
                  />
                  {event.evidence
                    .filter((file) => !isImageFile(file.fileName) && file.downloadUrl)
                    .map((file, index) => (
                      <a key={file.id} href={file.downloadUrl!} target="_blank" rel="noreferrer">
                        Mở tệp {index + 1}
                      </a>
                    ))}
                </span>
              )}
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

  // Mục 14 (PM 19/11): "Không cần giao bù" chỉ hỏi xác nhận lần 2, không bắt nhập số lượng và lý do.
  // BE vẫn cần lý do nên FE gửi câu cố định và toàn bộ số còn phải giao bù.
  if (mode === 'waive') {
    const quantity = row?.openReplacementQty ?? selected.openReplacementQty
    return (
      <ConfirmDialog
        title={'Không cần nhà cung cấp giao bù · ' + selected.sku}
        message={
          <>
            <p>
              Bạn có chắc chắn không cần nhà cung cấp giao bù {quantity}{' '}
              {selected.partName}?
            </p>
            {error && <p role="alert">{error}</p>}
          </>
        }
        onCancel={onClose}
        onConfirm={async () => {
          setError('')
          try {
            const { data } = await axiosClient.post<Case>(
              '/discrepancy-cases/' + selected.id + '/waive-replacement',
              {
                quantity,
                reason: 'Chủ cửa hàng xác nhận không cần nhà cung cấp giao bù.',
              },
            )
            onSaved(data)
          } catch (failure) {
            setError(errorMessage(failure))
          }
        }}
      />
    )
  }

  const allowed = returning ? row?.canRecordReturn : row?.canWaiveReplacement
  return (
    <FormDialog
      title={
        (returning
          ? 'Ghi nhận đã trả nhà cung cấp · '
          : 'Không cần nhà cung cấp giao bù · ') + selected.sku
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
              if (!reason)
                throw new Error(
                  'Vui lòng nhập lý do không cần nhà cung cấp giao bù.',
                )
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
                // Báo lỗi 20/11 (mục 4): điền sẵn số còn phải trả; vẫn sửa được nếu trả làm nhiều lần.
                defaultValue={returning ? row.outstandingReturnQty : undefined}
                disabled={!allowed || saving}
              />
            </label>
            <label className="receiving-layout-wide">
              {returning ? 'Ghi chú' : 'Lý do không cần giao bù'}
              <textarea
                name={returning ? 'note' : 'reason'}
                required={!returning}
                maxLength={255}
                disabled={!allowed || saving}
              />
            </label>
            {returning && (
              <div className="receiving-layout-wide">
                <span>Bằng chứng trả hàng</span>
                <LocalizedFileInput
                  name="evidence"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  multiple
                  required
                  disabled={!allowed || saving}
                />
              </div>
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
    [purchaseOrderQuery, setPurchaseOrderQuery] = useState(''),
    [supplierQuery, setSupplierQuery] = useState(''),
    [productQuery, setProductQuery] = useState(''),
    [fromDate, setFromDate] = useState(''),
    [toDate, setToDate] = useState('')
  const [rows, setRows] = useState<Case[]>([])
  const [expandedReceiptId, setExpandedReceiptId] = useState<number | null>(null)
  const [drafts, setDrafts] = useState<Record<number, HandlingDraft>>({})
  const purchaseOrderId = purchaseOrderSearch(purchaseOrderQuery)
  const invalidOrder = !!purchaseOrderId && !/^[1-9]\d*$/.test(purchaseOrderId)
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
    if (!valid || invalidOrder) return
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
          const cases: Case[] = []
          for (let current = 0; ; current++) {
            const { data } = await axiosClient.get<{
              items: Case[]
              totalItems: number
            }>('/discrepancy-cases', {
              params: {
                status: status || undefined,
                storeId: scope.storeId || undefined,
                purchaseOrderId: purchaseOrderId || undefined,
                supplierQuery: supplierQuery.trim() || undefined,
                productQuery: productQuery.trim() || undefined,
                from: fromDate || undefined,
                to: toDate || undefined,
                page: current,
                size: 100,
              },
              signal: controller.signal,
            })
            cases.push(...data.items)
            if (!data.items.length || cases.length >= data.totalItems) break
          }
          if (!controller.signal.aborted) {
            const supplierNeedle = supplierQuery.trim().toLocaleLowerCase()
            const productNeedle = productQuery.trim().toLocaleLowerCase()
            const filtered = cases.filter((row) => {
              const date = (row.deliveryDate ?? row.openedAt ?? '').slice(0, 10)
              return (
                (!supplierNeedle ||
                  row.supplierName?.toLocaleLowerCase().includes(supplierNeedle)) &&
                (!productNeedle ||
                  `${row.sku} ${row.partName}`
                    .toLocaleLowerCase()
                    .includes(productNeedle)) &&
                (!fromDate || (!!date && date >= fromDate)) &&
                (!toDate || (!!date && date <= toDate))
              )
            })
            setRows(filtered)
            setTotal(filtered.length)
            setPage(0)
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
  }, [receiptId, valid, status, scope.storeId, purchaseOrderId, invalidOrder, supplierQuery, productQuery, fromDate, toDate])

  const receiptGroups = Array.from(
    rows.reduce((groups, row) => {
      const group = groups.get(row.goodsReceiptNoteId) ?? []
      group.push(row)
      groups.set(row.goodsReceiptNoteId, group)
      return groups
    }, new Map<number, Case[]>()),
    ([goodsReceiptNoteId, cases]) => ({
      goodsReceiptNoteId,
      cases,
      first: cases[0],
      discrepancyCount: cases.filter(
        (row) => row.shortQty + row.wrongItemQty + row.damagedQty > 0,
      ).length,
      isOpen: cases.some((row) => row.status === 'OPEN'),
    }),
  )
  const receiptPageSize = 10
  const visibleReceiptGroups = receiptGroups.slice(
    page * receiptPageSize,
    (page + 1) * receiptPageSize,
  )

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
            Nhà cung cấp
            <input
              value={supplierQuery}
              placeholder="Tìm nhà cung cấp"
              onChange={(event) => setSupplierQuery(event.target.value)}
            />
          </label>
          <label>
            Phụ tùng
            <input
              value={productQuery}
              placeholder="Tên hoặc SKU"
              onChange={(event) => setProductQuery(event.target.value)}
            />
          </label>
          <label>
            Giao từ ngày
            <input
              type="date"
              value={fromDate}
              max={toDate || undefined}
              onChange={(event) => setFromDate(event.target.value)}
            />
          </label>
          <label>
            Đến ngày
            <input
              type="date"
              value={toDate}
              min={fromDate || undefined}
              onChange={(event) => setToDate(event.target.value)}
            />
          </label>
          <label>
            Mã đơn nhập hàng
            <input
              type="text"
              placeholder="Ví dụ: DNH-0001"
              value={purchaseOrderQuery}
              aria-invalid={invalidOrder}
              onChange={(e) => {
                setPurchaseOrderQuery(e.target.value)
                setPage(0)
              }}
            />
            {invalidOrder && <small>Nhập mã đơn nhập hàng hợp lệ.</small>}
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
          Mã phiếu nhập{' '}
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
      {!valid && <p role="alert">Mã phiếu nhập không hợp lệ.</p>}
      {loading && <p role="status">Đang tải sai lệch…</p>}
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {!loading && !error && !rows.length && (
        <p>Không có hồ sơ sai lệch phù hợp.</p>
      )}
      {!receiptId && !loading && rows.length > 0 && (
        <section className="receiving-panel">
          <div className="table-scroll">
            <table className="supplier-receipt-groups">
              <thead>
                <tr>
                  <th>Phiếu nhập</th>
                  <th>Nhà cung cấp</th>
                  <th>Cửa hàng</th>
                  <th>Ngày giao</th>
                  <th>Mặt hàng lệch</th>
                  <th>Trạng thái</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {visibleReceiptGroups.map((group) => {
                  const expanded = expandedReceiptId === group.goodsReceiptNoteId
                  return (
                    <Fragment key={group.goodsReceiptNoteId}>
                      <tr>
                        <td>
                          <button
                            type="button"
                            className="supplier-receipt-code"
                            aria-expanded={expanded}
                            aria-controls={'supplier-receipt-items-' + group.goodsReceiptNoteId}
                            onClick={() =>
                              setExpandedReceiptId(expanded ? null : group.goodsReceiptNoteId)
                            }
                          >
                            {documentCode('PN', group.goodsReceiptNoteId)}
                          </button>
                          <small>{group.cases.length} phụ tùng · bấm mã phiếu để xem</small>
                        </td>
                        <td>{group.first.supplierName ?? '—'}</td>
                        <td>{group.first.storeName ?? '—'}</td>
                        <td>
                          {group.first.deliveryDate || group.first.openedAt
                            ? formatDateTime(
                                group.first.deliveryDate ?? group.first.openedAt!,
                              )
                            : '—'}
                        </td>
                        <td>{group.discrepancyCount}</td>
                        <td>{group.isOpen ? 'Đang mở' : 'Đã đóng'}</td>
                        <td>
                          <Link
                            className="mf-btn mf-btn--sm mf-btn--secondary"
                            to={'/supplier-discrepancies?receipt=' + group.goodsReceiptNoteId}
                          >
                            Xử lý
                          </Link>
                        </td>
                      </tr>
                      {expanded && (
                        <tr className="supplier-receipt-expanded-row">
                          <td colSpan={7}>
                            <ul
                              id={'supplier-receipt-items-' + group.goodsReceiptNoteId}
                              className="supplier-receipt-items"
                            >
                              {group.cases.map((row) => (
                                <li key={row.id}>
                                  <strong>{row.sku}</strong> · {row.partName}
                                  <span>Thiếu {row.shortQty} · Sai {row.wrongItemQty} · Hỏng {row.damagedQty}</span>
                                </li>
                              ))}
                            </ul>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {receiptId && !loading && rows.length > 0 && (
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
              <table className={receiptId ? 'supplier-discrepancy-lines' : undefined}>
                <thead>
                  <tr>
                    <th>Phụ tùng / Phiếu nhập</th>
                    <th>Sai lệch ban đầu</th>
                    <th>Đã xử lý</th>
                    <th>Hướng xử lý</th>
                    <th>Còn lại</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const draft = drafts[row.id] ?? handlingDraft(row)
                    const eventTotal = (type: string) =>
                      (row.events ?? [])
                        .filter((event) => event.type === type)
                        .reduce((sum, event) => sum + event.quantity, 0)
                    const initialMetrics: Array<[string, number]> = [
                      ['Thiếu', row.shortQty],
                      ['Giao sai', row.wrongItemQty],
                      ['Hỏng', row.damagedQty],
                      ['Thừa từ chối', row.rejectedExcessQty],
                    ].filter(([, quantity]) => quantity > 0)
                    const processedMetrics: Array<[string, number]> = [
                      ['Giao bù', row.replacedQty ?? eventTotal('REPLACEMENT_RECEIVED')],
                      ['Bỏ giao bù', row.waivedQty ?? eventTotal('REPLACEMENT_WAIVED')],
                      ['Đã trả', row.returnedQty],
                      ['Đã hủy', row.writtenOffQty ?? eventTotal('WRITE_OFF') + eventTotal('APPROVED_LOSS')],
                      ['Đang giữ', row.heldUndecidedQty ?? row.outstandingReturnQty],
                    ].filter(([, quantity]) => quantity > 0)
                    const remainingMetrics: Array<[string, number]> = [
                      ['Còn phải trả', row.outstandingReturnQty],
                      ['Còn phải giao bù', row.outstandingReplacementQty],
                    ].filter(([, quantity]) => quantity > 0)
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
                              {documentCode('PN', row.goodsReceiptNoteId)}
                            </Link>
                            {row.purchaseOrderId && (
                              <>
                                {' · '}
                                <Link
                                  to={'/purchase-orders/' + row.purchaseOrderId}
                                >
                                  {documentCode('DNH', row.purchaseOrderId)}
                                </Link>
                              </>
                            )}
                          </small>
                        </th>
                        <td>
                          <div className="supplier-metric-grid supplier-metric-grid--initial">
                            {initialMetrics.map(([label, quantity]) => (
                              <span key={label}><small>{label}</small><b>{quantity}</b></span>
                            ))}
                          </div>
                        </td>
                        <td>
                          <div className="supplier-metric-grid supplier-metric-grid--processed">
                            {processedMetrics.length ? processedMetrics.map(([label, quantity]) => (
                              <span key={label}><small>{label}</small><b>{quantity}</b></span>
                            )) : <small className="supplier-no-metrics">Chưa xử lý</small>}
                          </div>
                        </td>
                        <td>
                          <div className="supplier-edit-fields">
                            <label>
                              <span>Số trả lại</span>
                              {receiptId ? (
                                <input
                                  type="number"
                                  aria-label={'Số trả lại · ' + row.sku}
                                  min={Math.max(row.rejectedExcessQty, row.returnedQty)}
                                  max={row.wrongItemQty + row.damagedQty + row.rejectedExcessQty}
                                  required
                                  disabled={!row.canHandle || saving}
                                  value={draft.returned}
                                  onChange={(event) => setDrafts((previous) => ({
                                    ...previous,
                                    [row.id]: { ...draft, returned: event.target.value },
                                  }))}
                                />
                              ) : row.returnRequiredQty}
                            </label>
                            <label>
                              <span>Số giao bù</span>
                              {receiptId ? (
                                <input
                                  type="number"
                                  aria-label={'Số giao bù · ' + row.sku}
                                  min={0}
                                  max={replacementLimit(row)}
                                  required
                                  disabled={!row.canHandle || row.replacementDelivery || saving}
                                  value={replacementValue(row, draft)}
                                  onChange={(event) => setDrafts((previous) => ({
                                    ...previous,
                                    [row.id]: { ...draft, replacement: event.target.value },
                                  }))}
                                />
                              ) : row.replacementRequiredQty}
                            </label>
                          </div>
                        </td>
                        <td>
                          <div className="supplier-outstanding-list">
                            {remainingMetrics.length ? remainingMetrics.map(([label, quantity]) => (
                              <span key={label}><small>{label}</small><b>{quantity}</b></span>
                            )) : <small className="supplier-no-metrics">Đã xử lý đủ</small>}
                          </div>
                        </td>
                        <td>
                          <div className="mf-row-actions receiving-case-actions">
                            {/* Mục 13 (PM 19/11): còn phải giao bù thì có nút nhận hàng giao bù cho
                                phiếu này. Mở đơn nhập hàng, ở đó BM giao việc nhận hàng giao bù (hoặc
                                tự nhận) rồi lập phiếu nhập "Giao bù cho sai lệch". */}
                            {row.openReplacementQty > 0 && row.purchaseOrderId && (
                              row.canCreateReplacement ? (
                                <Link
                                  className="mf-btn mf-btn--sm mf-btn--primary"
                                  to={
                                    '/purchase-orders/' +
                                    row.purchaseOrderId +
                                    '?replacement=' +
                                    row.id
                                  }
                                >
                                  Nhập hàng giao bù
                                </Link>
                              ) : (
                                <button
                                  type="button"
                                  className="mf-btn mf-btn--sm mf-btn--primary"
                                  disabled
                                  title="BM thực hiện nhận hàng giao bù."
                                >
                                  Nhập hàng giao bù · BM
                                </button>
                              )
                            )}
                            {row.outstandingReturnQty > 0 && (
                              row.canRecordReturn ? (
                              <button
                                type="button"
                                className="mf-btn mf-btn--sm mf-btn--primary"
                                disabled={saving}
                                onClick={() =>
                                  setAction({ row, mode: 'return' })
                                }
                              >
                                Ghi nhận đã trả
                              </button>
                              ) : (
                                <button
                                  type="button"
                                  className="mf-btn mf-btn--sm mf-btn--primary"
                                  disabled
                                  title="BM ghi nhận hàng đã trả nhà cung cấp."
                                >
                                  Ghi nhận đã trả · BM
                                </button>
                              )
                            )}
                            {(scope.owner || row.canHandle) &&
                              (row.heldUndecidedQty ?? 0) > 0 && (
                              <Link
                                className="mf-btn mf-btn--sm mf-btn--secondary"
                                to={
                                  '/adjustments/new?goodsReceiptNoteId=' +
                                  row.goodsReceiptNoteId +
                                  '&productId=' +
                                  row.productId +
                                  '&quantity=' +
                                  row.heldUndecidedQty +
                                  '&storeId=' +
                                  (row.storeId ?? '')
                                }
                              >
                                Báo hủy
                              </Link>
                            )}
                            {row.openReplacementQty > 0 && (
                              row.canWaiveReplacement ? (
                              <button
                                type="button"
                                className="mf-btn mf-btn--sm mf-btn--secondary"
                                disabled={saving}
                                onClick={() =>
                                  setAction({ row, mode: 'waive' })
                                }
                              >
                                Không cần giao bù
                              </button>
                              ) : (
                                <button
                                  type="button"
                                  className="mf-btn mf-btn--sm mf-btn--secondary"
                                  disabled
                                  title="Owner quyết định bỏ giao bù."
                                >
                                  Không cần giao bù · Owner
                                </button>
                              )
                            )}
                            <button
                              type="button"
                              className="mf-btn mf-btn--sm mf-btn--secondary"
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
      {!receiptId && receiptGroups.length > receiptPageSize && (
        <div className="receiving-pagination">
          <button
            type="button"
            disabled={page === 0 || loading}
            onClick={() => setPage(page - 1)}
          >
            Trang trước
          </button>
          <span>
            Trang {page + 1} / {Math.ceil(receiptGroups.length / receiptPageSize)}
          </span>
          <button
            type="button"
            disabled={(page + 1) * receiptPageSize >= receiptGroups.length || loading}
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
