import type { SalesLine } from './salesModel'

/** Số lấy ngay của một dòng; dòng chưa có lineId hoặc chưa nhập thì coi như 0. */
function nowQtyOf(
  qtyByLineId: Record<number, number>,
  line: { lineId?: number },
) {
  return line.lineId == null ? 0 : (qtyByLineId[line.lineId] ?? 0)
}

/**
 * Đơn giá ước tính: giá bán lẻ hiện tại trừ chiết khấu (làm tròn từng đơn vị như BE);
 * chỉ khi không có giá bán lẻ mới dùng giá thực tế. BE luôn tính lại bằng giá hiện tại,
 * nên đây chỉ là số để hiển thị và gợi ý.
 */
function unitEstimate(
  line: Pick<SalesLine, 'actualUnitPrice' | 'retailPrice'>,
  discountRate: number,
): number | null {
  if (line.retailPrice != null)
    return Math.round(line.retailPrice * (1 - discountRate / 100))
  return line.actualUnitPrice ?? null
}

/** Tổng ước tính của một dòng (qty × đơn giá ước tính); thiếu giá thì null. */
export function estimateLineTotal(
  qty: number,
  line: Pick<SalesLine, 'actualUnitPrice' | 'retailPrice'>,
  discountRate: number,
): number | null {
  const unit = unitEstimate(line, discountRate)
  return unit == null ? null : qty * unit
}

/** Tổng ước tính đơn tách (các dòng có lấy ngay > 0); một dòng lấy ngay thiếu giá thì null. */
export function estimateReleaseTotal(
  lines: Pick<SalesLine, 'lineId' | 'actualUnitPrice' | 'retailPrice'>[],
  qtyByLineId: Record<number, number>,
  discountRate: number,
): number | null {
  let total = 0
  for (const line of lines) {
    const qty = nowQtyOf(qtyByLineId, line)
    if (qty <= 0) continue
    const part = estimateLineTotal(qty, line, discountRate)
    if (part == null) return null
    total += part
  }
  return total
}

/** Lần chuyển cuối: mọi dòng đều lấy ngay đúng số đã đặt (không còn gì chờ). */
export function isLastRelease(
  lines: Pick<SalesLine, 'lineId' | 'requested'>[],
  qtyByLineId: Record<number, number>,
): boolean {
  return (
    lines.length > 0 &&
    lines.every(
      (line) =>
        line.lineId != null && nowQtyOf(qtyByLineId, line) === line.requested,
    )
  )
}

/** Các dòng nhập lấy ngay vượt số còn bán được (chỉ xét dòng có số còn bán được). */
export function shortLines(
  lines: Pick<SalesLine, 'lineId' | 'sellableQty'>[],
  qtyByLineId: Record<number, number>,
): number[] {
  return lines
    .filter(
      (line) =>
        line.lineId != null &&
        line.sellableQty != null &&
        nowQtyOf(qtyByLineId, line) > line.sellableQty,
    )
    .map((line) => line.lineId as number)
}

export type ReleaseDeposit = {
  /** Số đề nghị trừ cọc (không lần cuối: min(cọc còn lại, tổng ước tính)). */
  suggested: number
  /** Trần cho số trừ cọc; null khi không giới hạn được. */
  max: number | null
  /** Lần cuối: số trừ cọc khóa, không cho sửa. */
  locked: boolean
  /** depositAmount gửi lên BE; null thì BE tự áp dụng. */
  send: number | null
  /** Tiền cọc thừa phải hoàn lại khách (chỉ lần cuối). */
  refund: number
}

/**
 * Cọc khi chuyển đơn: chuyển một phần thì người dùng chọn số trừ cọc (≤ max);
 * lần cuối thì BE trừ hết cọc (khóa), phần cọc thừa hoàn lại khách.
 */
export function releaseDeposit({
  remaining,
  estimatedTotal,
  isLast,
  typed,
}: {
  remaining: number
  estimatedTotal: number | null
  isLast: boolean
  typed: number | null
}): ReleaseDeposit {
  if (remaining <= 0)
    return { suggested: 0, max: 0, locked: false, send: null, refund: 0 }
  if (!isLast) {
    const max =
      estimatedTotal == null ? remaining : Math.min(remaining, estimatedTotal)
    const wanted = typed ?? max
    return {
      suggested: max,
      max,
      locked: false,
      send: Math.min(max, Math.max(0, wanted)),
      refund: 0,
    }
  }
  const suggested =
    estimatedTotal == null ? remaining : Math.min(remaining, estimatedTotal)
  return {
    suggested,
    max: suggested,
    locked: true,
    // Không gửi số cụ thể: BE tự áp dụng đúng số được phép, tránh lệch MSG326 do ước tính.
    send: null,
    refund:
      estimatedTotal == null ? 0 : Math.max(0, remaining - estimatedTotal),
  }
}

