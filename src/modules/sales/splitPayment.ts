/**
 * File: modules/sales/splitPayment.ts
 * Loại: XỬ LÝ NGHIỆP VỤ THUẦN — không phải màn hình, không import React.
 * Công dụng: Quy tắc thu tiền mặt + chuyển khoản trong một lần ghi thu, phía giao diện. Mirror các kiểm tra của
 * BE (SalesOrderSettlementServiceImpl.recordSplitPayment): MSG333, MSG181, MSG182, MSG154; BE vẫn là nơi quyết định.
 */

export const MAX_SPLIT_AMOUNT = 100_000_000_000

const vnd = new Intl.NumberFormat('vi-VN')

export type SplitPaymentField =
  'cash' | 'tendered' | 'transfer' | 'reference' | 'total'

export type SplitPaymentInput = {
  /** Số tiền mặt ghi thu. */
  cash: number
  /** Tiền khách đưa; null khi không nhập hoặc khi không thu tiền mặt. */
  tendered: number | null
  /** Số tiền chuyển khoản ghi thu. */
  transfer: number
  transactionReference: string
  /** money.payableNow của đơn, như người bán đã thấy. */
  payable: number
}

export type SplitPaymentCheck = {
  total: number
  /** Tiền thừa = khách đưa − tiền mặt; 0 khi chưa thu tiền mặt. */
  change: number
  errors: Partial<Record<SplitPaymentField, string>>
  valid: boolean
}

/** Chuỗi ô nhập → số tiền. Ô trống trả null; ký tự không phải chữ số bị bỏ. */
export function parseSplitAmount(text: string): number | null {
  const digits = text.replace(/[^0-9]/g, '')
  return digits === '' ? null : Number(digits)
}

export function splitPaymentCheck(input: SplitPaymentInput): SplitPaymentCheck {
  const { cash, tendered, transfer, payable } = input
  const reference = input.transactionReference.trim()
  const total = cash + transfer
  const errors: SplitPaymentCheck['errors'] = {}

  if (cash > MAX_SPLIT_AMOUNT)
    errors.cash = `Tiền mặt tối đa ${vnd.format(MAX_SPLIT_AMOUNT)} đ.`
  if (transfer > MAX_SPLIT_AMOUNT)
    errors.transfer = `Tiền chuyển khoản tối đa ${vnd.format(MAX_SPLIT_AMOUNT)} đ.`
  if (tendered !== null && tendered > MAX_SPLIT_AMOUNT)
    errors.tendered = `Tiền khách đưa tối đa ${vnd.format(MAX_SPLIT_AMOUNT)} đ.`

  if (total === 0)
    errors.total = 'Vui lòng nhập số tiền mặt hoặc tiền chuyển khoản lớn hơn 0.'
  else if (total > payable)
    errors.total = `Tổng thu không vượt số còn phải thu ${vnd.format(payable)} đ.`

  if (transfer > 0 && reference === '')
    errors.reference = 'Vui lòng nhập mã giao dịch của khoản chuyển khoản.'
  else if (reference.length > 100)
    errors.reference = 'Mã giao dịch tối đa 100 ký tự.'

  if (tendered !== null && (cash === 0 || tendered < cash))
    errors.tendered =
      'Tiền khách đưa chỉ ghi khi thu tiền mặt và không được nhỏ hơn tiền mặt thu.'

  return {
    total,
    change: tendered !== null && cash > 0 ? Math.max(0, tendered - cash) : 0,
    errors,
    valid: Object.keys(errors).length === 0,
  }
}

const fieldByKey: Record<string, SplitPaymentField> = {
  cashAmount: 'cash',
  tenderedAmount: 'tendered',
  transferAmount: 'transfer',
  transactionReference: 'reference',
}

const fieldByCode: Record<string, SplitPaymentField> = {
  MSG154: 'reference',
  MSG181: 'total',
  MSG333: 'total',
  MSG182: 'tendered',
  MSG151: 'reference',
  MSG347: 'total',
}

/**
 * Lỗi BE gắn được vào một ô: theo tên trường (fieldErrors) hoặc mã thông báo. Lỗi khác (MSG194 đơn đã đổi,
 * MSG180 hết phải thu, mạng) trả null để hiện ở khung lỗi chung.
 */
export function splitPaymentErrorField(body: {
  code?: string
  fieldErrors?: Record<string, string>
}): SplitPaymentField | null {
  for (const key of Object.keys(body.fieldErrors ?? {}))
    if (fieldByKey[key]) return fieldByKey[key]
  return body.code ? (fieldByCode[body.code] ?? null) : null
}

