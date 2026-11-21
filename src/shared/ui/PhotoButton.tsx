import { useState } from 'react'
import ImageViewer, { type ViewerImage } from './ImageViewer'

/** Shared image action for uploaded and saved evidence. */
export default function PhotoButton({
  images,
  label = 'Xem ảnh',
  className = 'mf-btn mf-btn--secondary',
  loadImages,
}: {
  images?: ViewerImage[]
  label?: string
  className?: string
  loadImages?: () => Promise<ViewerImage[]>
}) {
  const [viewing, setViewing] = useState<ViewerImage[]>()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const count = images?.length ?? 0
  if (!count && !loadImages) return null
  async function open() {
    setError('')
    if (!loadImages) {
      setViewing(images ?? [])
      return
    }
    setLoading(true)
    try {
      const loaded = await loadImages()
      if (loaded.length) setViewing(loaded)
      else setError('Chưa có ảnh để hiển thị.')
    } catch {
      setError('Không tải được ảnh. Vui lòng thử lại.')
    } finally {
      setLoading(false)
    }
  }
  return (
    <>
      <button
        type="button"
        className={className}
        disabled={loading}
        onClick={() => void open()}
      >
        {loading ? 'Đang tải ảnh…' : `${label} (${count || '…'})`}
      </button>
      {error && <small role="alert">{error}</small>}
      {viewing && (
        <ImageViewer images={viewing} onClose={() => setViewing(undefined)} />
      )}
    </>
  )
}
