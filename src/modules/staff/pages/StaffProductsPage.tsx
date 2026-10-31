/**
 * File: modules/staff/pages/StaffProductsPage.tsx
 * Loại: MÀN HÌNH — Tìm phụ tùng của nhân viên.
 * Đường dẫn: /staff/products.
 * Công dụng: Bọc PartsSearchPage để dùng lại màn tìm phụ tùng cho Staff.
 */
import PartsSearchPage from '../../catalog/pages/PartsSearchPage'
/** StaffProductsPage: Bọc PartsSearchPage để dùng lại màn tìm phụ tùng cho Staff. */
export default function StaffProductsPage() {
  return <PartsSearchPage />
}
