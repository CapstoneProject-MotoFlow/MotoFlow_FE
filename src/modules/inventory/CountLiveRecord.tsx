import PageBackLink from '../../shared/ui/PageBackLink'
import LocalizedFileInput from '../../shared/ui/LocalizedFileInput'
import { useRef, useState } from 'react'
import { isAxiosError } from 'axios'
import { useParams } from 'react-router-dom'
import { useInventoryData, useInventoryScope, inventoryError } from './api'
import { InventoryHeader, InventoryPanel, InventoryNotice } from './components'
import { countFromDto, type CountDto } from './countApi'
import type { Assignment } from './countAssignment'
import { validCountQuantity } from './stockCountModel'
import { countTemplateRows, mapCountSheet, readCountFile } from './countImport'
import { date, today } from './presentation'
import axiosClient from '../../shared/api/axiosClient'
import { createXlsx, downloadBlob } from '../../shared/utils/xlsx'
import { refreshNotifications } from '../notifications/notificationService'
import { documentCode } from '../../shared/utils/documentCode'
import ProductPicker, { type ProductOption } from '../receiving/ProductPicker'
import './stock-count.css'
import CountLineTags from './CountLineTags'
import ProductQuickView from '../catalog/components/ProductQuickView'

function normalizeQuantityInput(value: string) {
  if (value === '') return ''
  if (!/^\d+$/.test(value)) return null
  return value.replace(/^0+(?=\d)/, '')
}

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
      {r.data && (r.data.countType === 'OPENING' ? (
        scope.user?.role === 'STAFF' ? (
          <OpeningEditor
            key={id + ':' + revision}
            data={r.data}
            onSaved={() => setRevision((n) => n + 1)}
          />
        ) : (
          <p className="count-unavailable">
            Nhân viên được giao sẽ ghi số đếm đầu kỳ. Vui lòng quay lại phiếu để giao việc hoặc xác minh kết quả.
          </p>
        )
      ) : (
        <Editor
          key={id + ':' + revision}
          data={r.data}
          manager={scope.user?.role === 'BRANCH_MANAGER'}
          userId={scope.user?.id}
          onSaved={() => setRevision((n) => n + 1)}
        />
      ))}
    </main>
  )
}

type OpeningLine = {
  key: string
  product: ProductOption
  expiryDate: string
  countedQty: string
  damagedQty: string
}

