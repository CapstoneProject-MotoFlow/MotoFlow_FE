/**
 * File: app/layouts/OwnerSidebarNav.tsx
 * Loại: THÀNH PHẦN / XỬ LÝ HỖ TRỢ — không phải màn hình độc lập.
 * Công dụng: Nối cấu hình menu Owner với phần menu nghiệp vụ dùng chung.
 */
import BusinessSidebarNav from './BusinessSidebarNav'
/** OwnerSidebarNav: Nối cấu hình menu Owner với phần menu nghiệp vụ dùng chung. */
export default function OwnerSidebarNav(props: {
  collapsed: boolean
  onNotice: (message: string) => void
}) {
  return <BusinessSidebarNav {...props} owner={true} />
}
