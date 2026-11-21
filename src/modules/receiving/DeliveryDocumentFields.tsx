/**
 * File: modules/receiving/DeliveryDocumentFields.tsx
 * Loại: THÀNH PHẦN DÙNG CHUNG — không phải màn hình.
 * Công dụng: Bộ trường "Chứng từ giao hàng" của phiếu nhận (Số chứng từ, Ngày chứng từ, Thời điểm hàng đến, Người giao hàng,
 * Biển số xe, tệp chứng từ). Dùng cho phiếu nhập từ PO và phiếu nhận hàng điều chuyển; kiểm tra và tải tệp ở useDeliveryDocuments.
 */
import {
  receiptDocumentUploadEnabled,
  type DeliveryDocuments,
} from './useDeliveryDocuments'
import FieldError from '../../shared/ui/FieldError'
import LocalizedFileInput from '../../shared/ui/LocalizedFileInput'
import type { FieldErrors } from '../../shared/hooks/useFormValidation'
import './receiving.css'

/** Các ô nhập chứng từ giao hàng; đặt trong form có onInvalid dùng invalidMessage. */
export default function DeliveryDocumentFields({
  state,
  disabled,
  defaultDocumentNo,
  errors,
}: {
  state: DeliveryDocuments
  disabled?: boolean
  /** Số chứng từ điền sẵn, ví dụ mã lệnh điều chuyển; người lập sửa được. */
  defaultDocumentNo?: string
  /** Lỗi tiếng Việt theo tên ô (từ useFormValidation) để hiện ngay dưới ô. */
  errors?: FieldErrors
}) {
  const { dateLimits, refreshDateLimits } = state
  return (
    <div className="receiving-layout-fields">
      {/* PM 17/11: số và ngày chứng từ của phiếu nhập NCC không bắt buộc; ảnh chứng từ vẫn bắt buộc. */}
      <label>
        Số chứng từ (nếu có){' '}
        <input
          name="documentNo"
          maxLength={50}
          defaultValue={defaultDocumentNo}
          placeholder="Để trống nếu chứng từ không có số"
        />
        <FieldError message={errors?.documentNo} />
      </label>
      <label>
        Ngày chứng từ (nếu có)
        <input
          name="documentDate"
          type="date"
          max={dateLimits.date}
          onFocus={refreshDateLimits}
          onChange={refreshDateLimits}
        />
        <FieldError message={errors?.documentDate} />
      </label>
      <label>
        Thời điểm hàng đến
        <input
          name="arrivedAt"
          type="datetime-local"
          max={dateLimits.dateTime}
          onFocus={refreshDateLimits}
          onChange={refreshDateLimits}
        />
        <FieldError message={errors?.arrivedAt} />
      </label>
      <label>
        Người giao hàng <input name="delivererName" maxLength={100} />
      </label>
      <label>
        Biển số xe <input name="vehiclePlateNo" maxLength={20} />
      </label>
      <div className="receiving-layout-wide receiving-dropzone">
        <strong>Chứng từ giao hàng</strong>
        {receiptDocumentUploadEnabled ? (
          <>
            <span>Chọn ảnh hoặc PDF chứng từ để đính kèm</span>
            <LocalizedFileInput
              name="documents"
              data-label="Chứng từ giao hàng"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              multiple
              required
              disabled={disabled}
            />
            <FieldError message={errors?.documents} />
          </>
        ) : (
          <span>Tải tệp tạm thời được tắt trong môi trường dev.</span>
        )}
      </div>
    </div>
  )
}
