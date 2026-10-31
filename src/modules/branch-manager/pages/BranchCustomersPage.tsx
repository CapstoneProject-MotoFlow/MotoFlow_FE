/**
 * File: modules/branch-manager/pages/BranchCustomersPage.tsx
 * Loại: MÀN HÌNH — Danh sách khách hàng tại cửa hàng.
 * Đường dẫn: /branch-manager/customers.
 * Công dụng: Component bọc CustomerListPage với phạm vi cửa hàng.
 */
import CustomerListPage from '../../customers/pages/CustomerListPage'
/** BranchCustomersPage: Component bọc CustomerListPage với phạm vi cửa hàng. */
export default function BranchCustomersPage() {
  return <CustomerListPage scope="store" />
}
