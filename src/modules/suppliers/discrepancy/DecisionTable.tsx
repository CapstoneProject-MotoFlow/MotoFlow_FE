import { useId, useState, type ReactNode } from 'react'
import Icon from '../../../shared/ui/Icon'
import {
  caseProgress,
  decisionDraft,
  decisionDraftError,
  decisionLine,
  decisionNeedsOwner,
  decisionNumbers,
  decisionOptions,
  decisionReturnMax,
  decisionSaveButtons,
  type DecisionDraft,
} from '../discrepancyRules'
import type { AcceptanceMode } from './AcceptanceDialog'
import CaseActions from './CaseActions'
import type { CaseActionMode } from './CaseActionDialog'
import { decisionLabels, type Case } from './types'

const toneBadge = {
  warning: 'mf-badge--warning',
  info: 'mf-badge--info',
  success: 'mf-badge--success',
  muted: 'mf-badge--muted',
} as const

/**
 * Bảng sai lệch của cả phiếu nhập (GVHD 24/11, làm lại theo góp ý Ezy 26/11): mỗi phụ tùng một dòng gồm sai lệch khi
 * nhận, hướng xử lý với NCC (nhập được khi chưa chốt hoặc bấm "Sửa"), tiến độ và việc tiếp theo. Thay cho các thẻ ba
 * hộp tóm tắt cũ. Chỉ gửi dòng người dùng đã tích hoặc đã sửa (review 25/11). Hai nút lưu cố định kèm lý do khóa (R-06).
 */
