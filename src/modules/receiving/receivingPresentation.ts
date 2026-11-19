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

/** Nhãn chung của đơn nhập hàng và phiếu nhập (lấy từ file nhãn dùng chung). */
export const receiptStatusLabels: Record<string, string> = {
  ...purchaseOrderStatusLabels,
  ...goodsReceiptStatusLabels,
  AWAITING_DISCREPANCY: 'Chờ xử lý sai lệch',
}

export const orderHistoryLabels: Record<string, string> = {
  CREATED: 'Đã tạo đơn nhập hàng',
  UPDATED: 'Đã sửa đơn nhập hàng',
  CANCELLED: 'Đã hủy đơn nhập hàng',
  PURCHASE_ORDER_CREATED: 'Đã tạo đơn nhập hàng',
  PURCHASE_ORDER_UPDATED: 'Đã sửa đơn nhập hàng',
  PURCHASE_ORDER_CANCELLED: 'Đã hủy đơn nhập hàng',
}