const moneyFormat = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
})

/** Hoàn tiền cọc lần cuối: cần khi BE báo có phần thừa (MSG328) hoặc ước tính thấy thừa. */
export type RefundInput = {
  needed: boolean
  method: 'CASH' | 'BANK_TRANSFER'
  reference: string
  paid: boolean
}

export type ReleaseBody = {
  lines: { lineId: number | undefined; nowQty: number }[]
  /** Chỉ có ở lần chuyển một phần (BE: null = 0). */
  depositAmount?: number | null
  /** Chỉ có ở lần chuyển cuối khi cần hoàn cọc thừa. */
  depositRefund?: {
    paymentMethod: 'CASH' | 'BANK_TRANSFER'
    transactionReference: string | null
    paidToCustomer: true
  }
}

/**
 * Body POST /sales-orders/{id}/release. Không có cọc (hoặc cọc đã hết) thì chỉ có lines;
 * lần cuối không gửi depositAmount (BE tự áp dụng), chỉ gửi depositRefund khi cần hoàn.
 */
export function buildReleaseBody({
  lines,
  deposit,
  refund,
}: {
  lines: { lineId: number | undefined; nowQty: number }[]
  deposit: { remaining: number; isLast: boolean; send: number | null } | null
  refund: RefundInput
}): ReleaseBody {
  const body: ReleaseBody = {
    lines: lines.map(({ lineId, nowQty }) => ({ lineId, nowQty })),
  }
  if (!deposit || deposit.remaining <= 0) return body
  if (deposit.isLast) {
    if (refund.needed)
      body.depositRefund = {
        paymentMethod: refund.method,
        transactionReference:
          refund.method === 'BANK_TRANSFER' ? refund.reference.trim() : null,
        paidToCustomer: true,
      }
    return body
  }
  body.depositAmount = deposit.send
  return body
}

/**
 * Các lý do chặn nút "Chuyển sang soạn" (rỗng = được gửi). Dòng vượt tồn, cọc quá hạn,
 * trừ cọc một phần vượt trần, lần cuối còn cọc chưa xác minh, hoàn tiền thiếu mã/xác nhận.
 */
export function releaseBlockers({
  shortCount,
  isLast,
  deposit,
  typed,
  max,
  estimatedTotal,
  refund,
}: {
  shortCount: number
  isLast: boolean
  deposit: { remaining: number; unverified: number; status: string } | null
  /** Số người dùng nhập cho "Trừ cọc vào đơn này" (null = chưa sửa). */
  typed: number | null
  max: number | null
  estimatedTotal: number | null
  refund: RefundInput
}): string[] {
  const blockers: string[] = []
  if (shortCount > 0)
    blockers.push(
      'Có dòng vượt số còn bán được. Giảm số lấy ngay hoặc để chờ tiếp.',
    )
  if (!deposit || deposit.remaining <= 0) return blockers
  if (deposit.status === 'EXPIRED')
    blockers.push('Cọc đã quá hạn, đơn không chuyển sang soạn được.')
  if (!isLast) {
    if (typed != null && max != null && typed > max)
      blockers.push(
        estimatedTotal == null
          ? `Tối đa ${moneyFormat.format(max)} (cọc còn lại; chưa ước tính được tổng đơn, hệ thống sẽ kiểm tra lại).`
          : `Tối đa ${moneyFormat.format(max)} (cọc còn lại và tổng đơn tách).`,
      )
    return blockers
  }
  if (deposit.unverified > 0)
    blockers.push(
      `Còn ${moneyFormat.format(deposit.unverified)} tiền cọc chưa xác minh. Xác minh hết trước khi chuyển lần cuối.`,
    )
  if (refund.needed) {
    if (refund.method === 'BANK_TRANSFER' && !refund.reference.trim())
      blockers.push('Nhập mã giao dịch chuyển khoản hoàn tiền.')
    if (!refund.paid) blockers.push('Xác nhận đã trả tiền cho khách.')
  }
  return blockers
}

/** Lấy số tiền từ thông báo MSG328 (ví dụ "... 1.000.000 đ ..."); không đọc được thì null. */
export function parseSurplusFromMessage(message: string): number | null {
  const match = /(\d[\d.,\s]*\d|\d)\s*(?:đ|₫)/i.exec(message)
  if (!match) return null
  const value = Number(match[1].replace(/[.,\s]/g, ''))
  return Number.isSafeInteger(value) && value > 0 ? value : null
}
