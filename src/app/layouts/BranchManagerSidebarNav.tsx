/**
 * File: app/layouts/BranchManagerSidebarNav.tsx
 * Loại: THÀNH PHẦN / XỬ LÝ HỖ TRỢ — không phải màn hình độc lập.
 * Công dụng: Menu quản lý chi nhánh dựa trên cấu hình và quyền của user.
 */
import BusinessSidebarNav from './BusinessSidebarNav'
/** BranchManagerSidebarNav: Menu quản lý chi nhánh dựa trên cấu hình và quyền của user. */
export default function BranchManagerSidebarNav(props: {
  collapsed: boolean
  onNotice: (message: string) => void
}) {
  return <BusinessSidebarNav {...props} owner={false} />
}
