import type { SummaryDto } from '../../sales/salesApi'

/**
 * Việc của quản lý chi nhánh cho đơn bán: chỉ lấy các đơn BE gắn `nextAction`
 * mà FE biết cách hiển thị. Hàng không khớp (null hoặc mã lạ) bị bỏ qua,
 * không được làm hỏng cả trang tổng quan.
 */
export const saleActions: Record<string, { title: string; action: string }> = {
  RELEASE: { title: 'Đơn chờ hàng', action: 'Chuyển sang soạn' },
  ASSIGN_PICKER: { title: 'Chưa giao việc lấy hàng', action: 'Giao việc' },
  RECORD_PICKING: { title: 'Đang chờ kết quả lấy hàng', action: 'Xem đơn' },
  CONFIRM: { title: 'Đơn lấy hàng chờ xác nhận', action: 'Xác nhận' },
  COLLECT_PAYMENT: { title: 'Đơn chờ thanh toán', action: 'Thu tiền' },
}

export type SaleWork = {
  key: string
  code: string
  kind: string
  title: string
  description: string
  at: string
  href: string
  action: string
}

/** Việc mới nhất lên đầu; cùng thời điểm thì sắp theo key để thứ tự ổn định. */
export function sortNewestFirst<T extends { at: string; key: string }>(
  rows: T[],
): T[] {
  return [...rows].sort(
    (a, b) => b.at.localeCompare(a.at) || a.key.localeCompare(b.key),
  )
}

/** `formatCode` nhận id đơn và trả mã hiển thị (thường là documentCode('DB', id)). */
export function saleWork(
  items: SummaryDto[],
  formatCode: (id: number) => string,
): SaleWork[] {
  const work: SaleWork[] = []
  for (const s of items) {
    const next = s.nextAction
    if (
      next == null ||
      !Object.prototype.hasOwnProperty.call(saleActions, next)
    )
      continue
    const meta = saleActions[next]
    work.push({
      key: 's' + s.id,
      code: formatCode(s.id),
      kind: 'Đơn bán',
      title: meta.title,
      action: meta.action,
      description: s.customerName ?? 'Khách lẻ',
      at: s.createdAt,
      href: '/sales-orders/' + s.id,
    })
  }
  return work
}
