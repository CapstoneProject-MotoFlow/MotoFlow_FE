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
export type NoticeTarget = { path: string } | { receiptId: number }
/** Only route to screens implemented in this FE branch. References never become arbitrary URLs. */
export function noticeTarget(
  notice: Pick<Notice, 'refType' | 'refId'>,
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
  if (notice.refType === 'GOODS_RECEIPT_NOTE') return { receiptId: id }
}
export function noticeTime(value: string) {
  return new Date(value).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
