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
  SALES_INVOICE: 'Hóa đơn bán lẻ',
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
