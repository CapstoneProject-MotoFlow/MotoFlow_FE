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
  className = '',
  disabled = false,
  hideSubmit = false,
  onClose,
  onSaved,
}: {
  title: string
  path: string
  method?: 'post' | 'put'
  payload: (form: HTMLFormElement) => unknown
  children: ReactNode
  className?: string
  disabled?: boolean
  hideSubmit?: boolean
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
      className={'tf-dialog' + (className ? ' ' + className : '')}
      submitLabel="Xác nhận"
      busy={busy}
      submitDisabled={disabled}
      hideSubmit={hideSubmit}
      onClose={onClose}
    >
      <form
        id="transfer-action"
        className="tf-form"
        noValidate
        onSubmit={async (e) => {
          e.preventDefault()
          if (lock.current || disabled || hideSubmit) return
          lock.current = true
          setBusy(true)
          setError('')
          try {
            const body = await payload(e.currentTarget)
            const r = await axiosClient[method](path, body)
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
