/**
 * File: shared/ui/Brand.tsx
 * Loại: THÀNH PHẦN GIAO DIỆN DÙNG CHUNG — không phải màn hình.
 * Công dụng: Logo và tên MotoFlow, hỗ trợ dạng gọn.
 */
type BrandProps = {
  compact?: boolean
}

/** Brand: Logo và tên MotoFlow, hỗ trợ dạng gọn. */
export default function Brand({ compact = false }: BrandProps) {
  return (
    <div className={`brand${compact ? ' brand-compact' : ''}`}>
      <span className="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none">
          <path
            d="M4 17V7l5 6 3-4 3 4 5-6v10"
            stroke="currentColor"
            strokeWidth="2.1"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span>MotoFlow</span>
    </div>
  )
}
