/**
 * File: shared/ui/InfoTip.tsx
 * Loại: THÀNH PHẦN GIAO DIỆN DÙNG CHUNG — không phải màn hình.
 * Công dụng: Biểu tượng (i) đặt cạnh tiêu đề hoặc nhãn; rê chuột (hoặc focus bằng bàn phím) để đọc giải thích ngắn,
 * thay cho một đoạn mô tả chiếm chỗ trên màn. Trước đây là Info riêng của báo cáo bán hàng (PM 23/11, UI-01).
 */
import Icon from './Icon'

export default function InfoTip({ text }: { text: string }) {
  return (
    <span
      className="mf-info-tip"
      title={text}
      aria-label={text}
      role="img"
      tabIndex={0}
    >
      <Icon name="info" />
    </span>
  )
}
