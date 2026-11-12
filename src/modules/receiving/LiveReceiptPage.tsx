import PageBackLink from '../../shared/ui/PageBackLink'
import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import axiosClient from '../../shared/api/axiosClient'
import { useAuth } from '../../shared/hooks/useAuth'
import { apiMessage } from '../suppliers/supplierService'
import ReceiptActionDialog from './ReceiptActionDialog'
import ConfirmDialog from '../../shared/ui/ConfirmDialog'
import { inspectionQuantitiesValid } from './receivingRules'
import ReceiptImage from './ReceiptImage'
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
  documents: {
    id: number
    fileName: string
    contentType: string
    downloadUrl: string | null
  }[]
}

const countFields = [
  ['documentQty', 'Chứng từ'],
  ['deliveredQty', 'Thực giao'],
  ['wrongItemQty', 'Giao sai'],
  ['damagedQty', 'Hỏng'],
] as const

type CountField = (typeof countFields)[number][0]
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
            ? `Ghi kết quả kiểm nhận YCN-${String(receipt.purchaseOrderId).padStart(4, '0')}`
            : `Phiếu nhập hàng ${id ? '#' + id : ''}`}
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
  const [assignment, setAssignment] = useState(false)
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
    return (
      counts[line.id]?.[field] ??
      (receipt.recordedById != null ? String(line[field]) : '')
    )
  }

  function passedValue(line: Line) {
    return (
      counts[line.id]?.deliveredQty ??
      (receipt.recordedById != null ? String(line.passedQty) : '')
    )
  }

  function documentValue(line: Line) {
    return (
      counts[line.id]?.documentQty ??
      String(
        receipt.recordedById != null
          ? line.documentQty
          : (line.expectedQty ?? line.documentQty),
      )
    )
  }

  function rowChecked(line: Line) {
    const passed = passedValue(line)
    const damaged = countValue(line, 'damagedQty')
    const document = documentValue(line)
    return (
      document !== '' &&
      Number.isInteger(Number(document)) &&
      Number(document) >= 0 &&
      passed !== '' &&
      damaged !== '' &&
      Number.isInteger(Number(passed)) &&
      Number.isInteger(Number(damaged)) &&
      Number(passed) >= 0 &&
      Number(damaged) >= 0 &&
      Number(passed) + Number(damaged) + line.wrongItemQty <= 1_000_000
    )
  }

  function checked(line: Line) {
    return (
      rowChecked(line) && Number(countValue(line, 'wrongItemQty') || 0) === 0
    )
  }

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
    const lines = receipt.lines.map((line) => {
      const passed = Number(fields.get('passed' + line.id))
      const damaged = Number(fields.get('damagedQty' + line.id))
      const document = Number(documentValue(line))
      const wrongItem = line.wrongItemQty
      return {
        lineId: line.id,
        documentQty: document,
        deliveredQty: passed + damaged + wrongItem,
        wrongItemQty: wrongItem,
        damagedQty: damaged,
        manufacturerLotNo:
          String(
            fields.get('lot' + line.id) ?? line.manufacturerLotNo ?? '',
          ).trim() || null,
        manufactureDate:
          fields.get('manufacture' + line.id) || line.manufactureDate || null,
        expiryDate: fields.get('expiry' + line.id) || line.expiryDate || null,
      }
    })
    if (
      editing &&
      receipt.lines.some(
        (line) =>
          !inspectionQuantitiesValid([
            Number(documentValue(line)),
            Number(fields.get('passed' + line.id)) +
              Number(fields.get('damagedQty' + line.id)) +
              line.wrongItemQty,
            line.wrongItemQty,
            Number(fields.get('damagedQty' + line.id)),
          ]),
      )
    ) {
      setError(
        'Số đạt và số hỏng phải là số nguyên hợp lệ, không vượt giới hạn.',
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
          lines,
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
                <dt>Đơn đặt hàng</dt>
                <dd>YCN-{String(receipt.purchaseOrderId).padStart(4, '0')}</dd>
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
        ) : receipt.documents?.length ? (
          <ul
            className="receiving-document-list"
            aria-label="Chứng từ đính kèm"
          >
            {receipt.documents.map((file) => (
              <li key={file.id}>
                {file.downloadUrl && file.contentType?.startsWith('image/') ? (
                  <ReceiptImage
                    key={file.downloadUrl}
                    src={file.downloadUrl}
                    name={file.fileName}
                  />
                ) : file.downloadUrl ? (
                  <a href={file.downloadUrl} target="_blank" rel="noreferrer">
                    {file.fileName}
                  </a>
                ) : (
                  file.fileName
                )}
              </li>
            ))}
          </ul>
        ) : null}
      </section>
      {editing && (
        <section
          className="receiving-panel receiving-staff-delivery-type"
          aria-label="Loại lượt giao"
        >
          <header className="receiving-panel-head">
            <h2>Loại lượt giao</h2>
          </header>
          <div className="receiving-staff-type-options">
            <label className={!receipt.replacement ? 'is-selected' : ''}>
              <input type="radio" checked={!receipt.replacement} readOnly />
              Giao theo yêu cầu
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
                ? 'Kiểm từng mặt hàng'
                : 'Kết quả kiểm nhận theo phụ tùng'}
          </h2>
          {editing && (
            <label className="receiving-inline">
              <input
                type="checkbox"
                checked={onlyUnchecked}
                onChange={(event) => setOnlyUnchecked(event.target.checked)}
              />{' '}
              Chỉ mặt hàng chưa kiểm
            </label>
          )}
        </header>
        {!rows.length && <p>Phiếu này chưa có dòng phụ tùng để xử lý.</p>}
        {editing &&
          onlyUnchecked &&
          rows.every(checked) &&
          focusedLine === undefined && <p>Đã kiểm hết các dòng.</p>}
        <div
          className={`table-scroll${editing ? ' receiving-staff-table-scroll' : ''}`}
        >
          <table>
            <thead>
              <tr>
                <th>Phụ tùng</th>
                {editing ? (
                  <>
                    <th>Số trên chứng từ</th>
                    <th>Đạt</th>
                    <th>Hư hỏng</th>
                    <th>Đạt đủ</th>
                  </>
                ) : (
                  <>
                    <th>Vị trí</th>
                    <th>Cần nhận</th>
                    {countFields.map(([field, label]) => (
                      <th key={field}>{label}</th>
                    ))}
                    <th>Đạt</th>
                    <th>Thiếu</th>
                    <th>Thừa</th>
                  </>
                )}
                {reviewing && <th>Quyết định</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((line) => {
                return (
                  <tr
                    key={line.id}
                    hidden={
                      editing &&
                      onlyUnchecked &&
                      checked(line) &&
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
                    {editing && (
                      <td className="receiving-staff-document-qty">
                        <span aria-label={'Số trên chứng từ ' + line.sku}>
                          {documentValue(line)}
                        </span>
                      </td>
                    )}
                    {editing && (
                      <td>
                        <input
                          type="number"
                          name={'passed' + line.id}
                          min={0}
                          max={1000000}
                          required
                          aria-label={'Đạt ' + line.sku}
                          value={passedValue(line)}
                          onChange={(event) =>
                            setCounts((previous) => ({
                              ...previous,
                              [line.id]: {
                                ...previous[line.id],
                                deliveredQty: event.target.value,
                              },
                            }))
                          }
                        />
                      </td>
                    )}
                    {editing && (
                      <td>
                        <input
                          type="number"
                          name={'damagedQty' + line.id}
                          min={0}
                          max={1000000}
                          required
                          aria-label={'Hư hỏng ' + line.sku}
                          value={countValue(line, 'damagedQty')}
                          onChange={(event) =>
                            setCounts((previous) => ({
                              ...previous,
                              [line.id]: {
                                ...previous[line.id],
                                damagedQty: event.target.value,
                              },
                            }))
                          }
                        />
                      </td>
                    )}
                    {editing && (
                      <td>
                        <input
                          aria-label={'Đạt đủ ' + line.sku}
                          type="checkbox"
                          checked={
                            passedValue(line) !== '' &&
                            Number(passedValue(line)) ===
                              Number(documentValue(line)) &&
                            Number(countValue(line, 'damagedQty') || 0) === 0
                          }
                          onChange={(event) =>
                            setCounts((previous) => ({
                              ...previous,
                              [line.id]: {
                                ...previous[line.id],
                                deliveredQty: event.target.checked
                                  ? documentValue(line)
                                  : '',
                                damagedQty: event.target.checked ? '0' : '',
                              },
                            }))
                          }
                        />
                      </td>
                    )}
                    {!editing && <td>{line.binLocation ?? '—'}</td>}
                    {!editing && <td>{line.expectedQty ?? '—'}</td>}
                    {!editing &&
                      countFields.map(([field]) => (
                        <td key={field}>{line[field]}</td>
                      ))}
                    {!editing && <td>{line.passedQty}</td>}
                    {!editing && <td>{line.shortQty}</td>}
                    {!editing && <td>{line.excessQty}</td>}
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
          {editing && (
            <>
              <label className="receiving-inline receiving-staff-attestation">
                <input type="checkbox" required /> Tôi đã kiểm đếm thực tế và
                chịu trách nhiệm về kết quả này
              </label>
              <p className="receiving-staff-summary">
                Đã kiểm{' '}
                <b>
                  {receipt.lines.filter(rowChecked).length}/
                  {receipt.lines.length}
                </b>{' '}
                · thiếu{' '}
                <b>
                  {receipt.lines.reduce(
                    (sum, line) =>
                      sum +
                      Math.max(
                        0,
                        Number(documentValue(line)) -
                          (Number(passedValue(line) || 0) +
                            Number(countValue(line, 'damagedQty') || 0)),
                      ),
                    0,
                  )}
                </b>{' '}
                · thừa{' '}
                <b>
                  {receipt.lines.reduce(
                    (sum, line) =>
                      sum +
                      Math.max(
                        0,
                        Number(passedValue(line) || 0) +
                          Number(countValue(line, 'damagedQty') || 0) -
                          Number(documentValue(line)),
                      ),
                    0,
                  )}
                </b>{' '}
                · hư hỏng{' '}
                <b>
                  {receipt.lines.reduce(
                    (sum, line) =>
                      sum + Number(countValue(line, 'damagedQty') || 0),
                    0,
                  )}
                </b>
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
          onClose={() => setAssignment(false)}
          onSaved={() => {
            setAssignment(false)
            onAssigned()
          }}
        />
      )}
      {confirmOpen && (
        <ConfirmDialog
          title="Xác nhận phiếu nhập hàng?"
          message="Hàng đạt sẽ được ghi nhận vào tồn kho. Phần hàng thừa chờ Owner quyết định."
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
