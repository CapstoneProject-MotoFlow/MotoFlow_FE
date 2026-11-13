/**
 * Việc "nhận hàng" BM giao cho nhân viên (BE: SUPPLIER_RECEIVING gắn PO, TRANSFER_RECEIVING gắn lệnh điều chuyển).
 * Người được giao tự lập phiếu nhận rồi ghi kết quả kiểm. File thuần, không import module khác để test nạp riêng.
 */
export type ReceivingTaskType = 'SUPPLIER_RECEIVING' | 'TRANSFER_RECEIVING'
export const receivingTaskTypes: ReceivingTaskType[] = [
  'SUPPLIER_RECEIVING',
  'TRANSFER_RECEIVING',
]
/** Một dòng của GET /warehouse-tasks/assigned-to-me?taskType=... */
export type ReceivingTask = {
  taskId: number
  taskType: ReceivingTaskType
  documentId: number
  documentCode?: string | null
  partnerName?: string | null
  lineCount?: number | null
  assignedAt?: string | null
  assignedByName?: string | null
}
/** BE có thể trả mảng hoặc trang { items }; chỉ giữ dòng hợp lệ đúng loại việc nhận hàng. */
export function readReceivingTasks(data: unknown): ReceivingTask[] {
  const items = Array.isArray(data)
    ? data
    : data &&
        typeof data === 'object' &&
        Array.isArray((data as { items?: unknown }).items)
      ? (data as { items: unknown[] }).items
      : []
  return items.filter(
    (item): item is ReceivingTask =>
      !!item &&
      typeof item === 'object' &&
      receivingTaskTypes.includes((item as ReceivingTask).taskType) &&
      Number.isSafeInteger((item as ReceivingTask).documentId) &&
      (item as ReceivingTask).documentId > 0,
  )
}
export function receivingCode(type: ReceivingTaskType, id: number) {
  return (
    (type === 'SUPPLIER_RECEIVING' ? 'YCN-' : 'DC-') +
    String(id).padStart(4, '0')
  )
}
/** Màn lập phiếu của việc nhận hàng: PO thì phiếu nhập, lệnh điều chuyển thì phiếu nhận hàng chuyển. */
export function receivingCreatePath(type: ReceivingTaskType, id: number) {
  return (
    (type === 'SUPPLIER_RECEIVING'
      ? '/purchase-orders/'
      : '/transfer-orders/') +
    id +
    '/receipts/new'
  )
}
/** Dòng việc hiển thị trong "Việc của tôi" của nhân viên. */
export function receivingWork(task: ReceivingTask) {
  const supplier = task.taskType === 'SUPPLIER_RECEIVING'
  return {
    key: 'nh' + task.taskType + task.documentId,
    task: supplier ? 'Nhận hàng nhập từ nhà cung cấp' : 'Nhận hàng điều chuyển',
    code: task.documentCode || receivingCode(task.taskType, task.documentId),
    description: [
      task.partnerName,
      task.lineCount != null ? task.lineCount + ' dòng' : null,
    ]
      .filter(Boolean)
      .join(' · '),
    assignedAt: task.assignedAt ?? null,
    status: 'Chưa lập phiếu',
    action: 'Lập phiếu nhập',
    href: receivingCreatePath(task.taskType, task.documentId),
  }
}
