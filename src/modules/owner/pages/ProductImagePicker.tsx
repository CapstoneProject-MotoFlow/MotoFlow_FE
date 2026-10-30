import { useRef, useState } from 'react'
export default function ProductImagePicker({ onChange }: { onChange: (files: File[]) => void }) {
  const input = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<File[]>([])
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  function add(incoming: File[]) {
    setError('')
    if (incoming.some(file => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type))) { setError('Chỉ chọn ảnh JPG, PNG hoặc WebP.'); return }
    if (incoming.some(file => file.size > 5 * 1024 * 1024)) { setError('Mỗi ảnh tối đa 5 MB.'); return }
    const next = [...files, ...incoming.filter(file => !files.some(old => old.name === file.name && old.size === file.size && old.lastModified === file.lastModified))]
    if (next.length > 3) { setError('Chỉ được chọn tối đa 3 ảnh.'); return }
    setFiles(next); onChange(next)
  }
  return <div className="part-create-body"><input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={event => { add(Array.from(event.target.files || [])); event.target.value = '' }} /><button type="button" className={'part-dropzone' + (dragging ? ' dragging' : '')} onClick={() => input.current?.click()} onDragOver={event => { event.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={event => { event.preventDefault(); setDragging(false); add(Array.from(event.dataTransfer.files)) }}><span className="part-upload-icon" aria-hidden="true">↥</span><strong>Kéo thả ảnh vào đây hoặc chọn tệp</strong><small>JPG, PNG, WebP · Tối đa 3 ảnh, 5 MB/ảnh</small></button>{files.map((file,index) => <div className="part-file-row" key={`${file.name}-${file.lastModified}`}><span className="part-file-icon" aria-hidden="true">▧</span><div><strong>{file.name}</strong><small>{Math.ceil(file.size / 1024).toLocaleString('vi-VN')} KB{index === 0 ? ' · ảnh chính' : ''}</small></div><button type="button" aria-label={`Xóa ${file.name}`} onClick={() => { const next = files.filter((_,i) => i !== index); setFiles(next); onChange(next) }}>×</button></div>)}{error && <p role="alert">{error}</p>}{files.length > 0 && <p role="status">Ảnh đã chọn trên máy. Chưa thể tải lên vì hệ thống chưa có API lưu tệp ảnh.</p>}</div>
}
