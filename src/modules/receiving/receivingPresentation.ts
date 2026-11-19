import { documentCode } from '../../shared/utils/documentCode'
import {
  goodsReceiptStatusLabels,
  purchaseOrderStatusLabels,
} from '../../shared/labels/status'

export function purchaseOrderCode(id: number | string) {
  return documentCode('DNH', id)
}

export function purchaseOrderSearch(query: string) {
  return query.trim().replace(/^(?:DNH|YCN)-0*(?=\d+$)/i, '')
}

/**
 * Mục 12 (PM 19/11): đơn đã nhận đủ hàng nhưng còn sai lệch nhà cung cấp chưa đóng thì không ghi
 * "Đã nhận đủ". Đây là trạng thái hiển thị của FE, BE vẫn trả FULLY_RECEIVED.
 */
export const PURCHASE_ORDER_DISCREPANCY_OPEN = 'DISCREPANCY_OPEN'

export function purchaseOrderDisplayStatus(order: {
  status: string
  openDiscrepancies?: number | null
}) {
  return order.status === 'FULLY_RECEIVED' && (order.openDiscrepancies ?? 0) > 0
    ? PURCHASE_ORDER_DISCREPANCY_OPEN
    : order.status
}

/** Nhãn chung của đơn nhập hàng và phiếu nhập (lấy từ file nhãn dùng chung). */
export const receiptStatusLabels: Record<string, string> = {
  ...purchaseOrderStatusLabels,
  ...goodsReceiptStatusLabels,
  [PURCHASE_ORDER_DISCREPANCY_OPEN]: 'Chờ xử lý sai lệch',
}

export const orderHistoryLabels: Record<string, string> = {
  CREATED: 'Đã tạo đơn nhập hàng',
  UPDATED: 'Đã sửa đơn nhập hàng',
  CANCELLED: 'Đã hủy đơn nhập hàng',
  PURCHASE_ORDER_CREATED: 'Đã tạo đơn nhập hàng',
  PURCHASE_ORDER_UPDATED: 'Đã sửa đơn nhập hàng',
  PURCHASE_ORDER_CANCELLED: 'Đã hủy đơn nhập hàng',
}
