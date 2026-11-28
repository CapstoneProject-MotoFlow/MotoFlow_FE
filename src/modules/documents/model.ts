import {
  goodsReceiptStatusLabels,
  paymentStatusLabels,
  salesOrderStatusLabels,
  transferStatusLabels,
} from '../../shared/labels/status'

export const documentTypes = {
  SALES_ORDER: 'Đơn bán',
  GOODS_RECEIPT: 'Phiếu nhập kho',
  TRANSFER_ORDER: 'Lệnh điều chuyển',
  PAYMENT: 'Phiếu thu',
  ADJUSTMENT: 'Yêu cầu điều chỉnh',
}

export const printForms = {
  SALES_INVOICE: 'Phiếu bán hàng',
  STOCK_ISSUE_NOTE: 'Phiếu xuất kho',
  GOODS_RECEIPT_NOTE: 'Phiếu nhập kho',
  PAYMENT_RECEIPT: 'Phiếu thu / hoàn tiền',
  ADJUSTMENT_NOTE: 'Phiếu điều chỉnh',
}

export const adjustmentTypes: Record<string, string> = {
  STOCK_LOSS: 'Ghi giảm tồn kho',
  DOCUMENT_CORRECTION: 'Sửa chứng từ',
}

export const adjustmentStatuses: Record<string, string> = {
  DRAFT: 'Nháp',
  PENDING: 'Chờ Owner duyệt',
  APPROVED: 'Đã duyệt, chờ áp dụng',
  APPLIED: 'Đã áp dụng',
  REJECTED: 'Đã từ chối',
  WITHDRAWN: 'Đã rút',
}

export const historyLabels: Record<string, string> = {
  SALES_ORDER_CREATED: 'Đã tạo đơn bán',
  SALES_ORDER_VERSIONED: 'Đã cập nhật đơn bán',
  SALES_ORDER_PICKED: 'Đã soạn hàng',
  SALES_ORDER_CONFIRMED: 'Đã xác nhận đơn bán',
  SALES_ORDER_COMPLETED: 'Đã hoàn tất đơn bán',
  SALES_ORDER_CANCELLED: 'Đã hủy đơn bán',
  GOODS_RECEIPT_CREATED: 'Đã tạo phiếu nhập',
  GOODS_RECEIPT_RECOUNT: 'Đã yêu cầu kiểm đếm lại',
  GOODS_RECEIPT_SUBMITTED: 'Đã gửi phiếu nhập',
  GOODS_RECEIPT_CONFIRMED: 'Đã xác nhận phiếu nhập',
  TRANSFER_ORDER_CREATED: 'Đã tạo lệnh điều chuyển',
  TRANSFER_ORDER_DISPATCHED: 'Đã xuất kho điều chuyển',
  TRANSFER_ORDER_CLOSED: 'Đã đóng lệnh điều chuyển',
  TRANSFER_EXTRA_DISPATCH_CONFIRMED: 'Đã xác nhận xuất bổ sung',
  TRANSFER_RECEIPT_ARRIVED: 'Đã ghi nhận hàng đến',
  TRANSFER_RECEIPT_CONFIRMED: 'Đã xác nhận phiếu nhận điều chuyển',
  TRANSFER_DISCREPANCY_ACKNOWLEDGED: 'Đã gửi yêu cầu đối soát sai lệch',
  TRANSFER_RECONCILIATION_CONFIRMED: 'Đã xác nhận đối soát sai lệch',
  TRANSFER_WRONG_ITEM_RETURNED: 'Đã gửi hoàn trả hàng giao sai',
  TRANSFER_WRONG_ITEM_CONFIRMED: 'Đã xác nhận xử lý hàng giao sai',
  TRANSFER_WRONG_ITEM_RETURN_CONFIRMED: 'Đã xác nhận hoàn trả hàng giao sai',
  TRANSFER_WRONG_ITEM_RECEIVED: 'Đã nhận hàng giao sai thành phụ tùng',
  TRANSFER_IN: 'Nhập hàng điều chuyển',
  SALES_ORDER_PAYMENT_REJECTED: 'Đã từ chối khoản thanh toán',
  DEBT_PAYMENT_RECORDED: 'Đã ghi nhận thu nợ',
  PAYMENT_REALLOCATED: 'Đã phân bổ lại khoản thu',
  ADJUSTMENT_CREATED: 'Đã tạo đề nghị điều chỉnh',
  ADJUSTMENT_SUBMITTED: 'Đã gửi đề nghị điều chỉnh',
  ADJUSTMENT_APPROVED: 'Đã duyệt đề nghị điều chỉnh',
  ADJUSTMENT_REJECTED: 'Đã từ chối đề nghị điều chỉnh',
  ADJUSTMENT_APPLIED: 'Đã áp dụng điều chỉnh',
  ADJUSTMENT_WITHDRAWN: 'Đã rút đề nghị điều chỉnh',
  CREATED: 'Đã tạo',
  SUBMITTED: 'Đã gửi duyệt',
  VERSIONED: 'Đã cập nhật phiên bản',
  PICKER_ASSIGNED: 'Đã giao lấy hàng',
  PICKED: 'Đã lấy hàng',
  RECORDED: 'Đã ghi nhận',
  VERIFIED: 'Đã xác minh',
  CONFIRMED: 'Đã xác nhận',
  COMPLETED: 'Đã hoàn tất',
  CANCELLED: 'Đã hủy',
  DISPATCHED: 'Đã xuất kho',
  EXTRA_DISPATCHED: 'Đã xuất bổ sung',
  CLOSED: 'Đã đóng',
  ...adjustmentStatuses,
}

export type DocumentType = keyof typeof documentTypes
export type PrintForm = keyof typeof printForms

const statuses: Record<DocumentType, Record<string, string>> = {
  SALES_ORDER: salesOrderStatusLabels,
  GOODS_RECEIPT: goodsReceiptStatusLabels,
  TRANSFER_ORDER: transferStatusLabels,
  PAYMENT: paymentStatusLabels,
  ADJUSTMENT: adjustmentStatuses,
}

export function documentStatus(type: DocumentType, status: string) {
  return statuses[type][status] ?? status
}

export function isDocumentType(type?: string): type is DocumentType {
  return !!type && Object.hasOwn(documentTypes, type)
}

export function documentPath(type: DocumentType, id: number | string) {
  return '/documents/' + type + '/' + id
}

export function adjustmentPath(id: number) {
  return '/adjustments/' + id
}

export function validId(id?: string) {
  return !!id && /^[1-9]\d*$/.test(id) && Number.isSafeInteger(Number(id))
}

export function dateWindow(days: number) {
  const today = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date())
  const start = new Date(today + 'T00:00:00Z')
  start.setUTCDate(start.getUTCDate() - days + 1)
  return { from: start.toISOString().slice(0, 10), to: today }
}

export function pageIndex(value: string | null) {
  const page = Number(value)
  return Number.isSafeInteger(page) && page >= 0 ? page : 0
}

export function workPath(type: string, id: number) {
  switch (type) {
    case 'SALES_ORDER':
      return '/sales-orders/' + id
    case 'PURCHASE_ORDER':
      return '/purchase-orders/' + id
    case 'GOODS_RECEIPT_NOTE':
      return '/goods-receipt-notes/' + id
    case 'TRANSFER_ORDER':
      return '/transfer-orders/' + id
    case 'REPLENISHMENT_REQUEST':
      return '/replenishment-requests/' + id
    case 'ADJUSTMENT':
    case 'ADJUSTMENT_REQUEST':
      return adjustmentPath(id)
  }
}
