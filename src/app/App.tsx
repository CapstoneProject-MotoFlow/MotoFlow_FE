/**
 * File: app/App.tsx
 * Loại: THÀNH PHẦN / XỬ LÝ HỖ TRỢ — không phải màn hình độc lập.
 * Công dụng: Component gốc ghép AuthProvider và AppRoutes.
 */
import AuthProvider from './AuthProvider'
import AppRoutes from './routes/AppRoutes'

/** App: Component gốc ghép AuthProvider và AppRoutes. */
export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}
