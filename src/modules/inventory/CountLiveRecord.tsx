import PageBackLink from '../../shared/ui/PageBackLink'
import { useRef, useState } from 'react'
import { isAxiosError } from 'axios'
import { useParams } from 'react-router-dom'
import { useInventoryData, useInventoryScope, inventoryError } from './api'
import { InventoryHeader, InventoryPanel, InventoryNotice } from './components'
import { countFromDto, type CountDto } from './countApi'
import type { Assignment } from './countAssignment'
import { validCountQuantity } from './stockCountModel'
import { mapCountSheet, readCountFile } from './countImport'
import { today } from './presentation'
import axiosClient from '../../shared/api/axiosClient'
import { refreshNotifications } from '../notifications/notificationService'
import './stock-count.css'
export default function CountLiveRecord() {
  const { id } = useParams(),
    scope = useInventoryScope(),
    [revision, setRevision] = useState(0),
    r = useInventoryData<CountDto>('/stock-counts/' + id, {}, revision, !!id)
  return (
    <main className="inventory-workspace count-workspace">
      <PageBackLink to={'/stock-counts/' + id} />
      <InventoryHeader title="Ghi số đếm" />
      <InventoryNotice loading={r.loading} error={r.error} />
      {r.data && (
        <Editor
          key={id + ':' + revision}
          data={r.data}
          manager={scope.user?.role === 'BRANCH_MANAGER'}
          userId={scope.user?.id}
          onSaved={() => setRevision((n) => n + 1)}
        />
      )}
    </main>
  )
}
function Editor({
  data,
  manager,
  userId,
  onSaved,
}: {
  data: CountDto
  manager: boolean
  userId?: number
  onSaved: () => void
}) {
  const rows = data.lines.some((l) => l.recountRequested)
    ? data.lines.filter((l) => l.recountRequested)
    : data.lines
  const [values, setValues] = useState<Record<number, string>>(() =>
      Object.fromEntries(
        rows.map((l) => [
          l.id,
          l.countedQty == null ? '' : String(l.countedQty),
        ]),
      ),
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [confirmed, setConfirmed] = useState(false),
    [sent, setSent] = useState(false),
    [blocked, setBlocked] = useState(false),
    [importing, setImporting] = useState(false),
    lock = useRef(false)
  const assignment = useInventoryData<
    Assignment & {
      current: {
        assigneeId: number
        assigneeName: string
        status: string
      } | null
    }
  >(
    '/warehouse-tasks',
    { taskType: 'COUNTING', documentId: data.id },
    0,
    manager,
  )
  const allowed = !manager || assignment.data?.current?.assigneeId === userId,
    alreadySent =
      sent || assignment.data?.current?.status === 'RESULT_SUBMITTED',
    needsStart = data.status === 'DRAFT' || data.awaitingBookQuantities,
    editable =
      data.status === 'COUNTING' &&
      !needsStart &&
      allowed &&
      !alreadySent &&
      !blocked,
    valid =
      rows.length > 0 &&
      rows.every((l) => values[l.id] === '' || validCountQuantity(values[l.id]))
  async function act(action: 'start' | 'lines' | 'submit') {
    if (
      lock.current ||
      !allowed ||
      (action !== 'start' && (!editable || !valid)) ||
      (action === 'submit' && !confirmed)
    )
      return
    lock.current = true
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const body = {
        lines: rows.map((l) => ({
          lineId: l.id,
          countedQty: values[l.id] === '' ? null : Number(values[l.id]),
        })),
      }
      if (action === 'lines')
        await axiosClient.put(`/stock-counts/${data.id}/lines`, body)
      else
        await axiosClient.post(
          `/stock-counts/${data.id}/${action}`,
          action === 'submit' ? body : undefined,
        )
      if (action === 'submit') {
        setSent(true)
        refreshNotifications()
      } else if (action === 'start') onSaved()
      else setNotice('Đã lưu số đếm tạm.')
    } catch (e) {
      setError(inventoryError(e))
      if (
        isAxiosError<{ code?: string }>(e) &&
        ['MSG235', 'MSG238'].includes(e.response?.data?.code ?? '')
      )
        setBlocked(true)
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  return (
    <InventoryPanel
      title={'KK-' + String(data.id).padStart(4, '0') + ' · ' + data.storeName}
    >
      <InventoryNotice
        loading={assignment.loading}
        error={error || assignment.error}
      />
      {notice && (
        <p role="status" className="stock-notice">
          {notice}
        </p>
      )}
      {alreadySent && (
        <p className="stock-notice">
          Đã gửi kết quả. Quản lý cần yêu cầu đếm lại trước khi sửa.
        </p>
      )}
      {!allowed && (
        <p className="count-unavailable">
          Chỉ người đang được giao việc mới có thể ghi số đếm.
        </p>
      )}
      {needsStart && allowed && (
        <div className="stock-notice">
          <p>
            {data.countDate > today()
              ? 'Chưa tới ngày kiểm kê.'
              : 'Bấm bắt đầu để chốt số sổ sách. Số sổ sách không hiển thị trong màn đếm.'}
          </p>
          <button
            className="count-primary"
            disabled={busy || data.countDate > today()}
            onClick={() => void act('start')}
          >
            Bắt đầu đếm
          </button>
        </div>
      )}
      {editable && (
        <label className="stock-notice">
          Nhập số đếm từ Excel (.xlsx): cột SKU, Mã lô (ví dụ #12), Số đếm
          <input
            type="file"
            accept=".xlsx"
            disabled={busy || importing}
            onChange={async (e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (!file) return
              setImporting(true)
              setError('')
              try {
                const mapped = mapCountSheet(
                  await readCountFile(file),
                  countFromDto({ ...data, lines: rows }).lines,
                  'quantity',
                )
                setValues((v) => ({
                  ...v,
                  ...Object.fromEntries(mapped.map((l) => [l.id, l.value])),
                }))
                setConfirmed(false)
                setNotice(
                  'Đã điền ' +
                    mapped.length +
                    ' dòng từ ' +
                    file.name +
                    '. Kiểm tra trước khi gửi.',
                )
              } catch (err) {
                setError(inventoryError(err))
              } finally {
                setImporting(false)
              }
            }}
          />
        </label>
      )}
      <div className="stock-table-scroll">
        <table className="stock-table">
          <thead>
            <tr>
              <th>Phụ tùng / Lô</th>
              <th>Vị trí</th>
              <th>Số đếm thực tế</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((l) => (
              <tr key={l.id} className="count-record-row">
                <td>
                  {l.partName}
                  <small>
                    {l.sku} · {l.lotId == null ? 'Không lô' : '#' + l.lotId}
                  </small>
                  {l.recountReason && <small>Đếm lại: {l.recountReason}</small>}
                </td>
                <td>{l.binLocation ?? l.storageArea ?? '—'}</td>
                <td>
                  <input
                    aria-label={
                      'Số đếm ' + l.sku + ' lô ' + (l.lotId ?? 'không lô')
                    }
                    type="number"
                    min={0}
                    max={2147483647}
                    step={1}
                    value={values[l.id]}
                    disabled={!editable || busy || importing}
                    onChange={(e) => {
                      setValues((v) => ({ ...v, [l.id]: e.target.value }))
                      setConfirmed(false)
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editable && (
        <div className="stock-notice count-buttons">
          <p>
            Để trống nghĩa là chưa đếm; số 0 nghĩa là đã đếm và không có hàng.
          </p>
          <label>
            <input
              type="checkbox"
              checked={confirmed}
              disabled={busy || importing}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            Tôi xác nhận số đếm thực tế đã nhập.
          </label>
          <button
            disabled={busy || importing || !valid}
            onClick={() => void act('lines')}
          >
            Lưu tạm
          </button>
          <button
            className="count-primary"
            disabled={busy || importing || !valid || !confirmed}
            onClick={() => void act('submit')}
          >
            Gửi kết quả
          </button>
        </div>
      )}
    </InventoryPanel>
  )
}
