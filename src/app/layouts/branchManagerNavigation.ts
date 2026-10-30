import type { NavItem } from './ownerNavigation'
// Unimplemented screens remain in the menu without linking to Owner-only routes.
export const branchManagerNavigation: NavItem[] = [
  { label: 'Thông báo', href: '#bm-notifications', icon: 'bell', pending: true },
  { label: 'Đơn bán', href: '#bm-sales', icon: 'receipt', pending: true },
  { label: 'Khách hàng', href: '#bm-customers', icon: 'users', pending: true },
  { label: 'Công nợ', href: '#bm-debts', icon: 'wallet', pending: true },
  { label: 'Yêu cầu nhập hàng', href: '#bm-receiving', icon: 'clipboard', pending: true },
  { label: 'Yêu cầu bổ sung', href: '#bm-replenishments', icon: 'transfer', pending: true },
  { label: 'Lệnh điều chuyển', href: '#bm-transfers', icon: 'truck', pending: true },
  { label: 'Tồn kho', href: '#bm-stock', icon: 'box', pending: true },
  { label: 'Lịch sử xuất nhập', href: '#bm-movements', icon: 'clock', pending: true },
  { label: 'Lô hàng', href: '#bm-lots', icon: 'hourglass', pending: true },
  { label: 'Tồn theo ngày', href: '#bm-daily-stock', icon: 'calendar', pending: true },
  { label: 'Kiểm kê', href: '#bm-stock-counts', icon: 'checklist', pending: true },
  { label: 'Tra cứu chứng từ', href: '#bm-documents', icon: 'document', pending: true },
  { label: 'Yêu cầu điều chỉnh', href: '#bm-adjustments', icon: 'sliders', pending: true },
  { label: 'Báo cáo bán hàng', href: '#bm-sales-reports', icon: 'chart', pending: true },
  { label: 'Báo cáo kho hàng', href: '#bm-inventory-reports', icon: 'scale', pending: true },
  { label: 'Bảng giá', href: '#bm-prices', icon: 'tag', pending: true },
  { label: 'Phụ tùng', href: '/branch-manager/products', icon: 'tool' },
]

