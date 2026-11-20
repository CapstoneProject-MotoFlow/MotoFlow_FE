import PageBackLink from '../../shared/ui/PageBackLink'
import { isAxiosError } from 'axios'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import axiosClient from '../../shared/api/axiosClient'
import { useAuth } from '../../shared/hooks/useAuth'
import Icon from '../../shared/ui/Icon'
import PageHeader from '../../shared/ui/PageHeader'
import { formatDateTime } from '../../shared/utils/format'
import ServerDraftList from '../../shared/ui/ServerDraftList'
import SearchableFilter from '../../shared/ui/SearchableFilter'
import type { DashboardStore } from '../../shared/types/store'
import { apiMessage } from '../suppliers/supplierService'
import { dateTime } from '../inventory/presentation'
import ReceiptActionDialog from './ReceiptActionDialog'
import { receiptWork, type WorkReceipt } from './receivingRules'
import {
  purchaseOrderCode,
  purchaseOrderSearch,
  receiptStatusLabels,
  orderHistoryLabels,
  purchaseOrderDisplayStatus,
} from './receivingPresentation'
import ReceivingAssignment from '../operations/ReceivingAssignment'
import { useReceivingTasks } from '../operations/useReceivingTasks'
import { receivingWork } from '../operations/receivingTaskModel'
import { documentCode } from '../../shared/utils/documentCode'
import { supplierDiscrepancyStatusLabels } from '../../shared/labels/status'
import './receiving.css'

/** GET /purchase-orders/drafts (Mạnh, việc D1 17/11): nháp của chính người dùng, mới nhất trước. */
type PurchaseOrderDraftRow = {
  id: number
  supplierName: string | null
  storeName: string | null
  lineCount: number | null
  orderedValue: number | null
  createdAt: string
  updatedAt?: string | null
}
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
  deliveryDocumentNo: string | null
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
    deliveryDocumentNo: string | null
    arrivedAt: string
    status: string
    replacement: boolean
    recordedByName?: string | null
    submittedAt?: string | null
    confirmedAt?: string | null
    confirmedByName?: string | null
    lines: { excessDecision: string }[]
  }[]
  discrepancies: {
    id: number
    goodsReceiptNoteId: number
    sku?: string
    partName: string
    shortQty: number
    wrongItemQty: number
    damagedQty: number
    rejectedExcessQty: number
    outstandingReturnQty?: number
    outstandingReplacementQty?: number
    status?: string
    openedAt?: string | null
    closedAt?: string | null
  }[]
  history: {
    action: string
    /** Bước do FE ghép từ phiếu nhập / sai lệch (mục 10): hiện đúng chữ này. */
    label?: string
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
  // Mục 10 (PM 19/11): lịch sử BE chỉ có tạo/sửa/hủy đơn nên cột Lịch sử không đổi khi hàng về.
  // Ghép thêm các bước của phiếu nhập và sai lệch NCC (giống "Lịch sử lệnh" của điều chuyển).
  const step = (label: string, at: string, actorName?: string | null) =>
    history.push({
      action: 'STEP',
      label,
      actorName: actorName ?? null,
      at,
      reason: null,
      delivery: null,
      lineChanges: [],
    })
  for (const receipt of detail.receipts ?? []) {
    const code =
      documentCode('PN', receipt.id) + (receipt.replacement ? ' (giao bù)' : '')
    if (receipt.arrivedAt)
      step('Hàng về · phiếu nhập ' + code, receipt.arrivedAt)
    if (receipt.submittedAt)
      step(
        'Đã gửi kết quả kiểm nhận ' + code,
        receipt.submittedAt,
        receipt.recordedByName,
      )
    if (receipt.confirmedAt)
      step(
        'Đã xác nhận phiếu nhập ' + code,
        receipt.confirmedAt,
        receipt.confirmedByName,
      )
  }
  for (const row of detail.discrepancies ?? []) {
    const part = (row.sku ? row.sku + ' · ' : '') + row.partName
    if (row.openedAt) step('Phát sinh sai lệch NCC · ' + part, row.openedAt)
    if (row.closedAt) step('Đã đóng sai lệch NCC · ' + part, row.closedAt)
  }
  const time = (value: string) => new Date(value).getTime() || 0
  // Mới nhất trước, như thứ tự BE trả.
  return history
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => time(b.entry.at) - time(a.entry.at) || a.index - b.index)
    .map(({ entry }) => entry)
}

