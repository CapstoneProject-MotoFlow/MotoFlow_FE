/**
 * File: modules/customers/pages/CustomersPage.tsx
 * Loại: MÀN HÌNH — Danh sách khách hàng toàn chuỗi.
 * Đường dẫn: /owner/customers.
 * Công dụng: Bọc CustomerListPage với scope chain cho Owner.
 */
import CustomerListPage from './CustomerListPage'
/** CustomersPage: Bọc CustomerListPage với scope chain cho Owner. */
export default function CustomersPage() {
  return <CustomerListPage scope="chain" />
}
