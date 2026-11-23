import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import axiosClient from '../../../shared/api/axiosClient'
import { useAuth } from '../../../shared/hooks/useAuth'
import EmptyState from '../../../shared/ui/EmptyState'
import { documentCode } from '../../../shared/utils/documentCode'
import { formatDate } from '../../../shared/utils/format'
import {
  caseDraft,
  caseDraftChanged,
  caseDraftError,
  caseLine,
  receiptHandlingStatus,
  type CaseDraft,
} from '../discrepancyRules'
import AcceptanceDialog, { type AcceptanceMode } from './AcceptanceDialog'
import CaseActionDialog, { type CaseActionMode } from './CaseActionDialog'
import CaseCard from './CaseCard'
import { errorMessage, type Case } from './types'

/** Dòng hàng thừa của phiếu nhập (GET /goods-receipt-notes/{id}): Owner quyết nhận vào kho hay trả nhà cung cấp. */
type ExcessLine = {
  id: number
  sku: string
  partName: string
  excessQty: number
  excessDecision: 'NOT_APPLICABLE' | 'AWAITING_OWNER' | 'ACCEPTED' | 'REJECTED'
}

const excessDecisionLabels: Record<string, string> = {
  AWAITING_OWNER: 'Chờ Owner quyết',
  ACCEPTED: 'Owner nhận vào kho',
  REJECTED: 'Owner trả nhà cung cấp',
}

/**
 * Xử lý sai lệch của một phiếu nhập: mỗi phụ tùng một thẻ, mỗi thẻ lưu hướng xử lý của riêng hồ sơ đó.
 * PM 22/11: hiện cả dòng hàng thừa; phiếu chỉ xong khi mọi hồ sơ đã đóng và không còn hàng thừa chờ Owner.
 */
export default function ReceiptHandlingView({ receiptId }: { receiptId: string }) {
  const { user } = useAuth()
  const [rows, setRows] = useState<Case[]>([])
  const [excess, setExcess] = useState<ExcessLine[]>([])
  // Graphify #72: false = không tải được hàng thừa (không được coi là không có hàng thừa).
  const [excessLoaded, setExcessLoaded] = useState(true)
  const [drafts, setDrafts] = useState<Record<number, CaseDraft>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  /** Lỗi lưu hướng xử lý, hiện trong đúng thẻ của hồ sơ vừa lưu. */
  const [saveError, setSaveError] = useState<{ id: number; message: string }>()
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
        const receipt = await axiosClient
          .get<{ lines: ExcessLine[] }>('/goods-receipt-notes/' + receiptId, {
            signal: controller.signal,
          })
          .then(({ data }) => data.lines.filter((line) => line.excessQty > 0))
          .catch(() => null)
        if (!controller.signal.aborted) {
          setRows(cases)
          setExcess(receipt ?? [])
          setExcessLoaded(receipt !== null)
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

  function patchDraft(row: Case, patch: Partial<CaseDraft>) {
    setDrafts((previous) => ({
      ...previous,
      [row.id]: { ...(previous[row.id] ?? caseDraft(row)), ...patch },
    }))
  }

  function discardDraft(id: number) {
    setDrafts((previous) => {
      const next = { ...previous }
      delete next[id]
      return next
    })
  }

  function replaceRow(row: Case, message: string) {
    setRows((previous) => previous.map((item) => (item.id === row.id ? row : item)))
    discardDraft(row.id)
    setNotice(message)
  }

  async function save(row: Case) {
    const draft = drafts[row.id]
    if (
      !draft ||
      saving ||
      !row.canHandle ||
      caseDraftError(row, draft) ||
      !caseDraftChanged(row, draft)
    )
      return
    setSaveError(undefined)
    setNotice('')
    setSaving(true)
    try {
      const { data } = await axiosClient.put<Case[]>(
        '/goods-receipt-notes/' + receiptId + '/discrepancies',
        { lines: [caseLine(row, draft)], note: draft.note.trim() },
      )
      setRows(data)
      discardDraft(row.id)
      setNotice('Đã lưu hướng xử lý ' + row.sku + '.')
    } catch (failure) {
      setSaveError({ id: row.id, message: errorMessage(failure) })
    } finally {
      setSaving(false)
    }
  }

  const first = rows[0]
  const openCases = rows.filter((row) => row.status !== 'CLOSED').length
  const waitingExcess = excess.filter(
    (line) => line.excessDecision === 'AWAITING_OWNER',
  ).length
  const status = receiptHandlingStatus({
    openCases,
    waitingExcess,
    handlingComplete: excessLoaded ? openCases === 0 && waitingExcess === 0 : null,
  })
  return (
    <>
      <header className="sd-head">
        <div>
          <h1>Xử lý sai lệch nhà cung cấp</h1>
          <p className="sd-meta">
            <span>
              Phiếu nhập <b>{documentCode('PN', Number(receiptId))}</b>
            </span>
            {first?.purchaseOrderId && (
              <span>
                Đơn nhập{' '}
                <Link to={'/purchase-orders/' + first.purchaseOrderId}>
                  {documentCode('DNH', first.purchaseOrderId)}
                </Link>
              </span>
            )}
            {first?.supplierName && (
              <span>
                Nhà cung cấp <b>{first.supplierName}</b>
              </span>
            )}
            {first?.storeName && (
              <span>
                Kho <b>{first.storeName}</b>
              </span>
            )}
            {first?.deliveryDate && (
              <span>
                Giao ngày <b>{formatDate(first.deliveryDate)}</b>
              </span>
            )}
            {!loading && (rows.length > 0 || excess.length > 0 || !excessLoaded) && (
              <span>
                Tình trạng phiếu{' '}
                <b className={status.done ? 'sd-receipt-done' : 'sd-receipt-open'}>
                  {status.text}
                </b>
              </span>
            )}
          </p>
        </div>
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
          {rows.map((row) => {
            const draft = drafts[row.id]
            return (
              <CaseCard
                key={row.id}
                row={row}
                draft={draft ?? caseDraft(row)}
                saveError={saveError?.id === row.id ? saveError.message : ''}
                dirty={!!draft && caseDraftChanged(row, draft)}
                saving={saving}
                onDraft={(patch) => patchDraft(row, patch)}
                onSave={() => void save(row)}
                onUndo={() => discardDraft(row.id)}
                onAction={(mode) => setAction({ row, mode })}
                onAcceptance={(mode) => setAcceptance({ row, mode })}
              />
            )
          })}
        </section>
      )}

      {!loading && excess.length > 0 && (
        <section className="sd-panel sd-excess" aria-label="Hàng thừa của phiếu nhập">
          <header className="sd-excess-head">
            <h2>Hàng thừa</h2>
            {waitingExcess > 0 && user?.role === 'OWNER' && (
              <Link className="mf-btn mf-btn--primary mf-btn--sm" to="/goods-receipt-notes/excess">
                Quyết định hàng thừa
              </Link>
            )}
          </header>
          <table className="stock-table">
            <thead>
              <tr>
                <th>Phụ tùng</th>
                <th>Số thừa</th>
                <th>Hướng xử lý</th>
              </tr>
            </thead>
            <tbody>
              {excess.map((line) => (
                <tr key={line.id}>
                  <td>
                    {line.sku} · {line.partName}
                  </td>
                  <td>{line.excessQty}</td>
                  <td>{excessDecisionLabels[line.excessDecision] ?? '—'}</td>
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
