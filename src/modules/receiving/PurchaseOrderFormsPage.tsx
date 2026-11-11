import PageBackLink from '../../shared/ui/PageBackLink'
import { Link, useNavigate, useParams } from 'react-router-dom'
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
import { uploadAttachment as uploadReceiptDocument } from '../../shared/api/upload'
import ProductPicker, { type ProductOption } from './ProductPicker'
import ReceiptImage from './ReceiptImage'
import { receiptDateLimits, receiptDatesInFuture } from './receivingRules'
import { inventoryError } from '../inventory/api'
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
  if (!order) return <p role="status">Đang tải phiếu…</p>
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

const orderMoney = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
})

function OrderFormLayout({
  editing,
  order,
}: {
  editing: boolean
  order?: EditableOrder
}) {
  const { user } = useAuth()
  const owner = user?.role === 'OWNER'
  const navigate = useNavigate()
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [options, setOptions] = useState<{
    suppliers: Supplier[]
    stores: DashboardStore[]
    errors: string[]
  }>()
  const [draft, setDraft] = useState({
    nextId: order ? Math.max(0, ...order.lines.map((line) => line.id)) + 1 : 2,
    lines: order
      ? order.lines.map((line) => ({
          id: line.id,
          productId: String(line.productId),
          quantity: String(line.orderedQty),
          price: String(line.purchasePrice),
        }))
      : ([{ id: 1, productId: '', quantity: '', price: '' }] as DraftLine[]),
  })
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
  const back = order ? '/purchase-orders/' + order.id : '/purchase-orders'
  const [selectedProducts, setSelectedProducts] = useState<
    Record<number, ProductOption>
  >(
    Object.fromEntries(
      (order?.lines ?? []).map((line) => [
        line.productId,
        { id: line.productId, sku: line.sku, partName: line.partName },
      ]),
    ),
  )
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
      className="receiving-stack receiving-order-form"
      onSubmit={createOrder}
    >
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
                defaultValue=""
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
                defaultValue=""
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
                defaultValue={order?.expectedArrival ?? ''}
              />
            </label>
            <label className="receiving-layout-wide">
              Ghi chú
              <textarea
                name="note"
                defaultValue={order?.note ?? ''}
                rows={2}
                maxLength={500}
                placeholder="Ví dụ: giao trong giờ hành chính, gọi trước 30 phút..."
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
              <dt>Số dòng</dt>
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
                ? 'Đang tạo phiếu…'
                : 'Tạo yêu cầu'}
          </button>
          <div className="receiving-order-cancel">
            <Link to={back}>{editing ? 'Hủy thay đổi' : 'Hủy phiếu'}</Link>
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
                  <td>—</td>
                  <td>
                    <input
                      type="number"
                      min={1}
                      max={10000000000}
                      required
                      aria-label={'Giá nhập dòng ' + (index + 1)}
                      value={line.price}
                      onChange={(event) =>
                        updateLine(line.id, 'price', event.target.value)
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
                    Chưa có phụ tùng trong phiếu.
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
            ＋ Thêm dòng
          </button>
        </div>
      </Panel>
    </form>
  )
}
type ReceiptOrder = {
  supplierName: string
  storeName: string
  canCreateReceipt: boolean
  canCreateReplacement: boolean
  discrepancies: { id: number; partName: string; openReplacementQty: number }[]
}

const receiptFutureDateMessage =
  'Ngày chứng từ và thời điểm hàng đến không được sau thời điểm hiện tại.'

