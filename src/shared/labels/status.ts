/**
 * File: shared/labels/status.ts
 * Loại: THÀNH PHẦN / XỬ LÝ HỖ TRỢ — không phải màn hình độc lập.
 * Công dụng: Nhãn trạng thái dùng chung cho mọi màn. Cùng một mã (ví dụ CONFIRMED) có nghĩa khác nhau
 * theo loại chứng từ nên mỗi loại chứng từ có map riêng; màn nào dùng map của đúng loại chứng từ đó.
 */

/** Đơn bán (SO). */
export const salesOrderStatusLabels: Record<string, string> = {
  AWAITING_PICKING: 'Chờ lấy hàng',
  PICKED: 'Đã lấy, chờ xác nhận',
  CONFIRMED: 'Đã xác nhận, chờ thu tiền',
  COMPLETED: 'Hoàn tất',
  CANCELLED: 'Đã hủy',
}

/** Khoản tiền khách trả (thanh toán đơn, thu nợ, hoàn tiền). */
export const paymentStatusLabels: Record<string, string> = {
  UNVERIFIED: 'Chờ xác minh',
  VERIFIED: 'Đã xác minh',
  REJECTED: 'Bị từ chối',
}

export const paymentMethodLabels: Record<string, string> = {
  CASH: 'Tiền mặt',
  BANK_TRANSFER: 'Chuyển khoản',
}

/** Quyền mua chịu của khách. */
export const creditStatusLabels: Record<string, string> = {
  ELIGIBLE: 'Được mua chịu',
  NOT_GRANTED: 'Chưa được mua chịu',
  REVOKED: 'Đã thu hồi mua chịu',
}

/** Khoản nợ của khách. */
export const debtStatusLabels: Record<string, string> = {
  OUTSTANDING: 'Chưa thu',
  PARTIALLY_PAID: 'Đã thu một phần',
  SETTLED: 'Đã trả hết',
}

/** Yêu cầu nhập hàng (YCN). */
export const purchaseOrderStatusLabels: Record<string, string> = {
  AWAITING_DELIVERY: 'Chờ giao hàng',
  RECEIVING: 'Đang nhận hàng',
  FULLY_RECEIVED: 'Đã nhận đủ',
  CANCELLED: 'Đã hủy',
}

/** Phiếu nhập (PN) và việc kiểm nhận. */
export const goodsReceiptStatusLabels: Record<string, string> = {
  ASSIGNED: 'Chờ kiểm nhận',
  AWAITING_INSPECTION: 'Chờ kiểm nhận',
  RESULT_SUBMITTED: 'Chờ xác nhận',
  AWAITING_CONFIRMATION: 'Chờ xác nhận',
  AWAITING_RECOUNT: 'Chờ kiểm lại',
  CONFIRMED: 'Đã xác nhận',
  DONE: 'Đã xong',
  CANCELLED: 'Đã hủy',
}

/** Yêu cầu bổ sung (YBS), lệnh điều chuyển (DC), phiếu nhận điều chuyển và sai lệch điều chuyển. */
export const transferStatusLabels: Record<string, string> = {
  AWAITING_COORDINATION: 'Chờ điều phối',
  IN_PROGRESS: 'Đang điều chuyển / đang nhập',
  AWAITING_DISPATCH: 'Chờ xuất',
  IN_TRANSIT: 'Đang chuyển',
  RECONCILING: 'Đang xử lý chênh lệch',
  CLOSED: 'Đã đóng',
  DRAFT: 'Nháp',
  AWAITING_INSPECTION: 'Chờ kiểm nhận',
  AWAITING_CONFIRMATION: 'Chờ xác nhận',
  AWAITING_RECOUNT: 'Chờ kiểm lại',
  INSPECTING: 'Đang kiểm nhận',
  RESULT_SUBMITTED: 'Đã gửi kết quả',
  CONFIRMED: 'Đã xác nhận',
  OPEN: 'Đang xử lý',
  RESOLVED: 'Đã xử lý',
}

/** Cách xử lý sai lệch của lệnh điều chuyển. */
export const transferResolutionLabels: Record<string, string> = {
  MOVED_TO_AWAITING_RETURN: 'Chuyển chờ trả',
  RETURNED_TO_SUPPLIER: 'Đã trả nhà cung cấp',
  REPLACEMENT_RECEIVED: 'Đã nhận hàng giao bù',
  LATE_DELIVERY_RECEIVED: 'Đã nhận hàng đến muộn',
  RECEIVED_BACK_AT_SOURCE: 'Trả về kho nguồn',
  APPROVED_LOSS: 'Mất/hỏng',
  CLOSED_BY_AGREEMENT: 'Đóng theo thỏa thuận',
}

/** Sai lệch hàng nhà cung cấp giao: trạng thái hồ sơ. */
export const supplierDiscrepancyStatusLabels: Record<string, string> = {
  OPEN: 'Đang xử lý',
  CLOSED: 'Đã đóng',
}

/** Sai lệch hàng nhà cung cấp giao: các bước xử lý. */
export const supplierResolutionLabels: Record<string, string> = {
  MOVED_TO_AWAITING_RETURN: 'Chuyển sang chờ trả nhà cung cấp',
  RETURNED_TO_SUPPLIER: 'Đã trả nhà cung cấp',
  LATE_DELIVERY_RECEIVED: 'Đã nhận hàng đến muộn',
  RECEIVED_BACK_AT_SOURCE: 'Đã nhận lại tại kho nguồn',
  APPROVED_LOSS: 'Đã duyệt hao hụt',
  CLOSED_BY_AGREEMENT: 'Đóng theo thỏa thuận',
  RETURN_TO_SUPPLIER: 'Đã trả nhà cung cấp',
  SUPPLIER_RETURN: 'Đã trả nhà cung cấp',
  REPLACEMENT_RECEIVED: 'Đã nhận hàng giao bù',
  REPLACEMENT_WAIVED: 'Không cần nhà cung cấp giao bù',
  WRITE_OFF: 'Xử lý hàng hỏng',
}

/** Trạng thái tồn của một lượng hàng. */
export const stockStatusLabels: Record<string, string> = {
  AVAILABLE: 'Có thể bán',
  AWAITING_INSPECTION: 'Chờ kiểm nhận',
  WRONG_ITEM: 'Giao sai',
  DAMAGED: 'Hư hỏng',
  AWAITING_SUPPLIER_RETURN: 'Chờ trả nhà cung cấp',
  IN_TRANSIT: 'Đang chuyển',
}

/** Kiểm kê (KK): loại và trạng thái phiên kiểm kê. */
export const stockCountTypeLabels: Record<string, string> = {
  CYCLE: 'Định kỳ',
  YEAR_END: 'Cuối năm',
  OPENING: 'Đầu kỳ',
}
export const stockCountStatusLabels: Record<string, string> = {
  DRAFT: 'Nháp, chưa bắt đầu đếm',
  COUNTING: 'Đang đếm',
  AWAITING_APPROVAL: 'Chờ chủ cửa hàng duyệt',
  COMPLETED: 'Hoàn tất',
  CANCELLED: 'Đã hủy',
}
