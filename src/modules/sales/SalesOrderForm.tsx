/**
 * File: modules/sales/SalesOrderForm.tsx
 * Loại: MÀN HÌNH — Tạo / sửa đơn bán (route /sales-orders/new, /sales-orders/:id/edit) và mở lại đơn nháp
 * (route /sales-drafts/:id). "Lưu nháp" lưu đơn trạng thái DRAFT lên server, mỗi lần lưu đơn mới là một nháp riêng;
 * nháp không vào danh sách Đơn bán cho tới khi bấm "Tạo đơn".
 * Công dụng: Bố cục kiểu quầy bán hàng (POS) theo ảnh mẫu 12/11: bên trái ô tìm phụ tùng + bảng dòng hàng + ghi chú,
 * bên phải cửa hàng, khách hàng, loại giá, tổng tiền, chiết khấu, "Khách cần trả" và nút Tạo đơn / Hủy đơn.
 * Nghiệp vụ giữ nguyên: giá lấy từ API preview; chiết khấu một mức cho cả đơn, chỉ cho đơn bán buôn, dưới ngưỡng
 * (BR-10, BR-12, BR-16); Owner phải chọn cửa hàng bán (MSG157); vượt tồn khả dụng vẫn tạo được đơn.
 */
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import axiosClient from '../../shared/api/axiosClient'
import PageHeader from '../../shared/ui/PageHeader'
import { hasAppHistory } from '../../shared/hooks/useBackClick'
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
  splitLine,
  validQuantity,
  type SalesOrder,
} from './salesModel'
import {
  salesDraftsPath,
  splitNotice,
  type OrderDto,
} from './salesApi'

import { useFormValidation } from '../../shared/hooks/useFormValidation'
import FieldError from '../../shared/ui/FieldError'
import ProductQuickView from '../catalog/components/ProductQuickView'
import { DAMAGED_VARIANT_NAME_SUFFIX } from '../../shared/utils/damagedVariant'
import type {
  TabCustomer,
  TabDeposit,
  TabDraft,
  TabLine,
} from './salesTabsStore'
import {
  addDaysIso,
  afterDepositRoute,
  depositPayload,
  depositTarget,
  todayIso,
  validateDeposit,
  type DepositRoute,
} from './salesDeposit'
import MoneyInput from '../../shared/ui/MoneyInput'
import './salesDepositForm.css'
export type SalesProduct = {
  id: number
  sku: string
  partName: string
  baseUnit: string
  retailPrice: number | null
  status: string
  imageUrl?: string | null
  availableQty?: number | null
  sellableQty?: number | null
  heldByOthersQty?: number | null
}
type DraftLine = TabLine
/** Phản hồi ghi cọc (BE SettlementResult): chỉ cần mã khoản thu để in phiếu. */
type DepositResult = { paymentId: number }
type SalesCustomer = TabCustomer
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
    heldByOthersQty?: number | null
    /** BE #79: số "lấy ngay" gợi ý = min(số cần, còn bán được). */
    suggestedNowQty?: number
    /** BE #80: hàng lỗi "<SKU>-M" của phụ tùng này mà cửa hàng còn bán được. */
    variant?: {
      productId: number
      sku: string
      sellableQty: number
      retailPrice: number | null
    } | null
    shortQty: number
    retailPrice: number | null
    actualUnitPrice: number | null
    lineTotal: number | null
  }[]
}

const vnd = (value: number) => money.format(value)

/**
 * Các prop tùy chọn cho màn tạo đơn nhiều tab (POS): không truyền thì hành vi như cũ.
 * initialDraft: nháp của tab; onDraftChange: báo mọi thay đổi để tab lưu lại;
 * onSubmitted: sau khi tạo đơn / lưu nháp thành công; onDiscard: "Hủy đơn" thay vì rời trang;
 * storeLocked: cửa hàng do trang ngoài chọn (Owner), chỉ hiện tên; tabBar: thanh tab đặt ở đầu màn.
 */
