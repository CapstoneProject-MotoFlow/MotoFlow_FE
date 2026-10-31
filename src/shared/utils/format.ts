/**
 * File: shared/utils/format.ts
 * Loại: THÀNH PHẦN / XỬ LÝ HỖ TRỢ — không phải màn hình độc lập.
 * Công dụng: Tiện ích định dạng, ví dụ hiển thị ngày; xử lý trường hợp không có dữ liệu.
 */
/** formatDate: Định dạng ngày để hiển thị, xử lý trường hợp giá trị ngày không có. */
export function formatDate(value: string | null | undefined) {
  if (value == null || value === '') return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

export function formatStoreStatus(status: 'ACTIVE' | 'PLANNED' | 'INACTIVE') {
  return {
    ACTIVE: 'Đang hoạt động',
    PLANNED: 'Đang chuẩn bị',
    INACTIVE: 'Ngừng hoạt động',
  }[status]
}
