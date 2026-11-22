import type { DepositStatus } from './salesApi'

/** Ngày hôm nay (YYYY-MM-DD) theo giờ Việt Nam, không phụ thuộc múi giờ của máy. */
export function todayIso(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(now)
}

/** Cộng số ngày vào ngày YYYY-MM-DD bằng toán học UTC thuần (không parse theo giờ địa phương). */
export function addDaysIso(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day + days))
    .toISOString()
    .slice(0, 10)
}

export type DepositInput = {
  amount: string
  method: 'CASH' | 'BANK_TRANSFER'
  reference: string
  expiresOn: string
  tendered?: string
  verified?: boolean
}

/** Chuỗi tiền do người dùng nhập ("1.500.000 đ", "1,500,000") thành số nguyên VND; không hợp lệ → null. */
export function parseMoney(text: string): number | null {
  const digits = text.replace(/[.,\s₫đĐ]/g, '')
  if (!/^\d+$/.test(digits)) return null
  const value = Number(digits)
  return Number.isSafeInteger(value) ? value : null
}

const MAX_DEPOSIT = 100_000_000_000

/** Kiểm tra form đặt cọc; trả về thông báo tiếng Việt đầu tiên gặp lỗi hoặc null khi hợp lệ. */
export function validateDeposit(
  d: DepositInput,
  today: string,
  opts: { requireExpiry: boolean },
): string | null {
  const amount = parseMoney(d.amount)
  if (amount == null || amount <= 0)
    return 'Vui lòng nhập số tiền cọc lớn hơn 0.'
  if (amount > MAX_DEPOSIT)
    return 'Số tiền cọc không được vượt 100.000.000.000 đ.'
  if (opts.requireExpiry) {
    if (!d.expiresOn) return 'Vui lòng chọn hạn cọc.'
    if (d.expiresOn <= today) return 'Hạn cọc phải sau hôm nay.'
  }
  if (d.method === 'BANK_TRANSFER' && !d.reference.trim())
    return 'Vui lòng nhập mã giao dịch chuyển khoản.'
  if (d.method === 'CASH' && d.tendered?.trim()) {
    const tendered = parseMoney(d.tendered)
    if (tendered == null || tendered < amount)
      return 'Tiền khách đưa phải đủ số tiền cọc.'
  }
  return null
}

/** Body của POST /sales-orders/{id}/deposits (BE: không gửi bằng chứng, evidence luôn rỗng). */
export type DepositRequest = {
  amount: number
  tenderedAmount: number | null
  paymentMethod: 'CASH' | 'BANK_TRANSFER'
  transactionReference: string | null
  verified: boolean
  /** Chỉ có ở lần cọc đầu tiên (BE yêu cầu, YYYY-MM-DD). */
  depositExpiresOn?: string
  expectedDepositRecorded: number
  evidence: []
}

/**
 * Body ghi cọc. Gọi sau khi validateDeposit đã đạt: số tiền không hợp lệ được coi là 0 (BE sẽ từ chối).
 * withExpiry=false (cọc bổ sung) thì bỏ hẳn khóa depositExpiresOn.
 */
export function depositPayload(
  d: DepositInput,
  expectedDepositRecorded: number,
  opts: { withExpiry: boolean },
): DepositRequest {
  const tendered = d.method === 'CASH' ? parseMoney(d.tendered ?? '') : null
  return {
    amount: parseMoney(d.amount) ?? 0,
    tenderedAmount: tendered ? tendered : null,
    paymentMethod: d.method,
    transactionReference:
      d.method === 'BANK_TRANSFER' ? d.reference.trim() : null,
    verified: d.verified ?? true,
    ...(opts.withExpiry ? { depositExpiresOn: d.expiresOn } : {}),
    expectedDepositRecorded,
    evidence: [],
  }
}

function vnd(amount: number) {
  return (
    new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(
      amount,
    ) + ' đ'
  )
}

/**
 * Nhãn cọc trên danh sách đơn. Chỉ dựa vào depositStatus/depositRemaining do BE trả về;
 * danh sách không có số tiền đã mất cọc nên nhãn "Mất cọc" không kèm số tiền.
 */
export function depositBadge(row: {
  status?: string
  depositStatus?: string | null
  depositRemaining?: number | null
}): { text: string; tone: 'info' | 'danger' | 'muted' } | null {
  switch (row.depositStatus) {
    case 'ACTIVE':
      return row.depositRemaining != null && row.depositRemaining > 0
        ? { text: 'Đã cọc ' + vnd(row.depositRemaining), tone: 'info' }
        : null
    case 'EXPIRED':
      return { text: 'Quá hạn cọc', tone: 'danger' }
    case 'FORFEITED':
      return { text: 'Mất cọc', tone: 'muted' }
    default:
      return null
  }
}

export const depositStatusLabels: Record<DepositStatus, string> = {
  NONE: 'Không có cọc',
  ACTIVE: 'Đang giữ cọc',
  EXPIRED: 'Quá hạn cọc',
  FORFEITED: 'Đã mất cọc',
  SETTLED: 'Đã dùng hết cọc',
}

/**
 * Mã đơn chờ để ghi cọc sau khi tạo đơn: lấy từ `split` (BE #79), hoặc chính đơn nếu đơn tạo ra là đơn chờ.
 * Không có đơn chờ thì null (không có gì để ghi cọc).
 */
export function depositTarget(result: {
  id: number
  status: string
  split?: { waitingOrderId: number | null } | null
}): number | null {
  return (
    result.split?.waitingOrderId ??
    (result.status === 'AWAITING_STOCK' ? result.id : null)
  )
}

export type DepositRoute = { to: string; notice?: string }

/**
 * Điểm đến sau khi thử ghi cọc: đã xác minh → in phiếu thu; chưa xác minh hoặc lỗi → chi tiết đơn chờ kèm thông báo.
 */
export function afterDepositRoute(
  outcome:
    | { ok: true; paymentId: number; verified: boolean }
    | { ok: false; message: string },
  waitingId: number,
): DepositRoute {
  if (!outcome.ok) {
    return {
      to: '/sales-orders/' + waitingId,
      notice:
        'Đơn đã tạo nhưng chưa ghi nhận được cọc: ' +
        outcome.message +
        '. Vui lòng thu cọc ở chi tiết đơn.',
    }
  }
  if (outcome.verified) {
    return { to: '/documents/PAYMENT/' + outcome.paymentId + '/print' }
  }
  return {
    to: '/sales-orders/' + waitingId,
    notice:
      'Đã ghi nhận cọc, chờ xác minh. In phiếu thu tiền cọc sau khi xác minh.',
  }
}
