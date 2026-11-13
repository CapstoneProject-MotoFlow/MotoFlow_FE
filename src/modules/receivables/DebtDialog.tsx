import './receivables.css'
import { useRef, useState } from 'react'
import FormDialog from '../../shared/ui/FormDialog'
import axiosClient from '../../shared/api/axiosClient'
import { inventoryError } from '../inventory/api'
import { money } from '../inventory/presentation'
import DebtPaymentDialog from './DebtPaymentDialog'
import OpeningDebtPicker from './OpeningDebtPicker'
import type { DebtDetail } from './types'
type Props = {
  action: string
  data: DebtDetail
  owner: boolean
  stores: { id: number; storeName: string }[]
  onClose: () => void
  onSaved: () => void
}
export function CreditDialog({
  action,
  data,
  onClose,
  onSaved,
}: Pick<Props, 'action' | 'onClose' | 'onSaved'> & {
  data: Pick<DebtDetail, 'customerId' | 'totalDebt'>
}) {
  const [reason, setReason] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  const lock = useRef(false),
    grant = action === 'grant'
  return (
    <FormDialog
      title={grant ? 'Cấp quyền mua chịu' : 'Thu hồi quyền mua chịu'}
      formId="customer-credit"
      className="rv-dialog"
      submitLabel={grant ? 'Cấp quyền mua chịu' : 'Thu hồi quyền'}
      busy={busy}
      submitDisabled={!reason.trim()}
      onClose={onClose}
    >
      <form
        id="customer-credit"
        className="rv-form"
        onSubmit={async (e) => {
          e.preventDefault()
          if (lock.current || !reason.trim()) return
          lock.current = true
          setBusy(true)
          setError('')
          try {
            await axiosClient.post(
              `/customers/${data.customerId}/credit/${grant ? 'grant' : 'revoke'}`,
              { reason: reason.trim() },
            )
            onSaved()
          } catch (e) {
            setError(inventoryError(e))
          } finally {
            lock.current = false
            setBusy(false)
          }
        }}
      >
        {error && (
          <p role="alert" className="stock-error">
            {error}
          </p>
        )}
        <p className="rv-dialog-explanation">
          {grant
            ? 'Quyền có hiệu lực tới khi thu hồi. Quản lý cửa hàng quyết định ghi nợ cho từng đơn.'
            : 'Khách không được ghi nợ mới. Các khoản nợ hiện có vẫn được theo dõi và thu như cũ.'}
        </p>
        <div className="rv-recap">
          <span>Nợ hiện tại toàn chuỗi</span>
          <strong>{money.format(data.totalDebt)}</strong>
        </div>
        <label>
          Lý do
          <textarea
            required
            maxLength={255}
            disabled={busy}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
      </form>
    </FormDialog>
  )
}
export default function DebtDialog(props: Props) {
  if (props.action === 'payment') return <DebtPaymentDialog {...props} />
  if (props.action === 'opening')
    return (
      <OpeningDebtPicker
        initialCustomer={props.data}
        onClose={props.onClose}
        onSaved={props.onSaved}
      />
    )
  return <CreditDialog {...props} />
}