const views = [
  ['OPEN', 'Đang mở'],
  // Báo lỗi 20/11 (mục 2): đơn còn hồ sơ sai lệch nhà cung cấp chưa đóng.
  ['DISCREPANCY_OPEN', 'Sai lệch'],
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
  // PM 17/11: tab "Nháp" ngoài cùng bên phải cho người tạo đơn (Owner); ?tab=DRAFT mở thẳng tab này.
  const tabs = owner ? [...views, ['DRAFT', 'Nháp']] : views
  const [searchParams, setSearchParams] = useSearchParams()
  const [view, setViewState] = useState(() => {
    const wanted = searchParams.get('tab')
    return tabs.some(([value]) => value === wanted) ? wanted! : 'OPEN'
  })
  function setView(value: string) {
    setViewState(value)
    setSearchParams(value === 'OPEN' ? {} : { tab: value }, { replace: true })
  }
  const drafts = view === 'DRAFT'
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const [supplierId, setSupplierId] = useState('')
  const [storeId, setStoreId] = useState('')
  const [stores, setStores] = useState<DashboardStore[]>([])
  const [createdFrom, setCreatedFrom] = useState('')
  const [createdTo, setCreatedTo] = useState('')
  const dateRangeError =
    view !== 'OPEN' &&
    !drafts &&
    !!createdFrom &&
    !!createdTo &&
    createdFrom > createdTo
  const [suppliers, setSuppliers] = useState<
    { id: number; supplierName: string }[]
  >([])
  const [work, setWork] = useState<Record<number, RowWork>>({})
  const [action, setAction] = useState<{
    receipt: ReceiptRow
    mode: 'assign' | 'confirm'
  } | null>(null)
  const [revision, setRevision] = useState(0)
  const [assigned, setAssigned] = useState('')
  const receivingTasks = useReceivingTasks(['SUPPLIER_RECEIVING'], staff)
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
    if (dateRangeError || drafts) return
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
                q: purchaseOrderSearch(query) || undefined,
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
    drafts,
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
        title="Đơn nhập hàng"
        breadcrumb={[{ label: 'Nhập hàng' }, { label: 'Đơn nhập hàng' }]}
      />
      {assigned && (
        <p className="mf-success-notice" role="status">
          {assigned}
        </p>
      )}
      {staff && receivingTasks.tasks.length > 0 && (
        <section className="receiving-panel">
          <header className="receiving-panel-head">
            <h2>Việc nhận hàng của tôi</h2>
          </header>
          <div className="table-scroll">
            <table className="receiving-task-table">
              <thead>
                <tr>
                  <th>Mã đơn nhập hàng</th>
                  <th>Nhà cung cấp</th>
                  <th>Hàng cần nhận</th>
                  <th>Giao lúc</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {receivingTasks.tasks.map((task) => {
                  const row = receivingWork(task)
                  return (
                    <tr key={row.key}>
                      <td>{row.code}</td>
                      <td>{task.partnerName ?? '—'}</td>
                      <td>
                        {task.lineCount != null ? task.lineCount + ' mã' : '—'}
                      </td>
                      <td>
                        {task.assignedAt ? dateTime(task.assignedAt) : '—'}
                      </td>
                      <td>
                        <div className="mf-row-actions">
                          <Link
                            className="mf-btn mf-btn--sm mf-btn--primary"
                            to={row.href}
                          >
                            {row.action}
                          </Link>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
      <section className="receiving-panel">
        <header className="receiving-panel-head">
          <h2>
            {staff
              ? 'Việc kiểm nhận của tôi'
              : owner
                ? 'Đơn nhập hàng toàn chuỗi'
                : user?.storeName
                  ? 'Đơn nhập hàng · ' + user.storeName
                  : 'Đơn nhập hàng của cửa hàng'}
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
                ＋ Tạo đơn nhập hàng
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
              {tabs.map(([value, label]) => (
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
            <div className="receiving-filter-row" hidden={drafts}>
              <div className="receiving-list-search">
                <Icon name="search" />
                <input
                  aria-label="Tìm mã đơn nhập hàng hoặc nhà cung cấp"
                  placeholder="Tìm mã đơn nhập hàng, nhà cung cấp"
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
        {!drafts && !dateRangeError && loading && (
          <p role="status">Đang tải…</p>
        )}
        {!drafts && !dateRangeError && !loading && error && (
          <p role="alert">{error}</p>
        )}
        {drafts ? (
          <ServerDraftList<PurchaseOrderDraftRow>
            path="/purchase-orders/drafts"
            code={(id) => documentCode('DNH', id)}
            openPath={(id) => '/purchase-orders/drafts/' + id}
            searchLabel="Tìm nháp"
            emptyText='Chưa có nháp. Khi tạo đơn nhập hàng, bấm "Lưu nháp" để lưu lại làm tiếp sau.'
            tableClassName="table-scroll"
            columns={[
              {
                header: 'Nhà cung cấp',
                cell: (row) => row.supplierName ?? '—',
              },
              { header: 'Kho nhận', cell: (row) => row.storeName ?? '—' },
              { header: 'Số dòng', cell: (row) => row.lineCount ?? '—' },
              {
                header: 'Giá trị',
                cell: (row) =>
                  row.orderedValue == null
                    ? '—'
                    : money.format(row.orderedValue),
              },
              {
                header: 'Lưu lúc',
                cell: (row) => formatDateTime(row.updatedAt ?? row.createdAt),
              },
            ]}
          />
        ) : (
          <>
            <div className="table-scroll">
              {staff ? (
                <table>
                  <thead>
                    <tr>
                      <th>Phiếu nhập</th>
                      <th>Mã đơn nhập hàng</th>
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
                              {documentCode('PN', row.goodsReceiptNoteId)}
                            </Link>
                            {row.deliveryDocumentNo && (
                              <small>
                                {' '}
                                · Chứng từ {row.deliveryDocumentNo}
                              </small>
                            )}
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
                      <th>Mã đơn nhập hàng</th>
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
                              <Status value={purchaseOrderDisplayStatus(row)} />
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
                                  ) : [
                                      'AWAITING_DELIVERY',
                                      'RECEIVING',
                                    ].includes(row.status) ? (
                                    // PO còn chờ giao: "Giao việc" mở hộp giao nhân viên nhận hàng.
                                    <ReceivingAssignment
                                      variant="row"
                                      taskType="SUPPLIER_RECEIVING"
                                      documentId={row.id}
                                      fallback={
                                        <Link
                                          className="mf-btn mf-btn--sm mf-btn--secondary"
                                          to={'/purchase-orders/' + row.id}
                                        >
                                          Xem chi tiết
                                        </Link>
                                      }
                                      onSaved={(name) =>
                                        setAssigned(
                                          'Đã giao việc nhận hàng ' +
                                            purchaseOrderCode(row.id) +
                                            ' cho ' +
                                            name +
                                            '.',
                                        )
                                      }
                                    />
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
                          Chưa có đơn nhập hàng để hiển thị.
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
        )}
      </section>
      {action && (
        <ReceiptActionDialog
          key={action.receipt.id + action.mode}
          receiptId={action.receipt.id}
          documentNo={documentCode('PN', action.receipt.id)}
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
  const manager = user?.role === 'BRANCH_MANAGER'
  // Báo lỗi 20/11 (mục 3): đến từ nút "Nhập hàng giao bù" của màn sai lệch thì nói rõ bước tiếp theo.
  const fromReplacement = useSearchParams()[0].has('replacement')
  const [assigned, setAssigned] = useState('')
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
        <h1>Đơn nhập hàng {purchaseOrderCode(id ?? '')}</h1>
        {detail && <Status value={purchaseOrderDisplayStatus(detail)} />}
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
                Sửa đơn nhập hàng
              </button>
            )}
            {detail.canCancel && (
              <button
                type="button"
                aria-expanded={cancelOpen}
                disabled={cancelling}
                onClick={() => setCancelOpen((value) => !value)}
              >
                Hủy đơn nhập hàng
              </button>
            )}
            {manager &&
              (detail.canCreateReceipt || detail.canCreateReplacement) && (
                // BM không tự lập phiếu nữa: giao việc nhận hàng, người được giao lập phiếu nhập khi hàng tới.
                <ReceivingAssignment
                  taskType="SUPPLIER_RECEIVING"
                  documentId={detail.id}
                  onSaved={(name) =>
                    setAssigned('Đã giao việc nhận hàng cho ' + name + '.')
                  }
                />
              )}
          </div>
        )}
      {fromReplacement && manager && detail?.canCreateReplacement && (
        <p className="receiving-replacement-hint" role="status">
          Nhà cung cấp còn phải giao bù hàng cho đơn này. Bấm “Giao việc” để
          giao người nhận hàng giao bù (có thể giao cho chính bạn). Khi hàng
          tới, người được giao bấm “Lập phiếu nhập” và chọn “Giao bù cho sai
          lệch”.
        </p>
      )}
      {assigned && (
        <p className="mf-success-notice" role="status">
          {assigned}
        </p>
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
          <h2>Hủy đơn nhập hàng</h2>
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

            {detail.discrepancies.length > 0 && (
              // Mục 10 (PM 19/11): có sai lệch thì đưa khối này lên ngay dưới Thông tin chung.
              <section className="receiving-panel receiving-discrepancy-panel">
                <h2>
                  Sai lệch nhà cung cấp
                  {detail.openDiscrepancies > 0 && (
                    <span className="receiving-status receiving-status--discrepancy_open">
                      {detail.openDiscrepancies} chưa đóng
                    </span>
                  )}
                </h2>
                <ul className="receiving-items">
                  {detail.discrepancies.map((row) => (
                    <li key={row.id}>
                      <div>
                        <strong>
                          {row.sku ? row.sku + ' · ' : ''}
                          {row.partName}
                        </strong>
                        <small>
                          Phiếu nhập{' '}
                          {documentCode('PN', row.goodsReceiptNoteId)} · Thiếu{' '}
                          {row.shortQty} · Giao sai {row.wrongItemQty} · Hỏng{' '}
                          {row.damagedQty} · Từ chối nhận thừa{' '}
                          {row.rejectedExcessQty}
                          {row.status !== 'CLOSED' &&
                            Boolean(
                              row.outstandingReturnQty ||
                              row.outstandingReplacementQty,
                            ) &&
                            ' · Còn phải trả ' +
                              (row.outstandingReturnQty ?? 0) +
                              ' · Còn phải giao bù ' +
                              (row.outstandingReplacementQty ?? 0)}
                        </small>
                      </div>
                      {row.status && (
                        <span
                          className={
                            'receiving-status ' +
                            (row.status === 'CLOSED'
                              ? 'receiving-status--confirmed'
                              : 'receiving-status--discrepancy_open')
                          }
                        >
                          {supplierDiscrepancyStatusLabels[row.status] ??
                            row.status}
                        </span>
                      )}
                      {(owner || manager) && (
                        <Link
                          className="mf-btn mf-btn--sm mf-btn--secondary"
                          to={
                            '/supplier-discrepancies?receipt=' +
                            row.goodsReceiptNoteId
                          }
                        >
                          {row.status === 'CLOSED' ? 'Xem' : 'Xử lý sai lệch'}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}

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
              <h2>Phiếu nhập</h2>
              {!detail.receipts.length ? (
                <p>Chưa có phiếu nhập.</p>
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
                            <strong>
                              {documentCode('PN', receipt.id)} ·{' '}
                              {detail.supplierName}
                            </strong>
                            {inspector && (
                              <span>Người kiểm nhận: {inspector}</span>
                            )}
                            <small>
                              {receipt.deliveryDocumentNo &&
                                'Chứng từ ' +
                                  receipt.deliveryDocumentNo +
                                  ' · '}
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

            {!detail.discrepancies.length && (
              <section className="receiving-panel">
                <h2>Sai lệch nhà cung cấp</h2>
                <p>Chưa có sai lệch.</p>
              </section>
            )}
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
                      {entry.label ??
                        orderHistoryLabels[entry.action] ??
                        'Đã cập nhật đơn nhập hàng'}
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
