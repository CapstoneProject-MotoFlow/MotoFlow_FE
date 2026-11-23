/**
 * File: modules/inventory/StockDocumentsPage.tsx
 * Loại: MÀN HÌNH — Quản lý phiếu xuất nhập (PM 23/11, Q8 + G5; BE #98 GET /stock-documents).
 * Công dụng: Danh sách mọi phiếu nhập / phiếu xuất làm đổi tồn kho của kho (bán, nhập NCC, trả NCC, điều chuyển,
 * điều chỉnh, kiểm kê) và chi tiết từng phiếu. Chỉ xem: xử lý ở màn nghiệp vụ gốc qua nút "Mở màn xử lý".
 * Không có In / Lưu PDF / Xuất Excel. Owner xem mọi kho và thấy giá trị; BM, Staff chỉ kho mình, không có giá trị.
 */
import { Link, useParams, useSearchParams } from 'react-router-dom'
import PageBackLink from '../../shared/ui/PageBackLink'
import { documentCode } from '../../shared/utils/documentCode'
import { formatMoney } from '../../shared/utils/format'
import { useInventoryData, useInventoryScope } from './api'
import {
  InventoryNotice,
  InventoryPanel,
  Pagination,
  WarehouseFilter,
} from './components'
import { dateTime, number } from './presentation'
import type { Page } from './types'
import './inventory-screens.css'

type Direction = 'IN' | 'OUT'
type SourceType =
  | 'SALES_ORDER'
  | 'GOODS_RECEIPT_NOTE'
  | 'TRANSFER_ORDER'
  | 'DISCREPANCY_RESOLUTION_EVENT'
  | 'ADJUSTMENT_REQUEST'
  | 'STOCK_COUNT'

export type StockDocument = {
  sourceType: SourceType
  sourceId: number
  code: string
  kind: string
  storeId: number
  storeName: string
  direction: Direction
  occurredAt: string
  performedByName: string
  lineCount: number
  quantity: number
  /** Chỉ Owner (BR-72). */
  value?: number
  transferOrderId: number | null
  discrepancyCaseId: number | null
}

type StockDocumentLine = {
  productId: number
  sku: string
  partName: string
  lotId: number | null
  expiryDate: string | null
  quantity: number
  unitCost?: number
  value?: number
}

const kindLabels: Record<string, string> = {
  SALE: 'Xuất bán',
  SUPPLIER_RECEIPT: 'Nhập nhà cung cấp',
  SUPPLIER_RETURN: 'Trả nhà cung cấp',
  TRANSFER_DISPATCH: 'Xuất điều chuyển',
  TRANSFER_RECEIPT: 'Nhận điều chuyển',
  TRANSFER_RETURN: 'Nhận hàng trả về kho nguồn',
  TRANSFER_EXCESS_DISPATCH: 'Xuất hàng thừa điều chuyển',
  ADJUSTMENT: 'Điều chỉnh tồn',
  STOCK_COUNT: 'Kiểm kê',
}
const inKinds = [
  'SUPPLIER_RECEIPT',
  'TRANSFER_RECEIPT',
  'TRANSFER_RETURN',
  'ADJUSTMENT',
  'STOCK_COUNT',
]
const outKinds = [
  'SALE',
  'SUPPLIER_RETURN',
  'TRANSFER_DISPATCH',
  'TRANSFER_EXCESS_DISPATCH',
  'ADJUSTMENT',
  'STOCK_COUNT',
]

/** Mã phiếu theo cùng kiểu các màn khác; BE chỉ đặt sẵn mã cho đơn bán, phiếu nhập và lệnh điều chuyển. */
function stockDocumentCode(row: Pick<StockDocument, 'sourceType' | 'sourceId' | 'code'>) {
  switch (row.sourceType) {
    case 'SALES_ORDER':
      return documentCode('SO', row.sourceId)
    case 'GOODS_RECEIPT_NOTE':
      return documentCode('PN', row.sourceId)
    case 'TRANSFER_ORDER':
      return documentCode('DC', row.sourceId)
    case 'STOCK_COUNT':
      return documentCode('KK', row.sourceId)
    case 'ADJUSTMENT_REQUEST':
      return 'Điều chỉnh #' + row.sourceId
    case 'DISCREPANCY_RESOLUTION_EVENT':
      return 'Trả NCC #' + row.sourceId
    default:
      return row.code
  }
}

