/**
 * File: modules/receiving/DeliveryDocumentFields.tsx
 * Loại: THÀNH PHẦN DÙNG CHUNG — không phải màn hình.
 * Công dụng: Bộ trường "Chứng từ giao hàng" của phiếu nhận (Số chứng từ, Ngày chứng từ, Thời điểm hàng đến, Người giao hàng,
 * Biển số xe, tệp chứng từ). Dùng cho phiếu nhập từ PO và phiếu nhận hàng điều chuyển; kiểm tra và tải tệp ở useDeliveryDocuments.
 */
import ReceiptImage from './ReceiptImage'
import {
  receiptDocumentUploadEnabled,
  type DeliveryDocuments,
} from './useDeliveryDocuments'
import './receiving.css'

/** Các ô nhập chứng từ giao hàng; đặt trong form có onInvalid dùng invalidMessage. */
export default function DeliveryDocumentFields({
  state,
  disabled,
  defaultDocumentNo,
}: {
  state: DeliveryDocuments
  disabled?: boolean
  /** Số chứng từ điền sẵn, ví dụ mã lệnh điều chuyển; người lập sửa được. */
  defaultDocumentNo?: string
}) {
  const { dateLimits, refreshDateLimits, images, setImages } = state
  return (
    <div className="receiving-layout-fields">
      <label>
        Số chứng từ{' '}
        <input
          name="documentNo"
          required
          maxLength={50}
          defaultValue={defaultDocumentNo}
          placeholder="Nhập số chứng từ"
        />
      </label>
      <label>
        Ngày chứng từ
        <input
          name="documentDate"
          type="date"
          max={dateLimits.date}
          onFocus={refreshDateLimits}
          onChange={refreshDateLimits}
          required
        />
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
      </label>
      <label>
        Người giao hàng <input name="delivererName" maxLength={100} />
      </label>
      <label>
        Biển số xe <input name="vehiclePlateNo" maxLength={20} />
      </label>
      <label className="receiving-layout-wide receiving-dropzone">
        <strong>Chứng từ giao hàng</strong>
        {receiptDocumentUploadEnabled ? (
          <>
            <span>Chọn ảnh hoặc PDF chứng từ để đính kèm</span>
            <input
              name="documents"
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              multiple
              required
              disabled={disabled}
              onChange={(event) => {
                const files = Array.from(event.currentTarget.files ?? [])
                setImages(
                  files
                    .filter((file) => file.type.startsWith('image/'))
                    .map((file) => ({
                      src: URL.createObjectURL(file),
                      name: file.name,
                    })),
                )
              }}
            />
          </>
        ) : (
          <span>Tải tệp tạm thời được tắt trong môi trường dev.</span>
        )}
      </label>
      {!!images.length && (
        <ul
          className="receiving-layout-wide receiving-document-list"
          aria-label="Ảnh chứng từ đã chọn"
        >
          {images.map(({ src, name }) => (
            <li key={src}>
              <ReceiptImage src={src} name={name} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
