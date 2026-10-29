import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
export default function ConfirmDialog({ title, message, onConfirm, onCancel }: { title: string; message: string; onConfirm: () => Promise<void>; onCancel: () => void }) {
  const ref = useRef<HTMLElement>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    ref.current?.querySelector<HTMLButtonElement>('button')?.focus()
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onCancel()
      if (event.key === 'Tab') {
        const buttons = Array.from(ref.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') || [])
        const first = buttons[0], last = buttons.at(-1)
        if (!first) { event.preventDefault(); return }
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
      }
    }
    document.addEventListener('keydown', key)
    return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', key); previous?.focus() }
  }, [busy, onCancel])
  return createPortal(<div className="ui-dialog-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !busy) onCancel() }}><section className="ui-confirm-dialog" ref={ref} role="alertdialog" aria-modal="true" aria-labelledby="ui-confirm-title" aria-describedby="ui-confirm-message"><h2 id="ui-confirm-title">{title}</h2><p id="ui-confirm-message">{message}</p><div><button type="button" className="secondary-button" disabled={busy} onClick={onCancel}>Hủy</button><button type="button" className="ui-confirm-button" disabled={busy} onClick={async () => { setBusy(true); try { await onConfirm() } finally { setBusy(false) } }}>{busy ? 'Đang xử lý…' : 'Xác nhận'}</button></div></section></div>, document.body)
}
