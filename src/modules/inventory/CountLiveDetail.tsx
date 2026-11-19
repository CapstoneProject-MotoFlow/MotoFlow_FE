import PageBackLink from '../../shared/ui/PageBackLink'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useInventoryData, useInventoryScope, inventoryError } from './api'
import { InventoryHeader, InventoryPanel, InventoryNotice } from './components'
import { countFromDto, canCancelCount, type CountDto } from './countApi'
import type { Assignment } from './countAssignment'
import {
  stockCountStatusLabels as countStateNames,
  stockCountTypeLabels as countTypeNames,
} from '../../shared/labels/status'
import { date, dateTime, money, today } from './presentation'
import WarehouseAssignmentDialog from '../operations/WarehouseAssignmentDialog'
import FormDialog from '../../shared/ui/FormDialog'
import axiosClient from '../../shared/api/axiosClient'
import { refreshNotifications } from '../notifications/notificationService'
import { documentCode } from '../../shared/utils/documentCode'
import type { OpeningCostsResponse } from './openingBalanceApi'
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
  const openingCosts = useInventoryData<OpeningCostsResponse>(
    '/stock-counts/' + id + '/opening-costs',
    {},
    revision,
    !!d && scope.owner && d.countType === 'OPENING',
  )
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
  const openingReady = d?.countType !== 'OPENING' || openingCosts.data?.complete === true
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
                Yêu cầu {documentCode('YCKK', d.request.id)} ·{' '}
                {d.request.reason}
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
                <Link
                  className="mf-btn mf-btn--secondary count-record-action"
                  to={`/stock-counts/${id}/record`}
                >
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
                    disabled={!openingReady}
                    onClick={() => choose('approve')}
                  >
                    {d.countType === 'OPENING' ? 'Duyệt tồn đầu kỳ' : 'Duyệt chênh lệch'}
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
          {scope.owner && d.countType === 'OPENING' && d.status === 'AWAITING_APPROVAL' && (
            <OpeningCostsPanel
              data={openingCosts.data}
              loading={openingCosts.loading}
              error={openingCosts.error}
              onRetry={openingCosts.reload}
              onSaved={() => setRevision((n) => n + 1)}
            />
          )}
          <InventoryPanel title="Kết quả kiểm kê">
            <div className="stock-table-scroll">
              <table className="stock-table">
                <thead>
                  <tr>
                    <th>Phụ tùng / Lô</th>
                    <th>Vị trí (khu – kệ)</th>
                    {!staff && <th>Sổ sách</th>}
                    <th>Số đếm</th>
                    <th>Hư hỏng</th>
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
                      <td>{l.damagedQty ?? 0}</td>
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
                      <label key={l.id} className="count-recount-option">
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

function OpeningCostsPanel({
  data,
  loading,
  error,
  onRetry,
  onSaved,
}: {
  data?: OpeningCostsResponse
  loading: boolean
  error?: string
  onRetry: () => void
  onSaved: () => void
}) {
  const [costs, setCosts] = useState<Record<number, string>>({})
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [saveError, setSaveError] = useState('')
  useEffect(() => {
    if (data)
      setCosts(
        Object.fromEntries(
          data.parts.map((part) => [
            part.productId,
            part.initialUnitCost == null ? '' : String(part.initialUnitCost),
          ]),
        ),
      )
  }, [data])
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!data || busy) return
    setBusy(true)
    setSaveError('')
    setMessage('')
    try {
      await axiosClient.put(`/stock-counts/${data.stockCountId}/opening-costs`, {
        costs: data.parts
          .filter((part) => costs[part.productId] !== '')
          .map((part) => ({
            productId: part.productId,
            initialUnitCost: Number(costs[part.productId]),
          })),
      })
      setMessage('Đã lưu giá vốn ban đầu.')
      onSaved()
    } catch (failure) {
      setSaveError(inventoryError(failure))
    } finally {
      setBusy(false)
    }
  }
  return (
    <InventoryPanel title="Giá vốn ban đầu cho tồn đầu kỳ">
      <InventoryNotice loading={loading} error={error} onRetry={onRetry} />
      {data && (
        <>
          {!data.complete && (
            <p className="stock-notice">
              Còn thiếu giá vốn: {data.missingSkus.join(', ')}. Nhập đủ trước khi duyệt.
            </p>
          )}
          {message && <p className="stock-notice" role="status">{message}</p>}
          {saveError && <p className="stock-notice stock-error" role="alert">{saveError}</p>}
          <form className="opening-cost-form" onSubmit={(event) => void save(event)}>
            <div className="stock-table-scroll">
              <table className="stock-table">
                <thead>
                  <tr><th>Phụ tùng / lô</th><th>Số lượng tồn đầu</th><th>Giá vốn ban đầu</th><th>Giá trị</th></tr>
                </thead>
                <tbody>
                  {data.parts.map((part) => (
                    <tr key={part.productId}>
                      <td>
                        <strong>{part.partName}</strong><small>{part.sku}</small>
                        {part.lots.map((lot, index) => (
                          <small key={index}>
                            {lot.expiryDate ? `HSD ${lot.expiryDate}` : 'Không hạn'} · {lot.quantity} {part.baseUnit} · hỏng {lot.damagedQty}
                          </small>
                        ))}
                      </td>
                      <td>{part.quantity.toLocaleString('vi-VN')} {part.baseUnit}</td>
                      <td>
                        <input
                          aria-label={`Giá vốn ${part.sku}`}
                          type="number"
                          min="1"
                          step="1"
                          required={!part.locked}
                          disabled={part.locked || busy}
                          value={costs[part.productId] ?? ''}
                          onChange={(event) => setCosts((values) => ({ ...values, [part.productId]: event.target.value }))}
                        />
                        {part.locked && <small>Đã khóa sau khi duyệt</small>}
                      </td>
                      <td>{costs[part.productId] ? money.format(part.quantity * Number(costs[part.productId])) : '—'}</td>
                    </tr>
                  ))}
                  {!data.parts.length && <tr><td colSpan={4}>Chưa có số đếm dương được gửi lên.</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="opening-cost-footer">
              <strong>Tổng giá trị đã tính: {money.format(data.totalValue)}</strong>
              <button className="count-primary" type="submit" disabled={busy || !data.parts.some((part) => !part.locked)}>
                {busy ? 'Đang lưu…' : 'Lưu giá vốn'}
              </button>
            </div>
          </form>
        </>
      )}
    </InventoryPanel>
  )
}
