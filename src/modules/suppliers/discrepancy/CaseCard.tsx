import { Fragment, useId, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  acceptanceOpenTypes,
  caseDraftFieldErrors,
  caseStatusLabel,
  isCaseSettled,
  replacementMax,
  replacementMin,
  returnLimits,
  shownReplacement,
  summaryBoxes,
  type CaseDraft,
} from '../discrepancyRules'
import type { AcceptanceMode } from './AcceptanceDialog'
import type { CaseActionMode } from './CaseActionDialog'
import { acceptanceLabels, type Case } from './types'

function QuantityField({
  label,
  value,
  min,
  max,
  hint,
  error,
  errorId,
  changed,
  disabled,
  onChange,
}: {
  label: string
  value: string
  min: number
  max: number
  /** Chú thích sàn: đã trả (hàng giao sai / hỏng) hoặc tối thiểu (giao bù). Luôn màu xám. */
  hint?: string
  /** Lỗi của chính ô này; lỗi ô khác không đổi viền hay màu ô này. */
  error: string
  errorId: string
  changed: boolean
  disabled: boolean
  onChange: (value: string) => void
}) {
  return (
    <label className="sd-qty-field">
      <span>{label}</span>
      <span className="sd-qty-input">
        <input
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          required
          value={value}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={changed ? 'is-changed' : undefined}
          onChange={(event) => onChange(event.target.value)}
        />
        <small>/ {max}</small>
      </span>
      {error && (
        <small id={errorId} className="sd-field-error">
          {error}
        </small>
      )}
      {hint && <small className="sd-qty-hint">{hint}</small>}
    </label>
  )
}

/** Một hồ sơ sai lệch của phiếu nhập: ba hộp tóm tắt, ô nhập hướng xử lý và các nút việc của hồ sơ. */
export default function CaseCard({
  row,
  draft,
  saveError,
  dirty,
  saving,
  onDraft,
  onSave,
  onUndo,
  onAction,
  onAcceptance,
}: {
  row: Case
  draft: CaseDraft
  /** Lỗi khi lưu lần gần nhất của chính hồ sơ này. */
  saveError: string
  /** Có thay đổi số lượng chưa lưu so với hướng xử lý đang lưu trên BE (chỉ ghi chú không tính). */
  dirty: boolean
  saving: boolean
  onDraft: (patch: Partial<CaseDraft>) => void
  onSave: () => void
  onUndo: () => void
  onAction: (mode: CaseActionMode) => void
  onAcceptance: (mode: AcceptanceMode) => void
}) {
  const idBase = useId()
  const fieldErrors = caseDraftFieldErrors(row, draft)
  const invalid = !!(fieldErrors.wrong || fieldErrors.damaged || fieldErrors.replacement)
  const editing = row.status === 'OPEN' && row.canHandle
  const disabled = !editing || saving
  const settled = isCaseSettled(row)
  const replaceMax = replacementMax(row)
  const replaceMin = replacementMin(row)
  const replacement = shownReplacement(row, draft)
  const wrongLimit = returnLimits(row, 'WRONG_ITEM')
  const damagedLimit = returnLimits(row, 'DAMAGED')
  const showWrong = row.wrongItemQty > 0
  const showDamaged = row.damagedQty > 0
  const showReplacement = !row.replacementDelivery && replaceMax > 0
  const hasPlan = showWrong || showDamaged || showReplacement
  const openTypes = acceptanceOpenTypes(row)
  const notes: string[] = []
  const actions: ReactNode[] = []

  if (row.openReplacementQty > 0 && row.purchaseOrderId) {
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
  // NH7a: BM đề nghị Owner xử lý hàng lỗi / giao sai đang giữ (BE #80).
  if (row.canRequestAcceptance && !row.canApproveAcceptance && openTypes.length > 0)
    actions.push(
      <button
        key="request"
        type="button"
        className="mf-btn mf-btn--sm mf-btn--secondary"
        disabled={saving}
        onClick={() => onAcceptance('request')}
      >
        Đề nghị Owner xử lý
      </button>,
    )
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
  if (!row.canApproveAcceptance && !row.canRequestAcceptance && row.heldUndecidedQty > 0)
    notes.push('Owner duyệt nhận hàng lỗi / hàng giao sai')
  if (row.openReplacementQty > 0) {
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
        {hasPlan && (
          <fieldset className="sd-plan" disabled={disabled}>
            <legend>Hướng xử lý với nhà cung cấp</legend>
            <div className="sd-plan-fields">
              {showWrong && (
                <QuantityField
                  label="Trả NCC · hàng giao sai"
                  value={draft.wrong}
                  min={wrongLimit.floor}
                  max={wrongLimit.max}
                  hint={wrongLimit.floor > 0 ? `Đã trả ${wrongLimit.floor}` : undefined}
                  error={fieldErrors.wrong}
                  errorId={idBase + '-wrong'}
                  changed={Number(draft.wrong) !== row.wrongReturnRequiredQty}
                  disabled={disabled}
                  onChange={(wrong) => onDraft({ wrong })}
                />
              )}
              {showDamaged && (
                <QuantityField
                  label="Trả NCC · hàng hỏng"
                  value={draft.damaged}
                  min={damagedLimit.floor}
                  max={damagedLimit.max}
                  hint={damagedLimit.floor > 0 ? `Đã trả ${damagedLimit.floor}` : undefined}
                  error={fieldErrors.damaged}
                  errorId={idBase + '-damaged'}
                  changed={Number(draft.damaged) !== row.damagedReturnRequiredQty}
                  disabled={disabled}
                  onChange={(damaged) => onDraft({ damaged })}
                />
              )}
              {showReplacement && (
                <QuantityField
                  label="NCC giao bù"
                  value={replacement}
                  min={replaceMin}
                  max={replaceMax}
                  hint={replaceMin > 0 ? `Tối thiểu ${replaceMin}` : undefined}
                  error={fieldErrors.replacement}
                  errorId={idBase + '-replacement'}
                  changed={Number(replacement) !== row.replacementRequiredQty}
                  disabled={disabled}
                  onChange={(value) => onDraft({ replacement: value })}
                />
              )}
              <label className="sd-field sd-plan-note">
                <span>Ghi chú</span>
                <input
                  value={draft.note}
                  maxLength={255}
                  placeholder="Không bắt buộc"
                  disabled={disabled}
                  onChange={(event) => onDraft({ note: event.target.value })}
                />
              </label>
            </div>
            {editing && (
              <p className="sd-muted">
                Phần không trả sẽ giữ tại kho để Owner nhận vào kho hoặc đề nghị xử lý.
              </p>
            )}
          </fieldset>
        )}
        <div className="sd-actions">
          <div className="sd-actions-buttons">
            {editing && hasPlan && (
              <>
                {dirty && (
                  <button
                    type="button"
                    className="mf-btn mf-btn--secondary"
                    disabled={saving}
                    onClick={onUndo}
                  >
                    Hoàn tác
                  </button>
                )}
                <button
                  type="button"
                  className="mf-btn mf-btn--primary"
                  disabled={saving || !dirty || invalid}
                  onClick={onSave}
                >
                  Lưu hướng xử lý
                </button>
              </>
            )}
            {actions}
          </div>
          {saveError && (
            <p role="alert" className="sd-error sd-role-note">
              {saveError}
            </p>
          )}
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
