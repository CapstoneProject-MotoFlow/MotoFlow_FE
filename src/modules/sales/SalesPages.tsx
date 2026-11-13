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
import type { Customer } from '../customers/types'
import PageBackLink from '../../shared/ui/PageBackLink'
import SearchableFilter from '../../shared/ui/SearchableFilter'

import {
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
import DemandReplenishment from './DemandReplenishment'
import { SalesOrderFormView, type SalesProduct } from './SalesOrderForm'
import { documentCode } from '../../shared/utils/documentCode'
import { salesOrderStatusLabels as salesStates } from '../../shared/labels/status'
export { SalesOrderFormView }
import './sales.css'
function Header({
  title,
  breadcrumb = title,
}: {
  title: string
  breadcrumb?: ReactNode
}) {
  return (
    <header className="stock-heading">
      <div>
        <h1>{title}</h1>
      </div>
      <div className="stock-heading-actions">
        <nav>
          <Link to="/dashboard">Trang chủ</Link> › {breadcrumb}
        </nav>
      </div>
    </header>
  )
}
function Shell({
  title,
  children,
  breadcrumb,
  backTo,
}: {
  title: string
  children: ReactNode
  breadcrumb?: ReactNode
  backTo?: string
}) {
  return (
    <main className="inventory-workspace sales-workspace">
      {backTo && <PageBackLink to={backTo} />}
      <Header title={title} breadcrumb={breadcrumb} />
      {children}
    </main>
  )
}
export function SalesListTotal({ total }: { total?: number | null }) {
  return <td>{total == null ? 'Chưa có dữ liệu' : money.format(total)}</td>
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
            }) as SalesOrder,
        )
  return (
    <Shell title={staff ? 'Đơn được giao lấy hàng' : 'Đơn bán'}>
      <InventoryPanel
        title={staff ? 'Việc lấy hàng của tôi' : 'Danh sách đơn bán'}
        action={
          <div className="sales-list-actions">
            {['OWNER', 'BRANCH_MANAGER'].includes(scope.user?.role ?? '') && (
              <Link className="sales-primary" to="/sales-orders/new">
                Tạo đơn bán
              </Link>
            )}
          </div>
        }
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
                  staff ? 'Người giao' : 'Thành tiền',
                  'Trạng thái',
                  'Thao tác',
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
                    <SalesListTotal total={order.total} />
                  )}
                  <td>{salesStates[order.status]}</td>
                  <td>
                    <div className="mf-row-actions">
                      {order.nextAction === 'RECORD_PICKING' ? (
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
              ))}
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
    CANCELLED: 'Đã hủy',
  }
  return (
    <Shell
      title={'Đơn bán' + (order ? ' ' + order.code : '')}
      breadcrumb={
        <>
          <Link to="/sales-orders">Đơn bán</Link> › {order?.code ?? id}
        </>
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
                          title={
                            !order.actions?.canRecordCredit && !order.customerId
                              ? 'Khách lẻ không được mua chịu'
                              : undefined
                          }
                          onClick={() => setAction('credit')}
                        >
                          Ghi nhận bán chịu
                        </button>
                        {!order.actions?.canRecordCredit &&
                          !order.customerId && (
                            <small className="sales-action-reason">
                              Khách lẻ không được mua chịu
                            </small>
                          )}
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
    [error, setError] = useState('')
  const [onlyMissing, setOnlyMissing] = useState(false)
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
    <Shell
      title={'Ghi số đã lấy' + (order ? ' ' + order.code : '')}
      breadcrumb={
        <>
          Việc lấy hàng ›{' '}
          <Link to={'/sales-orders/' + (order?.id ?? id)}>
            {order?.code ?? id}
          </Link>{' '}
          › Lấy hàng
        </>
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
          children={null}
        />
        <InventoryPanel
          title="Lấy từng phụ tùng"
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
                  <th>Ghi chú</th>
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
                                      short:
                                        e.target.value !== '' &&
                                        Number(e.target.value) <
                                          row.requested &&
                                        !!row.shortReason?.trim(),
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
                          aria-required={
                            (l.picked ?? l.requested) < l.requested
                          }
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
                    <td colSpan={5} className="stock-empty">
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
    </Shell>
  )
}
export function UnmetDemandPage() {
  const [replenishment, setReplenishment] = useState<UnmetRow>()
  const scope = useInventoryScope(),
    p = scope.params,
    page = Math.max(0, Number(p.get('page')) || 0)
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
      page,
      size: 20,
    },
    0,
    !(p.get('from') && p.get('to') && p.get('from')! > p.get('to')!),
  )
  return (
    <Shell
      title="Đơn chưa đáp ứng đủ"
      breadcrumb={
        <>
          <Link to="/sales-orders">Đơn bán</Link> › Đơn chưa đáp ứng đủ
        </>
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
                  <th>Thao tác</th>
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
                      <div className="mf-row-actions sales-unmet-actions">
                        <Link
                          className="mf-btn mf-btn--sm mf-btn--primary"
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
                        <button
                          type="button"
                          className="mf-btn mf-btn--sm mf-btn--secondary"
                          onClick={() => setReplenishment(row)}
                        >
                          Yêu cầu bổ sung
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {data.data && !data.data.items.length && (
                  <tr>
                    <td colSpan={scope.owner ? 8 : 7} className="stock-empty">
                      Không có đơn chưa đáp ứng đủ phù hợp.
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
