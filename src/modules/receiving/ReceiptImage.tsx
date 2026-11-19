import { useState } from 'react'
import './receiving.css'

export default function ReceiptImage({
  src,
  name,
}: {
  src: string
  name: string
}) {
  const [failed, setFailed] = useState(false)
  return (
    <figure className="receiving-document-image">
      {failed ? (
        <p role="status">Không hiển thị được ảnh chứng từ.</p>
      ) : (
        <img src={src} alt={name} onError={() => setFailed(true)} />
      )}
      {/* Mục 8 (PM 19/11): không hiện tên tệp dưới ảnh. */}
    </figure>
  )
}
