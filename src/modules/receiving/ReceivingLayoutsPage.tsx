import {
  Link,
  Navigate,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom'
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import { isAxiosError } from 'axios'
import axiosClient from '../../shared/api/axiosClient'
import { useAuth } from '../../shared/hooks/useAuth'
import type { DashboardStore } from '../../shared/types/store'
import type { Supplier } from '../suppliers/types'
import { apiMessage } from '../suppliers/supplierService'
import LiveReceiptPage from './LiveReceiptPage'
import { uploadReceiptDocument } from './uploadReceiptDocument'
import './receiving.css'

const layouts = [
  ['detail', 'Chi tiết PO'],
  ['order-form', 'Tạo phiếu nhập hàng'],
  ['receipt-form', 'Lập phiếu nhập'],
  ['inspection', 'Ghi kết quả kiểm nhận'],
  ['confirmation', 'Xác nhận phiếu nhập'],
  ['excess', 'Duyệt hàng nhận thừa'],
] as const

function EmptyTable({
  columns,
  message,
}: {
  columns: string[]
  message: string
}) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column} scope="col">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="receiving-empty-cell" colSpan={columns.length}>
              {message}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

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

function Info({ fields }: { fields: string[] }) {
  return (
    <dl className="receiving-info">
      {fields.map((field) => (
        <div key={field}>
          <dt>{field}</dt>
          <dd>—</dd>
        </div>
      ))}
    </dl>
  )
}

function ActionBar({ children }: { children: ReactNode }) {
  return <div className="receiving-layout-actions">{children}</div>
}

function OrderDetailLayout() {
  return (
    <div className="receiving-split">
      <div className="receiving-stack">
        <Panel title="Thông tin chung">
          <Info
            fields={[
              'Mã yêu cầu',
              'Nhà cung cấp',
              'Kho nhận',
              'Ngày lập',
              'Giao dự kiến',
              'Trạng thái',
              'Ghi chú',
            ]}
          />
          <ActionBar>
            <Link to="/purchase-orders/layout/order-form?mode=edit">
              Sửa yêu cầu
            </Link>
            <Link to="/purchase-orders/layout/receipt-form">
              Lập phiếu nhập
            </Link>
            <button type="button" disabled>
              Hủy yêu cầu
            </button>
          </ActionBar>
        </Panel>
        <Panel title="Phụ tùng nhập">
          <EmptyTable
            columns={[
              'Phụ tùng',
              'Đơn vị',
              'Số đặt',
              'Đã nhận',
              'Còn thiếu',
              'Đơn giá',
              'Thành tiền',
            ]}
            message="Chưa có dữ liệu phụ tùng."
          />
        </Panel>
        <Panel title="Lượt nhận hàng">
          <EmptyTable
            columns={[
              'Phiếu nhập',
              'Chứng từ',
              'Thời điểm hàng đến',
              'Người kiểm nhận',
              'Trạng thái',
            ]}
            message="Chưa có phiếu nhập."
          />
        </Panel>
        <Panel title="Sai lệch nhà cung cấp">
          <EmptyTable
            columns={[
              'Phụ tùng',
              'Thiếu',
              'Giao sai',
              'Hỏng',
              'Thừa từ chối',
              'Trạng thái',
            ]}
            message="Chưa có hồ sơ sai lệch."
          />
        </Panel>
      </div>
      <Panel title="Lịch sử">
        <p>Chưa có lịch sử xử lý.</p>
      </Panel>
    </div>
  )
}

