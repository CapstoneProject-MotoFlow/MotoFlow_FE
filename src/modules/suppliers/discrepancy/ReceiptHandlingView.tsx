import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import axiosClient from '../../../shared/api/axiosClient'
import { useAuth } from '../../../shared/hooks/useAuth'
import EmptyState from '../../../shared/ui/EmptyState'
import { documentCode } from '../../../shared/utils/documentCode'
import { formatDate } from '../../../shared/utils/format'
import { decisionLine, receiptHandlingStatus } from '../discrepancyRules'
import AcceptanceDialog, { type AcceptanceMode } from './AcceptanceDialog'
import CaseActionDialog, { type CaseActionMode } from './CaseActionDialog'
import DecisionTable from './DecisionTable'
import { errorMessage, type Case } from './types'

/**
 * Dòng hàng thừa của phiếu nhập (BE #98: GET /discrepancy-cases/receipts/{id}/handling): Owner quyết nhận vào kho
 * hay trả nhà cung cấp. Review #72 (72-2): dùng API này để BE giữ luôn cách tính "đã xử lý xong".
 */
type ExcessLine = {
  lineId: number
  sku: string
  partName: string
  quantity: number
  decision: 'NOT_APPLICABLE' | 'AWAITING_OWNER' | 'ACCEPTED' | 'REJECTED'
}
type ReceiptHandling = { excessLines: ExcessLine[]; handlingComplete: boolean }

const excessDecisionLabels: Record<string, string> = {
  AWAITING_OWNER: 'Chờ Owner quyết',
  ACCEPTED: 'Owner nhận vào kho',
  REJECTED: 'Owner trả nhà cung cấp',
}

/**
 * Xử lý sai lệch của một phiếu nhập. GVHD 24/11: chốt hướng xử lý cả phiếu trong một bảng (DecisionTable). Ezy 26/11:
 * bỏ các thẻ cũ theo phụ tùng, tiến độ và hành động tiếp theo nằm luôn trong bảng.
 * PM 22/11: hiện cả dòng hàng thừa; phiếu chỉ xong khi mọi hồ sơ đã đóng và không còn hàng thừa chờ Owner.
 */