/** Chuỗi các ô nhập của hộp Thu tiền (chưa parse). */
export type SplitPaymentState = {
  cashText: string
  /** Khách đưa; để trống thì coi như bằng tiền mặt (tiền thừa 0). */
  tenderedText: string
  transferText: string
  reference: string
}

/** Số đã đọc từ các ô nhập và kết quả kiểm tra. tendered là giá trị hiệu lực, null khi không thu tiền mặt. */
export function splitPaymentFigures(state: SplitPaymentState, payable: number) {
  const cash = parseSplitAmount(state.cashText) ?? 0
  const transfer = parseSplitAmount(state.transferText) ?? 0
  const typedTendered = parseSplitAmount(state.tenderedText)
  const tendered = cash === 0 ? null : (typedTendered ?? cash)
  const check = splitPaymentCheck({
    cash,
    tendered,
    transfer,
    transactionReference: state.reference,
    payable,
  })
  return { cash, transfer, typedTendered, check }
}

/**
 * Nội dung gửi POST /sales-orders/{id}/payments/split. tenderedAmount chỉ gửi khi người bán đã gõ khách đưa
 * và có thu tiền mặt; còn lại gửi null (BE không ghi khách đưa).
 */
export function splitPaymentBody(state: SplitPaymentState, payable: number) {
  const { cash, transfer, typedTendered } = splitPaymentFigures(state, payable)
  return {
    cashAmount: cash,
    tenderedAmount: cash > 0 ? typedTendered : null,
    transferAmount: transfer,
    transactionReference: transfer > 0 ? state.reference.trim() : null,
    expectedPayable: payable,
    evidence: [],
  }
}

/**
 * Góp ý 23/11, chế độ Thanh toán: luôn thu đủ. Người bán chỉ nhập chuyển khoản (mặc định 0) và khách đưa; tiền mặt
 * thu = payableNow − chuyển khoản. Chuyển khoản vượt payableNow thì chặn ở ô chuyển khoản.
 */
export function fullPaymentState(
  state: SplitPaymentState,
  payable: number,
): SplitPaymentState {
  const transfer = parseSplitAmount(state.transferText) ?? 0
  return { ...state, cashText: String(Math.max(0, payable - transfer)) }
}

export function fullPaymentFigures(state: SplitPaymentState, payable: number) {
  const figures = splitPaymentFigures(fullPaymentState(state, payable), payable)
  if (figures.transfer <= payable) return figures
  const errors: SplitPaymentCheck['errors'] = { ...figures.check.errors }
  delete errors.total
  errors.transfer = `Chuyển khoản không vượt số còn phải thu ${vnd.format(payable)} đ.`
  return { ...figures, check: { ...figures.check, errors, valid: false } }
}

/**
 * Plan 23/11 (3b), chế độ Ghi nợ: khách có thể trả trước một phần bằng tiền mặt và/hoặc chuyển khoản; số ghi nợ =
 * còn phải trả − trả trước, phải còn lớn hơn 0 (BE MSG347). Không trả trước thì ghi nợ toàn bộ.
 */
export function creditPrepaymentFigures(
  state: SplitPaymentState,
  remaining: number,
) {
  const figures = splitPaymentFigures(state, remaining)
  const errors: SplitPaymentCheck['errors'] = { ...figures.check.errors }
  delete errors.total
  const prepaid = figures.check.total
  if (prepaid > 0 && prepaid >= remaining)
    errors.total = `Trả trước đủ hoặc hơn số còn phải trả ${vnd.format(remaining)} đ. Trả đủ thì dùng Thanh toán.`
  return {
    ...figures,
    credit: Math.max(0, remaining - prepaid),
    check: {
      ...figures.check,
      errors,
      valid: Object.keys(errors).length === 0,
    },
  }
}

/** Phần trả trước và số ghi nợ gửi kèm POST /sales-orders/{id}/credit. */
export function creditPrepaymentBody(
  state: SplitPaymentState,
  remaining: number,
) {
  const { cash, transfer, typedTendered, credit } = creditPrepaymentFigures(
    state,
    remaining,
  )
  return {
    creditAmount: credit,
    cashAmount: cash,
    tenderedAmount: cash > 0 ? typedTendered : null,
    transferAmount: transfer,
    transactionReference: transfer > 0 ? state.reference.trim() : null,
  }
}
