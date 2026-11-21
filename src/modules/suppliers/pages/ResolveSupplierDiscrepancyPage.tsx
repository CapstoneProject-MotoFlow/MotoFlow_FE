import PageBackLink from '../../../shared/ui/PageBackLink'
import { isAxiosError } from 'axios'
import { useInventoryScope } from '../../inventory/api'
import { useEffect, useRef, useState } from 'react'
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
import MoneyInput from '../../../shared/ui/MoneyInput'
import ProductPicker, { type ProductOption } from '../../receiving/ProductPicker'
type AcceptanceType = 'DAMAGED' | 'WRONG_ITEM'
type PendingRequest = {
  type: AcceptanceType
  productId: number | null
  sku: string | null
  partName: string | null
  quantity: number
  note: string | null
  requestedById: number
  requestedByName: string | null
  requestedAt: string
}
const acceptanceLabels: Record<AcceptanceType, string> = {
  DAMAGED: 'Hàng móp vẫn nhận',
  WRONG_ITEM: 'Hàng giao sai',
}
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
  /** BE #80: hàng hỏng / giao sai đang giữ, chưa quyết định. */
  damagedUndecidedQty?: number
  wrongUndecidedQty?: number
  canRequestAcceptance?: boolean
  canApproveAcceptance?: boolean
  pendingRequests?: PendingRequest[]
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

/** Loại còn hàng đang giữ chưa quyết định và chưa có đề nghị chờ duyệt (mỗi loại khóa riêng). */
function acceptanceOpenTypes(row: Case): AcceptanceType[] {
  const pending = new Set((row.pendingRequests ?? []).map((item) => item.type))
  const types: AcceptanceType[] = []
  if ((row.damagedUndecidedQty ?? 0) > 0 && !pending.has('DAMAGED'))
    types.push('DAMAGED')
  if ((row.wrongUndecidedQty ?? 0) > 0 && !pending.has('WRONG_ITEM'))
    types.push('WRONG_ITEM')
  return types
}

function PendingRequests({ requests }: { requests: PendingRequest[] }) {
  return (
    <ul className="supplier-pending-requests">
      {requests.map((request) => (
        <li key={request.type}>
          <strong>Đang chờ Owner duyệt</strong> ·{' '}
          {acceptanceLabels[request.type]} · {request.quantity}
          {request.sku && ' · thực nhận ' + request.sku}
          {request.requestedByName && ' · ' + request.requestedByName}
          {request.note && ' · ' + request.note}
        </li>
      ))}
    </ul>
  )
}

/**
 * NH7a/NH7b (GVHD 20/11, BE #80). request: BM đề nghị; damaged: Owner nhận hàng móp thành mã "<SKU>-M";
 * wrong: Owner nhận hàng giao sai thành phụ tùng thực nhận. Owner từ chối đề nghị đang chờ ngay trong hộp này.
 */
