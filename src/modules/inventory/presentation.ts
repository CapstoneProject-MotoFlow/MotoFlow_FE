export const stockStatuses: Record<string, string> = {
  AVAILABLE: 'Khả dụng',
  AWAITING_INSPECTION: 'Chờ kiểm nhận',
  WRONG_ITEM: 'Giao sai',
  DAMAGED: 'Hư hỏng',
  AWAITING_SUPPLIER_RETURN: 'Chờ trả NCC',
  IN_TRANSIT: 'Đang điều chuyển',
}
export const movementNames: Record<string, string> = {
  SALE_ISSUE: 'Xuất bán',
  RECEIPT_CONFIRMED: 'Nhập hàng',
  EXCESS_ACCEPTED: 'Nhận hàng thừa',
  EXCESS_REJECTED: 'Từ chối hàng thừa',
  RETURN_HOLD: 'Chuyển chờ trả NCC',
  SUPPLIER_RETURN: 'Trả NCC',
  TRANSFER_DISPATCH: 'Xuất điều chuyển',
  TRANSFER_EXTRA_DISPATCH: 'Xuất bổ sung',
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
  TRANSFER_ORDER: 'Điều chuyển',
  DISCREPANCY_RESOLUTION_EVENT: 'Xử lý sai lệch',
  ADJUSTMENT_REQUEST: 'Điều chỉnh',
  STOCK_COUNT: 'Kiểm kê',
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
  return new Date(value).toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
  })
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
