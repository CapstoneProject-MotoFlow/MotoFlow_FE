import type { PrintLayout } from '../types'

export const printLayouts: Record<PrintLayout, string> = {
  SMALL: 'Phiếu nhỏ (80mm)',
  LARGE: 'Phiếu A5',
}

/**
 * Chrome ignores `size: 80mm auto`, so the small slip gets an explicit height:
 * the measured content height plus the 3 mm top and bottom margins.
 * Without a measurement it falls back to a full A4-length page.
 */
export function pageCss(layout: PrintLayout | null, heightMm?: number): string {
  switch (layout) {
    case 'SMALL': {
      const height =
        heightMm != null && Number.isFinite(heightMm) && heightMm > 0
          ? Math.ceil(heightMm + 6)
          : 297
      return `@media print { @page { size: 80mm ${height}mm; margin: 3mm } }`
    }
    case 'LARGE':
      return '@media print { @page { size: A5; margin: 8mm } }'
    default:
      return ''
  }
}

export function parseLayout(value: string | null): PrintLayout | null {
  return value === 'SMALL' || value === 'LARGE' ? value : null
}

/** Print request params: a layout is only sent for the sales invoice form. */
export function printParams(
  selected: string | undefined,
  layout: PrintLayout | null,
): Record<string, string | undefined> {
  return {
    form: selected,
    layout: selected === 'SALES_INVOICE' && layout ? layout : undefined,
  }
}

/**
 * Order amount the customer still owes at the till, after the deposit.
 * The backend's amountDue is the unpaid balance, so it is not used for display.
 */
export function amountAfterDeposit(
  totals: { total: number | null; deposit: number | null } | null,
): number {
  return Math.max(0, (totals?.total ?? 0) - (totals?.deposit ?? 0))
}

export function paymentTitle(
  payment: { paymentType: string } | null,
  fallback: string,
  title?: string | null,
): string {
  if (title) return title
  if (!payment) return fallback
  switch (payment.paymentType) {
    case 'REFUND':
    case 'DEPOSIT_REFUND':
      return 'Phiếu chi'
    case 'DEPOSIT':
      return 'Phiếu thu tiền cọc'
    default:
      return 'Phiếu thu'
  }
}
