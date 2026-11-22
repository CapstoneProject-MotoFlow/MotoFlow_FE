/**
 * File: shared/types/session.ts
 * Loại: THÀNH PHẦN / XỬ LÝ HỖ TRỢ — không phải màn hình độc lập.
 * Công dụng: Kiểu dữ liệu một phiên đăng nhập (thiết bị đang đăng nhập), dùng ở trang cá nhân và màn tài khoản.
 */

/** Một thiết bị đang đăng nhập. current: thiết bị đang gửi request (chỉ có ở danh sách của chính mình). */
export type Session = {
  id: number
  signedInAt: string
  lastRefreshedAt: string | null
  ipAddress: string | null
  device: string | null
  current: boolean
}