export default function DecisionTable({
  rows,
  owner,
  busy,
  onSave,
  onApprove,
  onReject,
  onAction,
  onAcceptance,
}: {
  rows: Case[]
  owner: boolean
  busy: boolean
  onSave: (lines: ReturnType<typeof decisionLine>[], note: string) => Promise<boolean>
  onApprove: () => Promise<boolean>
  onReject: (reason: string) => Promise<boolean>
  onAction: (row: Case, mode: CaseActionMode) => void
  onAcceptance: (row: Case, mode: AcceptanceMode) => void
}) {
  const ids = useId()
  const [drafts, setDrafts] = useState<Record<number, DecisionDraft>>({})
  const [note, setNote] = useState('')
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  // Hồ sơ đã đóng xuống cuối bảng.
  const ordered = [...rows].sort(
    (a, b) => Number(a.status !== 'OPEN') - Number(b.status !== 'OPEN'),
  )
  // Dòng chỉ có hàng thừa bị từ chối thì không có gì để chốt (review 25/11).
  const isDecidable = (row: Case) =>
    row.status === 'OPEN' && row.shortQty + row.wrongItemQty + row.damagedQty > 0
  const decidable = rows.filter(isDecidable)
  // Dòng chưa chốt và còn sửa được thì mở sẵn.
  const editing = decidable.filter(
    (row) =>
      row.canHandle &&
      !row.decisionLocked &&
      (drafts[row.id] !== undefined || (row.decisionStatus ?? 'UNDECIDED') === 'UNDECIDED'),
  )
  const draftOf = (row: Case) => drafts[row.id] ?? decisionDraft(row)
  const picked = editing.filter((row) => drafts[row.id] !== undefined)
  const errors = picked.map((row) => decisionDraftError(row, draftOf(row))).filter(Boolean)
  const needsOwner = picked.some((row) => decisionNeedsOwner(row, draftOf(row), owner))
  const replacesDecided = picked.some(
    (row) => row.decisionStatus === 'DECIDED' && decisionNeedsOwner(row, draftOf(row), owner),
  )
  const awaiting = decidable.filter((row) => row.canApproveDecision).length
  // Review 25/11 (R-11): một nút mở lại mọi dòng đã chốt còn sửa được.
  const reopenable = decidable.filter(
    (row) => row.canHandle && !row.decisionLocked && !editing.includes(row),
  )
  const selectable = editing.filter((row) => (row.decisionStatus ?? 'UNDECIDED') === 'UNDECIDED')
  const allPicked = selectable.length > 0 && selectable.every((row) => drafts[row.id] !== undefined)
  const buttons = decisionSaveButtons(needsOwner, owner)
  const cannotSave = busy || !picked.length || errors.length > 0
  const blockedReason = picked.length ? buttons.save.blocked || buttons.propose?.blocked || '' : ''

  function toggle(list: Case[], on: boolean) {
    setDrafts((previous) => {
      const next = { ...previous }
      list.forEach((row) => {
        if (on) next[row.id] = next[row.id] ?? decisionDraft(row)
        else delete next[row.id]
      })
      return next
    })
  }

  function patch(row: Case, value: Partial<DecisionDraft>) {
    setDrafts((previous) => ({ ...previous, [row.id]: { ...draftOf(row), ...value } }))
  }

  async function save() {
    if (!picked.length || errors.length || busy) return
    if (await onSave(picked.map((row) => decisionLine(row, draftOf(row))), note.trim())) {
      setDrafts({})
      setNote('')
    }
  }

  async function reject() {
    if (!reason.trim() || busy) return
    if (await onReject(reason.trim())) {
      setRejecting(false)
      setReason('')
    }
  }

  function quantityInput(row: Case, label: string, value: string, max: number, key: keyof DecisionDraft) {
    return (
      <input
        type="number"
        inputMode="numeric"
        min={0}
        max={max}
        aria-label={label + ' ' + row.sku}
        name={key + '-' + row.id}
        autoComplete="off"
        value={value}
        disabled={busy}
        onChange={(event) => patch(row, { [key]: event.target.value })}
      />
    )
  }

  const hint = !picked.length
    ? 'Tích chọn dòng muốn chốt, hoặc sửa trực tiếp trên dòng, rồi bấm lưu.'
    : errors.length
      ? 'Sửa các dòng báo lỗi trước khi lưu.'
      : replacesDecided
        ? 'Dòng đã chốt giữ hướng cũ cho đến khi Owner duyệt hướng mới.'
        : needsOwner
          ? 'Dòng ghi “Cần Owner duyệt” sẽ chờ Owner. Hàng chỉ chuyển sang chờ trả NCC sau khi được duyệt.'
          : 'Lưu xong, hàng chuyển sang chờ trả NCC. Bước tiếp theo hiện ở cột “Tiến độ và việc tiếp theo”.'

  return (
    <section className="sd-board" aria-labelledby={ids + 'title'}>
      <header className="sd-board-head">
        <div>
          <h2 id={ids + 'title'}>Sai lệch theo phụ tùng</h2>
          <p className="sd-muted">
            Chốt hướng xử lý với nhà cung cấp cho từng dòng, rồi làm tiếp ở cột “Tiến độ và việc tiếp theo”.
          </p>
        </div>
        {reopenable.length > 0 && (
          <button
            type="button"
            className="mf-btn mf-btn--sm mf-btn--secondary"
            disabled={busy}
            onClick={() => toggle(reopenable, true)}
          >
            Sửa các dòng đã chốt
          </button>
        )}
      </header>

      {owner && awaiting > 0 && (
        <div className="sd-approval" role="region" aria-label="Duyệt hướng xử lý">
          <Icon name="info" />
          <p>
            <b>{awaiting} dòng</b> đang chờ Owner duyệt hướng xử lý.
          </p>
          <div className="sd-approval-buttons">
            <button
              type="button"
              className="mf-btn mf-btn--sm mf-btn--secondary"
              disabled={busy}
              aria-expanded={rejecting}
              onClick={() => setRejecting((value) => !value)}
            >
              Không duyệt
            </button>
            <button
              type="button"
              className="mf-btn mf-btn--sm mf-btn--primary"
              disabled={busy}
              onClick={() => void onApprove()}
            >
              Duyệt {awaiting} dòng
            </button>
          </div>
          {rejecting && (
            <div className="sd-approval-reject">
              <label className="sd-field">
                <span>Lý do không duyệt (bắt buộc)</span>
                <input
                  value={reason}
                  maxLength={255}
                  onChange={(event) => setReason(event.target.value)}
                />
              </label>
              <button
                type="button"
                className="mf-btn mf-btn--sm mf-btn--danger"
                disabled={busy || !reason.trim()}
                onClick={() => void reject()}
              >
                Gửi lại cho BM
              </button>
            </div>
          )}
        </div>
      )}

      <div className="sd-board-scroll">
        <table className="sd-grid">
          <caption className="sd-visually-hidden">
            Sai lệch, hướng xử lý và việc tiếp theo của từng phụ tùng trong phiếu nhập
          </caption>
          <colgroup>
            <col className="sd-col-check" />
            <col className="sd-col-part" />
            <col span={3} className="sd-col-num" />
            <col className="sd-col-decision" />
            <col className="sd-col-plan" />
            <col className="sd-col-plan" />
            <col className="sd-col-plan" />
            <col className="sd-col-progress" />
          </colgroup>
          <thead>
            <tr className="sd-grid-band">
              <th colSpan={2} />
              <th colSpan={3} scope="colgroup">
                Sai lệch khi nhận
              </th>
              <th colSpan={4} scope="colgroup" className="sd-band-plan">
                Hướng xử lý với NCC
              </th>
              <th />
            </tr>
            <tr>
              <th scope="col">
                {selectable.length > 0 ? (
                  <input
                    type="checkbox"
                    aria-label="Chọn mọi dòng chưa chốt"
                    checked={allPicked}
                    disabled={busy}
                    onChange={(event) => toggle(selectable, event.target.checked)}
                  />
                ) : (
                  <span className="sd-visually-hidden">Chọn</span>
                )}
              </th>
              <th scope="col">Phụ tùng</th>
              <th scope="col" className="sd-num">Thiếu</th>
              <th scope="col" className="sd-num">Giao sai</th>
              <th scope="col" className="sd-num">Hỏng</th>
              <th scope="col" className="sd-band-plan">Hướng xử lý</th>
              <th scope="col" className="sd-num sd-band-plan">Trả sai</th>
              <th scope="col" className="sd-num sd-band-plan">Trả hỏng</th>
              <th scope="col" className="sd-num sd-band-plan">Giao bù</th>
              <th scope="col">Tiến độ và việc tiếp theo</th>
            </tr>
          </thead>
          <tbody>
            {ordered.map((row) => {
              const decidableRow = isDecidable(row)
              const open = editing.includes(row)
              const draft = draftOf(row)
              const shown = decisionNumbers(row, draft)
              const chosen = open && drafts[row.id] !== undefined
              const error = chosen ? decisionDraftError(row, draft) : ''
              const keep = draft.type === 'ACCEPT_NO_REPLACEMENT'
              const progress = caseProgress(row)
              const askOwner = chosen && decisionNeedsOwner(row, draft, owner)
              const status = row.decisionStatus ?? 'UNDECIDED'
              const plain = (value: number): ReactNode => (open || row.decisionType ? value : '—')
              return (
                <tr
                  key={row.id}
                  className={
                    (chosen ? 'is-picked ' : open ? 'is-editing ' : '') +
                    (open ? 'has-check ' : '') +
                    (row.status !== 'OPEN' ? 'is-closed' : '')
                  }
                >
                  <td className="sd-cell-check">
                    {open && (
                      <input
                        type="checkbox"
                        aria-label={'Chọn dòng ' + row.sku}
                        checked={chosen}
                        disabled={busy}
                        onChange={(event) => toggle([row], event.target.checked)}
                      />
                    )}
                  </td>
                  <th scope="row" className="sd-cell-part">
                    <b>{row.sku}</b>
                    <span>{row.partName}</span>
                    {row.rejectedExcessQty > 0 && (
                      <small>Thừa từ chối {row.rejectedExcessQty}</small>
                    )}
                  </th>
                  <td className="sd-num" data-label="Thiếu">
                    <Qty value={row.shortQty} />
                  </td>
                  <td className="sd-num" data-label="Giao sai">
                    <Qty value={row.wrongItemQty} />
                  </td>
                  <td className="sd-num" data-label="Hỏng">
                    <Qty value={row.damagedQty} />
                  </td>
                  <td className="sd-cell-decision sd-band-plan" data-label="Hướng xử lý">
                    {open ? (
                      <select
                        aria-label={'Hướng xử lý ' + row.sku}
                        aria-invalid={error ? true : undefined}
                        aria-describedby={error ? ids + 'error-' + row.id : undefined}
                        value={draft.type}
                        disabled={busy}
                        onChange={(event) =>
                          patch(row, {
                            type: event.target.value as DecisionDraft['type'],
                            replacement: undefined,
                          })
                        }
                      >
                        {decisionOptions(row).map((type) => (
                          <option key={type} value={type}>
                            {decisionLabels[type]}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span>{row.decisionType ? decisionLabels[row.decisionType] : '—'}</span>
                    )}
                    {error && (
                      <p id={ids + 'error-' + row.id} className="sd-field-error" role="alert">
                        {error}
                      </p>
                    )}
                    {askOwner && <p className="sd-cell-note">Cần Owner duyệt</p>}
                    {!open && status === 'DECIDED' && row.approvedByName && (
                      <p className="sd-cell-note">Owner {row.approvedByName} đã duyệt</p>
                    )}
                    {!open && decidableRow && row.canHandle && !row.decisionLocked && (
                      <button
                        type="button"
                        className="mf-btn mf-btn--link sd-cell-edit"
                        aria-label={'Sửa hướng xử lý ' + row.sku}
                        disabled={busy}
                        onClick={() => patch(row, {})}
                      >
                        Sửa
                      </button>
                    )}
                    {!open && row.status === 'OPEN' && row.decisionLocked && (
                      <p className="sd-cell-note sd-locked">
                        <Icon name="lock" />
                        Đã khóa vì đã trả hàng, giao bù hoặc nhận vào kho
                      </p>
                    )}
                    {chosen && status !== 'UNDECIDED' && (
                      <button
                        type="button"
                        className="mf-btn mf-btn--link sd-cell-edit"
                        disabled={busy}
                        onClick={() => toggle([row], false)}
                      >
                        Hủy sửa
                      </button>
                    )}
                  </td>
                  <td className="sd-num sd-band-plan" data-label="Trả sai">
                    {open && !keep && row.wrongItemQty > 0
                      ? quantityInput(row, 'Trả hàng sai', draft.wrong, decisionReturnMax(row, 'WRONG_ITEM'), 'wrong')
                      : plain(shown.wrong)}
                  </td>
                  <td className="sd-num sd-band-plan" data-label="Trả hỏng">
                    {open && !keep && row.damagedQty > 0
                      ? quantityInput(row, 'Trả hàng hỏng', draft.damaged, decisionReturnMax(row, 'DAMAGED'), 'damaged')
                      : plain(shown.damaged)}
                  </td>
                  <td className="sd-num sd-band-plan" data-label="Giao bù">
                    {open && draft.type === 'RETURN_AND_REPLACE'
                      ? quantityInput(
                          row,
                          'NCC giao bù',
                          draft.replacement ?? String(shown.replacement),
                          row.replacementLimitQty,
                          'replacement',
                        )
                      : plain(shown.replacement)}
                  </td>
                  <td className="sd-cell-progress" data-label="Tiến độ và việc tiếp theo">
                    <span className={'mf-badge ' + toneBadge[progress.tone]}>{progress.label}</span>
                    {progress.lines.length > 0 && (
                      <ul>
                        {progress.lines.map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    )}
                    <CaseActions
                      row={row}
                      saving={busy}
                      onAction={(mode) => onAction(row, mode)}
                      onAcceptance={(mode) => onAcceptance(row, mode)}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {editing.length > 0 && (
        <div className={'sd-savebar' + (picked.length ? ' is-active' : '')}>
          <label className="sd-field sd-savebar-note">
            <span>Ghi chú cho lần lưu này</span>
            <input
              value={note}
              maxLength={255}
              placeholder="Không bắt buộc"
              disabled={busy}
              onChange={(event) => setNote(event.target.value)}
            />
          </label>
          <div className="sd-savebar-actions">
            <span className="sd-savebar-count" aria-live="polite">
              {picked.length ? `Đã chọn ${picked.length} dòng` : 'Chưa chọn dòng nào'}
            </span>
            {buttons.propose && (
              <button
                type="button"
                className={'mf-btn ' + (needsOwner ? 'mf-btn--primary' : 'mf-btn--secondary')}
                disabled={cannotSave || !!buttons.propose.blocked}
                onClick={() => void save()}
              >
                {busy && needsOwner ? 'Đang gửi…' : buttons.propose.label}
              </button>
            )}
            <button
              type="button"
              className={'mf-btn ' + (needsOwner ? 'mf-btn--secondary' : 'mf-btn--primary')}
              disabled={cannotSave || !!buttons.save.blocked}
              onClick={() => void save()}
            >
              {busy && !needsOwner ? 'Đang lưu…' : buttons.save.label}
            </button>
          </div>
          <p className="sd-savebar-hint" role="status">
            {blockedReason || hint}
          </p>
        </div>
      )}
    </section>
  )
}

/** Số lượng sai lệch: 0 hiện mờ để mắt dừng ở số khác 0. */
function Qty({ value }: { value: number }) {
  return <span className={value ? 'sd-qty-on' : 'sd-qty-zero'}>{value}</span>
}