function ReceiptFormLayout({ orderId }: { orderId: string | null }) {
  const navigate = useNavigate()
  const [order, setOrder] = useState<ReceiptOrder>()
  const [loadError, setLoadError] = useState('')
  const [error, setError] = useState('')
  const [stage, setStage] = useState<'uploading' | 'creating'>()
  const saving = stage !== undefined
  const saveLock = useRef(false)
  const [dateLimits, setDateLimits] = useState(receiptDateLimits)
  const [images, setImages] = useState<{ src: string; name: string }[]>([])
  useEffect(
    () => () => images.forEach(({ src }) => URL.revokeObjectURL(src)),
    [images],
  )
  const [replacementChoice, setReplacement] = useState<boolean>()
  const replacement =
    replacementChoice ??
    (!!order?.canCreateReplacement && !order.canCreateReceipt)
  const uploads = useRef(
    new WeakMap<File, Awaited<ReturnType<typeof uploadReceiptDocument>>>(),
  )
  useEffect(() => {
    if (!orderId || !/^[1-9]\d*$/.test(orderId)) return
    const controller = new AbortController()
    const signal = controller.signal
    void axiosClient
      .get<ReceiptOrder>('/purchase-orders/' + orderId, { signal })
      .then(({ data }) => {
        if (!signal.aborted) setOrder(data)
      })
      .catch((error) => {
        if (!signal.aborted) setLoadError(apiMessage(error))
      })
    return () => controller.abort()
  }, [orderId])

  function refreshDateLimits() {
    setDateLimits(receiptDateLimits())
  }

  function reportInvalidField(event: FormEvent<HTMLFormElement>) {
    const input = event.target
    if (
      !(input instanceof HTMLInputElement) ||
      input !== event.currentTarget.querySelector('input:invalid')
    )
      return
    if (input.validity.rangeOverflow) {
      const future = receiptDatesInFuture(
        input.name === 'documentDate' ? input.value : '',
        input.name === 'arrivedAt' ? input.value : '',
      )
      refreshDateLimits()
      setError(
        future
          ? receiptFutureDateMessage
          : 'Giới hạn ngày giờ đã cập nhật. Bấm Lập phiếu nhập để tiếp tục.',
      )
    } else if (input.validity.valueMissing) {
      if (input.name === 'documentNo') setError('Nhập số chứng từ.')
      if (input.name === 'documentDate') setError('Chọn ngày chứng từ.')
      if (input.name === 'documents') setError('Chọn ít nhất một tệp chứng từ.')
    } else {
      setError('Kiểm tra lại thông tin chứng từ.')
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (
      !order ||
      saveLock.current ||
      (replacement ? !order.canCreateReplacement : !order.canCreateReceipt)
    )
      return
    const fields = new FormData(event.currentTarget)
    const documentNo = String(fields.get('documentNo') ?? '').trim()
    if (!documentNo) {
      setError('Nhập số chứng từ.')
      event.currentTarget
        .querySelector<HTMLInputElement>('[name="documentNo"]')
        ?.focus()
      return
    }
    const documentDate = String(fields.get('documentDate') ?? '')
    const arrivedAt = String(fields.get('arrivedAt') ?? '')
    if (receiptDatesInFuture(documentDate, arrivedAt)) {
      refreshDateLimits()
      setError(receiptFutureDateMessage)
      return
    }
    const replacementForCaseIds = replacement
      ? fields.getAll('case').map(Number)
      : []
    const files = fields
      .getAll('documents')
      .filter((file): file is File => file instanceof File && file.size > 0)
    if (!files.length || files.length > 10) {
      setError('Chọn từ 1 đến 10 tệp chứng từ.')
      return
    }
    if (replacement && !replacementForCaseIds.length) {
      setError('Chọn ít nhất một hồ sơ sai lệch cần giao bù.')
      return
    }
    saveLock.current = true
    setError('')
    setStage('uploading')
    try {
      const documents = []
      for (const file of files) {
        const document =
          uploads.current.get(file) ?? (await uploadReceiptDocument(file))
        uploads.current.set(file, document)
        documents.push(document)
      }
      setStage('creating')
      const { data } = await axiosClient.post<{ id: number }>(
        '/purchase-orders/' + orderId + '/goods-receipt-notes',
        {
          deliveryDocumentNo: documentNo,
          deliveryDocumentDate: documentDate,
          arrivedAt: arrivedAt || null,
          delivererName:
            String(fields.get('delivererName') ?? '').trim() || null,
          vehiclePlateNo:
            String(fields.get('vehiclePlateNo') ?? '').trim() || null,
          replacementForCaseIds,
          documents,
        },
      )
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
      onSubmit={submit}
      onInvalid={reportInvalidField}
    >
      <Panel title="Thông tin phiếu nhập">
        {loadError && <p role="alert">{loadError}</p>}
        <dl className="receiving-info">
          <div>
            <dt>Đơn đặt hàng</dt>
            <dd>{orderId ? 'YCN-' + orderId.padStart(4, '0') : '—'}</dd>
          </div>
          <div>
            <dt>Nhà cung cấp</dt>
            <dd>{order?.supplierName ?? '—'}</dd>
          </div>
          <div>
            <dt>Kho nhận</dt>
            <dd>{order?.storeName ?? '—'}</dd>
          </div>
        </dl>
      </Panel>
      <Panel title="Chứng từ giao hàng">
        <div className="receiving-layout-fields">
          <label>
            Số chứng từ{' '}
            <input
              name="documentNo"
              required
              maxLength={50}
              placeholder="Nhập số chứng từ"
            />
          </label>
          <label>
            Ngày chứng từ
            <input
              name="documentDate"
              type="date"
              max={dateLimits.date}
              onFocus={refreshDateLimits}
              onChange={refreshDateLimits}
              required
            />
          </label>
          <label>
            Thời điểm hàng đến
            <input
              name="arrivedAt"
              type="datetime-local"
              max={dateLimits.dateTime}
              onFocus={refreshDateLimits}
              onChange={refreshDateLimits}
            />
          </label>
          <label>
            Người giao hàng <input name="delivererName" maxLength={100} />
          </label>
          <label>
            Biển số xe <input name="vehiclePlateNo" maxLength={20} />
          </label>
          <label className="receiving-layout-wide receiving-dropzone">
            <strong>Chứng từ giao hàng</strong>
            <span>Chọn ảnh hoặc PDF chứng từ để đính kèm</span>
            <input
              name="documents"
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              multiple
              required
              disabled={!order || saving}
              onChange={(event) => {
                const files = Array.from(event.currentTarget.files ?? [])
                setImages(
                  files
                    .filter((file) => file.type.startsWith('image/'))
                    .map((file) => ({
                      src: URL.createObjectURL(file),
                      name: file.name,
                    })),
                )
              }}
            />
          </label>
          {!!images.length && (
            <ul
              className="receiving-layout-wide receiving-document-list"
              aria-label="Ảnh chứng từ đã chọn"
            >
              {images.map(({ src, name }) => (
                <li key={src}>
                  <ReceiptImage src={src} name={name} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </Panel>
      <Panel title="Loại lượt giao">
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
        {replacement && order ? (
          <div className="receiving-layout-fields">
            {order.discrepancies
              .filter((item) => item.openReplacementQty > 0)
              .map((item) => (
                <label key={item.id} className="receiving-inline">
                  <input type="checkbox" name="case" value={item.id} />{' '}
                  {item.partName} · Còn {item.openReplacementQty}
                </label>
              ))}
          </div>
        ) : null}
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
          <Link to="/purchase-orders">Yêu cầu nhập hàng</Link>
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
    <FormShell title="Tạo yêu cầu nhập hàng">
      <OrderFormLayout editing={false} />
    </FormShell>
  )
}

export function EditPurchaseOrderPage() {
  const { id } = useParams()
  return (
    <FormShell title="Sửa yêu cầu nhập hàng">
      {id && /^[1-9]\d*$/.test(id) ? (
        <EditOrder key={id} id={id} />
      ) : (
        <MissingDocument />
      )}
    </FormShell>
  )
}

export function NewGoodsReceiptPage() {
  const { id } = useParams()
  const orderId = id && /^[1-9]\d*$/.test(id) ? id : null
  return (
    <FormShell
      title="Lập phiếu nhập"
      backTo={orderId ? '/purchase-orders/' + orderId : undefined}
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
