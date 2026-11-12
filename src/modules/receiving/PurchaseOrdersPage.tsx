import PageBackLink from '../../shared/ui/PageBackLink'
import { isAxiosError } from 'axios'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import axiosClient from '../../shared/api/axiosClient'
import { useAuth } from '../../shared/hooks/useAuth'
import Icon from '../../shared/ui/Icon'
import PageHeader from '../../shared/ui/PageHeader'
import Hint from '../../shared/ui/Hint'
import { formatDateTime } from '../../shared/utils/format'
import { draftKey, readDraft } from '../../shared/utils/localDraft'
import SearchableFilter from '../../shared/ui/SearchableFilter'
import type { DashboardStore } from '../../shared/types/store'
import { apiMessage } from '../suppliers/supplierService'
import { dateTime } from '../inventory/presentation'
import ReceiptActionDialog from './ReceiptActionDialog'
import { receiptWork, type WorkReceipt } from './receivingRules'
import {
  purchaseOrderCode,
  receiptStatusLabels,
  orderHistoryLabels,
} from './receivingPresentation'
import './receiving.css'

type Order = {
  id: number
  supplierId: number
  supplierName: string
  storeName: string
  createdAt: string
  expectedArrival: string | null
  status: string
  orderedValue: number | null
  overdue: boolean
  lineCount: number
  openDiscrepancies: number
}
type Assignment = {
  goodsReceiptNoteId: number
  purchaseOrderId: number
  supplierName: string
  deliveryDocumentNo: string
  arrivedAt: string
  taskStatus: string
  lineCount: number
}
type Page<T> = { items: T[]; totalItems: number }
type ReceiptRow = WorkReceipt
type RowWork = { receipt?: ReceiptRow }
type Detail = Order & {
  canCreateReceipt: boolean
  canCreateReplacement: boolean
  canUpdate: boolean
  canCancel: boolean
  note: string | null
  createdByName: string | null
  cancelledAt: string | null
  cancelledByName: string | null
  cancellationReason: string | null
  lines: {
    id: number
    sku: string
    partName: string
    orderedQty: number
    receivedQty: number
    outstandingQty: number
    purchasePrice: number | null
  }[]
  receipts: {
    id: number
    deliveryDocumentNo: string
    arrivedAt: string
    status: string
    replacement: boolean
    recordedByName?: string | null
    lines: { excessDecision: string }[]
  }[]
  discrepancies: {
    id: number
    goodsReceiptNoteId: number
    partName: string
    shortQty: number
    wrongItemQty: number
    damagedQty: number
    rejectedExcessQty: number
  }[]
  history: {
    action: string
    actorName: string | null
    at: string
    reason: string | null
    delivery: {
      oldExpectedArrival: string | null
      newExpectedArrival: string | null
      oldNote: string | null
      newNote: string | null
    } | null
    lineChanges: {
      productId: number
      sku: string
      partName: string
      oldQty: number | null
      newQty: number | null
      oldPrice: number | null
      newPrice: number | null
    }[]
  }[]
}

function purchaseOrderHistory(detail: Detail) {
  const history = [...(detail.history ?? [])]
  const hasAction = (action: string) =>
    history.some(
      (entry) =>
        entry.action === action || entry.action === 'PURCHASE_ORDER_' + action,
    )
  if (detail.createdAt && !hasAction('CREATED')) {
    history.push({
      action: 'CREATED',
      actorName: detail.createdByName,
      at: detail.createdAt,
      reason: null,
      delivery: null,
      lineChanges: [],
    })
  }
  if (detail.cancelledAt && !hasAction('CANCELLED')) {
    history.unshift({
      action: 'CANCELLED',
      actorName: detail.cancelledByName,
      at: detail.cancelledAt,
      reason: detail.cancellationReason,
      delivery: null,
      lineChanges: [],
    })
  }
  return history
}

