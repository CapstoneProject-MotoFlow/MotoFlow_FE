import { useInventoryData } from '../inventory/api'
export default function StoreStock({
  storeId,
  productId,
}: {
  storeId: string
  productId: number
}) {
  const r = useInventoryData<{
    stock: { availableQty: number; expiredQty: number }
  }>('/inventory/stock/' + storeId + '/' + productId, {}, 0, !!storeId)
  return (
    <span title={r.error}>
      {!storeId
        ? 'Chọn cửa hàng'
        : r.loading
          ? 'Đang tải…'
          : r.error
            ? 'Không tải được'
            : r.data
              ? Math.max(0, r.data.stock.availableQty - r.data.stock.expiredQty)
              : '—'}
    </span>
  )
}
