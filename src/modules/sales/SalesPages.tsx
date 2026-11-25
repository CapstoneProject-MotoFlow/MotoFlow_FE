import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  Link,
  useLocation,
  useParams,
  useSearchParams,
  useNavigate,
} from 'react-router-dom'
import { useInventoryData, useInventoryScope } from '../inventory/api'
import {
  InventoryNotice,
  InventoryPanel,
  Pagination,
  WarehouseFilter,
} from '../inventory/components'
import type { Page } from '../inventory/types'
import { money, dateTime, today } from '../inventory/presentation'
import type { Customer } from '../customers/types'
import PageBackLink from '../../shared/ui/PageBackLink'
import SearchableFilter from '../../shared/ui/SearchableFilter'

import {
  salesTotal,
  discountedPrice,
  mayCancel,
  pickedReady,
  suggestedPickingQty,
  type SalesOrder,
  type SalesLine,
} from './salesModel'
import SalesAssignmentDialog from './SalesAssignmentDialog'
import axiosClient from '../../shared/api/axiosClient'
import {
  orderFromDto,
  type DepositStatus,
  type OrderDto,
  type SalesPaymentType,
  type UnmetRow,
  type WaitingState,
} from './salesApi'
import { depositBadge, depositStatusLabels, todayIso } from './salesDeposit'
import SalesDepositPanel from './SalesDepositPanel'
import { viewDate } from './salesDepositDate'
import SalesSettlementDialog from './SalesSettlementDialog'
import SalesPendingReleaseDialog from './SalesPendingReleaseDialog'
import { inventoryError } from '../inventory/api'
import { useChoicePages, useSalesList } from './useSalesList'
import DemandReplenishment from './DemandReplenishment'
import { SalesOrderFormView, type SalesProduct } from './SalesOrderForm'
import SalesTabsWorkspace from './SalesTabsWorkspace'
import { SalesDraftTab } from './SalesDraftPages'
import { documentCode } from '../../shared/utils/documentCode'
import { salesOrderStatusLabels as salesStates } from '../../shared/labels/status'
import ProductQuickView from '../catalog/components/ProductQuickView'
import { useSearchBox } from '../../shared/hooks/useSearchBox'
export { SalesOrderFormView }
import './sales.css'

/**
 * Shell: khung trang bán hàng. PM 22/11: không còn breadcrumb; trang danh sách đã có tiêu đề ở thẻ bên dưới
 * thì không truyền title (không hiện dòng tiêu đề trang).
 */
