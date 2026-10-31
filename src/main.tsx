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

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