/** Màn nghiệp vụ gốc của phiếu; null khi vai trò không mở được màn đó. */
function stockDocumentSource(
  row: Pick<StockDocument, 'sourceType' | 'sourceId' | 'kind' | 'transferOrderId'>,
  role: string,
): string | null {
  const staff = role === 'STAFF'
  switch (row.sourceType) {
    case 'SALES_ORDER':
      return '/sales-orders/' + row.sourceId
    case 'GOODS_RECEIPT_NOTE':
      return row.transferOrderId != null
        ? '/transfer-orders/' + row.transferOrderId + '/receipts/' + row.sourceId
        : '/goods-receipt-notes/' + row.sourceId
    case 'TRANSFER_ORDER':
      return '/transfer-orders/' + row.sourceId
    case 'STOCK_COUNT':
      return '/stock-counts/' + row.sourceId
    case 'ADJUSTMENT_REQUEST':
      return staff ? null : '/adjustments/' + row.sourceId
    case 'DISCREPANCY_RESOLUTION_EVENT':
      return staff ? null : '/supplier-discrepancies'
    default:
      return null
  }
}

function detailPath(row: StockDocument) {
  return (
    '/stock-documents/' +
    row.sourceType +
    '/' +
    row.sourceId +
    '?direction=' +
    row.direction +
    '&storeId=' +
    row.storeId
  )
}

