/**
 * File: modules/branch-manager/pages/BranchProductsPage.tsx
 * Loại: MÀN HÌNH — Tìm phụ tùng của quản lý chi nhánh.
 * Đường dẫn: /branch-manager/products.
 * Công dụng: Component bọc để tái sử dụng PartsSearchPage cho route BM.
 */
import PartsSearchPage from '../../catalog/pages/PartsSearchPage'
/** BranchProductsPage: Component bọc để tái sử dụng PartsSearchPage cho route BM. */
export default function BranchProductsPage() {
  return <PartsSearchPage />
}
