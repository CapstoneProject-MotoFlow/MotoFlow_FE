/**
 * File: shared/utils/requestedPath.ts
 * Loại: THÀNH PHẦN / XỬ LÝ HỖ TRỢ — không phải màn hình độc lập.
 * Công dụng: Đọc trang người dùng đang mở trước khi bị chuyển sang đăng nhập (router state `from`) và chỉ nhận đường dẫn trong ứng dụng.
 */

// Các đường dẫn này không bao giờ là nơi quay lại sau đăng nhập (đã chuẩn hóa: chữ thường, không dấu "/" cuối).
const NOT_RETURN_PATHS = ['', '/login', '/change-password']

/** requestedPathFrom: Trả về đường dẫn trong ứng dụng để quay lại sau đăng nhập, hoặc null nếu không có hoặc không hợp lệ. */
export function requestedPathFrom(state: unknown): string | null {
  const from = (state as { from?: unknown } | null)?.from
  if (typeof from !== 'string') return null
  // Chỉ nhận đường dẫn nội bộ: loại URL đầy đủ và "//host" (protocol-relative).
  if (!from.startsWith('/') || from.startsWith('//') || from.startsWith('/\\'))
    return null
  const pathname = from.split(/[?#]/)[0].toLowerCase().replace(/\/+$/, '')
  return NOT_RETURN_PATHS.includes(pathname) ? null : from
}