export default function ReceiptHandlingView({ receiptId }: { receiptId: string }) {
  const { user } = useAuth()
  const [rows, setRows] = useState<Case[]>([])
  const [excess, setExcess] = useState<ExcessLine[]>([])
  // null = không tải được API hàng thừa (không được coi là không có hàng thừa).
  const [handlingComplete, setHandlingComplete] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [saveError, setSaveError] = useState('')
  const [action, setAction] = useState<{ row: Case; mode: CaseActionMode }>()
  const [acceptance, setAcceptance] = useState<{ row: Case; mode: AcceptanceMode }>()

  useEffect(() => {
    const controller = new AbortController()
    async function load() {
      setLoading(true)
      try {
        const cases: Case[] = []
        for (let page = 0; ; page++) {
          const { data } = await axiosClient.get<{ items: Case[]; totalItems: number }>(
            '/discrepancy-cases',
            {
              params: { goodsReceiptNoteId: receiptId, page, size: 100 },
              signal: controller.signal,
            },
          )
          cases.push(...data.items)
          if (!data.items.length || cases.length >= data.totalItems) break
        }
        // Hàng thừa nằm trên phiếu nhập, không phải hồ sơ sai lệch; lỗi tải phần này không chặn màn hình.
        const handling = await axiosClient
          .get<ReceiptHandling>(
            '/discrepancy-cases/receipts/' + receiptId + '/handling',
            { signal: controller.signal },
          )
          .then(({ data }) => data)
          .catch(() => undefined)
        if (!controller.signal.aborted) {
          setRows(cases)
          setExcess(handling?.excessLines ?? [])
          setHandlingComplete(handling ? handling.handlingComplete : null)
          setError('')
        }
      } catch (failure) {
        if (!controller.signal.aborted) setError(errorMessage(failure))
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    void load()
    return () => controller.abort()
  }, [receiptId])

  function replaceRow(row: Case, message: string) {
    setRows((previous) => previous.map((item) => (item.id === row.id ? row : item)))
    setNotice(message)
  }

  /** Lưu, duyệt hoặc không duyệt hướng xử lý: BE trả lại mọi hồ sơ của phiếu. */
  async function decide(
    request: () => Promise<{ data: Case[] }>,
    message: string | ((rows: Case[]) => string),
  ): Promise<boolean> {
    if (saving) return false
    setSaveError('')
    setNotice('')
    setSaving(true)
    try {
      const { data } = await request()
      setRows(data)
      setNotice(typeof message === 'string' ? message : message(data))
      return true
    } catch (failure) {
      setSaveError(errorMessage(failure))
      return false
    } finally {
      setSaving(false)
    }
  }

  const base = '/goods-receipt-notes/' + receiptId + '/discrepancies'
  const saveDecisions = (lines: ReturnType<typeof decisionLine>[], note: string) =>
    decide(
      () => axiosClient.put<Case[]>(base, { lines, note: note || undefined }),
      // Review 25/11 (R-12): chỉ nói đã gửi Owner khi thật sự có dòng chờ Owner.
      (data) =>
        data.some(
          (row) =>
            row.decisionStatus === 'AWAITING_OWNER' &&
            lines.some((line) => line.caseId === row.id),
        )
          ? 'Đã lưu hướng xử lý. Dòng cần Owner duyệt đã được gửi Owner.'
          : 'Đã lưu hướng xử lý.',
    )
  const approveDecisions = () =>
    decide(() => axiosClient.post<Case[]>(base + '/approve', {}), 'Đã duyệt hướng xử lý.')
  const rejectDecisions = (reason: string) =>
    decide(
      () => axiosClient.post<Case[]>(base + '/reject', { reason }),
      'Đã gửi lại cho BM chọn hướng khác.',
    )

  const first = rows[0]
  const openCases = rows.filter((row) => row.status !== 'CLOSED').length
  const waitingExcess = excess.filter(
    (line) => line.decision === 'AWAITING_OWNER',
  ).length
  // BE quyết định (gồm cả phiếu đã xác nhận); không tải được thì tự tính như trước.
  const status = receiptHandlingStatus({ openCases, waitingExcess, handlingComplete })
  return (
    <>
      <header className="sd-head">
        <div className="sd-head-title">
          <h1>Xử lý sai lệch nhà cung cấp</h1>
          {!loading && (rows.length > 0 || excess.length > 0 || handlingComplete === null) && (
            <span
              className={'mf-badge ' + (status.done ? 'mf-badge--success' : 'mf-badge--warning')}
            >
              {status.text}
            </span>
          )}
        </div>
        <dl className="sd-facts">
          <div>
            <dt>Phiếu nhập</dt>
            <dd>{documentCode('PN', Number(receiptId))}</dd>
          </div>
          {first?.purchaseOrderId && (
            <div>
              <dt>Đơn nhập</dt>
              <dd>
                <Link to={'/purchase-orders/' + first.purchaseOrderId}>
                  {documentCode('DNH', first.purchaseOrderId)}
                </Link>
              </dd>
            </div>
          )}
          {first?.supplierName && (
            <div>
              <dt>Nhà cung cấp</dt>
              <dd>{first.supplierName}</dd>
            </div>
          )}
          {first?.storeName && (
            <div>
              <dt>Kho</dt>
              <dd>{first.storeName}</dd>
            </div>
          )}
          {first?.deliveryDate && (
            <div>
              <dt>Giao ngày</dt>
              <dd>{formatDate(first.deliveryDate)}</dd>
            </div>
          )}
        </dl>
      </header>

      {notice && (
        <p className="mf-success-notice sd-notice" role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className="sd-alert" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <section className="sd-panel sd-skeleton" role="status" aria-label="Đang tải">
          <span />
          <span />
          <span />
        </section>
      ) : !rows.length ? (
        !error &&
        !excess.length && (
          <section className="sd-panel">
            <EmptyState
              message={
                'Phiếu nhập ' +
                documentCode('PN', Number(receiptId)) +
                ' không có hồ sơ sai lệch.'
              }
              action={
                <Link className="mf-btn mf-btn--secondary" to="/supplier-discrepancies">
                  Xem các hồ sơ đang mở
                </Link>
              }
            />
          </section>
        )
      ) : (
        <section className="sd-panel">
          <DecisionTable
            key={rows.map((row) => row.id + ':' + row.decisionStatus).join(',')}
            rows={rows}
            owner={user?.role === 'OWNER'}
            busy={saving}
            onSave={saveDecisions}
            onApprove={approveDecisions}
            onReject={rejectDecisions}
            onAction={(row, mode) => setAction({ row, mode })}
            onAcceptance={(row, mode) => setAcceptance({ row, mode })}
          />
          {saveError && (
            <p role="alert" className="sd-error sd-panel-error">
              {saveError}
            </p>
          )}
        </section>
      )}

      {!loading && excess.length > 0 && (
        <section className="sd-panel sd-excess" aria-label="Hàng thừa của phiếu nhập">
          <header className="sd-excess-head">
            <div>
              <h2>Hàng thừa</h2>
              <p className="sd-muted">Hàng giao dư so với đơn nhập, Owner quyết nhận vào kho hay trả NCC.</p>
            </div>
            {waitingExcess > 0 && user?.role === 'OWNER' && (
              <Link className="mf-btn mf-btn--primary mf-btn--sm" to="/goods-receipt-notes/excess">
                Quyết định hàng thừa
              </Link>
            )}
          </header>
          <table className="sd-grid sd-grid--simple">
            <thead>
              <tr>
                <th scope="col">Phụ tùng</th>
                <th scope="col" className="sd-num">Số thừa</th>
                <th scope="col">Hướng xử lý</th>
              </tr>
            </thead>
            <tbody>
              {excess.map((line) => (
                <tr key={line.lineId}>
                  <th scope="row" className="sd-cell-part">
                    <b>{line.sku}</b>
                    <span>{line.partName}</span>
                  </th>
                  <td className="sd-num" data-label="Số thừa">
                    {line.quantity}
                  </td>
                  <td data-label="Hướng xử lý">
                    <span
                      className={
                        'mf-badge ' +
                        (line.decision === 'AWAITING_OWNER' ? 'mf-badge--warning' : 'mf-badge--muted')
                      }
                    >
                      {excessDecisionLabels[line.decision] ?? '—'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {action && (
        <CaseActionDialog
          key={action.row.id + action.mode}
          selected={action.row}
          mode={action.mode}
          onClose={() => setAction(undefined)}
          onSaved={(row) => {
            replaceRow(row, 'Đã cập nhật hồ sơ sai lệch.')
            setAction(undefined)
          }}
        />
      )}
      {acceptance && (
        <AcceptanceDialog
          key={acceptance.row.id + acceptance.mode}
          row={acceptance.row}
          mode={acceptance.mode}
          onClose={() => setAcceptance(undefined)}
          onSaved={(row, message) => {
            replaceRow(row, message)
            setAcceptance(undefined)
          }}
        />
      )}
    </>
  )
}
