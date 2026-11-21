/**
 * File: shared/ui/ImageViewer.tsx
 * Loại: THÀNH PHẦN GIAO DIỆN DÙNG CHUNG — không phải màn hình.
 * Công dụng: Mục E (PM 19/11): bấm "Xem…" ảnh thì ảnh nổi lên giữa màn hình trên nền tối, giống xem ảnh Facebook.
 * Nhiều ảnh thì chuyển qua lại bằng nút ‹ ›, phím mũi tên hoặc ảnh nhỏ bên dưới. Đóng bằng Esc, nút × hoặc bấm ra ngoài ảnh.
 */
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import './image-viewer.css'

/** Mục 8 (PM 19/11): không hiện tên tệp; name chỉ còn để tương thích, trình xem không in ra. */
export type ViewerImage = { src: string; name?: string }

export default function ImageViewer({
  images,
  start = 0,
  onClose,
}: {
  images: ViewerImage[]
  start?: number
  onClose: () => void
}) {
  const count = images.length
  const [index, setIndex] = useState(() =>
    Math.min(Math.max(start, 0), Math.max(count - 1, 0)),
  )
  const [failed, setFailed] = useState<Record<string, boolean>>({})
  const [loaded, setLoaded] = useState<Record<string, boolean>>({})
  const closeButton = useRef<HTMLButtonElement>(null)
  const close = useRef(onClose)
  useEffect(() => {
    close.current = onClose
  }, [onClose])
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeButton.current?.focus()
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close.current()
      else if (event.key === 'ArrowLeft' && count > 1)
        setIndex((value) => (value - 1 + count) % count)
      else if (event.key === 'ArrowRight' && count > 1)
        setIndex((value) => (value + 1) % count)
    }
    document.addEventListener('keydown', key)
    return () => {
      document.body.style.overflow = overflow
      document.removeEventListener('keydown', key)
      previous?.focus()
    }
  }, [count])
  if (!count) return null
  const image = images[Math.min(index, count - 1)]
  const go = (step: number) =>
    setIndex((value) => (value + step + count) % count)
  const backdrop = (event: React.MouseEvent) => {
    if (event.target === event.currentTarget) onClose()
  }
  return createPortal(
    <div
      className="mf-viewer"
      role="dialog"
      aria-modal="true"
      aria-label={'Xem ảnh ' + (index + 1)}
      onMouseDown={backdrop}
    >
      <header className="mf-viewer-bar">
        <span className="mf-viewer-name">Xem ảnh</span>
        {count > 1 && (
          <span className="mf-viewer-count">
            {index + 1} / {count}
          </span>
        )}
        <a
          className="mf-viewer-open"
          href={image.src}
          target="_blank"
          rel="noreferrer"
        >
          Mở ảnh gốc
        </a>
        <button
          ref={closeButton}
          type="button"
          className="mf-viewer-close"
          aria-label="Đóng"
          onClick={onClose}
        >
          ×
        </button>
      </header>
      <div className="mf-viewer-stage" onMouseDown={backdrop}>
        {count > 1 && (
          <button
            type="button"
            className="mf-viewer-nav is-prev"
            aria-label="Ảnh trước"
            onClick={() => go(-1)}
          >
            ‹
          </button>
        )}
        {failed[image.src] ? (
          <p className="mf-viewer-error" role="status">
            Không hiển thị được ảnh. Liên kết tải có thể đã hết hạn, hãy đóng và
            bấm Xem lại.
          </p>
        ) : (
          <>
            {!loaded[image.src] && (
              <p className="mf-viewer-loading" role="status">
                Đang tải ảnh…
              </p>
            )}
            <img
              key={image.src}
              src={image.src}
              alt={'Ảnh ' + (index + 1)}
              onLoad={() =>
                setLoaded((value) => ({ ...value, [image.src]: true }))
              }
              onError={() =>
                setFailed((value) => ({ ...value, [image.src]: true }))
              }
            />
          </>
        )}
        {count > 1 && (
          <button
            type="button"
            className="mf-viewer-nav is-next"
            aria-label="Ảnh sau"
            onClick={() => go(1)}
          >
            ›
          </button>
        )}
      </div>
      {count > 1 && (
        <div className="mf-viewer-thumbs" onMouseDown={backdrop}>
          {images.map((item, position) => (
            <button
              key={item.src + position}
              type="button"
              className={position === index ? 'is-active' : undefined}
              aria-label={`Ảnh ${position + 1}`}
              aria-current={position === index || undefined}
              onClick={() => setIndex(position)}
            >
              <img src={item.src} alt="" />
            </button>
          ))}
        </div>
      )}
    </div>,
    document.body,
  )
}
