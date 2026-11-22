/**
 * GVHD 20/11 (BE PR 5): hàng lỗi được nhận thành một phụ tùng riêng "<SKU>-M", tên "<tên> (hàng lỗi)".
 * BE chưa trả cờ biến thể trên danh mục, nên FE nhận ra biến thể khi có đủ cả hai dấu hiệu SKU và tên
 * (chỉ đuôi SKU "-M" thì chưa đủ, tránh nhầm mã gốc vốn kết thúc bằng -M).
 */
export const DAMAGED_VARIANT_SKU_SUFFIX = '-M'
export const DAMAGED_VARIANT_NAME_SUFFIX = ' (hàng lỗi)'
/** Dữ liệu nhận trước khi BE đổi tên: vẫn nhận ra mã hàng lỗi. */
const LEGACY_DAMAGED_VARIANT_NAME_SUFFIX = ' (hàng móp)'

export function isDamagedVariant(part: {
  sku: string
  partName?: string | null
}) {
  return (
    part.sku.endsWith(DAMAGED_VARIANT_SKU_SUFFIX) &&
    (!!part.partName?.endsWith(DAMAGED_VARIANT_NAME_SUFFIX) ||
      !!part.partName?.endsWith(LEGACY_DAMAGED_VARIANT_NAME_SUFFIX))
  )
}

/** SKU của mã gốc, hoặc null khi phụ tùng không phải hàng lỗi. */
export function damagedVariantBaseSku(part: {
  sku: string
  partName?: string | null
}) {
  return isDamagedVariant(part)
    ? part.sku.slice(0, -DAMAGED_VARIANT_SKU_SUFFIX.length)
    : null
}
