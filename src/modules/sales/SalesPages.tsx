import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { useInventoryData, useInventoryScope } from '../inventory/api'
import {
  InventoryNotice,
  InventoryPanel,
  Pagination,
  WarehouseFilter,
} from '../inventory/components'
import type { Page } from '../inventory/types'
import { money, dateTime, today } from '../inventory/presentation'
import CustomerForm from '../customers/components/CustomerForm'
import type { Customer } from '../customers/types'

import {
  salesStates,
  salesTotal,
  discountedPrice,
  mayCancel,
  pickedReady,
  type SalesOrder,
  type SalesLine,
} from './salesModel'
import SalesAssignmentDialog from './SalesAssignmentDialog'
import axiosClient from '../../shared/api/axiosClient'
import { orderFromDto, type OrderDto, type UnmetRow } from './salesApi'
import SalesSettlementDialog from './SalesSettlementDialog'
import { inventoryError } from '../inventory/api'
import { useChoicePages, useSalesList } from './useSalesList'
import SalesVersions from './SalesVersions'
import DemandReplenishment from './DemandReplenishment'
import BarcodeCamera from './BarcodeCamera'
import './sales.css'
function Header({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <header className="stock-heading">
      <div>
        <h1>{title}</h1>
      </div>
      <div className="stock-heading-actions">
        {children}
        <nav>
          <Link to="/dashboard">Trang chủ</Link> › Bán hàng › {title}
        </nav>
      </div>
    </header>
  )
}
function Shell({
  title,
  children,
  actions,
}: {
  title: string
  children: ReactNode
  actions?: ReactNode
}) {
  return (
    <main className="inventory-workspace sales-workspace">
      <Header title={title}>{actions}</Header>
      {children}
    </main>
  )
}
function Back() {
  return <Link to="/sales-orders">← Danh sách đơn bán</Link>
}
export function SalesListAmounts({
  total,
  id,
}: {
  total?: number | null
  id: number
}) {
  return (
    <>
      <td>{total == null ? 'Chưa có dữ liệu' : money.format(total)}</td>
      <td>
        <Link to={'/sales-orders/' + id}>Xem thanh toán</Link>
      </td>
    </>
  )
}
export function SalesOrderListPage({
  orders = [],
}: { orders?: SalesOrder[] } = {}) {
  const scope = useInventoryScope(),
    staff = scope.user?.role === 'STAFF',
    p = scope.params
  const tab = p.get('tab') ?? 'OPEN',
    closed = ['COMPLETED', 'CANCELLED'].includes(tab)
  const from = p.get('from') ?? today(),
    to = p.get('to') ?? today()
  const page = Math.max(0, Number(p.get('page')) || 0)
  const resource = useSalesList(
    {
      storeId: scope.storeId,
      view: tab === 'PICKED' ? 'OPEN' : tab,
      q: p.get('q') ?? '',
      createdFrom: closed ? from : '',
      createdTo: closed ? to : '',
      page,
      size: 20,
    },
    tab === 'PICKED'
      ? 'PICKED'
      : staff && tab === 'OPEN'
        ? 'AWAITING_PICKING'
        : (p.get('status') ?? ''),
    !closed || from <= to,
  )
  const matches = orders.length
    ? orders
    : (resource.data?.items ?? [])
        .filter((o) => tab !== 'PICKED' || o.status === 'PICKED')
        .map(
          (o) =>
            ({
              id: o.id,
              code: 'SO-' + o.id,
              status: o.status,
              storeName: o.storeName,
              customerName: o.customerName ?? 'Khách lẻ',
              createdAt: o.createdAt,
              assigneeName: o.pickerName,
              total: o.total,
              version: o.version,
              priceType: 'RETAIL',
              discount: 0,
              netPaid: 0,
              credit: 0,
              lines: [],
              versions: [],
              events: [],
              nextAction: o.nextAction,
            }) as SalesOrder,
        )
  return (
    <Shell
      title={staff ? 'Đơn được giao lấy hàng' : 'Đơn bán'}
      actions={
        <>
          {!staff && <Link to="/unmet-demand">Nhu cầu chưa đáp ứng</Link>}
          {['OWNER', 'BRANCH_MANAGER'].includes(scope.user?.role ?? '') && (
            <Link className="sales-primary" to="/sales-orders/new">
              Tạo đơn bán
            </Link>
          )}
        </>
      }
    >
      <InventoryPanel
        title={staff ? 'Việc lấy hàng của tôi' : 'Danh sách đơn bán'}
      >
        <div className="stock-tabs">
          {(staff
            ? [
                ['OPEN', 'Cần lấy'],
                ['PICKED', 'Đã gửi'],
              ]
            : [
                ['OPEN', 'Chưa hoàn tất'],
                ['COMPLETED', 'Hoàn tất'],
                ['CANCELLED', 'Đã hủy'],
              ]
          ).map(([value, label]) => (
            <button
              key={value}
              aria-pressed={tab === value}
              onClick={() => scope.filter({ tab: value, status: '' })}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="stock-filters">
          <WarehouseFilter
            owner={scope.owner}
            stores={scope.stores}
            value={scope.storeId}
            onChange={(storeId) => scope.filter({ storeId })}
          />
          <label>
            Tìm đơn, khách hàng
            <input
              value={p.get('q') ?? ''}
              onChange={(e) => scope.filter({ q: e.target.value }, true)}
              placeholder="Mã đơn, tên hoặc số điện thoại…"
            />
          </label>
          {!closed && !staff && (
            <label>
              Trạng thái
              <select
                value={p.get('status') ?? ''}
                onChange={(e) => scope.filter({ status: e.target.value })}
              >
                <option value="">Mọi trạng thái</option>
                {(['AWAITING_PICKING', 'PICKED', 'CONFIRMED'] as const).map(
                  (s) => (
                    <option key={s} value={s}>
                      {salesStates[s]}
                    </option>
                  ),
                )}
              </select>
            </label>
          )}
          {closed && (
            <>
              <label>
                Từ ngày
                <input
                  type="date"
                  value={from}
                  max={to}
                  onChange={(e) => scope.filter({ from: e.target.value })}
                />
              </label>
              <label>
                Đến ngày
                <input
                  type="date"
                  value={to}
                  min={from}
                  onChange={(e) => scope.filter({ to: e.target.value })}
                />
              </label>
            </>
          )}
        </div>
        <InventoryNotice
          error={
            scope.storesError ??
            (from > to
              ? 'Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.'
              : undefined)
          }
          loading={false}
        />
        <InventoryNotice loading={resource.loading} error={resource.error} />
        <div className="stock-table-scroll">
          <table className="stock-table">
            <thead>
              <tr>
                {[
                  'Đơn',
                  ...(scope.owner ? ['Cửa hàng'] : []),
                  'Khách hàng',
                  'Ngày tạo',
                  ...(staff ? ['Người giao'] : ['Thành tiền', 'Thanh toán']),
                  'Trạng thái',
                  'Cần làm',
                ].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matches.map((order) => (
                <tr key={order.id}>
                  <td>
                    <Link to={'/sales-orders/' + order.id}>{order.code}</Link>
                  </td>
                  {scope.owner && <td>{order.storeName}</td>}
                  <td>{order.customerName}</td>
                  <td>{dateTime(order.createdAt)}</td>
                  {staff ? (
                    <td>{order.assigneeName ?? 'Chưa giao'}</td>
                  ) : (
                    <>
                      <SalesListAmounts total={order.total} id={order.id} />
                    </>
                  )}
                  <td>{salesStates[order.status]}</td>
                  <td>
                    {order.nextAction === 'RECORD_PICKING' ? (
                      <Link to={'/sales-orders/' + order.id + '/pick'}>
                        Ghi số đã nhặt
                      </Link>
                    ) : (
                      <Link
                        to={
                          '/sales-orders/' +
                          order.id +
                          (order.nextAction === 'ASSIGN_PICKER'
                            ? '?action=assign'
                            : order.nextAction === 'CONFIRM'
                              ? '?action=confirm'
                              : order.nextAction === 'COLLECT_PAYMENT'
                                ? '?action=payment'
                                : '')
                        }
                      >
                        {order.nextAction === 'ASSIGN_PICKER'
                          ? 'Giao việc'
                          : order.nextAction === 'CONFIRM'
                            ? 'Xác nhận'
                            : order.nextAction === 'COLLECT_PAYMENT'
                              ? 'Thu tiền'
                              : 'Chi tiết'}
                      </Link>
                    )}{' '}
                  </td>
                </tr>
              ))}
              {!matches.length && (
                <tr>
                  <td
                    colSpan={scope.owner ? 8 : staff ? 6 : 7}
                    className="stock-empty"
                  >
                    Chưa có dữ liệu đơn bán để hiển thị.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          total={resource.data?.totalItems ?? 0}
          page={page}
          size={20}
          loading={resource.loading}
          onPage={(page) =>
            scope.setParams((previous) => {
              const next = new URLSearchParams(previous)
              next.set('page', String(page))
              return next
            })
          }
        />
      </InventoryPanel>
    </Shell>
  )
}
type Product = {
  id: number
  sku: string
  partName: string
  baseUnit: string
  retailPrice: number | null
  status: string
  availableQty?: number | null
  barcodes?: string[]
}
type DraftLine = { product: Product; quantity: number }
export function SalesOrderFormPage() {
  const { id } = useParams()
  const [prefill] = useSearchParams()
  const product = useInventoryData<Product>(
    '/products/' + prefill.get('productId'),
    {},
    0,
    !id && !!prefill.get('productId'),
  )
  const data = useInventoryData<OrderDto>(
    '/sales-orders/' + id,
    {},
    0,
    !!id && /^[1-9]\d*$/.test(id),
  )
  const initialId = data.data?.customerId ?? Number(prefill.get('customerId'))
  const buyer = useInventoryData<{ customer: Customer }>(
    '/customers/' + initialId,
    {},
    0,
    !!initialId,
  )
  if (initialId && !buyer.data)
    return <InventoryNotice loading={buyer.loading} error={buyer.error} />
  if (!id && prefill.get('productId') && !product.data)
    return <InventoryNotice loading={product.loading} error={product.error} />
  if (!id)
    return (
      <SalesOrderFormView
        initialCustomer={buyer.data?.customer}
        key={product.data?.id ?? 'new'}
        initialProduct={product.data}
        initialQuantity={Math.min(
          100000,
          Math.max(1, Number(prefill.get('quantity')) || 1),
        )}
      />
    )
  return (
    <>
      <InventoryNotice loading={data.loading} error={data.error} />
      {data.data?.actions.canUpdate ? (
        <SalesOrderFormView
          key={data.data.version}
          initialCustomer={buyer.data?.customer}
          order={orderFromDto(data.data)}
        />
      ) : (
        !data.loading && (
          <p role="status">
            Không thể sửa đơn ở trạng thái hoặc quyền hiện tại. <Back />
          </p>
        )
      )}
    </>
  )
}
export function SalesOrderFormView({
  order,
  initialProduct,
  initialCustomer,
  initialQuantity = 1,
}: {
  order?: SalesOrder
  initialCustomer?: Customer
  initialProduct?: Product
  initialQuantity?: number
}) {
  const [prefill] = useSearchParams()
  const [camera, setCamera] = useState(false)
  const navigate = useNavigate(),
    scope = useInventoryScope(),
    saveLock = useRef(false)
  const [busy, setBusy] = useState(false),
    [customerTouched, _setCustomerTouched] = useState(false),
    [walkPhone, setWalkPhone] = useState(order?.customerPhone ?? ''),
    [warehouse, setWarehouse] = useState(
      String(
        order?.storeId ??
          (scope.owner ? prefill.get('storeId') : scope.user?.storeId) ??
          '',
      ),
    ),
    [previewError, setPreviewError] = useState('')
  const [customerQuery, setCustomerQuery] = useState(''),
    [customer, setCustomer] = useState<Customer | undefined>(initialCustomer),
    [quick, setQuick] = useState(false),
    [walkin, setWalkin] = useState(
      order?.customerId ? '' : (order?.customerName ?? ''),
    ),
    [query, setQuery] = useState(''),
    [scan, setScan] = useState(''),
    [type, setType] = useState(order?.priceType ?? 'RETAIL'),
    [discount, setDiscount] = useState(String(order?.discount ?? 0)),
    [lines, setLines] = useState<DraftLine[]>(
      () =>
        order?.lines.map((l) => ({
          product: {
            id: l.productId,
            sku: l.sku,
            partName: l.partName,
            baseUnit: l.baseUnit,
            retailPrice: l.retailPrice,
            status: 'ACTIVE',
          },
          quantity: l.requested,
        })) ??
        (initialProduct
          ? [{ product: initialProduct, quantity: initialQuantity }]
          : []),
    ),
    [error, setError] = useState('')
  const customers = useInventoryData<Page<Customer>>('/customers', {
    q: customerQuery,
    size: 20,
  })
  const products = useInventoryData<Page<Product>>(
    '/products',
    { q: query, size: 20, status: 'ACTIVE' },
    0,
    !!query.trim(),
  )
  const [preview, setPreview] = useState<{
    key: string
    total: number
    referenceTotal: number
    discountAmount: number
    priced: boolean
    withinThreshold: boolean
    discountThreshold: number
    lines: {
      productId: number
      sellableQty: number
      retailPrice: number | null
      actualUnitPrice: number | null
      lineTotal: number | null
    }[]
  }>()
  const previewBody = JSON.stringify({
    customerId: customerTouched
      ? (customer?.id ?? null)
      : (customer?.id ??
        order?.customerId ??
        (Number(prefill.get('customerId')) || null)),
    storeId: warehouse ? Number(warehouse) : undefined,
    walkInPhone: walkPhone,
    walkInName: walkin,
    priceType: type,
    discountRate: type === 'WHOLESALE' ? Number(discount) : 0,
    lines: lines.map((l) => ({
      productId: l.product.id,
      quantity: l.quantity,
    })),
  })
  useEffect(() => {
    if (!lines.length) return
    const controller = new AbortController()
    const timer = setTimeout(() => {
      void axiosClient
        .post('/sales-orders/preview', JSON.parse(previewBody), {
          signal: controller.signal,
        })
        .then(({ data }) => {
          if (!controller.signal.aborted) {
            setPreview({ ...data, key: previewBody })
            setPreviewError('')
          }
        })
        .catch((error) => {
          if (!controller.signal.aborted) setPreviewError(inventoryError(error))
        })
    }, 300)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [previewBody, lines.length])
  const pricePreview = preview?.key === previewBody ? preview : undefined
  function add(product: Product) {
    if (product.status !== 'ACTIVE') {
      setError('Phụ tùng đã ngừng kinh doanh.')
      return
    }
    setLines((previous) =>
      previous.some((l) => l.product.id === product.id)
        ? previous.map((l) =>
            l.product.id === product.id
              ? { ...l, quantity: l.quantity + 1 }
              : l,
          )
        : [...previous, { product, quantity: 1 }],
    )
    setQuery('')
    setError('')
  }
  async function scanBarcode(barcode: string) {
    try {
      const { data } = await axiosClient.get<{
        productId: number
        status: string
      }>('/products/barcode/' + encodeURIComponent(barcode.trim()), {
        params: { storeId: warehouse || undefined },
      })
      if (data.status !== 'ACTIVE') {
        setError('Phụ tùng đã ngừng kinh doanh.')
        return
      }
      const detail = await axiosClient.get<Product>(
        '/products/' + data.productId,
        { params: { storeId: warehouse || undefined } },
      )
      add(detail.data)
      setScan('')
    } catch {
      setError('Không tra được mã vạch. Vui lòng thử lại.')
    }
  }
  return (
    <Shell
      title={
        order
          ? 'Sửa đơn ' + order.code + ' · phiên bản ' + order.version
          : 'Tạo đơn bán'
      }
      actions={
        <span>Trang chủ › Đơn bán › {order ? 'Chỉnh sửa' : 'Tạo mới'}</span>
      }
    >
      <form
        className="sales-form sales-create-form"
        onSubmit={async (e) => {
          e.preventDefault()
          if (saveLock.current) return
          if (
            !lines.length ||
            lines.length > 200 ||
            lines.some(
              (l) =>
                !Number.isInteger(l.quantity) ||
                l.quantity < 1 ||
                l.quantity > 100000,
            ) ||
            !pricePreview?.priced ||
            !pricePreview.withinThreshold
          ) {
            setError(
              'Kiểm tra số lượng, giá và ngưỡng chiết khấu trước khi lưu.',
            )
            return
          }
          saveLock.current = true
          setBusy(true)
          setError('')
          try {
            const body = JSON.parse(previewBody)
            const result = order
              ? await axiosClient.put<OrderDto>('/sales-orders/' + order.id, {
                  ...body,
                  storeId: undefined,
                  version: order.version,
                })
              : await axiosClient.post<OrderDto>('/sales-orders', body)
            navigate('/sales-orders/' + result.data.id)
          } catch (error) {
            setError(inventoryError(error))
          } finally {
            saveLock.current = false
            setBusy(false)
          }
        }}
      >
        <InventoryPanel title="Khách hàng và loại giá">
          {scope.owner && !order && (
            <WarehouseFilter
              owner
              stores={scope.stores}
              value={warehouse}
              onChange={setWarehouse}
            />
          )}
          <div className="stock-filters sales-customer-fields">
            <label>
              Tìm khách hàng
              <input
                value={customerQuery}
                onChange={(e) => setCustomerQuery(e.target.value)}
                placeholder="Tên, số điện thoại…"
              />
            </label>
            <label>
              Khách hàng
              <select
                value={
                  customer?.id ??
                  (!customerTouched ? order?.customerId : undefined) ??
                  ''
                }
                onChange={(e) => {
                  _setCustomerTouched(true)
                  setCustomer(
                    customers.data?.items.find(
                      (c) => c.id === Number(e.target.value),
                    ),
                  )
                }}
              >
                <option value="">Khách lẻ</option>
                {order?.customerId && !customerTouched && !customer && (
                  <option value={order.customerId}>{order.customerName}</option>
                )}
                {[
                  ...(customer ? [customer] : []),
                  ...(customers.data?.items ?? []).filter(
                    (c) => c.id !== customer?.id,
                  ),
                ].map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.customerName} · {c.phone ?? 'Chưa có SĐT'}
                  </option>
                ))}
              </select>
            </label>
            {!customer && (
              <label>
                Tên khách lẻ
                <input
                  maxLength={150}
                  value={walkin}
                  onChange={(e) => setWalkin(e.target.value)}
                  placeholder="Khách lẻ"
                />
              </label>
            )}
            {!customer && (
              <label>
                Số điện thoại khách lẻ
                <input
                  maxLength={20}
                  value={walkPhone}
                  onChange={(e) => setWalkPhone(e.target.value)}
                />
              </label>
            )}
            <button type="button" onClick={() => setQuick(true)}>
              + Thêm nhanh khách hàng
            </button>
          </div>
          {customer && (
            <p className="sales-customer-credit">
              {customer.creditStatus === 'ELIGIBLE'
                ? 'Được mua chịu'
                : 'Chưa được mua chịu'}{' '}
              · Công nợ: {money.format(customer.totalDebt)}
            </p>
          )}
          <InventoryNotice
            loading={customers.loading}
            error={customers.error}
          />
          <fieldset className="sales-price-types">
            <legend>
              Loại giá <span>*</span>
            </legend>
            <div>
              {(['RETAIL', 'WHOLESALE'] as const).map((value) => (
                <label key={value} className={type === value ? 'selected' : ''}>
                  <input
                    type="radio"
                    name="priceType"
                    value={value}
                    checked={type === value}
                    onChange={() => {
                      setType(value)
                      setDiscount('0')
                    }}
                  />
                  {value === 'RETAIL' ? 'Bán lẻ' : 'Bán buôn'}
                </label>
              ))}
            </div>
          </fieldset>
        </InventoryPanel>
        <aside className="sales-price-card">
          <h2>Giá của đơn</h2>
          <dl>
            <div>
              <dt>Tổng theo giá bán lẻ</dt>
              <dd>
                {pricePreview?.priced
                  ? money.format(pricePreview.referenceTotal)
                  : !lines.length
                    ? money.format(0)
                    : 'Chưa có giá cập nhật'}
              </dd>
            </div>
          </dl>
          <label>
            Chiết khấu cho cả đơn
            <div className="sales-discount-input">
              <input
                aria-label="Chiết khấu cho cả đơn"
                type="number"
                min="0"
                max="99.99"
                step="0.01"
                disabled={type !== 'WHOLESALE'}
                value={type === 'WHOLESALE' ? discount : '0'}
                onChange={(e) => setDiscount(e.target.value)}
              />
              <span>%</span>
            </div>
          </label>
          <dl>
            <div>
              <dt>Tiền chiết khấu</dt>
              <dd>
                {pricePreview?.priced
                  ? '− ' + money.format(pricePreview.discountAmount)
                  : !lines.length
                    ? money.format(0)
                    : 'Chưa có giá cập nhật'}
              </dd>
            </div>
            <div className="sales-grand-total">
              <dt>Tổng tiền</dt>
              <dd>
                {pricePreview?.priced
                  ? money.format(pricePreview.total)
                  : !lines.length
                    ? money.format(0)
                    : previewError
                      ? 'Không tải được giá'
                      : pricePreview
                        ? 'Chưa đủ giá bán'
                        : 'Đang cập nhật giá…'}
              </dd>
            </div>
          </dl>
          <p>
            Ngưỡng chiết khấu đang áp dụng:{' '}
            {pricePreview
              ? pricePreview.discountThreshold + '%'
              : 'Chưa có dữ liệu'}
          </p>
          <button
            className="sales-primary"
            disabled={
              busy ||
              !lines.length ||
              !pricePreview?.priced ||
              !pricePreview.withinThreshold
            }
          >
            {busy ? 'Đang lưu…' : order ? 'Lưu phiên bản mới' : 'Tạo đơn'}
          </button>
          <Link className="sales-cancel" to="/sales-orders">
            Quay lại
          </Link>
          {previewError && (
            <p role="alert" className="stock-error">
              {previewError}
            </p>
          )}
          {error && (
            <p role="alert" className="stock-error">
              {error}
            </p>
          )}
          {lines.length > 0 && !pricePreview && !previewError && (
            <small>Đang cập nhật giá…</small>
          )}
          {pricePreview && !pricePreview.withinThreshold && (
            <p role="alert">Chiết khấu vượt ngưỡng đang áp dụng.</p>
          )}
        </aside>
        <div className="sales-parts-card">
          <InventoryPanel
            title="Phụ tùng"
            action={
              <button type="button" onClick={() => setCamera(true)}>
                Dùng camera
              </button>
            }
          >
            <div className="stock-filters">
              <label>
                Thêm phụ tùng
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Tên, SKU hoặc mã vạch…"
                />
              </label>
              <label>
                Quét mã vạch
                <input
                  value={scan}
                  onChange={(e) => {
                    setScan(e.target.value)
                    setQuery(e.target.value)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      void scanBarcode(scan.trim())
                    }
                  }}
                  placeholder="Đưa máy quét vào mã vạch, hoặc gõ mã rồi bấm Enter"
                />
              </label>
            </div>
            <InventoryNotice
              loading={products.loading}
              error={products.error}
            />
            {query && (
              <ul className="sales-results">
                {products.data?.items.map((product) => (
                  <li key={product.id}>
                    <span>
                      {product.partName}
                      <small>
                        {product.sku} ·{' '}
                        {product.retailPrice == null
                          ? 'Chưa có giá bán'
                          : money.format(product.retailPrice)}
                      </small>
                    </span>
                    <button type="button" onClick={() => add(product)}>
                      Thêm
                    </button>
                  </li>
                ))}
                {products.data && !products.data.items.length && (
                  <li>Không tìm thấy phụ tùng.</li>
                )}
              </ul>
            )}
            <div className="stock-table-scroll">
              <table className="stock-table">
                <thead>
                  <tr>
                    <th>Phụ tùng</th>
                    <th>Tồn khả dụng</th>
                    <th>Số lượng</th>
                    <th>Đơn giá bán lẻ</th>
                    <th>Đơn giá sau chiết khấu</th>
                    <th>Thành tiền</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map(({ product, quantity }) => (
                    <tr key={product.id}>
                      <td>
                        {product.partName}
                        <small>{product.sku}</small>
                      </td>
                      <td>
                        {pricePreview?.lines.find(
                          (l) => l.productId === product.id,
                        )?.sellableQty ??
                          product.availableQty ??
                          'Chưa có dữ liệu'}
                      </td>
                      <td>
                        <input
                          aria-label={'Số lượng ' + product.sku}
                          type="number"
                          min="1"
                          max="100000"
                          step="1"
                          value={quantity}
                          onChange={(e) =>
                            setLines((previous) =>
                              previous.map((l) =>
                                l.product.id === product.id
                                  ? { ...l, quantity: Number(e.target.value) }
                                  : l,
                              ),
                            )
                          }
                        />
                      </td>
                      <td>
                        {!pricePreview
                          ? 'Đang cập nhật giá…'
                          : pricePreview.lines.find(
                                (l) => l.productId === product.id,
                              )?.retailPrice == null
                            ? 'Chưa có giá'
                            : money.format(
                                pricePreview.lines.find(
                                  (l) => l.productId === product.id,
                                )!.retailPrice!,
                              )}
                      </td>
                      <td>
                        {!pricePreview
                          ? 'Đang cập nhật giá…'
                          : pricePreview.lines.find(
                                (l) => l.productId === product.id,
                              )?.actualUnitPrice == null
                            ? 'Chưa có giá'
                            : money.format(
                                pricePreview.lines.find(
                                  (l) => l.productId === product.id,
                                )!.actualUnitPrice!,
                              )}
                      </td>
                      <td>
                        {!pricePreview
                          ? 'Đang cập nhật giá…'
                          : pricePreview.lines.find(
                                (l) => l.productId === product.id,
                              )?.lineTotal == null
                            ? 'Chưa tính được'
                            : money.format(
                                pricePreview.lines.find(
                                  (l) => l.productId === product.id,
                                )!.lineTotal!,
                              )}
                      </td>
                      <td>
                        <button
                          type="button"
                          aria-label={'Bỏ ' + product.sku}
                          onClick={() =>
                            setLines((previous) =>
                              previous.filter(
                                (l) => l.product.id !== product.id,
                              ),
                            )
                          }
                        >
                          Bỏ
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!lines.length && (
                    <tr>
                      <td colSpan={7} className="stock-empty">
                        Tìm hoặc quét mã phụ tùng để thêm vào đơn.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {error && (
              <p role="alert" className="stock-error">
                {error}
              </p>
            )}
            {lines.some(
              (l) => l.quantity < 1 || !Number.isInteger(l.quantity),
            ) && <p role="alert">Số lượng đặt phải là số nguyên dương.</p>}
          </InventoryPanel>
        </div>
      </form>
      {camera && (
        <BarcodeCamera
          onClose={() => setCamera(false)}
          onCode={(code) => {
            setCamera(false)
            void scanBarcode(code)
          }}
        />
      )}
      {quick && (
        <CustomerForm
          onClose={() => setQuick(false)}
          onSaved={(value) => {
            _setCustomerTouched(true)
            setCustomer(value)
            setQuick(false)
          }}
        />
      )}
    </Shell>
  )
}
export function SalesOrderDetailPage() {
  const { id } = useParams()
  const scope = useInventoryScope()
  const [revision, setRevision] = useState(0),
    [notice, setNotice] = useState('')
  useEffect(() => {
    const changed = (event: Event) => {
      setNotice((event as CustomEvent<string>).detail)
      setRevision((n) => n + 1)
    }
    window.addEventListener('sales-changed', changed)
    return () => window.removeEventListener('sales-changed', changed)
  }, [])
  const resource = useInventoryData<OrderDto>(
    '/sales-orders/' + id,
    {},
    revision,
    !!id && /^[1-9]\d*$/.test(id),
  )
  return (
    <>
      {notice && (
        <p role="status" className="stock-notice">
          {notice}
        </p>
      )}
      <InventoryNotice loading={resource.loading} error={resource.error} />
      <SalesOrderDetailView
        key={JSON.stringify(resource.data ?? id)}
        order={resource.data ? orderFromDto(resource.data) : undefined}
        id={id}
        role={scope.user?.role ?? ''}
      />
    </>
  )
}
export function SalesOrderDetailView({
  order,
  id,
  role,
}: {
  order?: SalesOrder
  id?: string
  role: string
}) {
  const staff = role === 'STAFF',
    bm = role === 'BRANCH_MANAGER'
  const [params, setParams] = useSearchParams()
  const [action, setAction] = useState<string | undefined>(() =>
    params.get('action') === 'assign' && order?.actions?.canAssignPicker
      ? 'assign'
      : params.get('action') === 'confirm' && order?.actions?.canConfirm
        ? 'confirm'
        : params.get('action') === 'payment' && order?.actions?.canRecordPayment
          ? 'payment'
          : '',
  )
  useEffect(() => {
    if (!order || !params.has('action')) return
    const next = new URLSearchParams(params)
    next.delete('action')
    setParams(next, { replace: true })
  }, [order, params, setParams])
  const steps = ['AWAITING_PICKING', 'PICKED', 'CONFIRMED', 'COMPLETED']
  const stage = order ? steps.indexOf(order.status) : -1
  const financial =
    order?.total ??
    (order
      ? salesTotal(
          order.lines.map((l) => ({
            quantity: ['CONFIRMED', 'COMPLETED'].includes(order.status)
              ? (l.delivered ?? 0)
              : l.requested,
            price: l.retailPrice,
          })),
          order.discount,
        )
      : null)
  const reference =
    order?.lines.reduce(
      (sum, l) =>
        sum +
        (l.retailPrice ?? 0) *
          (['CONFIRMED', 'COMPLETED'].includes(order.status)
            ? (l.delivered ?? 0)
            : l.requested),
      0,
    ) ?? 0
  const historyNames: Record<string, string> = {
    CREATED: 'Tạo đơn bán',
    VERSIONED: 'Lưu phiên bản đơn',
    PICKER_ASSIGNED: 'Giao lấy hàng',
    PICKED: 'Gửi số lượng đã lấy',
    CONFIRMED: 'Xác nhận đơn',
    PAYMENT_REJECTED: 'Từ chối thanh toán',
    COMPLETED: 'Hoàn tất đơn',
    CANCELLED: 'Hủy đơn',
  }
  return (
    <Shell
      title={'Đơn bán' + (order ? ' ' + order.code : '')}
      actions={
        <span>
          Trang chủ › <Link to="/sales-orders">Đơn bán</Link> ›{' '}
          {order?.code ?? id}
        </span>
      }
    >
      <div
        className={'sales-detail-layout' + (staff ? ' sales-detail-staff' : '')}
      >
        <div className="sales-detail-main">
          <section className="sales-detail-overview">
            <div className="sales-detail-toolbar">
              <div className="sales-detail-identity">
                <strong>{order?.code ?? 'Đơn bán'}</strong>
                {order && (
                  <span className={'sales-status sales-status-' + order.status}>
                    {salesStates[order.status]}
                  </span>
                )}
                <span className="sales-version">
                  Phiên bản {order?.version ?? '—'}
                </span>
              </div>
              <div className="sales-detail-actions">
                {order && (bm || role === 'OWNER') && (
                  <>
                    {order.actions?.canUpdate && (
                      <Link to={'/sales-orders/' + order.id + '/edit'}>
                        Sửa đơn
                      </Link>
                    )}
                    {order.actions?.canAssignPicker && (
                      <button onClick={() => setAction('assign')}>
                        Giao lấy hàng
                      </button>
                    )}
                    {order.actions?.canConfirm && (
                      <button onClick={() => setAction('confirm')}>
                        Xác nhận đơn
                      </button>
                    )}
                    {(order.actions?.canRecordPayment ||
                      order.actions?.canRecordCredit) && (
                      <>
                        <button
                          disabled={!order.actions?.canRecordPayment}
                          onClick={() => setAction('payment')}
                        >
                          Ghi nhận thanh toán
                        </button>
                        <button
                          disabled={!order.actions?.canRecordCredit}
                          onClick={() => setAction('credit')}
                        >
                          Ghi nhận bán chịu
                        </button>
                      </>
                    )}
                    {(order.actions?.canCancel ?? mayCancel(order)) && (
                      <button onClick={() => setAction('cancel')}>
                        Hủy đơn
                      </button>
                    )}
                    {order.actions?.canRefund && (
                      <button onClick={() => setAction('refund')}>
                        Hoàn tiền
                      </button>
                    )}
                    {order.actions?.canComplete && (
                      <button onClick={() => setAction('complete')}>
                        Hoàn tất đơn
                      </button>
                    )}
                    {order.payments?.some((p) => p.status === 'UNVERIFIED') &&
                      !['COMPLETED', 'CANCELLED'].includes(order.status) && (
                        <>
                          <button onClick={() => setAction('verify')}>
                            Xác minh khoản tiền
                          </button>
                          <button onClick={() => setAction('reject')}>
                            Từ chối khoản tiền
                          </button>
                        </>
                      )}
                    <Link to="/unmet-demand">Nhu cầu chưa đáp ứng</Link>
                  </>
                )}
                {order?.actions?.canRecordPicking && (
                  <Link to={'/sales-orders/' + order.id + '/pick'}>
                    Ghi số đã nhặt
                  </Link>
                )}
              </div>
            </div>
            {order && order.status !== 'CANCELLED' && (
              <ol className="sales-progress">
                {[
                  'Chờ lấy hàng',
                  'Chờ xác nhận',
                  'Chờ thanh toán',
                  'Hoàn tất',
                ].map((label, index) => (
                  <li key={label} className={index <= stage ? 'reached' : ''}>
                    {label}
                  </li>
                ))}
              </ol>
            )}
            <dl className="sales-detail-facts">
              <div>
                <dt>Khách hàng</dt>
                <dd>
                  {order?.customerName ?? '—'}
                  {!staff && order?.customerPhone && (
                    <small>{order.customerPhone}</small>
                  )}
                </dd>
              </div>
              {!staff && (
                <div>
                  <dt>Loại giá</dt>
                  <dd>
                    {order?.priceType === 'WHOLESALE'
                      ? 'Bán buôn · chiết khấu ' + order.discount + '%'
                      : 'Bán lẻ'}
                  </dd>
                </div>
              )}
              <div>
                <dt>Người lấy hàng</dt>
                <dd>{order?.assigneeName ?? 'Chưa giao'}</dd>
              </div>
              <div>
                <dt>Ngày tạo</dt>
                <dd>
                  {order ? dateTime(order.createdAt) : '—'}
                  <small>{order?.storeName}</small>
                </dd>
              </div>
            </dl>
          </section>
          <section className="sales-detail-products">
            <div className="stock-table-scroll">
              <table className="stock-table">
                <thead>
                  <tr>
                    <th>Phụ tùng</th>
                    <th>Số yêu cầu</th>
                    <th>Đã lấy</th>
                    <th>Giao</th>
                    {!staff && (
                      <>
                        <th>Đơn giá</th>
                        <th>Thành tiền</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {order?.lines.map((l) => {
                    const price =
                      l.actualUnitPrice ??
                      (l.retailPrice == null
                        ? null
                        : discountedPrice(l.retailPrice, order.discount))
                    const qty = ['CONFIRMED', 'COMPLETED'].includes(
                      order.status,
                    )
                      ? (l.delivered ?? 0)
                      : l.requested
                    return (
                      <tr key={l.productId}>
                        <td>
                          {l.partName}
                          <small>{l.sku}</small>
                        </td>
                        <td>{l.requested}</td>
                        <td
                          className={
                            l.picked != null && l.picked < l.requested
                              ? 'sales-short'
                              : ''
                          }
                        >
                          {l.picked ?? '—'}
                        </td>
                        <td>{l.delivered ?? '—'}</td>
                        {!staff && (
                          <>
                            <td>
                              {price == null
                                ? 'Chưa có giá'
                                : money.format(price)}
                              {price != null &&
                                l.retailPrice != null &&
                                price !== l.retailPrice && (
                                  <small>
                                    <del>{money.format(l.retailPrice)}</del>
                                  </small>
                                )}
                            </td>
                            <td>
                              {price == null
                                ? 'Chưa tính được'
                                : money.format(price * qty)}
                            </td>
                          </>
                        )}
                      </tr>
                    )
                  })}
                  {!order && (
                    <tr>
                      <td colSpan={staff ? 4 : 6} className="stock-empty">
                        Chưa có dữ liệu chi tiết đơn bán.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {!staff && order && (
              <dl className="sales-detail-totals">
                <div>
                  <dt>
                    Tổng theo giá bán lẻ (
                    {['CONFIRMED', 'COMPLETED'].includes(order.status)
                      ? 'số giao'
                      : 'số yêu cầu'}
                    )
                  </dt>
                  <dd>{money.format(reference)}</dd>
                </div>
                <div>
                  <dt>Chiết khấu {order.discount}%</dt>
                  <dd>
                    −{' '}
                    {financial == null
                      ? 'Chưa tính được'
                      : money.format(Math.max(0, reference - financial))}
                  </dd>
                </div>
                <div className="total">
                  <dt>Tổng tiền</dt>
                  <dd>
                    {financial == null
                      ? 'Chưa tính được'
                      : money.format(financial)}
                  </dd>
                </div>
                <div>
                  <dt>Đã thu</dt>
                  <dd>{money.format(order.netPaid)}</dd>
                </div>
                {order.credit > 0 && (
                  <div>
                    <dt>Bán chịu</dt>
                    <dd>{money.format(order.credit)}</dd>
                  </div>
                )}
                <div className="total">
                  <dt>Còn phải thu</dt>
                  <dd>
                    {order.remainingPayable == null
                      ? 'Chưa có dữ liệu'
                      : money.format(order.remainingPayable)}
                  </dd>
                </div>
              </dl>
            )}
          </section>
          {!staff && order && <SalesVersions id={order.id} />}
          {!staff && (
            <section className="sales-payment-card">
              <h2>Thanh toán</h2>
              {order?.payments?.length ? (
                <ul>
                  {order.payments.map((payment) => (
                    <li key={payment.id}>
                      <div>
                        <strong>
                          {payment.type === 'REFUND' ? 'Hoàn tiền' : 'Thu tiền'}{' '}
                          {money.format(payment.amount)}
                        </strong>{' '}
                        ·{' '}
                        {payment.method === 'CASH'
                          ? 'Tiền mặt'
                          : 'Chuyển khoản'}
                        <small>
                          {dateTime(payment.recordedAt)} ·{' '}
                          {payment.recordedBy ?? ''}
                        </small>
                      </div>
                      <span className="sales-version">
                        {payment.status === 'VERIFIED'
                          ? 'Đã xác minh'
                          : payment.status === 'REJECTED'
                            ? 'Đã từ chối'
                            : 'Chờ xác minh'}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>Chưa có khoản thanh toán.</p>
              )}
            </section>
          )}
        </div>
        {!staff && (
          <aside className="sales-detail-history">
            <h2>Lịch sử</h2>
            {order?.events.length ? (
              <ol>
                {[...order.events].reverse().map((event, i) => (
                  <li key={i}>
                    <span className="sales-history-dot">✓</span>
                    <div>
                      {historyNames[event.text] ?? event.text}
                      <small>
                        {dateTime(event.at)} · {event.by}
                      </small>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p>Chưa có lịch sử xử lý.</p>
            )}
          </aside>
        )}
      </div>
      {action === 'assign' &&
        (bm || role === 'OWNER') &&
        Number(id ?? order?.id) > 0 && (
          <SalesAssignmentDialog
            order={order}
            documentId={Number(id ?? order?.id)}
            onClose={() => setAction(undefined)}
          />
        )}
      {action && action !== 'assign' && order && (
        <SalesSettlementDialog
          key={action}
          action={action}
          onCredit={() => setAction('credit')}
          order={order}
          onClose={() => setAction(undefined)}
        />
      )}
    </Shell>
  )
}
export function RecordPickedPage() {
  const { id } = useParams()
  const resource = useInventoryData<OrderDto>(
    '/sales-orders/' + id,
    {},
    0,
    !!id && /^[1-9]\d*$/.test(id),
  )
  return (
    <>
      <InventoryNotice loading={resource.loading} error={resource.error} />
      <RecordPickedView
        key={JSON.stringify(resource.data ?? id)}
        id={id}
        order={resource.data ? orderFromDto(resource.data) : undefined}
      />
    </>
  )
}
export function RecordPickedView({
  order,
  id,
}: {
  order?: SalesOrder
  id?: string
}) {
  const navigate = useNavigate(),
    lock = useRef(false)
  const [busy, setBusy] = useState(false),
    [saved, setSaved] = useState('')
  const [lines, setLines] = useState<SalesLine[]>(() =>
      [...(order?.lines ?? [])].sort((a, b) =>
        (a.binLocation ?? '').localeCompare(b.binLocation ?? '', 'vi'),
      ),
    ),
    [code, setCode] = useState(''),
    [error, setError] = useState('')
  const [onlyMissing, setOnlyMissing] = useState(false),
    [camera, setCamera] = useState(false)
  const recorded = lines.filter(
    (l) =>
      l.picked != null &&
      Number.isInteger(l.picked) &&
      l.picked >= 0 &&
      l.picked <= l.requested,
  ).length
  const shortage = lines.filter(
    (l) => l.picked != null && l.picked < l.requested,
  ).length
  function scanItem(value: string) {
    const hit = lines.find(
      (l) => l.sku === value || l.barcodes?.includes(value),
    )
    if (!hit || !editable) {
      setError('Không tìm thấy mã trong đơn.')
      return
    }
    setLines((previous) =>
      previous.map((l) =>
        l.productId === hit.productId
          ? {
              ...l,
              picked: Math.min(l.requested, (l.picked ?? 0) + 1),
              short: (l.picked ?? 0) + 1 < l.requested,
            }
          : l,
      ),
    )
    setCode('')
    setError('')
  }
  const editable = order?.actions?.canRecordPicking ?? false
  return (
    <Shell
      title={'Ghi số đã lấy' + (order ? ' ' + order.code : '')}
      actions={
        <span>
          Trang chủ › Việc lấy hàng ›{' '}
          <Link to={'/sales-orders/' + (order?.id ?? id)}>
            {order?.code ?? id}
          </Link>{' '}
          › Lấy hàng
        </span>
      }
    >
      <div className="sales-pick-screen">
        <InventoryPanel
          title={
            'Đơn ' +
            (order?.code ?? '') +
            ' · ' +
            (order?.customerName ?? 'Khách lẻ')
          }
        >
          <div className="sales-pick-scan">
            <label>
              Quét mã vạch
              <input
                placeholder="Đưa máy quét vào mã vạch, hoặc gõ mã rồi bấm Enter"
                disabled={!editable || busy}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    scanItem(code.trim())
                  }
                }}
              />
            </label>
            <button
              disabled={!editable || busy}
              onClick={() => setCamera(true)}
            >
              Dùng camera
            </button>
          </div>
        </InventoryPanel>
        <InventoryPanel
          title="Lấy từng mặt hàng"
          action={
            <label className="sales-pick-filter">
              <input
                type="checkbox"
                checked={onlyMissing}
                onChange={(e) => setOnlyMissing(e.target.checked)}
              />
              Chỉ dòng chưa ghi
            </label>
          }
        >
          {error && <p role="alert">{error}</p>}
          <div className="stock-table-scroll">
            <table className="stock-table">
              <thead>
                <tr>
                  <th>Phụ tùng</th>
                  <th>Số yêu cầu</th>
                  <th>Đã lấy</th>
                  <th>Lấy đủ</th>
                </tr>
              </thead>
              <tbody>
                {lines
                  .filter((l) => !onlyMissing || l.picked == null)
                  .map((l) => (
                    <tr
                      key={l.productId}
                      className={
                        l.picked === l.requested ? 'sales-pick-complete' : ''
                      }
                    >
                      <td>
                        {l.partName}
                        <small>
                          {l.sku} · kệ {l.binLocation ?? 'chưa có vị trí'}
                        </small>
                        {l.lotHint && (
                          <strong className="sales-lot">{l.lotHint}</strong>
                        )}
                        {(l.picked ?? l.requested) < l.requested && (
                          <input
                            disabled={!editable || busy}
                            aria-label={'Lý do thiếu ' + l.sku}
                            maxLength={255}
                            placeholder="Lý do thiếu hàng"
                            value={l.shortReason ?? ''}
                            onChange={(e) =>
                              setLines((previous) =>
                                previous.map((row) =>
                                  row.productId === l.productId
                                    ? {
                                        ...row,
                                        short: true,
                                        shortReason: e.target.value,
                                      }
                                    : row,
                                ),
                              )
                            }
                          />
                        )}{' '}
                      </td>
                      <td>
                        <strong>{l.requested}</strong>
                      </td>
                      <td>
                        <input
                          disabled={!editable}
                          aria-label={'Đã nhặt ' + l.sku}
                          type="number"
                          min="0"
                          max={l.requested}
                          step="1"
                          value={l.picked ?? ''}
                          onChange={(e) =>
                            setLines((previous) =>
                              previous.map((row) =>
                                row.productId === l.productId
                                  ? {
                                      ...row,
                                      picked:
                                        e.target.value === ''
                                          ? null
                                          : Number(e.target.value),
                                    }
                                  : row,
                              ),
                            )
                          }
                        />
                      </td>
                      <td>
                        <input
                          disabled={!editable}
                          type="checkbox"
                          aria-label={'Lấy đủ ' + l.sku}
                          checked={l.picked === l.requested}
                          onChange={(e) =>
                            setLines((previous) =>
                              previous.map((row) =>
                                row.productId === l.productId
                                  ? {
                                      ...row,
                                      picked: e.target.checked
                                        ? row.requested
                                        : null,
                                      short: false,
                                      shortReason: '',
                                    }
                                  : row,
                              ),
                            )
                          }
                        />
                      </td>
                    </tr>
                  ))}
                {!lines.length && (
                  <tr>
                    <td colSpan={4} className="stock-empty">
                      Chưa có dòng được giao để lấy hàng.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </InventoryPanel>
        <footer className="sales-pick-footer">
          <p>
            Đã ghi{' '}
            <strong>
              {recorded}/{lines.length}
            </strong>{' '}
            · thiếu <strong>{shortage}</strong> dòng. Còn{' '}
            {lines.length - recorded} dòng chưa ghi.
          </p>
          {saved && <p role="status">{saved}</p>}
          <div className="sales-pick-actions">
            <Link
              className="sales-cancel"
              to={'/sales-orders/' + (order?.id ?? id)}
            >
              Hủy
            </Link>
            <details className="sales-pick-drafts">
              <summary>Bản nháp trên máy</summary>{' '}
              <button
                disabled={!editable || busy}
                onClick={() => {
                  if (!order) return
                  sessionStorage.setItem(
                    'sales-pick-' + order.id + '-' + order.version,
                    JSON.stringify(
                      lines.map((l) => ({
                        productId: l.productId,
                        picked: l.picked,
                        short: l.short,
                        shortReason: l.shortReason,
                      })),
                    ),
                  )
                  setSaved('Đã lưu tạm trên trình duyệt này. Chưa gửi số nhặt.')
                }}
              >
                Lưu tạm trên máy
              </button>
              <button
                disabled={!editable || busy}
                onClick={() => {
                  if (!order) return
                  try {
                    const data = JSON.parse(
                      sessionStorage.getItem(
                        'sales-pick-' + order.id + '-' + order.version,
                      ) ?? 'null',
                    )
                    if (Array.isArray(data)) {
                      setLines((previous) =>
                        previous.map((l) => {
                          const draft = data.find(
                            (d) => d.productId === l.productId,
                          )
                          return draft
                            ? {
                                ...l,
                                picked: draft.picked,
                                short: draft.short,
                                shortReason: draft.shortReason,
                              }
                            : l
                        }),
                      )
                      setSaved('Đã khôi phục bản nháp trên máy.')
                    }
                  } catch {
                    setError('Không đọc được bản nháp.')
                  }
                }}
              >
                Khôi phục bản nháp
              </button>
            </details>
            <button
              disabled={
                !editable ||
                busy ||
                !pickedReady(lines) ||
                lines.some(
                  (l) =>
                    (l.picked ?? 0) < l.requested && !l.shortReason?.trim(),
                )
              }
              onClick={async () => {
                if (!order || lock.current) return
                lock.current = true
                setBusy(true)
                setError('')
                try {
                  await axiosClient.put(
                    '/sales-orders/' + order.id + '/picked-lines',
                    {
                      version: order.version,
                      lines: lines.map((l) => ({
                        productId: l.productId,
                        pickedQty: l.picked,
                        shortReason: l.shortReason?.trim() || null,
                      })),
                    },
                  )
                  sessionStorage.removeItem(
                    'sales-pick-' + order.id + '-' + order.version,
                  )
                  navigate('/sales-orders/' + order.id)
                } catch (error) {
                  setError(inventoryError(error))
                } finally {
                  lock.current = false
                  setBusy(false)
                }
              }}
            >
              {busy ? 'Đang gửi…' : 'Gửi số đã lấy'}
            </button>
          </div>
        </footer>
      </div>
      {camera && (
        <BarcodeCamera
          onClose={() => setCamera(false)}
          onCode={(value) => {
            setCamera(false)
            scanItem(value)
          }}
        />
      )}
    </Shell>
  )
}
export function UnmetDemandPage() {
  const [replenishment, setReplenishment] = useState<UnmetRow>()
  const scope = useInventoryScope(),
    p = scope.params,
    page = Math.max(0, Number(p.get('page')) || 0)
  const customers = useChoicePages<Customer>('/customers', p.get('q') ?? '')
  const products = useChoicePages<Product>('/products', p.get('q') ?? '')
  const selectedProduct = useInventoryData<Product>(
    '/products/' + p.get('productId'),
    {},
    0,
    !!p.get('productId'),
  )
  const selectedCustomer = useInventoryData<{ customer: Customer }>(
    '/customers/' + p.get('customerId'),
    {},
    0,
    !!p.get('customerId'),
  )
  const productOptions = [
    ...(selectedProduct.data ? [selectedProduct.data] : []),
    ...(products.data?.items ?? []).filter(
      (item) => item.id !== selectedProduct.data?.id,
    ),
  ]
  const customerOptions = [
    ...(selectedCustomer.data ? [selectedCustomer.data.customer] : []),
    ...(customers.data?.items ?? []).filter(
      (item) => item.id !== selectedCustomer.data?.customer.id,
    ),
  ]
  const data = useInventoryData<Page<UnmetRow>>(
    '/unmet-demand',
    {
      storeId: scope.storeId,
      customerId: p.get('customerId') ?? '',
      productId: p.get('productId') ?? '',
      q: p.get('q') ?? '',
      from: p.get('from') ?? '',
      to: p.get('to') ?? '',
      page,
      size: 20,
    },
    0,
    !(p.get('from') && p.get('to') && p.get('from')! > p.get('to')!),
  )
  return (
    <Shell
      title="Nhu cầu chưa đáp ứng"
      actions={
        <span>
          Trang chủ › <Link to="/sales-orders">Đơn bán</Link> › Nhu cầu chưa đáp
          ứng
        </span>
      }
    >
      <div
        className={'sales-unmet' + (scope.owner ? ' sales-unmet-owner' : '')}
      >
        <InventoryPanel title="Nhu cầu theo cửa hàng">
          <div className="stock-filters sales-unmet-filters">
            <WarehouseFilter
              owner={scope.owner}
              stores={scope.stores}
              value={scope.storeId}
              onChange={(storeId) => scope.filter({ storeId })}
            />
            <label>
              Tìm phụ tùng, khách hàng
              <input
                placeholder="Tên phụ tùng, SKU hoặc khách hàng…"
                value={p.get('q') ?? ''}
                onChange={(e) => scope.filter({ q: e.target.value }, true)}
              />
            </label>
            <label>
              Phụ tùng
              <select
                value={p.get('productId') ?? ''}
                onChange={(e) => scope.filter({ productId: e.target.value })}
              >
                <option value="">Mọi phụ tùng</option>
                {p.get('productId') &&
                  !productOptions.some(
                    (item) => String(item.id) === p.get('productId'),
                  ) && (
                    <option value={p.get('productId')!}>
                      {selectedProduct.error
                        ? 'Không tải được phụ tùng đã chọn'
                        : 'Đang tải phụ tùng đã chọn…'}
                    </option>
                  )}
                {productOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.sku} · {item.partName}
                  </option>
                ))}
              </select>
              {products.hasMore && (
                <button
                  type="button"
                  disabled={products.loading}
                  onClick={products.loadMore}
                >
                  {products.loading ? 'Đang tải…' : 'Tải thêm phụ tùng'}
                </button>
              )}
            </label>
            <label>
              Khách hàng
              <select
                value={p.get('customerId') ?? ''}
                onChange={(e) => scope.filter({ customerId: e.target.value })}
              >
                <option value="">Mọi khách hàng</option>
                {p.get('customerId') &&
                  !customerOptions.some(
                    (item) => String(item.id) === p.get('customerId'),
                  ) && (
                    <option value={p.get('customerId')!}>
                      {selectedCustomer.error
                        ? 'Không tải được khách hàng đã chọn'
                        : 'Đang tải khách hàng đã chọn…'}
                    </option>
                  )}
                {customerOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.customerName}
                  </option>
                ))}
              </select>
              {customers.hasMore && (
                <button
                  type="button"
                  disabled={customers.loading}
                  onClick={customers.loadMore}
                >
                  {customers.loading ? 'Đang tải…' : 'Tải thêm khách hàng'}
                </button>
              )}
            </label>
            <label>
              Từ ngày
              <input
                type="date"
                value={p.get('from') ?? ''}
                max={p.get('to') ?? undefined}
                onChange={(e) => scope.filter({ from: e.target.value })}
              />
            </label>
            <label>
              Đến ngày
              <input
                type="date"
                value={p.get('to') ?? ''}
                min={p.get('from') ?? undefined}
                onChange={(e) => scope.filter({ to: e.target.value })}
              />
            </label>
          </div>
          <InventoryNotice
            loading={data.loading}
            error={
              data.error ??
              scope.storesError ??
              selectedProduct.error ??
              selectedCustomer.error ??
              products.error ??
              customers.error ??
              (p.get('from') && p.get('to') && p.get('from')! > p.get('to')!
                ? 'Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.'
                : undefined)
            }
          />
          <p className="sales-unmet-description">
            Nhu cầu được tổng hợp tự động từ đơn hoàn tất giao thiếu và đơn đã
            hủy; mặc định 30 ngày gần nhất.
          </p>
          <div className="stock-table-scroll">
            <table className="stock-table">
              <thead>
                <tr>
                  <th>Đơn bán</th>
                  {scope.owner && <th>Cửa hàng</th>}
                  <th>Khách hàng</th>
                  <th>Phụ tùng</th>
                  <th>Số lượng thiếu</th>
                  <th>Còn bán được</th>
                  <th>Ngày phát sinh</th>
                  <th>Cần làm</th>
                </tr>
              </thead>
              <tbody>
                {data.data?.items.map((row) => (
                  <tr key={row.orderId + '-' + row.productId}>
                    <td>
                      <Link to={'/sales-orders/' + row.orderId}>
                        SO-{row.orderId}
                      </Link>
                    </td>
                    {scope.owner && <td>{row.storeName}</td>}
                    <td>{row.customerName ?? 'Khách lẻ'}</td>
                    <td>
                      {row.partName}
                      <small>{row.sku}</small>
                    </td>
                    <td>
                      <strong>{row.missingQty}</strong>{' '}
                      <span className="sales-unmet-unit">{row.baseUnit}</span>
                    </td>
                    <td>{row.sellableQty}</td>
                    <td>{dateTime(row.occurredAt)}</td>
                    <td>
                      <div className="sales-unmet-actions">
                        <Link
                          to={
                            '/sales-orders/new?productId=' +
                            row.productId +
                            '&quantity=' +
                            row.missingQty +
                            '&storeId=' +
                            row.storeId +
                            (row.customerId
                              ? '&customerId=' + row.customerId
                              : '')
                          }
                        >
                          Lập đơn bán
                        </Link>
                        <button onClick={() => setReplenishment(row)}>
                          Yêu cầu bổ sung
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {data.data && !data.data.items.length && (
                  <tr>
                    <td colSpan={scope.owner ? 8 : 7} className="stock-empty">
                      Không có nhu cầu chưa đáp ứng phù hợp.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination
            total={data.data?.totalItems ?? 0}
            page={page}
            size={20}
            loading={data.loading}
            onPage={(page) =>
              scope.setParams((previous) => {
                const next = new URLSearchParams(previous)
                next.set('page', String(page))
                return next
              })
            }
          />
        </InventoryPanel>
      </div>
      {replenishment && (
        <DemandReplenishment
          row={replenishment}
          onClose={() => setReplenishment(undefined)}
        />
      )}
    </Shell>
  )
}
