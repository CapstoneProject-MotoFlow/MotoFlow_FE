/** YYYY-MM-DD → dd/mm/yyyy bằng cách tách chuỗi, không parse Date. Dùng cho thẻ cọc và banner quá hạn. */
export function viewDate(iso: string | null | undefined) {
  if (!iso) return '—'
  const [year, month, day] = iso.split('-')
  return day + '/' + month + '/' + year
}
