import { uploadAttachment } from '../../shared/api/upload'
import { useEffect, useRef, useState } from 'react'
import FormDialog from '../../shared/ui/FormDialog'
import axiosClient from '../../shared/api/axiosClient'
import { inventoryError } from '../inventory/api'
import { money } from '../inventory/presentation'
import { confirmedAllocations } from './debtRules'
import type { DebtDetail, Preview } from './types'
export default function DebtPaymentDialog({
  data,
  owner,
  stores,
  onClose,
  onSaved,
}: {
  data: DebtDetail
  owner: boolean
  stores: { id: number; storeName: string }[]
  onClose: () => void
  onSaved: () => void
}) {
  const owed = data.debts.filter((d) => d.remainingAmount > 0),
    storeIds = [...new Set(owed.map((d) => d.storeId))]
  const [store, setStore] = useState(
      String(data.storeId ?? (storeIds.length === 1 ? storeIds[0] : '')),
    ),
    [amount, setAmount] = useState(''),
    [cash, setCash] = useState(''),
    [files, setFiles] = useState<File[]>([]),
    [method, setMethod] = useState('CASH'),
    [reference, setReference] = useState(''),
    [mode, setMode] = useState('oldest'),
    [selected, setSelected] = useState<number[]>([]),
    [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [result, setResult] = useState<{
      key: string
      data?: Preview
      error?: string
    }>(),
    [retry, setRetry] = useState(0)
  const lock = useRef(false),
    rows = owed.filter((d) => !owner || d.storeId === Number(store)),
    eligible = rows.filter((d) => mode === 'oldest' || selected.includes(d.id)),
    total = eligible.reduce((n, d) => n + d.remainingAmount, 0),
    value = Number(amount),
    valid =
      Number.isSafeInteger(value) &&
      value > 0 &&
      value <= 100000000000 &&
      value <= total &&
      (!owner || !!store),
    key = JSON.stringify({
      storeId: store ? Number(store) : undefined,
      amount: value,
      receivableIds: mode === 'selected' ? selected : [],
    }),
    preview = result?.key === key ? result.data : undefined,
    loading = valid && result?.key !== key
  useEffect(() => {
    if (!valid) return
    const controller = new AbortController()
    const timer = setTimeout(() => {
      void axiosClient
        .post<Preview>(
          `/customers/${data.customerId}/debt-payments/preview`,
          JSON.parse(key),
          { signal: controller.signal },
        )
        .then((r) => {
          if (!controller.signal.aborted) setResult({ key, data: r.data })
        })
        .catch((e) => {
          if (!controller.signal.aborted)
            setResult({ key, error: inventoryError(e) })
        })
    }, 300)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [key, valid, data.customerId, retry])
  function change() {
    setConfirmed(false)
    setError('')
  }
  async function save() {
    if (
      lock.current ||
      !preview ||
      !confirmed ||
      !valid ||
      (method === 'CASH' &&
        (!Number.isSafeInteger(Number(cash || amount)) ||
          Number(cash || amount) < value ||
          Number(cash || amount) > 100000000000))
    )
      return
    lock.current = true
    setBusy(true)
    setError('')
    try {
      const evidence = []
      for (const file of files) evidence.push(await uploadAttachment(file))
      await axiosClient.post(`/customers/${data.customerId}/debt-payments`, {
        ...JSON.parse(key),
        paymentMethod: method,
        transactionReference:
          method === 'BANK_TRANSFER' ? reference.trim() : undefined,
        expectedAllocations: confirmedAllocations(preview),
        tenderedAmount: method === 'CASH' ? Number(cash || amount) : undefined,
        evidence,
      })
      onSaved()
    } catch (e) {
      setError(inventoryError(e))
      setResult(undefined)
      setConfirmed(false)
      setRetry((n) => n + 1)
    } finally {
      setBusy(false)
      lock.current = false
    }
  }
  return (
    <FormDialog
      title={'Thu nợ của ' + data.customerName}
      formId="debt-payment"
      className="rv-payment-dialog"
      submitLabel={'Ghi thu' + (value > 0 ? ' ' + money.format(value) : '')}
      submitDisabled={
        !valid ||
        !preview ||
        !confirmed ||
        loading ||
        (method === 'BANK_TRANSFER' && !reference.trim()) ||
        (method === 'CASH' &&
          (!Number.isSafeInteger(Number(cash || amount)) ||
            Number(cash || amount) < value ||
            Number(cash || amount) > 100000000000))
      }
      busy={busy}
      onClose={onClose}
    >
      <form
        id="debt-payment"
        className="rv-payment-form"
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        <fieldset disabled={busy}>
          {owner && storeIds.length > 1 && (
            <label className="rv-full">
              Cửa hàng thu nợ <span>*</span>
              <select
                required
                value={store}
                onChange={(e) => {
                  setStore(e.target.value)
                  setSelected([])
                  change()
                }}
              >
                <option value="">Chọn cửa hàng</option>
                {stores
                  .filter((s) => storeIds.includes(s.id))
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.storeName}
                    </option>
                  ))}
              </select>
            </label>
          )}
          <label>
            Số tiền thu <span>*</span>
            <div className="rv-money-input">
              <input
                required
                inputMode="numeric"
                value={amount ? value.toLocaleString('vi-VN') : ''}
                onChange={(e) => {
                  setAmount(e.target.value.replace(/\D/g, ''))
                  change()
                }}
              />
              <span>đ</span>
            </div>
          </label>
          <div>
            <span className="rv-field-label">Hình thức</span>
            <div className="rv-mode">
              {[
                ['CASH', 'Tiền mặt'],
                ['BANK_TRANSFER', 'Chuyển khoản'],
              ].map(([v, label]) => (
                <label key={v}>
                  <input
                    type="radio"
                    name="payment-method"
                    checked={method === v}
                    onChange={() => {
                      setMethod(v)
                      change()
                    }}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>
          {method === 'CASH' && (
            <label className="rv-full">
              Tiền khách đưa (đ)
              <input
                inputMode="numeric"
                placeholder={
                  value > 0
                    ? money.format(value)
                    : 'Bằng số tiền thu nếu để trống'
                }
                value={cash ? Number(cash).toLocaleString('vi-VN') : ''}
                onChange={(e) => {
                  setCash(e.target.value.replace(/\D/g, ''))
                  change()
                }}
              />
              <small>
                Tiền thối:{' '}
                {money.format(Math.max(0, Number(cash || amount) - value))}
              </small>
              {cash && Number(cash) < value && (
                <small role="alert" className="rv-overdue">
                  Tiền khách đưa phải đủ số tiền thu.
                </small>
              )}
            </label>
          )}
          {method === 'BANK_TRANSFER' && (
            <label className="rv-full">
              Mã giao dịch <span>*</span>
              <input
                required
                maxLength={100}
                value={reference}
                onChange={(e) => {
                  setReference(e.target.value)
                  change()
                }}
              />
            </label>
          )}
          <div className="rv-full">
            <span className="rv-field-label">Trừ vào</span>
            <div className="rv-mode">
              {[
                ['oldest', 'Khoản cũ nhất trước'],
                ['selected', 'Các khoản khách chỉ định'],
              ].map(([v, label]) => (
                <label key={v}>
                  <input
                    type="radio"
                    name="payment-allocation"
                    checked={mode === v}
                    onChange={() => {
                      setMode(v)
                      setSelected([])
                      change()
                    }}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>
          <div className="rv-full rv-payment-table">
            <table>
              <thead>
                <tr>
                  {mode === 'selected' && <th>Chọn</th>}
                  <th>Khoản nợ</th>
                  <th>Hạn trả</th>
                  <th>Còn nợ</th>
                  <th>Trừ lần này</th>
                  <th>Còn lại sau thu</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((d) => {
                  const line = preview?.allocations.find(
                    (l) => l.receivableId === d.id,
                  )
                  return (
                    <tr
                      key={d.id}
                      className={line?.allocatedAmount ? 'rv-allocated' : ''}
                    >
                      {mode === 'selected' && (
                        <td>
                          <input
                            type="checkbox"
                            aria-label={'Chọn khoản nợ ' + d.id}
                            checked={selected.includes(d.id)}
                            onChange={(e) => {
                              setSelected(
                                e.target.checked
                                  ? [...selected, d.id]
                                  : selected.filter((id) => id !== d.id),
                              )
                              change()
                            }}
                          />
                        </td>
                      )}
                      <td>
                        #{d.id}
                        <small>
                          {d.originType === 'OPENING_BALANCE'
                            ? 'Nợ đầu kỳ'
                            : 'Đơn #' + d.salesOrderId}{' '}
                          · ghi nợ{' '}
                          {d.recognizedAt
                            .slice(0, 10)
                            .split('-')
                            .reverse()
                            .join('/')}
                        </small>
                      </td>
                      <td>
                        {d.dueDate?.split('-').reverse().join('/')}{' '}
                        {d.overdue && (
                          <small className="rv-overdue">Quá hạn</small>
                        )}
                      </td>
                      <td>{money.format(d.remainingAmount)}</td>
                      <td className="rv-allocation-value">
                        {line ? money.format(line.allocatedAmount) : '—'}
                      </td>
                      <td>{line ? money.format(line.remainingAfter) : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {!rows.length && <p>Chọn cửa hàng có khoản nợ để thu.</p>}
          </div>
          <div className="rv-full rv-payment-evidence">
            <label htmlFor="debt-payment-files">Chứng từ (tùy chọn)</label>
            <input
              id="debt-payment-files"
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,application/pdf"
              onChange={(e) => {
                const next = Array.from(e.target.files ?? [])
                if (next.length + files.length > 10) {
                  setError('Tối đa 10 chứng từ.')
                  e.target.value = ''
                  return
                }
                setFiles([...files, ...next])
                e.target.value = ''
                change()
              }}
            />
            {files.map((file, i) => (
              <div className="rv-file" key={i}>
                <span>
                  {file.name} · {Math.ceil(file.size / 1024)} KB
                </span>
                <button
                  type="button"
                  aria-label={'Bỏ ' + file.name}
                  onClick={() => {
                    setFiles(files.filter((_, index) => index !== i))
                    change()
                  }}
                >
                  ×
                </button>
              </div>
            ))}
            <small>JPG, PNG, WebP hoặc PDF, tối đa 10 MB/tệp.</small>
          </div>
          <label className="rv-full rv-received">
            <input
              type="checkbox"
              checked={confirmed}
              disabled={!preview || loading || !valid}
              onChange={(e) => setConfirmed(e.target.checked)}
            />{' '}
            Đã nhận đủ số tiền này
          </label>
          <div className="rv-full rv-payment-recap" role="status">
            {value > total && total > 0 ? (
              <>
                Số tiền lớn hơn tổng còn nợ của khách (
                <strong>{money.format(total)}</strong>).
              </>
            ) : loading ? (
              'Đang xem phân bổ…'
            ) : preview ? (
              <>
                Sẽ thu <strong>{money.format(value)}</strong>, còn nợ{' '}
                <strong>{money.format(total - value)}</strong> trong các khoản
                được chọn.
              </>
            ) : mode === 'selected' && !selected.length ? (
              'Chọn các khoản khách chỉ định để xem phân bổ.'
            ) : (
              'Nhập số tiền để xem phân bổ. Nợ đầu kỳ được trừ trước, sau đó tới đơn cũ nhất.'
            )}
          </div>
          {(error || (result?.key === key && result.error)) && (
            <p role="alert" className="stock-error rv-full">
              {error || result?.error}
              <button
                type="button"
                onClick={() => {
                  setResult(undefined)
                  setRetry((n) => n + 1)
                }}
              >
                Thử lại
              </button>
            </p>
          )}
        </fieldset>
      </form>
    </FormDialog>
  )
}
