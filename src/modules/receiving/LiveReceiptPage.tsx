import PageBackLink from '../../shared/ui/PageBackLink'
import { useEffect, useState, type FormEvent } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import axiosClient from '../../shared/api/axiosClient'
import { useAuth } from '../../shared/hooks/useAuth'
import { apiMessage } from '../suppliers/supplierService'
import ReceiptActionDialog from './ReceiptActionDialog'
import ConfirmDialog from '../../shared/ui/ConfirmDialog'
import {
  inspectionCountFields,
  inspectionResult,
  inspectionResultFields,
} from './receivingRules'
import ReceiptDocuments, { type ReceiptDocument } from './ReceiptDocuments'
import { documentCode } from '../../shared/utils/documentCode'
import './receiving.css'

type Line = {
  id: number
  productId: number
  sku: string
  partName: string
  binLocation: string | null
  expectedQty: number | null
  documentQty: number
  deliveredQty: number
  passedQty: number
  wrongItemQty: number
  damagedQty: number
  shortQty: number
  toStockQty: number
  excessQty: number
  excessDecision: string
  manufacturerLotNo: string | null
  manufactureDate: string | null
  expiryDate: string | null
}

type Receipt = {
  id: number
  replacement: boolean
  purchaseOrderId: number
  deliveryDocumentNo: string
  arrivedAt: string
  recordedById: number | null
  documentQuantitiesSaved: boolean
  supplierName: string
  storeName: string
  status: string
  recountReason: string | null
  canRecord: boolean
  canConfirm: boolean
  canReturnForRecount: boolean
  canDecideExcess: boolean
  assignee: { fullName: string } | null
  lines: Line[]
  documents: ReceiptDocument[]
}

type CountField = (typeof inspectionCountFields)[number][0]
type Counts = Record<number, Partial<Record<CountField, string>>>
type Screen = 'inspection' | 'confirmation' | 'excess'

export default function LiveReceiptPage({
  id,
  screen,
}: {
  id?: string
  screen?: Screen
}) {
  const { user } = useAuth()
  const [receipt, setReceipt] = useState<Receipt>()
  const [error, setError] = useState('')
  const [version, setVersion] = useState(0)
  const validId = /^[1-9]\d*$/.test(id ?? '')
  const back =
    user?.role !== 'STAFF' && receipt
      ? '/purchase-orders/' + receipt.purchaseOrderId
      : '/purchase-orders'

  useEffect(() => {
    if (!validId) return
    const controller = new AbortController()
    const signal = controller.signal
    void axiosClient
      .get<Receipt>('/goods-receipt-notes/' + id, { signal })
      .then(({ data }) => {
        if (!signal.aborted) setReceipt(data)
      })
      .catch((error) => {
        if (!signal.aborted) setError(apiMessage(error))
      })
    return () => controller.abort()
  }, [id, validId, version])

  return (
    <main className="dashboard-content receiving-page">
      <PageBackLink to={back} />
      <header className="receiving-heading">
        <h1>
          {user?.role === 'STAFF' && receipt?.canRecord
            ? `Kiểm nhận phiếu ${documentCode('PN', id)} (của ${documentCode('DNH', receipt.purchaseOrderId)})`
            : `Phiếu nhập ${id ? documentCode('PN', id) : ''}`}
        </h1>
      </header>
      {!validId || error ? (
        <p role="alert">{error || 'Không tìm thấy phiếu.'}</p>
      ) : receipt ? (
        <ReceiptForm
          key={version}
          receipt={receipt}
          back={back}
          screen={
            screen ??
            (receipt.canDecideExcess
              ? 'excess'
              : receipt.canConfirm || receipt.canReturnForRecount
                ? 'confirmation'
                : 'inspection')
          }
          onAssigned={() => setVersion((value) => value + 1)}
        />
      ) : (
        <p role="status">Đang tải phiếu nhập…</p>
      )}
    </main>
  )
}

