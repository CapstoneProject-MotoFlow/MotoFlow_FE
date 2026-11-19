/**
 * File: shared/utils/searchText.ts
 * Loại: THÀNH PHẦN / XỬ LÝ HỖ TRỢ — không phải màn hình.
 * Công dụng: Mục C (PM 19/11): tìm kiếm lọc ở FE không phân biệt hoa thường và dấu tiếng Việt,
 * ví dụ gõ "nguyen van an" vẫn ra "Nguyễn Văn An".
 */

/** Chữ thường, bỏ dấu, "đ" → "d", bỏ khoảng trắng hai đầu. */
export function foldSearch(text: string) {
  return text
    .toLocaleLowerCase('vi')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replaceAll('đ', 'd')
    .trim()
}

/** true khi query rỗng hoặc có trong một trong các giá trị (so khớp sau khi bỏ dấu). */
export function matchesSearch(
  query: string,
  ...values: (string | number | null | undefined)[]
) {
  const needle = foldSearch(query)
  return (
    !needle ||
    values.some(
      (value) => value != null && foldSearch(String(value)).includes(needle),
    )
  )
}
