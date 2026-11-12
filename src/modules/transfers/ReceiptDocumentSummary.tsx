/**
 * File: modules/transfers/ReceiptDocumentSummary.tsx
 * Loại: THÀNH PHẦN GIAO DIỆN của nhóm Điều chuyển — không phải màn hình.
 * Công dụng: Hiện chứng từ giao hàng của phiếu nhận điều chuyển (số, ngày chứng từ, người giao, biển số xe, người lập, tệp)
 * như màn chi tiết phiếu nhập. compact: một dòng ngắn trong thẻ phiếu ở trang chi tiết lệnh.
 */
import { date } from '../inventory/presentation'
import ReceiptImage from '../receiving/ReceiptImage'
import type { ReceiptDocumentInfo } from './types'

export default function ReceiptDocumentSummary({
  receipt,
  compact,
}: {
  receipt: ReceiptDocumentInfo
  compact?: boolean
}) {
  const creator = receipt.createdBy?.fullName ?? receipt.createdByName ?? null
  const files = receipt.documents ?? []
  if (compact) {
    const parts = [
      receipt.deliveryDocumentNo && 'Chứng từ ' + receipt.deliveryDocumentNo,
      creator && 'Người lập ' + creator,
      files.length > 0 && files.length + ' tệp',
    ].filter(Boolean)
    return parts.length ? (
      <span className="tf-receipt-card-docs">{parts.join(' · ')}</span>
    ) : null
  }
  if (
    !receipt.deliveryDocumentNo &&
    !receipt.deliveryDocumentDate &&
    !creator &&
    !files.length
  )
    return null
  return (
    <div className="tf-receipt-docs">
      <dl className="tf-detail-meta">
        <div>
          <dt>Số chứng từ</dt>
          <dd>{receipt.deliveryDocumentNo || '—'}</dd>
        </div>
        <div>
          <dt>Ngày chứng từ</dt>
          <dd>{date(receipt.deliveryDocumentDate)}</dd>
        </div>
        <div>
          <dt>Người giao hàng</dt>
          <dd>{receipt.delivererName || '—'}</dd>
        </div>
        <div>
          <dt>Biển số xe</dt>
          <dd>{receipt.vehiclePlateNo || '—'}</dd>
        </div>
        <div>
          <dt>Người lập phiếu</dt>
          <dd>{creator || '—'}</dd>
        </div>
      </dl>
      {files.length > 0 && (
        <ul
          className="receiving-document-list tf-receipt-doc-files"
          aria-label="Chứng từ đính kèm"
        >
          {files.map((file) => (
            <li key={file.id}>
              {file.downloadUrl && file.contentType?.startsWith('image/') ? (
                <ReceiptImage
                  key={file.downloadUrl}
                  src={file.downloadUrl}
                  name={file.fileName}
                />
              ) : file.downloadUrl ? (
                <a href={file.downloadUrl} target="_blank" rel="noreferrer">
                  {file.fileName}
                </a>
              ) : (
                file.fileName
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
