import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import axiosClient from '../../../shared/api/axiosClient'
import EmptyState from '../../../shared/ui/EmptyState'
import { documentCode } from '../../../shared/utils/documentCode'
import { formatDateTime } from '../../../shared/utils/format'
import { useInventoryScope } from '../../inventory/api'
import { purchaseOrderSearch } from '../../receiving/receivingPresentation'
import { decisionStatusLabels, errorMessage, type Case } from './types'

const pageSize = 20

type Supplier = { id: number; supplierName: string }

/** NH3b + R-10: danh sách hồ sơ theo phụ tùng, lọc ở BE (#78), một trang mỗi lần. */
export default function CaseListView({
  initialPurchaseOrder,
}: {
  initialPurchaseOrder: string
}) {
  const scope = useInventoryScope()
  const [status, setStatus] = useState('OPEN')
  // GVHD 24/11: lọc theo hướng xử lý; Owner dùng "Chờ Owner duyệt".
  const [decisionStatus, setDecisionStatus] = useState('')
  const [purchaseOrderQuery, setPurchaseOrderQuery] = useState(() =>
    /^[1-9]\d*$/.test(initialPurchaseOrder)
      ? documentCode('DNH', Number(initialPurchaseOrder))
      : '',
  )
  const [supplierId, setSupplierId] = useState('')
  const [productQuery, setProductQuery] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [rows, setRows] = useState<Case[]>([])
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const purchaseOrderId = purchaseOrderSearch(purchaseOrderQuery)
  const invalidOrder = !!purchaseOrderId && !/^[1-9]\d*$/.test(purchaseOrderId)
  const dateRangeError = !!fromDate && !!toDate && fromDate > toDate
  const filtered =
    status !== 'OPEN' ||
    !!decisionStatus ||
    !!scope.storeId ||
    !!purchaseOrderQuery ||
    !!supplierId ||
    !!productQuery ||
    !!fromDate ||
    !!toDate

  useEffect(() => {
    if (invalidOrder || dateRangeError) return
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const { data } = await axiosClient.get<{ items: Case[]; totalItems: number }>(
          '/discrepancy-cases',
          {
            params: {
              status: status || undefined,
              decisionStatus: decisionStatus || undefined,
              storeId: scope.storeId || undefined,
              purchaseOrderId: purchaseOrderId || undefined,
              supplierId: supplierId || undefined,
              q: productQuery.trim() || undefined,
              deliveredFrom: fromDate || undefined,
              deliveredTo: toDate || undefined,
              page,
              size: pageSize,
            },
            signal: controller.signal,
          },
        )
        if (!controller.signal.aborted) {
          setRows(data.items)
          setTotal(data.totalItems)
          setError('')
        }
      } catch (failure) {
        if (!controller.signal.aborted) setError(errorMessage(failure))
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }, 300)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [page, status, decisionStatus, scope.storeId, purchaseOrderId, invalidOrder, supplierId, productQuery, fromDate, toDate, dateRangeError])

  // Danh sách NCC cho bộ lọc: Owner đọc danh mục NCC; BM không có quyền đó nên lấy từ đơn nhập hàng của kho mình.
  useEffect(() => {
    const controller = new AbortController()
    const request = scope.owner
      ? axiosClient.get<{ items: Supplier[] }>('/suppliers', {
          params: { page: 0, size: 100 },
          signal: controller.signal,
        })
      : axiosClient.get<{ items: { supplierId: number; supplierName: string }[] }>(
          '/purchase-orders',
          { params: { view: 'ALL', page: 0, size: 100 }, signal: controller.signal },
        )
    void request
      .then(({ data }) => {
        if (controller.signal.aborted) return
        const items = new Map<number, Supplier>()
        for (const row of data.items as Array<{
          id?: number
          supplierId?: number
          supplierName: string
        }>) {
          const id = row.supplierId ?? row.id
          if (id != null) items.set(id, { id, supplierName: row.supplierName })
        }
        setSuppliers(
          [...items.values()].sort((a, b) =>
            a.supplierName.localeCompare(b.supplierName, 'vi'),
          ),
        )
      })
      .catch(() => {
        if (!controller.signal.aborted) setSuppliers([])
      })
    return () => controller.abort()
  }, [scope.owner])

  function reset() {
    setStatus('OPEN')
    setDecisionStatus('')
    setPurchaseOrderQuery('')
    setSupplierId('')
    setProductQuery('')
    setFromDate('')
    setToDate('')
    if (scope.storeId) scope.filter({ storeId: '' })
    setPage(0)
  }

  const pages = Math.ceil(total / pageSize)

  return (
    <>
      <header className="sd-head">
        <div className="sd-head-title">
          <h1>Sai lệch nhà cung cấp</h1>
          {filtered && (
            <button type="button" className="mf-btn mf-btn--sm mf-btn--secondary" onClick={reset}>
              Xóa bộ lọc
            </button>
          )}
        </div>
        <p className="sd-lead">
          Xem gộp theo đơn nhập tại{' '}
          <Link to="/purchase-orders?tab=DISCREPANCY_OPEN">Đơn nhập hàng → Sai lệch</Link>.
        </p>
      </header>

      <section className="sd-filters" aria-label="Bộ lọc">
        <label className="sd-field">
          <span>Trạng thái</span>
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value)
              setPage(0)
            }}
          >
            <option value="OPEN">Đang mở</option>
            <option value="CLOSED">Đã đóng</option>
            <option value="">Tất cả</option>
          </select>
        </label>
        <label className="sd-field">
          <span>Hướng xử lý</span>
          <select
            value={decisionStatus}
            onChange={(event) => {
              setDecisionStatus(event.target.value)
              setPage(0)
            }}
          >
            <option value="">Tất cả</option>
            <option value="UNDECIDED">{decisionStatusLabels.UNDECIDED}</option>
            <option value="AWAITING_OWNER">{decisionStatusLabels.AWAITING_OWNER}</option>
            <option value="DECIDED">{decisionStatusLabels.DECIDED}</option>
          </select>
        </label>
        {scope.owner && (
          <label className="sd-field">
            <span>Cửa hàng</span>
            <select
              value={scope.storeId}
              onChange={(event) => {
                scope.filter({ storeId: event.target.value })
                setPage(0)
              }}
            >
              <option value="">Toàn chuỗi</option>
              {scope.stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.storeName}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="sd-field">
          <span>Nhà cung cấp</span>
          <select
            value={supplierId}
            onChange={(event) => {
              setSupplierId(event.target.value)
              setPage(0)
            }}
          >
            <option value="">Mọi nhà cung cấp</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.supplierName}
              </option>
            ))}
          </select>
        </label>
        <label className="sd-field">
          <span>Phụ tùng</span>
          <input
            value={productQuery}
            placeholder="Tên hoặc SKU"
            onChange={(event) => {
              setProductQuery(event.target.value)
              setPage(0)
            }}
          />
        </label>
        <label className="sd-field">
          <span>Mã đơn nhập</span>
          <input
            value={purchaseOrderQuery}
            placeholder="Ví dụ DNH-0001"
            aria-invalid={invalidOrder}
            onChange={(event) => {
              setPurchaseOrderQuery(event.target.value)
              setPage(0)
            }}
          />
          {invalidOrder && <small className="sd-error">Mã đơn nhập không hợp lệ.</small>}
        </label>
        <label className="sd-field">
          <span>Giao từ ngày</span>
          <input
            type="date"
            value={fromDate}
            max={toDate || undefined}
            onChange={(event) => {
              setFromDate(event.target.value)
              setPage(0)
            }}
          />
        </label>
        <label className="sd-field">
          <span>Đến ngày</span>
          <input
            type="date"
            value={toDate}
            min={fromDate || undefined}
            aria-invalid={dateRangeError}
            onChange={(event) => {
              setToDate(event.target.value)
              setPage(0)
            }}
          />
          {dateRangeError && (
            <small className="sd-error">Phải từ ngày bắt đầu trở đi.</small>
          )}
        </label>
        {scope.storesError && (
          <p role="alert" className="sd-error">
            {scope.storesError}
          </p>
        )}
      </section>

      {error && (
        <p className="sd-alert" role="alert">
          {error}
        </p>
      )}

      <section className="sd-panel">
        {loading && !rows.length ? (
          <div className="sd-skeleton" role="status" aria-label="Đang tải">
            <span />
            <span />
            <span />
          </div>
        ) : !rows.length ? (
          !error && (
            <EmptyState
              message={
                filtered
                  ? 'Không có hồ sơ khớp bộ lọc.'
                  : 'Không có hồ sơ sai lệch nào đang mở.'
              }
              action={
                filtered && (
                  <button type="button" className="mf-btn mf-btn--secondary" onClick={reset}>
                    Xóa bộ lọc
                  </button>
                )
              }
            />
          )
        ) : (
          <div className="sd-table-scroll" aria-busy={loading}>
            <table className="sd-table">
              <thead>
                <tr>
                  <th>Phụ tùng</th>
                  <th>Chứng từ</th>
                  <th>{scope.owner ? 'Nhà cung cấp · Cửa hàng' : 'Nhà cung cấp'}</th>
                  <th>Sai lệch</th>
                  <th>Tình trạng</th>
                  <th>Mở lúc</th>
                  <th>
                    <span className="sd-visually-hidden">Thao tác</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const open = row.status === 'OPEN'
                  const kinds = (
                    [
                      ['Thiếu', row.shortQty],
                      ['Sai', row.wrongItemQty],
                      ['Hỏng', row.damagedQty],
                      ['Thừa', row.rejectedExcessQty],
                    ] as const
                  ).filter(([, quantity]) => quantity > 0)
                  const left = (
                    [
                      ['Trả NCC', row.outstandingReturnQty],
                      ['Giao bù', row.outstandingReplacementQty],
                      ['Đang giữ', row.heldUndecidedQty ?? 0],
                    ] as const
                  ).filter(([, quantity]) => quantity > 0)
                  const to = '/supplier-discrepancies?receipt=' + row.goodsReceiptNoteId
                  return (
                    <tr key={row.id}>
                      <td>
                        <Link to={to} className="sd-part-link">
                          <b>{row.sku}</b>
                          <small>{row.partName}</small>
                        </Link>
                      </td>
                      <td className="mf-nowrap">
                        {documentCode('PN', row.goodsReceiptNoteId)}
                        {row.purchaseOrderId && (
                          <small>
                            <Link to={'/purchase-orders/' + row.purchaseOrderId}>
                              {documentCode('DNH', row.purchaseOrderId)}
                            </Link>
                          </small>
                        )}
                      </td>
                      <td className="sd-supplier-cell">
                        {row.supplierName ?? '—'}
                        {scope.owner && row.storeName && <small>{row.storeName}</small>}
                      </td>
                      <td>
                        <span className="sd-chips">
                          {kinds.map(([label, quantity]) => (
                            <span key={label} className="mf-badge mf-badge--muted">
                              {label} {quantity}
                            </span>
                          ))}
                        </span>
                      </td>
                      <td>
                        <span className="sd-chips">
                          {!open ? (
                            <span className="mf-badge mf-badge--success">Đã đóng</span>
                          ) : left.length ? (
                            left.map(([label, quantity]) => (
                              <span key={label} className="mf-badge mf-badge--warning">
                                {label} {quantity}
                              </span>
                            ))
                          ) : (
                            <span className="mf-badge mf-badge--info">Đang mở</span>
                          )}
                          {open && row.decisionStatus && row.decisionStatus !== 'DECIDED' && (
                            <span
                              className={
                                'mf-badge ' +
                                (row.decisionStatus === 'AWAITING_OWNER'
                                  ? 'mf-badge--info'
                                  : 'mf-badge--warning')
                              }
                            >
                              {decisionStatusLabels[row.decisionStatus]}
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="mf-nowrap">
                        {row.openedAt ? formatDateTime(row.openedAt) : '—'}
                      </td>
                      <td>
                        <Link
                          className={
                            'mf-btn mf-btn--sm ' +
                            (open && row.canHandle ? 'mf-btn--primary' : 'mf-btn--secondary')
                          }
                          to={to}
                        >
                          {open ? 'Xử lý' : 'Xem'}
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        {pages > 1 && (
          <nav className="sd-pagination" aria-label="Phân trang">
            <span>
              {total} hồ sơ · Trang {page + 1} / {pages}
            </span>
            <button
              type="button"
              className="mf-btn mf-btn--sm mf-btn--secondary"
              disabled={page === 0 || loading}
              onClick={() => setPage(page - 1)}
            >
              Trang trước
            </button>
            <button
              type="button"
              className="mf-btn mf-btn--sm mf-btn--secondary"
              disabled={page + 1 >= pages || loading}
              onClick={() => setPage(page + 1)}
            >
              Trang sau
            </button>
          </nav>
        )}
      </section>
    </>
  )
}