const views = [
  ['OPEN', 'Đang mở'],
  ['FULLY_RECEIVED', 'Đã nhận đủ'],
  ['CANCELLED', 'Đã hủy'],
  ['ALL', 'Tất cả'],
]
const labels = receiptStatusLabels
const money = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
})
const pageSize = 20

async function loadWorkQueue(
  params: Record<string, string | boolean>,
  signal: AbortSignal,
) {
  const receipts: ReceiptRow[] = []
  for (let page = 0; ; page++) {
    const { data } = await axiosClient.get<Page<ReceiptRow>>(
      '/goods-receipt-notes',
      {
        params: { ...params, page, size: 100 },
        signal,
      },
    )
    receipts.push(...data.items)
    if (!data.items.length || receipts.length >= data.totalItems)
      return receipts
  }
}
function day(value: string | null) {
  // Review T6: một kiểu ngày dd/MM/yyyy, giữ đúng giờ Việt Nam BE trả về.
  return value ? formatDateTime(value).slice(0, 10) : '—'
}

function receivingError(error: unknown) {
  if (
    isAxiosError(error) &&
    error.response?.status === 404 &&
    error.response.data?.code === 'MSG70'
  ) {
    return 'Chức năng nhập hàng hiện chưa sẵn sàng. Vui lòng thử lại sau.'
  }
  return apiMessage(error)
}

function Status({ value }: { value: string }) {
  return (
    <span
      className={'receiving-status receiving-status--' + value.toLowerCase()}
    >
      {labels[value] ?? value}
    </span>
  )
}

