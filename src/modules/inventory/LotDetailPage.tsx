import { Link, useParams } from 'react-router-dom'
import { useInventoryData, useInventoryScope } from './api'
import {
  InventoryHeader,
  InventoryNotice,
  InventoryPanel,
  LotState,
  WarehouseFilter,
} from './components'
import { MovementTable, SourceDocument } from './MovementTable'
import {
  date,
  lotLink,
  money,
  movementLink,
  sourceNames,
  stockStatuses,
} from './presentation'
import type { LotDetail } from './types'

export default function LotDetailPage() {
  const { id } = useParams()
  const scope = useInventoryScope()
  const lot = useInventoryData<LotDetail>('/inventory/lots/' + id, {
    storeId: scope.storeId,
  })
  const item = lot.data
  return (
    <main className="inventory-workspace">
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
          <div className="stock-detail-columns">
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
                <div>
                  <dt>Ngày sản xuất</dt>
                  <dd>{date(item.manufactureDate)}</dd>
                </div>
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
                    <dt>Giá nhập lô</dt>
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
                  Xem toàn bộ lịch sử lô →
                </Link>
              </div>
            </InventoryPanel>
          </div>
          <InventoryPanel title="Biến động gần nhất">
            <MovementTable rows={item.movements} />
          </InventoryPanel>
          <InventoryPanel title="Thứ tự xuất lô · FEFO / FIFO">
            <p className="stock-notice">
              Ưu tiên hạn dùng sớm; lô không theo dõi hạn dùng theo ngày nhập.
              Bỏ qua lô hết hạn hoặc không có tồn khả dụng.
            </p>
            <div className="stock-table-scroll">
              <table className="stock-table">
                <thead>
                  <tr>
                    <th>Thứ tự</th>
                    <th>Lô</th>
                    <th>Ngày nhập</th>
                    <th>Hạn dùng</th>
                    <th>Khả dụng</th>
                    <th>Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {item.issueOrder.map((row, index) => (
                    <tr
                      key={row.lotId}
                      className={row.current ? 'stock-current' : ''}
                    >
                      <td>
                        {row.skipped
                          ? '—'
                          : item.issueOrder
                              .slice(0, index + 1)
                              .filter((lot) => !lot.skipped).length}
                      </td>
                      <td>
                        <Link to={lotLink(row.lotId, item.viewStoreId)}>
                          L-{String(row.lotId).padStart(4, '0')}
                        </Link>
                      </td>
                      <td>{date(row.receivedDate)}</td>
                      <td>{date(row.expiryDate)}</td>
                      <td>
                        {row.availableQty} {item.baseUnit}
                      </td>
                      <td>
                        {row.skipped
                          ? 'Bỏ qua'
                          : row.current
                            ? 'Lô đang xem'
                            : 'Có thể xuất'}
                      </td>
                    </tr>
                  ))}
                  {!item.issueOrder.length && (
                    <tr>
                      <td colSpan={6} className="stock-empty">
                        Chưa có lô để xếp thứ tự xuất.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </InventoryPanel>
        </>
      )}
    </main>
  )
}
