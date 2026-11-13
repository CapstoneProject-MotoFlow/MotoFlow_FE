/**
 * File: app/layouts/branchManagerNavigation.ts
 * Loại: THÀNH PHẦN / XỬ LÝ HỖ TRỢ — không phải màn hình độc lập.
 * Công dụng: Cấu hình tương tự cho BM.
 */
import type { NavItem } from './ownerNavigation'
// Unimplemented screens remain in the menu without linking to Owner-only routes.
export const branchManagerNavigation: NavItem[] = [
  {
    label: 'Thông báo',
    href: '/notifications',
    icon: 'bell',
  },
  { label: 'Đơn bán', href: '/sales-orders', icon: 'receipt' },
  { label: 'Đơn nháp', href: '/sales-drafts', icon: 'document' },
  { label: 'Đơn chưa đáp ứng đủ', href: '/unmet-demand', icon: 'clipboard' },
  { label: 'Khách hàng', href: '/branch-manager/customers', icon: 'users' },
  { label: 'Công nợ', href: '/receivables', icon: 'wallet' },
  {
    label: 'Yêu cầu nhập hàng',
    href: '/purchase-orders',
    icon: 'clipboard',
  },
  {
    label: 'Yêu cầu bổ sung',
    href: '/replenishment-requests',
    icon: 'transfer',
  },
  {
    label: 'Lệnh điều chuyển',
    href: '/transfer-orders',
    icon: 'truck',
  },
  { label: 'Tồn kho', href: '/inventory', icon: 'box' },
  {
    label: 'Lịch sử xuất nhập',
    href: '/inventory/movements',
    icon: 'clock',
  },
  { label: 'Lô hàng', href: '/inventory/lots', icon: 'hourglass' },
  {
    label: 'Tồn kho theo ngày',
    href: '/inventory/past-date-stock',
    icon: 'calendar',
  },
  {
    label: 'Kiểm kê',
    href: '/stock-counts',
    icon: 'checklist',
  },
  {
    label: 'Tra cứu chứng từ',
    href: '#bm-documents',
    icon: 'document',
    pending: true,
  },
  {
    label: 'Yêu cầu điều chỉnh',
    href: '#bm-adjustments',
    icon: 'sliders',
    pending: true,
  },
  {
    label: 'Báo cáo bán hàng',
    href: '#bm-sales-reports',
    icon: 'chart',
    pending: true,
  },
  {
    label: 'Báo cáo kho hàng',
    href: '#bm-inventory-reports',
    icon: 'scale',
    pending: true,
  },
  { label: 'Bảng giá', href: '/pricing/retail-prices', icon: 'tag' },
  { label: 'Phụ tùng', href: '/branch-manager/products', icon: 'tool' },
]
