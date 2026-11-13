/**
 * File: shared/ui/FieldError.tsx
 * Loại: THÀNH PHẦN GIAO DIỆN DÙNG CHUNG — không phải màn hình.
 * Công dụng: Dòng báo lỗi tiếng Việt ngay dưới một ô nhập (đi cùng useFormValidation).
 */
export default function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return (
    <small className="mf-field-error" role="alert">
      {message}
    </small>
  )
}
