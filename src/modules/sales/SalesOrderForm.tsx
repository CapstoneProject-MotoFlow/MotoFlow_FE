/**
 * File: modules/sales/SalesOrderForm.tsx
 * Loại: MÀN HÌNH — Tạo / sửa đơn bán (route /sales-orders/new, /sales-orders/:id/edit).
 * Công dụng: Bố cục kiểu quầy bán hàng (POS) theo ảnh mẫu 12/11: bên trái ô tìm phụ tùng + bảng dòng hàng + ghi chú,
 * bên phải cửa hàng, khách hàng, loại giá, tổng tiền, chiết khấu, "Khách cần trả" và nút Tạo đơn / Hủy đơn.
 * Nghiệp vụ giữ nguyên: giá lấy từ API preview; chiết khấu một mức cho cả đơn, chỉ cho đơn bán buôn, dưới ngưỡng
 * (BR-10, BR-12, BR-16); Owner phải chọn cửa hàng bán (MSG157); vượt tồn khả dụng vẫn tạo được đơn.
 */
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import axiosClient from '../../shared/api/axiosClient'
import PageHeader from '../../shared/ui/PageHeader'
import Icon from '../../shared/ui/Icon'
import ConfirmDialog from '../../shared/ui/ConfirmDialog'
import { formatDateTime } from '../../shared/utils/format'
import {
  inventoryError,
  useInventoryData,
  useInventoryScope,
} from '../inventory/api'
import type { Page } from '../inventory/types'
import { money, number } from '../inventory/presentation'
import CustomerForm from '../customers/components/CustomerForm'
import type { Customer } from '../customers/types'
import {
  discountedPrice,
  salesTotal,
  validQuantity,
  type SalesOrder,
} from './salesModel'
import type { OrderDto } from './salesApi'

import { useFormValidation } from '../../shared/hooks/useFormValidation'
import FieldError from '../../shared/ui/FieldError'
export type SalesProduct = {
  id: number
  sku: string
  partName: string
  baseUnit: string
  retailPrice: number | null
  status: string
  availableQty?: number | null
}
type DraftLine = { product: SalesProduct; quantity: number }
type SalesCustomer = Pick<
  Customer,
  'id' | 'customerName' | 'phone' | 'creditStatus' | 'totalDebt'
>
type SalesDraft = {
  warehouse: string
  customer?: SalesCustomer
  walkin: string
  walkPhone: string
  type: SalesOrder['priceType']
  discount: string
  lines: DraftLine[]
  note?: string
}
type Preview = {
  key: string
  total: number
  referenceTotal: number
  discountAmount: number
  priced: boolean
  withinThreshold: boolean
  discountThreshold: number | null
  lines: {
    productId: number
    sellableQty: number
    shortQty: number
    retailPrice: number | null
    actualUnitPrice: number | null
    lineTotal: number | null
  }[]
}

function readSalesDraft(key: string) {
  try {
    const saved = localStorage.getItem(key)
    if (!saved) return undefined
    const draft = JSON.parse(saved) as SalesDraft | null
    if (!draft || !Array.isArray(draft.lines)) return undefined
    return { saved, draft }
  } catch {
    return undefined
  }
}

const vnd = (value: number) => money.format(value)

