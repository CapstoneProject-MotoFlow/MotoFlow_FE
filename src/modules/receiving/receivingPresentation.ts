import { documentCode } from '../../shared/utils/documentCode'
import {
  goodsReceiptStatusLabels,
  purchaseOrderStatusLabels,
} from '../../shared/labels/status'

export function purchaseOrderCode(id: number | string) {
  return documentCode('YCN', id)
}

/** Nhãn chung của yêu cầu nhập hàng và phiếu nhập (lấy từ file nhãn dùng chung). */
export const receiptStatusLabels: Record<string, string> = {
  ...purchaseOrderStatusLabels,
  ...goodsReceiptStatusLabels,
}

export const orderHistoryLabels: Record<string, string> = {
  CREATED: 'Đã tạo yêu cầu',
  UPDATED: 'Đã sửa yêu cầu',
  CANCELLED: 'Đã hủy yêu cầu',
  PURCHASE_ORDER_CREATED: 'Đã tạo yêu cầu',
  PURCHASE_ORDER_UPDATED: 'Đã sửa yêu cầu',
  PURCHASE_ORDER_CANCELLED: 'Đã hủy yêu cầu',
}
