export type Notice = {
  id: number
  type: string
  message: string
  refType: string | null
  refId: number | null
  read: boolean
  createdAt: string
  readAt: string | null
}
export type NoticeTarget = { path: string }
/** Only route to screens implemented in this FE branch. References never become arbitrary URLs. */
export function noticeTarget(
  notice: Pick<Notice, 'refType' | 'refId'> & {
    type?: string
    message?: string
  },
  role: string | undefined,
): NoticeTarget | undefined {
  const id = notice.refId
  if (
    !id ||
    !Number.isSafeInteger(id) ||
    id < 1 ||
    !['OWNER', 'BRANCH_MANAGER', 'STAFF'].includes(role ?? '')
  )
    return
  if (role === 'OWNER' && notice.type === 'SUPPLIER_DISCREPANCY_OPENED')
    return { path: '/supplier-discrepancies' }
  // Staff được giao việc nhận hàng (SUPPLIER_RECEIVING / TRANSFER_RECEIVING): mở thẳng màn lập phiếu nhận.
  // Việc chuẩn bị hàng xuất cũng gắn TRANSFER_ORDER nên phân biệt theo nội dung "nhận hàng".
  if (role === 'STAFF' && notice.type === 'TASK_ASSIGNED') {
    if (notice.refType === 'PURCHASE_ORDER')
      return { path: '/purchase-orders/' + id + '/receipts/new' }
    if (
      notice.refType === 'TRANSFER_ORDER' &&
      /nhận hàng/i.test(notice.message ?? '')
    )
      return { path: '/transfer-orders/' + id + '/receipts/new' }
  }
  if (notice.refType === 'GOODS_RECEIPT_NOTE')
    return { path: '/goods-receipt-notes/' + id }
  if (notice.refType === 'TRANSFER_ORDER')
    return { path: '/transfer-orders/' + id }
  if (notice.refType === 'REPLENISHMENT_REQUEST' && role !== 'STAFF')
    return { path: '/replenishment-requests/' + id }
  if (notice.refType === 'SALES_ORDER') return { path: '/sales-orders/' + id }
  if (notice.refType === 'STOCK_COUNT') return { path: '/stock-counts/' + id }
  if (notice.refType === 'STOCK_COUNT_REQUEST' && role !== 'STAFF')
    return { path: '/stock-counts' }
  if (notice.refType === 'LOT' && role !== 'STAFF')
    return { path: '/inventory/lots/' + id }
  if (notice.refType === 'PRODUCT')
    return {
      path:
        (role === 'OWNER'
          ? '/owner'
          : role === 'BRANCH_MANAGER'
            ? '/branch-manager'
            : '/staff') +
        '/products/' +
        id,
    }
  if (role !== 'STAFF') {
    if (notice.refType === 'PURCHASE_ORDER')
      return { path: '/purchase-orders/' + id }
  }
}
const noticeTimeParts = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})
/**
 * Review T6: cùng kiểu với formatDateTime ("12/11/2026 15:07"). Viết tại chỗ vì file này được test
 * nạp riêng lẻ, không import được module khác.
 */
export function noticeTime(value: string) {
  // Giờ BE không kèm múi giờ là giờ Việt Nam: giữ nguyên.
  const local =
    /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/.exec(
      value,
    )
  if (local)
    return `${local[3]}/${local[2]}/${local[1]} ${local[4]}:${local[5]}`
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const part = Object.fromEntries(
    noticeTimeParts.formatToParts(date).map((item) => [item.type, item.value]),
  )
  return `${part.day}/${part.month}/${part.year} ${part.hour === '24' ? '00' : part.hour}:${part.minute}`
}
