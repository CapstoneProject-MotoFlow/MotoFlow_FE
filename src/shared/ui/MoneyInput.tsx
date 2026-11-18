/**
 * File: shared/ui/MoneyInput.tsx
 * Loại: THÀNH PHẦN GIAO DIỆN dùng chung — không phải màn hình.
 * Công dụng: Ô nhập số tiền hiện dấu chấm ngăn cách hàng nghìn (gõ 200000 thấy "200.000").
 * Giá trị đưa ra ngoài chỉ gồm chữ số; con trỏ giữ đúng vị trí khi dấu chấm được chèn hoặc bỏ.
 * Ô là type="text" nên trình duyệt không kiểm min/max: màn dùng ô này tự kiểm khoảng giá trị khi gửi.
 */
import { useLayoutEffect, useRef, type InputHTMLAttributes } from 'react'

/** Chỉ giữ chữ số, bỏ số 0 thừa ở đầu ("007" → "7"). */
function moneyDigits(text: string) {
  return text.replace(/\D/g, '').replace(/^0+(?=\d)/, '')
}

/** "200000" → "200.000"; chuỗi rỗng giữ rỗng. Không đổi sang Number nên số lớn không mất chính xác. */
function groupMoneyDigits(digits: string) {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

type MoneyInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'value' | 'defaultValue' | 'onChange' | 'type' | 'inputMode'
> & {
  /** Chuỗi chữ số, ví dụ "200000". */
  value: string
  onValueChange: (digits: string) => void
}

export default function MoneyInput({
  value,
  onValueChange,
  ...rest
}: MoneyInputProps) {
  const ref = useRef<HTMLInputElement>(null)
  // Số chữ số nằm bên trái con trỏ sau lần gõ gần nhất; null khi không cần đặt lại con trỏ.
  const digitsBeforeCaret = useRef<number | null>(null)
  useLayoutEffect(() => {
    const input = ref.current
    const wanted = digitsBeforeCaret.current
    digitsBeforeCaret.current = null
    if (!input || wanted === null || document.activeElement !== input) return
    let seen = 0
    let position = 0
    while (position < input.value.length && seen < wanted) {
      if (/\d/.test(input.value[position])) seen++
      position++
    }
    input.setSelectionRange(position, position)
  })
  return (
    <input
      autoComplete="off"
      {...rest}
      ref={ref}
      type="text"
      inputMode="numeric"
      value={groupMoneyDigits(value)}
      onChange={(event) => {
        const input = event.target
        const left = input.value.slice(
          0,
          input.selectionStart ?? input.value.length,
        )
        digitsBeforeCaret.current = moneyDigits(left).length
        onValueChange(moneyDigits(input.value))
      }}
    />
  )
}
