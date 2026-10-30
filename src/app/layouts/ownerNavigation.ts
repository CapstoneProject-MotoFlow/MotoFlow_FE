import type { IconName } from '../../shared/ui/Icon'
export type NavItem = {
  label: string
  href: string
  icon: IconName
  group?: string
  pending?: boolean
}
export const ownerNavigation: NavItem[] = [
  { label: 'Thông báo', href: '/notifications', icon: 'bell' },
  {
    label: 'Đơn bán',
    href: '#sales',
    icon: 'receipt',
    group: 'BÁN HÀNG',
    pending: true,
  },
  { label: 'Khách hàng', href: '/owner/customers', icon: 'users' },
  {
    label: 'Công nợ',
    href: '#debts',
    icon: 'wallet',
    group: 'CÔNG NỢ',
    pending: true,
  },
  {
    label: 'Phiếu nhập hàng',
    href: '/dashboard#owner-requests',
    icon: 'clipboard',
    group: 'NHẬP HÀNG',
  },
  {
    label: 'Yêu cầu bổ sung',
    href: '#replenishments',
    icon: 'transfer',
    group: 'ĐIỀU CHUYỂN',
    pending: true,
  },
  {
    label: 'Lệnh điều chuyển',
    href: '#transfers',
    icon: 'truck',
    pending: true,
  },
  {
    label: 'Tồn kho',
    href: '/dashboard#owner-stock',
    icon: 'box',
    group: 'KHO HÀNG',
  },
  {
    label: 'Lịch sử xuất nhập',
    href: '#movements',
    icon: 'clock',
    pending: true,
  },
  { label: 'Lô hàng', href: '#lots', icon: 'hourglass', pending: true },
  {
    label: 'Tồn theo ngày',
    href: '#daily-stock',
    icon: 'calendar',
    pending: true,
  },
  {
    label: 'Kỳ kho',
    href: '#inventory-periods',
    icon: 'calendar',
    pending: true,
  },
  { label: 'Kiểm kê', href: '#stock-counts', icon: 'checklist', pending: true },
  {
    label: 'Tra cứu chứng từ',
    href: '#documents',
    icon: 'document',
    group: 'CHỨNG TỪ',
    pending: true,
  },
  {
    label: 'Yêu cầu điều chỉnh',
    href: '#adjustments',
    icon: 'sliders',
    pending: true,
  },
  {
    label: 'Báo cáo bán hàng',
    href: '#sales-reports',
    icon: 'chart',
    group: 'BÁO CÁO',
    pending: true,
  },
  {
    label: 'Báo cáo kho hàng',
    href: '#inventory-reports',
    icon: 'scale',
    pending: true,
  },
  { label: 'Lãi gộp', href: '#gross-profit', icon: 'coins', pending: true },
  {
    label: 'Xuất dữ liệu kế toán',
    href: '#accounting-export',
    icon: 'download',
    pending: true,
  },
  {
    label: 'Bảng giá',
    href: '#prices',
    icon: 'tag',
    group: 'GIÁ BÁN',
    pending: true,
  },
  {
    label: 'Quy tắc giá',
    href: '#pricing-rules',
    icon: 'percent',
    pending: true,
  },
  {
    label: 'Quyền danh mục và giá',
    href: '/owner/catalog-permissions',
    icon: 'shield',
  },
  {
    label: 'Phụ tùng',
    href: '/owner/products',
    icon: 'tool',
    group: 'DANH MỤC',
  },
  {
    label: 'Nhóm phụ tùng',
    href: '/owner/categories',
    icon: 'layers',
  },
  { label: 'Dòng xe', href: '/owner/vehicles', icon: 'bike' },
  { label: 'Nhà cung cấp', href: '/owner/suppliers', icon: 'truck' },
  { label: 'Cửa hàng', href: '/stores', icon: 'store', group: 'HỆ THỐNG' },
]