function AcceptanceAction({
  row,
  mode,
  onClose,
  onSaved,
}: {
  row: Case
  mode: 'request' | 'damaged' | 'wrong'
  onClose: () => void
  onSaved: (row: Case, message: string) => void
}) {
  const openTypes = acceptanceOpenTypes(row)
  const [type, setType] = useState<AcceptanceType>(
    mode === 'damaged'
      ? 'DAMAGED'
      : mode === 'wrong'
        ? 'WRONG_ITEM'
        : (openTypes[0] ?? 'DAMAGED'),
  )
  const pending = row.pendingRequests?.find((item) => item.type === type)
  const held =
    type === 'DAMAGED'
      ? (row.damagedUndecidedQty ?? 0)
      : (row.wrongUndecidedQty ?? 0)
  const [quantity, setQuantity] = useState(String(pending?.quantity ?? held))
  const [note, setNote] = useState('')
  const [unitCost, setUnitCost] = useState('')
  const [salePrice, setSalePrice] = useState('')
  const [product, setProduct] = useState<ProductOption | undefined>(
    pending?.productId && pending.sku
      ? {
          id: pending.productId,
          sku: pending.sku,
          partName: pending.partName ?? '',
        }
      : undefined,
  )
  const [replacementNeeded, setReplacementNeeded] = useState(true)
  const [lotNo, setLotNo] = useState('')
  const [manufactureDate, setManufactureDate] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const requesting = mode === 'request'

  function validQuantity() {
    const value = Number(quantity)
    return Number.isInteger(value) && value >= 1 && value <= held
  }

  async function post(path: string, body: object, message: string) {
    setSaving(true)
    setError('')
    try {
      const { data } = await axiosClient.post<Case>(
        '/discrepancy-cases/' + row.id + path,
        body,
      )
      onSaved(data, message)
    } catch (failure) {
      setError(errorMessage(failure))
    } finally {
      setSaving(false)
    }
  }

  function submit() {
    if (saving) return
    if (!validQuantity()) {
      setError(`Số lượng phải là số nguyên từ 1 đến ${held}.`)
      return
    }
    if (requesting) {
      void post(
        '/acceptance-requests',
        {
          type,
          productId: type === 'WRONG_ITEM' ? (product?.id ?? null) : null,
          quantity: Number(quantity),
          note: note.trim() || null,
        },
        'Đã gửi đề nghị. Owner sẽ được báo để duyệt.',
      )
      return
    }
    if (unitCost === '') {
      setError('Vui lòng nhập giá vốn.')
      return
    }
    if (mode === 'damaged') {
      if (!salePrice || Number(salePrice) <= 0) {
        setError('Vui lòng nhập giá bán hàng móp lớn hơn 0.')
        return
      }
      void post(
        '/damaged/accept-as-variant',
        {
          quantity: Number(quantity),
          unitCost: Number(unitCost),
          salePrice: Number(salePrice),
        },
        `Đã nhận ${quantity} hàng móp vào mã ${row.sku}-M.`,
      )
      return
    }
    if (!product) {
      setError('Vui lòng chọn phụ tùng thực nhận.')
      return
    }
    if (manufactureDate && expiryDate && manufactureDate > expiryDate) {
      setError('Hạn sử dụng phải sau ngày sản xuất.')
      return
    }
    void post(
      '/wrong-items/receive',
      {
        productId: product.id,
        quantity: Number(quantity),
        unitCost: Number(unitCost),
        replacementNeeded,
        manufacturerLotNo: lotNo.trim() || null,
        manufactureDate: manufactureDate || null,
        expiryDate: expiryDate || null,
      },
      `Đã nhận ${quantity} hàng giao sai thành ${product.sku}.`,
    )
  }

  const title = requesting
    ? 'Đề nghị Owner xử lý · ' + row.sku
    : mode === 'damaged'
      ? 'Nhận hàng móp · ' + row.sku
      : 'Nhận hàng giao sai · ' + row.sku
  return (
    <FormDialog
      title={title}
      formId="acceptance-action"
      submitLabel={requesting ? 'Gửi đề nghị' : 'Nhận vào kho'}
      busy={saving}
      onClose={onClose}
    >
      <form
        id="acceptance-action"
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
      >
        <div className="receiving-layout-fields">
          {requesting && (
            <fieldset className="receiving-layout-wide">
              <legend>Loại hàng</legend>
              {(['DAMAGED', 'WRONG_ITEM'] as const).map((value) => {
                const isPending = row.pendingRequests?.some(
                  (item) => item.type === value,
                )
                const available = openTypes.includes(value)
                return (
                  <label key={value}>
                    <input
                      type="radio"
                      name="acceptance-type"
                      checked={type === value}
                      disabled={!available || saving}
                      onChange={() => {
                        setType(value)
                        setQuantity(
                          String(
                            value === 'DAMAGED'
                              ? (row.damagedUndecidedQty ?? 0)
                              : (row.wrongUndecidedQty ?? 0),
                          ),
                        )
                      }}
                    />{' '}
                    {acceptanceLabels[value]}
                    {isPending && <small> · Đang chờ Owner duyệt</small>}
                  </label>
                )
              })}
            </fieldset>
          )}
          {!requesting && pending && (
            <section className="receiving-layout-wide supplier-request-block">
              <h3>Đề nghị của BM</h3>
              <p>
                {acceptanceLabels[pending.type]} · {pending.quantity}
                {pending.sku && ' · thực nhận ' + pending.sku}
                {pending.requestedByName && ' · ' + pending.requestedByName}
                {' · '}
                {formatDateTime(pending.requestedAt)}
              </p>
              {pending.note && <p>Ghi chú: {pending.note}</p>}
              <label>
                Lý do từ chối
                <textarea
                  value={rejectReason}
                  maxLength={255}
                  disabled={saving}
                  onChange={(event) => setRejectReason(event.target.value)}
                />
              </label>
              <button
                type="button"
                className="mf-btn mf-btn--sm mf-btn--secondary"
                disabled={saving || !rejectReason.trim()}
                onClick={() =>
                  void post(
                    '/acceptance-requests/reject',
                    { type, reason: rejectReason.trim() },
                    'Đã từ chối đề nghị. BM sẽ được báo.',
                  )
                }
              >
                Từ chối đề nghị
              </button>
            </section>
          )}
          <label>
            Số lượng (đang giữ {held})
            <input
              type="number"
              min={1}
              max={held}
              required
              value={quantity}
              disabled={saving}
              onChange={(event) => setQuantity(event.target.value)}
            />
          </label>
          {type === 'WRONG_ITEM' && (
            <div className="receiving-layout-wide">
              <ProductPicker
                label={requesting ? 'Phụ tùng thực nhận (nếu biết)' : 'Phụ tùng thực nhận'}
                selected={product}
                excludedIds={[row.productId]}
                excludeDamagedVariants
                disabled={saving}
                onSelect={setProduct}
              />
            </div>
          )}
          {!requesting && (
            <label>
              Giá vốn
              <MoneyInput
                value={unitCost}
                required
                disabled={saving}
                onValueChange={setUnitCost}
              />
            </label>
          )}
          {mode === 'damaged' && (
            <>
              <label>
                Giá bán
                <MoneyInput
                  value={salePrice}
                  required
                  disabled={saving}
                  onValueChange={setSalePrice}
                />
              </label>
              <p className="receiving-layout-wide supplier-variant-note">
                Sẽ tạo/dùng mã <strong>{row.sku}-M</strong> (hàng móp), để ở Khu
                hàng lỗi.
              </p>
            </>
          )}
          {mode === 'wrong' && (
            <>
              <label>
                Số lô
                <input
                  value={lotNo}
                  maxLength={50}
                  disabled={saving}
                  onChange={(event) => setLotNo(event.target.value)}
                />
              </label>
              <label>
                Ngày sản xuất
                <input
                  type="date"
                  value={manufactureDate}
                  max={expiryDate || undefined}
                  disabled={saving}
                  onChange={(event) => setManufactureDate(event.target.value)}
                />
              </label>
              <label>
                Hạn sử dụng
                <input
                  type="date"
                  value={expiryDate}
                  min={manufactureDate || undefined}
                  disabled={saving}
                  onChange={(event) => setExpiryDate(event.target.value)}
                />
              </label>
              <label className="receiving-layout-wide">
                <input
                  type="checkbox"
                  checked={replacementNeeded}
                  disabled={saving}
                  onChange={(event) =>
                    setReplacementNeeded(event.target.checked)
                  }
                />{' '}
                Cần nhà cung cấp giao bù phụ tùng đã đặt
              </label>
            </>
          )}
          {requesting && (
            <label className="receiving-layout-wide">
              Ghi chú
              <textarea
                value={note}
                maxLength={255}
                disabled={saving}
                onChange={(event) => setNote(event.target.value)}
              />
            </label>
          )}
        </div>
        {error && <p role="alert">{error}</p>}
      </form>
    </FormDialog>
  )
}

