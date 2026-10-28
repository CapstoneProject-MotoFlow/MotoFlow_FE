export function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(date)
}

export function formatStoreStatus(status: 'ACTIVE' | 'PLANNED' | 'INACTIVE') {
  return { ACTIVE: 'Đang hoạt động', PLANNED: 'Đang chuẩn bị', INACTIVE: 'Ngừng hoạt động' }[status]
}
