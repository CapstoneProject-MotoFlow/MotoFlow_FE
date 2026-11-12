import PageBackLink from '../../shared/ui/PageBackLink'
import { useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useInventoryData, useInventoryScope, inventoryError } from './api'
import { InventoryHeader, InventoryPanel, InventoryNotice } from './components'
import { countFromDto, canCancelCount, type CountDto } from './countApi'
import type { Assignment } from './countAssignment'
import { countStateNames, countTypeNames } from './stockCountModel'
import { date, dateTime, money, today } from './presentation'
import WarehouseAssignmentDialog from '../operations/WarehouseAssignmentDialog'
import FormDialog from '../../shared/ui/FormDialog'
import axiosClient from '../../shared/api/axiosClient'
import { refreshNotifications } from '../notifications/notificationService'
import './stock-count.css'
export default function CountLiveDetail() {
  const { id } = useParams(),
    scope = useInventoryScope(),
    [revision, setRevision] = useState(0),
    [action, setAction] = useState(''),
    [reason, setReason] = useState(''),
    [selected, setSelected] = useState<number[]>([]),
    [reasons, setReasons] = useState<Record<number, string>>({}),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    lock = useRef(false)
  const r = useInventoryData<CountDto>(
      '/stock-counts/' + id,
      {},
      revision,
      !!id,
    ),
    d = r.data,
    c = d ? countFromDto(d) : undefined,
    manager =
      scope.user?.role === 'BRANCH_MANAGER' &&
      scope.user.storeId === d?.storeId,
    staff = scope.user?.role === 'STAFF',
    assignment = useInventoryData<
      Assignment & {
        current: {
          assigneeId: number
          assigneeName: string
          status: string
          resultSubmittedAt: string | null
        } | null
      }
    >(
      '/warehouse-tasks',
      { taskType: 'COUNTING', documentId: id },
      revision,
      manager && !!d,
    ),
    submitted = assignment.data?.current?.status === 'RESULT_SUBMITTED',
    open = d && ['DRAFT', 'COUNTING'].includes(d.status),
    own = staff || assignment.data?.current?.assigneeId === scope.user?.id
  function choose(value: string) {
    setAction(value)
    setSelected([])
    setReason('')
    setReasons(
      Object.fromEntries((d?.lines ?? []).map((l) => [l.id, l.reason ?? ''])),
    )
    setError('')
  }
  async function save() {
    if (lock.current || !d) return
    lock.current = true
    setBusy(true)
    setError('')
    try {
      const body =
        action === 'recount'
          ? { lineIds: selected, reason: reason.trim() }
          : action === 'confirm'
            ? {
                removedLineIds: selected,
                reasons: d.lines
                  .filter((l) => l.difference != null && l.difference !== 0)
                  .map((l) => ({
                    lineId: l.id,
                    reason: reasons[l.id]?.trim(),
                  })),
              }
            : action === 'cancel'
              ? { reason: reason.trim() }
              : { decisionReason: reason.trim() || undefined }
      await axiosClient.post(`/stock-counts/${d.id}/${action}`, body)
      setAction('')
      setRevision((n) => n + 1)
      refreshNotifications()
    } catch (e) {
      setError(inventoryError(e))
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  const valid =
    action === 'recount'
      ? selected.length > 0 && !!reason.trim()
      : action === 'cancel'
        ? !!reason.trim()
        : action === 'confirm'
          ? d &&
            selected.length < d.lines.length &&
            (!d.confirmedAt || selected.length === 0) &&
            d.lines.every(
              (l) => l.countedQty != null || selected.includes(l.id),
            ) &&
            d.lines.every(
              (l) =>
                l.difference == null ||
                l.difference === 0 ||
                !!reasons[l.id]?.trim(),
            )
          : true
  return (
    <main className="inventory-workspace count-workspace">
      <PageBackLink to="/stock-counts" />
      <InventoryHeader
        title={c ? 'Phiếu kiểm kê ' + c.code : 'Phiếu kiểm kê'}
      />
      <InventoryNotice loading={r.loading} error={r.error} />
      {d && c && (
        <>
          <InventoryPanel
            title={d.storeName + ' · ' + countStateNames[d.status]}
          >
            <dl className="stock-facts">
              <div>
                <dt>Loại / Phạm vi</dt>
                <dd>
                  {countTypeNames[d.countType]} · {c.scopeLabel}
                </dd>
              </div>
              <div>
                <dt>Ngày kiểm</dt>
                <dd>{date(d.countDate)}</dd>
              </div>
              <div>
                <dt>Người tạo</dt>
                <dd>
                  {d.createdByName} · {dateTime(d.createdAt)}
                </dd>
              </div>
              {manager && (
                <div>
                  <dt>Người đếm</dt>
                  <dd>
                    {assignment.data?.current?.assigneeName ?? 'Chưa giao'}
                  </dd>
                </div>
              )}
            </dl>
            {d.request && (
              <p className="stock-notice">
                Yêu cầu #{d.request.id} · {d.request.reason}
              </p>
            )}
            {c.recountReason && (
              <p className="count-unavailable">
                Yêu cầu đếm lại: {c.recountReason}
              </p>
            )}
            {d.cancellationReason && (
              <p className="count-unavailable">
                Lý do hủy: {d.cancellationReason}
              </p>
            )}
            {d.decisionReason && (
              <p className="stock-notice">Ghi chú duyệt: {d.decisionReason}</p>
            )}
            <InventoryNotice
              loading={assignment.loading}
              error={assignment.error}
            />
            <div className="count-buttons stock-filters">
              {manager && open && assignment.data?.canAssign && (
                <button
                  className="count-primary"
                  onClick={() => choose('assign')}
                >
                  Giao / đổi người đếm
                </button>
              )}
              {open && own && !submitted && (
                <Link to={`/stock-counts/${id}/record`}>
                  {d.status === 'DRAFT' || d.awaitingBookQuantities
                    ? 'Bắt đầu đếm'
                    : 'Ghi số đếm'}
                </Link>
              )}
              {manager && d.status === 'COUNTING' && submitted && (
                <>
                  {!own && (
                    <button
                      className="count-primary"
                      disabled={d.countDate > today()}
                      onClick={() => choose('confirm')}
                    >
                      Xác minh kết quả
                    </button>
                  )}
                  <button onClick={() => choose('recount')}>
                    Yêu cầu đếm lại
                  </button>
                </>
              )}
              {manager && canCancelCount(d) && (
                <button onClick={() => choose('cancel')}>Hủy phiếu</button>
              )}
              {scope.owner && d.status === 'AWAITING_APPROVAL' && (
                <>
                  <button
                    className="count-primary"
                    onClick={() => choose('approve')}
                  >
                    Duyệt chênh lệch
                  </button>
                  <button onClick={() => choose('recount')}>
                    Trả về đếm lại
                  </button>
                </>
              )}
            </div>
            {submitted && (
              <p className="stock-notice">
                Người đếm đã gửi kết quả, đang chờ xác minh.
              </p>
            )}
          </InventoryPanel>
          <InventoryPanel title="Kết quả kiểm kê">
            <div className="stock-table-scroll">
              <table className="stock-table">
                <thead>
                  <tr>
                    <th>Phụ tùng / Lô</th>
                    <th>Vị trí</th>
                    {!staff && <th>Sổ sách</th>}
                    <th>Số đếm</th>
                    {!staff && <th>Chênh lệch / Lý do</th>}
                    {scope.owner && <th>Giá trị chênh lệch</th>}
                  </tr>
                </thead>
                <tbody>
                  {d.lines.map((l) => (
                    <tr key={l.id}>
                      <td>
                        {l.partName}
                        <small>
                          {l.sku} ·{' '}
                          {l.lotId == null ? 'Không lô' : 'Lô #' + l.lotId}
                        </small>
                      </td>
                      <td>{l.binLocation ?? l.storageArea ?? '—'}</td>
                      {!staff && <td>{l.bookQty ?? '—'}</td>}
                      <td>{l.countedQty ?? 'Chưa đếm'}</td>
                      {!staff && (
                        <td>
                          {l.difference ?? '—'}
                          <small>{l.reason}</small>
                        </td>
                      )}
                      {scope.owner && (
                        <td>
                          {l.differenceValue == null
                            ? '—'
                            : money.format(l.differenceValue)}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!d.lines.length && (
              <p className="stock-empty">Phiếu chưa có dòng kiểm kê.</p>
            )}
          </InventoryPanel>
          {action === 'assign' && (
            <WarehouseAssignmentDialog
              taskType="COUNTING"
              documentId={d.id}
              onClose={() => setAction('')}
              onSaved={() => setRevision((n) => n + 1)}
            />
          )}
          {action && action !== 'assign' && (
            <FormDialog
              title={
                {
                  confirm: 'Xác minh kết quả',
                  recount: 'Yêu cầu đếm lại',
                  cancel: 'Hủy phiếu kiểm kê',
                  approve: 'Duyệt chênh lệch',
                }[action] ?? ''
              }
              formId="count-live-action"
              submitLabel="Xác nhận"
              busy={busy}
              submitDisabled={!valid}
              onClose={() => setAction('')}
            >
              <form
                id="count-live-action"
                className="count-form"
                onSubmit={(e) => {
                  e.preventDefault()
                  void save()
                }}
              >
                <InventoryNotice error={error} />
                <fieldset disabled={busy}>
                  {action === 'confirm' &&
                    d.lines
                      .filter((l) => l.countedQty == null || l.difference !== 0)
                      .map((l) => (
                        <div key={l.id}>
                          {l.sku} · {l.partName}
                          {l.countedQty == null ? (
                            <label>
                              <input
                                type="checkbox"
                                checked={selected.includes(l.id)}
                                onChange={(e) =>
                                  setSelected((v) =>
                                    e.target.checked
                                      ? [...v, l.id]
                                      : v.filter((i) => i !== l.id),
                                  )
                                }
                              />
                              Bỏ dòng chưa đếm (không ghi số 0)
                            </label>
                          ) : (
                            <label>
                              Lý do chênh lệch {l.difference}
                              <textarea
                                required
                                maxLength={255}
                                value={reasons[l.id] ?? ''}
                                onChange={(e) =>
                                  setReasons((v) => ({
                                    ...v,
                                    [l.id]: e.target.value,
                                  }))
                                }
                              />
                            </label>
                          )}
                        </div>
                      ))}
                  {action === 'recount' &&
                    d.lines.map((l) => (
                      <label key={l.id}>
                        <input
                          type="checkbox"
                          checked={selected.includes(l.id)}
                          onChange={(e) =>
                            setSelected((v) =>
                              e.target.checked
                                ? [...v, l.id]
                                : v.filter((i) => i !== l.id),
                            )
                          }
                        />
                        {l.sku} · Lô {l.lotId ?? 'không lô'}
                      </label>
                    ))}
                  {action !== 'confirm' && (
                    <label>
                      {action === 'approve' ? 'Ghi chú duyệt' : 'Lý do'}
                      <textarea
                        required={action !== 'approve'}
                        maxLength={255}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                      />
                    </label>
                  )}
                  {action === 'approve' && (
                    <p>
                      Chênh lệch được ghi vào tồn kho theo từng lô sau khi
                      duyệt.
                    </p>
                  )}
                </fieldset>
              </form>
            </FormDialog>
          )}
        </>
      )}
    </main>
  )
}