export default function PurchaseOrdersPage() {
  const { user } = useAuth()
  const staff = user?.role === 'STAFF'
  const owner = user?.role === 'OWNER'
  const manager = user?.role === 'BRANCH_MANAGER'
  const [view, setView] = useState('OPEN')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const [supplierId, setSupplierId] = useState('')
  const [storeId, setStoreId] = useState('')
  const [stores, setStores] = useState<DashboardStore[]>([])
  const [createdFrom, setCreatedFrom] = useState('')
  const [createdTo, setCreatedTo] = useState('')
  const dateRangeError =
    view !== 'OPEN' && !!createdFrom && !!createdTo && createdFrom > createdTo
  const [suppliers, setSuppliers] = useState<
    { id: number; supplierName: string }[]
  >([])
  const [work, setWork] = useState<Record<number, RowWork>>({})
  const [action, setAction] = useState<{
    receipt: ReceiptRow
    mode: 'assign' | 'confirm'
  } | null>(null)
  const [revision, setRevision] = useState(0)
  const [orders, setOrders] = useState<Page<Order>>()
  const [assignments, setAssignments] = useState<Page<Assignment>>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (staff) return
    const controller = new AbortController()
    async function loadSuppliers() {
      const items = new Map<number, { id: number; supplierName: string }>()
      let loaded = 0
      for (let page = 0; ; page++) {
        const params = { page, size: 100 }
        const signal = controller.signal
        if (manager) {
          const { data } = await axiosClient.get<Page<Order>>(
            '/purchase-orders',
            {
              params: { ...params, view: 'ALL' },
              signal,
            },
          )
          for (const row of data.items)
            items.set(row.supplierId, {
              id: row.supplierId,
              supplierName: row.supplierName,
            })
          break
        } else {
          const { data } = await axiosClient.get<
            Page<{ id: number; supplierName: string }>
          >('/suppliers', { params, signal })
          for (const row of data.items) items.set(row.id, row)
          loaded += data.items.length
          if (!data.items.length || loaded >= data.totalItems) break
        }
      }
      return [...items.values()].sort((a, b) =>
        a.supplierName.localeCompare(b.supplierName, 'vi'),
      )
    }
    void loadSuppliers()
      .then((items) => {
        if (!controller.signal.aborted)
          setSuppliers((previous) => {
            const known = new Map(previous.map((item) => [item.id, item]))
            for (const item of items) known.set(item.id, item)
            return [...known.values()].sort((a, b) =>
              a.supplierName.localeCompare(b.supplierName, 'vi'),
            )
          })
      })
      .catch(() => {
        if (!controller.signal.aborted) setSuppliers([])
      })
    return () => controller.abort()
  }, [staff, manager])

  useEffect(() => {
    if (!owner) return
    const controller = new AbortController()
    const signal = controller.signal
    void axiosClient
      .get<DashboardStore[]>('/stores', { signal })
      .then(({ data }) => {
        if (!signal.aborted) setStores(data)
      })
      .catch(() => {
        if (!signal.aborted) setStores([])
      })
    return () => controller.abort()
  }, [owner])

  useEffect(() => {
    if (dateRangeError) return
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setLoading(true)
      setError('')
      try {
        if (staff) {
          const { data } = await axiosClient.get<Page<Assignment>>(
            '/goods-receipt-notes/assigned-to-me',
            {
              params: { page, size: pageSize },
              signal: controller.signal,
            },
          )
          if (!controller.signal.aborted) setAssignments(data)
        } else {
          const { data } = await axiosClient.get<Page<Order>>(
            '/purchase-orders',
            {
              params: {
                page,
                size: pageSize,
                view,
                q: query.trim().replace(/^YCN-0*/i, '') || undefined,
                supplierId: supplierId || undefined,
                storeId: owner ? storeId || undefined : undefined,
                createdFrom:
                  view !== 'OPEN' ? createdFrom || undefined : undefined,
                createdTo: view !== 'OPEN' ? createdTo || undefined : undefined,
              },
              signal: controller.signal,
            },
          )
          if (controller.signal.aborted) return
          setOrders(data)
          if (manager) {
            setSuppliers((previous) => {
              const known = new Map(previous.map((item) => [item.id, item]))
              for (const row of data.items)
                known.set(row.supplierId, {
                  id: row.supplierId,
                  supplierName: row.supplierName,
                })
              return [...known.values()].sort((a, b) =>
                a.supplierName.localeCompare(b.supplierName, 'vi'),
              )
            })
            const queues = await Promise.all([
              loadWorkQueue(
                { status: 'AWAITING_CONFIRMATION' },
                controller.signal,
              ),
              loadWorkQueue({ unassigned: true }, controller.signal),
            ])
            if (!controller.signal.aborted) {
              const receipts = queues.flat()
              setWork(
                Object.fromEntries(
                  data.items.map((row) => [
                    row.id,
                    { receipt: receiptWork(receipts, row.id) },
                  ]),
                ),
              )
            }
          }
        }
      } catch (error) {
        if (!controller.signal.aborted) setError(receivingError(error))
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }, 200)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [
    page,
    query,
    staff,
    view,
    supplierId,
    manager,
    revision,
    owner,
    storeId,
    createdFrom,
    createdTo,
    dateRangeError,
  ])

  const total = dateRangeError
    ? 0
    : ((staff ? assignments : orders)?.totalItems ?? 0)
  return (
    <main
      className={
        manager || staff
          ? 'dashboard-content receiving-page receiving-bm-list'
          : 'dashboard-content receiving-page'
      }
    >
      <PageHeader
        title="Yêu cầu nhập hàng"
        breadcrumb={[{ label: 'Nhập hàng' }, { label: 'Yêu cầu nhập hàng' }]}
      />
      {owner && <PurchaseDraftNotice user={user} />}
      <section className="receiving-panel">
        <header className="receiving-panel-head">
          <h2>
            {staff
              ? 'Việc kiểm nhận của tôi'
              : owner
                ? 'Yêu cầu nhập hàng toàn chuỗi'
                : user?.storeName
                  ? 'Yêu cầu nhập hàng · ' + user.storeName
                  : 'Yêu cầu nhập hàng của cửa hàng'}
          </h2>
          {owner && (
            <div className="receiving-filter-row">
              {/* Một nút chính mỗi vùng: hai lối tắt còn lại là nút phụ. */}
              <Link
                className="mf-btn mf-btn--secondary"
                to="/goods-receipt-notes/excess"
              >
                Chờ duyệt hàng thừa
              </Link>
              <Link
                className="mf-btn mf-btn--secondary"
                to="/supplier-discrepancies"
              >
                Hồ sơ sai lệch nhà cung cấp
              </Link>
              <Link
                className="receiving-layout-primary"
                to="/purchase-orders/new"
              >
                ＋ Tạo yêu cầu nhập hàng
              </Link>
            </div>
          )}
        </header>
        {staff && (
          <div className="receiving-filters">
            <div
              className="receiving-views"
              aria-label="Trạng thái việc kiểm nhận"
            >
              <button
                type="button"
                aria-pressed={true}
                onClick={() => {
                  setView('OPEN')
                  setPage(0)
                }}
              >
                Việc của tôi
                {!loading && !error && (
                  <span className="receiving-pill">{total}</span>
                )}
              </button>
            </div>
          </div>
        )}
        {!staff && (
          <div className="receiving-filters">
            <div className="receiving-views" aria-label="Trạng thái">
              {views.map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={view === value}
                  onClick={() => {
                    setView(value)
                    setPage(0)
                  }}
                >
                  {label}
                  {manager &&
                    value === 'OPEN' &&
                    view === 'OPEN' &&
                    !loading &&
                    !error && <span className="receiving-pill">{total}</span>}
                </button>
              ))}
            </div>
            <div className="receiving-filter-row">
              <div className="receiving-list-search">
                <Icon name="search" />
                <input
                  aria-label="Tìm mã yêu cầu hoặc nhà cung cấp"
                  placeholder="Tìm mã yêu cầu, nhà cung cấp"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value)
                    setPage(0)
                  }}
                />
              </div>
              {owner && (
                <SearchableFilter
                  label="Kho nhận"
                  value={storeId}
                  disabled={!stores.length}
                  options={[
                    { value: '', label: 'Mọi kho nhận' },
                    ...stores.map((store) => ({
                      value: String(store.id),
                      label: store.storeName,
                    })),
                  ]}
                  onChange={(value) => {
                    setStoreId(value)
                    setPage(0)
                  }}
                />
              )}
              <SearchableFilter
                label="Nhà cung cấp"
                value={supplierId}
                disabled={!suppliers.length}
                options={[
                  { value: '', label: 'Mọi nhà cung cấp' },
                  ...suppliers.map((supplier) => ({
                    value: String(supplier.id),
                    label: supplier.supplierName,
                  })),
                ]}
                onChange={(value) => {
                  setSupplierId(value)
                  setPage(0)
                }}
              />
              {view !== 'OPEN' && (
                <>
                  <label>
                    Từ ngày{' '}
                    <input
                      type="date"
                      value={createdFrom}
                      onChange={(event) => {
                        setCreatedFrom(event.target.value)
                        setPage(0)
                      }}
                    />
                  </label>
                  <label>
                    Đến ngày{' '}
                    <input
                      type="date"
                      value={createdTo}
                      onChange={(event) => {
                        setCreatedTo(event.target.value)
                        setPage(0)
                      }}
                    />
                  </label>
                </>
              )}
            </div>
          </div>
        )}
        {dateRangeError && (
          <p role="alert">Ngày kết thúc phải từ ngày bắt đầu trở đi.</p>
        )}
        {!dateRangeError && loading && <p role="status">Đang tải…</p>}
        {!dateRangeError && !loading && error && <p role="alert">{error}</p>}
        {
          <>
            <div className="table-scroll">
              {staff ? (
                <table>
                  <thead>
                    <tr>
                      <th>Phiếu nhập</th>
                      <th>Yêu cầu</th>
                      <th>Nhà cung cấp</th>
                      <th>Ngày nhận</th>
                      <th>Hàng cần nhận</th>
                      <th>Kết quả của tôi</th>
                      <th>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!loading &&
                      !error &&
                      assignments?.items.map((row) => (
                        <tr key={row.goodsReceiptNoteId}>
                          <td>
                            <Link
                              to={
                                '/goods-receipt-notes/' + row.goodsReceiptNoteId
                              }
                            >
                              {row.deliveryDocumentNo}
                            </Link>
                          </td>
                          <td>{purchaseOrderCode(row.purchaseOrderId)}</td>
                          <td>{row.supplierName}</td>
                          <td>{day(row.arrivedAt)}</td>
                          <td>{row.lineCount} mã</td>
                          <td>
                            <Status value={row.taskStatus} />
                          </td>
                          <td>
                            <div className="mf-row-actions">
                              <Link
                                className={
                                  'mf-btn mf-btn--sm ' +
                                  (row.taskStatus === 'ASSIGNED'
                                    ? 'mf-btn--primary'
                                    : 'mf-btn--secondary')
                                }
                                to={
                                  '/goods-receipt-notes/' +
                                  row.goodsReceiptNoteId
                                }
                              >
                                {row.taskStatus === 'ASSIGNED'
                                  ? 'Kiểm nhận'
                                  : 'Xem kết quả'}
                              </Link>
                            </div>
                          </td>
                        </tr>
                      ))}
                    {!total && (
                      <tr>
                        <td colSpan={7} className="receiving-empty-cell">
                          Bạn chưa có phiếu được giao kiểm nhận.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Yêu cầu</th>
                      <th>Nhà cung cấp</th>
                      {owner && <th>Kho nhận</th>}
                      <th>Ngày lập</th>
                      <th>Giao dự kiến</th>
                      {owner && <th>Giá trị</th>}
                      {manager && (
                        <>
                          <th>Hàng cần nhận</th>
                          <th>Kiểm nhận</th>
                        </>
                      )}
                      <th>Trạng thái</th>
                      <th>{manager ? 'Thao tác' : 'Sai lệch chưa đóng'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!dateRangeError &&
                      !loading &&
                      !error &&
                      orders?.items.map((row) => {
                        const detail = work[row.id]
                        const receipt = detail?.receipt
                        return (
                          <tr key={row.id}>
                            <td>
                              <Link
                                className="receiving-request-link"
                                to={'/purchase-orders/' + row.id}
                              >
                                {purchaseOrderCode(row.id)}
                              </Link>
                            </td>
                            <td>{row.supplierName}</td>
                            {owner && <td>{row.storeName}</td>}
                            <td className="mf-nowrap">{day(row.createdAt)}</td>
                            <td
                              className={
                                'mf-nowrap' +
                                (row.overdue ? ' receiving-overdue' : '')
                              }
                            >
                              {row.overdue && '⚠ '}
                              {day(row.expectedArrival)}
                            </td>
                            {owner && (
                              <td className="mf-nowrap">
                                {row.orderedValue === null
                                  ? '—'
                                  : money.format(row.orderedValue)}
                              </td>
                            )}
                            {manager && (
                              <>
                                <td>{row.lineCount} mã</td>
                                <td>{receipt?.assigneeName ?? '—'}</td>
                              </>
                            )}
                            <td>
                              <Status value={row.status} />
                            </td>
                            <td>
                              {manager ? (
                                <div className="mf-row-actions">
                                  {receipt?.status ===
                                  'AWAITING_CONFIRMATION' ? (
                                    <button
                                      type="button"
                                      className="mf-btn mf-btn--sm mf-btn--primary"
                                      onClick={() =>
                                        setAction({ receipt, mode: 'confirm' })
                                      }
                                    >
                                      Xác nhận
                                    </button>
                                  ) : receipt &&
                                    [
                                      'AWAITING_INSPECTION',
                                      'AWAITING_RECOUNT',
                                    ].includes(receipt.status) &&
                                    !receipt.assigneeName ? (
                                    <button
                                      type="button"
                                      className="mf-btn mf-btn--sm mf-btn--primary"
                                      onClick={() =>
                                        setAction({ receipt, mode: 'assign' })
                                      }
                                    >
                                      Giao việc
                                    </button>
                                  ) : (
                                    <Link
                                      className="mf-btn mf-btn--sm mf-btn--secondary"
                                      to={'/purchase-orders/' + row.id}
                                    >
                                      Xem chi tiết
                                    </Link>
                                  )}
                                </div>
                              ) : (
                                row.openDiscrepancies || '—'
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    {!total && (
                      <tr>
                        <td colSpan={8} className="receiving-empty-cell">
                          Chưa có yêu cầu nhập hàng để hiển thị.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
            {
              <footer className="receiving-pagination">
                <span>
                  {total
                    ? `Hiển thị ${page * pageSize + 1}–${Math.min((page + 1) * pageSize, total)} trên ${total} chứng từ`
                    : 'Chưa có chứng từ'}
                </span>
                <button
                  type="button"
                  aria-label="Trang trước"
                  disabled={page === 0}
                  onClick={() => setPage(page - 1)}
                >
                  ‹
                </button>
                <span className="receiving-pill">{page + 1}</span>
                <button
                  type="button"
                  aria-label="Trang sau"
                  disabled={(page + 1) * pageSize >= total}
                  onClick={() => setPage(page + 1)}
                >
                  ›
                </button>
              </footer>
            }
          </>
        }
      </section>
      {action && (
        <ReceiptActionDialog
          key={action.receipt.id + action.mode}
          receiptId={action.receipt.id}
          documentNo={action.receipt.deliveryDocumentNo}
          mode={action.mode}
          onClose={() => setAction(null)}
          onSaved={() => {
            setAction(null)
            setRevision((value) => value + 1)
          }}
        />
      )}
    </main>
  )
}

export function PurchaseOrderDetailPage() {
  const { id } = useParams()
  return <PurchaseOrderDetail key={id} id={id} />
}

function PurchaseOrderDetail({ id }: { id?: string }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const owner = user?.role === 'OWNER'
  const [detail, setDetail] = useState<Detail>()
  const [assignedNames, setAssignedNames] = useState<
    Record<number, string | null>
  >({})
  const [error, setError] = useState('')
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [cancelError, setCancelError] = useState('')
  const validId = /^[1-9]\d*$/.test(id ?? '')
  useEffect(() => {
    if (!validId) return
    const controller = new AbortController()
    axiosClient
      .get<Detail>('/purchase-orders/' + id, { signal: controller.signal })
      .then(({ data }) => {
        if (!controller.signal.aborted) setDetail(data)
      })
      .catch((error) => {
        if (!controller.signal.aborted) setError(receivingError(error))
      })
    return () => controller.abort()
  }, [id, validId])
  useEffect(() => {
    if (!id || !detail?.receipts.some((receipt) => !receipt.recordedByName))
      return
    const controller = new AbortController()
    void loadWorkQueue({ purchaseOrderId: id }, controller.signal)
      .then((rows) => {
        if (!controller.signal.aborted)
          setAssignedNames(
            Object.fromEntries(rows.map((row) => [row.id, row.assigneeName])),
          )
      })
      .catch(() => {
        // Receipt cards remain available if assignment information cannot be loaded.
      })
    return () => controller.abort()
  }, [id, detail])
  const history = detail ? purchaseOrderHistory(detail) : []

  return (
    <main className="dashboard-content receiving-page">
      <PageBackLink to="/purchase-orders" />
      <header className="receiving-heading">
        <h1>Yêu cầu nhập hàng {purchaseOrderCode(id ?? '')}</h1>
        {detail && <Status value={detail.status} />}
      </header>
      {detail &&
        (detail.canUpdate ||
          detail.canCancel ||
          detail.canCreateReceipt ||
          detail.canCreateReplacement) && (
          <div className="receiving-layout-actions">
            {detail.canUpdate && (
              <button
                type="button"
                className="receiving-layout-primary"
                onClick={() =>
                  navigate('/purchase-orders/' + detail.id + '/edit')
                }
              >
                Sửa yêu cầu
              </button>
            )}
            {detail.canCancel && (
              <button
                type="button"
                aria-expanded={cancelOpen}
                disabled={cancelling}
                onClick={() => setCancelOpen((value) => !value)}
              >
                Hủy yêu cầu
              </button>
            )}
            {(detail.canCreateReceipt || detail.canCreateReplacement) && (
              <Link
                className="receiving-layout-primary"
                to={'/purchase-orders/' + detail.id + '/receipts/new'}
              >
                Lập phiếu nhập
              </Link>
            )}
          </div>
        )}
      {detail?.canCancel && cancelOpen && (
        <form
          className="receiving-panel"
          onSubmit={async (event) => {
            event.preventDefault()
            if (cancelling) return
            const reason = String(
              new FormData(event.currentTarget).get('reason') ?? '',
            ).trim()
            if (!reason) {
              setCancelError('Vui lòng nhập lý do hủy.')
              return
            }
            setCancelError('')
            setCancelling(true)
            try {
              const { data } = await axiosClient.post<Detail>(
                '/purchase-orders/' + detail.id + '/cancel',
                { reason },
              )
              setDetail(data)
              setCancelOpen(false)
            } catch (error) {
              setCancelError(apiMessage(error))
            } finally {
              setCancelling(false)
            }
          }}
        >
          <h2>Hủy yêu cầu nhập hàng</h2>
          <div className="receiving-layout-fields">
            <label>
              Lý do hủy <textarea name="reason" required maxLength={255} />
            </label>
          </div>
          {cancelError && <p role="alert">{cancelError}</p>}
          <div className="receiving-layout-actions">
            <button
              type="submit"
              className="receiving-layout-primary"
              disabled={cancelling}
            >
              Xác nhận hủy
            </button>
          </div>
        </form>
      )}
      {!validId ? (
        <p role="alert">Mã đơn đặt hàng không hợp lệ.</p>
      ) : error ? (
        <p role="alert">{error}</p>
      ) : (
        !detail && <p role="status">Đang tải đơn đặt hàng…</p>
      )}
      {detail && (
        <div className="receiving-split">
          <div className="receiving-stack">
            <section className="receiving-panel">
              <h2>Thông tin chung</h2>
              <dl className="receiving-info">
                <div>
                  <dt>Nhà cung cấp</dt>
                  <dd>{detail.supplierName}</dd>
                </div>
                <div>
                  <dt>Kho nhận</dt>
                  <dd>{detail.storeName}</dd>
                </div>
                <div>
                  <dt>Ngày lập</dt>
                  <dd>{day(detail.createdAt)}</dd>
                </div>
                <div>
                  <dt>Giao dự kiến</dt>
                  <dd>{day(detail.expectedArrival)}</dd>
                </div>
                <div>
                  <dt>Ghi chú</dt>
                  <dd>{detail.note || '—'}</dd>
                </div>
              </dl>
            </section>

            <section className="receiving-panel">
              <h2>Phụ tùng nhập</h2>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Phụ tùng</th>
                      <th>Số đặt</th>
                      <th>Đã nhận</th>
                      <th>Còn thiếu</th>
                      {owner && <th>Đơn giá</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {detail.lines.map((line) => (
                      <tr key={line.id}>
                        <td>
                          {line.partName}
                          <small>{line.sku}</small>
                        </td>
                        <td>{line.orderedQty}</td>
                        <td>{line.receivedQty}</td>
                        <td>{line.outstandingQty}</td>
                        {owner && (
                          <td>
                            {line.purchasePrice === null
                              ? '—'
                              : money.format(line.purchasePrice)}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="receiving-panel">
              <h2>Lượt nhận hàng</h2>
              {!detail.receipts.length ? (
                <p>Chưa có phiếu nhập hàng.</p>
              ) : (
                <ul className="receiving-receipt-cards">
                  {detail.receipts.map((receipt) => {
                    const inspector =
                      receipt.recordedByName ?? assignedNames[receipt.id]
                    return (
                      <li key={receipt.id}>
                        <Link
                          className="receiving-receipt-card"
                          to={'/goods-receipt-notes/' + receipt.id}
                        >
                          <div className="receiving-receipt-card-info">
                            <strong>{detail.supplierName}</strong>
                            {inspector && (
                              <span>Người kiểm nhận: {inspector}</span>
                            )}
                            <small>
                              {receipt.deliveryDocumentNo} ·{' '}
                              {day(receipt.arrivedAt)}
                              {receipt.replacement ? ' · Giao bù' : ''}
                            </small>
                          </div>
                          <Status value={receipt.status} />
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>

            <section className="receiving-panel">
              <h2>Sai lệch nhà cung cấp</h2>
              {!detail.discrepancies.length ? (
                <p>Chưa có sai lệch.</p>
              ) : (
                <ul className="receiving-items">
                  {detail.discrepancies.map((row) => (
                    <li key={row.id}>
                      <Link
                        to={
                          '/supplier-discrepancies?receipt=' +
                          row.goodsReceiptNoteId
                        }
                      >
                        {row.partName}
                      </Link>
                      Thiếu {row.shortQty} · Giao sai {row.wrongItemQty} · Hỏng{' '}
                      {row.damagedQty} · Từ chối nhận thừa{' '}
                      {row.rejectedExcessQty}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <section className="receiving-panel">
            <h2>Lịch sử</h2>
            {!history.length ? (
              <p>Chưa có lịch sử.</p>
            ) : (
              <ol className="receiving-timeline">
                {history.map((entry, index) => (
                  <li key={index}>
                    <strong>
                      {orderHistoryLabels[entry.action] ??
                        'Đã cập nhật yêu cầu'}
                    </strong>
                    <small>
                      {dateTime(entry.at)}
                      {entry.actorName && ' · ' + entry.actorName}
                    </small>
                    {entry.delivery && (
                      <div>
                        {entry.delivery.oldExpectedArrival !==
                          entry.delivery.newExpectedArrival && (
                          <p>
                            Ngày giao: {day(entry.delivery.oldExpectedArrival)}{' '}
                            thành {day(entry.delivery.newExpectedArrival)}
                          </p>
                        )}
                        {entry.delivery.oldNote !== entry.delivery.newNote && (
                          <p>
                            Ghi chú: {entry.delivery.oldNote || '—'} thành{' '}
                            {entry.delivery.newNote || '—'}
                          </p>
                        )}
                      </div>
                    )}
                    {!!entry.lineChanges?.length && (
                      <ul>
                        {entry.lineChanges.map((change) => (
                          <li key={change.productId}>
                            {change.sku}: Số lượng {change.oldQty ?? '—'} thành{' '}
                            {change.newQty ?? '—'}
                            {owner && change.oldPrice !== change.newPrice && (
                              <span>
                                {' '}
                                · Giá{' '}
                                {change.oldPrice == null
                                  ? '—'
                                  : money.format(change.oldPrice)}{' '}
                                thành{' '}
                                {change.newPrice == null
                                  ? '—'
                                  : money.format(change.newPrice)}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                    {entry.reason && <p>Lý do {entry.reason}</p>}
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      )}
    </main>
  )
}

/** Nhắc Owner còn bản nháp yêu cầu nhập hàng lưu trên máy này. */
function PurchaseDraftNotice({
  user,
}: {
  user: Parameters<typeof draftKey>[1]
}) {
  const [saved] = useState(() =>
    readDraft<{ lines: unknown[] }>(draftKey('purchase-order', user)),
  )
  if (!saved) return null
  return (
    <Hint>
      Bạn có một bản nháp yêu cầu nhập hàng ({saved.data.lines.length} dòng) lưu
      lúc {formatDateTime(saved.savedAt)}.{' '}
      <Link to="/purchase-orders/new">Mở bản nháp</Link>
    </Hint>
  )
}
