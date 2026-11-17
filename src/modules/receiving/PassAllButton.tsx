/**
 * File: modules/receiving/PassAllButton.tsx
 * Loại: THÀNH PHẦN DÙNG CHUNG — không phải màn hình.
 * Công dụng: Nút "Đạt đủ" của một dòng trong bảng kiểm nhận, dùng chung cho phiếu nhập NCC và phiếu nhận
 * điều chuyển (PM 17/11: thay ô tích nhỏ bằng nút to, dễ bấm trên màn cảm ứng). Đang bật thì bấm lần nữa để bỏ.
 */
import './receiving.css'

export default function PassAllButton({
  sku,
  pressed,
  disabled,
  onToggle,
}: {
  sku: string
  /** Dòng đang đúng "đạt đủ": số đạt bằng số theo chứng từ/đã xuất, giao sai và hư hỏng bằng 0. */
  pressed: boolean
  disabled?: boolean
  onToggle: (pressed: boolean) => void
}) {
  return (
    <button
      type="button"
      className={
        'mf-btn mf-btn--secondary receiving-pass-all' +
        (pressed ? ' is-pressed' : '')
      }
      aria-label={'Đạt đủ ' + sku}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={() => onToggle(!pressed)}
    >
      {pressed ? '✓ Đạt đủ' : 'Đạt đủ'}
    </button>
  )
}