function Shell({
  title,
  children,
  backTo,
}: {
  title?: string
  children: ReactNode
  backTo?: string
}) {
  return (
    <main className="inventory-workspace sales-workspace">
      {backTo && <PageBackLink to={backTo} />}
      {title && (
        <header className="stock-heading">
          <div>
            <h1>{title}</h1>
          </div>
        </header>
      )}
      {children}
    </main>
  )
}
export function SalesListTotal({ total }: { total?: number | null }) {
  return <td>{total == null ? 'Chưa có dữ liệu' : money.format(total)}</td>
}
/** Dòng danh sách: đơn UI kèm trạng thái cọc từ SummaryDto (null khi không có cọc hoặc là Staff). */
type SalesOrderRow = SalesOrder & {
  depositStatus?: DepositStatus | null
  depositRemaining?: number | null
}
export function SalesOrderListPage({
  orders = [],
}: { orders?: SalesOrder[] } = {}) {
  const scope = useInventoryScope(),
    staff = scope.user?.role === 'STAFF',
    p = scope.params
  // Tab "Chờ hàng" theo role: BE không có cờ riêng cho tab này, nên dùng role như scope.owner/staff trong file.
  const search = useSearchBox(p.get('q') ?? '', (value) =>
    scope.filter({ q: value }, true),
  )
  const canWait = ['OWNER', 'BRANCH_MANAGER'].includes(scope.user?.role ?? '')
  const tab = p.get('tab') ?? 'OPEN',
    closed = ['COMPLETED', 'CANCELLED'].includes(tab),
    // PM 21/11: tab "Chờ hàng" (đơn cọc) chỉ Owner, BM; Staff gõ URL cũng không mở được bộ lọc này.
    awaiting = canWait && tab === 'AWAITING_STOCK',
    // PM 17/11: tab "Nháp" ngoài cùng bên phải (Owner, BM) thay cho mục "Đơn nháp" trên sidebar.
    drafts = !staff && tab === 'DRAFT'
  const from = p.get('from') ?? today(),
    to = p.get('to') ?? today()
  const page = Math.max(0, Number(p.get('page')) || 0)
  const resource = useSalesList(
    {
      storeId: scope.storeId,
      view: tab === 'PICKED' || awaiting ? 'OPEN' : tab,
      q: p.get('q') ?? '',
      createdFrom: closed ? from : '',
      createdTo: closed ? to : '',
      depositStatus: awaiting ? p.get('depositStatus') || undefined : undefined,
      page,
      size: 20,
    },
    tab === 'PICKED'
      ? 'PICKED'
      : awaiting
        ? 'AWAITING_STOCK'
        : staff && tab === 'OPEN'
          ? 'AWAITING_PICKING'
          : (p.get('status') ?? ''),
    !drafts && (!closed || from <= to),
  )
  const matches: SalesOrderRow[] = orders.length
    ? orders
    : (resource.data?.items ?? [])
        .filter((o) => tab !== 'PICKED' || o.status === 'PICKED')
        .map(
          (o) =>
            ({
              id: o.id,
              code: documentCode('SO', o.id),
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
              deposit: null,
              depositApplied: 0,
              depositStatus: o.depositStatus ?? null,
              depositRemaining: o.depositRemaining ?? null,
            }) as SalesOrderRow,
        )
  const createAction = (
    <div className="sales-list-actions">
      {['OWNER', 'BRANCH_MANAGER'].includes(scope.user?.role ?? '') && (
        <Link className="sales-primary" to="/sales-orders/new">
          Tạo đơn bán
        </Link>
      )}
    </div>
  )
  const tabBar = (
    <div className="stock-tabs">
      {(staff
        ? [
            ['OPEN', 'Cần lấy'],
            ['PICKED', 'Đã gửi'],
          ]
        : [
            ['OPEN', 'Chưa hoàn tất'],
            ...(canWait ? [['AWAITING_STOCK', 'Chờ hàng']] : []),
            ['COMPLETED', 'Hoàn tất'],
            ['CANCELLED', 'Đã hủy'],
            ['DRAFT', 'Nháp'],
          ]
      ).map(([value, label]) => (
        <button
          key={value}
          aria-pressed={tab === value}
          onClick={() =>
            scope.filter({ tab: value, status: '', depositStatus: '' })
          }
        >
          {label}
        </button>
      ))}
    </div>
  )
  if (drafts)
    return (
      <Shell>
        <InventoryPanel title="Đơn nháp của tôi" action={createAction}>
          {tabBar}
          <SalesDraftTab scope={scope} />
        </InventoryPanel>
      </Shell>
    )
  return (
    <Shell>
      <InventoryPanel
        title={staff ? 'Việc lấy hàng của tôi' : 'Danh sách đơn bán'}
        action={createAction}
      >
        {tabBar}
        <div className="stock-filters">
          <WarehouseFilter
            owner={scope.owner}
            stores={scope.stores}
            value={scope.storeId}
            onChange={(storeId) => scope.filter({ storeId })}
          />
          <label>
            Tìm đơn, khách hàng
            <input {...search} placeholder="Mã đơn, tên hoặc số điện thoại…" />
          </label>
          {awaiting && (
            <label>
              Cọc
              <select
                value={p.get('depositStatus') ?? ''}
                onChange={(e) =>
                  scope.filter({ depositStatus: e.target.value })
                }
              >
                <option value="">Tất cả</option>
                <option value="ACTIVE">{depositStatusLabels.ACTIVE}</option>
                <option value="EXPIRED">{depositStatusLabels.EXPIRED}</option>
              </select>
            </label>
          )}
          {!closed && !staff && !awaiting && (
            <label>
              Trạng thái
              <select
                value={p.get('status') ?? ''}
                onChange={(e) => scope.filter({ status: e.target.value })}
              >
                <option value="">Mọi trạng thái</option>
                {(
                  [
                    'AWAITING_STOCK',
                    'AWAITING_PICKING',
                    'PICKED',
                    'CONFIRMED',
                  ] as const
                ).map((s) => (
                  <option key={s} value={s}>
                    {salesStates[s]}
                  </option>
                ))}
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
                  staff ? 'Người giao' : 'Thành tiền',
                  'Trạng thái',
                  'Thao tác',
                ].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matches.map((order) => {
                const badge = staff ? null : depositBadge(order)
                return (
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
                      <SalesListTotal total={order.total} />
                    )}
                    <td>
                      {salesStates[order.status]}
                      {badge && (
                        <span
                          className={'sales-deposit-badge tone-' + badge.tone}
                        >
                          {badge.text}
                        </span>
                      )}
                    </td>
                    <td>
                      <div className="mf-row-actions">
                        {order.nextAction === 'RELEASE' ? (
                          <Link
                            className="mf-btn mf-btn--sm mf-btn--primary"
                            to={'/sales-orders/' + order.id}
                          >
                            Chuyển sang soạn
                          </Link>
                        ) : order.nextAction === 'RECORD_PICKING' ? (
                          <Link
                            className="mf-btn mf-btn--sm mf-btn--primary"
                            to={'/sales-orders/' + order.id + '/pick'}
                          >
                            Ghi số đã nhặt
                          </Link>
                        ) : (
                          <Link
                            className={
                              'mf-btn mf-btn--sm ' +
                              (order.nextAction
                                ? 'mf-btn--primary'
                                : 'mf-btn--secondary')
                            }
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
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
              {!matches.length && (
                <tr>
                  <td colSpan={scope.owner ? 7 : 6} className="stock-empty">
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
type Product = SalesProduct
const paymentTypeLabels: Record<SalesPaymentType, string> = {
  ORDER_PAYMENT: 'Thu tiền',
  DEBT_PAYMENT: 'Thu tiền',
  REFUND: 'Hoàn tiền',
  DEPOSIT: 'Tiền cọc',
  DEPOSIT_REFUND: 'Trả lại cọc',
}
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
      <SalesTabsWorkspace
        prefill={
          prefill.get('productId') || prefill.get('customerId')
            ? {
                product: product.data,
                customer: buyer.data?.customer,
                quantity: Number(prefill.get('quantity')),
              }
            : undefined
        }
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
          <>
            <PageBackLink to="/sales-orders" />
            <p role="status">
              Không thể sửa đơn ở trạng thái hoặc quyền hiện tại.
            </p>
          </>
        )
      )}
    </>
  )
}
/**
 * Trang chi tiết đơn. Gắn key theo id để khi chuyển sang đơn khác (vd sau khi chuyển sang soạn) trang dựng lại
 * và đọc thông báo mới từ location.state.
 */
export function SalesOrderDetailPage() {
  const { id } = useParams()
  return <SalesOrderDetailContent key={id} />
}
function SalesOrderDetailContent() {
  const { id } = useParams()
  const location = useLocation()
  const scope = useInventoryScope()
  const initialNotice = location.state as {
    notice?: string
    primaryOrderId?: number
    pendingOrderId?: number
    /** GVHD 24/11: số gợi ý chuyển sang soạn theo phụ tùng, từ màn Đơn chưa đáp ứng đủ. */
    releaseQty?: Record<number, number>
  } | null
  const [revision, setRevision] = useState(0),
    [notice, setNotice] = useState(initialNotice?.notice ?? ''),
    [linkedOrders, setLinkedOrders] = useState({
      primaryOrderId: initialNotice?.primaryOrderId,
      pendingOrderId: initialNotice?.pendingOrderId,
    })
  useEffect(() => {
    const changed = (event: Event) => {
      const raw = (
        event as CustomEvent<
          | string
          | {
              message: string
              orderId?: number
              pendingOrderId?: number
            }
        >
      ).detail
      // Dialog cũ gửi chuỗi thẳng; dialog mới gửi {message, orderId, pendingOrderId}.
      const detail = typeof raw === 'string' ? { message: raw } : raw
      setNotice(detail.message)
      setLinkedOrders({
        primaryOrderId: detail.orderId,
        pendingOrderId: detail.pendingOrderId,
      })
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
          {notice}{' '}
          {linkedOrders.primaryOrderId && (
            <Link to={'/sales-orders/' + linkedOrders.primaryOrderId}>
              Mở đơn bán {documentCode('SO', linkedOrders.primaryOrderId)}
            </Link>
          )}
          {linkedOrders.pendingOrderId && (
            <>
              {' '}
              ·{' '}
              <Link to={'/sales-orders/' + linkedOrders.pendingOrderId}>
                Mở đơn chờ {documentCode('SO', linkedOrders.pendingOrderId)}
              </Link>
            </>
          )}
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

/** Lý do nút "Ghi nhận bán chịu" đang mờ mà người bán cần biết; null khi không có gì để nói. */
function creditBlockReason(order: SalesOrder): string | null {
  if (order.actions?.canRecordCredit) return null
  if (!order.customerId) return 'Khách lẻ không được mua chịu'
  if (order.status === 'CONFIRMED' && (order.unverifiedCount ?? 0) > 0)
    return 'Còn khoản tiền chờ xác minh'
  // Còn lại chỉ có thể là hồ sơ khách chưa ELIGIBLE, khi đơn đã xác nhận và còn phải trả.
  const creditableMoney =
    order.status === 'CONFIRMED' && (order.remainingPayable ?? 0) > 0
  return creditableMoney ? 'Khách chưa đủ điều kiện mua chịu' : null
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
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [refundAmount, setRefundAmount] = useState<number | undefined>()
  const location = useLocation()
  // Màn Đơn chưa đáp ứng đủ mở thẳng hộp chuyển sang soạn (?action=release). Đọc một lần lúc mở trang, vì
  // hiệu ứng bên dưới xóa ?action khỏi URL ngay sau đó.
  const [releaseOpen, setReleaseOpen] = useState(
    () => params.get('action') === 'release' && !!order?.actions?.canRelease,
  )
  const [pendingPayment, setPendingPayment] = useState(false)
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
  useEffect(() => {
    if (!pendingPayment || order?.status !== 'CONFIRMED') return
    const timer = window.setTimeout(() => {
      setPendingPayment(false)
      setAction('payment')
    }, 0)
    return () => window.clearTimeout(timer)
  }, [order?.status, pendingPayment])
  const steps = ['AWAITING_PICKING', 'PICKED', 'CONFIRMED', 'COMPLETED']
  const stage = order ? steps.indexOf(order.status) : -1
  const creditReason = order ? creditBlockReason(order) : null
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
  // Cọc đã nằm trong netPaid; tách riêng để "Đã thu" không tính cọc.
  const depositApplied = order?.depositApplied ?? 0
  const receivedExDeposit = Math.max(0, (order?.netPaid ?? 0) - depositApplied)
  const historyNames: Record<string, string> = {
    CREATED: 'Tạo đơn bán',
    VERSIONED: 'Lưu phiên bản đơn',
    PICKER_ASSIGNED: 'Giao lấy hàng',
    PICKED: 'Gửi số lượng đã lấy',
    CONFIRMED: 'Xác nhận đơn',
    PAYMENT_REJECTED: 'Từ chối thanh toán',
    COMPLETED: 'Hoàn tất đơn',
    CANCELLED: 'Đã hủy',
  }
  return (
    <Shell title={'Đơn bán' + (order ? ' ' + order.code : '')}>
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
                {order?.splitFromOrderId != null && (
                  <span className="sales-split-from">
                    Tách từ{' '}
                    <Link to={'/sales-orders/' + order.splitFromOrderId}>
                      {documentCode('SO', order.splitFromOrderId)}
                    </Link>
                  </span>
                )}
              </div>
              <div className="sales-detail-actions">
                {order && (bm || role === 'OWNER') && (
                  <>
                    {order.actions?.canUpdate && (
                      <Link to={'/sales-orders/' + order.id + '/edit'}>
                        Sửa đơn
                      </Link>
                    )}
                    {order.status !== 'AWAITING_STOCK' &&
                      order.actions?.canAssignPicker && (
                        <button
                          className="sales-action-primary"
                          onClick={() => setAction('assign')}
                        >
                          Giao lấy hàng
                        </button>
                      )}
                    {order.status !== 'AWAITING_STOCK' &&
                      order.actions?.canConfirm && (
                        <button
                          className="sales-action-primary"
                          onClick={() => setAction('confirm')}
                        >
                          Xác nhận đơn
                        </button>
                      )}
                    {order.status !== 'AWAITING_STOCK' &&
                      (order.actions?.canRecordPayment ||
                        order.actions?.canRecordCredit) && (
                        <>
                          <button
                            className={
                              order.actions?.canRecordPayment
                                ? 'sales-action-primary'
                                : undefined
                            }
                            disabled={!order.actions?.canRecordPayment}
                            onClick={() => setAction('payment')}
                          >
                            Ghi nhận thanh toán
                          </button>
                          <button
                            disabled={!order.actions?.canRecordCredit}
                            title={creditReason ?? undefined}
                            onClick={() => setAction('credit')}
                          >
                            Ghi nhận bán chịu
                          </button>
                          {creditReason && (
                            <small className="sales-action-reason">
                              {creditReason}
                            </small>
                          )}
                        </>
                      )}
                    {(order.actions?.canCancel ?? mayCancel(order)) && (
                      <button
                        data-danger="true"
                        onClick={() => setAction('cancel')}
                      >
                        Hủy đơn
                      </button>
                    )}
                    {order.status !== 'AWAITING_STOCK' &&
                      order.actions?.canComplete && (
                        <button
                          className="sales-action-primary"
                          onClick={() => setAction('complete')}
                        >
                          Hoàn tất đơn
                        </button>
                      )}
                    {order.status !== 'AWAITING_STOCK' &&
                      order.payments?.some((p) => p.status === 'UNVERIFIED') &&
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
                    {order.status === 'COMPLETED' && (
                      <Link
                        to={`/documents/SALES_ORDER/${order.id}/print?form=SALES_INVOICE`}
                      >
                        In phiếu bán hàng
                      </Link>
                    )}
                  </>
                )}
                {order?.status === 'AWAITING_STOCK' &&
                  order.actions?.canRelease && (
                    <button
                      type="button"
                      className="sales-action-primary"
                      onClick={() => setReleaseOpen(true)}
                    >
                      Chuyển sang soạn
                    </button>
                  )}
                {order?.status !== 'AWAITING_STOCK' &&
                  order?.actions?.canRecordPicking && (
                    <Link
                      className="sales-action-primary"
                      to={'/sales-orders/' + order.id + '/pick'}
                    >
                      Ghi số đã nhặt
                    </Link>
                  )}
              </div>
            </div>
            {order?.status === 'AWAITING_STOCK' && (
              <div className="sales-awaiting-stock-note" role="status">
                <p>
                  Đơn đang chờ phần hàng còn thiếu. Khi có hàng, chuyển sang
                  soạn để tiếp tục.
                </p>
                <ExpectedReadyDate
                  order={order}
                  editable={!staff && !!order.actions?.canRelease}
                />
              </div>
            )}
            {order?.deposit?.status === 'EXPIRED' && (
              <p className="sales-deposit-banner" role="status">
                {order.deposit.expiresOn
                  ? 'Quá hạn cọc từ ' +
                    viewDate(order.deposit.expiresOn) +
                    '. Đơn không chuyển sang soạn được.'
                  : 'Quá hạn cọc. Đơn không chuyển sang soạn được.'}
              </p>
            )}
            {order &&
              !['CANCELLED', 'AWAITING_STOCK'].includes(order.status) && (
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
            {order?.note && (
              <p className="sales-order-note">
                <strong>Ghi chú đơn:</strong> {order.note}
              </p>
            )}
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
                {depositApplied > 0 && (
                  <div>
                    <dt>Đã cọc</dt>
                    <dd>{money.format(depositApplied)}</dd>
                  </div>
                )}
                <div>
                  <dt>Đã thu</dt>
                  <dd>{money.format(receivedExDeposit)}</dd>
                </div>
                {order.credit > 0 && (
                  <div>
                    <dt>Bán chịu</dt>
                    <dd>{money.format(order.credit)}</dd>
                  </div>
                )}
                <div className="total">
                  <dt>
                    {depositApplied > 0 ? 'Còn phải trả' : 'Còn phải thu'}
                  </dt>
                  <dd>
                    {order.remainingPayable == null
                      ? 'Chưa có dữ liệu'
                      : money.format(order.remainingPayable)}
                  </dd>
                </div>
              </dl>
            )}
          </section>
          {!staff && order && (
            <SalesDepositPanel
              order={order}
              onChanged={(message) =>
                window.dispatchEvent(
                  new CustomEvent('sales-changed', { detail: { message } }),
                )
              }
            />
          )}
          {!staff && (
            <section className="sales-payment-card">
              <h2>Thanh toán</h2>
              {order?.payments?.length ? (
                <ul>
                  {order.payments.map((payment) => (
                    <li key={payment.id}>
                      <div>
                        <strong>
                          {paymentTypeLabels[payment.type] ?? 'Thu tiền'}{' '}
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
                      <div className="sales-payment-row-actions">
                        <span className="sales-version">
                          {payment.status === 'VERIFIED'
                            ? 'Đã xác minh'
                            : payment.status === 'REJECTED'
                              ? 'Đã từ chối'
                              : 'Chờ xác minh'}
                        </span>
                        {order.actions?.canRefund &&
                          !['REFUND', 'DEPOSIT_REFUND'].includes(
                            payment.type,
                          ) &&
                          payment.status === 'VERIFIED' && (
                            <button
                              type="button"
                              onClick={() => {
                                setRefundAmount(payment.amount)
                                setAction('refund')
                              }}
                            >
                              Hoàn khoản này
                            </button>
                          )}
                        {(bm || role === 'OWNER') &&
                          payment.status === 'VERIFIED' && (
                            <Link to={`/documents/PAYMENT/${payment.id}/print`}>
                              {payment.type === 'DEPOSIT'
                                ? 'In phiếu cọc'
                                : 'In phiếu'}
                            </Link>
                          )}
                      </div>
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
          initialRefundAmount={refundAmount}
          onCredit={() => setAction('credit')}
          onPayment={() => setAction('payment')}
          order={order}
          onClose={(nextAction) => {
            if (nextAction === 'payment') setPendingPayment(true)
            setAction(undefined)
          }}
        />
      )}
      {releaseOpen && order && (
        <SalesPendingReleaseDialog
          order={order}
          preset={
            (location.state as { releaseQty?: Record<number, number> } | null)
              ?.releaseQty
          }
          onClose={() => setReleaseOpen(false)}
          onSaved={(message, linked) => {
            setReleaseOpen(false)
            // PM 22/11: tách đơn thì mở đơn lấy ngay (đơn mới), kèm link về đơn còn chờ.
            if (linked.orderId != null && linked.orderId !== order.id) {
              navigate('/sales-orders/' + linked.orderId, {
                state: {
                  notice: message,
                  pendingOrderId: linked.pendingOrderId,
                },
              })
              return
            }
            window.dispatchEvent(
              new CustomEvent('sales-changed', {
                detail: {
                  message,
                  orderId: linked.orderId,
                  pendingOrderId: linked.pendingOrderId,
                },
              }),
            )
          }}
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
    lock = useRef(false),
    awaitingStock = order?.status === 'AWAITING_STOCK'
  const [busy, setBusy] = useState(false)
  const [lines, setLines] = useState<SalesLine[]>(() =>
      [...(order?.lines ?? [])]
        .map((line) => ({
          ...line,
          picked:
            line.picked ??
            suggestedPickingQty(line.requested, line.sellableQty),
          shortReason:
            line.shortReason ??
            (line.sellableQty != null && line.sellableQty < line.requested
              ? 'Hết hàng'
              : ''),
        }))
        .sort((a, b) =>
          (a.binLocation ?? '').localeCompare(b.binLocation ?? '', 'vi'),
        ),
    ),
    [error, setError] = useState('')
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
  const editable = order?.actions?.canRecordPicking ?? false
  return (
    <Shell title={'Ghi số đã lấy' + (order ? ' ' + order.code : '')}>
      <div className="sales-pick-screen">
        <InventoryPanel
          title={
            'Đơn ' +
            (order?.code ?? '') +
            ' · ' +
            (order?.customerName ?? 'Khách lẻ')
          }
          children={
            order?.note ? (
              <p className="sales-order-note">
                <strong>Ghi chú đơn:</strong> {order.note}
              </p>
            ) : null
          }
        />
        <InventoryPanel title="Lấy từng phụ tùng">
          {error && <p role="alert">{error}</p>}
          <div className="stock-table-scroll">
            <table className="stock-table">
              <thead>
                <tr>
                  <th>Phụ tùng</th>
                  <th>Số yêu cầu</th>
                  <th>{awaitingStock ? 'Lấy ngay' : 'Đã lấy'}</th>
                  {awaitingStock && <th>Lấy sau</th>}
                  <th>Lấy đủ</th>
                  <th>Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr
                    key={l.productId}
                    className={
                      l.picked === l.requested ? 'sales-pick-complete' : ''
                    }
                  >
                    <td>
                      <ProductQuickView
                        productId={l.productId}
                        sku={l.sku}
                        partName={l.partName}
                        extraFacts={[
                          ['Kệ', l.binLocation ?? 'chưa có vị trí'],
                          ['Lô gợi ý lấy', l.lotHint ?? 'Không có'],
                        ]}
                      />
                    </td>
                    <td>
                      <strong>{l.requested}</strong>
                    </td>
                    <td>
                      <input
                        disabled={!editable}
                        aria-label={
                          (awaitingStock ? 'Lấy ngay ' : 'Đã nhặt ') + l.sku
                        }
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
                                    short:
                                      e.target.value !== '' &&
                                      Number(e.target.value) < row.requested &&
                                      !!row.shortReason?.trim(),
                                  }
                                : row,
                            ),
                          )
                        }
                      />
                    </td>
                    {awaitingStock && (
                      <td>{Math.max(0, l.requested - (l.picked ?? 0))}</td>
                    )}
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
                                  }
                                : row,
                            ),
                          )
                        }
                      />
                    </td>
                    <td className="sales-pick-note">
                      {/* Ô Ghi chú cho từng dòng: bắt buộc khi lấy thiếu (lý do thiếu), không bắt buộc khi lấy đủ. */}
                      <input
                        disabled={!editable || busy}
                        aria-label={'Ghi chú ' + l.sku}
                        aria-required={(l.picked ?? l.requested) < l.requested}
                        aria-invalid={
                          (l.picked ?? l.requested) < l.requested &&
                          !l.shortReason?.trim()
                        }
                        maxLength={255}
                        placeholder={
                          (l.picked ?? l.requested) < l.requested
                            ? 'Lý do thiếu hàng (bắt buộc)'
                            : 'Ghi chú (nếu có)'
                        }
                        value={l.shortReason ?? ''}
                        onChange={(e) =>
                          setLines((previous) =>
                            previous.map((row) =>
                              row.productId === l.productId
                                ? {
                                    ...row,
                                    // Ghi lý do ở dòng lấy thiếu = xác nhận dòng đó thiếu hàng.
                                    short:
                                      (row.picked ?? row.requested) <
                                        row.requested &&
                                      !!e.target.value.trim(),
                                    shortReason: e.target.value,
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
                    <td colSpan={awaitingStock ? 6 : 5} className="stock-empty">
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
          <div className="sales-pick-actions">
            <Link
              className="sales-cancel"
              to={'/sales-orders/' + (order?.id ?? id)}
            >
              Hủy
            </Link>
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
                  navigate('/sales-orders/' + order.id, { replace: true })
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
    </Shell>
  )
}
/** GVHD 24/11: ngày cửa hàng dự kiến có hàng cho đơn chờ; BM và Owner sửa hoặc xóa được. */
function ExpectedReadyDate({
  order,
  editable,
}: {
  order: SalesOrder
  editable: boolean
}) {
  const [value, setValue] = useState(order.expectedReadyDate ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const overdue =
    !!order.expectedReadyDate && order.expectedReadyDate < todayIso()
  if (!editable)
    return order.expectedReadyDate ? (
      <p className={overdue ? 'sales-expected-overdue' : undefined}>
        Ngày dự kiến có hàng: {viewDate(order.expectedReadyDate)}
      </p>
    ) : null
  const save = async (date: string) => {
    setBusy(true)
    setError('')
    try {
      await axiosClient.put(
        '/sales-orders/' + order.id + '/expected-ready-date',
        {
          expectedReadyDate: date || null,
        },
      )
      window.dispatchEvent(
        new CustomEvent('sales-changed', {
          detail: date
            ? 'Đã lưu ngày dự kiến có hàng ' + viewDate(date) + '.'
            : 'Đã bỏ ngày dự kiến có hàng.',
        }),
      )
    } catch (cause) {
      setError(inventoryError(cause))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="sales-expected-ready">
      <label>
        Ngày dự kiến có hàng
        <input
          type="date"
          min={todayIso()}
          value={value}
          className={overdue ? 'sales-expected-overdue' : undefined}
          onChange={(e) => setValue(e.target.value)}
        />
      </label>
      <button
        type="button"
        className="mf-btn mf-btn--sm mf-btn--secondary"
        disabled={busy || value === (order.expectedReadyDate ?? '')}
        onClick={() => void save(value)}
      >
        {busy ? 'Đang lưu…' : 'Lưu ngày'}
      </button>
      {overdue && (
        <small className="sales-expected-overdue">Đã quá ngày dự kiến.</small>
      )}
      {error && (
        <small className="pos-warn" role="alert">
          {error}
        </small>
      )}
    </div>
  )
}

/** GVHD 24/11: các tab của màn Đơn chưa đáp ứng đủ; "Đang chờ" gồm cả đơn đã đủ hàng. */
const waitingTabs: { value: string; label: string }[] = [
  { value: '', label: 'Đang chờ' },
  { value: 'READY', label: 'Đã đủ hàng' },
  { value: 'RELEASED', label: 'Đã lấy hàng' },
  { value: 'CANCELLED', label: 'Đã hủy' },
]
const waitingStateLabels: Record<WaitingState, string> = {
  WAITING: 'Đang chờ',
  READY: 'Đã đủ hàng',
  RELEASED: 'Đã lấy hàng',
  CANCELLED: 'Đã hủy',
}

export function UnmetDemandPage() {
  const [replenishment, setReplenishment] = useState<UnmetRow>()
  const navigate = useNavigate()
  const scope = useInventoryScope(),
    p = scope.params,
    page = Math.max(0, Number(p.get('page')) || 0),
    tab = p.get('state') ?? '',
    active = tab === '' || tab === 'READY' || tab === 'WAITING'
  const search = useSearchBox(p.get('q') ?? '', (value) =>
    scope.filter({ q: value }, true),
  )
  // Ô Phụ tùng và Khách hàng là ô tìm kiếm thả xuống (Truong 12/11: bỏ nút "Tải thêm"), mỗi ô tìm theo chữ gõ riêng.
  const [productSearch, setProductSearch] = useState('')
  const [customerSearch, setCustomerSearch] = useState('')
  const customers = useChoicePages<Customer>('/customers', customerSearch)
  const products = useChoicePages<Product>('/products', productSearch)
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
    ...(selectedProduct.data && !productSearch.trim()
      ? [selectedProduct.data]
      : []),
    ...(products.data?.items ?? []).filter(
      (item) => productSearch.trim() || item.id !== selectedProduct.data?.id,
    ),
  ]
  const customerOptions = [
    ...(selectedCustomer.data && !customerSearch.trim()
      ? [selectedCustomer.data.customer]
      : []),
    ...(customers.data?.items ?? []).filter(
      (item) =>
        customerSearch.trim() || item.id !== selectedCustomer.data?.customer.id,
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
      state: tab,
      page,
      size: 20,
    },
    0,
    !(p.get('from') && p.get('to') && p.get('from')! > p.get('to')!),
  )
  return (
    <Shell>
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
                {...search}
                placeholder="Tên phụ tùng, SKU hoặc khách hàng…"
              />
            </label>
            <div className="stock-filter sales-unmet-choice">
              <span>Phụ tùng</span>
              <SearchableFilter
                label="Phụ tùng"
                searchPlaceholder="Tên hoặc SKU…"
                value={p.get('productId') ?? ''}
                options={[
                  ...(!productSearch.trim()
                    ? [{ value: '', label: 'Mọi phụ tùng' }]
                    : []),
                  ...productOptions.map((item) => ({
                    value: String(item.id),
                    label: item.sku + ' · ' + item.partName,
                  })),
                ]}
                loading={products.loading}
                error={products.error}
                onSearch={(query) => setProductSearch(query ?? '')}
                onChange={(productId) => scope.filter({ productId })}
              />
            </div>
            <div className="stock-filter sales-unmet-choice">
              <span>Khách hàng</span>
              <SearchableFilter
                label="Khách hàng"
                searchPlaceholder="Tên hoặc số điện thoại…"
                value={p.get('customerId') ?? ''}
                options={[
                  ...(!customerSearch.trim()
                    ? [{ value: '', label: 'Mọi khách hàng' }]
                    : []),
                  ...customerOptions.map((item) => ({
                    value: String(item.id),
                    label: item.customerName,
                  })),
                ]}
                loading={customers.loading}
                error={customers.error}
                onSearch={(query) => setCustomerSearch(query ?? '')}
                onChange={(customerId) => scope.filter({ customerId })}
              />
            </div>
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
          <div
            className="sales-unmet-tabs"
            role="tablist"
            aria-label="Trạng thái đơn chờ"
          >
            {waitingTabs.map((item) => (
              <button
                key={item.value}
                type="button"
                role="tab"
                aria-selected={tab === item.value}
                className={tab === item.value ? 'active' : undefined}
                onClick={() => scope.filter({ state: item.value })}
              >
                {item.label}
              </button>
            ))}
          </div>
          <p className="sales-unmet-description">
            Chỉ gồm đơn khách đồng ý chờ hàng. Hàng về được chia cho đơn chờ
            theo thứ tự tạo đơn, đơn cũ trước; đơn đủ hàng cho mọi dòng hiện "Đã
            đủ hàng". Đơn đã lấy hàng và đã hủy mặc định 30 ngày gần nhất.
          </p>
          <div className="stock-table-scroll">
            <table className="stock-table">
              <thead>
                <tr>
                  <th>Đơn chờ</th>
                  {scope.owner && <th>Cửa hàng</th>}
                  <th>Khách hàng</th>
                  <th>Phụ tùng</th>
                  <th>Khách cần</th>
                  {active && <th>Lấy được ngay</th>}
                  <th>Ngày dự kiến có hàng</th>
                  <th>{tab === 'CANCELLED' ? 'Ngày hủy' : 'Ngày tạo'}</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {data.data?.items.map((row) => (
                  <tr
                    key={row.orderId + '-' + row.lineId}
                    className={row.orderReady ? 'sales-unmet-ready' : undefined}
                  >
                    <td>
                      <Link to={'/sales-orders/' + row.orderId}>
                        SO-{row.orderId}
                      </Link>
                      <span
                        className={
                          'sales-status sales-unmet-state-' + row.state
                        }
                      >
                        {waitingStateLabels[row.state]}
                      </span>
                    </td>
                    {scope.owner && <td>{row.storeName}</td>}
                    <td>
                      {row.customerName ?? 'Khách lẻ'}
                      {row.customerPhone && (
                        <small>
                          <a href={'tel:' + row.customerPhone}>
                            {row.customerPhone}
                          </a>
                        </small>
                      )}
                    </td>
                    <td>
                      {row.partName}
                      <small>{row.sku}</small>
                    </td>
                    <td>
                      <strong>{row.requestedQty}</strong>{' '}
                      <span className="sales-unmet-unit">{row.baseUnit}</span>
                    </td>
                    {active && (
                      <td>
                        {row.readyQty}
                        {row.readyQty < row.requestedQty && (
                          <small>còn bán được {row.sellableQty}</small>
                        )}
                      </td>
                    )}
                    <td
                      className={
                        row.overdue ? 'sales-expected-overdue' : undefined
                      }
                    >
                      {row.expectedReadyDate
                        ? viewDate(row.expectedReadyDate)
                        : '—'}
                      {row.overdue && <small>Quá hạn</small>}
                    </td>
                    <td>{dateTime(row.occurredAt)}</td>
                    <td>
                      <div className="mf-row-actions sales-unmet-actions">
                        {active && row.readyQty > 0 && (
                          <button
                            type="button"
                            className="mf-btn mf-btn--sm mf-btn--primary"
                            onClick={() =>
                              navigate(
                                '/sales-orders/' +
                                  row.orderId +
                                  '?action=release',
                                {
                                  state: {
                                    releaseQty: Object.fromEntries(
                                      (data.data?.items ?? [])
                                        .filter(
                                          (item) =>
                                            item.orderId === row.orderId,
                                        )
                                        .map((item) => [
                                          item.productId,
                                          item.readyQty,
                                        ]),
                                    ),
                                  },
                                },
                              )
                            }
                          >
                            {row.orderReady
                              ? 'Chuyển sang soạn'
                              : 'Soạn phần có hàng'}
                          </button>
                        )}
                        {active && !row.orderReady && (
                          <button
                            type="button"
                            className="mf-btn mf-btn--sm mf-btn--secondary"
                            onClick={() => setReplenishment(row)}
                          >
                            Yêu cầu bổ sung
                          </button>
                        )}
                        {!active && (
                          <Link
                            className="mf-btn mf-btn--sm mf-btn--secondary"
                            to={'/sales-orders/' + row.orderId}
                          >
                            Xem đơn
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {data.data && !data.data.items.length && (
                  <tr>
                    <td
                      colSpan={(scope.owner ? 8 : 7) + (active ? 1 : 0)}
                      className="stock-empty"
                    >
                      Không có đơn chờ phù hợp.
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
