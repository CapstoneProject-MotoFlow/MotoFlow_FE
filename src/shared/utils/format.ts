/**
 * File: shared/utils/format.ts
 * Loại: THÀNH PHẦN / XỬ LÝ HỖ TRỢ — không phải màn hình độc lập.
 * Công dụng: Tiện ích định dạng, ví dụ hiển thị ngày; xử lý trường hợp không có dữ liệu.
 */
const dateTimeParts = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})
/** Chuỗi ngày hoặc ngày giờ không có múi giờ: "2026-11-12", "2026-11-12T15:07:44.123". */
const localDateTime =
  /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?)?$/
const moneyFormat = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
})

/**
 * formatDateTime: Một kiểu ngày giờ cho mọi màn, "12/11/2026 15:07" (ngày trước, giờ sau, không có giây).
 * Trả "—" khi không có giá trị.
 */
export function formatDateTime(
  value: string | number | Date | null | undefined,
) {
  if (value == null || value === '') return '—'
  // BE trả LocalDateTime (giờ Việt Nam, không kèm múi giờ): giữ nguyên giờ đó, không đổi múi giờ theo máy.
  const local = typeof value === 'string' ? localDateTime.exec(value) : null
  if (local) {
    const [, year, month, day, hour, minute] = local
    return hour
      ? `${day}/${month}/${year} ${hour}:${minute}`
      : `${day}/${month}/${year}`
  }
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  const part = Object.fromEntries(
    dateTimeParts.formatToParts(date).map((item) => [item.type, item.value]),
  )
  return `${part.day}/${part.month}/${part.year} ${part.hour === '24' ? '00' : part.hour}:${part.minute}`
}

/** formatMoney: Một kiểu tiền cho mọi màn, luôn có "₫"; null hiện "—". */
export function formatMoney(value: number | null | undefined) {
  return value == null ? '—' : moneyFormat.format(value)
}

/** formatDate: Định dạng ngày giờ để hiển thị (giữ tên cũ, dùng chung formatDateTime). */
export function formatDate(value: string | null | undefined) {
  return formatDateTime(value)
}

export function formatStoreStatus(status: 'ACTIVE' | 'PLANNED' | 'INACTIVE') {
  return {
    ACTIVE: 'Đang hoạt động',
    PLANNED: 'Đang chuẩn bị',
    INACTIVE: 'Ngừng hoạt động',
  }[status]
}
