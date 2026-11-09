import { useRef, useState } from 'react'
import './operations.css'
import axiosClient from '../../shared/api/axiosClient'
import { inventoryError } from '../inventory/api'
import BarcodeCamera from '../sales/BarcodeCamera'
export type BarcodePart = {
  productId: number
  sku: string
  partName: string
  status: string
  barcode: string
  availableQty: number | null
}
export default function BarcodeScan({
  onFound,
  storeId,
  disabled = false,
  allowInactive = false,
  resolveLocal,
}: {
  onFound: (part: BarcodePart) => void
  storeId?: number
  disabled?: boolean
  allowInactive?: boolean
  resolveLocal?: (code: string) => BarcodePart | undefined
}) {
  const [code, setCode] = useState(''),
    [camera, setCamera] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  const lock = useRef(false)
  async function find(value: string) {
    if (lock.current || disabled || !value.trim()) return
    lock.current = true
    setBusy(true)
    setError('')
    setCamera(false)
    try {
      const local = resolveLocal?.(value.trim())
      const r = local
        ? { data: local }
        : await axiosClient.get<BarcodePart>(
            '/products/barcode/' + encodeURIComponent(value.trim()),
            { params: { storeId } },
          )
      if (!allowInactive && r.data.status !== 'ACTIVE')
        throw new Error('Phụ tùng đã ngừng kinh doanh.')
      onFound(r.data)
      setCode('')
    } catch (e) {
      setError(inventoryError(e))
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  return (
    <div className="operation-barcode">
      <label>
        {resolveLocal ? 'Quét mã hoặc nhập SKU' : 'Quét mã vạch'}
        <input
          disabled={disabled || busy}
          value={code}
          placeholder="Quét USB/Bluetooth rồi Enter"
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void find(code)
            }
          }}
        />
      </label>
      <button
        type="button"
        disabled={disabled || busy || !code.trim()}
        onClick={() => void find(code)}
      >
        Tìm mã
      </button>
      <button
        type="button"
        disabled={disabled || busy}
        onClick={() => setCamera(true)}
      >
        Quét bằng camera
      </button>
      {error && <p role="alert">{error}</p>}
      {camera && (
        <BarcodeCamera
          onClose={() => setCamera(false)}
          onCode={(value) => void find(value)}
        />
      )}
    </div>
  )
}

import './operations.css'
