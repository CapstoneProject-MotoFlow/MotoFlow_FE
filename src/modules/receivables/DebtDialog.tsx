import DebtPaymentDialog from './DebtPaymentDialog'
import OpeningDebtPicker from './OpeningDebtPicker'
import { confirmedAllocations } from './debtRules'
import { useRef, useState } from 'react'
import FormDialog from '../../shared/ui/FormDialog'
import axiosClient from '../../shared/api/axiosClient'
import { uploadAttachment } from '../../shared/api/upload'
import { inventoryError } from '../inventory/api'
import { money } from '../inventory/presentation'
import type { DebtDetail, Preview } from './types'
function SettlementDialog({
  action,
  data,
  owner,
  stores,
  onClose,
  onSaved,
}: {
  action: string
  data: DebtDetail
  owner: boolean
  stores: { id: number; storeName: string }[]
  onClose: () => void
  onSaved: () => void
}) {
  const [store, setStore] = useState(String(data.storeId ?? '')),
    [amount, setAmount] = useState(''),
    [reason, setReason] = useState(''),
    [due, setDue] = useState(''),
    [method, setMethod] = useState('CASH'),
    [reference, setReference] = useState(''),
    [cash, setCash] = useState(''),
    [selected, setSelected] = useState<number[]>([]),
    [files, setFiles] = useState<File[]>([]),
    [preview, setPreview] = useState<Preview>(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [confirmed, setConfirmed] = useState(false)
  const [mode, setMode] = useState('oldest')
  const lock = useRef(false)
  const payment = action === 'payment',
    opening = action === 'opening'
  const title = payment
    ? 'Thu nợ của ' + data.customerName
    : opening
      ? 'Ghi nợ đầu kỳ'
      : action === 'grant'
        ? 'Cấp quyền mua chịu'
        : 'Thu hồi quyền mua chịu'
  const input = {
    storeId: store ? Number(store) : undefined,
    amount: Number(amount),
    receivableIds: selected,
  }
  const valid =
    Number.isSafeInteger(Number(amount)) &&
    Number(amount) > 0 &&
    Number(amount) <= 100000000000
  async function submit() {
    if (lock.current) return
    lock.current = true
    setBusy(true)
    setError('')
    try {
      const path = `/customers/${data.customerId}`
      if (payment && !preview) {
        setPreview(
          (
            await axiosClient.post<Preview>(
              path + '/debt-payments/preview',
              input,
            )
          ).data,
        )
        return
      }
      const evidence = []
      for (const file of files) evidence.push(await uploadAttachment(file))
      if (payment)
        await axiosClient.post(path + '/debt-payments', {
          ...input,
          paymentMethod: method,
          tenderedAmount:
            method === 'CASH' ? Number(cash || amount) : undefined,
          transactionReference:
            method === 'BANK_TRANSFER' ? reference.trim() : undefined,
          expectedAllocations: confirmedAllocations(preview!),
          evidence,
        })
      else if (opening)
        await axiosClient.post(path + '/opening-debts', {
          storeId: Number(store),
          amount: Number(amount),
          dueDate: due,
          note: reason.trim(),
          evidence,
        })
      else
        await axiosClient.post(path + '/credit/' + action, {
          reason: reason.trim(),
        })
      onSaved()
    } catch (e) {
      setError(inventoryError(e))
      setPreview(undefined)
      setConfirmed(false)
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  return (
    <FormDialog
      title={title}
      className={'rv-dialog ' + (payment ? 'rv-dialog-payment' : '')}
      formId="debt-action"
      submitLabel={
        payment
          ? preview
            ? 'Ghi thu'
            : 'Xem phân bổ'
          : opening
            ? 'Ghi nợ đầu kỳ'
            : action === 'grant'
              ? 'Cấp quyền mua chịu'
              : 'Thu hồi quyền'
      }
      busy={busy}
      onClose={onClose}
      submitDisabled={
        ((payment || opening) && !valid) ||
        (owner && (payment || opening) && !store) ||
        (payment && !!preview && !confirmed) ||
        (payment && mode === 'selected' && !selected.length)
      }
    >
      <form
        id="debt-action"
        className="rv-form"
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
        {error && (
          <p role="alert" className="stock-error">
            {error}
          </p>
        )}
        {!payment && !opening && (
          <>
            <p className="rv-dialog-explanation">
              {action === 'grant'
                ? 'Quyền có hiệu lực tới khi bạn thu hồi. Mỗi lần ghi nợ, Branch Manager vẫn xem nợ hiện tại và quyết định cho từng đơn.'
                : 'Từ bây giờ khách không được ghi nợ mới. Các khoản nợ hiện có vẫn được theo dõi và thu như cũ.'}
            </p>
            <div className="rv-recap">
              <span>Nợ hiện tại toàn chuỗi</span>
              <strong>{money.format(data.totalDebt)}</strong>
              <span>Khoản nợ đang mở</span>
              <strong>
                {data.debts.filter((d) => d.remainingAmount > 0).length}
              </strong>
            </div>
          </>
        )}
        {opening && (
          <p className="rv-dialog-explanation">
            Ghi khoản nợ trước khi dùng MotoFlow cho{' '}
            <strong>{data.customerName}</strong>. Không ghi doanh thu, không đổi
            tồn kho.
          </p>
        )}
        <fieldset disabled={busy || !!preview}>
          {owner && (payment || opening) && (
            <label>
              Cửa hàng
              <select
                required
                value={store}
                onChange={(e) => {
                  setStore(e.target.value)
                  setSelected([])
                }}
              >
                <option value="">Chọn cửa hàng</option>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.storeName}
                  </option>
                ))}
              </select>
            </label>
          )}
          {(payment || opening) && (
            <label>
              {opening ? 'Số nợ (đ)' : 'Số tiền thu (đ)'}
              <input
                type="number"
                required
                min="1"
                max="100000000000"
                step="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </label>
          )}
          {payment && (
            <>
              <label>
                Hình thức
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                >
                  <option value="CASH">Tiền mặt</option>
                  <option value="BANK_TRANSFER">Chuyển khoản</option>
                </select>
              </label>
              {method === 'CASH' ? (
                <label>
                  Tiền khách đưa (đ)
                  <input
                    type="number"
                    min={Number(amount) || 1}
                    max="100000000000"
                    step="1"
                    value={cash}
                    placeholder={amount}
                    onChange={(e) => setCash(e.target.value)}
                  />
                  <small>
                    Tiền thối:{' '}
                    {money.format(
                      Math.max(0, Number(cash || amount) - Number(amount)),
                    )}
                  </small>
                </label>
              ) : (
                <label>
                  Mã giao dịch
                  <input
                    required
                    maxLength={100}
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                  />
                </label>
              )}
              <legend>Trừ vào</legend>
              <div className="rv-mode">
                {[
                  ['oldest', 'Khoản cũ nhất trước'],
                  ['selected', 'Các khoản khách chỉ định'],
                ].map(([value, label]) => (
                  <label key={value}>
                    <input
                      type="radio"
                      name="allocation-mode"
                      value={value}
                      checked={mode === value}
                      onChange={() => {
                        setMode(value)
                        setSelected([])
                      }}
                    />
                    {label}
                  </label>
                ))}
              </div>
              <p className="rv-help">
                Ưu tiên nợ đầu kỳ, sau đó đơn cũ nhất. Hạn trả không quyết định
                thứ tự.
              </p>
              {data.debts
                .filter(
                  (d) =>
                    d.remainingAmount > 0 &&
                    (!store || d.storeId === Number(store)),
                )
                .map((d) => (
                  <label key={d.id}>
                    <input
                      type="checkbox"
                      disabled={mode !== 'selected'}
                      checked={selected.includes(d.id)}
                      onChange={(e) =>
                        setSelected(
                          e.target.checked
                            ? [...selected, d.id]
                            : selected.filter((id) => id !== d.id),
                        )
                      }
                    />{' '}
                    Khoản #{d.id} · {d.storeName} ·{' '}
                    {money.format(d.remainingAmount)}
                  </label>
                ))}
            </>
          )}
          {opening && (
            <label>
              Hạn trả
              <input
                required
                type="date"
                value={due}
                onChange={(e) => setDue(e.target.value)}
              />
            </label>
          )}
          {!payment && (
            <label>
              {opening ? 'Diễn giải' : 'Lý do'}
              <textarea
                required
                maxLength={opening ? 500 : 255}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
          )}
          {(opening || payment) && (
            <label>
              Chứng từ {opening ? '(bắt buộc)' : '(tùy chọn)'}
              <input
                type="file"
                multiple
                required={opening}
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={(e) => {
                  const next = Array.from(e.target.files ?? [])
                  if (next.length > 10) {
                    setError('Tối đa 10 tệp.')
                    e.target.value = ''
                    setFiles([])
                  } else setFiles(next)
                }}
              />
            </label>
          )}
        </fieldset>
        {preview && (
          <>
            <h3>Phân bổ khoản thu</h3>
            <table>
              <thead>
                <tr>
                  <th>Khoản nợ</th>
                  <th>Trước thu</th>
                  <th>Phân bổ</th>
                  <th>Còn lại</th>
                </tr>
              </thead>
              <tbody>
                {preview.allocations.map((l) => (
                  <tr key={l.receivableId}>
                    <td>#{l.receivableId}</td>
                    <td>{money.format(l.remainingBefore)}</td>
                    <td>{money.format(l.allocatedAmount)}</td>
                    <td>{money.format(l.remainingAfter)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <label>
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />{' '}
              Đã nhận đủ số tiền này và xác nhận phân bổ.
            </label>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setPreview(undefined)
                setConfirmed(false)
              }}
            >
              Chỉnh sửa
            </button>
          </>
        )}
      </form>
    </FormDialog>
  )
}

export default function DebtDialog(
  props: Parameters<typeof SettlementDialog>[0],
) {
  if (props.action === 'payment') return <DebtPaymentDialog {...props} />
  return props.action === 'opening' ? (
    <OpeningDebtPicker
      initialCustomer={props.data}
      onClose={props.onClose}
      onSaved={props.onSaved}
    />
  ) : (
    <SettlementDialog {...props} />
  )
}
