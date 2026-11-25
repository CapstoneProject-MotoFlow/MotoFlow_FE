import { Fragment, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { caseStatusLabel, isCaseSettled, summaryBoxes } from '../discrepancyRules'
import type { AcceptanceMode } from './AcceptanceDialog'
import type { CaseActionMode } from './CaseActionDialog'
import { acceptanceLabels, type Case } from './types'

/**
 * Một hồ sơ sai lệch của phiếu nhập: ba hộp tóm tắt và các nút hành động. GVHD 24/11: hướng xử lý nhập ở bảng chung
 * (DecisionTable); hành động (ghi nhận đã trả, nhập hàng giao bù) chỉ có khi hướng đã chốt.
 */
export default function CaseCard({
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
  const settled = isCaseSettled(row)
  const decided = row.decisionStatus === undefined || row.decisionStatus === 'DECIDED'
  const notes: string[] = []
  const actions: ReactNode[] = []

  if (row.status === 'OPEN' && !decided)
    notes.push(
      row.decisionStatus === 'AWAITING_OWNER'
        ? 'Hướng xử lý đang chờ Owner duyệt'
        : 'Chốt hướng xử lý ở bảng trên trước khi trả hàng hoặc nhập giao bù',
    )
  if (decided && row.openReplacementQty > 0 && row.purchaseOrderId) {
    if (row.canCreateReplacement)
      actions.push(
        <Link
          key="replacement"
          className="mf-btn mf-btn--sm mf-btn--secondary"
          to={'/purchase-orders/' + row.purchaseOrderId + '?replacement=' + row.id}
        >
          Nhập hàng giao bù (phiếu nhập mới)
        </Link>,
      )
    else notes.push('BM nhận hàng giao bù')
  }
  if (row.outstandingReturnQty > 0) {
    if (row.canRecordReturn)
      actions.push(
        <button
          key="return"
          type="button"
          className="mf-btn mf-btn--sm mf-btn--secondary"
          disabled={saving}
          onClick={() => onAction('return')}
        >
          Ghi nhận đã trả
        </button>,
      )
    else notes.push('BM ghi nhận hàng đã trả NCC')
  }
  if (row.canApproveAcceptance && row.damagedUndecidedQty > 0)
    actions.push(
      <button
        key="damaged"
        type="button"
        className="mf-btn mf-btn--sm mf-btn--secondary"
        disabled={saving}
        onClick={() => onAcceptance('damaged')}
      >
        Nhận hàng lỗi
      </button>,
    )
  if (row.canApproveAcceptance && row.wrongUndecidedQty > 0)
    actions.push(
      <button
        key="wrong"
        type="button"
        className="mf-btn mf-btn--sm mf-btn--secondary"
        disabled={saving}
        onClick={() => onAcceptance('wrong')}
      >
        Nhận hàng giao sai
      </button>,
    )
  if (decided && !row.canApproveAcceptance && row.heldUndecidedQty > 0)
    notes.push('Owner nhận hàng lỗi / hàng giao sai vào kho')
  if (decided && row.openReplacementQty > 0) {
    if (row.canWaiveReplacement)
      actions.push(
        <button
          key="waive"
          type="button"
          className="mf-btn mf-btn--sm mf-btn--secondary"
          disabled={saving}
          onClick={() => onAction('waive')}
        >
          Không cần giao bù
        </button>,
      )
    else notes.push('Bỏ giao bù: chỉ Owner quyết định.')
  }

  return (
    <article className="sd-case" aria-labelledby={'sd-case-' + row.id}>
      <header className="sd-case-head">
        <div>
          <h2 id={'sd-case-' + row.id}>
            {row.sku} · {row.partName}
          </h2>
          <div className="sd-case-tags">
            <span className={'mf-badge ' + (settled ? 'mf-badge--success' : 'mf-badge--warning')}>
              {caseStatusLabel(row)}
            </span>
            {row.pendingRequests?.map((request) => (
              <span key={request.type} className="mf-badge mf-badge--info">
                {acceptanceLabels[request.type]} {request.quantity} chờ Owner duyệt
              </span>
            ))}
          </div>
        </div>
      </header>

      <div className="sd-flow">
        {summaryBoxes(row).map((box, index) => (
          <Fragment key={box.title}>
            {index > 0 && (
              <span className="sd-flow-arrow" aria-hidden="true">
                →
              </span>
            )}
            <section className={'sd-tile' + (box.warn ? ' sd-tile--todo' : '')}>
              <h3>{box.title}</h3>
              <dl>
                {box.parts.map(([label, quantity]) => (
                  <div key={label}>
                    <dd>{quantity}</dd>
                    <dt>{label}</dt>
                  </div>
                ))}
              </dl>
            </section>
          </Fragment>
        ))}
      </div>

      <div className="sd-work">
        <div className="sd-actions">
          <div className="sd-actions-buttons">{actions}</div>
          {notes.length > 0 && <p className="sd-muted sd-role-note">{notes.join(' · ')}</p>}
          <button
            type="button"
            className="mf-btn mf-btn--link"
            onClick={() => onAction('history')}
          >
            Xem lịch sử xử lý
          </button>
        </div>
      </div>
    </article>
  )
}
