/**
 * File: modules/receiving/useDeliveryDocuments.ts
 * Loại: XỬ LÝ HỖ TRỢ — không phải màn hình.
 * Công dụng: Kiểm tra và tải tệp cho bộ trường "Chứng từ giao hàng" (DeliveryDocumentFields) của phiếu nhận,
 * dùng chung cho phiếu nhập từ PO và phiếu nhận hàng điều chuyển.
 */
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { uploadAttachment } from '../../shared/api/upload'
import { receiptDateLimits, receiptDatesInFuture } from './receivingRules'

export const receiptDocumentUploadEnabled =
  import.meta.env.VITE_RECEIPT_UPLOAD_ENABLED !== 'false'

const futureDateMessage =
  'Ngày chứng từ và thời điểm hàng đến không được sau thời điểm hiện tại.'

type UploadedDocument = Awaited<ReturnType<typeof uploadAttachment>>

/** Phần body chung gửi BE khi lập phiếu nhận. */
export type DeliveryDocumentBody = {
  deliveryDocumentNo: string
  deliveryDocumentDate: string
  arrivedAt: string | null
  delivererName: string | null
  vehiclePlateNo: string | null
  documents: UploadedDocument[]
}

type ReadResult =
  | { error: string; focus?: string }
  | { body: Omit<DeliveryDocumentBody, 'documents'>; files: File[] }

/**
 * Trạng thái của bộ trường chứng từ: giới hạn ngày giờ, ảnh xem trước, bộ nhớ tệp đã tải (bấm lập lại không tải lại).
 * submitLabel là chữ của nút gửi, dùng trong thông báo khi giới hạn ngày giờ vừa đổi.
 */
export function useDeliveryDocuments(submitLabel: string) {
  const [dateLimits, setDateLimits] = useState(receiptDateLimits)
  const [images, setImages] = useState<{ src: string; name: string }[]>([])
  useEffect(
    () => () => images.forEach(({ src }) => URL.revokeObjectURL(src)),
    [images],
  )
  const uploads = useRef(new WeakMap<File, UploadedDocument>())
  const refreshDateLimits = () => setDateLimits(receiptDateLimits())

  /** Thông báo cho trường đầu tiên trình duyệt báo không hợp lệ (gắn vào onInvalid của form). */
  function invalidMessage(event: FormEvent<HTMLFormElement>) {
    const input = event.target
    if (
      !(input instanceof HTMLInputElement) ||
      input !== event.currentTarget.querySelector('input:invalid')
    )
      return undefined
    if (input.validity.rangeOverflow) {
      const future = receiptDatesInFuture(
        input.name === 'documentDate' ? input.value : '',
        input.name === 'arrivedAt' ? input.value : '',
      )
      refreshDateLimits()
      return future
        ? futureDateMessage
        : 'Giới hạn ngày giờ đã cập nhật. Bấm ' + submitLabel + ' để tiếp tục.'
    }
    if (input.validity.valueMissing) {
      if (input.name === 'documentNo') return 'Nhập số chứng từ.'
      if (input.name === 'documentDate') return 'Chọn ngày chứng từ.'
      if (input.name === 'documents' && receiptDocumentUploadEnabled)
        return 'Chọn ít nhất một tệp chứng từ.'
      return undefined
    }
    return 'Kiểm tra lại thông tin chứng từ.'
  }

  /** Đọc và kiểm tra bộ trường chứng từ trong form. */
  function read(form: HTMLFormElement): ReadResult {
    const fields = new FormData(form)
    const documentNo = String(fields.get('documentNo') ?? '').trim()
    if (!documentNo) return { error: 'Nhập số chứng từ.', focus: 'documentNo' }
    const documentDate = String(fields.get('documentDate') ?? '')
    if (!documentDate)
      return { error: 'Chọn ngày chứng từ.', focus: 'documentDate' }
    const arrivedAt = String(fields.get('arrivedAt') ?? '')
    if (receiptDatesInFuture(documentDate, arrivedAt)) {
      refreshDateLimits()
      return { error: futureDateMessage }
    }
    const files = fields
      .getAll('documents')
      .filter((file): file is File => file instanceof File && file.size > 0)
    if (receiptDocumentUploadEnabled && (!files.length || files.length > 10))
      return { error: 'Chọn từ 1 đến 10 tệp chứng từ.', focus: 'documents' }
    return {
      body: {
        deliveryDocumentNo: documentNo,
        deliveryDocumentDate: documentDate,
        arrivedAt: arrivedAt || null,
        delivererName: String(fields.get('delivererName') ?? '').trim() || null,
        vehiclePlateNo:
          String(fields.get('vehiclePlateNo') ?? '').trim() || null,
      },
      files,
    }
  }

  /** Tải các tệp chứng từ (tệp đã tải ở lần bấm trước thì dùng lại). */
  async function upload(files: File[]) {
    const documents: UploadedDocument[] = []
    if (!receiptDocumentUploadEnabled) return documents
    for (const file of files) {
      const document =
        uploads.current.get(file) ?? (await uploadAttachment(file))
      uploads.current.set(file, document)
      documents.push(document)
    }
    return documents
  }

  return {
    dateLimits,
    refreshDateLimits,
    images,
    setImages,
    invalidMessage,
    read,
    upload,
  }
}

export type DeliveryDocuments = ReturnType<typeof useDeliveryDocuments>
