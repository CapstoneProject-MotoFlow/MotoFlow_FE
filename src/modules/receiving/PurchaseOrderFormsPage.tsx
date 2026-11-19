import PageBackLink from '../../shared/ui/PageBackLink'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import Hint from '../../shared/ui/Hint'
import FieldError from '../../shared/ui/FieldError'
import { formatDateTime } from '../../shared/utils/format'
import ConfirmDialog from '../../shared/ui/ConfirmDialog'
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import axiosClient from '../../shared/api/axiosClient'
import { useAuth } from '../../shared/hooks/useAuth'
import type { DashboardStore } from '../../shared/types/store'
import type { Supplier } from '../suppliers/types'
import { apiMessage } from '../suppliers/supplierService'
import { isAxiosError } from 'axios'
import ProductPicker, { type ProductOption } from './ProductPicker'
import MoneyInput from '../../shared/ui/MoneyInput'
import DeliveryDocumentFields from './DeliveryDocumentFields'
import {
  receiptDocumentUploadEnabled,
  useDeliveryDocuments,
} from './useDeliveryDocuments'
import { inventoryError } from '../inventory/api'
import { refreshNotifications } from '../notifications/notificationService'
import { documentCode } from '../../shared/utils/documentCode'
import { useFormValidation } from '../../shared/hooks/useFormValidation'
import './receiving.css'

function Panel({
  title,
  children,
  action,
}: {
  title: string
  children: ReactNode
  action?: ReactNode
}) {
  return (
    <section className="receiving-panel">
      <header className="receiving-panel-head">
        <h2>{title}</h2>
        {action}
      </header>
      {children}
    </section>
  )
}

function ActionBar({ children }: { children: ReactNode }) {
  return <div className="receiving-layout-actions">{children}</div>
}

type DraftLine = {
  id: number
  productId: string
  quantity: string
  price: string
}
type EditableOrder = {
  id: number
  supplierId: number
  supplierName: string
  storeName: string
  expectedArrival: string | null
  note: string | null
  canUpdate: boolean
  lines: {
    id: number
    productId: number
    sku: string
    partName: string
    orderedQty: number
    purchasePrice: number
  }[]
}

function EditOrder({ id }: { id: string }) {
  const [order, setOrder] = useState<EditableOrder>()
  const [error, setError] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    const signal = controller.signal
    void axiosClient
      .get<EditableOrder>('/purchase-orders/' + id, { signal })
      .then(({ data }) => {
        if (!signal.aborted) setOrder(data)
      })
      .catch((error) => {
        if (!signal.aborted) setError(apiMessage(error))
      })
    return () => controller.abort()
  }, [id])
  if (error) return <p role="alert">{error}</p>
  if (!order) return <p role="status">Đang tải đơn nhập hàng…</p>
  return order.canUpdate ? (
    <OrderFormLayout editing order={order} />
  ) : (
    <p role="alert">Đơn này không còn được phép sửa.</p>
  )
}

async function loadActiveOptions<T>(path: string, signal: AbortSignal) {
  const options: T[] = []
  for (let page = 0; ; page++) {
    const { data } = await axiosClient.get<{ items: T[]; totalItems: number }>(
      path,
      {
        params: { status: 'ACTIVE', page, size: 100 },
        signal,
      },
    )
    options.push(...data.items)
    if (!data.items.length || options.length >= data.totalItems) return options
  }
}

/** Điền sẵn từ màn Tồn kho: Owner tích các phụ tùng sắp hết rồi bấm "Tạo đơn nhập hàng". */
export type PurchasePrefill = {
  storeId?: number
  lines: { productId: number; sku: string; partName: string; qty: number }[]
}
/**
 * GET /purchase-orders/drafts/{id} (Mạnh, việc D1 17/11): nháp lưu trên server, chỉ người tạo mở được.
 * Ô chưa nhập lúc lưu nháp là null. Gửi nháp (POST …/submit) thành đơn thật, giữ nguyên id.
 */
export type PurchaseOrderDraft = {
  id: number
  status: string
  supplierId: number | null
  storeId: number | null
  expectedArrival: string | null
  note: string | null
  createdAt?: string | null
  updatedAt?: string | null
  lines: {
    id: number
    productId: number
    sku: string
    partName: string
    orderedQty: number | null
    purchasePrice: number | null
  }[]
}
const purchaseDraftsPath = '/purchase-orders?tab=DRAFT'

