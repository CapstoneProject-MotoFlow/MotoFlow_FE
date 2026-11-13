/**
 * File: shared/hooks/useFormValidation.ts
 * Loại: THÀNH PHẦN / XỬ LÝ HỖ TRỢ — không phải màn hình độc lập.
 * Công dụng: Kiểm tra form bằng tiếng Việt thay cho bong bóng lỗi tiếng Anh của trình duyệt.
 * Form đặt noValidate và giữ required/min/max (vẫn dùng cho trợ năng); khi gửi, hook đọc validity
 * của từng ô và trả câu báo tiếng Việt để hiện ngay dưới ô bằng <FieldError />.
 *
 * Tùy chỉnh trên từng ô (không bắt buộc):
 * - data-label: tên ô dùng trong câu báo (mặc định lấy aria-label hoặc chữ của <label> bao ngoài).
 * - data-required-message / data-min-message / data-max-message: câu báo riêng.
 */
import { useCallback, useState, type FormEvent } from 'react'

type Field = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
export type FieldErrors = Record<string, string>

const numberFormat = new Intl.NumberFormat('vi-VN')

/** Khóa của ô trong bảng lỗi: name, rồi id, rồi aria-label. */
export function fieldKey(field: Element) {
  return (
    field.getAttribute('name') ||
    field.getAttribute('id') ||
    field.getAttribute('aria-label') ||
    ''
  )
}

function fieldLabel(field: Field) {
  const own = field.dataset.label || field.getAttribute('aria-label')
  if (own) return own
  const label = field.closest('label')
  if (!label) return fieldKey(field) || 'thông tin này'
  // Chỉ lấy chữ trực tiếp của <label>, bỏ chữ của ô và các option bên trong.
  const text = Array.from(label.childNodes)
    .filter(
      (node) =>
        node.nodeType === Node.TEXT_NODE ||
        (node instanceof HTMLElement &&
          !node.matches('input, select, textarea, small, [role="alert"]')),
    )
    .map((node) => node.textContent ?? '')
    .join(' ')
    .replace(/\*/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return text || fieldKey(field) || 'thông tin này'
}

const lower = (text: string) => text.charAt(0).toLowerCase() + text.slice(1)
const upper = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

function today() {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date())
}

function formatLimit(field: Field, value: string) {
  if (field instanceof HTMLInputElement && field.type === 'date')
    return value === today() ? 'hôm nay' : value.split('-').reverse().join('/')
  if (field instanceof HTMLInputElement && field.type === 'datetime-local') {
    const [day, time = ''] = value.split('T')
    return day.split('-').reverse().join('/') + ' ' + time.slice(0, 5)
  }
  const n = Number(value)
  return Number.isFinite(n) ? numberFormat.format(n) : value
}

/** fieldMessage: Câu báo tiếng Việt cho ô đang sai; ô hợp lệ trả chuỗi rỗng. */
export function fieldMessage(field: Field) {
  const v = field.validity
  if (v.valid) return ''
  const label = fieldLabel(field)
  const data = field.dataset
  if (v.valueMissing)
    return (
      data.requiredMessage ||
      (field instanceof HTMLSelectElement ||
      (field instanceof HTMLInputElement &&
        (field.type === 'checkbox' ||
          field.type === 'radio' ||
          field.type === 'file'))
        ? 'Vui lòng chọn ' + lower(label)
        : 'Vui lòng nhập ' + lower(label))
    )
  if (v.badInput || v.typeMismatch) return upper(label) + ' không hợp lệ'
  if (field instanceof HTMLInputElement) {
    if (v.rangeUnderflow)
      return (
        data.minMessage ||
        upper(label) +
          ' phải từ ' +
          formatLimit(field, field.min) +
          (field.type.startsWith('date') ? ' trở đi' : ' trở lên')
      )
    if (v.rangeOverflow)
      return (
        data.maxMessage ||
        upper(label) +
          (field.type.startsWith('date') ? ' không được sau ' : ' tối đa ') +
          formatLimit(field, field.max)
      )
    if (v.stepMismatch)
      return Number(field.step) === 1
        ? upper(label) + ' phải là số nguyên'
        : upper(label) + ' không đúng bước ' + field.step
  }
  if (v.tooLong)
    return (
      upper(label) + ' tối đa ' + field.getAttribute('maxlength') + ' ký tự'
    )
  if (v.tooShort)
    return (
      upper(label) +
      ' cần ít nhất ' +
      field.getAttribute('minlength') +
      ' ký tự'
    )
  if (v.patternMismatch) return upper(label) + ' không đúng định dạng'
  return upper(label) + ' không hợp lệ'
}

function fieldsOf(form: HTMLFormElement) {
  return Array.from(form.elements).filter(
    (el): el is Field =>
      (el instanceof HTMLInputElement ||
        el instanceof HTMLSelectElement ||
        el instanceof HTMLTextAreaElement) &&
      !el.disabled &&
      el.willValidate,
  )
}

/**
 * useFormValidation: check(form) trả true khi form hợp lệ; nếu không, lưu câu báo theo khóa ô và đưa con trỏ tới ô sai đầu tiên.
 * onInput gắn vào <form> để xóa lỗi của ô vừa sửa.
 */
export function useFormValidation() {
  const [errors, setErrors] = useState<FieldErrors>({})
  const check = useCallback((form: HTMLFormElement) => {
    const next: FieldErrors = {}
    let first: Field | null = null
    for (const field of fieldsOf(form)) {
      const message = fieldMessage(field)
      if (!message) continue
      const key = fieldKey(field)
      if (key && !next[key]) next[key] = message
      first ??= field
    }
    setErrors(next)
    first?.focus()
    return !first
  }, [])
  const onInput = useCallback((event: FormEvent<HTMLFormElement>) => {
    const target = event.target
    if (!(
      target instanceof HTMLInputElement ||
      target instanceof HTMLSelectElement ||
      target instanceof HTMLTextAreaElement
    ))
      return
    const key = fieldKey(target)
    setErrors((current) => {
      if (!key || !current[key]) return current
      const message = fieldMessage(target)
      if (message === current[key]) return current
      const next = { ...current }
      if (message) next[key] = message
      else delete next[key]
      return next
    })
  }, [])
  const reset = useCallback(() => setErrors({}), [])
  return { errors, check, onInput, reset }
}
