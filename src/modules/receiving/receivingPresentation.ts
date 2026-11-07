export function purchaseOrderCode(id: number | string) {
  return 'YCN-' + String(id).padStart(4, '0')
}

export const receiptStatusLabels: Record<string, string> = {
  AWAITING_DELIVERY: 'Chờ giao hàng',
  RECEIVING: 'Đang nhận hàng',
  FULLY_RECEIVED: 'Đã nhận đủ',
  CANCELLED: 'Đã hủy',
  ASSIGNED: 'Chờ kiểm nhận',
  RESULT_SUBMITTED: 'Chờ xác nhận',
  AWAITING_INSPECTION: 'Chờ kiểm nhận',
  AWAITING_CONFIRMATION: 'Chờ xác nhận',
  AWAITING_RECOUNT: 'Chờ kiểm lại',
  CONFIRMED: 'Đã xác nhận',
  DONE: 'Đã xong',
}

export const orderHistoryLabels: Record<string, string> = {
  CREATED: 'Đã tạo yêu cầu',
  UPDATED: 'Đã sửa yêu cầu',
  CANCELLED: 'Đã hủy yêu cầu',
  PURCHASE_ORDER_CREATED: 'Đã tạo yêu cầu',
  PURCHASE_ORDER_UPDATED: 'Đã sửa yêu cầu',
  PURCHASE_ORDER_CANCELLED: 'Đã hủy yêu cầu',
}
