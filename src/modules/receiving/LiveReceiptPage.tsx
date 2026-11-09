import BarcodeScan from '../operations/BarcodeScan'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import axiosClient from '../../shared/api/axiosClient'
import { useAuth } from '../../shared/hooks/useAuth'
import { apiMessage } from '../suppliers/supplierService'
import ReceiptActionDialog from './ReceiptActionDialog'
import ConfirmDialog from '../../shared/ui/ConfirmDialog'
import { inspectionQuantitiesValid } from './receivingRules'

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
  documents: { id: number; fileName: string; downloadUrl: string | null }[]
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
  id: string
  screen?: Screen
}) {
  const [receipt, setReceipt] = useState<Receipt>()
  const [error, setError] = useState('')
  const [version, setVersion] = useState(0)

  useEffect(() => {
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
  }, [id, version])

  if (error) return <p role="alert">{error}</p>
  if (!receipt) return <p role="status">Đang tải phiếu nhập…</p>
  return (
    <ReceiptForm
      key={version}
      receipt={receipt}
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
  )
}

function ReceiptForm({
  receipt,
  screen,
  onAssigned,
}: {
  receipt: Receipt
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
  const [scanMessage, setScanMessage] = useState('')
  const [focusedLine, setFocusedLine] = useState<number>()
  const rowRefs = useRef(new Map<number, HTMLTableRowElement>())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const editing =
    screen === 'inspection' && receipt.canRecord && receipt.lines.length > 0
  const reviewing = screen === 'excess' && receipt.canDecideExcess
  const confirming = screen === 'confirmation' && receipt.canConfirm
  const recounting = screen === 'confirmation' && receipt.canReturnForRecount
  const assignable =
    user?.role === 'BRANCH_MANAGER' &&
    ['AWAITING_INSPECTION', 'AWAITING_RECOUNT'].includes(receipt.status)
  const back =
    user?.role === 'STAFF'
      ? '/purchase-orders'
      : '/purchase-orders/' + receipt.purchaseOrderId
  const rows = reviewing
    ? receipt.lines.filter((line) => line.excessDecision === 'AWAITING_OWNER')
    : receipt.lines

  function countValue(line: Line, field: CountField) {
    return (
      counts[line.id]?.[field] ??
      (receipt.recordedById != null ? String(line[field]) : '')
    )
  }

  function checked(line: Line) {
    return (
      countFields.every(([field]) => {
        const value = countValue(line, field)
        return (
          value !== '' &&
          Number.isInteger(Number(value)) &&
          Number(value) >= 0 &&
          Number(value) <= 1_000_000
        )
      }) &&
      Number(countValue(line, 'wrongItemQty')) +
        Number(countValue(line, 'damagedQty')) <=
        Number(countValue(line, 'deliveredQty'))
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
    if (recount ? !recounting : !(editing || reviewing || confirming)) return
    if (confirming && !recount) {
      setConfirmOpen(true)
      return
    }
    const reason = String(fields.get('reason') ?? '').trim()
    const lines = receipt.lines.map((line) => ({
      lineId: line.id,
      ...Object.fromEntries(
        countFields.map(([field]) => [
          field,
          Number(fields.get(field + line.id)),
        ]),
      ),
      manufacturerLotNo:
        String(fields.get('lot' + line.id) ?? '').trim() || null,
      manufactureDate: fields.get('manufacture' + line.id) || null,
      expiryDate: fields.get('expiry' + line.id) || null,
    }))
    if (
      editing &&
      receipt.lines.some(
        (line) =>
          !inspectionQuantitiesValid(
            countFields.map(([field]) => Number(fields.get(field + line.id))),
          ),
      )
    ) {
      setError(
        'Số giao sai và số hỏng cộng lại không được lớn hơn số thực giao.',
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
    <form className="receiving-stack" onSubmit={submit}>
      {editing && (
        <BarcodeScan
          allowInactive
          resolveLocal={(code) => {
            const l = receipt.lines.find(
              (l) =>
                l.sku.toLocaleLowerCase('vi') === code.toLocaleLowerCase('vi'),
            )
            return l
              ? {
                  productId: l.productId,
                  sku: l.sku,
                  partName: l.partName,
                  status: 'ACTIVE',
                  barcode: code,
                  availableQty: null,
                }
              : undefined
          }}
          disabled={saving}
          onFound={(p) => {
            const line = receipt.lines.find((l) => l.productId === p.productId)
            if (!line) {
              setScanMessage('Phụ tùng không thuộc phiếu nhận.')
              return
            }
            setOnlyUnchecked(false)
            setFocusedLine(line.id)
            setScanMessage('Đã tìm ' + p.partName)
            requestAnimationFrame(() => {
              const row = rowRefs.current.get(line.id)
              row?.scrollIntoView({ block: 'center' })
              row?.querySelector('input')?.focus()
            })
          }}
        />
      )}
      <section className="receiving-panel">
        <header className="receiving-panel-head">
          <h2>Chứng từ giao hàng · {receipt.deliveryDocumentNo}</h2>
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
        <dl className="receiving-info">
          <div>
            <dt>Đơn đặt hàng</dt>
            <dd>YCN-{String(receipt.purchaseOrderId).padStart(4, '0')}</dd>
          </div>
          <div>
            <dt>Nhà cung cấp</dt>
            <dd>{receipt.supplierName}</dd>
          </div>
          <div>
            <dt>Kho nhận</dt>
            <dd>{receipt.storeName}</dd>
          </div>
          <div>
            <dt>Người kiểm nhận</dt>
            <dd>{receipt.assignee?.fullName ?? '—'}</dd>
          </div>
        </dl>
        {editing && (
          <div className="receiving-layout-fields receiving-staff-controls">
            <div className="receiving-arrival-control">
              <label>
                Thời điểm hàng đến
                <input
                  type="datetime-local"
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
            {scanMessage && (
              <p className="receiving-layout-wide" role="status">
                {scanMessage}
              </p>
            )}
          </div>
        )}
        {receipt.recountReason && (
          <p>Yêu cầu kiểm lại: {receipt.recountReason}</p>
        )}
        {!!receipt.documents.length && (
          <ul>
            {receipt.documents.map((file) => (
              <li key={file.id}>
                {file.downloadUrl ? (
                  <a href={file.downloadUrl} target="_blank" rel="noreferrer">
                    {file.fileName}
                  </a>
                ) : (
                  file.fileName
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
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
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Phụ tùng</th>
                <th>Vị trí</th>
                <th>Cần nhận</th>
                {countFields.map(([field, label]) => (
                  <th key={field}>{label}</th>
                ))}
                <th>Đạt</th>
                <th>Thiếu</th>
                <th>Thừa</th>
                {editing && (
                  <>
                    <th>Số lô</th>
                    <th>Ngày sản xuất</th>
                    <th>Hạn dùng</th>
                  </>
                )}
                {reviewing && <th>Quyết định</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((line) => {
                const value = {
                  documentQty: Number(countValue(line, 'documentQty')),
                  deliveredQty: Number(countValue(line, 'deliveredQty')),
                  wrongItemQty: Number(countValue(line, 'wrongItemQty')),
                  damagedQty: Number(countValue(line, 'damagedQty')),
                }
                const passed = Math.max(
                  0,
                  value.deliveredQty - value.wrongItemQty - value.damagedQty,
                )
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
                    ref={(row) => {
                      if (row) rowRefs.current.set(line.id, row)
                      else rowRefs.current.delete(line.id)
                    }}
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
                      <small>{line.sku}</small>
                    </td>
                    <td>{line.binLocation ?? '—'}</td>
                    <td>{line.expectedQty ?? '—'}</td>
                    {countFields.map(([field, label]) => (
                      <td key={field}>
                        {editing ? (
                          <input
                            type="number"
                            name={field + line.id}
                            min={0}
                            max={1000000}
                            required
                            aria-label={label + ' ' + line.sku}
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
                    <td>{editing ? passed : line.passedQty}</td>
                    <td>
                      {editing
                        ? Math.max(0, value.documentQty - value.deliveredQty)
                        : line.shortQty}
                    </td>
                    <td>
                      {editing
                        ? Math.max(
                            0,
                            passed - (line.expectedQty ?? value.documentQty),
                          )
                        : line.excessQty}
                    </td>
                    {editing && (
                      <>
                        <td>
                          <input
                            name={'lot' + line.id}
                            aria-label={'Số lô ' + line.sku}
                            defaultValue={line.manufacturerLotNo ?? ''}
                            maxLength={50}
                          />
                        </td>
                        <td>
                          <input
                            type="date"
                            name={'manufacture' + line.id}
                            aria-label={'Ngày sản xuất ' + line.sku}
                            defaultValue={line.manufactureDate ?? ''}
                          />
                        </td>
                        <td>
                          <input
                            type="date"
                            name={'expiry' + line.id}
                            aria-label={'Hạn dùng ' + line.sku}
                            defaultValue={line.expiryDate ?? ''}
                          />
                        </td>
                      </>
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
      {recounting && (
        <section className="receiving-panel">
          <h2>Trả về kiểm lại</h2>
          <div className="receiving-layout-fields">
            <label>
              Lý do kiểm lại <textarea name="reason" maxLength={255} rows={2} />
            </label>
          </div>
        </section>
      )}
      {error && <p role="alert">{error}</p>}
      <div className="receiving-layout-actions">
        <Link to={back}>Quay lại</Link>
        {editing && (
          <label className="receiving-inline">
            <input type="checkbox" required /> Tôi đã kiểm đếm thực tế và chịu
            trách nhiệm về kết quả này
          </label>
        )}
        {recounting && (
          <button type="submit" value="recount" disabled={saving}>
            Trả về kiểm lại
          </button>
        )}
        {(editing || reviewing || confirming) && (
          <button
            type="submit"
            className="receiving-layout-primary"
            disabled={saving}
          >
            {saving
              ? 'Đang lưu…'
              : editing
                ? 'Gửi kết quả kiểm nhận'
                : reviewing
                  ? 'Lưu quyết định'
                  : 'Xác nhận phiếu nhập'}
          </button>
        )}
      </div>
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
  return (
    <main className="dashboard-content receiving-page">
      <header className="receiving-heading">
        <h1>Phiếu nhập hàng {id ? '#' + id : ''}</h1>
        <Link to="/purchase-orders">Yêu cầu nhập hàng</Link>
      </header>
      {id && /^[1-9]\d*$/.test(id) ? (
        <LiveReceiptPage key={id} id={id} />
      ) : (
        <p role="alert">Không tìm thấy phiếu.</p>
      )}
    </main>
  )
}
