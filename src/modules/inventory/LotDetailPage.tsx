import { Link, useParams } from 'react-router-dom'
import { useCompleteLots, useInventoryData, useInventoryScope } from './api'
import {
  InventoryHeader,
  InventoryNotice,
  InventoryPanel,
  LotState,
  WarehouseFilter,
} from './components'
import { SourceDocument } from './MovementTable'
import {
  date,
  dateTime,
  movementNames,
  lotLink,
  money,
  movementLink,
  sourceNames,
  stockStatuses,
} from './presentation'
import type { LotDetail } from './types'
import './inventory-screens.css'

export default function LotDetailPage() {
  const { id } = useParams()
  const scope = useInventoryScope()
  const lot = useInventoryData<LotDetail>('/inventory/lots/' + id, {
    storeId: scope.storeId,
  })
  const locations = useCompleteLots({
    q: id,
    tab: 'IN_STOCK',
    storeId: scope.storeId,
    size: 100,
  })
  const lotLocations = locations.data?.page.items.filter(
    (row) => row.lotId === Number(id),
  )
  const item = lot.data
  return (
    <main className="inventory-workspace inventory-screen">
      <InventoryHeader title={'Chi tiết lô L-' + String(id).padStart(4, '0')}>
        <Link
          to={
            '/inventory/lots' +
            (scope.storeId
              ? '?storeId=' + scope.storeId + '&tab=IN_STOCK'
              : '?tab=IN_STOCK')
          }
        >
          Danh sách lô
        </Link>
      </InventoryHeader>
      <InventoryNotice
        loading={lot.loading}
        error={lot.error ?? scope.storesError}
      />
      {item && (
        <>
          {item.state === 'EXPIRED' && (
            <p role="status" className="stock-notice stock-danger">
              Lô đã hết hạn, không được bán hoặc điều chuyển. Liên hệ quản lý để
              xử lý hàng hết hạn.
            </p>
          )}
          <div className="lot-detail-layout">
            <div className="lot-detail-main">
              <InventoryPanel
                title="Thông tin lô"
                action={
                  <div className="stock-actions">
                    <LotState state={item.state} />
                    {!scope.owner &&
                      item.state === 'EXPIRED' &&
                      item.remainingQty > 0 && (
                        <button
                          disabled
                          title="Chưa thể gửi yêu cầu hủy lô lúc này"
                        >
                          Báo hủy
                        </button>
                      )}
                  </div>
                }
              >
                {scope.owner && (
                  <InventoryNotice
                    loading={locations.loading}
                    error={locations.error}
                  />
                )}
                <dl className="stock-facts">
                  <div>
                    <dt>Phụ tùng</dt>
                    <dd>
                      <Link
                        to={
                          (scope.owner ? '/owner' : '/branch-manager') +
                          '/products/' +
                          item.productId
                        }
                      >
                        {item.partName}
                      </Link>
                      <small>{item.sku}</small>
                    </dd>
                  </div>
                  <div>
                    <dt>Nguồn lô</dt>
                    <dd>{sourceNames[item.sourceType]}</dd>
                  </div>
                  <div>
                    <dt>Nhà cung cấp</dt>
                    <dd>{item.supplierName ?? '—'}</dd>
                  </div>
                  <div>
                    <dt>Chứng từ gốc</dt>
                    <dd>
                      {item.sourceDocument ? (
                        <SourceDocument
                          type={item.sourceDocument.type}
                          id={item.sourceDocument.id}
                        />
                      ) : (
                        '—'
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>Kho nhận đầu tiên</dt>
                    <dd>{item.firstStoreName}</dd>
                  </div>
                  <div>
                    <dt>Ngày nhập</dt>
                    <dd>{date(item.receivedDate)}</dd>
                  </div>
                  <div>
                    <dt>Lô nhà sản xuất</dt>
                    <dd>{item.manufacturerLotNo ?? '—'}</dd>
                  </div>
                  {item.manufactureDate && (
                    <div>
                      <dt>Ngày sản xuất</dt>
                      <dd>{date(item.manufactureDate)}</dd>
                    </div>
                  )}
                  <div>
                    <dt>Hạn dùng</dt>
                    <dd>{date(item.expiryDate)}</dd>
                  </div>
                  <div>
                    <dt>Số lượng nhập ban đầu</dt>
                    <dd>
                      {item.receivedQty} {item.baseUnit}
                    </dd>
                  </div>
                  {scope.owner && (
                    <div>
                      <dt>
                        {item.sourceType === 'RECEIPT'
                          ? 'Giá nhập theo hóa đơn'
                          : item.sourceType === 'OPENING'
                            ? 'Giá vốn ban đầu'
                            : 'Giá vốn bình quân lúc duyệt'}
                      </dt>
                      <dd>
                        {item.purchaseUnitPrice == null
                          ? '—'
                          : money.format(item.purchaseUnitPrice)}
                      </dd>
                    </div>
                  )}
                </dl>
              </InventoryPanel>
              <InventoryPanel title="Tồn theo trạng thái">
                {scope.owner && lotLocations && lotLocations.length > 1 && (
                  <div className="stock-table-scroll">
                    <table className="stock-table">
                      <thead>
                        <tr>
                          <th>Còn lại theo kho</th>
                          <th>Số lượng</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {lotLocations.map((row) => (
                          <tr key={row.storeId}>
                            <td>{row.storeName}</td>
                            <td>
                              {row.remainingQty} {row.baseUnit}
                            </td>
                            <td>
                              <Link to={lotLink(row.lotId, row.storeId)}>
                                Xem tại kho
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <div className="stock-detail-body">
                  <WarehouseFilter
                    owner={scope.owner}
                    stores={scope.stores}
                    value={String(item.viewStoreId)}
                    onChange={(storeId) =>
                      scope.filter({ storeId: storeId || item.firstStoreId })
                    }
                  />
                  <p>
                    Còn tại kho:{' '}
                    <strong>
                      {item.remainingQty} {item.baseUnit}
                    </strong>
                  </p>
                  <dl className="stock-status-list">
                    {item.byStatus.map((status) => (
                      <div key={status.stockStatus}>
                        <dt>
                          {stockStatuses[status.stockStatus] ??
                            status.stockStatus}
                        </dt>
                        <dd>
                          {status.quantity} {item.baseUnit}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  <Link
                    to={movementLink(
                      item.productId,
                      item.viewStoreId,
                      item.lotId,
                    )}
                  >
                    Xem toàn bộ lịch sử lô
                  </Link>
                </div>
              </InventoryPanel>
              <InventoryPanel title="Biến động gần nhất">
                <div className="stock-table-scroll">
                  <table className="stock-table lot-movement-table">
                    <thead>
                      <tr>
                        <th>Thời điểm</th>
                        <th>Loại</th>
                        <th>Thay đổi</th>
                        <th>Chứng từ / người thực hiện</th>
                        <th>Ghi chú</th>
                      </tr>
                    </thead>
                    <tbody>
                      {item.movements.map((row) => (
                        <tr key={row.id}>
                          <td>{dateTime(row.occurredAt)}</td>
                          <td>
                            {movementNames[row.movementType] ??
                              row.movementType}
                          </td>
                          <td
                            className={
                              row.quantityChange > 0
                                ? 'stock-positive'
                                : 'stock-danger'
                            }
                          >
                            {row.quantityChange > 0 ? '+' : ''}
                            {row.quantityChange}
                            <small>
                              {stockStatuses[row.stockStatus] ??
                                row.stockStatus}
                            </small>
                          </td>
                          <td>
                            <SourceDocument
                              type={row.sourceType}
                              id={row.sourceId}
                            />
                            <small>{row.performedByName ?? '—'}</small>
                          </td>
                          <td>{row.reason ?? '—'}</td>
                        </tr>
                      ))}
                      {!item.movements.length && (
                        <tr>
                          <td colSpan={5} className="stock-empty">
                            Chưa có biến động của lô.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </InventoryPanel>
            </div>
            <aside className="lot-picking">
              <InventoryPanel title="Thứ tự xuất lô · FEFO / FIFO">
                <p className="stock-notice">
                  Ưu tiên hạn dùng sớm; lô không theo dõi hạn dùng theo ngày
                  nhập. Bỏ qua lô hết hạn hoặc không có tồn khả dụng.
                </p>
                <ol className="lot-picking-list">
                  {item.issueOrder
                    .map((row, index) => ({ row, index }))
                    .filter(({ index }) => {
                      const current = item.issueOrder.findIndex(
                        (row) => row.current,
                      )
                      return current < 0
                        ? index < 7
                        : Math.abs(index - current) <= 3
                    })
                    .map(({ row, index }) => (
                      <li
                        key={row.lotId}
                        className={row.current ? 'stock-current' : ''}
                      >
                        <strong>
                          {row.skipped
                            ? '—'
                            : item.issueOrder
                                .slice(0, index + 1)
                                .filter((lot) => !lot.skipped).length}
                          .{' '}
                          <Link to={lotLink(row.lotId, item.viewStoreId)}>
                            L-{String(row.lotId).padStart(4, '0')}
                          </Link>
                        </strong>
                        <span className="stock-badge">
                          {row.skipped
                            ? 'Bỏ qua'
                            : row.current
                              ? 'Lô đang xem'
                              : 'Có thể xuất'}
                        </span>
                        <small>
                          Hạn dùng: {date(row.expiryDate)} · Nhập:{' '}
                          {date(row.receivedDate)}
                        </small>
                        <span>
                          Khả dụng: {row.availableQty} {item.baseUnit}
                        </span>
                      </li>
                    ))}
                </ol>
                {!item.issueOrder.length && (
                  <p className="stock-empty">Chưa có lô để xếp thứ tự xuất.</p>
                )}
                <Link
                  className="lot-more"
                  to={
                    '/inventory/lots?tab=IN_STOCK&q=' +
                    encodeURIComponent(item.sku)
                  }
                >
                  Xem các lô của phụ tùng
                </Link>
              </InventoryPanel>
            </aside>
          </div>
        </>
      )}
    </main>
  )
}
