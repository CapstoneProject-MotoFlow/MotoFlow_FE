import WarehouseAssignmentDialog from '../operations/WarehouseAssignmentDialog'
import type { SalesOrder } from './salesModel'
export default function SalesAssignmentDialog({
  documentId,
  order,
  onClose,
}: {
  documentId: number
  order?: SalesOrder
  onClose: () => void
}) {
  return (
    <WarehouseAssignmentDialog
      taskType="PICKING"
      documentId={documentId}
      title={'Giao lấy hàng ' + (order?.code ?? '#' + documentId)}
      onClose={onClose}
      onSaved={(name) =>
        window.dispatchEvent(
          new CustomEvent('sales-changed', {
            detail: 'Đã giao lấy hàng cho ' + name + '.',
          }),
        )
      }
    />
  )
}
