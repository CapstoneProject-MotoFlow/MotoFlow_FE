import { useRef, useState, type ReactNode } from 'react'
import axiosClient from '../../shared/api/axiosClient'
import FormDialog from '../../shared/ui/FormDialog'
import { inventoryError } from '../inventory/api'
export default function TransferAction({
  title,
  path,
  method = 'post',
  payload,
  children,
  disabled = false,
  onClose,
  onSaved,
}: {
  title: string
  path: string
  method?: 'post' | 'put'
  payload: () => unknown
  children: ReactNode
  disabled?: boolean
  onClose: () => void
  onSaved: (data: unknown) => void
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  const lock = useRef(false)
  return (
    <FormDialog
      title={title}
      formId="transfer-action"
      className="tf-dialog"
      submitLabel="Xác nhận"
      busy={busy}
      submitDisabled={disabled}
      onClose={onClose}
    >
      <form
        id="transfer-action"
        className="tf-form"
        onSubmit={async (e) => {
          e.preventDefault()
          if (lock.current || disabled) return
          lock.current = true
          setBusy(true)
          setError('')
          try {
            const r = await axiosClient[method](path, payload())
            onSaved(r.data)
          } catch (err) {
            setError(inventoryError(err))
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
        <fieldset disabled={busy}>{children}</fieldset>
      </form>
    </FormDialog>
  )
}
