import { useRef, useState, type FormEvent } from 'react'
import axiosClient from '../../shared/api/axiosClient'
import ConfirmDialog from '../../shared/ui/ConfirmDialog'
import FormDialog from '../../shared/ui/FormDialog'
import MoneyInput from '../../shared/ui/MoneyInput'
import { formatDateTime, formatMoney } from '../../shared/utils/format'
import { inventoryError } from '../inventory/api'
import type { SalesOrder } from './salesModel'
import { viewDate } from './salesDepositDate'
import {
  addDaysIso,
  depositSplitPayload,
  depositStatusLabels,
  splitDepositTotal,
  todayIso,
  validateSplitDeposit,
} from './salesDeposit'

type DepositDialog = 'record' | 'expiry' | 'forfeit'

export default function SalesDepositPanel({
  order,
  onChanged,
}: {
  order: SalesOrder
  onChanged: (message: string) => void
}) {
  const [dialog, setDialog] = useState<DepositDialog | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [amount, setAmount] = useState(''),
    [transfer, setTransfer] = useState(''),
    [reference, setReference] = useState(''),
    [expiresOn, setExpiresOn] = useState('')
  // Chặn bấm đúp nút mất cọc: lần gọi thứ hai bị bỏ khi lần đầu chưa xong.
  const forfeiting = useRef(false)
  const deposit = order.deposit
  if (
    !deposit ||
    (deposit.status === 'NONE' && !order.actions?.canRecordDeposit)
  )
    return null

  const minExpiry = addDaysIso(todayIso(), 1)
  const canRecord = !!order.actions?.canRecordDeposit,
    canChangeExpiry = !!order.actions?.canChangeDepositExpiry,
    canForfeit = !!order.actions?.canForfeitDeposit

  function open(next: DepositDialog) {
    setError('')
    setAmount('')
    setTransfer('')
    setReference('')
    setExpiresOn(next === 'expiry' ? (deposit?.expiresOn ?? '') : '')
    setDialog(next)
  }

  async function record(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy || !deposit) return
    // PM 22/11 + BE #98: một lần cọc nhận cả tiền mặt và chuyển khoản; số ghi là số đã nhận.
    const input = { cash: amount, transfer, reference, expiresOn }
    const problem = validateSplitDeposit(input, todayIso(), {
      requireExpiry: !deposit.expiresOn,
    })
    if (problem) {
      setError(problem)
      return
    }
    const body = depositSplitPayload(input, deposit.total + deposit.unverified, {
      withExpiry: !deposit.expiresOn,
    })
    setBusy(true)
    setError('')
    try {
      await axiosClient.post('/sales-orders/' + order.id + '/deposits/split', body)
      setDialog(null)
      onChanged('Đã ghi nhận tiền cọc.')
    } catch (failure) {
      setError(inventoryError(failure))
    } finally {
      setBusy(false)
    }
  }

  async function changeExpiry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    if (!expiresOn || expiresOn < minExpiry) {
      setError('Hạn cọc phải sau hôm nay.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await axiosClient.patch('/sales-orders/' + order.id + '/deposit-expiry', {
        depositExpiresOn: expiresOn,
      })
      setDialog(null)
      onChanged('Đã sửa hạn cọc.')
    } catch (failure) {
      setError(inventoryError(failure))
    } finally {
      setBusy(false)
    }
  }

  async function forfeit() {
    if (forfeiting.current) return
    forfeiting.current = true
    setError('')
    try {
      await axiosClient.post('/sales-orders/' + order.id + '/forfeit-deposit')
      setDialog(null)
      onChanged('Đã xác nhận mất cọc, đơn đã hủy.')
    } catch (failure) {
      setError(inventoryError(failure))
    } finally {
      forfeiting.current = false
    }
  }

  const chipText =
    deposit.status === 'FORFEITED'
      ? deposit.forfeitedAmount != null
        ? 'Mất cọc ' + formatMoney(deposit.forfeitedAmount)
        : 'Đã mất cọc'
      : depositStatusLabels[deposit.status]
  const chipTone =
    deposit.status === 'EXPIRED'
      ? ' is-danger'
      : ['FORFEITED', 'SETTLED', 'NONE'].includes(deposit.status)
        ? ' is-muted'
        : ''
  const hasActions = canRecord || canChangeExpiry || canForfeit

  return (
    <section className="sales-deposit-card" aria-label="Tiền cọc">
      <header className="sales-deposit-head">
        <h2>Tiền cọc</h2>
        <span className={'sales-deposit-chip' + chipTone}>{chipText}</span>
      </header>
      {deposit.status === 'FORFEITED' &&
        (deposit.forfeitedBy || deposit.forfeitedAt) && (
          <p className="sales-deposit-meta">
            {deposit.forfeitedBy && 'bởi ' + deposit.forfeitedBy}
            {deposit.forfeitedBy && deposit.forfeitedAt && ', '}
            {deposit.forfeitedAt && formatDateTime(deposit.forfeitedAt)}
          </p>
        )}
      <dl className="sales-deposit-facts">
        <div>
          <dt>Tổng cọc đã xác minh</dt>
          <dd>{formatMoney(deposit.total)}</dd>
        </div>
        {deposit.unverified > 0 && (
          <div>
            <dt>Chờ xác minh</dt>
            <dd>{formatMoney(deposit.unverified)}</dd>
          </div>
        )}
        <div>
          <dt>Đã trừ vào đơn</dt>
          <dd>{formatMoney(deposit.applied)}</dd>
        </div>
        {deposit.refunded > 0 && (
          <div>
            <dt>Đã trả lại khách</dt>
            <dd>{formatMoney(deposit.refunded)}</dd>
          </div>
        )}
        <div className="is-strong">
          <dt>Còn giữ</dt>
          <dd>{formatMoney(deposit.remaining)}</dd>
        </div>
        <div>
          <dt>Hạn cọc</dt>
          <dd>{viewDate(deposit.expiresOn)}</dd>
        </div>
      </dl>
      {deposit.expiryChanges.length > 0 && (
        <div className="sales-deposit-history">
          <h3>Lịch sử sửa hạn</h3>
          <table>
            <thead>
              <tr>
                <th>Ngày cũ</th>
                <th>Ngày mới</th>
                <th>Người sửa</th>
                <th>Lúc</th>
              </tr>
            </thead>
            <tbody>
              {deposit.expiryChanges.map((change, index) => (
                <tr key={index}>
                  <td>{viewDate(change.oldDate)}</td>
                  <td>{viewDate(change.newDate)}</td>
                  <td>{change.changedBy ?? '—'}</td>
                  <td>{formatDateTime(change.changedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {hasActions && (
        <div className="sales-deposit-actions">
          {canRecord && (
            <button
              type="button"
              className="sales-action-primary"
              onClick={() => open('record')}
            >
              {deposit.status === 'NONE' ? 'Nhận cọc' : 'Thu thêm cọc'}
            </button>
          )}
          {canChangeExpiry && (
            <button type="button" onClick={() => open('expiry')}>
              Sửa hạn cọc
            </button>
          )}
          {canForfeit && (
            <button
              type="button"
              data-danger="true"
              onClick={() => open('forfeit')}
            >
              Xác nhận mất cọc
            </button>
          )}
        </div>
      )}
      {dialog === 'record' && (
        <FormDialog
          title={deposit.status === 'NONE' ? 'Nhận cọc' : 'Thu thêm cọc'}
          formId="deposit-record"
          submitLabel="Ghi nhận cọc"
          busy={busy}
          onClose={() => setDialog(null)}
        >
          <form
            id="deposit-record"
            className="sales-form"
            noValidate
            onSubmit={record}
          >
            <label>
              Tiền mặt (đ)
              <MoneyInput value={amount} onValueChange={setAmount} />
            </label>
            <label>
              Chuyển khoản (đ)
              <MoneyInput value={transfer} onValueChange={setTransfer} />
            </label>
            {splitDepositTotal({ cash: amount, transfer }) > 0 && (
              <p className="sales-release-hint">
                {'Tổng cọc: ' + formatMoney(splitDepositTotal({ cash: amount, transfer }))}
              </p>
            )}
            {splitDepositTotal({ cash: '0', transfer }) > 0 && (
              <label>
                Mã giao dịch
                <input
                  value={reference}
                  maxLength={100}
                  onChange={(event) => setReference(event.target.value)}
                />
              </label>
            )}
            {!deposit.expiresOn && (
              <label>
                Hạn cọc
                <input
                  type="date"
                  min={minExpiry}
                  value={expiresOn}
                  onChange={(event) => setExpiresOn(event.target.value)}
                />
              </label>
            )}
            {error && (
              <p role="alert" className="stock-error">
                {error}
              </p>
            )}
          </form>
        </FormDialog>
      )}
      {dialog === 'expiry' && (
        <FormDialog
          title="Sửa hạn cọc"
          formId="deposit-expiry"
          submitLabel="Lưu hạn cọc"
          busy={busy}
          onClose={() => setDialog(null)}
        >
          <form
            id="deposit-expiry"
            className="sales-form"
            noValidate
            onSubmit={changeExpiry}
          >
            <label>
              Hạn cọc mới
              <input
                type="date"
                min={minExpiry}
                value={expiresOn}
                onChange={(event) => setExpiresOn(event.target.value)}
              />
            </label>
            {error && (
              <p role="alert" className="stock-error">
                {error}
              </p>
            )}
          </form>
        </FormDialog>
      )}
      {dialog === 'forfeit' && (
        <ConfirmDialog
          danger
          title="Xác nhận mất cọc?"
          confirmLabel="Xác nhận mất cọc"
          message={
            <>
              {'Khách mất ' +
                formatMoney(deposit.remaining) +
                ' cọc và đơn bị hủy với lý do "Hết hạn cọc". Không hoàn tiền.'}
              {error && (
                <span role="alert" className="stock-error">
                  {error}
                </span>
              )}
            </>
          }
          onConfirm={forfeit}
          onCancel={() => setDialog(null)}
        />
      )}
    </section>
  )
}
