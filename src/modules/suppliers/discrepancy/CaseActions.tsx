import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { AcceptanceMode } from './AcceptanceDialog'
import type { CaseActionMode } from './CaseActionDialog'
import type { Case } from './types'

/**
 * Thao tác bước 2 trong cột Tiến độ của bảng sai lệch: nhập giao bù/bỏ giao bù mở sau khi hướng đã chốt (GVHD 24/11);
 * nút Owner nhận hàng lỗi/giao sai theo cờ canApproveAcceptance của BE (cho nhận một phần kể cả khi chưa chốt hướng).
 */
export default function CaseActions({
  row,
  saving,
  onAction,
  onAcceptance,
}: {
  row: Case
  saving: boolean
  onAction: (mode: CaseActionMode) => void
  onAcceptance: (mode: AcceptanceMode) => void
}) {
  const decided = row.decisionStatus === undefined || row.decisionStatus === 'DECIDED'
  const waiting: string[] = []
  const actions: ReactNode[] = []
  const button = (key: string, label: string, onClick: () => void, quiet = false) => (
    <button
      key={key}
      type="button"
      className={'mf-btn ' + (quiet ? 'mf-btn--link sd-next-link' : 'mf-btn--sm mf-btn--secondary')}
      disabled={saving}
      onClick={onClick}
    >
      {label}
    </button>
  )

  if (row.outstandingReturnQty > 0) {
    if (row.canRecordReturn)
      actions.push(button('return', 'Ghi nhận đã trả', () => onAction('return')))
    else waiting.push('Chờ BM trả hàng')
  }
  if (decided && row.openReplacementQty > 0 && row.purchaseOrderId) {
    if (row.canCreateReplacement)
      actions.push(
        <Link
          key="replacement"
          className="mf-btn mf-btn--sm mf-btn--secondary"
          to={'/purchase-orders/' + row.purchaseOrderId + '?replacement=' + row.id}
        >
          Nhập giao bù
        </Link>,
      )
    else waiting.push('Chờ BM nhập bù')
  }
  if (row.canApproveAcceptance && row.damagedUndecidedQty > 0)
    actions.push(button('damaged', 'Nhận hàng lỗi', () => onAcceptance('damaged')))
  if (row.canApproveAcceptance && row.wrongUndecidedQty > 0)
    actions.push(button('wrong', 'Nhận hàng sai', () => onAcceptance('wrong')))
  if (decided && !row.canApproveAcceptance && row.heldUndecidedQty > 0)
    waiting.push('Chờ Owner nhận kho')
  if (decided && row.openReplacementQty > 0 && row.canWaiveReplacement)
    actions.push(button('waive', 'Bỏ giao bù', () => onAction('waive'), true))

  return (
    <div className="sd-next">
      {waiting.length > 0 && <span className="sd-next-wait">{waiting.join(' · ')}</span>}
      {actions}
      <button
        type="button"
        className="mf-btn mf-btn--link sd-next-link"
        aria-label={'Lịch sử xử lý ' + row.sku}
        onClick={() => onAction('history')}
      >
        Lịch sử
      </button>
    </div>
  )
}
