/**
 * File: modules/transfers/ReceiptDocumentSummary.tsx
 * Loại: THÀNH PHẦN GIAO DIỆN của nhóm Điều chuyển — không phải màn hình.
 * Công dụng: Hiện chứng từ giao hàng của phiếu nhận điều chuyển (số, ngày chứng từ, người giao, biển số xe, người lập, tệp)
 * như màn chi tiết phiếu nhập. compact: một dòng ngắn trong thẻ phiếu ở trang chi tiết lệnh.
 */
import axiosClient from '../../shared/api/axiosClient'
import { date } from '../inventory/presentation'
import ReceiptDocuments from '../receiving/ReceiptDocuments'
import type { ReceiptDocumentInfo } from './types'

export default function ReceiptDocumentSummary({
  receipt,
  compact,
}: {
  /** id và transferOrderId (nếu có) dùng để tải lại link ảnh khi bấm xem. */
  receipt: ReceiptDocumentInfo & { id?: number; transferOrderId?: number }
  compact?: boolean
}) {
  const creator = receipt.createdBy?.fullName ?? receipt.createdByName ?? null
  const files = receipt.documents ?? []
  const fields = [
    receipt.deliveryDocumentNo && {
      label: 'Số chứng từ',
      value: receipt.deliveryDocumentNo,
    },
    receipt.deliveryDocumentDate && {
      label: 'Ngày chứng từ',
      value: date(receipt.deliveryDocumentDate),
    },
    receipt.delivererName && {
      label: 'Người giao hàng',
      value: receipt.delivererName,
    },
    receipt.vehiclePlateNo && {
      label: 'Biển số xe',
      value: receipt.vehiclePlateNo,
    },
    creator && { label: 'Người lập phiếu', value: creator },
  ].filter((field): field is { label: string; value: string } => !!field)
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
  if (!fields.length && !files.length) return null
  return (
    <div className="tf-receipt-docs">
      <dl className="tf-detail-meta">
        {fields.map((field) => (
          <div key={field.label}>
            <dt>{field.label}</dt>
            <dd>{field.value}</dd>
          </div>
        ))}
      </dl>
      {files.length > 0 && (
        <div className="tf-receipt-doc-files">
          {/* PM 17/11: cùng kiểu xem ảnh với phiếu nhập NCC (tên ảnh + nút, bấm mới tải link mới). */}
          <ReceiptDocuments
            receiptId={receipt.id ?? 0}
            documents={files}
            label="ảnh nhận hàng"
            reload={async () => {
              if (!receipt.id || !receipt.transferOrderId) return files
              const { data } = await axiosClient.get<ReceiptDocumentInfo>(
                `/transfer-orders/${receipt.transferOrderId}/receipts/${receipt.id}`,
              )
              return data.documents ?? []
            }}
          />
        </div>
      )}
    </div>
  )
}
