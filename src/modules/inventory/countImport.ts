import type { CountLine } from './stockCountModel'
export type ImportRow = { id: number; value: string; note: string }
const header = (value: unknown) =>
  String(value ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .toLowerCase()
/** Validate the entire sheet before changing any input. A SKU with multiple lots requires a lot code. */
export function mapCountSheet(
  rows: unknown[][],
  lines: CountLine[],
  mode: 'quantity' | 'cost',
): ImportRow[] {
  const headers = (rows[0] ?? []).map(header)
  const sku = headers.findIndex((x) => ['sku', 'ma phu tung'].includes(x))
  const lot = headers.findIndex((x) => ['lo', 'ma lo'].includes(x))
  const value = headers.findIndex((x) =>
    (mode === 'quantity'
      ? ['so dem', 'countedqty']
      : ['gia von', 'gia von ban dau', 'unitcost']
    ).includes(x),
  )
  const note = headers.findIndex((x) => ['ghi chu', 'note'].includes(x))
  if (sku < 0 || value < 0)
    throw new Error(
      'Tệp cần cột SKU và ' +
        (mode === 'quantity' ? 'Số đếm' : 'Giá vốn') +
        '.',
    )
  const result: ImportRow[] = [],
    seen = new Set<number>()
  rows.slice(1).forEach((row, index) => {
    if (row.every((cell) => cell == null || String(cell).trim() === '')) return
    const code = String(row[sku] ?? '').trim()
    const lotCode = String(row[lot] ?? '').trim()
    const candidates = lines.filter(
      (line) =>
        line.sku === code &&
        (mode === 'cost' || !lotCode || line.lotCode === lotCode),
    )
    const matches =
      mode === 'cost'
        ? [
            ...new Map(
              candidates.map((line) => [line.productId, line]),
            ).values(),
          ]
        : candidates
    const fail = (message: string): never => {
      throw new Error('Dòng ' + (index + 2) + ': ' + message)
    }
    if (!matches.length) fail('SKU hoặc mã lô không thuộc phiếu.')
    if (matches.length !== 1) fail('SKU có nhiều lô; hãy điền cột Mã lô.')
    const id = mode === 'cost' ? matches[0].productId : matches[0].id
    if (seen.has(id)) fail('Trùng phụ tùng hoặc lô trong tệp.')
    const raw = row[value],
      number = Number(raw)
    if (
      (typeof raw !== 'number' && typeof raw !== 'string') ||
      (typeof raw === 'string' && !/^\d+$/.test(raw.trim())) ||
      raw == null ||
      String(raw).trim() === '' ||
      !Number.isSafeInteger(number) ||
      number < 0 ||
      number > (mode === 'quantity' ? 2147483647 : Number.MAX_SAFE_INTEGER)
    )
      fail('Giá trị phải là số nguyên không âm hợp lệ.')
    const text = String(row[note] ?? '').trim()
    if (text.length > 255) fail('Ghi chú tối đa 255 ký tự.')
    seen.add(id)
    result.push({ id, value: String(number), note: text })
  })
  if (!result.length) throw new Error('Tệp không có dòng dữ liệu.')
  return result
}
export async function readCountFile(file: File) {
  if (!/\.xlsx$/i.test(file.name))
    throw new Error(
      'Chọn tệp .xlsx. Hãy lưu lại tệp .xls thành .xlsx trước khi nhập.',
    )
  if (file.size > 5 * 1024 * 1024) throw new Error('Tệp tối đa 5 MB.')
  const { readSheet } = await import('read-excel-file/browser')
  return readSheet(file)
}
