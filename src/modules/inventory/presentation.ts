import { formatDateTime } from '../../shared/utils/format'
import { documentCode } from '../../shared/utils/documentCode'
export { stockStatusLabels as stockStatuses } from '../../shared/labels/status'
export const movementNames: Record<string, string> = {
  SALE_ISSUE: 'Xuất bán',
  RECEIPT_CONFIRMED: 'Nhập hàng',
  EXCESS_ACCEPTED: 'Nhận hàng thừa',
  EXCESS_REJECTED: 'Từ chối hàng thừa',
  RETURN_HOLD: 'Chuyển chờ trả nhà cung cấp',
  SUPPLIER_RETURN: 'Trả nhà cung cấp',
  TRANSFER_DISPATCH: 'Xuất điều chuyển',
  TRANSFER_EXTRA_DISPATCH: 'Hàng gửi dư',
  TRANSFER_RECEIPT: 'Nhận điều chuyển',
  ADJUSTMENT: 'Điều chỉnh',
  COUNT_ADJUSTMENT: 'Điều chỉnh kiểm kê',
  OPENING_BALANCE: 'Tồn đầu kỳ',
}
export const lotStates: Record<string, string> = {
  NO_EXPIRY: 'Không theo dõi hạn',
  OK: 'Còn hạn',
  NEAR_EXPIRY: 'Sắp hết hạn',
  EXPIRED: 'Đã hết hạn',
  DEPLETED: 'Đã hết hàng',
}
export const sourceNames: Record<string, string> = {
  RECEIPT: 'Nhập nhà cung cấp',
  OPENING: 'Tồn đầu kỳ',
  COUNT_SURPLUS: 'Thừa kiểm kê',
  GOODS_RECEIPT_NOTE: 'Phiếu nhập',
  SALES_ORDER: 'Đơn bán',
  TRANSFER_ORDER: 'Lệnh điều chuyển',
  DISCREPANCY_RESOLUTION_EVENT: 'Xử lý sai lệch',
  ADJUSTMENT_REQUEST: 'Điều chỉnh',
  STOCK_COUNT: 'Kiểm kê',
}
/** Tiền tố mã chứng từ theo sourceType; loại không có mã riêng chỉ hiện tên. */
const sourcePrefixes = {
  GOODS_RECEIPT_NOTE: 'PN',
  TRANSFER_ORDER: 'DC',
  STOCK_COUNT: 'KK',
  SALES_ORDER: 'SO',
} as const
/** Nhãn chứng từ nguồn: "Phiếu nhập PN-0006", "Lệnh điều chuyển DC-0002"; phiếu nhận điều chuyển (BE lưu chung bảng phiếu nhập) chỉ hiện tên. */
export function sourceLabel(type: string, id: number, movementType?: string) {
  if (type === 'GOODS_RECEIPT_NOTE' && movementType === 'TRANSFER_RECEIPT')
    return 'Phiếu nhận điều chuyển'
  const name = sourceNames[type] ?? type
  const prefix = sourcePrefixes[type as keyof typeof sourcePrefixes]
  return prefix ? name + ' ' + documentCode(prefix, id) : name
}
export const money = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
})
export const number = new Intl.NumberFormat('vi-VN')
export function date(value: string | null | undefined) {
  return value
    ? new Date(value).toLocaleDateString('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
      })
    : '—'
}
export function dateTime(value: string) {
  return formatDateTime(value)
}
export function today() {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date())
}
export function lotLink(lotId: number, storeId: number) {
  return '/inventory/lots/' + lotId + '?storeId=' + storeId
}
export function movementLink(
  productId: number,
  storeId: number,
  lotId?: number,
) {
  return (
    '/inventory/movements?productId=' +
    productId +
    '&storeId=' +
    storeId +
    (lotId ? '&lotId=' + lotId : '')
  )
}