export function SalesOrderFormView({
  order,
  initialProduct,
  initialCustomer,
  initialQuantity = 1,
  initialDraft,
  onDraftChange,
  onSubmitted,
  onDiscard,
  storeLocked = false,
  tabBar,
}: {
  order?: SalesOrder
  initialCustomer?: Customer
  initialProduct?: SalesProduct
  initialQuantity?: number
  initialDraft?: TabDraft
  onDraftChange?: (draft: TabDraft) => void
  onSubmitted?: () => void
  onDiscard?: () => void
  storeLocked?: boolean
  tabBar?: ReactNode
}) {
  const [prefill] = useSearchParams()
  const navigate = useNavigate(),
    scope = useInventoryScope(),
    saveLock = useRef(false),
    productInput = useRef<HTMLInputElement>(null)
  // Đơn nháp (DRAFT) mở lại từ /sales-drafts/:id; "editing" là đơn bán thật đang sửa phiên bản.
  const draftOrder = order?.status === 'DRAFT' ? order : undefined
  const editing = order && !draftOrder ? order : undefined
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)
  const [customerTouched, setCustomerTouched] = useState(false)
  const [walkPhone, setWalkPhone] = useState(
    initialDraft ? initialDraft.walkPhone : (order?.customerPhone ?? ''),
  )
  const [warehouse, setWarehouse] = useState(
    initialDraft
      ? initialDraft.warehouse
      : String(
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
    initialDraft ? initialDraft.customer : initialCustomer,
  )
  const [quick, setQuick] = useState(false)
  // orderFromDto ghi "Khách lẻ" khi đơn không có tên khách; không đưa chữ đó vào ô tên khách lẻ.
  const [walkin, setWalkin] = useState(
    initialDraft
      ? initialDraft.walkin
      : order && !order.customerId && order.customerName !== 'Khách lẻ'
        ? order.customerName
        : '',
  )
  const [query, setQuery] = useState('')
  const [productOpen, setProductOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const [type, setType] = useState(
    initialDraft?.type ?? order?.priceType ?? 'RETAIL',
  )
  const [discount, setDiscount] = useState(
    initialDraft ? initialDraft.discount : String(order?.discount ?? 0),
  )
  const [note, setNote] = useState(
    initialDraft ? initialDraft.note : (order?.note ?? ''),
  )
  const [lines, setLines] = useState<DraftLine[]>(
    () =>
      initialDraft
        ? initialDraft.lines
        : (order?.lines.map((l) => ({
            product: {
              id: l.productId,
              sku: l.sku,
              partName: l.partName,
              baseUnit: l.baseUnit,
              retailPrice: l.retailPrice,
              sellableQty: l.sellableQty,
              heldByOthersQty: l.heldByOthersQty,
              status: 'ACTIVE',
            },
            quantity: l.requested,
          })) ??
          (initialProduct
            ? [{ product: initialProduct, quantity: initialQuantity }]
            : [])),
  )
  // Tiền cọc chỉ dùng khi đơn tạo ra toàn đơn chờ hàng (xem allWaiting); nháp không lưu cọc.
  const [deposit, setDeposit] = useState<TabDeposit>(
    () =>
      initialDraft?.deposit ?? {
        amount: '',
        method: 'CASH',
        reference: '',
        expiresOn: '',
        tendered: '',
        verified: true,
      },
  )
  // Khách đặt trước: cả đơn thành đơn chờ hàng, không lấy ngay (xem preorderActive).
  const [preorder, setPreorder] = useState<boolean>(
    initialDraft?.preorder ?? false,
  )
  const [error, setError] = useState('')
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [now] = useState(() => formatDateTime(new Date()))

  // Báo nháp hiện tại cho trang ngoài (tab) mỗi khi dữ liệu đổi. Callback giữ trong ref
  // để đổi hàm không kích hoạt effect; ref được cập nhật trước effect gửi dữ liệu.
  const onDraftChangeRef = useRef(onDraftChange)
  useEffect(() => {
    onDraftChangeRef.current = onDraftChange
  })
  useEffect(() => {
    onDraftChangeRef.current?.({
      ...(customer ? { customer } : {}),
      walkin,
      walkPhone,
      warehouse,
      type,
      discount,
      note,
      lines,
      ...(deposit.amount || deposit.reference || deposit.tendered || deposit.expiresOn
        ? { deposit }
        : {}),
      ...(preorder ? { preorder: true } : {}),
    })
  }, [customer, walkin, walkPhone, warehouse, type, discount, note, lines, deposit, preorder])

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
    // Gửi storeId của kho đang chọn: Owner không có kho mặc định, thiếu storeId thì availableQty = null.
    {
      q: query.trim(),
      size: 20,
      status: 'ACTIVE',
      storeId: warehouse ? Number(warehouse) : undefined,
    },
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
        (initialDraft ? null : Number(prefill.get('customerId')) || null)),
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
  const needsStore = scope.owner && !editing && !warehouse
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
  const sellableOf = (productId: number) => {
    const product = lines.find((line) => line.product.id === productId)?.product
    const value =
      lineOf(productId)?.sellableQty ??
      product?.sellableQty ??
      product?.availableQty
    return value == null || !Number.isFinite(Number(value))
      ? null
      : Math.max(0, Number(value))
  }
  const totalQty = lines.reduce(
    (sum, l) => sum + (Number.isFinite(l.quantity) ? l.quantity : 0),
    0,
  )
  // Khách đặt trước: mọi dòng chờ hàng, không lấy ngay (nowQty 0, waitForRest true).
  const preorderActive = preorder && !editing && lines.length > 0
  const stockSplit = lines.map(({ product, quantity, nowQty, waitForRest }) => ({
    productId: product.id,
    ...splitLine({
      requested: quantity,
      sellable: sellableOf(product.id),
      suggestedNow: lineOf(product.id)?.suggestedNowQty,
      nowQty: preorderActive ? 0 : nowQty,
      waitForRest: preorderActive ? true : waitForRest,
    }),
  }))
  const stockSplitByProduct = new Map(
    stockSplit.map((line) => [line.productId, line]),
  )
  const immediateQty = stockSplit.reduce((sum, line) => sum + line.takeNow, 0)
  const pendingQty = stockSplit.reduce(
    (sum, line) => sum + (line.waitForRest ? line.later : 0),
    0,
  )
  const pendingLineCount = stockSplit.filter(
    (line) => line.waitForRest && line.later > 0,
  ).length
  const immediateLineCount = stockSplit.filter((line) => line.takeNow > 0).length
  // Đơn chờ thuần: không dòng nào lấy ngay, có số chờ hàng (đơn tạo ra chỉ là đơn chờ).
  const allWaiting =
    !editing && lines.length > 0 && immediateQty === 0 && pendingQty > 0
  // Cọc chỉ được gửi khi đơn chờ có hồ sơ khách và đã nhập số tiền; còn lại bỏ qua.
  const depositActive =
    allWaiting && !!customer && deposit.amount.trim() !== ''
  const depositError = depositActive
    ? validateDeposit(deposit, todayIso(), { requireExpiry: true })
    : null
  const stockShortages = lines.filter(({ product, quantity }) => {
    const sellable = sellableOf(product.id)
    return sellable != null && quantity > sellable
  })
  // Đơn phải có ít nhất một phần lấy ngay hoặc chờ hàng; bỏ hết thì không có gì để tạo.
  const unhandledShortage = immediateQty === 0 && pendingQty === 0
  const canCreatePendingRemainder =
    !editing &&
    (preorderActive ||
      stockSplit.some((line) => line.later > 0) ||
      stockShortages.length > 0)
  const splitActive = canCreatePendingRemainder
  const saleReferenceTotal = splitActive
    ? salesTotal(
        stockSplit.map((line) => ({
          quantity: line.takeNow,
          price: lineOf(line.productId)?.retailPrice ??
            lines.find((item) => item.product.id === line.productId)?.product.retailPrice ?? null,
        })),
        0,
      )
    : referenceTotal
  const saleTotal = splitActive
    ? salesTotal(
        stockSplit.map((line) => ({
          quantity: line.takeNow,
          price: lineOf(line.productId)?.retailPrice ??
            lines.find((item) => item.product.id === line.productId)?.product.retailPrice ?? null,
        })),
        discountRate,
      )
    : total
  const storeName = editing
    ? editing.storeName
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
  function discard() {
    if (onDiscard) {
      onDiscard()
      return
    }
    // "Quay lại" (đơn đang sửa / nháp): về đúng trang đã mở trước đó nếu có.
    if ((editing || draftOrder) && hasAppHistory()) {
      navigate(-1)
      return
    }
    navigate(
      editing
        ? '/sales-orders/' + editing.id
        : draftOrder
          ? salesDraftsPath
          : '/sales-orders',
    )
  }

  const validation = useFormValidation()
  const unpriced = lines.find((l) => lineOf(l.product.id)?.retailPrice === null)
  // Lưu nháp chỉ cần dữ liệu BE ghi được dòng hàng (mỗi phụ tùng phải có giá bán lẻ);
  // ngưỡng chiết khấu được kiểm khi bấm "Tạo đơn".
  const draftBlocker = needsStore
    ? 'Chọn cửa hàng bán trước.'
    : !lines.length
      ? 'Chưa có phụ tùng nào trong đơn.'
      : invalidQty
        ? 'Số lượng mỗi dòng phải là số nguyên từ 1 đến 100.000.'
        : !validDiscount
          ? 'Nhập chiết khấu từ 0 đến 99,99%.'
          : unpriced
            ? `Phụ tùng ${unpriced.product.sku} chưa có giá bán lẻ đang áp dụng.`
            : ''
  // Lý do nút Tạo đơn đang khóa (review L4: nút xám phải nói thiếu gì).
  const blocker = needsStore
    ? 'Chọn cửa hàng bán trước.'
    : !lines.length
      ? 'Chưa có phụ tùng nào trong đơn.'
      : invalidQty
        ? 'Số lượng mỗi dòng phải là số nguyên từ 1 đến 100.000.'
        : !validDiscount
          ? 'Nhập chiết khấu từ 0 đến 99,99%.'
          : canCreatePendingRemainder && unhandledShortage
            ? 'Không có phần nào để bán hoặc chờ hàng. Nhập số lấy ngay hoặc tích “Chờ phần còn lại”.'
            : depositError
              ? depositError
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

  /** Khóa nút trong lúc gọi API; lỗi BE hiện ngay trên form. */
  async function run(action: () => Promise<void>) {
    if (saveLock.current) return
    saveLock.current = true
    setBusy(true)
    setError('')
    try {
      await action()
    } catch (error) {
      setError(inventoryError(error))
    } finally {
      saveLock.current = false
      setBusy(false)
    }
  }
  function body() {
    return { ...JSON.parse(previewBody), note: note.trim() || null }
  }
  function splitBody() {
    const request = body()
    // R-02: giữ nguyên dòng của body() (productId, quantity) rồi thêm nowQty / waitForRest theo BE #79.
    return {
      ...request,
      lines: (request.lines as { productId: number; quantity: number }[]).map(
        (line) => {
          const split = stockSplitByProduct.get(line.productId)
          return {
            ...line,
            nowQty: split?.takeNow ?? line.quantity,
            waitForRest: split?.waitForRest ?? true,
          }
        },
      ),
    }
  }

  function submit() {
    if (blocker) {
      setError(blocker)
      return
    }
    return run(async () => {
      let result: OrderDto
      if (editing) {
        result = (
          await axiosClient.put<OrderDto>('/sales-orders/' + editing.id, {
            ...body(),
            storeId: undefined,
            version: editing.version,
          })
        ).data
      } else {
        result = (
          await axiosClient.post<OrderDto>(
            draftOrder
              ? '/sales-orders/drafts/' + draftOrder.id + '/submit'
              : '/sales-orders',
            canCreatePendingRemainder ? splitBody() : body(),
          )
        ).data
      }
      // BE #79: `split` cho biết đơn bán / đơn chờ vừa tạo; mở đơn bán nếu có, không thì đơn chờ.
      const split = result.split
      const orderId = split?.salesOrderId ?? split?.waitingOrderId ?? result.id
      const notice = splitNotice(
        split,
        lines.map((line) => ({
          productId: line.product.id,
          sku: line.product.sku,
        })),
      )
      // Cọc ghi sau khi đơn chờ đã tạo. Lỗi cọc không hủy đơn: báo ở màn chi tiết đơn chờ.
      const waitingId = depositActive ? depositTarget(result) : null
      let depositRoute: DepositRoute | null = null
      if (waitingId != null) {
        try {
          const settled = await axiosClient.post<DepositResult>(
            '/sales-orders/' + waitingId + '/deposits',
            depositPayload(deposit, 0, { withExpiry: true }),
          )
          depositRoute = afterDepositRoute(
            {
              ok: true,
              paymentId: settled.data.paymentId,
              verified: deposit.verified,
            },
            waitingId,
          )
        } catch (cause) {
          depositRoute = afterDepositRoute(
            { ok: false, message: inventoryError(cause) },
            waitingId,
          )
        }
      }
      if (!editing) onSubmitted?.()
      if (depositRoute) {
        // replace: nút "Quay lại" ở trang chi tiết không quay về form đã lưu (đã cũ).
        navigate(depositRoute.to, {
          replace: true,
          state: depositRoute.notice
            ? { notice: depositRoute.notice }
            : undefined,
        })
        return
      }
      navigate('/sales-orders/' + orderId, {
        replace: true,
        state: notice
          ? {
              notice,
              primaryOrderId: split?.salesOrderId ?? undefined,
              pendingOrderId: split?.waitingOrderId ?? undefined,
            }
          : undefined,
      })
    })
  }
  function saveDraft() {
    if (draftBlocker) {
      setError(draftBlocker)
      return
    }
    return run(async () => {
      const result = draftOrder
        ? await axiosClient.put<OrderDto>(
            '/sales-orders/drafts/' + draftOrder.id,
            body(),
          )
        : await axiosClient.post<OrderDto>('/sales-orders/drafts', body())
      onSubmitted?.()
      navigate(salesDraftsPath, {
        state: { notice: 'Đã lưu đơn nháp SO-' + result.data.id + '.' },
      })
    })
  }
  function deleteDraft() {
    if (!draftOrder) return
    return run(async () => {
      await axiosClient.delete('/sales-orders/drafts/' + draftOrder.id)
      navigate(salesDraftsPath, {
        state: { notice: 'Đã xóa đơn nháp ' + draftOrder.code + '.' },
      })
    })
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
          editing
            ? 'Sửa đơn ' + editing.code + ' · phiên bản ' + editing.version
            : draftOrder
              ? 'Đơn nháp ' + draftOrder.code
              : 'Tạo đơn bán'
        }
        breadcrumb={
          draftOrder
            ? [
                { label: 'Đơn bán', to: '/sales-orders' },
                { label: 'Nháp', to: salesDraftsPath },
                { label: draftOrder.code },
              ]
            : [
                { label: 'Đơn bán', to: '/sales-orders' },
                { label: editing ? 'Chỉnh sửa' : 'Tạo mới' },
              ]
        }
      />
      {tabBar}
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
                      {product.imageUrl ? (
                        <img
                          className="pos-result-image"
                          src={product.imageUrl}
                          alt=""
                          loading="lazy"
                        />
                      ) : (
                        <span className="pos-result-image pos-result-image--empty" aria-hidden="true" />
                      )}
                      <span className="pos-result-name">
                        {product.partName}
                        <small>
                          {product.sku}
                          {(product.sellableQty ?? product.availableQty) != null &&
                            ` · còn bán được ${number.format(product.sellableQty ?? product.availableQty!)} ${product.baseUnit}${product.heldByOthersQty ? ` (đã trừ ${number.format(product.heldByOthersQty)} đang giữ)` : ''}`}
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
                    <th className="pos-col-no">STT</th>
                    <th>Phụ tùng</th>
                    <th className="pos-col-qty">Số lượng</th>
                    {canCreatePendingRemainder && (
                      <>
                        <th className="pos-col-split-qty">Lấy ngay</th>
                        <th className="pos-col-split-qty">Lấy sau</th>
                        <th className="pos-col-split-check">Chờ phần còn lại</th>
                      </>
                    )}
                    <th className="pos-col-money">Đơn giá</th>
                    <th className="pos-col-money">Thành tiền</th>
                    <th className="pos-col-action" aria-label="Thao tác" />
                  </tr>
                </thead>
                <tbody>
                  {lines.map(({ product, quantity }, index) => {
                    const priced = lineOf(product.id)
                    const sellable =
                      priced?.sellableQty ??
                      product.sellableQty ??
                      product.availableQty
                    const heldByOthersQty =
                      priced?.heldByOthersQty ?? product.heldByOthersQty
                    const over = sellable != null && quantity > sellable
                    const retailPrice = priced
                      ? priced.retailPrice
                      : product.retailPrice
                    const unitPrice = priced
                      ? priced.actualUnitPrice
                      : retailPrice != null && validDiscount
                        ? discountedPrice(retailPrice, discountRate)
                        : null
                    const split = stockSplitByProduct.get(product.id)
                    const lineTotal = splitActive
                      ? unitPrice != null
                        ? unitPrice * (split?.takeNow ?? quantity)
                        : null
                      : priced
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
                          <ProductQuickView
                            productId={product.id}
                            sku={product.sku}
                            partName={product.partName}
                            className="pos-line-name"
                          />
                          <small className="pos-line-meta">
                            <code>{product.sku}</code>
                            {sellable != null &&
                              ` · còn bán được ${number.format(sellable)} ${product.baseUnit}${heldByOthersQty ? ` (đã trừ ${number.format(heldByOthersQty)} đang giữ)` : ''}`}
                          </small>
                          {splitActive && (split?.later ?? 0) > 0 ? (
                            <small className="pos-line-warn">
                              {split?.waitForRest
                                ? `Chờ hàng ${number.format(split?.later ?? 0)} ${product.baseUnit}`
                                : `Khách bỏ ${number.format(split?.later ?? 0)} ${product.baseUnit}`}
                            </small>
                          ) : over && (
                            <small className="pos-line-warn">
                              Tồn kho không đủ; giảm số lấy ngay hoặc tạo đơn chờ phần còn lại.
                            </small>
                          )}
                          {/* BH7: BE trả hàng lỗi của mã gốc; bấm để thêm mã "<SKU>-M" như phụ tùng thường. */}
                          {priced?.variant &&
                            priced.variant.sellableQty > 0 &&
                            !lines.some(
                              (line) =>
                                line.product.id === priced.variant!.productId,
                            ) && (
                              <button
                                type="button"
                                className="pos-variant-hint"
                                onClick={() => {
                                  const variant = priced.variant!
                                  add({
                                    id: variant.productId,
                                    sku: variant.sku,
                                    partName:
                                      product.partName +
                                      DAMAGED_VARIANT_NAME_SUFFIX,
                                    baseUnit: product.baseUnit,
                                    retailPrice: variant.retailPrice,
                                    sellableQty: variant.sellableQty,
                                    status: 'ACTIVE',
                                  })
                                }}
                              >
                                Có {number.format(priced.variant.sellableQty)}{' '}
                                hàng lỗi
                                {priced.variant.retailPrice != null &&
                                  ' · giá ' + vnd(priced.variant.retailPrice)}{' '}
                                · Thêm vào đơn
                              </button>
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
                            onBlur={(e) => {
                              const normalized = Number(e.currentTarget.value)
                              if (Number.isFinite(normalized)) {
                                e.currentTarget.value = String(normalized)
                                setLines((previous) =>
                                  previous.map((l) =>
                                    l.product.id === product.id
                                      ? { ...l, quantity: normalized }
                                      : l,
                                  ),
                                )
                              }
                            }}
                          />
                          <FieldError
                            message={
                              validation.errors['Số lượng ' + product.sku]
                            }
                          />
                        </td>
                        {canCreatePendingRemainder && (
                          <>
                            <td className="pos-col-split-qty">
                              <input
                                className="pos-qty"
                                aria-label={'Lấy ngay ' + product.sku}
                                disabled={preorderActive}
                                type="number"
                                min="0"
                                max={quantity}
                                step="1"
                                value={split?.takeNow ?? quantity}
                                onChange={(event) =>
                                  setLines((previous) =>
                                    previous.map((line) =>
                                      line.product.id === product.id
                                        ? {
                                            ...line,
                                            nowQty:
                                              event.target.value === ''
                                                ? 0
                                                : Number(event.target.value),
                                          }
                                        : line,
                                    ),
                                  )
                                }
                              />
                            </td>
                            <td className="pos-col-split-qty">
                              {number.format(split?.later ?? 0)}
                            </td>
                            <td className="pos-col-split-check">
                              {(split?.later ?? 0) > 0 || over ? (
                                <label>
                                  <input
                                    type="checkbox"
                                    aria-label={'Chờ hàng ' + product.sku}
                                    checked={!!split?.waitForRest}
                                    disabled={preorderActive}
                                    onChange={(event) =>
                                      setLines((previous) =>
                                        previous.map((line) =>
                                          line.product.id === product.id
                                            ? {
                                                ...line,
                                                waitForRest:
                                                  event.target.checked,
                                              }
                                            : line,
                                        ),
                                      )
                                    }
                                  />
                                  Chờ hàng
                                </label>
                              ) : (
                                '—'
                              )}
                            </td>
                          </>
                        )}
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
            {scope.owner && !editing && !storeLocked ? (
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
                {splitActive ? 'Tiền hàng lấy ngay' : 'Tổng tiền hàng'}{' '}
                <span className="pos-count">
                  {number.format(splitActive ? immediateQty : totalQty)}
                </span>
              </dt>
              <dd>
                {saleReferenceTotal == null ? '—' : vnd(saleReferenceTotal)}
              </dd>
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
                    {splitActive && saleReferenceTotal != null && saleTotal != null
                      ? saleReferenceTotal > saleTotal
                        ? '− ' + vnd(saleReferenceTotal - saleTotal)
                        : '—'
                      : discountAmount == null
                        ? '—'
                        : '− ' + vnd(discountAmount)}
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
              <dt>{splitActive ? 'Khách cần trả (lấy ngay)' : 'Khách cần trả'}</dt>
              <dd>{saleTotal == null ? '—' : vnd(saleTotal)}</dd>
            </div>
          </dl>

          {!editing && (
            <div className="pos-preorder">
              <label className="pos-deposit-check">
                <input
                  type="checkbox"
                  checked={preorder}
                  onChange={(event) => setPreorder(event.target.checked)}
                />
                Khách đặt trước (cả đơn chờ hàng, không lấy ngay)
              </label>
              <small>
                Dùng khi khách hẹn hôm khác mới lấy. Đơn chờ không giữ hàng; khi
                chuyển sang soạn mới kiểm tồn.
              </small>
            </div>
          )}
          {canCreatePendingRemainder && (
            <div className="pos-stock-split">
              <strong>Tách đơn theo số lượng lấy ngay</strong>
              <p role="status">
                {unhandledShortage
                  ? 'Nhập số lấy ngay hoặc tích “Chờ phần còn lại” để tạo đơn.'
                  : `Sẽ tạo: đơn bán ${immediateLineCount} dòng · đơn chờ ${pendingLineCount} dòng.`}
              </p>
              {pendingQty > 0 && (
                <small>
                  Số lượng chờ hàng: {number.format(pendingQty)}; chưa tính vào
                  số tiền khách cần trả lúc này.
                </small>
              )}
            </div>
          )}

          {/*
            Route tạo đơn bị giới hạn OWNER/BRANCH_MANAGER (RequireRole trong AppRoutes), đúng các vai trò
            BE cho phép ghi cọc, nên không cần chặn thêm ở đây.
          */}
          {allWaiting && (
            <section className="pos-deposit" aria-label="Tiền cọc">
              <strong>Tiền cọc (không bắt buộc)</strong>
              {!customer ? (
                <p className="pos-deposit-note">
                  Chọn khách hàng có hồ sơ để nhận cọc. Khách lẻ không nhận cọc
                  được.
                </p>
              ) : (
                <>
                  <label className="pos-deposit-field">
                    <span>Số tiền cọc</span>
                    <MoneyInput
                      aria-label="Số tiền cọc"
                      placeholder="0"
                      value={deposit.amount}
                      onValueChange={(amount) =>
                        setDeposit((previous) => ({ ...previous, amount }))
                      }
                    />
                  </label>
                  <div
                    className="pos-deposit-methods"
                    role="radiogroup"
                    aria-label="Hình thức cọc"
                  >
                    {(
                      [
                        ['CASH', 'Tiền mặt'],
                        ['BANK_TRANSFER', 'Chuyển khoản'],
                      ] as const
                    ).map(([value, label]) => (
                      <label
                        key={value}
                        className={
                          deposit.method === value ? 'is-selected' : ''
                        }
                      >
                        <input
                          type="radio"
                          name="depositMethod"
                          value={value}
                          checked={deposit.method === value}
                          onChange={() =>
                            setDeposit((previous) => ({
                              ...previous,
                              method: value,
                            }))
                          }
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                  {deposit.method === 'CASH' ? (
                    <label className="pos-deposit-field">
                      <span>Tiền khách đưa (không bắt buộc)</span>
                      <MoneyInput
                        aria-label="Tiền khách đưa"
                        placeholder="0"
                        value={deposit.tendered}
                        onValueChange={(tendered) =>
                          setDeposit((previous) => ({
                            ...previous,
                            tendered,
                          }))
                        }
                      />
                    </label>
                  ) : (
                    <label className="pos-deposit-field">
                      <span>Mã giao dịch</span>
                      <input
                        aria-label="Mã giao dịch"
                        maxLength={100}
                        value={deposit.reference}
                        onChange={(event) =>
                          setDeposit((previous) => ({
                            ...previous,
                            reference: event.target.value,
                          }))
                        }
                      />
                    </label>
                  )}
                  <label className="pos-deposit-check">
                    <input
                      type="checkbox"
                      checked={deposit.verified}
                      onChange={(event) =>
                        setDeposit((previous) => ({
                          ...previous,
                          verified: event.target.checked,
                        }))
                      }
                    />
                    Đã nhận đủ số tiền này
                  </label>
                  <label className="pos-deposit-field">
                    <span>Hạn cọc</span>
                    <input
                      type="date"
                      min={addDaysIso(todayIso(), 1)}
                      value={deposit.expiresOn}
                      onChange={(event) =>
                        setDeposit((previous) => ({
                          ...previous,
                          expiresOn: event.target.value,
                        }))
                      }
                    />
                  </label>
                </>
              )}
              <p className="pos-deposit-hint">
                Khách đặt trước dù cửa hàng còn hàng? Tích "Khách đặt trước".
              </p>
            </section>
          )}
          <div className="pos-actions">
            {error && error !== blocker && (
              <p className="pos-warn" role="alert">
                {error}
              </p>
            )}
            <button
              type="submit"
              className="mf-btn mf-btn--primary mf-btn--lg pos-submit"
              disabled={busy || !!blocker}
              title={blocker || undefined}
            >
              {busy ? 'Đang lưu…' : editing ? 'Lưu phiên bản mới' : 'Tạo đơn'}
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
                // Ở chế độ tab, "Hủy đơn" đóng tab: hỏi khi tab có bất kỳ dữ liệu nào, không chỉ dòng hàng.
                (onDiscard
                  ? lines.length ||
                    customer ||
                    walkin.trim() ||
                    walkPhone.trim() ||
                    note.trim() ||
                    type === 'WHOLESALE' ||
                    (discount.trim() !== '' && discount.trim() !== '0') ||
                    deposit.amount.trim() ||
                    preorder
                  : lines.length) && !order
                  ? setConfirmLeave(true)
                  : discard()
              }
            >
              {editing
                ? 'Quay lại đơn'
                : draftOrder
                  ? 'Quay lại danh sách nháp'
                  : 'Hủy đơn'}
            </button>
            {(!editing || draftOrder) && (
              <div className="pos-draft-actions">
                {!editing && (
                  <button
                    type="button"
                    className="mf-btn mf-btn--secondary pos-draft-save"
                    onClick={() => void saveDraft()}
                    disabled={busy}
                    title={draftBlocker || undefined}
                  >
                    Lưu nháp
                  </button>
                )}
                {draftOrder && (
                  <button
                    type="button"
                    className="mf-btn mf-btn--danger pos-draft-delete"
                    onClick={() => setConfirmDelete(true)}
                    disabled={busy}
                  >
                    Xóa nháp
                  </button>
                )}
              </div>
            )}
            {editing && (
              <Link
                className="pos-muted pos-history"
                to={'/sales-orders/' + editing.id}
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
          message="Các phụ tùng đã chọn sẽ bị bỏ. Muốn giữ lại để làm tiếp, bấm Lưu nháp."
          confirmLabel="Hủy đơn"
          cancelLabel="Không hủy"
          danger
          onConfirm={async () => discard()}
          onCancel={() => setConfirmLeave(false)}
        />
      )}
      {confirmDelete && draftOrder && (
        <ConfirmDialog
          title={'Xóa đơn nháp ' + draftOrder.code + '?'}
          message="Đơn nháp bị xóa hẳn và không khôi phục được."
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
    </main>
  )
}
