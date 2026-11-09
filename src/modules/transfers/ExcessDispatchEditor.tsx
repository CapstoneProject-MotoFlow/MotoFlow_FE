import { useRef, useState } from 'react'
import { useAuth } from '../../shared/hooks/useAuth'
import axiosClient from '../../shared/api/axiosClient'
import { uploadAttachment } from '../../shared/api/upload'
import FormDialog from '../../shared/ui/FormDialog'
import { inventoryError } from '../inventory/api'
import type { Transfer } from './types'
import { pendingExcess, canConfirmExcess } from './transferRules'
export default function ExcessDispatchEditor({
  order,
  onSaved,
}: {
  order: Transfer
  onSaved: () => void
}) {
  const { user } = useAuth(),
    lines = order.lines.filter((l) => pendingExcess(l) > 0),
    allowed =
      user?.role === 'BRANCH_MANAGER' &&
      user.storeId === order.sourceStoreId &&
      canConfirmExcess(order.status, order.lines)
  const [values, setValues] = useState<Record<number, string>>(() =>
      Object.fromEntries(lines.map((l) => [l.productId, ''])),
    ),
    [reason, setReason] = useState(''),
    [files, setFiles] = useState<File[]>([]),
    [confirm, setConfirm] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    lock = useRef(false)
  const valid =
    allowed &&
    lines.every(
      (l) =>
        /^\d+$/.test(values[l.productId]) &&
        Number.isSafeInteger(Number(values[l.productId])) &&
        Number(values[l.productId]) <= pendingExcess(l),
    ) &&
    (!lines.some((l) => Number(values[l.productId]) === 0) || !!reason.trim())
  async function save() {
    if (lock.current || !valid) return
    lock.current = true
    setBusy(true)
    setError('')
    try {
      const evidence = []
      for (const f of files) evidence.push(await uploadAttachment(f))
      await axiosClient.post(`/transfer-orders/${order.id}/extra-dispatch`, {
        lines: lines.map((l) => ({
          productId: l.productId,
          extraQty: Number(values[l.productId]),
        })),
        reason: reason.trim() || undefined,
        evidence,
      })
      onSaved()
    } catch (e) {
      setError(inventoryError(e))
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  return (
    <section>
      <h2>Xác nhận phần xuất thừa còn chờ</h2>
      {!allowed && (
        <p className="tf-note">
          Phiếu hiện không có phần xuất thừa chờ bạn xác nhận.
        </p>
      )}
      <div className="tf-table">
        <table>
          <thead>
            <tr>
              <th>Phụ tùng</th>
              <th>Đã xuất ban đầu</th>
              <th>Nhận thừa</th>
              <th>Đã xác nhận</th>
              <th>Còn chờ</th>
              <th>Xác nhận lần này</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.productId}>
                <td>
                  {l.sku}
                  <small>{l.partName}</small>
                </td>
                <td>{l.dispatchedQty ?? 0}</td>
                <td>{l.extraReceivedQty ?? 0}</td>
                <td>{l.extraDispatchedQty ?? 0}</td>
                <td>{pendingExcess(l)}</td>
                <td>
                  <input
                    aria-label={'Xuất thừa ' + l.sku}
                    type="number"
                    min={0}
                    max={pendingExcess(l)}
                    step={1}
                    required
                    disabled={!allowed || busy || confirm}
                    value={values[l.productId]}
                    onChange={(e) =>
                      setValues((v) => ({
                        ...v,
                        [l.productId]: e.target.value,
                      }))
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {allowed && (
        <div className="tf-note tf-form">
          <label>
            Lý do (bắt buộc nếu xác nhận 0)
            <textarea
              maxLength={500}
              value={reason}
              disabled={busy || confirm}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <label>
            Chứng từ bàn giao
            <input
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,application/pdf"
              disabled={busy || confirm}
              onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            />
          </label>
          <button
            className="tf-primary"
            disabled={!valid || busy}
            onClick={() => setConfirm(true)}
          >
            Xem và xác nhận xuất thừa
          </button>
        </div>
      )}
      {confirm && (
        <FormDialog
          title="Xác nhận xuất thừa"
          formId="confirm-excess-dispatch"
          submitLabel="Xác nhận xuất thừa"
          busy={busy}
          submitDisabled={!valid}
          onClose={() => {
            setConfirm(false)
            setError('')
          }}
        >
          <form
            id="confirm-excess-dispatch"
            className="tf-form"
            onSubmit={(e) => {
              e.preventDefault()
              void save()
            }}
          >
            {error && <p role="alert">{error}</p>}
            <p>Số lượng dưới đây được cộng vào số đã xác nhận xuất thừa.</p>
            <ul>
              {lines.map((l) => (
                <li key={l.productId}>
                  {l.sku}: <strong>{values[l.productId]}</strong> /{' '}
                  {pendingExcess(l)} còn chờ
                </li>
              ))}
            </ul>
            {reason.trim() && <p>Lý do: {reason}</p>}
            <p>Kiểm tra chứng từ bàn giao trước khi xác nhận.</p>
          </form>
        </FormDialog>
      )}
    </section>
  )
}
