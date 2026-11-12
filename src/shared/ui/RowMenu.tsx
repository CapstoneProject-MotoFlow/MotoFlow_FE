/**
 * File: shared/ui/RowMenu.tsx
 * Loại: THÀNH PHẦN GIAO DIỆN DÙNG CHUNG — không phải màn hình.
 * Công dụng: Nút "⋯ Khác" trên mỗi dòng bảng, mở danh sách thao tác phụ (review T4: mỗi dòng chỉ một nút chính,
 * thao tác còn lại và thao tác nguy hiểm đưa vào menu). Menu gắn vào body, position: fixed, để không bị khung cuộn của bảng cắt hay nhận CSS của bảng.
 */
import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export type RowMenuItem = {
  label: string
  onSelect: () => void
  danger?: boolean
  disabled?: boolean
}

export default function RowMenu({
  items,
  label = 'Khác',
  ariaLabel,
}: {
  items: RowMenuItem[]
  label?: string
  ariaLabel?: string
}) {
  const [position, setPosition] = useState<{ top: number; right: number }>()
  const button = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const id = useId()
  const open = position !== undefined

  useEffect(() => {
    if (!open) return
    const close = (event: Event) => {
      if (
        event instanceof KeyboardEvent
          ? event.key === 'Escape'
          : !menu.current?.contains(event.target as Node) &&
            !button.current?.contains(event.target as Node)
      ) {
        setPosition(undefined)
        if (event instanceof KeyboardEvent) button.current?.focus()
      }
    }
    const dismiss = () => setPosition(undefined)
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', close)
    window.addEventListener('scroll', dismiss, true)
    window.addEventListener('resize', dismiss)
    menu.current
      ?.querySelector<HTMLButtonElement>('button:not(:disabled)')
      ?.focus()
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', close)
      window.removeEventListener('scroll', dismiss, true)
      window.removeEventListener('resize', dismiss)
    }
  }, [open])

  if (!items.length) return null
  return (
    <>
      <button
        ref={button}
        type="button"
        className="mf-row-menu-toggle"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-label={ariaLabel}
        onClick={() => {
          if (open) return setPosition(undefined)
          const rect = button.current!.getBoundingClientRect()
          setPosition({
            top: rect.bottom + 4,
            right: Math.max(8, window.innerWidth - rect.right),
          })
        }}
      >
        <span aria-hidden="true">⋯</span> {label}
      </button>
      {open &&
        createPortal(
          <div
            ref={menu}
            id={id}
            role="menu"
            className="mf-row-menu"
            style={{ top: position.top, right: position.right }}
          >
            {items.map((item) => (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                className={item.danger ? 'is-danger' : undefined}
                onClick={() => {
                  setPosition(undefined)
                  item.onSelect()
                }}
              >
                {item.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  )
}