function OpeningEditor({
  data,
  onSaved,
}: {
  data: CountDto
  onSaved: () => void
}) {
  const [rows, setRows] = useState<OpeningLine[]>(() => data.lines.map((line) => ({
    key: String(line.id),
    product: { id: line.productId, sku: line.sku, partName: line.partName },
    expiryDate: line.expiryDate ?? '',
    countedQty: line.countedQty == null ? '' : String(line.countedQty),
    damagedQty: String(line.damagedQty ?? 0),
  })))
  const nextRowKey = useRef(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const lock = useRef(false)
  const editable = data.status === 'COUNTING' && !data.awaitingBookQuantities
  const valid = rows.length > 0 && rows.every((row, index) => {
    const quantity = Number(row.countedQty)
    const damaged = Number(row.damagedQty)
    return /^\d+$/.test(row.countedQty) && Number.isSafeInteger(quantity) && quantity >= 0 &&
      /^\d+$/.test(row.damagedQty) && Number.isSafeInteger(damaged) && damaged <= quantity &&
      !rows.slice(0, index).some((other) => other.product.id === row.product.id && other.expiryDate === row.expiryDate)
  })

  async function act(action: 'start' | 'save' | 'submit') {
    if (lock.current || (action !== 'start' && (!editable || !valid)) || (action === 'submit' && !confirmed)) return
    lock.current = true
    setBusy(true)
    setError('')
    setNotice('')
    try {
      if (action === 'start') {
        await axiosClient.post(`/stock-counts/${data.id}/start`)
        onSaved()
        return
      }
      await axiosClient.put(`/stock-counts/${data.id}/opening-lines`, {
        lines: rows.map((row) => ({
          productId: row.product.id,
          expiryDate: row.expiryDate || null,
          countedQty: Number(row.countedQty),
          damagedQty: Number(row.damagedQty),
        })),
      })
      if (action === 'submit') {
        await axiosClient.post(`/stock-counts/${data.id}/submit`)
        setNotice('Đã gửi số đếm đầu kỳ cho quản lý xác nhận.')
        refreshNotifications()
      } else {
        setNotice('Đã lưu số đếm đầu kỳ.')
      }
      onSaved()
    } catch (failure) {
      setError(inventoryError(failure))
    } finally {
      lock.current = false
      setBusy(false)
    }
  }

  return <InventoryPanel title={documentCode('KK', data.id) + ' · ' + data.storeName}>
    <InventoryNotice error={error} />
    {notice && <p className="stock-notice" role="status">{notice}</p>}
    {(data.status === 'DRAFT' || data.awaitingBookQuantities) && <div className="stock-notice">
      <p>Kiểm kê đầu kỳ không có số sổ sách. Bắt đầu đếm để nhập số lượng thực tế và hạn sử dụng.</p>
      <button className="count-primary" disabled={busy || data.countDate > today()} onClick={() => void act('start')}>Bắt đầu đếm</button>
    </div>}
    {editable && <div className="opening-count-add">
      <ProductPicker
        excludedIds={[]}
        label="Thêm phụ tùng"
        excludeDamagedVariants
        disabled={busy}
        onSelect={(product) => {
          const key = 'new-' + ++nextRowKey.current
          setRows((previous) => [
            ...previous,
            { key, product, expiryDate: '', countedQty: '', damagedQty: '0' },
          ])
          setConfirmed(false)
        }}
      />
      <p>Mỗi dòng là một phụ tùng và hạn sử dụng. Có thể thêm nhiều lô/hạn dùng cho cùng một phụ tùng.</p>
    </div>}
    <div className="stock-table-scroll"><table className="stock-table opening-count-table">
      <thead><tr><th>Phụ tùng</th><th>Hạn sử dụng</th><th>Số đếm thực tế</th><th>Hư hỏng</th>{editable && <th />}</tr></thead>
      <tbody>{rows.map((row) => <tr key={row.key}>
        <td><strong><ProductQuickView productId={row.product.id} sku={row.product.sku} partName={row.product.partName} blindCount /></strong></td>
        <td><input aria-label={`Hạn sử dụng ${row.product.sku}`} type="date" value={row.expiryDate} disabled={!editable || busy} onChange={(event) => {setRows((items) => items.map((item) => item.key === row.key ? {...item, expiryDate: event.target.value} : item)); setConfirmed(false)}} /></td>
        <td><input aria-label={`Số đếm ${row.product.sku}`} type="number" min="0" step="1" value={row.countedQty} disabled={!editable || busy} onChange={(event) => {setRows((items) => items.map((item) => item.key === row.key ? {...item, countedQty: event.target.value} : item)); setConfirmed(false)}} /></td>
        <td><input aria-label={`Số hư hỏng ${row.product.sku}`} type="number" min="0" step="1" value={row.damagedQty} disabled={!editable || busy} onChange={(event) => {setRows((items) => items.map((item) => item.key === row.key ? {...item, damagedQty: event.target.value} : item)); setConfirmed(false)}} /></td>
        {editable && <td><button type="button" className="mf-btn mf-btn--secondary" disabled={busy} onClick={() => {setRows((items) => items.filter((item) => item.key !== row.key)); setConfirmed(false)}}>Bỏ</button></td>}
      </tr>)}{!rows.length && <tr><td colSpan={editable ? 5 : 4}>Thêm phụ tùng để bắt đầu lập tồn đầu kỳ.</td></tr>}</tbody>
    </table></div>
    {editable && <div className="stock-notice count-buttons">
      <label><input type="checkbox" checked={confirmed} disabled={busy || !valid} onChange={(event) => setConfirmed(event.target.checked)} /> Tôi xác nhận số lượng và hạn sử dụng đã nhập chính xác.</label>
      <div className="count-submit-group">
        <button disabled={busy || !valid} onClick={() => void act('save')}>Lưu tạm</button>
        <button className="count-primary" disabled={busy || !valid || !confirmed} onClick={() => void act('submit')}>Gửi quản lý xác nhận</button>
      </div>
    </div>}
  </InventoryPanel>
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
  const recountMode = rows.some((line) => line.recountRequested)
  const [values, setValues] = useState<Record<number, string>>(() =>
      Object.fromEntries(
        rows.map((l) => [
          l.id,
          l.countedQty == null ? '' : String(l.countedQty),
        ]),
      ),
    ),
    [damagedValues, setDamagedValues] = useState<Record<number, string>>(() =>
      Object.fromEntries(rows.map((line) => [line.id, String(line.damagedQty ?? 0)])),
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
      rows.every((l) => {
        const counted = values[l.id]
        const damaged = damagedValues[l.id] ?? '0'
        return (
          (counted === '' || validCountQuantity(counted)) &&
          /^\d+$/.test(damaged) &&
          Number.isSafeInteger(Number(damaged)) &&
          Number(damaged) <= (counted === '' ? 0 : Number(counted))
        )
      })
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
          damagedQty: Number(damagedValues[l.id] ?? 0),
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
      title={documentCode('KK', data.id) + ' · ' + data.storeName}
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
        <div className="stock-notice count-buttons count-excel-tools">
          <span>
            Tải mẫu để điền số đếm, sau đó chọn tệp Excel đã điền để nhập vào phiếu.
          </span>
          <button
            type="button"
            disabled={busy || importing || rows.length === 0}
            onClick={() => {
              const sheetRows = countTemplateRows(
                countFromDto({ ...data, lines: rows }).lines,
              )
              downloadBlob(
                `Mau_${documentCode('KK', data.id)}.xlsx`,
                createXlsx([{ name: 'So dem', rows: sheetRows }]),
              )
            }}
          >
            Tải mẫu Excel
          </button>
          <LocalizedFileInput
            buttonText="Chọn tệp đã điền"
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
                    ' dòng từ tệp Excel. Kiểm tra trước khi gửi.',
                )
              } catch (err) {
                setError(inventoryError(err))
              } finally {
                setImporting(false)
              }
            }}
          />
        </div>
      )}
      <div className="stock-table-scroll">
        <table className="stock-table count-record-table">
          <thead>
            <tr>
              <th>Phụ tùng / Lô</th>
              <th>Vị trí (khu – kệ)</th>
              {recountMode && <th>Lý do đếm lại</th>}
              <th>Số đếm thực tế</th>
              <th>Hư hỏng</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((l) => (
              <tr key={l.id} className="count-record-row">
                <td className="count-cell-name">
                  <ProductQuickView
                    productId={l.productId}
                    sku={l.sku}
                    partName={l.partName}
                    blindCount
                    extraFacts={
                      l.lotId != null
                        ? [
                            ['Lô', documentCode('L', l.lotId)],
                            ['Hạn sử dụng', l.expiryDate ? date(l.expiryDate) : 'Không có'],
                          ]
                        : undefined
                    }
                  />
                  {l.lotId != null && (
                    <small className="count-line-lot-code">
                      Lô {documentCode('L', l.lotId)}
                    </small>
                  )}
                  <CountLineTags line={l} blind />
                </td>
                <td className="count-cell-meta" data-label="Vị trí (khu – kệ)">{l.binLocation ?? l.storageArea ?? '—'}</td>
                {recountMode && (
                  <td className="count-cell-meta" data-label="Lý do đếm lại">
                    {l.recountReason ? (
                      <span className="count-reason-badge">{l.recountReason}</span>
                    ) : '—'}
                  </td>
                )}
                <td className="count-cell-qty" data-label="Số đếm thực tế">
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
                      const quantity = normalizeQuantityInput(e.target.value)
                      if (quantity === null) return
                      setValues((v) => ({
                        ...v,
                        [l.id]: quantity,
                      }))
                      setConfirmed(false)
                    }}
                  />
                </td>
                <td className="count-cell-qty" data-label="Hư hỏng">
                  <input
                    aria-label={'Số hư hỏng ' + l.sku + ' lô ' + (l.lotId ?? 'không lô')}
                    type="number"
                    min={0}
                    max={values[l.id] === '' ? 0 : Number(values[l.id]) || 0}
                    step={1}
                    value={damagedValues[l.id] ?? '0'}
                    disabled={!editable || busy || importing}
                    onChange={(e) => {
                      const quantity = normalizeQuantityInput(e.target.value)
                      if (quantity === null) return
                      setDamagedValues((v) => ({
                        ...v,
                        [l.id]: quantity,
                      }))
                      setConfirmed(false)
                    }}
                  />
                  {Number(damagedValues[l.id] ?? 0) >
                    (values[l.id] === '' ? 0 : Number(values[l.id])) && (
                      <small className="count-validation-error" role="alert">
                        Hư hỏng không được lớn hơn số đếm.
                      </small>
                    )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editable && (
        <div className="stock-notice count-buttons count-record-actions">
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
          <div className="count-submit-group">
            <button
              disabled={busy || importing || !valid}
              onClick={() => void act('lines')}
            >
              Lưu tạm
            </button>
            <button
              className="count-primary"
              disabled={busy || importing || !valid || !confirmed}
              aria-describedby={
                valid && !confirmed ? 'count-submit-hint' : undefined
              }
              onClick={() => void act('submit')}
            >
              Gửi kết quả
            </button>
          </div>
          {valid && !confirmed && !busy && !importing && (
            <p id="count-submit-hint" className="count-submit-hint">
              Đánh dấu xác nhận số đếm để gửi.
            </p>
          )}
        </div>
      )}
    </InventoryPanel>
  )
}