function ReceiptForm({
  receipt,
  back,
  screen,
  onAssigned,
}: {
  receipt: Receipt
  back: string
  screen: Screen
  onAssigned: () => void
}) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  // Góp ý cô Hoài: BM lập phiếu nhập xong thì giao ngay cho nhân viên kiểm nhận, không phải quay lại tìm phiếu.
  const [assignment, setAssignment] = useState(
    () =>
      !!(location.state as { assignNow?: boolean } | null)?.assignNow &&
      user?.role === 'BRANCH_MANAGER' &&
      ['AWAITING_INSPECTION', 'AWAITING_RECOUNT'].includes(receipt.status) &&
      !receipt.assignee,
  )
  function closeAssignment() {
    setAssignment(false)
    if ((location.state as { assignNow?: boolean } | null)?.assignNow)
      navigate(location.pathname + location.search, {
        replace: true,
        state: null,
      })
  }
  const [counts, setCounts] = useState<Counts>({})
  const [arrivedAt, setArrivedAt] = useState(
    receipt.arrivedAt?.slice(0, 16) ?? '',
  )
  const [onlyUnchecked, setOnlyUnchecked] = useState(false)
  const [focusedLine, setFocusedLine] = useState<number>()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [recountOpen, setRecountOpen] = useState(false)
  const editing =
    screen === 'inspection' && receipt.canRecord && receipt.lines.length > 0
  const hasDocumentQuantities =
    receipt.documentQuantitiesSaved || receipt.recordedById != null
  const reviewing = screen === 'excess' && receipt.canDecideExcess
  const confirming = screen === 'confirmation' && receipt.canConfirm
  const recounting = screen === 'confirmation' && receipt.canReturnForRecount
  const showRecount = recounting && recountOpen
  const assignable =
    user?.role === 'BRANCH_MANAGER' &&
    ['AWAITING_INSPECTION', 'AWAITING_RECOUNT'].includes(receipt.status)
  const rows = reviewing
    ? receipt.lines.filter((line) => line.excessDecision === 'AWAITING_OWNER')
    : receipt.lines

  function countValue(line: Line, field: CountField) {
    if (field === 'documentQty' && hasDocumentQuantities)
      return String(line.documentQty)
    return (
      counts[line.id]?.[field] ??
      (receipt.recordedById != null
        ? String(line[field])
        : field === 'wrongItemQty' || field === 'damagedQty'
          ? '0'
          : '')
    )
  }

  function resultFor(line: Line) {
    return inspectionResult(
      inspectionCountFields.map(([field]) => countValue(line, field)),
      line.expectedQty ?? 0,
    )
  }

  const inspectionTotals = editing
    ? rows.reduce(
        (totals, line) => {
          const result = resultFor(line)
          if (result) {
            totals.checked++
            totals.short += result.shortQty
            totals.excess += result.excessQty
            totals.damaged += result.damagedQty
          }
          return totals
        },
        { checked: 0, short: 0, excess: 0, damaged: 0 },
      )
    : null

  async function submit(event: FormEvent<HTMLFormElement>) {
    if (event.target !== event.currentTarget) return
    event.preventDefault()
    if (saving || !(editing || reviewing || confirming || recounting)) return
    const fields = new FormData(event.currentTarget)
    const submitter = (event.nativeEvent as SubmitEvent).submitter
    const recount =
      submitter instanceof HTMLButtonElement && submitter.value === 'recount'
    if (
      recount
        ? !showRecount
        : !(editing || reviewing || (confirming && !showRecount))
    )
      return
    if (confirming && !recount) {
      setConfirmOpen(true)
      return
    }
    const reason = String(fields.get('reason') ?? '').trim()
    if (inspectionTotals && inspectionTotals.checked !== receipt.lines.length) {
      setError(
        'Nhập đủ số lượng cho từng phụ tùng. Tổng giao sai và hư hỏng không được vượt số thực giao.',
      )
      return
    }
    if (recount && !reason) {
      setError('Nhập lý do trả về kiểm lại.')
      return
    }
    setError('')
    setSaving(true)
    try {
      const path = '/goods-receipt-notes/' + receipt.id
      if (editing) {
        await axiosClient.post(path + '/result', {
          lines: receipt.lines.map((line) => ({
            lineId: line.id,
            ...Object.fromEntries(
              inspectionCountFields.map(([field]) => [
                field,
                Number(countValue(line, field)),
              ]),
            ),
            manufacturerLotNo: line.manufacturerLotNo,
            manufactureDate: line.manufactureDate,
            expiryDate: line.expiryDate,
          })),
          arrivedAt: arrivedAt || null,
        })
      } else if (reviewing) {
        await axiosClient.post(path + '/excess-decision', {
          lines: rows.map((line) => ({
            lineId: line.id,
            decision: fields.get('decision' + line.id),
          })),
        })
      } else if (recount) {
        await axiosClient.post(path + '/recount', { reason })
      } else {
        await axiosClient.post(path + '/confirm')
      }
      navigate(back)
    } catch (error) {
      setError(apiMessage(error))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      className={`receiving-stack${editing ? ' receiving-staff-inspection' : ''}`}
      onSubmit={submit}
    >
      <section className="receiving-panel">
        <header className="receiving-panel-head">
          <h2>
            {editing
              ? 'Chứng từ giao hàng'
              : `Chứng từ giao hàng · ${receipt.deliveryDocumentNo}`}
          </h2>
          {assignable && (
            <button
              type="button"
              className="receiving-layout-primary"
              onClick={() => setAssignment(true)}
            >
              {receipt.assignee ? 'Đổi người kiểm nhận' : 'Giao việc'}
            </button>
          )}
        </header>
        <dl
          className={`receiving-info${editing ? ' receiving-staff-receipt-info' : ''}`}
        >
          {editing && (
            <div>
              <dt>Số chứng từ</dt>
              <dd>{receipt.deliveryDocumentNo}</dd>
            </div>
          )}
          <div>
            <dt>Nhà cung cấp</dt>
            <dd>{receipt.supplierName}</dd>
          </div>
          {!editing && (
            <>
              <div>
                <dt>Mã đơn nhập hàng</dt>
                <dd>{documentCode('DNH', receipt.purchaseOrderId)}</dd>
              </div>
              <div>
                <dt>Kho nhận</dt>
                <dd>{receipt.storeName}</dd>
              </div>
              <div>
                <dt>Người kiểm nhận</dt>
                <dd>{receipt.assignee?.fullName ?? '—'}</dd>
              </div>
            </>
          )}
        </dl>
        {editing && (
          <div className="receiving-layout-fields receiving-staff-controls">
            <div className="receiving-arrival-control">
              <label>
                <span>
                  Thời điểm hàng đến <b aria-hidden="true">*</b>
                </span>
                <input
                  type="datetime-local"
                  required={editing}
                  value={arrivedAt}
                  onChange={(event) => setArrivedAt(event.target.value)}
                />
              </label>
              <button
                type="button"
                onClick={() => {
                  const now = new Intl.DateTimeFormat('sv-SE', {
                    timeZone: 'Asia/Ho_Chi_Minh',
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  }).format(new Date())
                  setArrivedAt(now.replace(' ', 'T'))
                }}
              >
                Bây giờ
              </button>
            </div>
          </div>
        )}
        {receipt.recountReason && (
          <p>Yêu cầu kiểm lại: {receipt.recountReason}</p>
        )}
        {editing ? (
          <div className="receiving-staff-files-block">
            <strong>Ảnh chứng từ</strong>
            {receipt.documents?.length ? (
              <ul className="receiving-document-list receiving-staff-files">
                {receipt.documents.map((file) => (
                  <li key={file.id}>
                    <span
                      className="receiving-staff-file-icon"
                      aria-hidden="true"
                    >
                      ▧
                    </span>
                    {file.downloadUrl ? (
                      <a
                        href={file.downloadUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {file.fileName}
                      </a>
                    ) : (
                      file.fileName
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <span className="receiving-staff-no-file">
                Chưa có ảnh chứng từ đính kèm.
              </span>
            )}
          </div>
        ) : (
          <ReceiptDocuments
            receiptId={receipt.id}
            documents={receipt.documents}
          />
        )}
      </section>
      {editing && (
        <section
          className="receiving-panel receiving-staff-delivery-type"
          aria-label="Loại phiếu nhập"
        >
          <header className="receiving-panel-head">
            <h2>Loại phiếu nhập</h2>
          </header>
          <div className="receiving-staff-type-options">
            <label className={!receipt.replacement ? 'is-selected' : ''}>
              <input type="radio" checked={!receipt.replacement} readOnly />
              Giao theo đơn nhập hàng
            </label>
            <label className={receipt.replacement ? 'is-selected' : ''}>
              <input type="radio" checked={receipt.replacement} readOnly />
              Giao bù cho sai lệch
            </label>
          </div>
        </section>
      )}
      <section className="receiving-panel">
        <header className="receiving-panel-head">
          <h2>
            {screen === 'excess'
              ? 'Các dòng hàng nhận thừa'
              : editing
                ? 'Kiểm từng phụ tùng'
                : 'Kết quả kiểm nhận theo phụ tùng'}
          </h2>
          {editing && (
            <label className="receiving-inline">
              <input
                type="checkbox"
                checked={onlyUnchecked}
                onChange={(event) => setOnlyUnchecked(event.target.checked)}
              />{' '}
              Chỉ phụ tùng chưa kiểm
            </label>
          )}
        </header>
        {!rows.length && <p>Phiếu này chưa có dòng phụ tùng để xử lý.</p>}
        {editing && !hasDocumentQuantities && (
          <p>
            Phiếu cũ chưa lưu số lượng theo chứng từ. Nhập số này một lần để
            kiểm nhận.
          </p>
        )}
        {editing &&
          onlyUnchecked &&
          inspectionTotals?.checked === rows.length &&
          focusedLine === undefined && <p>Đã kiểm hết các dòng.</p>}
        <div
          className={`table-scroll${editing ? ' receiving-staff-table-scroll' : ''}`}
        >
          <table>
            <thead>
              <tr>
                <th>Phụ tùng</th>
                {!editing && (
                  <>
                    <th>Vị trí (khu – kệ)</th>
                    <th>Cần nhận</th>
                  </>
                )}
                {[...inspectionCountFields, ...inspectionResultFields].map(
                  ([field, label]) => <th key={field}>{label}</th>,
                )}
                {editing && <th>Đạt đủ</th>}
                {reviewing && <th>Quyết định</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((line) => {
                const result = editing ? resultFor(line) : line
                const document = countValue(line, 'documentQty')
                const canFill =
                  editing && inspectionResult([document, document, '0', '0'], 0)
                return (
                  <tr
                    key={line.id}
                    hidden={
                      editing &&
                      onlyUnchecked &&
                      result !== null &&
                      focusedLine !== line.id
                    }
                    className={
                      editing && focusedLine === line.id
                        ? 'receiving-focused-line'
                        : undefined
                    }
                    onFocus={
                      editing ? () => setFocusedLine(line.id) : undefined
                    }
                    onBlur={
                      editing
                        ? (event) => {
                            if (
                              !event.currentTarget.contains(event.relatedTarget)
                            )
                              setFocusedLine(undefined)
                          }
                        : undefined
                    }
                  >
                    <td>
                      {line.partName}
                      <small>
                        {line.sku}
                        {editing && line.binLocation
                          ? ` · kệ ${line.binLocation}`
                          : ''}
                      </small>
                    </td>
                    {!editing && <td>{line.binLocation ?? '—'}</td>}
                    {!editing && <td>{line.expectedQty ?? '—'}</td>}
                    {inspectionCountFields.map(([field, label]) => (
                      <td key={field}>
                        {editing &&
                        (field !== 'documentQty' || !hasDocumentQuantities) ? (
                          <input
                            type="number"
                            min={0}
                            max={1_000_000}
                            required
                            aria-label={`${label} ${line.sku}`}
                            value={countValue(line, field)}
                            onChange={(event) => {
                              const value = event.target.value
                              setCounts((previous) => ({
                                ...previous,
                                [line.id]: {
                                  ...previous[line.id],
                                  [field]: value,
                                },
                              }))
                            }}
                          />
                        ) : (
                          line[field]
                        )}
                      </td>
                    ))}
                    {inspectionResultFields.map(([field]) => (
                      <td key={field}>{result?.[field] ?? '—'}</td>
                    ))}
                    {editing && (
                      <td>
                        <input
                          aria-label={'Đạt đủ ' + line.sku}
                          type="checkbox"
                          disabled={!canFill}
                          checked={
                            result !== null &&
                            result.documentQty === result.deliveredQty &&
                            result.wrongItemQty === 0 &&
                            result.damagedQty === 0
                          }
                          onChange={(event) => {
                            const full = event.target.checked
                            setCounts((previous) => ({
                              ...previous,
                              [line.id]: {
                                ...previous[line.id],
                                deliveredQty: full ? document : '',
                                wrongItemQty: '0',
                                damagedQty: '0',
                              },
                            }))
                          }}
                        />
                      </td>
                    )}
                    {reviewing && (
                      <td>
                        <select
                          name={'decision' + line.id}
                          aria-label={'Quyết định ' + line.sku}
                          required
                          defaultValue=""
                        >
                          <option value="">Chọn quyết định</option>
                          <option value="ACCEPTED">Chấp nhận</option>
                          <option value="REJECTED">Từ chối</option>
                        </select>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
      {showRecount && (
        <section className="receiving-panel">
          <h2>Trả về kiểm lại</h2>
          <div className="receiving-layout-fields">
            <label>
              Lý do kiểm lại
              <textarea
                name="reason"
                autoFocus
                required
                disabled={saving}
                maxLength={255}
                rows={2}
              />
            </label>
          </div>
        </section>
      )}
      {error && <p role="alert">{error}</p>}
      {(editing || recounting || reviewing || confirming) && (
        <div
          className={`receiving-layout-actions${editing ? ' receiving-staff-footer' : ''}`}
        >
          {inspectionTotals && (
            <>
              <label className="receiving-inline receiving-staff-attestation">
                <input type="checkbox" required /> Tôi đã kiểm đếm thực tế và
                chịu trách nhiệm về kết quả này
              </label>
              <p className="receiving-staff-summary">
                Đã kiểm{' '}
                <b>{inspectionTotals.checked}/{receipt.lines.length}</b>{' '}
                · thiếu <b>{inspectionTotals.short}</b>{' '}
                · thừa <b>{inspectionTotals.excess}</b>{' '}
                · hư hỏng <b>{inspectionTotals.damaged}</b>
                . {arrivedAt ? '' : 'Chọn thời điểm hàng đến.'}
              </p>
            </>
          )}
          {recounting &&
            (showRecount ? (
              <>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => {
                    setRecountOpen(false)
                    setError('')
                  }}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  value="recount"
                  className="receiving-layout-primary"
                  disabled={saving}
                >
                  {saving ? 'Đang lưu…' : 'Gửi yêu cầu kiểm lại'}
                </button>
              </>
            ) : (
              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  setRecountOpen(true)
                  setError('')
                }}
              >
                Trả về kiểm lại
              </button>
            ))}
          {(editing || reviewing || (confirming && !showRecount)) && (
            <button
              type="submit"
              className="receiving-layout-primary"
              disabled={saving}
            >
              {saving
                ? 'Đang lưu…'
                : editing
                  ? 'Gửi kết quả'
                  : reviewing
                    ? 'Lưu quyết định'
                    : 'Xác nhận phiếu nhập'}
            </button>
          )}
        </div>
      )}
      {assignment && (
        <ReceiptActionDialog
          receiptId={receipt.id}
          documentNo={receipt.deliveryDocumentNo}
          mode="assign"
          onClose={closeAssignment}
          onSaved={() => {
            closeAssignment()
            onAssigned()
          }}
        />
      )}
      {confirmOpen && (
        <ConfirmDialog
          title="Xác nhận phiếu nhập?"
          message="Hàng đạt sẽ được ghi nhận vào tồn kho. Phần hàng thừa chờ chủ cửa hàng quyết định."
          onCancel={() => setConfirmOpen(false)}
          onConfirm={async () => {
            if (saving) return
            setSaving(true)
            setError('')
            try {
              await axiosClient.post(
                '/goods-receipt-notes/' + receipt.id + '/confirm',
              )
              navigate(back)
            } catch (error) {
              setError(apiMessage(error))
              setConfirmOpen(false)
            } finally {
              setSaving(false)
            }
          }}
        />
      )}
    </form>
  )
}

export function GoodsReceiptPage() {
  const { id } = useParams()
  return <LiveReceiptPage key={id} id={id} />
}
