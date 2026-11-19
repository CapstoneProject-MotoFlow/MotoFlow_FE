/**
 * File: shared/utils/imageFile.ts
 * Loại: THÀNH PHẦN / XỬ LÝ HỖ TRỢ — không phải màn hình.
 * Công dụng: Nhận biết tệp đính kèm là ảnh (theo content type, nếu không có thì theo đuôi tên tệp) để mở trình xem ảnh.
 */
export function isImageFile(fileName: string, contentType?: string | null) {
  if (contentType) return contentType.startsWith('image/')
  return /\.(jpe?g|png|webp|gif|bmp|heic|heif)$/i.test(fileName)
}

/** Link tải hợp lệ (http/https) mới được mở hoặc hiện ảnh. */
export const isHttpUrl = (url: string | null | undefined): url is string =>
  !!url && /^https?:\/\//i.test(url)
