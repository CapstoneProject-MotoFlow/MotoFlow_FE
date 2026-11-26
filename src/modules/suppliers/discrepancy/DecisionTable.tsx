import { useState } from 'react'
import {
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
import {
  decisionLabels,
  decisionStatusLabels,
  type Case,
  type DecisionStatus,
} from './types'

const statusBadge: Record<DecisionStatus, string> = {
  UNDECIDED: 'mf-badge--warning',
  AWAITING_OWNER: 'mf-badge--info',
  DECIDED: 'mf-badge--success',
}

/**
 * GVHD 24/11: hướng đề xuất xử lý với NCC của cả phiếu nhập trong một bảng. Dòng chưa chốt mở sẵn để nhập; dòng
 * đã chốt hoặc chờ Owner bấm "Sửa". Dưới bảng chỉ có một nút: "Lưu hướng xử lý", hoặc "Đề nghị Owner duyệt" khi BM
 * chọn hướng cần Owner (PM Q2). Owner thấy thêm "Duyệt" / "Không duyệt" khi có dòng chờ duyệt.
 */
export default function DecisionTable({
  rows,
  owner,
  busy,
  onSave,
  onApprove,
  onReject,
}: {
  rows: Case[]
  owner: boolean
  busy: boolean
  onSave: (
    lines: ReturnType<typeof decisionLine>[],
    note: string,
  ) => Promise<boolean>
  onApprove: () => Promise<boolean>
  onReject: (reason: string) => Promise<boolean>
}) {
  const [drafts, setDrafts] = useState<Record<number, DecisionDraft>>({})
  const [note, setNote] = useState('')
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  // Dòng chỉ có hàng thừa bị từ chối thì không có gì để chốt (review 25/11).
  const decidable = rows.filter(
    (row) =>
      row.status === 'OPEN' &&
      row.shortQty + row.wrongItemQty + row.damagedQty > 0,
  )
  // Dòng chưa chốt và còn sửa được thì mở sẵn.
  const editing = decidable.filter(
    (row) =>
      row.canHandle &&
      !row.decisionLocked &&
      (drafts[row.id] !== undefined ||
        (row.decisionStatus ?? 'UNDECIDED') === 'UNDECIDED'),
  )
  const draftOf = (row: Case) => drafts[row.id] ?? decisionDraft(row)
  // Chỉ gửi dòng người dùng đã chọn hoặc đã sửa, không tự chốt dòng chưa xem (review 25/11).
  const picked = editing.filter((row) => drafts[row.id] !== undefined)
  const errors = picked
    .map((row) => decisionDraftError(row, draftOf(row)))
    .filter(Boolean)
  const needsOwner = picked.some((row) =>
    decisionNeedsOwner(row, draftOf(row), owner),
  )
  const replacesDecided = picked.some(
    (row) =>
      row.decisionStatus === 'DECIDED' &&
      decisionNeedsOwner(row, draftOf(row), owner),
  )
  const awaiting = decidable.filter((row) => row.canApproveDecision).length
  // Review 25/11 (R-11, plan B6): nút "Sửa" ở góc trên mở lại mọi dòng đã chốt còn sửa được.
  const reopenable = decidable.filter(
    (row) => row.canHandle && !row.decisionLocked && !editing.includes(row),
  )
  const buttons = decisionSaveButtons(needsOwner, owner)
  const cannotSave = busy || !picked.length || errors.length > 0
  const count = picked.length > 0 ? ` (${picked.length} dòng)` : ''
  // Lý do nút bị khóa, hiện ngay cạnh nút (chỉ khi đã chọn dòng).
  const blockedReason = picked.length
    ? buttons.save.blocked || buttons.propose?.blocked || ''
    : ''

  function toggle(row: Case, on: boolean) {
    setDrafts((previous) => {
      const next = { ...previous }
      if (on) next[row.id] = draftOf(row)
      else delete next[row.id]
      return next
    })
  }

  function editAll() {
    setDrafts((previous) => {
      const next = { ...previous }
      reopenable.forEach((row) => {
        next[row.id] = next[row.id] ?? decisionDraft(row)
      })
      return next
    })
  }

  function patch(row: Case, value: Partial<DecisionDraft>) {
    setDrafts((previous) => ({
      ...previous,
      [row.id]: { ...draftOf(row), ...value },
    }))
  }

  async function save() {
    if (!picked.length || errors.length || busy) return
    const saved = await onSave(
      picked.map((row) => decisionLine(row, draftOf(row))),
      note.trim(),
    )
    if (saved) {
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

  if (!decidable.length) return null
  return (
    <section className="sd-decision" aria-labelledby="sd-decision-title">
      <header className="sd-excess-head">
        <h2 id="sd-decision-title">Hướng đề xuất xử lý với NCC</h2>
        {reopenable.length > 0 && (
          <button
            type="button"
            className="mf-btn mf-btn--sm mf-btn--secondary sd-decision-edit-all"
            disabled={busy}
            onClick={editAll}
          >
            Sửa
          </button>
        )}
        {owner && awaiting > 0 && (
          <div className="sd-actions-buttons">
            <span className="mf-badge mf-badge--info">
              {awaiting} dòng chờ Owner duyệt
            </span>
            <button
              type="button"
              className="mf-btn mf-btn--sm mf-btn--primary"
              disabled={busy}
              onClick={() => void onApprove()}
            >
              Duyệt
            </button>
            <button
              type="button"
              className="mf-btn mf-btn--sm mf-btn--secondary"
              disabled={busy}
              onClick={() => setRejecting((value) => !value)}
            >
              Không duyệt
            </button>
          </div>
        )}
      </header>
      {rejecting && (
        <div className="sd-reject">
          <label className="sd-field">
            <span>Lý do không duyệt</span>
            <input
              value={reason}
              maxLength={255}
              autoFocus
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
      <div className="sd-decision-scroll">
        <table className="stock-table sd-decision-table">
          <thead>
            <tr>
              <th aria-label="Chọn dòng để lưu" />
              <th>Phụ tùng</th>
              <th>Thiếu</th>
              <th>Giao sai</th>
              <th>Hỏng</th>
              <th>Hướng xử lý</th>
              <th>Trả hàng sai</th>
              <th>Trả hàng hỏng</th>
              <th>NCC giao bù</th>
              <th>Trạng thái</th>
              <th aria-label="Sửa" />
            </tr>
          </thead>
          <tbody>
            {decidable.map((row) => {
              const open = editing.includes(row)
              const draft = draftOf(row)
              const shown = decisionNumbers(row, draft)
              const chosen = open && drafts[row.id] !== undefined
              const error = chosen ? decisionDraftError(row, draft) : ''
              const status = row.decisionStatus ?? 'UNDECIDED'
              const keep = draft.type === 'ACCEPT_NO_REPLACEMENT'
              return (
                <tr key={row.id} className={open ? 'is-editing' : undefined}>
                  <td>
                    {open && (
                      <input
                        type="checkbox"
                        aria-label={'Chọn dòng ' + row.sku}
                        checked={chosen}
                        disabled={busy}
                        onChange={(event) => toggle(row, event.target.checked)}
                      />
                    )}
                  </td>
                  <td>
                    <b>{row.sku}</b>
                    <br />
                    <small>{row.partName}</small>
                    {error && (
                      <small className="sd-field-error" role="alert">
                        <br />
                        {error}
                      </small>
                    )}
                  </td>
                  <td>{row.shortQty}</td>
                  <td>{row.wrongItemQty}</td>
                  <td>{row.damagedQty}</td>
                  <td>
                    {open ? (
                      <select
                        aria-label={'Hướng xử lý ' + row.sku}
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
                    ) : row.decisionType ? (
                      decisionLabels[row.decisionType]
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>
                    {open && !keep && row.wrongItemQty > 0 ? (
                      <input
                        type="number"
                        min={0}
                        max={decisionReturnMax(row, 'WRONG_ITEM')}
                        aria-label={'Trả hàng sai ' + row.sku}
                        value={draft.wrong}
                        disabled={busy}
                        onChange={(event) =>
                          patch(row, { wrong: event.target.value })
                        }
                      />
                    ) : (
                      shown.wrong
                    )}
                  </td>
                  <td>
                    {open && !keep && row.damagedQty > 0 ? (
                      <input
                        type="number"
                        min={0}
                        max={decisionReturnMax(row, 'DAMAGED')}
                        aria-label={'Trả hàng hỏng ' + row.sku}
                        value={draft.damaged}
                        disabled={busy}
                        onChange={(event) =>
                          patch(row, { damaged: event.target.value })
                        }
                      />
                    ) : (
                      shown.damaged
                    )}
                  </td>
                  <td>
                    {open && draft.type === 'RETURN_AND_REPLACE' ? (
                      <input
                        type="number"
                        min={0}
                        max={row.replacementLimitQty}
                        aria-label={'NCC giao bù ' + row.sku}
                        value={draft.replacement ?? String(shown.replacement)}
                        disabled={busy}
                        onChange={(event) =>
                          patch(row, { replacement: event.target.value })
                        }
                      />
                    ) : (
                      shown.replacement
                    )}
                  </td>
                  <td>
                    <span className={'mf-badge ' + statusBadge[status]}>
                      {decisionStatusLabels[status]}
                    </span>
                    {status === 'DECIDED' && row.approvedByName && (
                      <small> · Owner duyệt</small>
                    )}
                    {chosen && decisionNeedsOwner(row, draft, owner) && (
                      <small className="sd-muted">
                        <br />
                        Cần Owner duyệt
                      </small>
                    )}
                  </td>
                  <td>
                    {!open && row.canHandle && !row.decisionLocked && (
                      <button
                        type="button"
                        className="mf-btn mf-btn--link"
                        aria-label={'Sửa hướng xử lý ' + row.sku}
                        title="Sửa"
                        disabled={busy}
                        onClick={() => patch(row, {})}
                      >
                        ✎
                      </button>
                    )}
                    {!open && row.decisionLocked && (
                      <span title="Đã trả hàng, giao bù hoặc nhận vào kho nên không sửa hướng được">
                        🔒
                      </span>
                    )}
                    {open &&
                      drafts[row.id] !== undefined &&
                      status !== 'UNDECIDED' && (
                        <button
                          type="button"
                          className="mf-btn mf-btn--link"
                          disabled={busy}
                          onClick={() =>
                            setDrafts((previous) => {
                              const next = { ...previous }
                              delete next[row.id]
                              return next
                            })
                          }
                        >
                          Hủy
                        </button>
                      )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {editing.length > 0 && (
        <div className="sd-decision-save">
          <label className="sd-field sd-plan-note">
            <span>Ghi chú</span>
            <input
              value={note}
              maxLength={255}
              placeholder="Không bắt buộc"
              disabled={busy}
              onChange={(event) => setNote(event.target.value)}
            />
          </label>
          <button
            type="button"
            className={
              'mf-btn' + (buttons.save.blocked ? '' : ' mf-btn--primary')
            }
            disabled={cannotSave || !!buttons.save.blocked}
            onClick={() => void save()}
          >
            {buttons.save.label}
            {!buttons.save.blocked && count}
          </button>
          {buttons.propose && (
            <button
              type="button"
              className={
                'mf-btn' + (buttons.propose.blocked ? '' : ' mf-btn--primary')
              }
              disabled={cannotSave || !!buttons.propose.blocked}
              onClick={() => void save()}
            >
              {buttons.propose.label}
              {!buttons.propose.blocked && count}
            </button>
          )}
          {blockedReason && (
            <small className="sd-muted" role="status">
              {blockedReason}
            </small>
          )}
          <p className="sd-muted">
            {!picked.length
              ? 'Đánh dấu hoặc sửa các dòng muốn chốt rồi bấm lưu.'
              : replacesDecided
                ? 'Dòng đã chốt giữ hướng cũ đến khi Owner duyệt hướng mới; Owner không duyệt thì giữ nguyên hướng cũ.'
                : needsOwner
                  ? 'Dòng "Trả hàng lỗi, yêu cầu giao bù" với giao bù = thiếu + trả sai + trả hỏng được lưu ngay; các dòng còn lại chờ Owner duyệt. Chưa duyệt thì hàng chưa chuyển sang chờ trả NCC.'
                  : 'Lưu xong, hàng trả chuyển sang chờ trả NCC; sau đó mới ghi nhận đã trả và nhập hàng giao bù bằng phiếu nhập mới.'}
          </p>
        </div>
      )}
    </section>
  )
}
