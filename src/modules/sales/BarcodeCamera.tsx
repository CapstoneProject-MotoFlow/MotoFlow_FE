import { useEffect, useRef, useState } from 'react'
import FormDialog from '../../shared/ui/FormDialog'
type Detector = {
  detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]>
}
export default function BarcodeCamera({
  onCode,
  onClose,
}: {
  onCode: (code: string) => void
  onClose: () => void
}) {
  const video = useRef<HTMLVideoElement>(null),
    callback = useRef(onCode),
    [error, setError] = useState(() =>
      typeof window !== 'undefined' && !('BarcodeDetector' in window)
        ? 'Trình duyệt chưa hỗ trợ quét camera. Dùng máy quét hoặc nhập mã.'
        : '',
    )
  useEffect(() => {
    callback.current = onCode
  }, [onCode])
  useEffect(() => {
    let stream: MediaStream | undefined,
      closed = false,
      timer: ReturnType<typeof setTimeout>
    const Detector = (
      window as unknown as {
        BarcodeDetector?: new (options: { formats: string[] }) => Detector
      }
    ).BarcodeDetector
    if (!Detector) return
    void navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: 'environment' } } })
      .then(async (media) => {
        if (closed) {
          media.getTracks().forEach((t) => t.stop())
          return
        }
        stream = media
        if (!video.current) return
        video.current.srcObject = media
        await video.current.play()
        const detector = new Detector({
          formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'qr_code'],
        })
        const scan = async () => {
          if (closed || !video.current) return
          try {
            const hits = await detector.detect(video.current)
            if (hits[0]) {
              callback.current(hits[0].rawValue)
              return
            }
          } catch {
            /* Keep scanning until closed. */
          }
          timer = setTimeout(() => void scan(), 300)
        }
        void scan()
      })
      .catch(() => {
        if (!closed)
          setError(
            'Không mở được camera. Kiểm tra quyền camera hoặc dùng máy quét.',
          )
      })
    return () => {
      closed = true
      clearTimeout(timer)
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [])
  return (
    <FormDialog
      title="Quét mã vạch"
      formId="camera-scan"
      submitLabel="Quét bằng camera"
      hideSubmit
      submitDisabled
      onClose={onClose}
    >
      <video
        ref={video}
        muted
        playsInline
        style={{ width: '100%', borderRadius: 8 }}
      />
      {error ? (
        <p role="alert">{error}</p>
      ) : (
        <p>Đưa mã vạch vào giữa khung hình.</p>
      )}
    </FormDialog>
  )
}