export default function ResolveSupplierDiscrepancyPage() {
  const [params, setParams] = useSearchParams()
  const receiptId = params.get('receipt') ?? ''
  const purchaseOrder = params.get('purchaseOrder') ?? ''
  return (
    <DiscrepancyForm
      key={receiptId}
      receiptId={receiptId}
      initialPurchaseOrder={purchaseOrder}
      onOpenReceipt={(receipt) => setParams(receipt ? { receipt } : {})}
    />
  )
}

const listPageSize = 20

function DiscrepancyForm({
  receiptId,
  initialPurchaseOrder,
  onOpenReceipt,
}: {
  receiptId: string
  initialPurchaseOrder: string
  onOpenReceipt: (receipt: string) => void
}) {
  const scope = useInventoryScope()
  const [status, setStatus] = useState('OPEN'),
    [purchaseOrderQuery, setPurchaseOrderQuery] = useState(() =>
      /^[1-9]\d*$/.test(initialPurchaseOrder)
        ? documentCode('DNH', Number(initialPurchaseOrder))
        : '',
    ),
    [supplierId, setSupplierId] = useState(''),
    [productQuery, setProductQuery] = useState(''),
    [fromDate, setFromDate] = useState(''),
    [toDate, setToDate] = useState('')
  const [suppliers, setSuppliers] = useState<
    { id: number; supplierName: string }[]
  >([])
  const [rows, setRows] = useState<Case[]>([])
  const [acceptance, setAcceptance] = useState<{
    row: Case
    mode: 'request' | 'damaged' | 'wrong'
  }>()
  const [drafts, setDrafts] = useState<Record<number, HandlingDraft>>({})
  const purchaseOrderId = purchaseOrderSearch(purchaseOrderQuery)
  const invalidOrder = !!purchaseOrderId && !/^[1-9]\d*$/.test(purchaseOrderId)
  const valid = !receiptId || /^[1-9]\d*$/.test(receiptId)
  const dateRangeError = !!fromDate && !!toDate && fromDate > toDate
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
    if (!valid || invalidOrder || (!receiptId && dateRangeError)) return
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
          // NH3b + R-10: một trang, lọc ở BE (#78: supplierId, q, deliveredFrom/To), không tải hết rồi lọc ở FE.
          const { data } = await axiosClient.get<{
            items: Case[]
            totalItems: number
          }>('/discrepancy-cases', {
            params: {
              status: status || undefined,
              storeId: scope.storeId || undefined,
              purchaseOrderId: purchaseOrderId || undefined,
              supplierId: supplierId || undefined,
              q: productQuery.trim() || undefined,
              deliveredFrom: fromDate || undefined,
              deliveredTo: toDate || undefined,
              page,
              size: listPageSize,
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
  }, [receiptId, valid, page, status, scope.storeId, purchaseOrderId, invalidOrder, supplierId, productQuery, fromDate, toDate, dateRangeError])

  // Danh sách NCC cho bộ lọc: Owner đọc danh mục NCC; BM không có quyền đó nên lấy từ đơn nhập hàng của kho mình.
  useEffect(() => {
    if (receiptId) return
    const controller = new AbortController()
    const request = scope.owner
      ? axiosClient.get<{ items: { id: number; supplierName: string }[] }>(
          '/suppliers',
          { params: { page: 0, size: 100 }, signal: controller.signal },
        )
      : axiosClient.get<{
          items: { supplierId: number; supplierName: string }[]
        }>('/purchase-orders', {
          params: { view: 'ALL', page: 0, size: 100 },
          signal: controller.signal,
        })
    void request
      .then(({ data }) => {
        if (controller.signal.aborted) return
        const items = new Map<number, { id: number; supplierName: string }>()
        for (const row of data.items as Array<
          { id?: number; supplierId?: number; supplierName: string }
        >) {
          const id = row.supplierId ?? row.id
          if (id != null) items.set(id, { id, supplierName: row.supplierName })
        }
        setSuppliers(
          [...items.values()].sort((a, b) =>
            a.supplierName.localeCompare(b.supplierName, 'vi'),
          ),
        )
      })
      .catch(() => {
        if (!controller.signal.aborted) setSuppliers([])
      })
    return () => controller.abort()
  }, [receiptId, scope.owner])

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
            <select
              value={supplierId}
              onChange={(event) => {
                setSupplierId(event.target.value)
                setPage(0)
              }}
            >
              <option value="">Mọi nhà cung cấp</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.supplierName}
                </option>
              ))}
            </select>
          </label>
          <label>
            Phụ tùng
            <input
              value={productQuery}
              placeholder="Tên hoặc SKU"
              onChange={(event) => {
                setProductQuery(event.target.value)
                setPage(0)
              }}
            />
          </label>
          <label>
            Giao từ ngày
            <input
              type="date"
              value={fromDate}
              max={toDate || undefined}
              onChange={(event) => {
                setFromDate(event.target.value)
                setPage(0)
              }}
            />
          </label>
          <label>
            Đến ngày
            <input
              type="date"
              value={toDate}
              min={fromDate || undefined}
              onChange={(event) => {
                setToDate(event.target.value)
                setPage(0)
              }}
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
      {!receiptId && dateRangeError && (
        <p role="alert">Ngày kết thúc phải từ ngày bắt đầu trở đi.</p>
      )}
      {!receiptId && !loading && rows.length > 0 && (
        <section className="receiving-panel">
          {/* NH3b: màn này dùng khi tìm theo phụ tùng; xem theo PO ở tab "Sai lệch" của danh sách đơn nhập hàng. */}
          <p className="supplier-list-hint">
            Danh sách theo phụ tùng. Xem theo đơn nhập hàng ở{' '}
            <Link to="/purchase-orders?tab=DISCREPANCY_OPEN">
              tab Sai lệch của Đơn nhập hàng
            </Link>
            .
          </p>
          <div className="table-scroll">
            <table className="supplier-receipt-groups">
              <thead>
                <tr>
                  <th>Phụ tùng</th>
                  <th>Phiếu nhập / Đơn nhập hàng</th>
                  <th>Nhà cung cấp</th>
                  <th>Cửa hàng</th>
                  <th>Mở lúc</th>
                  <th>Thiếu / Sai / Hỏng</th>
                  <th>Trạng thái</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <strong>{row.sku}</strong>
                      <small>{row.partName}</small>
                    </td>
                    <td>
                      {documentCode('PN', row.goodsReceiptNoteId)}
                      {row.purchaseOrderId && (
                        <small>
                          <Link to={'/purchase-orders/' + row.purchaseOrderId}>
                            {documentCode('DNH', row.purchaseOrderId)}
                          </Link>
                        </small>
                      )}
                    </td>
                    <td>{row.supplierName ?? '—'}</td>
                    <td>{row.storeName ?? '—'}</td>
                    <td className="mf-nowrap">
                      {row.openedAt ? formatDateTime(row.openedAt) : '—'}
                    </td>
                    <td className="mf-nowrap">
                      {row.shortQty} / {row.wrongItemQty} / {row.damagedQty}
                    </td>
                    <td>
                      {row.status === 'OPEN' ? 'Đang mở' : 'Đã đóng'}
                      {!!row.pendingRequests?.length && (
                        <small className="supplier-pending-badge">
                          Đang chờ Owner duyệt
                        </small>
                      )}
                    </td>
                    <td>
                      <Link
                        className="mf-btn mf-btn--sm mf-btn--secondary"
                        to={
                          '/supplier-discrepancies?receipt=' +
                          row.goodsReceiptNoteId
                        }
                      >
                        Xử lý
                      </Link>
                    </td>
                  </tr>
                ))}
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
                    const initialMetrics = ([
                      ['Thiếu', row.shortQty],
                      ['Giao sai', row.wrongItemQty],
                      ['Hỏng', row.damagedQty],
                      ['Thừa từ chối', row.rejectedExcessQty],
                    ] as Array<[string, number]>).filter(([, quantity]) => quantity > 0)
                    const processedMetrics = ([
                      ['Giao bù', row.replacedQty ?? eventTotal('REPLACEMENT_RECEIVED')],
                      ['Bỏ giao bù', row.waivedQty ?? eventTotal('REPLACEMENT_WAIVED')],
                      ['Đã trả', row.returnedQty],
                      ['Đã hủy', row.writtenOffQty ?? eventTotal('WRITE_OFF') + eventTotal('APPROVED_LOSS')],
                      ['Đang giữ', row.heldUndecidedQty ?? row.outstandingReturnQty],
                    ] as Array<[string, number]>).filter(([, quantity]) => quantity > 0)
                    const remainingMetrics = ([
                      ['Còn phải trả', row.outstandingReturnQty],
                      ['Còn phải giao bù', row.outstandingReplacementQty],
                    ] as Array<[string, number]>).filter(([, quantity]) => quantity > 0)
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
                            {/* NH7a: BM đề nghị Owner xử lý hàng hỏng / giao sai đang giữ (BE #80). */}
                            {row.canRequestAcceptance &&
                              !row.canApproveAcceptance &&
                              acceptanceOpenTypes(row).length > 0 && (
                                <button
                                  type="button"
                                  className="mf-btn mf-btn--sm mf-btn--secondary"
                                  disabled={saving}
                                  onClick={() =>
                                    setAcceptance({ row, mode: 'request' })
                                  }
                                >
                                  Đề nghị Owner xử lý
                                </button>
                              )}
                            {/* NH7b: Owner duyệt (có hoặc không có đề nghị). */}
                            {row.canApproveAcceptance &&
                              (row.damagedUndecidedQty ?? 0) > 0 && (
                                <button
                                  type="button"
                                  className="mf-btn mf-btn--sm mf-btn--primary"
                                  disabled={saving}
                                  onClick={() =>
                                    setAcceptance({ row, mode: 'damaged' })
                                  }
                                >
                                  Nhận hàng móp
                                </button>
                              )}
                            {row.canApproveAcceptance &&
                              (row.wrongUndecidedQty ?? 0) > 0 && (
                                <button
                                  type="button"
                                  className="mf-btn mf-btn--sm mf-btn--primary"
                                  disabled={saving}
                                  onClick={() =>
                                    setAcceptance({ row, mode: 'wrong' })
                                  }
                                >
                                  Nhận hàng giao sai
                                </button>
                              )}
                            {!row.canApproveAcceptance &&
                              !row.canRequestAcceptance &&
                              ((row.damagedUndecidedQty ?? 0) > 0 ||
                                (row.wrongUndecidedQty ?? 0) > 0) && (
                                <button
                                  type="button"
                                  className="mf-btn mf-btn--sm mf-btn--secondary"
                                  disabled
                                  title="BM đề nghị, Owner duyệt nhận hàng móp / hàng giao sai."
                                >
                                  Nhận hàng móp / giao sai · Owner
                                </button>
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
                            {!!row.pendingRequests?.length && (
                              <PendingRequests requests={row.pendingRequests} />
                            )}
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
      {!receiptId && total > listPageSize && (
        <div className="receiving-pagination">
          <button
            type="button"
            disabled={page === 0 || loading}
            onClick={() => setPage(page - 1)}
          >
            Trang trước
          </button>
          <span>
            Trang {page + 1} / {Math.ceil(total / listPageSize)}
          </span>
          <button
            type="button"
            disabled={(page + 1) * listPageSize >= total || loading}
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
      {acceptance && (
        <AcceptanceAction
          key={acceptance.row.id + acceptance.mode}
          row={acceptance.row}
          mode={acceptance.mode}
          onClose={() => setAcceptance(undefined)}
          onSaved={(row, message) => {
            setRows((previous) =>
              previous.map((item) => (item.id === row.id ? row : item)),
            )
            setAcceptance(undefined)
            setNotice(message)
          }}
        />
      )}
    </main>
  )
}
