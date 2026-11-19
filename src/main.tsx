/**
 * File: main.tsx
 * Loại: THÀNH PHẦN / XỬ LÝ HỖ TRỢ — không phải màn hình độc lập.
 * Công dụng: Điểm khởi động: gắn React vào phần tử root của HTML; bật StrictMode; bao ứng dụng bằng BrowserRouter; nạp CSS toàn cục. StrictMode giúp phát hiện vấn đề trong môi trường phát triển, có thể chạy lại effect để kiểm tra cleanup.
 */
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './shared/assets/styles/global.css'
import App from './app/App'

// Browser number inputs may keep a typed leading zero (for example, "012")
// until blur. Normalize integer quantities consistently across the app.
document.addEventListener('focusout', (event) => {
  const input = event.target
  if (!(input instanceof HTMLInputElement) || input.type !== 'number') return

  const step = input.getAttribute('step')
  if (step?.includes('.')) return

  const value = input.value
  if (!value || !/^\d+$/.test(value)) return

  const normalized = value.replace(/^0+(?=\d)/, '')
  if (normalized === value) return

  input.value = normalized
  input.dispatchEvent(new Event('input', { bubbles: true }))
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