/** GET /purchase-orders/last-prices (Mạnh, việc B2 17/11): phụ tùng chưa từng nhập từ NCC này thì không có dòng. */
type LastPurchasePrice = {
  productId: number
  lastPrice: number
  receivedAt?: string | null
  purchaseOrderId?: number | null
}

const orderMoney = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
})

function OrderFormLayout({
  editing,
  order,
  savedDraft,
}: {
  editing: boolean
  order?: EditableOrder
  /** Nháp mở lại từ tab "Nháp" (PM 17/11: nháp lưu trên server, không lưu trên trình duyệt). */
  savedDraft?: PurchaseOrderDraft
}) {
  const { user } = useAuth()
  const owner = user?.role === 'OWNER'
  const navigate = useNavigate()
  const location = useLocation()
  const source = order ?? savedDraft
  const prefill = source
    ? undefined
    : (location.state as { prefill?: PurchasePrefill } | null)?.prefill
  const draftCode = savedDraft ? documentCode('DNH', savedDraft.id) : ''
  const [supplierId, setSupplierId] = useState(
    savedDraft?.supplierId ? String(savedDraft.supplierId) : '',
  )
  const [storeId, setStoreId] = useState(
    prefill?.storeId
      ? String(prefill.storeId)
      : savedDraft?.storeId
        ? String(savedDraft.storeId)
        : '',
  )
  const savedAt = savedDraft?.updatedAt ?? savedDraft?.createdAt
  const draftNotice = savedDraft
    ? 'Đang mở nháp ' +
      draftCode +
      (savedAt ? ', lưu lúc ' + formatDateTime(savedAt) : '') +
      '. Bấm "Tạo đơn nhập hàng" để gửi nháp thành đơn.'
    : prefill
      ? 'Đã điền sẵn ' +
        prefill.lines.length +
        ' phụ tùng chọn từ màn Tồn kho. Chọn nhà cung cấp và nhập giá nhập.'
      : ''
  const [confirmDelete, setConfirmDelete] = useState(false)
  // Dùng dữ liệu điền sẵn một lần; tải lại trang thì không ghi đè bản nháp người dùng đã lưu.
  useEffect(() => {
    if (prefill)
      navigate(location.pathname + location.search, {
        replace: true,
        state: null,
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const formRef = useRef<HTMLFormElement>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [options, setOptions] = useState<{
    suppliers: Supplier[]
    stores: DashboardStore[]
    errors: string[]
  }>()
  const [draft, setDraft] = useState(() =>
    prefill?.lines.length
      ? {
          nextId: prefill.lines.length + 1,
          lines: prefill.lines.map((line, index) => ({
            id: index + 1,
            productId: String(line.productId),
            quantity: String(line.qty),
            price: '',
          })),
        }
      : source?.lines.length
        ? {
            nextId: Math.max(0, ...source.lines.map((line) => line.id)) + 1,
            lines: source.lines.map((line) => ({
              id: line.id,
              productId: String(line.productId),
              quantity: line.orderedQty == null ? '' : String(line.orderedQty),
              price:
                line.purchasePrice == null ? '' : String(line.purchasePrice),
            })),
          }
        : {
            nextId: 2,
            lines: [
              { id: 1, productId: '', quantity: '', price: '' },
            ] as DraftLine[],
          },
  )
  useEffect(() => {
    if (!owner) return
    const controller = new AbortController()
    const signal = controller.signal
    void Promise.allSettled([
      loadActiveOptions<Supplier>('/suppliers', signal),
      axiosClient.get<DashboardStore[]>('/stores', {
        params: { status: 'ACTIVE' },
        signal,
      }),
    ]).then(([suppliers, stores]) => {
      if (signal.aborted) return
      const errors = []
      if (suppliers.status === 'rejected') errors.push('nhà cung cấp')
      if (stores.status === 'rejected') errors.push('kho nhận')
      setOptions({
        suppliers: suppliers.status === 'fulfilled' ? suppliers.value : [],
        stores: stores.status === 'fulfilled' ? stores.value.data : [],
        errors,
      })
    })
    return () => controller.abort()
  }, [owner])
  const totalQuantity = draft.lines.reduce(
    (total, line) => total + Number(line.quantity),
    0,
  )
  const totalValue = draft.lines.reduce(
    (total, line) => total + Number(line.quantity) * Number(line.price),
    0,
  )
  // Giá nhập lần trước: giá trên phiếu nhập đã xác nhận gần nhất của cùng nhà cung cấp (PM 17/11).
  // BE chưa có API hoặc lỗi thì cột hiện "—"; kết quả gắn với NCC đã hỏi để đổi NCC không hiện giá cũ.
  const priceSupplierId = order ? String(order.supplierId ?? '') : supplierId
  const pricedProductIds = Array.from(
    new Set(draft.lines.map((line) => line.productId).filter(Boolean)),
  )
    .sort()
    .join(',')
  const [lastPriceResult, setLastPriceResult] = useState<{
    supplierId: string
    prices: Record<number, number>
  }>()
  useEffect(() => {
    if (!owner || !priceSupplierId || !pricedProductIds) return
    const controller = new AbortController()
    void axiosClient
      .get<LastPurchasePrice[]>('/purchase-orders/last-prices', {
        params: { supplierId: priceSupplierId, productIds: pricedProductIds },
        signal: controller.signal,
      })
      .then(({ data }) => {
        if (controller.signal.aborted) return
        setLastPriceResult({
          supplierId: priceSupplierId,
          prices: Object.fromEntries(
            data.map((item) => [item.productId, item.lastPrice]),
          ),
        })
      })
      .catch(() => {
        if (!controller.signal.aborted) setLastPriceResult(undefined)
      })
    return () => controller.abort()
  }, [owner, priceSupplierId, pricedProductIds])
  const lastPrices: Record<number, number> =
    lastPriceResult?.supplierId === priceSupplierId
      ? lastPriceResult.prices
      : {}
  const back = order
    ? '/purchase-orders/' + order.id
    : savedDraft
      ? purchaseDraftsPath
      : '/purchase-orders'
  const [selectedProducts, setSelectedProducts] = useState<
    Record<number, ProductOption>
  >(() =>
    Object.fromEntries(
      [...(source?.lines ?? []), ...(prefill?.lines ?? [])].map((line) => [
        line.productId,
        { id: line.productId, sku: line.sku, partName: line.partName },
      ]),
    ),
  )
  /**
   * Lưu nháp lên server (PM 17/11): POST /purchase-orders/drafts, hoặc PUT …/drafts/{id} khi đang mở nháp.
   * Ô chưa nhập gửi null; BE kiểm nội dung nháp (việc D1). Lưu xong về tab "Nháp" của danh sách.
   */
  async function saveDraft() {
    if (!owner || saving || !formRef.current) return
    const fields = new FormData(formRef.current)
    const payload = {
      supplierId: Number(fields.get('supplierId')) || null,
      storeId: Number(fields.get('storeId')) || null,
      expectedArrival: fields.get('expectedArrival') || null,
      note: String(fields.get('note') ?? '').trim() || null,
      lines: draft.lines
        .filter((line) => line.productId)
        .map((line) => ({
          productId: Number(line.productId),
          quantity: line.quantity === '' ? null : Number(line.quantity),
          purchasePrice: line.price === '' ? null : Number(line.price),
        })),
    }
    setSaveError('')
    setSaving(true)
    try {
      const { data } = savedDraft
        ? await axiosClient.put<{ id: number }>(
            '/purchase-orders/drafts/' + savedDraft.id,
            payload,
          )
        : await axiosClient.post<{ id: number }>(
            '/purchase-orders/drafts',
            payload,
          )
      navigate(purchaseDraftsPath, {
        state: { notice: 'Đã lưu nháp ' + documentCode('DNH', data.id) + '.' },
      })
    } catch (error) {
      setSaveError(apiMessage(error))
      setSaving(false)
    }
  }
  async function deleteDraft() {
    if (!savedDraft || saving) return
    setSaveError('')
    setSaving(true)
    try {
      await axiosClient.delete('/purchase-orders/drafts/' + savedDraft.id)
      navigate(purchaseDraftsPath, {
        state: { notice: 'Đã xóa nháp ' + draftCode + '.' },
      })
    } catch (error) {
      setSaveError(apiMessage(error))
      setSaving(false)
    }
  }
  async function createOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!owner || (editing && !order?.canUpdate) || saving) return
    const fields = new FormData(event.currentTarget)
    const supplierId = Number(fields.get('supplierId'))
    const storeId = Number(fields.get('storeId'))
    const lines = draft.lines.map((line) => ({
      productId: Number(line.productId),
      quantity: Number(line.quantity),
      purchasePrice: Number(line.price),
    }))
    if (
      (!order && (!supplierId || !storeId)) ||
      !lines.length ||
      lines.some(
        (line) =>
          !line.productId ||
          !Number.isInteger(line.quantity) ||
          line.quantity < 1 ||
          line.quantity > 1_000_000 ||
          !Number.isInteger(line.purchasePrice) ||
          line.purchasePrice < 1 ||
          line.purchasePrice > 10_000_000_000,
      )
    ) {
      setSaveError(
        'Chọn nhà cung cấp, kho nhận và phụ tùng. Mỗi dòng cần số lượng và giá nhập nguyên dương hợp lệ.',
      )
      return
    }
    setSaveError('')
    setSaving(true)
    try {
      const payload = {
        expectedArrival: fields.get('expectedArrival') || null,
        note: String(fields.get('note') ?? '').trim() || null,
        lines,
      }
      const { data } = order
        ? await axiosClient.put<{ id: number }>(
            '/purchase-orders/' + order.id,
            {
              ...payload,
              reason: String(fields.get('reason') ?? '').trim(),
            },
          )
        : savedDraft
          ? // Gửi nháp: BE kiểm như tạo đơn, đổi nháp thành đơn thật và giữ nguyên id (PM 17/11).
            await axiosClient.post<{ id: number }>(
              '/purchase-orders/drafts/' + savedDraft.id + '/submit',
              { ...payload, supplierId, storeId },
            )
          : await axiosClient.post<{ id: number }>('/purchase-orders', {
              ...payload,
              supplierId,
              storeId,
            })
      navigate('/purchase-orders/' + data.id)
    } catch (error) {
      setSaveError(apiMessage(error))
    } finally {
      setSaving(false)
    }
  }

  function updateLine(
    id: number,
    field: 'productId' | 'quantity' | 'price',
    value: string,
  ) {
    setDraft((previous) => ({
      ...previous,
      lines: previous.lines.map((line) =>
        line.id === id ? { ...line, [field]: value } : line,
      ),
    }))
  }

  return (
    <form
      ref={formRef}
      className="receiving-stack receiving-order-form"
      onSubmit={createOrder}
    >
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
      {owner && !options && <p role="status">Đang tải danh sách lựa chọn…</p>}
      {!!options?.errors.length && (
        <p role="alert">
          Không tải được danh sách {options.errors.join(', ')}.
        </p>
      )}
      <div className="receiving-split receiving-order-top">
        <Panel title="Thông tin chung">
          <div className="receiving-layout-fields receiving-order-fields">
            <label>
              <span>
                Nhà cung cấp <span className="receiving-required">*</span>
              </span>
              <select
                name="supplierId"
                value={supplierId}
                onChange={(event) => setSupplierId(event.target.value)}
                disabled={!!order || !owner || !options?.suppliers.length}
                required
              >
                <option value="">
                  {order?.supplierName ?? 'Chọn nhà cung cấp'}
                </option>
                {options?.suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.supplierName}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>
                Kho nhận <span className="receiving-required">*</span>
              </span>
              <select
                name="storeId"
                value={storeId}
                onChange={(event) => setStoreId(event.target.value)}
                disabled={!!order || !owner || !options?.stores.length}
                required
              >
                <option value="">{order?.storeName ?? 'Chọn kho nhận'}</option>
                {options?.stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.storeName}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Ngày giao dự kiến{' '}
              <input
                type="date"
                name="expectedArrival"
                defaultValue={source?.expectedArrival ?? ''}
              />
            </label>
            <label className="receiving-layout-wide">
              Ghi chú
              <textarea
                name="note"
                defaultValue={source?.note ?? ''}
                rows={2}
                maxLength={500}
                placeholder="Ví dụ: Nhà cung cấp giao bằng xe biển số 30A-12345, người giao hàng liên hệ qua số 0123456789."
              />
            </label>
            {editing && (
              <label className="receiving-layout-wide">
                Lý do sửa{' '}
                <textarea name="reason" required rows={2} maxLength={255} />
              </label>
            )}
          </div>
        </Panel>
        <aside className="receiving-panel receiving-order-summary">
          <h2>Tóm tắt</h2>
          <dl>
            <div>
              <dt>Số phụ tùng</dt>
              <dd>{draft.lines.length}</dd>
            </div>
            <div>
              <dt>Tổng số lượng</dt>
              <dd>{totalQuantity}</dd>
            </div>
            <div className="receiving-order-total">
              <dt>Tổng giá trị</dt>
              <dd>{orderMoney.format(totalValue)}</dd>
            </div>
          </dl>
          {saveError && <p role="alert">{saveError}</p>}
          <button
            className="receiving-layout-primary"
            type="submit"
            disabled={
              !owner ||
              (editing && !order?.canUpdate) ||
              saving ||
              !draft.lines.length ||
              (!order && (!options?.suppliers.length || !options.stores.length))
            }
          >
            {editing
              ? 'Lưu thay đổi'
              : saving
                ? 'Đang tạo đơn…'
                : 'Tạo đơn nhập hàng'}
          </button>
          {!editing && (
            <button
              type="button"
              className="mf-btn mf-btn--secondary receiving-order-draft"
              disabled={!owner || saving}
              onClick={() => void saveDraft()}
            >
              Lưu nháp
            </button>
          )}
          {savedDraft && (
            <button
              type="button"
              className="mf-btn mf-btn--link receiving-order-draft"
              disabled={!owner || saving}
              onClick={() => setConfirmDelete(true)}
            >
              Xóa nháp
            </button>
          )}
          <div className="receiving-order-cancel">
            <Link to={back}>
              {editing
                ? 'Hủy thay đổi'
                : savedDraft
                  ? 'Quay lại danh sách nháp'
                  : 'Quay lại danh sách'}
            </Link>
          </div>
        </aside>
      </div>
      <Panel title="Phụ tùng nhập">
        <div className="table-scroll receiving-order-lines-scroll">
          <table className="receiving-order-lines">
            <thead>
              <tr>
                <th scope="col">Phụ tùng</th>
                <th scope="col">Số lượng</th>
                <th scope="col">Giá nhập lần trước</th>
                <th scope="col">Giá nhập (₫)</th>
                <th scope="col">Thành tiền</th>
                <th scope="col" aria-label="Thao tác" />
              </tr>
            </thead>
            <tbody>
              {draft.lines.map((line, index) => (
                <tr key={line.id}>
                  <td>
                    <ProductPicker
                      label={'Phụ tùng dòng ' + (index + 1)}
                      disabled={!owner || saving}
                      selected={selectedProducts[Number(line.productId)]}
                      excludedIds={draft.lines
                        .filter((item) => item.id !== line.id)
                        .map((item) => Number(item.productId))}
                      onSelect={(product) => {
                        setSelectedProducts((previous) => ({
                          ...previous,
                          [product.id]: product,
                        }))
                        updateLine(line.id, 'productId', String(product.id))
                      }}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min={1}
                      max={1000000}
                      required
                      aria-label={'Số lượng dòng ' + (index + 1)}
                      value={line.quantity}
                      onChange={(event) =>
                        updateLine(line.id, 'quantity', event.target.value)
                      }
                    />
                  </td>
                  <td>
                    {lastPrices[Number(line.productId)] === undefined
                      ? '—'
                      : orderMoney.format(lastPrices[Number(line.productId)])}
                  </td>
                  <td>
                    <MoneyInput
                      required
                      aria-label={'Giá nhập dòng ' + (index + 1)}
                      value={line.price}
                      onValueChange={(digits) =>
                        updateLine(line.id, 'price', digits)
                      }
                    />
                  </td>
                  <td>
                    {line.quantity && line.price
                      ? orderMoney.format(
                          Number(line.quantity) * Number(line.price),
                        )
                      : '—'}
                  </td>
                  <td>
                    <button
                      type="button"
                      aria-label={'Bỏ dòng ' + (index + 1)}
                      onClick={() =>
                        setDraft((previous) => ({
                          ...previous,
                          lines: previous.lines.filter(
                            (item) => item.id !== line.id,
                          ),
                        }))
                      }
                    >
                      Bỏ
                    </button>
                  </td>
                </tr>
              ))}
              {!draft.lines.length && (
                <tr>
                  <td className="receiving-empty-cell" colSpan={6}>
                    Chưa có phụ tùng trong đơn.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="receiving-order-line-actions">
          <button
            type="button"
            onClick={() =>
              setDraft((previous) => ({
                nextId: previous.nextId + 1,
                lines: [
                  ...previous.lines,
                  {
                    id: previous.nextId,
                    productId: '',
                    quantity: '',
                    price: '',
                  },
                ],
              }))
            }
          >
            ＋ Thêm phụ tùng
          </button>
        </div>
      </Panel>
    </form>
  )
}
/** GET /purchase-orders/{id}/receiving-view: thông tin PO cho người nhận hàng, không có giá. */
type ReplacementCase = {
  productId: number
  sku: string
  partName: string
  openReplacementQty: number
}

type ReceivingView = {
  supplierName: string
  storeName: string
  expectedArrival?: string | null
  canCreateReceipt: boolean
  canCreateReplacement: boolean
  lines?: {
    productId: number
    sku: string
    partName: string
    baseUnit?: string | null
    orderedQty: number
    remainingQty?: number | null
    outstandingQty?: number | null
  }[]
  openCases?: (ReplacementCase & { caseId: number })[]
  discrepancies?: (ReplacementCase & { id: number })[]
}

function ReceiptFormLayout({ orderId }: { orderId: string | null }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [order, setOrder] = useState<ReceivingView>()
  const [loadError, setLoadError] = useState('')
  const [error, setError] = useState('')
  const [stage, setStage] = useState<'uploading' | 'creating'>()
  const saving = stage !== undefined
  const saveLock = useRef(false)
  const docs = useDeliveryDocuments('Lập phiếu nhập')
  const validation = useFormValidation()
  const [replacementChoice, setReplacement] = useState<boolean>()
  const [selectedCases, setSelectedCases] = useState<number[]>([])
  const replacement =
    replacementChoice ??
    (!!order?.canCreateReplacement && !order.canCreateReceipt)
  const manager = user?.role === 'BRANCH_MANAGER'
  const lines = order?.lines ?? []
  const replacementCases = (
    order?.openCases?.map((item) => ({ ...item, id: item.caseId })) ??
    order?.discrepancies ?? []
  ).filter((item) => item.openReplacementQty > 0)
  const documentProducts = replacement
    ? Array.from(
        new Map(
          replacementCases
            .filter((item) => selectedCases.includes(item.id))
            .map((item) => [item.productId, item] as const),
        ).values(),
      )
    : lines.filter((line) => (line.outstandingQty ?? line.remainingQty ?? 0) > 0)
  useEffect(() => {
    if (!orderId || !/^[1-9]\d*$/.test(orderId)) return
    const controller = new AbortController()
    const signal = controller.signal
    void axiosClient
      .get<ReceivingView>('/purchase-orders/' + orderId + '/receiving-view', {
        signal,
      })
      .catch((error) => {
        // BE cũ chưa có receiving-view: BM vẫn đọc được chi tiết PO (Staff thì không).
        if (manager && isAxiosError(error) && error.response?.status === 404)
          return axiosClient.get<ReceivingView>('/purchase-orders/' + orderId, {
            signal,
          })
        throw error
      })
      .then(({ data }) => {
        if (!signal.aborted) setOrder(data)
      })
      .catch((error) => {
        if (!signal.aborted) setLoadError(apiMessage(error))
      })
    return () => controller.abort()
  }, [orderId, manager])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!validation.check(event.currentTarget)) return
    if (
      !order ||
      saveLock.current ||
      (replacement ? !order.canCreateReplacement : !order.canCreateReceipt)
    )
      return
    const form = event.currentTarget
    const read = docs.read(form)
    if ('error' in read) {
      setError(read.error)
      if (read.focus)
        form
          .querySelector<HTMLInputElement>('[name="' + read.focus + '"]')
          ?.focus()
      return
    }
    const replacementForCaseIds = replacement ? selectedCases : []
    if (replacement && !replacementForCaseIds.length) {
      setError('Chọn ít nhất một hồ sơ sai lệch cần giao bù.')
      return
    }
    if (!documentProducts.length) {
      setError('Phiếu này chưa có phụ tùng chờ nhận.')
      return
    }
    saveLock.current = true
    setError('')
    setStage(receiptDocumentUploadEnabled ? 'uploading' : 'creating')
    try {
      const documents = await docs.upload(read.files)
      setStage('creating')
      const { data } = await axiosClient.post<{ id: number }>(
        '/purchase-orders/' + orderId + '/goods-receipt-notes',
        { ...read.body, replacementForCaseIds, documents },
      )
      // BE đã giao việc kiểm nhận của phiếu cho chính người lập: mở thẳng màn ghi kết quả kiểm.
      refreshNotifications()
      navigate('/goods-receipt-notes/' + data.id)
    } catch (error) {
      setError(inventoryError(error))
    } finally {
      saveLock.current = false
      setStage(undefined)
    }
  }

  return (
    <form
      className="receiving-stack"
      noValidate
      onInput={validation.onInput}
      onSubmit={submit}
      onInvalid={(event) => {
        const message = docs.invalidMessage(event)
        if (message) setError(message)
      }}
    >
      <Panel title="Thông tin phiếu nhập">
        {loadError && <p role="alert">{loadError}</p>}
        <Hint>
          Lập phiếu xong, màn hình mở ngay bước ghi kết quả kiểm nhận của phiếu
          này cho người lập.
        </Hint>
        <dl className="receiving-info">
          <div>
            <dt>Mã đơn nhập hàng</dt>
            <dd>{orderId ? documentCode('DNH', orderId) : '—'}</dd>
          </div>
          <div>
            <dt>Nhà cung cấp</dt>
            <dd>{order?.supplierName ?? '—'}</dd>
          </div>
          <div>
            <dt>Kho nhận</dt>
            <dd>{order?.storeName ?? '—'}</dd>
          </div>
          {order?.expectedArrival && (
            <div>
              <dt>Ngày dự kiến</dt>
              <dd>{formatDateTime(order.expectedArrival)}</dd>
            </div>
          )}
        </dl>
        {lines.length > 0 && (
          <div className="table-scroll">
            <table aria-label="Hàng chờ nhận">
              <thead>
                <tr>
                  <th>Phụ tùng</th>
                  <th>Đơn vị</th>
                  <th>Số đặt</th>
                  <th>Còn chờ nhận</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line, index) => (
                  <tr key={line.productId ?? line.sku + index}>
                    <td>
                      <strong>{line.sku}</strong> {line.partName}
                    </td>
                    <td>{line.baseUnit ?? '—'}</td>
                    <td>{line.orderedQty}</td>
                    <td>{line.remainingQty ?? line.outstandingQty ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      <Panel title="Chứng từ giao hàng">
        <DeliveryDocumentFields
          state={docs}
          disabled={!order || saving}
          errors={validation.errors}
        />
      </Panel>
      <Panel title="Loại phiếu nhập">
        <div className="receiving-layout-fields">
          <label className="receiving-inline">
            <input
              type="radio"
              name="receipt-kind"
              checked={!replacement}
              disabled={!order?.canCreateReceipt}
              onChange={() => setReplacement(false)}
            />{' '}
            Giao theo đơn đặt hàng
          </label>
          <label className="receiving-inline">
            <input
              type="radio"
              name="receipt-kind"
              checked={replacement}
              disabled={!order?.canCreateReplacement}
              onChange={() => setReplacement(true)}
            />{' '}
            Giao bù cho sai lệch
          </label>
        </div>
        {replacement && (
          <div className="receiving-layout-fields">
            {replacementCases.map((item) => (
              <label key={item.id} className="receiving-inline">
                <input
                  type="checkbox"
                  checked={selectedCases.includes(item.id)}
                  disabled={saving}
                  onChange={(event) => {
                    const checked = event.target.checked
                    setSelectedCases((previous) =>
                      checked
                        ? [...previous, item.id]
                        : previous.filter((id) => id !== item.id),
                    )
                  }}
                />{' '}
                {item.partName} · Còn {item.openReplacementQty}
              </label>
            ))}
          </div>
        )}
      </Panel>
      <ActionBar>
        {error && (
          <p className="receiving-receipt-submit-error" role="alert">
            {error}
          </p>
        )}
        {stage && (
          <span role="status">
            {stage === 'uploading'
              ? 'Đang tải chứng từ…'
              : 'Đang lập phiếu nhập…'}
          </span>
        )}
        <button
          className="receiving-layout-primary"
          type="submit"
          disabled={
            saving ||
            (replacement
              ? !order?.canCreateReplacement
              : !order?.canCreateReceipt)
          }
        >
          Lập phiếu nhập
        </button>
      </ActionBar>
    </form>
  )
}

function FormShell({
  title,
  children,
  backTo,
}: {
  title: string
  children: ReactNode
  backTo?: string
}) {
  return (
    <main className="dashboard-content receiving-page receiving-order-page">
      {backTo && <PageBackLink to={backTo} />}
      <header className="receiving-heading">
        <h1>{title}</h1>
        <nav className="receiving-breadcrumb" aria-label="Đường dẫn">
          <Link to="/dashboard">Trang chủ</Link>
          <span aria-hidden="true">›</span>
          <Link to="/purchase-orders">Đơn nhập hàng</Link>
          <span aria-hidden="true">›</span>
          <span aria-current="page">{title}</span>
        </nav>
      </header>
      {children}
    </main>
  )
}

export function NewPurchaseOrderPage() {
  return (
    <FormShell title="Tạo đơn nhập hàng">
      <OrderFormLayout editing={false} />
    </FormShell>
  )
}

export function EditPurchaseOrderPage() {
  const { id } = useParams()
  return (
    <FormShell title="Sửa đơn nhập hàng">
      {id && /^[1-9]\d*$/.test(id) ? (
        <EditOrder key={id} id={id} />
      ) : (
        <MissingDocument />
      )}
    </FormShell>
  )
}

/** Route /purchase-orders/drafts/:id: mở lại nháp đơn nhập hàng lưu trên server (PM 17/11). */
export function PurchaseOrderDraftPage() {
  const { id } = useParams()
  const valid = !!id && /^[1-9]\d*$/.test(id)
  return (
    <FormShell
      title={
        'Nháp đơn nhập hàng' + (valid ? ' ' + documentCode('DNH', id) : '')
      }
      backTo={purchaseDraftsPath}
    >
      {valid ? <OpenDraft key={id} id={id} /> : <MissingDocument />}
    </FormShell>
  )
}

function OpenDraft({ id }: { id: string }) {
  const [saved, setSaved] = useState<PurchaseOrderDraft>()
  const [error, setError] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    const signal = controller.signal
    void axiosClient
      .get<PurchaseOrderDraft>('/purchase-orders/drafts/' + id, { signal })
      .then(({ data }) => {
        if (!signal.aborted) setSaved(data)
      })
      .catch((error) => {
        if (!signal.aborted) setError(apiMessage(error))
      })
    return () => controller.abort()
  }, [id])
  if (error) return <p role="alert">{error}</p>
  if (!saved) return <p role="status">Đang tải nháp…</p>
  if (saved.status !== 'DRAFT')
    return (
      <p role="status">
        Nháp này đã được gửi thành đơn nhập hàng.{' '}
        <Link to={'/purchase-orders/' + saved.id}>
          Xem đơn {documentCode('DNH', saved.id)}
        </Link>
      </p>
    )
  return <OrderFormLayout editing={false} savedDraft={saved} />
}

export function NewGoodsReceiptPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const orderId = id && /^[1-9]\d*$/.test(id) ? id : null
  return (
    <FormShell
      title="Lập phiếu nhập"
      backTo={
        // Staff không mở được chi tiết PO (có giá), quay về danh sách việc nhận hàng.
        user?.role === 'STAFF'
          ? '/purchase-orders'
          : orderId
            ? '/purchase-orders/' + orderId
            : undefined
      }
    >
      {orderId ? (
        <ReceiptFormLayout key={orderId} orderId={orderId} />
      ) : (
        <MissingDocument />
      )}
    </FormShell>
  )
}

function MissingDocument() {
  return (
    <>
      <PageBackLink to="/purchase-orders" />
      <p role="alert">Không tìm thấy phiếu.</p>
    </>
  )
}