export function SalesOrderFormView({
  order,
  initialProduct,
  initialCustomer,
  initialQuantity = 1,
}: {
  order?: SalesOrder
  initialCustomer?: Customer
  initialProduct?: SalesProduct
  initialQuantity?: number
}) {
  const [prefill] = useSearchParams()
  const navigate = useNavigate(),
    scope = useInventoryScope(),
    saveLock = useRef(false),
    productInput = useRef<HTMLInputElement>(null)
  const draftKey =
    !order && scope.user
      ? `motoflow:sales-draft:${JSON.stringify([
          scope.user.id ?? scope.user.username,
          scope.user.role,
          scope.user.storeId,
        ])}`
      : undefined
  const [restored] = useState(() =>
    draftKey && !prefill.size ? readSalesDraft(draftKey) : undefined,
  )
  const draft = restored?.draft
  const savedDraft = useRef(restored?.saved)
  const [draftNotice, setDraftNotice] = useState(
    restored ? 'Đã mở lại đơn nháp lưu trên máy này.' : '',
  )
  const [busy, setBusy] = useState(false)
  const [customerTouched, setCustomerTouched] = useState(false)
  const [walkPhone, setWalkPhone] = useState(
    draft?.walkPhone ?? order?.customerPhone ?? '',
  )
  const [warehouse, setWarehouse] = useState(
    String(
      draft?.warehouse ??
        order?.storeId ??
        (scope.owner ? prefill.get('storeId') : scope.user?.storeId) ??
        '',
    ),
  )
  const [previewFailure, setPreviewFailure] = useState<{
    key: string
    message: string
  }>()
  const [customerQuery, setCustomerQuery] = useState('')
  const [customerOpen, setCustomerOpen] = useState(false)
  const [customer, setCustomer] = useState<SalesCustomer | undefined>(
    draft?.customer ?? initialCustomer,
  )
  const [quick, setQuick] = useState(false)
  const [walkin, setWalkin] = useState(
    draft?.walkin ?? (order?.customerId ? '' : (order?.customerName ?? '')),
  )
  const [query, setQuery] = useState('')
  const [productOpen, setProductOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const [type, setType] = useState(draft?.type ?? order?.priceType ?? 'RETAIL')
  const [discount, setDiscount] = useState(
    draft?.discount ?? String(order?.discount ?? 0),
  )
  const [note, setNote] = useState(draft?.note ?? '')
  const [lines, setLines] = useState<DraftLine[]>(
    () =>
      draft?.lines ??
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
  )
  const [error, setError] = useState('')
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [now] = useState(() => formatDateTime(new Date()))

  // F3: đưa con trỏ về ô tìm phụ tùng (thói quen của phần mềm bán hàng phổ biến).
  useEffect(() => {
    function onKey(event: globalThis.KeyboardEvent) {
      if (event.key === 'F3') {
        event.preventDefault()
        productInput.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const customers = useInventoryData<Page<Customer>>('/customers', {
    q: customerQuery,
    size: 20,
  })
  const products = useInventoryData<Page<SalesProduct>>(
    '/products',
    { q: query.trim(), size: 20, status: 'ACTIVE' },
    0,
    productOpen,
  )
  const [preview, setPreview] = useState<Preview>()
  const discountRate = type === 'WHOLESALE' ? Number(discount) : 0
  const validDiscount =
    type === 'RETAIL' || /^(?:\d{1,2}(?:\.\d{0,2})?|\.\d{1,2})?$/.test(discount)
  const invalidQty = lines.some(
    ({ quantity }) => !validQuantity(quantity) || quantity < 1,
  )
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
    discountRate,
    lines: lines.map((l) => ({
      productId: l.product.id,
      quantity: l.quantity,
    })),
  })
  const needsStore = scope.owner && !order && !warehouse
  const previewEnabled =
    lines.length > 0 && !needsStore && validDiscount && !invalidQty
  useEffect(() => {
    if (!previewEnabled) return
    const controller = new AbortController()
    const timer = setTimeout(() => {
      void axiosClient
        .post('/sales-orders/preview', JSON.parse(previewBody), {
          signal: controller.signal,
        })
        .then(({ data }) => {
          if (!controller.signal.aborted) {
            setPreview({ ...data, key: previewBody })
            setPreviewFailure(undefined)
          }
        })
        .catch((error) => {
          if (!controller.signal.aborted)
            setPreviewFailure({
              key: previewBody,
              message: inventoryError(error),
            })
        })
    }, 300)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [previewBody, previewEnabled])
  const pricePreview =
    previewEnabled && preview?.key === previewBody ? preview : undefined
  const previewError =
    previewEnabled && previewFailure?.key === previewBody
      ? previewFailure.message
      : undefined
  const cartLines = lines.map(({ product, quantity }) => ({
    price: product.retailPrice,
    quantity,
  }))
  const referenceTotal = pricePreview
    ? pricePreview.priced
      ? pricePreview.referenceTotal
      : null
    : invalidQty
      ? null
      : salesTotal(cartLines, 0)
  const total = pricePreview
    ? pricePreview.priced
      ? pricePreview.total
      : null
    : validDiscount && !invalidQty
      ? salesTotal(cartLines, discountRate)
      : null
  const discountAmount = pricePreview?.priced
    ? pricePreview.discountAmount
    : referenceTotal != null && total != null
      ? referenceTotal - total
      : null
  const lineOf = (productId: number) =>
    pricePreview?.lines.find((l) => l.productId === productId)
  const totalQty = lines.reduce(
    (sum, l) => sum + (Number.isFinite(l.quantity) ? l.quantity : 0),
    0,
  )
  const storeName = order
    ? order.storeName
    : scope.owner
      ? scope.stores.find((s) => String(s.id) === warehouse)?.storeName
      : scope.user?.storeName

  function add(product: SalesProduct) {
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
    setProductOpen(false)
    setHighlight(0)
    setError('')
    productInput.current?.focus()
  }
  function onProductKey(event: KeyboardEvent<HTMLInputElement>) {
    const items = products.data?.items ?? []
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setProductOpen(true)
      setHighlight((h) => Math.min(h + 1, Math.max(items.length - 1, 0)))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setHighlight((h) => Math.max(h - 1, 0))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      // Quét mã vạch / gõ đúng SKU rồi Enter: thêm ngay dòng khớp.
      const exact = items.find(
        (p) => p.sku.toLocaleLowerCase() === query.trim().toLocaleLowerCase(),
      )
      const pick = exact ?? items[highlight]
      if (pick) add(pick)
    } else if (event.key === 'Escape') {
      setProductOpen(false)
    }
  }
  function saveDraft() {
    if (!draftKey || saveLock.current) return
    const data: SalesDraft = {
      warehouse,
      customer: customer && {
        id: customer.id,
        customerName: customer.customerName,
        phone: customer.phone,
        creditStatus: customer.creditStatus,
        totalDebt: customer.totalDebt,
      },
      walkin,
      walkPhone,
      type,
      discount,
      lines,
      note,
    }
    setError('')
    try {
      const saved = JSON.stringify(data)
      localStorage.setItem(draftKey, saved)
      savedDraft.current = saved
      setDraftNotice('Đã lưu đơn nháp trên máy này.')
    } catch {
      setError('Không thể lưu đơn nháp trên máy này.')
    }
  }
  function discard() {
    if (draftKey) {
      try {
        localStorage.removeItem(draftKey)
      } catch {
        // Bỏ qua: trình duyệt không cho dùng bộ nhớ.
      }
    }
    navigate(order ? '/sales-orders/' + order.id : '/sales-orders')
  }

  const validation = useFormValidation()
  const unpriced = lines.find((l) => lineOf(l.product.id)?.retailPrice === null)
  // Lý do nút Tạo đơn đang khóa (review L4: nút xám phải nói thiếu gì).
  const blocker = needsStore
    ? 'Chọn cửa hàng bán trước.'
    : !lines.length
      ? 'Chưa có phụ tùng nào trong đơn.'
      : invalidQty
        ? 'Số lượng mỗi dòng phải là số nguyên từ 1 đến 100.000.'
        : !validDiscount
          ? 'Nhập chiết khấu từ 0 đến 99,99%.'
          : previewError
            ? previewError
            : !pricePreview
              ? 'Đang tính giá…'
              : unpriced
                ? `Phụ tùng ${unpriced.product.sku} chưa có giá bán lẻ đang áp dụng.`
                : !pricePreview.priced
                  ? 'Có phụ tùng chưa có giá bán.'
                  : !pricePreview.withinThreshold
                    ? `Chiết khấu phải nhỏ hơn ngưỡng ${pricePreview.discountThreshold ?? 0}% đang áp dụng.`
                    : ''

  async function submit() {
    if (saveLock.current || blocker) {
      if (blocker) setError(blocker)
      return
    }
    saveLock.current = true
    setBusy(true)
    setError('')
    try {
      // "note" được gửi kèm để BE lưu khi có trường ghi chú; BE hiện tại bỏ qua trường này.
      const body = { ...JSON.parse(previewBody), note: note.trim() || null }
      const result = order
        ? await axiosClient.put<OrderDto>('/sales-orders/' + order.id, {
            ...body,
            storeId: undefined,
            version: order.version,
          })
        : await axiosClient.post<OrderDto>('/sales-orders', body)
      if (draftKey && savedDraft.current) {
        try {
          if (localStorage.getItem(draftKey) === savedDraft.current)
            localStorage.removeItem(draftKey)
        } catch {
          // Đơn đã tạo thành công dù không xóa được nháp.
        }
      }
      navigate('/sales-orders/' + result.data.id)
    } catch (error) {
      setError(inventoryError(error))
    } finally {
      saveLock.current = false
      setBusy(false)
    }
  }

  const customerItems = [
    ...(customer ? [customer] : []),
    ...(customers.data?.items ?? []).filter((c) => c.id !== customer?.id),
  ]
  const customerLabel = customer
    ? customer.customerName + (customer.phone ? ' · ' + customer.phone : '')
    : order?.customerId && !customerTouched
      ? order.customerName
      : ''

  return (
    <main className="inventory-workspace sales-workspace pos-page">
      <PageHeader
        title={
          order
            ? 'Sửa đơn ' + order.code + ' · phiên bản ' + order.version
            : 'Tạo đơn bán'
        }
        breadcrumb={[
          { label: 'Đơn bán', to: '/sales-orders' },
          { label: order ? 'Chỉnh sửa' : 'Tạo mới' },
        ]}
      />
      <form
        className="pos-layout"
        noValidate
        onInput={validation.onInput}
        onSubmit={(event) => {
          event.preventDefault()
          if (!validation.check(event.currentTarget)) return
          void submit()
        }}
      >
        <div className="pos-left">
          <section className="pos-card pos-lines-card">
            <div className="pos-search">
              <Icon name="search" />
              <input
                ref={productInput}
                role="combobox"
                aria-expanded={productOpen}
                aria-controls="pos-product-results"
                aria-label="Tìm phụ tùng để thêm vào đơn"
                autoComplete="off"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setProductOpen(true)
                  setHighlight(0)
                }}
                onFocus={() => setProductOpen(true)}
                onBlur={() => setTimeout(() => setProductOpen(false), 150)}
                onKeyDown={onProductKey}
                placeholder="Tìm phụ tùng theo tên, SKU hoặc quét mã vạch để thêm"
              />
              <kbd title="Nhấn F3 để quay lại ô tìm">F3</kbd>
              {productOpen && (
                <ul
                  className="pos-results"
                  id="pos-product-results"
                  role="listbox"
                >
                  {products.loading && (
                    <li className="pos-results-note">Đang tìm…</li>
                  )}
                  {products.error && (
                    <li className="pos-results-note is-error">
                      {products.error}
                    </li>
                  )}
                  {products.data?.items.map((product, index) => (
                    <li
                      key={product.id}
                      role="option"
                      aria-selected={index === highlight}
                      className={index === highlight ? 'is-active' : ''}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        add(product)
                      }}
                      onMouseEnter={() => setHighlight(index)}
                    >
                      <span className="pos-result-name">
                        {product.partName}
                        <small>
                          {product.sku}
                          {product.availableQty != null &&
                            ` · có thể bán ${number.format(product.availableQty)} ${product.baseUnit}`}
                        </small>
                      </span>
                      <span className="pos-result-price">
                        {product.retailPrice == null
                          ? 'Chưa có giá'
                          : vnd(product.retailPrice)}
                      </span>
                    </li>
                  ))}
                  {products.data && !products.data.items.length && (
                    <li className="pos-results-note">
                      Không tìm thấy phụ tùng “{query.trim()}”.
                    </li>
                  )}
                </ul>
              )}
            </div>
            <div className="pos-table-wrap">
              <table className="pos-table">
                <thead>
                  <tr>
                    <th className="pos-col-no">#</th>
                    <th>Phụ tùng</th>
                    <th className="pos-col-qty">Số lượng</th>
                    <th className="pos-col-money">Đơn giá</th>
                    <th className="pos-col-money">Thành tiền</th>
                    <th className="pos-col-action" aria-label="Thao tác" />
                  </tr>
                </thead>
                <tbody>
                  {lines.map(({ product, quantity }, index) => {
                    const priced = lineOf(product.id)
                    const sellable = priced?.sellableQty ?? product.availableQty
                    const over = sellable != null && quantity > sellable
                    const retailPrice = priced
                      ? priced.retailPrice
                      : product.retailPrice
                    const unitPrice = priced
                      ? priced.actualUnitPrice
                      : retailPrice != null && validDiscount
                        ? discountedPrice(retailPrice, discountRate)
                        : null
                    const lineTotal = priced
                      ? priced.lineTotal
                      : unitPrice != null &&
                          validQuantity(quantity) &&
                          quantity > 0
                        ? unitPrice * quantity
                        : null
                    return (
                      <tr key={product.id}>
                        <td className="pos-col-no">{index + 1}</td>
                        <td>
                          <span className="pos-line-name">
                            {product.partName}
                          </span>
                          <small className="pos-line-meta">
                            <code>{product.sku}</code>
                            {sellable != null &&
                              ` · có thể bán ${number.format(sellable)} ${product.baseUnit}`}
                          </small>
                          {over && (
                            <small className="pos-line-warn">
                              Vượt số có thể bán, vẫn tạo được đơn
                            </small>
                          )}
                        </td>
                        <td className="pos-col-qty">
                          <input
                            className="pos-qty"
                            aria-label={'Số lượng ' + product.sku}
                            type="number"
                            inputMode="numeric"
                            min="1"
                            max="100000"
                            step="1"
                            value={Number.isFinite(quantity) ? quantity : ''}
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
                          <FieldError
                            message={
                              validation.errors['Số lượng ' + product.sku]
                            }
                          />
                        </td>
                        <td className="pos-col-money">
                          {unitPrice == null ? (
                            <span className="pos-muted">
                              {retailPrice == null ? 'Chưa có giá' : '—'}
                            </span>
                          ) : (
                            <>
                              {vnd(unitPrice)}
                              {retailPrice != null &&
                                unitPrice < retailPrice && (
                                  <s className="pos-old-price">
                                    {vnd(retailPrice)}
                                  </s>
                                )}
                            </>
                          )}
                        </td>
                        <td className="pos-col-money pos-line-total">
                          {lineTotal == null ? '—' : vnd(lineTotal)}
                        </td>
                        <td className="pos-col-action">
                          <button
                            type="button"
                            className="mf-btn mf-btn--secondary mf-btn--sm"
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
                    )
                  })}
                </tbody>
              </table>
              {!lines.length && (
                <div className="pos-empty">
                  <Icon name="box" />
                  <p>Chưa có phụ tùng nào trong đơn.</p>
                  <small>
                    Gõ tên, SKU hoặc quét mã vạch ở ô phía trên rồi nhấn Enter.
                  </small>
                </div>
              )}
            </div>
          </section>
          <section className="pos-card pos-note-card">
            <label className="pos-note">
              <Icon name="note" />
              <textarea
                aria-label="Ghi chú đơn hàng"
                maxLength={500}
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ghi chú đơn hàng, ví dụ: khách lấy trước 15:00"
              />
            </label>
          </section>
        </div>

        <aside
          className="pos-card pos-summary"
          aria-label="Thông tin thanh toán"
        >
          <div className="pos-summary-top">
            {scope.owner && !order ? (
              <label className="pos-store-select">
                <span className="sr-only">Cửa hàng bán</span>
                <select
                  aria-label="Cửa hàng bán"
                  value={warehouse}
                  onChange={(e) => setWarehouse(e.target.value)}
                  required
                >
                  <option value="">Chọn cửa hàng bán *</option>
                  {scope.stores.map((store) => (
                    <option key={store.id} value={store.id}>
                      {store.storeName}
                    </option>
                  ))}
                </select>
                <FieldError message={validation.errors['Cửa hàng bán']} />
              </label>
            ) : (
              <strong className="pos-store">{storeName ?? 'Cửa hàng'}</strong>
            )}
            <span className="pos-time">
              {order ? formatDateTime(order.createdAt) : now}
            </span>
          </div>

          <div className="pos-customer-row">
            <div className="pos-customer">
              <input
                role="combobox"
                aria-expanded={customerOpen}
                aria-controls="pos-customer-results"
                aria-label="Khách hàng"
                autoComplete="off"
                value={customerOpen ? customerQuery : customerLabel}
                placeholder={
                  customerOpen ? 'Tìm theo tên hoặc số điện thoại' : 'Khách lẻ'
                }
                onFocus={() => {
                  setCustomerOpen(true)
                  setCustomerQuery('')
                }}
                onBlur={() => setTimeout(() => setCustomerOpen(false), 150)}
                onChange={(e) => setCustomerQuery(e.target.value)}
              />
              <svg
                className="pos-caret"
                viewBox="0 0 20 20"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="m6 8 4 4 4-4"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {customerOpen && (
                <ul
                  className="pos-results"
                  id="pos-customer-results"
                  role="listbox"
                >
                  <li
                    role="option"
                    aria-selected={!customer}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      setCustomerTouched(true)
                      setCustomer(undefined)
                      setCustomerOpen(false)
                    }}
                  >
                    <span className="pos-result-name">
                      Khách lẻ
                      <small>
                        Không lưu hồ sơ, chỉ ghi tên và số điện thoại nếu có
                      </small>
                    </span>
                  </li>
                  {customers.loading && (
                    <li className="pos-results-note">Đang tìm…</li>
                  )}
                  {customerItems.map((c) => (
                    <li
                      key={c.id}
                      role="option"
                      aria-selected={c.id === customer?.id}
                      className={c.id === customer?.id ? 'is-active' : ''}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        setCustomerTouched(true)
                        setCustomer(c)
                        setCustomerOpen(false)
                      }}
                    >
                      <span className="pos-result-name">
                        {c.customerName}
                        <small>{c.phone ?? 'Chưa có số điện thoại'}</small>
                      </span>
                      {c.totalDebt > 0 && (
                        <span className="pos-result-debt">
                          nợ {vnd(c.totalDebt)}
                        </span>
                      )}
                    </li>
                  ))}
                  {customers.data && !customerItems.length && (
                    <li className="pos-results-note">
                      Không tìm thấy khách hàng.
                    </li>
                  )}
                </ul>
              )}
            </div>
            <button
              type="button"
              className="pos-icon-button"
              aria-label="Thêm nhanh khách hàng"
              title="Thêm nhanh khách hàng"
              onClick={() => setQuick(true)}
            >
              <Icon name="plus" />
            </button>
          </div>
          {customer ? (
            <div className="pos-badges">
              <span
                className={
                  'mf-badge ' +
                  (customer.creditStatus === 'ELIGIBLE'
                    ? 'mf-badge--success'
                    : 'mf-badge--muted')
                }
              >
                {customer.creditStatus === 'ELIGIBLE'
                  ? 'Được mua chịu'
                  : 'Chưa được mua chịu'}
              </span>
              {customer.totalDebt > 0 && (
                <span className="mf-badge mf-badge--warning">
                  Đang nợ {vnd(customer.totalDebt)}
                </span>
              )}
            </div>
          ) : (
            <div className="pos-walkin">
              <input
                aria-label="Tên khách lẻ"
                maxLength={150}
                value={walkin}
                onChange={(e) => setWalkin(e.target.value)}
                placeholder="Tên khách (không bắt buộc)"
              />
              <input
                aria-label="Số điện thoại khách lẻ"
                maxLength={20}
                inputMode="tel"
                value={walkPhone}
                onChange={(e) => setWalkPhone(e.target.value)}
                placeholder="Số điện thoại"
              />
            </div>
          )}

          <div className="pos-segment" role="radiogroup" aria-label="Loại giá">
            {(['RETAIL', 'WHOLESALE'] as const).map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={type === value}
                className={type === value ? 'is-active' : ''}
                onClick={() => {
                  setType(value)
                  setDiscount('0')
                }}
              >
                {value === 'RETAIL' ? 'Bán lẻ' : 'Bán buôn'}
              </button>
            ))}
          </div>

          <dl className="pos-totals">
            <div>
              <dt>
                Tổng tiền hàng{' '}
                <span className="pos-count">{number.format(totalQty)}</span>
              </dt>
              <dd>{referenceTotal == null ? '—' : vnd(referenceTotal)}</dd>
            </div>
            {type === 'WHOLESALE' && (
              <div className="pos-discount-row">
                <dt>
                  Chiết khấu
                  <span
                    className="pos-info"
                    tabIndex={0}
                    title={
                      'Một mức chiết khấu cho cả đơn bán buôn, phải nhỏ hơn ngưỡng ' +
                      (pricePreview?.discountThreshold ?? '…') +
                      '% đang áp dụng.'
                    }
                  >
                    <Icon name="info" />
                  </span>
                </dt>
                <dd>
                  <span className="pos-discount-amount">
                    {discountAmount == null ? '—' : '− ' + vnd(discountAmount)}
                  </span>
                  <span className="pos-discount-input">
                    <input
                      aria-label="Chiết khấu cho cả đơn (%)"
                      type="number"
                      min="0"
                      max="99.99"
                      step="0.01"
                      inputMode="decimal"
                      value={discount}
                      onChange={(e) => setDiscount(e.target.value)}
                    />
                    <span>%</span>
                  </span>
                  <FieldError
                    message={validation.errors['Chiết khấu cho cả đơn (%)']}
                  />
                </dd>
              </div>
            )}
            {pricePreview && !pricePreview.withinThreshold && (
              <p className="pos-warn" role="alert">
                Chiết khấu vượt ngưỡng {pricePreview.discountThreshold ?? 0}%
                đang áp dụng.
              </p>
            )}
            <div className="pos-grand">
              <dt>Khách cần trả</dt>
              <dd>{total == null ? '—' : vnd(total)}</dd>
            </div>
          </dl>

          <div className="pos-actions">
            {error && error !== blocker && (
              <p className="pos-warn" role="alert">
                {error}
              </p>
            )}
            {draftNotice && (
              <p className="pos-saved" role="status">
                {draftNotice}
              </p>
            )}
            <button
              type="submit"
              className="mf-btn mf-btn--primary mf-btn--lg pos-submit"
              disabled={busy || !!blocker}
              title={blocker || undefined}
            >
              {busy ? 'Đang lưu…' : order ? 'Lưu phiên bản mới' : 'Tạo đơn'}
            </button>
            {blocker && blocker !== 'Đang tính giá…' && (
              <p className="pos-blocker" role="status">
                {blocker}
              </p>
            )}
            <button
              type="button"
              className="mf-btn mf-btn--secondary mf-btn--lg"
              onClick={() =>
                lines.length && !order ? setConfirmLeave(true) : discard()
              }
            >
              {order ? 'Quay lại đơn' : 'Hủy đơn'}
            </button>
            {draftKey && (
              <button
                type="button"
                className="mf-btn mf-btn--link pos-draft"
                onClick={saveDraft}
                disabled={busy}
              >
                Lưu nháp trên máy này
              </button>
            )}
            {order && (
              <Link
                className="pos-muted pos-history"
                to={'/sales-orders/' + order.id}
              >
                Xem chi tiết đơn
              </Link>
            )}
          </div>
        </aside>
      </form>
      {quick && (
        <CustomerForm
          onClose={() => setQuick(false)}
          onSaved={(value) => {
            setCustomerTouched(true)
            setCustomer(value)
            setQuick(false)
          }}
        />
      )}
      {confirmLeave && (
        <ConfirmDialog
          title="Hủy đơn đang tạo?"
          message="Các phụ tùng đã chọn và đơn nháp trên máy sẽ bị xóa."
          confirmLabel="Hủy đơn"
          cancelLabel="Không hủy"
          danger
          onConfirm={async () => discard()}
          onCancel={() => setConfirmLeave(false)}
        />
      )}
    </main>
  )
}
