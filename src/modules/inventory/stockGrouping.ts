import type { Page, StockRow } from './types'

/** A complete stock result is required before totals or SKU grouping are displayed. */
export async function readAllStock(
  fetchPage: (page: number) => Promise<Page<StockRow>>,
  signal: AbortSignal,
) {
  const rows: StockRow[] = []
  const seen = new Set<string>()
  let total: number | undefined
  for (let page = 0; ; page++) {
    signal.throwIfAborted()
    const result = await fetchPage(page)
    signal.throwIfAborted()
    if (
      !Number.isSafeInteger(result.totalItems) ||
      result.totalItems < 0 ||
      !Array.isArray(result.items)
    )
      throw new Error(
        'Không tải được số liệu tồn kho đầy đủ. Vui lòng thử lại.',
      )
    total ??= result.totalItems
    if (
      total !== result.totalItems ||
      (!result.items.length && rows.length < total)
    )
      throw new Error(
        'Tồn kho vừa thay đổi. Vui lòng tải lại để xem số liệu đầy đủ.',
      )
    for (const row of result.items) {
      const key = stockKey(row)
      if (seen.has(key))
        throw new Error(
          'Tồn kho vừa thay đổi. Vui lòng tải lại để xem số liệu đầy đủ.',
        )
      seen.add(key)
      rows.push(row)
    }
    if (rows.length > total)
      throw new Error(
        'Không tải được số liệu tồn kho đầy đủ. Vui lòng thử lại.',
      )
    if (rows.length === total) return rows
  }
}
export const stockKey = (row: StockRow) => row.storeId + ':' + row.productId
export const unavailableQty = (row: StockRow) =>
  row.awaitingInspectionQty +
  row.wrongItemQty +
  row.damagedQty +
  row.awaitingSupplierReturnQty
export function stockTotals(rows: StockRow[]) {
  return {
    availableQty: rows.reduce((sum, row) => sum + row.availableQty, 0),
    unavailableQty: rows.reduce((sum, row) => sum + unavailableQty(row), 0),
    inTransitQty: rows.reduce((sum, row) => sum + row.inTransitQty, 0),
    onHandQty: rows.reduce((sum, row) => sum + row.onHandQty, 0),
    stockValue: rows.some((row) => row.stockValue == null)
      ? null
      : rows.reduce((sum, row) => sum + (row.stockValue ?? 0), 0),
  }
}
export function matchesStockView(row: StockRow, view: string) {
  return view === 'lowStock'
    ? row.lowStock
    : view === 'unavailable'
      ? unavailableQty(row) > 0
      : view === 'expiryAlert'
        ? row.nearExpiryQty + row.expiredQty > 0
        : true
}
export type StockGroup = {
  product: StockRow
  rows: StockRow[]
  totals: ReturnType<typeof stockTotals>
  lowStores: number
}
export function groupStock(
  rows: StockRow[],
  matchingRows: StockRow[],
  includeZero: boolean,
  view: string,
): StockGroup[] {
  const matches = new Set(
    matchingRows
      .filter(
        (row) =>
          (includeZero || row.onHandQty + row.inTransitQty > 0) &&
          matchesStockView(row, view),
      )
      .map((row) => row.productId),
  )
  const groups = new Map<number, StockRow[]>()
  for (const row of rows) {
    if (
      !matches.has(row.productId) ||
      (!includeZero && row.onHandQty + row.inTransitQty === 0)
    )
      continue
    const group = groups.get(row.productId) ?? []
    group.push(row)
    groups.set(row.productId, group)
  }
  return [...groups.values()].map((group) => ({
    product: group[0],
    rows: group,
    totals: stockTotals(group),
    lowStores: group.filter((row) => row.lowStock).length,
  }))
}
export function sortStock<T>(
  rows: T[],
  product: (row: T) => StockRow,
  value: (row: T) => number | null,
  sort: string,
) {
  return [...rows].sort((a, b) => {
    if (sort === 'value') {
      const av = value(a),
        bv = value(b)
      if (av == null && bv != null) return 1
      if (bv == null && av != null) return -1
      if (av != null && bv != null && av !== bv) return bv - av
    }
    return (
      product(a).partName.localeCompare(product(b).partName, 'vi') ||
      product(a).productId - product(b).productId
    )
  })
}
