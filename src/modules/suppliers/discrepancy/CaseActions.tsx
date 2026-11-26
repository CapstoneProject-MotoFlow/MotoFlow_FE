import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { AcceptanceMode } from './AcceptanceDialog'
import type { CaseActionMode } from './CaseActionDialog'
import type { Case } from './types'

/**
 * Phần "việc tiếp theo" trong cột Tiến độ của bảng sai lệch (thay thẻ CaseCard cũ, Ezy 26/11): các nút của bước sau khi hướng đã chốt
 * (ghi nhận đã trả, nhập hàng giao bù, nhận hàng lỗi / giao sai, bỏ giao bù), việc đang chờ người khác, và lịch sử.
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
    else waiting.push('Chờ BM ghi nhận đã trả')
  }
  if (decided && row.openReplacementQty > 0 && row.purchaseOrderId) {
    if (row.canCreateReplacement)
      actions.push(
        <Link
          key="replacement"
          className="mf-btn mf-btn--sm mf-btn--secondary"
          to={'/purchase-orders/' + row.purchaseOrderId + '?replacement=' + row.id}
        >
          Nhập hàng giao bù
        </Link>,
      )
    else waiting.push('Chờ BM nhập hàng giao bù')
  }
  if (row.canApproveAcceptance && row.damagedUndecidedQty > 0)
    actions.push(button('damaged', 'Nhận hàng lỗi vào kho', () => onAcceptance('damaged')))
  if (row.canApproveAcceptance && row.wrongUndecidedQty > 0)
    actions.push(button('wrong', 'Nhận hàng giao sai vào kho', () => onAcceptance('wrong')))
  if (decided && !row.canApproveAcceptance && row.heldUndecidedQty > 0)
    waiting.push('Chờ Owner nhận hàng vào kho')
  if (decided && row.openReplacementQty > 0) {
    // Việc ít dùng: hiện như link cạnh "Lịch sử" để không thêm một nút to nữa trong cột hẹp.
    if (row.canWaiveReplacement)
      actions.push(button('waive', 'Không cần giao bù', () => onAction('waive'), true))
    else waiting.push('Bỏ giao bù: chỉ Owner quyết định')
  }
  return (
    <div className="sd-next">
      {actions}
      {waiting.map((text) => (
        <span key={text} className="sd-next-wait">
          {text}
        </span>
      ))}
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