export default function StockDocumentsPage() {
  const scope = useInventoryScope()
  const p = scope.params
  const direction: Direction = p.get('direction') === 'OUT' ? 'OUT' : 'IN'
  const kind = p.get('kind') ?? ''
  const from = p.get('from') ?? ''
  const to = p.get('to') ?? ''
  const q = p.get('q') ?? ''
  const page = Number(p.get('page') ?? 0) || 0
  const invalid = !!from && !!to && from > to
  const documents = useInventoryData<Page<StockDocument>>(
    '/stock-documents',
    {
      direction,
      kind: kind || undefined,
      storeId: scope.storeId || undefined,
      from: from || undefined,
      to: to || undefined,
      q: q.trim() || undefined,
      page,
      size: 20,
    },
    0,
    !invalid,
  )
  const kinds = direction === 'IN' ? inKinds : outKinds
  return (
    <main className="inventory-workspace inventory-screen">
      <InventoryNotice
        loading={documents.loading}
        error={
          invalid
            ? 'Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.'
            : (documents.error ?? scope.storesError)
        }
      />
      <InventoryPanel title="Phiếu xuất nhập">
        <div className="stock-tabs" role="tablist" aria-label="Chiều phiếu">
          {(
            [
              ['IN', 'Phiếu nhập'],
              ['OUT', 'Phiếu xuất'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              role="tab"
              aria-selected={direction === key}
              onClick={() => scope.filter({ direction: key, kind: '' })}
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
          <label className="stock-filter">
            <span>Loại phiếu</span>
            <select
              value={kind}
              onChange={(event) => scope.filter({ kind: event.target.value })}
            >
              <option value="">Mọi loại phiếu</option>
              {kinds.map((key) => (
                <option key={key} value={key}>
                  {kindLabels[key]}
                </option>
              ))}
            </select>
          </label>
          <label className="stock-filter">
            <span>Từ ngày</span>
            <input
              type="date"
              max={to || undefined}
              value={from}
              onChange={(event) => scope.filter({ from: event.target.value })}
            />
          </label>
          <label className="stock-filter">
            <span>Đến ngày</span>
            <input
              type="date"
              min={from || undefined}
              value={to}
              onChange={(event) => scope.filter({ to: event.target.value })}
            />
          </label>
          <label className="stock-filter">
            <span>Tìm</span>
            <input
              type="search"
              placeholder="Mã phiếu, SKU, tên phụ tùng"
              defaultValue={q}
              onKeyDown={(event) => {
                if (event.key === 'Enter')
                  scope.filter({ q: event.currentTarget.value })
              }}
              onBlur={(event) => scope.filter({ q: event.currentTarget.value })}
            />
          </label>
        </div>
        <div className="stock-table-scroll">
          <table className="stock-table">
            <thead>
              <tr>
                <th>Mã phiếu</th>
                <th>Loại phiếu</th>
                <th>Kho</th>
                <th>Thời điểm</th>
                <th>Người làm</th>
                <th>Số dòng</th>
                <th>Tổng số lượng</th>
                {scope.owner && <th>Giá trị</th>}
              </tr>
            </thead>
            <tbody>
              {documents.data?.items.map((row) => (
                <tr key={row.sourceType + row.sourceId + row.storeId + row.direction}>
                  <td>
                    <Link to={detailPath(row)}>{stockDocumentCode(row)}</Link>
                  </td>
                  <td>{kindLabels[row.kind] ?? row.kind}</td>
                  <td>{row.storeName}</td>
                  <td className="mf-nowrap">{dateTime(row.occurredAt)}</td>
                  <td>{row.performedByName}</td>
                  <td>{number.format(row.lineCount)}</td>
                  <td>{number.format(row.quantity)}</td>
                  {scope.owner && <td>{formatMoney(row.value)}</td>}
                </tr>
              ))}
              {documents.data && !documents.data.items.length && (
                <tr>
                  <td colSpan={scope.owner ? 8 : 7} className="stock-empty">
                    Chưa có phiếu {direction === 'IN' ? 'nhập' : 'xuất'} nào khớp bộ lọc.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          total={documents.data?.totalItems ?? 0}
          page={page}
          loading={documents.loading}
          onPage={(next) =>
            scope.setParams((previous) => {
              const params = new URLSearchParams(previous)
              params.set('page', String(next))
              return params
            })
          }
        />
      </InventoryPanel>
    </main>
  )
}

export function StockDocumentDetailPage() {
  const { type, sourceId } = useParams()
  const [params] = useSearchParams()
  const scope = useInventoryScope()
  const direction = params.get('direction') === 'OUT' ? 'OUT' : 'IN'
  const valid = !!type && /^[1-9]\d*$/.test(sourceId ?? '')
  const detail = useInventoryData<{
    document: StockDocument
    lines: StockDocumentLine[]
  }>(
    '/stock-documents/' + type + '/' + sourceId,
    { direction, storeId: params.get('storeId') ?? undefined },
    0,
    valid,
  )
  const doc = detail.data?.document
  const source = doc ? stockDocumentSource(doc, scope.user?.role ?? '') : null
  return (
    <main className="inventory-workspace inventory-screen">
      <PageBackLink to={'/stock-documents?direction=' + direction} />
      <InventoryNotice
        loading={detail.loading}
        error={valid ? detail.error : 'Không tìm thấy phiếu.'}
      />
      {doc && (
        <InventoryPanel
          title={
            (doc.direction === 'IN' ? 'Phiếu nhập ' : 'Phiếu xuất ') +
            stockDocumentCode(doc)
          }
          action={
            source && (
              <Link className="mf-btn mf-btn--primary mf-btn--sm" to={source}>
                Mở màn xử lý
              </Link>
            )
          }
        >
          <dl className="stock-document-meta">
            <div>
              <dt>Loại phiếu</dt>
              <dd>{kindLabels[doc.kind] ?? doc.kind}</dd>
            </div>
            <div>
              <dt>Kho</dt>
              <dd>{doc.storeName}</dd>
            </div>
            <div>
              <dt>Thời điểm</dt>
              <dd>{dateTime(doc.occurredAt)}</dd>
            </div>
            <div>
              <dt>Người làm</dt>
              <dd>{doc.performedByName}</dd>
            </div>
            <div>
              <dt>Tổng số lượng</dt>
              <dd>{number.format(doc.quantity)}</dd>
            </div>
            {scope.owner && (
              <div>
                <dt>Giá trị</dt>
                <dd>{formatMoney(doc.value)}</dd>
              </div>
            )}
          </dl>
          <div className="stock-table-scroll">
            <table className="stock-table">
              <thead>
                <tr>
                  <th>Phụ tùng</th>
                  <th>Lô</th>
                  <th>Hạn sử dụng</th>
                  <th>Số lượng</th>
                  {scope.owner && (
                    <>
                      <th>Giá vốn</th>
                      <th>Giá trị</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {detail.data?.lines.map((line, index) => (
                  <tr key={line.productId + ':' + (line.lotId ?? index)}>
                    <td>
                      {line.partName}
                      <small>{line.sku}</small>
                    </td>
                    <td>{line.lotId == null ? '—' : documentCode('L', line.lotId)}</td>
                    <td>
                      {line.expiryDate
                        ? line.expiryDate.split('-').reverse().join('/')
                        : '—'}
                    </td>
                    <td>{number.format(line.quantity)}</td>
                    {scope.owner && (
                      <>
                        <td>{formatMoney(line.unitCost)}</td>
                        <td>{formatMoney(line.value)}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </InventoryPanel>
      )}
    </main>
  )
}