type DraftLine = {
  id: number
  productId: string
  quantity: string
  price: string
}
type ProductOption = { id: number; sku: string; partName: string }
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
    products: ProductOption[]
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
      loadActiveOptions<ProductOption>('/products', signal),
    ]).then(([suppliers, stores, products]) => {
      if (signal.aborted) return
      const errors = []
      if (suppliers.status === 'rejected') errors.push('nhà cung cấp')
      if (stores.status === 'rejected') errors.push('kho nhận')
      if (products.status === 'rejected') errors.push('phụ tùng')
      setOptions({
        suppliers: suppliers.status === 'fulfilled' ? suppliers.value : [],
        stores: stores.status === 'fulfilled' ? stores.value.data : [],
        products: products.status === 'fulfilled' ? products.value : [],
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
  const productOptions = new Map(
    options?.products.map((item) => [item.id, item]),
  )
  for (const line of order?.lines ?? []) {
    if (!productOptions.has(line.productId))
      productOptions.set(line.productId, {
        id: line.productId,
        sku: line.sku,
        partName: line.partName,
      })
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
    <form className="receiving-stack" onSubmit={createOrder}>
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
              (!order &&
                (!options?.suppliers.length || !options.stores.length)) ||
              !productOptions.size
            }
          >
            {editing
              ? 'Lưu thay đổi'
              : saving
                ? 'Đang tạo phiếu…'
                : 'Tạo phiếu'}
          </button>
          <div className="receiving-order-cancel">
            <Link to={back}>{editing ? 'Hủy thay đổi' : 'Hủy phiếu'}</Link>
          </div>
        </aside>
      </div>
      <Panel title="Phụ tùng nhập">
        <div className="table-scroll">
          <table className="receiving-order-lines">
            <thead>
              <tr>
                <th scope="col">Phụ tùng</th>
                <th scope="col">Số lượng</th>
                <th scope="col">
                  Giá nhập
                  <br />
                  lần trước
                </th>
                <th scope="col">Giá nhập (₫)</th>
                <th scope="col">Thành tiền</th>
                <th scope="col" aria-label="Thao tác" />
              </tr>
            </thead>
            <tbody>
              {draft.lines.map((line, index) => (
                <tr key={line.id}>
                  <td>
                    <select
                      aria-label={'Phụ tùng dòng ' + (index + 1)}
                      disabled={!owner || !productOptions.size}
                      value={line.productId}
                      onChange={(event) =>
                        updateLine(line.id, 'productId', event.target.value)
                      }
                    >
                      <option value="">Chọn phụ tùng theo tên hoặc mã</option>
                      {[...productOptions.values()].map((product) => (
                        <option
                          key={product.id}
                          value={product.id}
                          disabled={draft.lines.some(
                            (item) =>
                              item.id !== line.id &&
                              item.productId === String(product.id),
                          )}
                        >
                          {product.partName} · {product.sku}
                        </option>
                      ))}
                    </select>
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
          <button type="button" disabled>
            Thêm các mã dưới ngưỡng
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

function ReceiptFormLayout({ orderId }: { orderId: string | null }) {
  const navigate = useNavigate()
  const [order, setOrder] = useState<ReceiptOrder>()
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
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
        if (!signal.aborted) setError(apiMessage(error))
      })
    return () => controller.abort()
  }, [orderId])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (
      !order ||
      saving ||
      (replacement ? !order.canCreateReplacement : !order.canCreateReceipt)
    )
      return
    const fields = new FormData(event.currentTarget)
    const replacementForCaseIds = replacement
      ? fields.getAll('case').map(Number)
      : []
    const files = fields
      .getAll('documents')
      .filter((file): file is File => file instanceof File && file.size > 0)
    if (
      !files.length ||
      files.length > 10 ||
      (replacement && !replacementForCaseIds.length)
    ) {
      setError(
        'Chọn từ 1 đến 10 ảnh chứng từ và chọn hồ sơ sai lệch nếu đây là lượt giao bù.',
      )
      return
    }
    setError('')
    setSaving(true)
    try {
      const documents = []
      for (const file of files) {
        const document =
          uploads.current.get(file) ?? (await uploadReceiptDocument(file))
        uploads.current.set(file, document)
        documents.push(document)
      }
      const { data } = await axiosClient.post<{ id: number }>(
        '/purchase-orders/' + orderId + '/goods-receipt-notes',
        {
          deliveryDocumentNo: String(fields.get('documentNo') ?? '').trim(),
          deliveryDocumentDate: fields.get('documentDate'),
          arrivedAt: fields.get('arrivedAt') || null,
          delivererName:
            String(fields.get('delivererName') ?? '').trim() || null,
          vehiclePlateNo:
            String(fields.get('vehiclePlateNo') ?? '').trim() || null,
          replacementForCaseIds,
          documents,
        },
      )
      navigate('/purchase-orders/layout/inspection?receipt=' + data.id)
    } catch (error) {
      setError(
        isAxiosError(error)
          ? apiMessage(error)
          : error instanceof Error
            ? error.message
            : apiMessage(error),
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="receiving-stack" onSubmit={submit}>
      <Panel title="Thông tin phiếu nhập">
        {error && <p role="alert">{error}</p>}
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
            Ngày chứng từ <input name="documentDate" type="date" required />
          </label>
          <label>
            Thời điểm hàng đến <input name="arrivedAt" type="datetime-local" />
          </label>
          <label>
            Người giao hàng <input name="delivererName" maxLength={100} />
          </label>
          <label>
            Biển số xe <input name="vehiclePlateNo" maxLength={20} />
          </label>
          <label className="receiving-layout-wide receiving-dropzone">
            <strong>Ảnh chứng từ giao hàng</strong>
            <span>Chọn ảnh chứng từ để đính kèm</span>
            <input
              name="documents"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              required
              disabled={!order || saving}
            />
          </label>
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
        ) : (
          <EmptyTable
            columns={['Hồ sơ sai lệch', 'Phụ tùng', 'Còn phải giao bù']}
            message="Chưa có hồ sơ để chọn giao bù."
          />
        )}
      </Panel>
      <ActionBar>
        <Link
          to={
            orderId
              ? '/purchase-orders/' + orderId
              : '/purchase-orders/layout/detail'
          }
        >
          Quay lại chi tiết
        </Link>
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
          {saving ? 'Đang lập phiếu…' : 'Lập phiếu nhập'}
        </button>
      </ActionBar>
    </form>
  )
}

function ReceiptWorkLayout({
  screen,
}: {
  screen: 'inspection' | 'confirmation' | 'excess'
}) {
  const inspection = screen === 'inspection'
  const excess = screen === 'excess'
  const columns = excess
    ? ['Phụ tùng', 'Đơn vị', 'Số đặt', 'Số đạt', 'Số thừa', 'Nhận / Từ chối']
    : [
        'Phụ tùng',
        'Vị trí',
        'Chứng từ',
        'Thực giao',
        'Đạt',
        'Giao sai',
        'Hỏng',
        'Thiếu',
        'Thừa',
        ...(inspection ? ['Số lô', 'Hạn dùng'] : ['Số nhập tồn']),
      ]
  return (
    <div className="receiving-stack">
      <Panel title="Chứng từ giao hàng">
        <Info
          fields={[
            'Phiếu nhập',
            'Đơn đặt hàng',
            'Nhà cung cấp',
            'Kho nhận',
            'Thời điểm hàng đến',
            'Ảnh chứng từ',
            'Người kiểm nhận',
            'Loại lượt giao',
          ]}
        />
      </Panel>
      <Panel
        title={
          excess
            ? 'Các dòng hàng nhận thừa'
            : inspection
              ? 'Kiểm từng mặt hàng'
              : 'Kết quả kiểm nhận'
        }
        action={
          inspection ? (
            <label className="receiving-inline">
              <input type="checkbox" disabled /> Chỉ mặt hàng chưa kiểm
            </label>
          ) : undefined
        }
      >
        <EmptyTable
          columns={columns}
          message={
            excess
              ? 'Chưa có dòng hàng thừa cần duyệt.'
              : 'Chưa có dòng kiểm nhận.'
          }
        />
        {inspection && (
          <div className="receiving-layout-fields">
            <label className="receiving-layout-wide">
              Ghi chú kiểm hàng{' '}
              <textarea
                rows={2}
                placeholder="Ghi chú về hàng giao sai hoặc hư hỏng"
              />
            </label>
          </div>
        )}
      </Panel>
      {screen === 'confirmation' && (
        <div className="receiving-split">
          <Panel title="Tóm tắt nhập tồn">
            <Info
              fields={[
                'Tổng đạt',
                'Tổng nhập tồn',
                'Tổng thiếu',
                'Tổng sai / hỏng',
              ]}
            />
          </Panel>
          <Panel title="Trả về kiểm lại">
            <div className="receiving-layout-fields">
              <label>
                Lý do kiểm lại <textarea rows={2} maxLength={255} />
              </label>
            </div>
          </Panel>
        </div>
      )}
      <ActionBar>
        {inspection && (
          <label className="receiving-inline">
            <input type="checkbox" disabled /> Tôi đã kiểm đếm thực tế và xác
            nhận kết quả
          </label>
        )}
        {screen === 'confirmation' && (
          <button type="button" disabled>
            Trả về kiểm lại
          </button>
        )}
        <button type="button" className="receiving-layout-primary" disabled>
          {inspection
            ? 'Gửi kết quả kiểm nhận'
            : excess
              ? 'Lưu quyết định'
              : 'Xác nhận phiếu nhập'}
        </button>
      </ActionBar>
    </div>
  )
}

export default function ReceivingLayoutsPage() {
  const { screen } = useParams()
  const [params] = useSearchParams()
  const selected = layouts.find(([id]) => id === screen)
  if (!selected) return <Navigate to="/purchase-orders/layout/detail" replace />
  const [layout, defaultTitle] = selected
  const orderForm = layout === 'order-form'
  const editing = orderForm && params.get('mode') === 'edit'
  const title = editing ? 'Sửa phiếu nhập hàng' : defaultTitle
  return (
    <main
      className={
        orderForm
          ? 'dashboard-content receiving-page receiving-order-page'
          : 'dashboard-content receiving-page'
      }
    >
      <header className="receiving-heading">
        <h1>{title}</h1>
        <span>
          <Link to="/dashboard">Trang chủ</Link> ›{' '}
          <Link to="/purchase-orders">Phiếu nhập hàng</Link> ›{' '}
          {orderForm ? (editing ? 'Chỉnh sửa' : 'Tạo mới') : title}
        </span>
      </header>
      {layout === 'detail' ? (
        <OrderDetailLayout />
      ) : layout === 'order-form' ? (
        editing && /^[1-9]\d*$/.test(params.get('order') ?? '') ? (
          <EditOrder key={params.get('order')} id={params.get('order')!} />
        ) : (
          <OrderFormLayout key={String(editing)} editing={editing} />
        )
      ) : layout === 'receipt-form' ? (
        <ReceiptFormLayout
          key={params.get('order')}
          orderId={params.get('order')}
        />
      ) : /^[1-9]\d*$/.test(params.get('receipt') ?? '') ? (
        <LiveReceiptPage
          key={layout + ':' + params.get('receipt')}
          id={params.get('receipt')!}
          screen={layout}
        />
      ) : (
        <ReceiptWorkLayout key={layout} screen={layout} />
      )}
    </main>
  )
}
