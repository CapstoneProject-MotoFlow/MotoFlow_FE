/**
 * File: shared/utils/documentCode.ts
 * Loại: THÀNH PHẦN / XỬ LÝ HỖ TRỢ — không phải màn hình độc lập.
 * Công dụng: Một cách ghép mã chứng từ cho mọi màn (YCN-0003, PN-0006, DC-0002, KK-0001, YBS-0004, SO-11...).
 */
export type DocumentPrefix =
  'YCN' | 'PN' | 'DC' | 'KK' | 'YBS' | 'SO' | 'DB' | 'YCKK' | 'L'

/** documentCode: Ghép tiền tố + id. Đơn bán (SO) giữ id gốc, các loại khác đệm đủ 4 chữ số. Không có id thì trả "—". */
export function documentCode(
  prefix: DocumentPrefix,
  id: number | string | null | undefined,
) {
  if (id == null || id === '') return '—'
  if (prefix === 'SO') return 'SO-' + id
  return prefix + '-' + String(id).padStart(4, '0')
}
