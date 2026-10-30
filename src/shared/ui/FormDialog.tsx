import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
export default function FormDialog({
  title,
  formId,
  children,
  submitLabel,
  onClose,
}: {
  title: string
  formId: string
  children: ReactNode
  submitLabel: string
  onClose: () => void
}) {
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    ref.current?.querySelector<HTMLInputElement>('input')?.focus()
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key !== 'Tab') return
      const controls = Array.from(
        ref.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled)',
        ) || [],
      )
      const first = controls[0],
        last = controls.at(-1)
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last?.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first?.focus()
      }
    }
    document.addEventListener('keydown', key)
    return () => {
      document.body.style.overflow = overflow
      document.removeEventListener('keydown', key)
      previous?.focus()
    }
  }, [onClose])
  return createPortal(
    <div
      className="ui-form-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        className="ui-form-dialog"
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={formId + '-title'}
      >
        <header>
          <h2 id={formId + '-title'}>{title}</h2>
          <button type="button" aria-label="Đóng" onClick={onClose}>
            ×
          </button>
        </header>
        <div className="ui-form-body">{children}</div>
        <footer>
          <button type="button" className="secondary-button" onClick={onClose}>
            Hủy
          </button>
          <button type="submit" form={formId} className="ui-confirm-button">
            {submitLabel}
          </button>
        </footer>
      </section>
    </div>,
    document.body,
  )
}
